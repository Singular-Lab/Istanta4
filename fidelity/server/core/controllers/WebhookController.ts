import { Request, Response } from 'express';
import { BaseController } from '../base/BaseController';
import type { IWebhookService } from '../interfaces/IWebhookService';
import { EVENTI_WEBHOOK, HttpStatusCode, STATO_WEBHOOK } from '../../../lib/enums';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { WebhookAttributes } from '../../../lib/types';
import { AuditLogService } from '../services/AuditLogService';
import { log } from '../logger';

export class WebhookController extends BaseController {
  private webhookService: IWebhookService;

  constructor(webhookService: IWebhookService) {
    super('/api/webhooks');
    this.webhookService = webhookService;
  }

  protected setupRoutes(): void {
    // CRUD Webhook
    this.router.post('/', authMiddleware, permissionGuard('webhook.gestisci'), this.creaWebhook.bind(this));
    this.router.get('/', authMiddleware, permissionGuard('webhook.visualizza'), this.ottieniTuttiWebhook.bind(this));
    this.router.get('/:webhookId', authMiddleware, permissionGuard('webhook.visualizza'), this.ottieniWebhook.bind(this));
    this.router.put('/:webhookId', authMiddleware, permissionGuard('webhook.gestisci'), this.aggiornaWebhook.bind(this));
    this.router.delete('/:webhookId', authMiddleware, permissionGuard('webhook.gestisci'), this.eliminaWebhook.bind(this));

    // Eventi
    this.router.post('/scatena-evento', authMiddleware, permissionGuard('webhook.gestisci'), this.scatenaEvento.bind(this));
    this.router.get('/eventi/disponibili', this.ottieniEventiDisponibili.bind(this));

    // Test e Stats
    this.router.post('/:webhookId/test', authMiddleware, permissionGuard('webhook.gestisci'), this.testaWebhook.bind(this));
    this.router.get('/:webhookId/statistiche', authMiddleware, permissionGuard('webhook.visualizza'), this.ottieniStatisticheWebhook.bind(this));

    // Ricevere webhook
    this.router.post('/ricevi', this.riceviWebhook.bind(this));



  }

  private async creaWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookDataBody = req.body as {
        nome_webhook: string;
        url_webhook: string;
        descrizione_webhook: string;
        eventi_webhook: string[];
        timeout_webhook: number;
        retry_webhook: number;
        stato_webhook: string;
        headers_webhook: string;
      };
      const creatoBy = req.session.id_utente as string;
      const webhookData: Partial<WebhookAttributes> = {
        nome_webhook: webhookDataBody.nome_webhook,
        url_webhook: webhookDataBody.url_webhook,
        descrizione_webhook: webhookDataBody.descrizione_webhook,
        eventi_webhook: webhookDataBody.eventi_webhook as EVENTI_WEBHOOK[],
        timeout_webhook: webhookDataBody.timeout_webhook,
        retry_count_webhook: webhookDataBody.retry_webhook,
        retry_delay_webhook: webhookDataBody.timeout_webhook,
        stato_webhook: webhookDataBody.stato_webhook as STATO_WEBHOOK,
        headers_personalizzati_webhook: JSON.parse(webhookDataBody.headers_webhook || '{}') as Record<string, string>,
        // Il secret_webhook viene generato dal servizio e non deve essere passato dal client
      };
      const webhook = await this.webhookService.creaWebhook(webhookData, creatoBy);
      AuditLogService.getInstance().configurationChanged(req, 'webhook', 'create');
      this.sendResponse(res, HttpStatusCode.CREATED, {
        success: true,
        data: webhook,
        message: 'Webhook creato con successo'
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async ottieniTuttiWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { attivo, creato_by } = req.query;
      
      const filtri: any = {};
      if (attivo !== undefined) filtri.attivo = attivo === 'true';
      if (creato_by) filtri.creatoBy = creato_by as string;

      const webhooks = await this.webhookService.ottieniTuttiWebhook(filtri);
      
      this.sendResponse(res, HttpStatusCode.OK, {
        success: true,
        data: webhooks,
        count: webhooks.length
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async ottieniWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const webhook = await this.webhookService.ottieniWebhook(webhookId);
      
      if (!webhook) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, {
          success: false,
          message: 'Webhook non trovato'
        });
        return;
      }
      
      this.sendResponse(res, HttpStatusCode.OK, {
        success: true,
        data: webhook
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async aggiornaWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const updateData = req.body;
      
      // Il secret non può essere aggiornato, il servizio già gestisce la sua rimozione
      const webhook = await this.webhookService.aggiornaWebhook(webhookId, updateData);
      AuditLogService.getInstance().configurationChanged(req, 'webhook', 'update');

      this.sendResponse(res, HttpStatusCode.OK, {
        success: true,
        data: webhook,
        message: 'Webhook aggiornato con successo'
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async eliminaWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const success = await this.webhookService.eliminaWebhook(webhookId);
      AuditLogService.getInstance().configurationChanged(req, 'webhook', 'delete');

      this.sendResponse(res, HttpStatusCode.OK, {
        success,
        message: success ? 'Webhook eliminato con successo' : 'Webhook non trovato'
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async scatenaEvento(req: Request, res: Response): Promise<void> {
    try {
      const { evento, dati, meta } = req.body;
      
      if (!evento) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
          success: false,
          message: 'Evento obbligatorio'
        });
        return;
      }

      await this.webhookService.scatenaEvento({
        evento,
        dati: dati || {},
        meta: {
          ...meta,
          user_id: req.session.id_utente as string,
          session_id: req.sessionID,
          source: 'manual_trigger'
        }
      });
      
      this.sendResponse(res, HttpStatusCode.OK, {
        success: true,
        message: `Evento '${evento}' inviato con successo`
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async ottieniEventiDisponibili(req: Request, res: Response): Promise<void> {
    try {
      const eventi = Object.entries(EVENTI_WEBHOOK).map(([key, value]) => ({
        evento: value,
        categoria: value.split('_')[0].toLowerCase()
      }));

      this.sendResponse(res, HttpStatusCode.OK, {
        success: true,
        data: eventi
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async testaWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const testData = req.body;
      
      const success = await this.webhookService.testaWebhook(webhookId, testData);
      
      this.sendResponse(res, HttpStatusCode.OK, {
        success,
        message: success ? 'Test webhook inviato con successo' : 'Errore nel test del webhook'
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async ottieniStatisticheWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      const stats = await this.webhookService.ottieniStatisticheWebhook(webhookId);
      
      this.sendResponse(res, HttpStatusCode.OK, {
        success: true,
        data: stats
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async riceviWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      log.debug('Webhook ricevuto', { payload });

      this.sendResponse(res, HttpStatusCode.OK, { 
        received: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }
} 
