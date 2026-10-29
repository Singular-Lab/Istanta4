import { Op } from 'sequelize';
import { log } from '../logger';
import { PluginAnalyticsEvent } from '../models/plugin_analytics_event';
import { BaseRepository } from './BaseRepository';

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

/** Gli eventi del plugin si scrivono dal WebSocket (PluginAnalyticsGatewayService); qui resta la pulizia periodica. */
export interface IPluginAnalyticsRepository {
  deleteOlderThan(date: Date): Promise<number>;
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
}
