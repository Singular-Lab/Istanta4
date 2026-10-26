import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../db';
import { log } from '../logger';
import { PluginAnalyticsEvent } from '../models/plugin_analytics_event';
import type { PluginAnalyticsAggregateDTO, PluginAnalyticsFiltersDTO } from '../dto/PluginAnalyticsDTO';
import { BaseRepository } from './BaseRepository';
import type { PaginatedResult } from './IBaseRepository';

interface PluginAnalyticsEventAttributes {
  id_plugin_analytics_event: string;
  event_id: string;
  event_type: string;
  timestamp_event: Date;
  slug: string;
  fp_version: string;
  page_origin: string;
  page_path: string;
  session_id: string;
  ip_address: string;
  user_agent: string;
  event_data: Record<string, unknown> | null;
  created_at: Date;
}

export interface IPluginAnalyticsRepository {
  deleteOlderThan(date: Date): Promise<number>;
  getAggregateStats(slug?: string, dateFrom?: Date, dateTo?: Date): Promise<PluginAnalyticsAggregateDTO>;
  findPaginatedWithFilters(filters: PluginAnalyticsFiltersDTO): Promise<PaginatedResult<PluginAnalyticsEvent>>;
}

export class PluginAnalyticsRepository
  extends BaseRepository<PluginAnalyticsEvent, PluginAnalyticsEventAttributes, string>
  implements IPluginAnalyticsRepository
{
  constructor() {
    super(PluginAnalyticsEvent, 'id_plugin_analytics_event');
  }

  async deleteOlderThan(date: Date): Promise<number> {
    try {
      const deleted = await this.model.destroy({
        where: {
          timestamp_event: { [Op.lt]: date },
        },
      });
      return deleted;
    } catch (error) {
      log.error('PluginAnalyticsRepository deleteOlderThan error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findPaginatedWithFilters(filters: PluginAnalyticsFiltersDTO): Promise<PaginatedResult<PluginAnalyticsEvent>> {
    try {
      const where: Record<string, unknown> = {};

      if (filters.slug) where.slug = filters.slug;
      if (filters.eventType) where.event_type = filters.eventType;
      if (filters.sessionId) where.session_id = filters.sessionId;
      if (filters.pageOrigin) where.page_origin = { [Op.iLike]: `%${filters.pageOrigin}%` };

      if (filters.dateFrom || filters.dateTo) {
        const dateFilter: Record<symbol, Date> = {};
        if (filters.dateFrom) dateFilter[Op.gte] = new Date(filters.dateFrom);
        if (filters.dateTo) dateFilter[Op.lte] = new Date(filters.dateTo);
        where.timestamp_event = dateFilter;
      }

      const offset = (filters.page - 1) * filters.pageSize;

      const { rows, count } = await this.model.findAndCountAll({
        where,
        limit: filters.pageSize,
        offset,
        order: [[filters.sortBy, filters.sortOrder]],
      });

      return {
        data: rows,
        total: count,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(count / filters.pageSize),
      };
    } catch (error) {
      log.error('PluginAnalyticsRepository findPaginatedWithFilters error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getAggregateStats(slug?: string, dateFrom?: Date, dateTo?: Date): Promise<PluginAnalyticsAggregateDTO> {
    try {
      const conditions: string[] = [];
      const replacements: Record<string, unknown> = {};

      if (slug) {
        conditions.push('slug = :slug');
        replacements.slug = slug;
      }
      if (dateFrom) {
        conditions.push('timestamp_event >= :dateFrom');
        replacements.dateFrom = dateFrom;
      }
      if (dateTo) {
        conditions.push('timestamp_event <= :dateTo');
        replacements.dateTo = dateTo;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Total events
      const [totalResult] = await sequelize.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM plugin_analytics_events ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      );
      const totalEvents = parseInt(totalResult?.count || '0', 10);

      // Unique sessions
      const [sessionsResult] = await sequelize.query<{ count: string }>(
        `SELECT COUNT(DISTINCT session_id) as count FROM plugin_analytics_events ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      );
      const uniqueSessions = parseInt(sessionsResult?.count || '0', 10);

      // Unique slugs
      const [slugsResult] = await sequelize.query<{ count: string }>(
        `SELECT COUNT(DISTINCT slug) as count FROM plugin_analytics_events ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      );
      const uniqueSlugs = parseInt(slugsResult?.count || '0', 10);

      // Unique origins
      const [originsResult] = await sequelize.query<{ count: string }>(
        `SELECT COUNT(DISTINCT page_origin) as count FROM plugin_analytics_events ${whereClause}`,
        { replacements, type: QueryTypes.SELECT }
      );
      const uniqueOrigins = parseInt(originsResult?.count || '0', 10);

      // Events by type
      const eventsByType = await sequelize.query<{ event_type: string; count: string }>(
        `SELECT event_type, COUNT(*) as count FROM plugin_analytics_events ${whereClause} GROUP BY event_type ORDER BY count DESC`,
        { replacements, type: QueryTypes.SELECT }
      );

      // Events by slug
      const eventsBySlug = await sequelize.query<{ slug: string; count: string }>(
        `SELECT slug, COUNT(*) as count FROM plugin_analytics_events ${whereClause} GROUP BY slug ORDER BY count DESC LIMIT 20`,
        { replacements, type: QueryTypes.SELECT }
      );

      // Events by day (last 30 days)
      const eventsByDay = await sequelize.query<{ date: string; count: string }>(
        `SELECT DATE(timestamp_event) as date, COUNT(*) as count FROM plugin_analytics_events ${whereClause} ${whereClause ? 'AND' : 'WHERE'} timestamp_event >= NOW() - INTERVAL '30 days' GROUP BY DATE(timestamp_event) ORDER BY date DESC`,
        { replacements, type: QueryTypes.SELECT }
      );

      // Top origins
      const topOrigins = await sequelize.query<{ page_origin: string; count: string }>(
        `SELECT page_origin, COUNT(*) as count FROM plugin_analytics_events ${whereClause} GROUP BY page_origin ORDER BY count DESC LIMIT 10`,
        { replacements, type: QueryTypes.SELECT }
      );

      return {
        totalEvents,
        uniqueSessions,
        uniqueSlugs,
        uniqueOrigins,
        eventsByType: eventsByType.map(r => ({ event_type: r.event_type, count: parseInt(r.count, 10) })),
        eventsBySlug: eventsBySlug.map(r => ({ slug: r.slug, count: parseInt(r.count, 10) })),
        eventsByDay: eventsByDay.map(r => ({ date: r.date, count: parseInt(r.count, 10) })),
        topOrigins: topOrigins.map(r => ({ page_origin: r.page_origin, count: parseInt(r.count, 10) })),
      };
    } catch (error) {
      log.error('PluginAnalyticsRepository getAggregateStats error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
