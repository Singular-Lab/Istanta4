import { Request, Response } from 'express';
import { BaseController } from '../base/BaseController';
import { ephemeralTokenAuthMiddleware } from '../middleware/ephemeralTokenAuthMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { BeaconPayloadSchema, PluginAnalyticsFiltersSchema } from '../dto/PluginAnalyticsDTO';
import { PluginAnalyticsGatewayService } from '../services/PluginAnalyticsGatewayService';
import { PluginAnalyticsRepository } from '../repositories/PluginAnalyticsRepository';
import { HttpStatusCode } from '../../../lib/enums';
import { log } from '../logger';

export class PluginAnalyticsController extends BaseController {
  private repository: PluginAnalyticsRepository;

  constructor() {
    super('/api/plugin-analytics');
    this.repository = new PluginAnalyticsRepository();
  }

  protected setupRoutes(): void {
    // Beacon fallback (sendBeacon dal plugin) - auth via ephemeral token
    this.router.post('/beacon', ephemeralTokenAuthMiddleware, this.handleBeacon.bind(this));

    // Admin endpoints - auth via sessione + permesso dedicato
    this.router.get('/stats', authMiddleware, permissionGuard('plugin_analytics.visualizza'), this.getStats.bind(this));
    this.router.get('/events', authMiddleware, permissionGuard('plugin_analytics.visualizza'), this.getEvents.bind(this));
    this.router.get('/monitor', authMiddleware, permissionGuard('plugin_analytics.visualizza'), this.getMonitor.bind(this));
  }

  /**
   * POST /api/plugin-analytics/beacon
   * Fallback per sendBeacon quando il WebSocket non e' disponibile
   */
  private async handleBeacon(req: Request, res: Response): Promise<void> {
    try {
      const parsed = BeaconPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: 'INVALID_PAYLOAD',
          message: parsed.error.message,
        });
        return;
      }

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const gateway = PluginAnalyticsGatewayService.getInstance();
      gateway.handleBeaconPayload(parsed.data.events as any[], ip, userAgent);

      res.status(HttpStatusCode.NO_CONTENT).send();
    } catch (error) {
      log.error('[PluginAnalytics] Beacon error', error);
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/plugin-analytics/stats
   * Statistiche aggregate degli eventi plugin
   */
  private async getStats(req: Request, res: Response): Promise<void> {
    try {
      const slug = req.query.slug as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const stats = await this.repository.getAggregateStats(slug, dateFrom, dateTo);
      this.sendResponse(res, HttpStatusCode.OK, stats);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/plugin-analytics/events
   * Log paginato degli eventi plugin
   */
  private async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const parsed = PluginAnalyticsFiltersSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          error: 'INVALID_FILTERS',
          message: parsed.error.message,
        });
        return;
      }

      const result = await this.repository.findPaginatedWithFilters(parsed.data);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/plugin-analytics/monitor
   * Metriche real-time del gateway (connessioni attive, eventi/sec, coda)
   */
  private async getMonitor(_req: Request, res: Response): Promise<void> {
    try {
      const gateway = PluginAnalyticsGatewayService.getInstance();
      const metrics = gateway.getMetrics();
      this.sendResponse(res, HttpStatusCode.OK, metrics);
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
