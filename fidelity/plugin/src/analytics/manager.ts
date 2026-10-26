import { fpLogger } from '../logger';
import type { AnalyticsEvent, AnalyticsInstanceMeta } from './types';
import type FP from '../index';

// ============================================
// ANALYTICS MANAGER (Singleton statico, condiviso tra istanze FP)
// ============================================

export class PluginAnalyticsManager {
    private static instance: PluginAnalyticsManager | null = null;

    // Connessione condivisa
    private ws: WebSocket | null = null;
    private buffer: Array<{ fp: FP; event: AnalyticsEvent }> = [];
    private pendingResume = true; // Blocca il flush finché session:resumed non arriva
    private flushTimer?: ReturnType<typeof setInterval>;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private reconnectAttempt = 0;
    private visibilityHandler?: () => void;

    // Reference counting
    private registeredInstances = new Map<FP, AnalyticsInstanceMeta>();

    // Config
    private apiUrl = '';
    private wsUrl = '';
    private bufferSize = 50;
    private flushIntervalMs = 10_000;

    // Costanti
    private readonly MAX_RECONNECT = 10;
    private readonly RECONNECT_BASE_MS = 1_000;
    private readonly RECONNECT_MAX_MS = 60_000;


    static getInstance(): PluginAnalyticsManager {
        if (!PluginAnalyticsManager.instance) {
            PluginAnalyticsManager.instance = new PluginAnalyticsManager();
        }
        return PluginAnalyticsManager.instance;
    }

    register(fp: FP, meta: AnalyticsInstanceMeta): void {
        try {
            this.registeredInstances.set(fp, meta);

            if (this.registeredInstances.size === 1) {
                // Prima istanza: configura e connetti
                this.apiUrl = meta.apiUrl;
                if (meta.wsPort !== undefined) {
                    this.bufferSize = 50;
                }
                this.connect(meta);
                this.startFlushTimer();
                this.setupVisibilityHandler();
            }
        } catch (err) {
            fpLogger.error('[FP Analytics] Errore durante la registrazione dell\'istanza:', err);
        }
    }

    unregister(fp: FP): void {
        try {
            // Flush PRIMA di rimuovere, così assignSequences trova ancora il meta
            const isLast = this.registeredInstances.size === 1 && this.registeredInstances.has(fp);
            if (isLast) {
                this.flush();
            }
            this.registeredInstances.delete(fp);
            if (this.registeredInstances.size === 0) {
                this.close();
                PluginAnalyticsManager.instance = null;
            }
        } catch (err) {
            fpLogger.error('[FP Analytics] Errore durante la de-registrazione dell\'istanza:', err);
        }
    }

    trackEvent(fp: FP, event: AnalyticsEvent): void {
        this.buffer.push({ fp, event });
        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }

    private async connect(meta: AnalyticsInstanceMeta): Promise<void> {
        try {
            const tokenStr = await meta.getToken();
            const browserHash = meta.getBrowserHash();
            if (!tokenStr || !browserHash) {
                fpLogger.warn('[FP Analytics] Token o browserHash mancante, connessione WS non avviata');
                return;
            }

            const httpUrl = new URL(meta.apiUrl);
            const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsPort = meta.wsPort ?? (parseInt(httpUrl.port || '3010') + 390);

            this.wsUrl = `${wsProtocol}//${httpUrl.hostname}:${wsPort}/ws/plugin-events`
                + `?token=${encodeURIComponent(tokenStr)}`
                + `&browserHash=${encodeURIComponent(browserHash)}`
                + `&fpVersion=${encodeURIComponent('1.0.0')}`
                + `&slug=shared`;

            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                this.reconnectAttempt = 0;
                fpLogger.log('[FP Analytics] WebSocket connesso');

                // Primo messaggio: chiedi l'ultima sequenza per questa sessione
                if (this.ws && meta.sessionId) {
                    this.ws.send(JSON.stringify({ type: 'session:resume', sessionId: meta.sessionId }));
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data as string) as { type: string; lastSequence?: number; expired?: boolean };
                    if (msg.type === 'session:resumed') {
                        fpLogger.log(`[FP Analytics] session:resumed lastSequence=${msg.lastSequence} expired=${msg.expired}`);
                        // 1. Callback all'istanza FP per aggiornare sessionId/sequence
                        meta.onSessionResumed({
                            lastSequence: msg.lastSequence ?? 0,
                            expired: msg.expired ?? true,
                        });
                        // 2. Sblocca il flush e invia gli eventi bufferizzati
                        this.pendingResume = false;
                        this.flush();
                    }
                    // ack/pong/error: noop
                } catch {
                    // Messaggio non JSON, ignora
                }
            };

