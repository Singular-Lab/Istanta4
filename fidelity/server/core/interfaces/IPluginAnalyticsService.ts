import type { PluginAnalyticsAggregateDTO, PluginAnalyticsFiltersDTO } from '../dto/PluginAnalyticsDTO';
import type { PaginatedResult } from '../repositories/IBaseRepository';
import type { PluginAnalyticsEvent } from '../models/plugin_analytics_event';

export interface IPluginAnalyticsService {
  getAggregateStats(slug?: string, dateFrom?: Date, dateTo?: Date): Promise<PluginAnalyticsAggregateDTO>;
  getEventsPaginated(filters: PluginAnalyticsFiltersDTO): Promise<PaginatedResult<PluginAnalyticsEvent>>;
  cleanupOldEvents(retentionDays: number): Promise<number>;
}
