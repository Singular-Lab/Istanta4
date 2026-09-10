import { Request } from 'express';
import { Op } from 'sequelize';
import { TIPO_UTENTI } from '../../../lib/enums';
import config from '../config';
import { log } from '../logger';
import type { AuditLogAttributes, AuditLogCreationAttributes } from '../models/audit_log';
import { Utente } from '../models/utenti';
import type { AuditLogFilterOptions, AuditLogSummaryResult, IAuditLogRepository } from '../repositories/AuditLogRepository';

/**
 * Tipi di eventi di audit
 */
export enum AuditEventType {
  // Eventi di autenticazione
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Eventi di autorizzazione
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_ESCALATION = 'PERMISSION_ESCALATION',

  // Eventi di gestione utenti
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

  // Eventi di sicurezza
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',

  // Eventi di sistema
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',

  // Eventi di business
  DATA_EXPORT = 'DATA_EXPORT',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  BULK_OPERATION = 'BULK_OPERATION'
}

/**
 * Livelli di severità per gli eventi di audit
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Interfaccia per un evento di audit
 */
interface AuditEvent {
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userType?: TIPO_UTENTI;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details?: Record<string, any>;
  result?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  timestamp: Date;
  requestId?: string;
  targetEntityId?: string;
  targetEntityType?: string;
}

/**
 * Interfaccia per le metriche di audit
 */
interface AuditMetrics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  failedLogins: number;
  suspiciousActivities: number;
  lastAuditTime: Date | null;
}

/**
 * Service per la gestione avanzata dei log di audit.
 * Singleton con buffer in-memory + persistenza su PostgreSQL.
 */