            this.ws.onclose = (event) => {
                this.ws = null;
                fpLogger.warn(`[FP Analytics] WebSocket chiuso (code: ${event.code}, reason: ${event.reason || 'N/A'})`);
                this.scheduleReconnect();
            };

            this.ws.onerror = (event) => {
                fpLogger.error('[FP Analytics] Errore WebSocket:', event);
            };
        } catch (err) {
            fpLogger.warn('[FP Analytics] Errore connessione WS:', err);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempt >= this.MAX_RECONNECT) {
            fpLogger.error(`[FP Analytics] Max tentativi reconnect raggiunti (${this.MAX_RECONNECT}), connessione WS abbandonata`);
            return;
        }
        if (this.registeredInstances.size === 0) return;

        const delay = Math.min(
            this.RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
            this.RECONNECT_MAX_MS
        );
        const jitter = delay * 0.2 * Math.random();
        const totalDelay = delay + jitter;

        this.reconnectAttempt++;
        fpLogger.warn(`[FP Analytics] Tentativo reconnect ${this.reconnectAttempt}/${this.MAX_RECONNECT} tra ${Math.round(totalDelay / 1000)}s`);

        this.reconnectTimer = setTimeout(() => {
            const firstMeta = this.registeredInstances.values().next().value;
            if (firstMeta) {
                this.connect(firstMeta);
            } else {
                fpLogger.warn('[FP Analytics] Nessuna istanza registrata, reconnect annullato');
            }
        }, totalDelay);
    }

    /**
     * Assegna sessionId e sequence agli eventi nel batch prima dell'invio.
     * Ogni evento riceve il sessionId corrente e il prossimo numero di sequenza dall'istanza FP proprietaria.
     */
    private assignSequences(batch: Array<{ fp: FP; event: AnalyticsEvent }>): AnalyticsEvent[] {
        return batch.map(({ fp, event }) => {
            const meta = this.registeredInstances.get(fp);
            if (meta) {
                event.sessionId = meta.getCurrentSessionId();
                event.sequence = meta.getNextSequence();
            }
            return event;
        });
    }

    private flush(): void {
        if (this.buffer.length === 0) return;
        if (this.pendingResume) return;

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const batch = this.buffer.splice(0);
        const events = this.assignSequences(batch);
        try {
            this.ws.send(JSON.stringify({ type: 'events:batch', events }));
        } catch {
            // Rimetti nel buffer (con riferimento FP intatto)
            this.buffer.unshift(...batch);
        }
    }


    private startFlushTimer(): void {
        this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    }

    private setupVisibilityHandler(): void {
        this.visibilityHandler = () => {
            if (document.visibilityState === 'hidden' && this.buffer.length > 0 && !this.pendingResume) {
                const batch = this.buffer.splice(0);
                const events = this.assignSequences(batch);
                const payload = JSON.stringify({
                    type: 'events:batch',
                    events,
                });
                const beaconUrl = `${this.apiUrl}/api/plugin-analytics/beacon`;
                navigator.sendBeacon(beaconUrl, new Blob([payload], { type: 'application/json' }));
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    private close(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = undefined;
        }
        if (this.ws) {
            this.ws.onclose = null; // Evita riconnessione
            this.ws.close();
            this.ws = null;
        }
    }
}
