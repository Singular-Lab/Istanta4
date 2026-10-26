/**
 * Audit Types — Etichette e mapping condivisi tra server e frontend
 *
 * L'enum AuditEventType e AuditSeverity sono definiti in
 * server/core/services/AuditLogService.ts e ri-esportati qui
 * per uso nel frontend senza dipendenze server.
 */

// ── Enum duplicati per il frontend (devono corrispondere a AuditLogService) ──

export enum AuditEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_ESCALATION = 'PERMISSION_ESCALATION',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',
  DATA_EXPORT = 'DATA_EXPORT',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  BULK_OPERATION = 'BULK_OPERATION',
}

export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ── Etichette italiane per i tipi di evento ──

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  [AuditEventType.LOGIN_SUCCESS]: 'Login riuscito',
  [AuditEventType.LOGIN_FAILED]: 'Login fallito',
  [AuditEventType.LOGOUT]: 'Logout',
  [AuditEventType.SESSION_EXPIRED]: 'Sessione scaduta',
  [AuditEventType.ACCESS_GRANTED]: 'Accesso concesso',
  [AuditEventType.ACCESS_DENIED]: 'Accesso negato',
  [AuditEventType.PERMISSION_ESCALATION]: 'Escalation privilegi',
  [AuditEventType.USER_CREATED]: 'Utente creato',
  [AuditEventType.USER_UPDATED]: 'Utente aggiornato',
  [AuditEventType.USER_DELETED]: 'Utente eliminato',
  [AuditEventType.USER_ROLE_CHANGED]: 'Ruolo utente modificato',
  [AuditEventType.SUSPICIOUS_ACTIVITY]: 'Attività sospetta',
  [AuditEventType.RATE_LIMIT_EXCEEDED]: 'Limite richieste superato',
  [AuditEventType.CSRF_TOKEN_INVALID]: 'Token CSRF non valido',
  [AuditEventType.SECURITY_VIOLATION]: 'Violazione di sicurezza',
  [AuditEventType.SYSTEM_ERROR]: 'Errore di sistema',
  [AuditEventType.CONFIGURATION_CHANGED]: 'Configurazione modificata',
  [AuditEventType.DATA_EXPORT]: 'Esportazione dati',
  [AuditEventType.SENSITIVE_DATA_ACCESS]: 'Accesso a dati sensibili',
  [AuditEventType.BULK_OPERATION]: 'Operazione massiva',
};

// ── Etichette italiane per la severità ──

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  [AuditSeverity.CRITICAL]: 'Critico',
  [AuditSeverity.HIGH]: 'Alto',
  [AuditSeverity.MEDIUM]: 'Medio',
  [AuditSeverity.LOW]: 'Basso',
};

// ── Interfaccia per il record audit lato frontend ──

export interface AuditLogRecord {
  id_audit_log: string;
  event_type: AuditEventType;
  severity: AuditSeverity;
  user_id: string | null;
  user_name?: string | null;
  user_surname?: string | null;
  user_type: string | null;
  user_agent: string | null;
  resource: string | null;
  action: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  details: Record<string, any> | null;
  target_entity_id: string | null;
  target_entity_type: string | null;
  createdat: string;
}

export interface AuditLogSummary {
  totalEvents: number;
  totalToday: number;
  criticalCount: number;
  highCount: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface AuditLogPaginatedResponse {
  items: AuditLogRecord[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}
