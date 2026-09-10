import { Request, Response } from 'express';
import { AUDIT_EVENT_LABELS, AUDIT_SEVERITY_LABELS, AuditEventType, AuditSeverity } from '../../../lib/auditTypes';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { AuditLogFilterSchema } from '../dto/AuditLogDTO';
import { authMiddleware } from '../middleware/authMiddleware';
import { userRoleGuard } from '../middleware/userRoleGuard';
import { AuditLogService } from '../services/AuditLogService';

export class AuditLogController extends BaseController {
    constructor() {
        super('/api/audit-log');
    }

    protected setupRoutes(): void {
        const guard = [authMiddleware, userRoleGuard([TIPO_UTENTI.SUPERADMIN])];

        this.router.get('/', ...guard, this.getAuditLogs.bind(this));
        this.router.get('/summary', ...guard, this.getSummary.bind(this));
        this.router.get('/export/csv', ...guard, this.exportCsv.bind(this));
        this.router.get('/event-types', ...guard, this.getEventTypes.bind(this));
        this.router.get('/categories', ...guard, this.getSeverities.bind(this));
    }

    /**
     * GET / — Lista paginata e filtrata
     */
    private async getAuditLogs(req: Request, res: Response): Promise<void> {
        try {
            const parsed = AuditLogFilterSchema.safeParse(req.query);
            if (!parsed.success) {
                this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
                    error: 'Parametri non validi',
                    details: parsed.error.flatten().fieldErrors,
                });
                return;
            }

            const auditService = AuditLogService.getInstance();

            // Log accesso sensibile
            //auditService.sensitiveDataAccess(req, 'audit_log', { action: 'view', filters: parsed.data });

            const filters = { ...parsed.data, page: parsed.data.page ?? 1, limit: parsed.data.limit ?? 50 };
            const result = await auditService.getAuditLogsPaginated(filters);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /summary — Statistiche aggregate per le cards
     */
    private async getSummary(req: Request, res: Response): Promise<void> {
        try {
            const { dateFrom, dateTo } = req.query;
            const auditService = AuditLogService.getInstance();
            const summary = await auditService.getAuditSummary(
                dateFrom as string | undefined,
                dateTo as string | undefined
            );
            this.sendResponse(res, HttpStatusCode.OK, summary);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /export/csv — Export CSV filtrato
     */
    private async exportCsv(req: Request, res: Response): Promise<void> {
        try {
            const parsed = AuditLogFilterSchema.safeParse(req.query);
            if (!parsed.success) {
                this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: 'Parametri non validi' });
                return;
            }

            const auditService = AuditLogService.getInstance();

            // Recupera fino a 10000 record per l'export (isExport bypassa il cap da 200)
            const filters = { ...parsed.data, limit: 10000, page: 1, isExport: true };
            const result = await auditService.getAuditLogsPaginated(filters);

            // Log export
            auditService.dataExport(req, 'audit_log', result.totalItems);

            // Escape RFC 4180: racchiude tra virgolette se il valore contiene il delimitatore, virgolette o newline
            const csvField = (value: string | null | undefined): string => {
                const s = value ?? '';
                if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
                    return `"${s.replace(/"/g, '""')}"`;
                }
                return s;
            };

            const RESULT_LABELS: Record<string, string> = {
                SUCCESS: 'Successo',
                FAILURE: 'Fallimento',
                PARTIAL: 'Parziale',
            };

            const USER_TYPE_LABELS: Record<string, string> = {
                Superadmin: 'Superamministratore',
                Agenzia: 'Agenzia',
                GDO: 'GDO',
                AdminGDO: 'Amministratore GDO',
                PuntoVendita: 'Punto Vendita',
                Guest: 'Ospite',
            };

            // Formatta i dettagli JSON in coppie "chiave: valore" leggibili
            const formatDetails = (details: unknown): string => {
                if (!details) return '';
                try {
                    const obj = typeof details === 'string' ? JSON.parse(details) : details;
                    return Object.entries(obj as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                        .join(' | ');
                } catch {
                    return String(details);
                }
            };

            const headers = [
                'Data/Ora', 'Tipo Evento', 'Severità',
                'Nome Utente', 'ID Utente', 'Ruolo Utente',
                'Risorsa', 'Azione', 'Risultato',
                'ID Entità Target', 'Tipo Entità Target', 'Dettagli',
            ];
            const csvRows = [headers.join(';')];

            for (const row of result.items) {
                const r = row as any;
                const eventLabel = AUDIT_EVENT_LABELS[r.event_type as AuditEventType] || r.event_type;
                const severityLabel = AUDIT_SEVERITY_LABELS[r.severity as AuditSeverity] || r.severity;
                const resultLabel = RESULT_LABELS[r.result] || r.result || '';
                const userTypeLabel = USER_TYPE_LABELS[r.user_type] || r.user_type || '';
                const userName = [r.user_name, r.user_surname].filter(Boolean).join(' ') || '';

                csvRows.push([
                    csvField(new Date(r.createdat).toLocaleString('it-IT')),
                    csvField(eventLabel),
                    csvField(severityLabel),
                    csvField(userName),
                    csvField(r.user_id),
                    csvField(userTypeLabel),
                    csvField(r.resource),
                    csvField(r.action),
                    csvField(resultLabel),
                    csvField(r.target_entity_id),
                    csvField(r.target_entity_type),
                    csvField(formatDetails(r.details)),
                ].join(';'));
            }

            const csv = '\uFEFF' + csvRows.join('\n'); // BOM per Excel
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`);
            res.status(HttpStatusCode.OK).send(csv);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    /**
     * GET /event-types — Lista tipi evento con etichette italiane
     */
    private getEventTypes(_req: Request, res: Response): void {
        const eventTypes = Object.values(AuditEventType).map(type => ({
            value: type,
            label: AUDIT_EVENT_LABELS[type] || type,
        }));
        this.sendResponse(res, HttpStatusCode.OK, eventTypes);
    }

    /**
     * GET /categories — Lista severità con etichette italiane
     */
    private getSeverities(_req: Request, res: Response): void {
        const severities = Object.values(AuditSeverity).map(sev => ({
            value: sev,
            label: AUDIT_SEVERITY_LABELS[sev] || sev,
        }));
        this.sendResponse(res, HttpStatusCode.OK, severities);
    }
}
