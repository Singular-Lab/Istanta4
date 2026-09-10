import { Request } from 'express';
import { TIPO_UTENTI } from '../../../lib/enums';
import { AuditLog } from '../models/audit_log';
import { AuditLogFilterOptions, AuditLogSummaryResult } from '../repositories/AuditLogRepository';
import { AuditEventType, AuditSeverity } from '../services/AuditLogService';

export interface IAuditLogService {
    // ── Registrazione eventi ──
    logEvent(
        eventType: AuditEventType,
        options?: {
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
        }
    ): void;

    // ── Convenience methods ──
    loginSuccess(req: Request, userId: string, userType: TIPO_UTENTI): void;
    loginFailed(req: Request, email: string, reason: string): void;
    logout(req: Request, userId: string): void;
    sessionExpired(req: Request, userId?: string): void;
    accessDenied(req: Request, resource: string, reason: string): void;
    suspiciousActivity(req: Request, activityType: string, details: Record<string, any>): void;
    userCreated(req: Request, targetUserId: string, targetUserType: TIPO_UTENTI): void;
    userUpdated(req: Request, targetUserId: string, changes: Record<string, any>): void;
    userDeleted(req: Request, targetUserId: string): void;
    rateLimitExceeded(req: Request, limitType: string): void;
    csrfTokenInvalid(req: Request, reason: string): void;
    configurationChanged(req: Request, resource: string, action: string, details?: Record<string, any>): void;
    securityViolation(req: Request, violationType: string, details?: Record<string, any>): void;
    bulkOperation(req: Request, resource: string, action: string, details?: Record<string, any>): void;
    sensitiveDataAccess(req: Request, resource: string, details?: Record<string, any>): void;
    dataExport(req: Request, resource: string, recordCount?: number): void;
    systemError(req: Request | undefined, errorType: string, details?: Record<string, any>): void;

    // ── Query (da DB) ──
    getAuditLogsPaginated(filters: AuditLogFilterOptions): Promise<{
        items: typeof AuditLog[];
        totalItems: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
    }>;
    getAuditSummary(dateFrom?: string, dateTo?: string): Promise<AuditLogSummaryResult>;

    // ── Metriche in-memory ──
    getMetrics(): any;
    forceFlush(): void;
}
