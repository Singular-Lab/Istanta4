import type { WebSocket as WsWebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { log } from '../logger';
import { PluginAnalyticsEvent } from '../models/plugin_analytics_event';
import { DatabaseError, Sequelize, ValidationError } from 'sequelize';
import type {
  PluginAnalyticsEventRow,
  PluginWsMessage,
  PluginWsServerMessage,
} from '../../../lib/pluginAnalyticsTypes';
import type { PluginAnalyticsMonitorDTO } from '../dto/PluginAnalyticsDTO';

interface ConnectionMeta {
  slug: string;
  fpVersion: string;
  origin: string;
  ip: string;
  userAgent: string;
  connectedAt: Date;
  eventsReceived: number;
  batchCount: number;
  lastBatchTime: number;
}

/** Eventi in attesa di salvataggio oltre i quali si scartano i piu' vecchi (database giu' a lungo). */
export const MASSIMO_EVENTI_IN_ATTESA = 10_000;

const INTERO_MINIMO = -2_147_483_648;
const INTERO_MASSIMO = 2_147_483_647;

/** Dati della connessione che completano un evento del plugin. */
export interface ContestoEventoPlugin {
  slug: string;
  fpVersion: string;
  origin: string;
  ip: string;
  userAgent: string;
}

const testoFinoA = (valore: unknown, massimo: number): string | null =>
  typeof valore === 'string' && valore.length > 0 && valore.length <= massimo ? valore : null;

const oggettoONull = <T>(valore: unknown): T | null =>
  typeof valore === 'object' && valore !== null ? valore as T : null;

/**
 * La riga da salvare per un evento ricevuto dal plugin, o il motivo per cui non si puo' salvare
 * (spec processi-in-produzione, "Eventi del plugin non validi scartati senza bloccare gli altri"):
 * i limiti sono quelli delle colonne di plugin_analytics_events. Identificativi e tipo troppo lunghi
 * scartano l'evento; origine, percorso e versione, solo descrittivi, si accorciano.
 */
export function rigaEventoPlugin(evento: unknown, contesto: ContestoEventoPlugin): { riga: PluginAnalyticsEventRow } | { motivo: string } {
  if (typeof evento !== 'object' || evento === null) return { motivo: 'evento non e\' un oggetto' };
  const e = evento as Record<string, unknown>;

  const eventId = testoFinoA(e.eventId, 36);
  if (!eventId) return { motivo: 'eventId mancante o oltre 36 caratteri' };
  const tipo = testoFinoA(e.type, 50);
  if (!tipo) return { motivo: 'type mancante o oltre 50 caratteri' };
  const timestamp = typeof e.timestamp === 'string' || typeof e.timestamp === 'number' ? new Date(e.timestamp) : null;
  if (!e.timestamp || !timestamp || Number.isNaN(timestamp.getTime())) return { motivo: 'timestamp mancante o non valido' };
  const slug = testoFinoA(e.slug || contesto.slug, 100);
  if (!slug) return { motivo: 'slug mancante o oltre 100 caratteri' };
  const sessionId = e.sessionId === undefined || e.sessionId === null || e.sessionId === '' ? '' : testoFinoA(e.sessionId, 36);
  if (sessionId === null) return { motivo: 'sessionId oltre 36 caratteri' };
  const sequenza = e.sequence ?? 0;
  if (typeof sequenza !== 'number' || !Number.isInteger(sequenza) || sequenza < INTERO_MINIMO || sequenza > INTERO_MASSIMO) {
    return { motivo: 'sequence non e\' un intero' };
  }

  const versione = typeof e.fpVersion === 'string' && e.fpVersion ? e.fpVersion : contesto.fpVersion;
  const origine = typeof e.pageOrigin === 'string' && e.pageOrigin ? e.pageOrigin : contesto.origin;
  const percorso = typeof e.pagePath === 'string' ? e.pagePath : '';

  return {
    riga: {
      event_id: eventId,
      event_type: tipo,
      timestamp_event: timestamp,
      slug,
      fp_version: (versione || '').substring(0, 20),
      page_origin: origine.substring(0, 255),
      page_path: percorso.substring(0, 500),
      session_id: sessionId,
      sequence: sequenza,
      viewport: oggettoONull(e.viewport),
      ip_address: contesto.ip.substring(0, 45),
      user_agent: contesto.userAgent,
      event_data: oggettoONull(e.data),
    },
  };
}

/** La riga come la vuole il modello: il viewport e' un oggetto JSON qualsiasi. */
const rigaPerDatabase = (riga: PluginAnalyticsEventRow) => ({
  ...riga,
  viewport: riga.viewport as unknown as Record<string, unknown> | null,
});

/**
 * Il database ha rifiutato i dati (valore troppo lungo, data o JSON non validi, vincolo violato):
 * riprovare non serve. Ogni altro errore (connessione, timeout) si riprova al giro successivo.
 */
export function eDatoRifiutato(errore: unknown): boolean {
  if (errore instanceof ValidationError) return true;
  if (!(errore instanceof DatabaseError)) return false;
  const codice = (errore as DatabaseError & { original?: { code?: unknown } }).original?.code;
  // Classi SQLSTATE 22 (dato non valido) e 23 (vincolo di integrita')
  return typeof codice === 'string' && (codice.startsWith('22') || codice.startsWith('23'));
}

/**
 * PluginAnalyticsGatewayService
 *
 * Singleton che gira sul master process.
 * Gestisce le connessioni WebSocket dal plugin, riceve eventi in batch,
 * li accumula in un buffer in-memory e li persiste in PostgreSQL con bulkCreate periodico.
 *
 * Pattern ispirato a AuditLogService (buffer + flush periodico).
 */
export class PluginAnalyticsGatewayService {
  private static instance: PluginAnalyticsGatewayService | null = null;

  // Event buffer
  private eventBuffer: PluginAnalyticsEventRow[] = [];
  private readonly BUFFER_SIZE = 500;
  private readonly FLUSH_INTERVAL_MS = 10_000;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  // Scartati dall'ultimo riepilogo nel log
  private scartati = 0;
  private scartatiPerLimite = 0;

  // Rate limiting per connection
  private readonly MAX_EVENTS_PER_BATCH = 100;
  private readonly MAX_BATCHES_PER_MINUTE = 10;

  // Connection tracking
  private connections = new Map<WsWebSocket, ConnectionMeta>();

  // Monitoring metrics
  private metrics = {
    activeConnections: 0,
    totalEventsReceived: 0,
    totalEventsPersisted: 0,
    totalErrors: 0,
    eventsPerSecond: 0,
    queueSize: 0,
    lastFlushTime: null as Date | null,
  };
  private eventsInLastWindow = 0;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Flush periodico. flushBuffer e handleSessionResume intercettano da se' i propri errori
    this.flushTimer = setInterval(() => void this.flushBuffer(), this.FLUSH_INTERVAL_MS);

    // Calcolo events/sec ogni 5 secondi
    this.metricsTimer = setInterval(() => {
      this.metrics.eventsPerSecond = Math.round(this.eventsInLastWindow / 5);
      this.eventsInLastWindow = 0;
    }, 5_000);
  }

  static getInstance(): PluginAnalyticsGatewayService {
    if (!PluginAnalyticsGatewayService.instance) {
      PluginAnalyticsGatewayService.instance = new PluginAnalyticsGatewayService();
    }
    return PluginAnalyticsGatewayService.instance;
  }

  /**
   * Gestisce una nuova connessione WebSocket dal plugin
   */
  handleConnection(ws: WsWebSocket, request: IncomingMessage, meta: { slug: string; fpVersion: string }): void {
    const origin = request.headers.origin || 'unknown';
    const ip = request.socket.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    const connMeta: ConnectionMeta = {
      slug: meta.slug,
      fpVersion: meta.fpVersion,
      origin,
      ip,
      userAgent,
      connectedAt: new Date(),
      eventsReceived: 0,
      batchCount: 0,
      lastBatchTime: 0,
    };

    this.connections.set(ws, connMeta);
    this.metrics.activeConnections = this.connections.size;

    log.info(`[PluginAnalytics] Nuova connessione da ${origin} (slug: ${meta.slug})`);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msgStr = typeof raw === 'string' ? raw : raw.toString();
        const msg = JSON.parse(msgStr) as PluginWsMessage;
        this.handleMessage(ws, msg, connMeta);
      } catch {
        this.sendMessage(ws, { type: 'error', message: 'Invalid JSON' });
      }
    });

    // Frame non valido o connessione interrotta: ws chiude da se' la connessione. Senza ascoltatore,
    // l'evento 'error' diventerebbe un'eccezione non gestita del primary
    ws.on('error', (errore: Error) => {
      log.warn(`[PluginAnalytics] Connessione da ${origin} chiusa per errore`, { errore: errore.message });
    });

    ws.on('close', () => {
      this.connections.delete(ws);
      this.metrics.activeConnections = this.connections.size;
      log.info(`[PluginAnalytics] Connessione chiusa da ${origin}`);
    });

    // Heartbeat: ping ogni 30s
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30_000);

    ws.on('close', () => clearInterval(pingInterval));
  }

  /**
   * Gestisce un messaggio ricevuto via WebSocket
   */
  private handleMessage(ws: WsWebSocket, msg: PluginWsMessage, connMeta: ConnectionMeta): void {
    if (msg.type === 'ping') {
      this.sendMessage(ws, { type: 'pong' });
      return;
    }

    if (msg.type === 'session:resume') {
      void this.handleSessionResume(ws, msg.sessionId || '');
      return;
    }

    if (msg.type !== 'events:batch' || !msg.events) {
      this.sendMessage(ws, { type: 'error', message: 'Unsupported message type' });
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - connMeta.lastBatchTime < 60_000) {
      connMeta.batchCount++;
    } else {
      connMeta.batchCount = 1;
      connMeta.lastBatchTime = now;
    }

    if (connMeta.batchCount > this.MAX_BATCHES_PER_MINUTE) {
      this.sendMessage(ws, { type: 'error', message: 'Rate limit exceeded' });
      return;
    }

    // Limitare dimensione batch
    const events: unknown[] = Array.isArray(msg.events) ? msg.events.slice(0, this.MAX_EVENTS_PER_BATCH) : [];

    // Validare e accodare: un evento che il database rifiuterebbe si scarta subito
    let validCount = 0;
    const contesto: ContestoEventoPlugin = {
      slug: connMeta.slug,
      fpVersion: connMeta.fpVersion,
      origin: connMeta.origin,
      ip: connMeta.ip,
      userAgent: connMeta.userAgent,
    };
    const righe: PluginAnalyticsEventRow[] = [];
    for (const event of events) {
      const esito = rigaEventoPlugin(event, contesto);
      if ('motivo' in esito) {
        this.scartati++;
        continue;
      }
      righe.push(esito.riga);
    }
    this.accoda(righe);
    validCount = righe.length;

    this.metrics.totalEventsReceived += validCount;
    this.eventsInLastWindow += validCount;
    this.metrics.queueSize = this.eventBuffer.length;
    connMeta.eventsReceived += validCount;

    // Ack
    this.sendMessage(ws, { type: 'ack', count: validCount });

    // Flush se buffer pieno
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      void this.flushBuffer();
    }
  }

  /**
   * Gestisce la richiesta session:resume.
   * Cerca l'ultimo evento per il sessionId dato e risponde con lastSequence e expired.
   * Se l'ultimo evento è più vecchio di 1 giorno, la sessione è considerata scaduta.
   */
  private async handleSessionResume(ws: WsWebSocket, sessionId: string): Promise<void> {
    if (!sessionId) {
      this.sendMessage(ws, { type: 'session:resumed', lastSequence: 0, expired: true });
      return;
    }

    try {
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      const lastEvent = await PluginAnalyticsEvent.findOne({
        attributes: [
          [Sequelize.fn('MAX', Sequelize.col('sequence')), 'sequence'],
          [Sequelize.fn('MAX', Sequelize.col('timestamp_event')), 'timestamp_event'],
        ],
        where: { session_id: sessionId },
        raw: true,
      });

      if (!lastEvent || lastEvent.sequence == null) {
        // Nessun evento trovato per questa sessione
        this.sendMessage(ws, { type: 'session:resumed', lastSequence: 0, expired: true });
        return;
      }

      const lastTimestamp = new Date(lastEvent.timestamp_event).getTime();
      const expired = Date.now() - lastTimestamp > ONE_DAY_MS;

      this.sendMessage(ws, {
        type: 'session:resumed',
        lastSequence: expired ? 0 : lastEvent.sequence,
        expired,
      });

      log.info(`[PluginAnalytics] session:resume sessionId=${sessionId} lastSeq=${lastEvent.sequence} expired=${expired}`);
    } catch (error) {
      log.error('[PluginAnalytics] Errore in session:resume', error);
      this.sendMessage(ws, { type: 'session:resumed', lastSequence: 0, expired: true });
    }
  }

  /**
   * Accoda gli eventi; oltre MASSIMO_EVENTI_IN_ATTESA scarta i piu' vecchi. Senza limite, con il
   * database giu' a lungo, la memoria del primary crescerebbe fino a fermarlo.
   */
  private accoda(righe: PluginAnalyticsEventRow[], inTesta = false): void {
    this.eventBuffer = inTesta ? righe.concat(this.eventBuffer) : this.eventBuffer.concat(righe);
    const inPiu = this.eventBuffer.length - MASSIMO_EVENTI_IN_ATTESA;
    if (inPiu > 0) {
      this.eventBuffer.splice(0, inPiu);
      this.scartatiPerLimite += inPiu;
    }
  }

  /**
   * Flush del buffer verso PostgreSQL. Non lancia mai: gira da un timer del primary.
   * Un evento che il database rifiuta si scarta e gli altri si salvano; con il database non
   * raggiungibile il lotto torna in coda e si riprova al giro successivo.
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0 || this.flushing) return;

    this.flushing = true;
    const batch = this.eventBuffer.splice(0);

    try {
      const daRiprovare = await this.salva(batch);
      if (daRiprovare.length > 0) this.accoda(daRiprovare, true);
    } catch (error) {
      log.error('[PluginAnalytics] Flush fallito, eventi reinseriti nel buffer', error);
      this.metrics.totalErrors++;
      this.accoda(batch, true);
    } finally {
      this.metrics.queueSize = this.eventBuffer.length;
      this.flushing = false;
      this.segnalaScartati();
    }
  }

  /** Salva il lotto; restituisce gli eventi da riprovare perche' il database non e' raggiungibile. */
  private async salva(batch: PluginAnalyticsEventRow[]): Promise<PluginAnalyticsEventRow[]> {
    try {
      await PluginAnalyticsEvent.bulkCreate(batch.map(rigaPerDatabase));
      this.registraSalvati(batch.length);
      log.debug(`[PluginAnalytics] Flush: ${batch.length} eventi persistiti`);
      return [];
    } catch (error) {
      this.metrics.totalErrors++;
      if (!eDatoRifiutato(error)) {
        log.warn('[PluginAnalytics] Database non raggiungibile, eventi rimessi in coda', {
          eventi: batch.length,
          errore: error instanceof Error ? error.message : String(error),
        });
        return batch;
      }
      // Un evento rifiutato non deve bloccare gli altri: si salvano uno alla volta
      return this.salvaUnoAllaVolta(batch);
    }
  }

  private async salvaUnoAllaVolta(batch: PluginAnalyticsEventRow[]): Promise<PluginAnalyticsEventRow[]> {
    for (let i = 0; i < batch.length; i++) {
      try {
        await PluginAnalyticsEvent.create(rigaPerDatabase(batch[i]));
        this.registraSalvati(1);
      } catch (error) {
        if (!eDatoRifiutato(error)) return batch.slice(i);
        this.scartati++;
        log.warn('[PluginAnalytics] Evento scartato: il database lo rifiuta', {
          eventType: batch[i].event_type.substring(0, 50),
          errore: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return [];
  }

  private registraSalvati(quanti: number): void {
    this.metrics.totalEventsPersisted += quanti;
    this.metrics.lastFlushTime = new Date();
  }

  /** Un riepilogo per giro di flush, non una riga per evento scartato. */
  private segnalaScartati(): void {
    if (this.scartati === 0 && this.scartatiPerLimite === 0) return;
    log.warn('[PluginAnalytics] Eventi del plugin scartati', {
      nonValidi: this.scartati,
      oltreIlLimite: this.scartatiPerLimite,
      massimoInAttesa: MASSIMO_EVENTI_IN_ATTESA,
    });
    this.scartati = 0;
    this.scartatiPerLimite = 0;
  }

  /**
   * Force flush (usato dallo shutdown)
   */
  async forceFlush(): Promise<void> {
    await this.flushBuffer();
  }

  /**
   * Metriche per monitoring
   */
  getMetrics(): PluginAnalyticsMonitorDTO {
    return {
      activeConnections: this.metrics.activeConnections,
      totalEventsReceived: this.metrics.totalEventsReceived,
      totalEventsPersisted: this.metrics.totalEventsPersisted,
      totalErrors: this.metrics.totalErrors,
      eventsPerSecond: this.metrics.eventsPerSecond,
      queueSize: this.metrics.queueSize,
      lastFlushTime: this.metrics.lastFlushTime?.toISOString() || null,
    };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    await this.flushBuffer();

    // Chiudi tutte le connessioni
    for (const [ws] of this.connections) {
      ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();
    PluginAnalyticsGatewayService.instance = null;
  }

  private sendMessage(ws: WsWebSocket, msg: PluginWsServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
