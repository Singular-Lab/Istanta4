import { Op, WhereOptions, cast, col, fn, where } from 'sequelize';
import { AuditLog, AuditLogAttributes, AuditLogCreationAttributes, AuditLogInstance } from '../models/audit_log';
import { BaseRepository } from './BaseRepository';
import { log } from '../logger';

export interface AuditLogFilterOptions {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    eventType?: string;
    severity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    result?: string;
    searchTerm?: string;
    resource?: string;
    isExport?: boolean;
}

export interface AuditLogSummaryResult {
    totalEvents: number;
    totalToday: number;
    criticalCount: number;
    highCount: number;
    byEventType: Record<string, number>;
    bySeverity: Record<string, number>;
}

export interface IAuditLogRepository {
    findPaginatedFiltered(filters: AuditLogFilterOptions): Promise<{
        items: AuditLogAttributes[];
        totalItems: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
    }>;
    getSummary(dateFrom?: string, dateTo?: string): Promise<AuditLogSummaryResult>;
    deleteOlderThan(date: Date): Promise<number>;
    bulkInsert(events: AuditLogCreationAttributes[]): Promise<void>;
}

export class AuditLogRepository
    extends BaseRepository<AuditLogInstance, AuditLogAttributes, string>
    implements IAuditLogRepository {

    constructor() {
        super(AuditLog, 'id_audit_log');
    }

    async findPaginatedFiltered(filters: AuditLogFilterOptions) {
        const {
            page = 1,
            limit = 50,
            sortBy = 'createdat',
            sortOrder = 'DESC',
            eventType,
            severity,
            userId,
            dateFrom,
            dateTo,
            result,
            searchTerm,
            resource,
        } = filters;

        const where: WhereOptions<AuditLogAttributes> = {};
        const sortableColumns: Record<string, string> = {
            createdat: 'createdat',
            event_type: 'event_type',
            severity: 'severity',
            result: 'result',
            resource: 'resource',
            action: 'action',
            user_id: 'user_id',
            target_entity_type: 'target_entity_type',
            target_entity_id: 'target_entity_id',
        };
        const safeSortBy = sortableColumns[sortBy] || 'createdat';
        const safeSortOrder: 'ASC' | 'DESC' = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        if (eventType) (where as any).event_type = eventType;
        if (severity) (where as any).severity = severity;
        if (userId) (where as any).user_id = userId;
        if (result) (where as any).result = result;
        if (resource) (where as any).resource = resource;

        if (dateFrom || dateTo) {
            (where as any).createdat = {};
            if (dateFrom) (where as any).createdat[Op.gte] = new Date(dateFrom);
            if (dateTo) (where as any).createdat[Op.lte] = new Date(dateTo);
        }

        if (searchTerm) {
            const likeSearch = `%${searchTerm}%`;
            (where as any)[Op.or] = [
                { resource: { [Op.iLike]: likeSearch } },
                { action: { [Op.iLike]: likeSearch } },
                { target_entity_type: { [Op.iLike]: likeSearch } },
                { ip_address: { [Op.iLike]: likeSearch } },
                { details: { [Op.iLike]: likeSearch } },
            ];
        }

        const offset = (page - 1) * limit;
        const maxLimit = filters.isExport ? 10000 : 200;
        const safeLimit = Math.min(Math.max(limit, 1), maxLimit);

        try {
            const { rows, count } = await this.model.findAndCountAll({
                where,
                limit: safeLimit,
                offset,
                order: [[safeSortBy, safeSortOrder]],
                raw: true,
            });

            return {
                items: rows,
                totalItems: count,
                currentPage: page,
                totalPages: Math.ceil(count / safeLimit),
                pageSize: safeLimit,
            };
        } catch (error) {
            log.error('AuditLogRepository.findPaginatedFiltered error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    async getSummary(dateFrom?: string, dateTo?: string): Promise<AuditLogSummaryResult> {
        try {
            const where: WhereOptions<AuditLogAttributes> = {};
            if (dateFrom || dateTo) {
                (where as any).createdat = {};
                if (dateFrom) (where as any).createdat[Op.gte] = new Date(dateFrom);
                if (dateTo) (where as any).createdat[Op.lte] = new Date(dateTo);
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const [totalEvents, totalToday, criticalCount, highCount, byEventTypeRows, bySeverityRows] = await Promise.all([
                this.model.count({ where }),
                this.model.count({ where: { ...where, createdat: { [Op.gte]: todayStart } } as any }),
                this.model.count({ where: { ...where, severity: 'CRITICAL' } as any }),
                this.model.count({ where: { ...where, severity: 'HIGH' } as any }),
                this.model.findAll({
                    attributes: ['event_type', [fn('COUNT', col('id_audit_log')), 'count']],
                    where,
                    group: ['event_type'],
                    raw: true,
                }) as unknown as Array<{ event_type: string; count: string }>,
                this.model.findAll({
                    attributes: ['severity', [fn('COUNT', col('id_audit_log')), 'count']],
                    where,
                    group: ['severity'],
                    raw: true,
                }) as unknown as Array<{ severity: string; count: string }>,
            ]);

            const byEventType: Record<string, number> = {};
            for (const row of byEventTypeRows) {
                byEventType[row.event_type] = parseInt(row.count, 10);
            }

            const bySeverity: Record<string, number> = {};
            for (const row of bySeverityRows) {
                bySeverity[row.severity] = parseInt(row.count, 10);
            }

            return { totalEvents, totalToday, criticalCount, highCount, byEventType, bySeverity };
        } catch (error) {
            log.error('AuditLogRepository.getSummary error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    async deleteOlderThan(date: Date): Promise<number> {
        try {
            const deleted = await this.model.destroy({
                where: { createdat: { [Op.lt]: date } } as any,
            });
            return deleted;
        } catch (error) {
            log.error('AuditLogRepository.deleteOlderThan error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    async bulkInsert(events: AuditLogCreationAttributes[]): Promise<void> {
        if (events.length === 0) return;
        try {
            await this.model.bulkCreate(events as any[]);
        } catch (error) {
            log.error('AuditLogRepository.bulkInsert error', error instanceof Error ? error : new Error(String(error)), {
                count: events.length,
            });
            // Non-blocking: non rilancia l'errore per non bloccare il flush
        }
    }
}
