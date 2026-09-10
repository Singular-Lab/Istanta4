import type { WebSocket as WsWebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { log } from '../logger';
import { PluginAnalyticsEvent } from '../models/plugin_analytics_event';
import { Sequelize } from 'sequelize';
import type {
  PluginAnalyticsEvent as PluginAnalyticsEventPayload,
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
    // Flush periodico
    this.flushTimer = setInterval(() => this.flushBuffer(), this.FLUSH_INTERVAL_MS);

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
      this.handleSessionResume(ws, msg.sessionId || '');
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
    const events = msg.events.slice(0, this.MAX_EVENTS_PER_BATCH);

    // Validare e accodare
    let validCount = 0;
    for (const event of events) {
      if (!event.type || !event.eventId || !event.timestamp) continue;

      this.eventBuffer.push({
        event_id: event.eventId,
        event_type: event.type,
        timestamp_event: new Date(event.timestamp),
        slug: event.slug || connMeta.slug,
        fp_version: event.fpVersion || connMeta.fpVersion || '',
        page_origin: (event.pageOrigin || connMeta.origin).substring(0, 255),
        page_path: (event.pagePath || '').substring(0, 500),
        session_id: event.sessionId || '',
        sequence: event.sequence ?? 0,
        viewport: event.viewport || null,
        ip_address: connMeta.ip,
        user_agent: connMeta.userAgent,
        event_data: event.data || null,
      });
      validCount++;
    }

    this.metrics.totalEventsReceived += validCount;
    this.eventsInLastWindow += validCount;
    this.metrics.queueSize = this.eventBuffer.length;
    connMeta.eventsReceived += validCount;

    // Ack
    this.sendMessage(ws, { type: 'ack', count: validCount });

    // Flush se buffer pieno
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      this.flushBuffer();
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
   * Gestisce payload beacon (HTTP POST fallback)
   */
  handleBeaconPayload(events: PluginAnalyticsEventPayload[], ip: string, userAgent: string): void {
    for (const event of events) {
      if (!event.type || !event.eventId || !event.timestamp) continue;

      this.eventBuffer.push({
        event_id: event.eventId,
        event_type: event.type,
        timestamp_event: new Date(event.timestamp),
        slug: event.slug || '',
        fp_version: event.fpVersion || '',
        page_origin: (event.pageOrigin || '').substring(0, 255),
        page_path: (event.pagePath || '').substring(0, 500),
        session_id: event.sessionId || '',
        sequence: event.sequence ?? 0,
        viewport: event.viewport || null,
        ip_address: ip,
        user_agent: userAgent,
        event_data: event.data || null,
      });
    }

    this.metrics.totalEventsReceived += events.length;
    this.eventsInLastWindow += events.length;
    this.metrics.queueSize = this.eventBuffer.length;

    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      this.flushBuffer();
    }
  }

  /**
   * Flush del buffer verso PostgreSQL
   */
  private async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0 || this.flushing) return;

    this.flushing = true;
    const batch = this.eventBuffer.splice(0);

    try {
      await PluginAnalyticsEvent.bulkCreate(batch as any[]);
      this.metrics.totalEventsPersisted += batch.length;
      this.metrics.lastFlushTime = new Date();
      log.debug(`[PluginAnalytics] Flush: ${batch.length} eventi persistiti`);
    } catch (error) {
      log.error('[PluginAnalytics] Flush fallito, eventi reinseriti nel buffer', error);
      this.eventBuffer.unshift(...batch);
      this.metrics.totalErrors++;
    }

    this.metrics.queueSize = this.eventBuffer.length;
    this.flushing = false;
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