export class AuditLogService {
  private static instance: AuditLogService;
  private metrics: AuditMetrics;
  private eventBuffer: AuditEvent[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30 secondi
  private repository: IAuditLogRepository | null = null;

  private readonly SENSITIVE_IP_DETAIL_KEYS = new Set([
    'ip',
    'ipaddress',
    'clientip',
    'remoteip',
    'remoteaddress',
    'xforwardedfor',
    'iprichiedente'
  ]);

  private constructor() {
    this.metrics = {
      totalEvents: 0,
      eventsByType: {} as Record<AuditEventType, number>,
      eventsBySeverity: {} as Record<AuditSeverity, number>,
      failedLogins: 0,
      suspiciousActivities: 0,
      lastAuditTime: null
    };

    // Inizializza le metriche
    Object.values(AuditEventType).forEach(type => {
      this.metrics.eventsByType[type] = 0;
    });

    Object.values(AuditSeverity).forEach(severity => {
      this.metrics.eventsBySeverity[severity] = 0;
    });

    // Avvia il flush periodico del buffer
    setInterval(() => {
      this.flushBuffer();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Ottiene l'istanza singleton del service
   */
  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  /**
   * Inietta il repository per la persistenza su DB.
   * Chiamato dal container DI dopo l'inizializzazione.
   */
  public setRepository(repo: IAuditLogRepository): void {
    this.repository = repo;
    log.info('AuditLogService: repository DB collegato');
  }

  /**
   * Estrae informazioni dalla richiesta HTTP
   */
  private extractRequestInfo(req?: Request): Partial<AuditEvent> {
    if (!req) return {};

    return {
      userId: req.session?.id_utente,
      userType: req.session?.tipo_utente as TIPO_UTENTI,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.get('X-Request-ID')
    };
  }

  /**
   * Determina automaticamente la severità basata sul tipo di evento
   */
  private determineSeverity(eventType: AuditEventType, _details?: Record<string, any>): AuditSeverity {
    const criticalEvents = [
      AuditEventType.PERMISSION_ESCALATION,
      AuditEventType.SECURITY_VIOLATION,
      AuditEventType.SUSPICIOUS_ACTIVITY
    ];

    const highEvents = [
      AuditEventType.ACCESS_DENIED,
      AuditEventType.USER_DELETED,
      AuditEventType.USER_ROLE_CHANGED,
      AuditEventType.CSRF_TOKEN_INVALID,
      AuditEventType.SYSTEM_ERROR
    ];

    const mediumEvents = [
      AuditEventType.LOGIN_FAILED,
      AuditEventType.RATE_LIMIT_EXCEEDED,
      AuditEventType.USER_CREATED,
      AuditEventType.USER_UPDATED,
      AuditEventType.CONFIGURATION_CHANGED,
      AuditEventType.BULK_OPERATION,
      AuditEventType.DATA_EXPORT,
      AuditEventType.SENSITIVE_DATA_ACCESS
    ];

    if (criticalEvents.includes(eventType)) {
      return AuditSeverity.CRITICAL;
    }

    if (highEvents.includes(eventType)) {
      return AuditSeverity.HIGH;
    }

    if (mediumEvents.includes(eventType)) {
      return AuditSeverity.MEDIUM;
    }

    return AuditSeverity.LOW;
  }

  /**
   * Registra un evento di audit
   */
  public logEvent(
    eventType: AuditEventType,
    options: {
      req?: Request;
      userId?: string;
      userType?: TIPO_UTENTI;
      resource?: string;
      action?: string;
      details?: Record<string, any>;
      result?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
      severity?: AuditSeverity;
      targetEntityId?: string;
      targetEntityType?: string;
    } = {}
  ): void {
    const requestInfo = this.extractRequestInfo(options.req);
    const severity = options.severity || this.determineSeverity(eventType, options.details);

    const auditEvent: AuditEvent = {
      eventType,
      severity,
      userId: options.userId || requestInfo.userId,
      userType: options.userType || requestInfo.userType,
      sessionId: requestInfo.sessionId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
      requestId: requestInfo.requestId,
      resource: options.resource,
      action: options.action,
      details: options.details,
      result: options.result || 'SUCCESS',
      timestamp: new Date(),
      targetEntityId: options.targetEntityId,
      targetEntityType: options.targetEntityType
    };

    // Aggiorna le metriche
    this.updateMetrics(auditEvent);

    // Aggiungi al buffer
    this.eventBuffer.push(auditEvent);

    // Flush immediato per eventi critici
    if (severity === AuditSeverity.CRITICAL) {
      this.flushBuffer();
    }

    // Flush se il buffer è pieno
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      this.flushBuffer();
    }
  }

  /**
   * Aggiorna le metriche interne
   */
  private updateMetrics(event: AuditEvent): void {
    this.metrics.totalEvents++;
    this.metrics.eventsByType[event.eventType]++;
    this.metrics.eventsBySeverity[event.severity]++;
    this.metrics.lastAuditTime = event.timestamp;

    if (event.eventType === AuditEventType.LOGIN_FAILED) {
      this.metrics.failedLogins++;
    }

    if (event.eventType === AuditEventType.SUSPICIOUS_ACTIVITY) {
      this.metrics.suspiciousActivities++;
    }
  }

  /**
   * Converte un AuditEvent in-memory nel formato per il DB
   */
  private mapEventToDbRow(event: AuditEvent): AuditLogCreationAttributes {
    return {
      event_type: event.eventType,
      severity: event.severity,
      user_id: event.userId ?? null,
      user_type: event.userType ?? null,
      session_id: event.sessionId ?? null,
      ip_address: event.ipAddress || '0.0.0.0',
      user_agent: event.userAgent ?? null,
      resource: event.resource ?? null,
      action: event.action ?? null,
      result: event.result || 'SUCCESS',
      details: event.details ?? null,
      request_id: event.requestId ?? null,
      target_entity_id: event.targetEntityId ?? null,
      target_entity_type: event.targetEntityType ?? null,
      createdat: event.timestamp,
    };
  }

  /**
   * Svuota il buffer degli eventi — log su Winston + persistenza su DB
   */
  private flushBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    // Log degli eventi usando il sistema di logging esistente
    events.forEach(event => {
      const logMessage = `AUDIT: ${event.eventType}`;
      const logData = {
        eventType: event.eventType,
        severity: event.severity,
        userId: event.userId,
        userType: event.userType,
        sessionId: event.sessionId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resource: event.resource,
        action: event.action,
        result: event.result,
        details: event.details,
        timestamp: event.timestamp.toISOString(),
        requestId: event.requestId,
        targetEntityId: event.targetEntityId,
        targetEntityType: event.targetEntityType
      };

      switch (event.severity) {
        case AuditSeverity.CRITICAL:
          log.error(logMessage, new Error('Critical audit event'), logData);
          break;
        case AuditSeverity.HIGH:
          log.warn(logMessage, logData);
          break;
        case AuditSeverity.MEDIUM:
          log.info(logMessage, logData);
          break;
        default:
          log.debug(logMessage, logData);
      }
    });

    // Persistenza su DB (fire-and-forget, non blocca)
    if (this.repository) {
      const rows = events.map(e => this.mapEventToDbRow(e));
      this.repository.bulkInsert(rows).catch(err => {
        log.error('AuditLogService: errore persistenza DB', err instanceof Error ? err : new Error(String(err)));
      });
    }
  }

  // ─── Convenience methods esistenti ─────────────────────────────────

  public loginSuccess(req: Request, userId: string, userType: TIPO_UTENTI): void {
    this.logEvent(AuditEventType.LOGIN_SUCCESS, {
      req,
      userId,
      userType,
      action: 'login',
      result: 'SUCCESS'
    });
  }

  public loginFailed(req: Request, email: string, reason: string): void {
    this.logEvent(AuditEventType.LOGIN_FAILED, {
      req,
      action: 'login',
      result: 'FAILURE',
      details: { email, reason }
    });
  }

  public logout(req: Request, userId: string): void {
    this.logEvent(AuditEventType.LOGOUT, {
      req,
      userId,
      action: 'logout',
      result: 'SUCCESS'
    });
  }

  public accessDenied(req: Request, resource: string, reason: string): void {
    this.logEvent(AuditEventType.ACCESS_DENIED, {
      req,
      resource,
      action: 'access',
      result: 'FAILURE',
      details: { reason }
    });
  }

  public suspiciousActivity(req: Request, activityType: string, details: Record<string, any>): void {
    const dnsCall = this.extractDnsFromSuspiciousCall(req, details);
    if (dnsCall) {
      const allowedDns = this.getAllowedDnsForSuspiciousCalls();
      if (allowedDns.has(dnsCall)) {
        log.debug('AuditLogService: suspicious activity skipped for trusted DNS', {
          dns: dnsCall,
          activityType
        });
        return;
      }
    }

    this.logEvent(AuditEventType.SUSPICIOUS_ACTIVITY, {
      req,
      action: activityType,
      result: 'FAILURE',
      details,
      severity: AuditSeverity.CRITICAL
    });
  }

  public userCreated(req: Request, targetUserId: string, targetUserType: TIPO_UTENTI): void {
    this.logEvent(AuditEventType.USER_CREATED, {
      req,
      resource: 'user',
      action: 'create',
      result: 'SUCCESS',
      details: { targetUserId, targetUserType },
      targetEntityId: targetUserId,
      targetEntityType: 'Utente'
    });
  }

  public userUpdated(req: Request, targetUserId: string, changes: Record<string, any>): void {
    this.logEvent(AuditEventType.USER_UPDATED, {
      req,
      resource: 'user',
      action: 'update',
      result: 'SUCCESS',
      details: { targetUserId, changes },
      targetEntityId: targetUserId,
      targetEntityType: 'Utente'
    });
  }

  public userDeleted(req: Request, targetUserId: string): void {
    this.logEvent(AuditEventType.USER_DELETED, {
      req,
      resource: 'user',
      action: 'delete',
      result: 'SUCCESS',
      details: { targetUserId },
      targetEntityId: targetUserId,
      targetEntityType: 'Utente'
    });
  }

  public rateLimitExceeded(req: Request, limitType: string): void {
    this.logEvent(AuditEventType.RATE_LIMIT_EXCEEDED, {
      req,
      action: 'rate_limit_check',
      result: 'FAILURE',
      details: { limitType }
    });
  }

  public csrfTokenInvalid(req: Request, reason: string): void {
    this.logEvent(AuditEventType.CSRF_TOKEN_INVALID, {
      req,
      action: 'csrf_validation',
      result: 'FAILURE',
      details: { reason }
    });
  }

  public dataExport(req: Request, resource: string, recordCount?: number): void {
    this.logEvent(AuditEventType.DATA_EXPORT, {
      req,
      resource,
      action: 'export',
      result: 'SUCCESS',
      details: { recordCount },
      severity: AuditSeverity.MEDIUM
    });
  }

  // ─── Nuovi convenience methods ─────────────────────────────────────

  public sessionExpired(req: Request, userId?: string): void {
    this.logEvent(AuditEventType.SESSION_EXPIRED, {
      req,
      userId,
      action: 'session_check',
      result: 'FAILURE'
    });
  }

  public configurationChanged(req: Request, resource: string, action: string, details?: Record<string, any>): void {
    this.logEvent(AuditEventType.CONFIGURATION_CHANGED, {
      req,
      resource,
      action,
      result: 'SUCCESS',
      details
    });
  }

  public securityViolation(req: Request, violationType: string, details?: Record<string, any>): void {
    this.logEvent(AuditEventType.SECURITY_VIOLATION, {
      req,
      action: violationType,
      result: 'FAILURE',
      details,
      severity: AuditSeverity.CRITICAL
    });
  }

  public bulkOperation(req: Request, resource: string, action: string, details?: Record<string, any>): void {
    this.logEvent(AuditEventType.BULK_OPERATION, {
      req,
      resource,
      action,
      result: 'SUCCESS',
      details
    });
  }

  public sensitiveDataAccess(req: Request, resource: string, details?: Record<string, any>): void {
    this.logEvent(AuditEventType.SENSITIVE_DATA_ACCESS, {
      req,
      resource,
      action: 'access',
      result: 'SUCCESS',
      details
    });
  }

  public systemError(req: Request | undefined, errorType: string, details?: Record<string, any>): void {
    this.logEvent(AuditEventType.SYSTEM_ERROR, {
      req,
      action: errorType,
      result: 'FAILURE',
      details,
      severity: AuditSeverity.HIGH
    });
  }

  private extractHostname(value?: string | null): string | null {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const extractFromText = (input: string): string | null => {
      const urls = input.match(/https?:\/\/[^\s"'<>]+/gi);
      if (!urls || urls.length === 0) return null;

      for (const candidateUrl of urls) {
        try {
          const hostname = new URL(candidateUrl).hostname.toLowerCase();
          if (hostname) return hostname;
        } catch {
          continue;
        }
      }

      return null;
    };

    try {
      if (/^https?:\/\//i.test(trimmed)) {
        return new URL(trimmed).hostname.toLowerCase();
      }

      const normalized = trimmed.startsWith('//') ? `http:${trimmed}` : `http://${trimmed}`;
      const hostname = new URL(normalized).hostname.toLowerCase();
      if (hostname) return hostname;
    } catch {
      // continue con fallback sotto
    }

    const fromText = extractFromText(trimmed);
    if (fromText) return fromText;

    try {
      const decoded = decodeURIComponent(trimmed);
      return extractFromText(decoded);
    } catch {
      return null;
    }
  }

  private getAllowedDnsForSuspiciousCalls(): Set<string> {
    const allowed = new Set<string>();

    const istantaHost = this.extractHostname(config.ISTANTA_IP_ADDRESS);
    if (istantaHost) allowed.add(istantaHost);

    const correggoHost = this.extractHostname(config.CORREGGO_IP_ADDRESS);
    if (correggoHost) allowed.add(correggoHost);

    return allowed;
  }

  private extractDnsFromSuspiciousCall(req: Request, details: Record<string, any>): string | null {
    const candidates: Array<string | undefined> = [
      details?.url,
      details?.dns,
      details?.host,
      JSON.stringify(req.query ?? {}),
      JSON.stringify(req.body ?? {}),
      req.get('Origin') || undefined,
      req.get('Referer') || undefined,
      req.get('Host') || undefined,
      req.hostname
    ];

    for (const candidate of candidates) {
      const hostname = this.extractHostname(candidate);
      if (hostname) return hostname;
    }

    return null;
  }

  private isSensitiveIpDetailKey(key: string): boolean {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.SENSITIVE_IP_DETAIL_KEYS.has(normalized);
  }

  private sanitizeDetailsForFrontend(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeDetailsForFrontend(entry));
    }

    if (value && typeof value === 'object') {
      const input = value as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};

      for (const [key, nestedValue] of Object.entries(input)) {
        if (this.isSensitiveIpDetailKey(key)) continue;
        sanitized[key] = this.sanitizeDetailsForFrontend(nestedValue);
      }

      return sanitized;
    }

    if (typeof value === 'string') {
      return value
        // IPv4
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
        // IPv6 (pattern pragmatico per masking lato UI)
        .replace(/\b(?:[A-Fa-f0-9]{1,4}:){2,}[A-Fa-f0-9:]{1,}\b/g, '[REDACTED_IP]');
    }

    return value;
  }

  private sanitizeAuditItemForFrontend(
    item: AuditLogAttributes & { user_name?: string | null; user_surname?: string | null }
  ) {
    const { ip_address: _ipAddress, details, ...safeItem } = item;
    return {
      ...safeItem,
      details: this.sanitizeDetailsForFrontend(details) as Record<string, any> | null
    };
  }

  // ─── Query da DB ───────────────────────────────────────────────────

  public async getAuditLogsPaginated(filters: AuditLogFilterOptions) {
    if (!this.repository) {
      return { items: [], totalItems: 0, currentPage: 1, totalPages: 0, pageSize: filters.limit || 50 };
    }

    const result = await this.repository.findPaginatedFiltered(filters);
    const userIds = Array.from(
      new Set(
        result.items
          .map(item => item.user_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    if (userIds.length === 0) {
      return {
        ...result,
        items: result.items.map(item => this.sanitizeAuditItemForFrontend({
          ...item,
          user_name: null,
          user_surname: null
        }))
      };
    }

    try {
      const users = await Utente.findAll({
        attributes: ['id_utenti', 'nome_utenti', 'cognome_utenti'],
        where: { id_utenti: { [Op.in]: userIds } },
        raw: true
      }) as unknown as Array<{ id_utenti: string; nome_utenti: string | null; cognome_utenti: string | null }>;

      const userMap = new Map(
        users.map(user => [
          user.id_utenti,
          {
            user_name: user.nome_utenti,
            user_surname: user.cognome_utenti
          }
        ])
      );

      return {
        ...result,
        items: result.items.map(item => {
          const userData = item.user_id ? userMap.get(item.user_id) : undefined;
          return this.sanitizeAuditItemForFrontend({
            ...item,
            user_name: userData?.user_name ?? null,
            user_surname: userData?.user_surname ?? null
          });
        })
      };
    } catch (error) {
      log.warn('AuditLogService: impossibile arricchire nome/cognome utente', error instanceof Error ? error : new Error(String(error)));
      return {
        ...result,
        items: result.items.map(item => this.sanitizeAuditItemForFrontend({
          ...item,
          user_name: null,
          user_surname: null
        }))
      };
    }
  }

  public async getAuditSummary(dateFrom?: string, dateTo?: string): Promise<AuditLogSummaryResult> {
    if (!this.repository) {
      return { totalEvents: 0, totalToday: 0, criticalCount: 0, highCount: 0, byEventType: {}, bySeverity: {} };
    }
    return this.repository.getSummary(dateFrom, dateTo);
  }

  // ─── Metriche e utilità ────────────────────────────────────────────

  /**
   * Ottiene le metriche correnti (in-memory)
   */
  public getMetrics(): AuditMetrics {
    return { ...this.metrics };
  }

  /**
   * Ottiene eventi recenti per un utente specifico (dal buffer)
   */
  public getRecentEventsForUser(userId: string, limit: number = 50): AuditEvent[] {
    return this.eventBuffer
      .filter(event => event.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Ottiene eventi per severità (dal buffer)
   */
  public getEventsBySeverity(severity: AuditSeverity, limit: number = 100): AuditEvent[] {
    return this.eventBuffer
      .filter(event => event.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Forza il flush del buffer (utile per shutdown graceful)
   */
  public forceFlush(): void {
    this.flushBuffer();
  }

  /**
   * Reset delle metriche (utile per testing)
   */
  public resetMetrics(): void {
    this.metrics = {
      totalEvents: 0,
      eventsByType: {} as Record<AuditEventType, number>,
      eventsBySeverity: {} as Record<AuditSeverity, number>,
      failedLogins: 0,
      suspiciousActivities: 0,
      lastAuditTime: null
    };

    Object.values(AuditEventType).forEach(type => {
      this.metrics.eventsByType[type] = 0;
    });

    Object.values(AuditSeverity).forEach(severity => {
      this.metrics.eventsBySeverity[severity] = 0;
    });

    this.eventBuffer = [];
  }
}
