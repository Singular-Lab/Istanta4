import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import "../../global.d.ts";
import { BaseController } from '../base/BaseController';
import { IWhatsAppService } from '../interfaces/IWhatsAppService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { AuditLogService } from '../services/AuditLogService';
import { log } from '../logger';
export class WhatsAppController extends BaseController {
    private whatsAppService: IWhatsAppService;

    constructor(whatsAppService: IWhatsAppService) {
        super('/api/whatsapp');
        this.whatsAppService = whatsAppService;
        this.initializeRoutes();
    }

    public initializeRoutes(): void {
        this.setupRoutes();
    }

    protected setupRoutes(): void {

        // Viewing campaigns
        this.router.get("/get_current_gdo_whatsapp_for_campaign", authMiddleware, permissionGuard('whatsapp.visualizza_campagne'), this.getCurrentGDOWhatsappForCampaign.bind(this));
        this.router.post("/get_all_utenti_guest_whatsapp_count", authMiddleware, permissionGuard('whatsapp.visualizza_campagne'), this.getAllUtentiGuestWhatsappCount.bind(this));

        // Sending
        this.router.post("/inviaBroadcastMessaggi", authMiddleware, permissionGuard('whatsapp.invia_campagna'), this.inviaBroadcastMessaggi.bind(this));

        // Public registration (no auth)
        this.router.post("/registraUtenteWhatsapp", this.registraUtenteWhatsapp.bind(this));

        // Templates
        this.router.get('/get_all_gdo_whatsapp', authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getAllGDOWhatsapp.bind(this));
        this.router.get("/get_whatsapp_gdo_by_id", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getGDOWhatsappById.bind(this));
        this.router.use("/get_all_templates_whatsapp_by_gdo", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getAllTemplatesWhatsappByGdo.bind(this));
        this.router.use("/get_whatsapp_template_by_id", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getWhatsappTemplateById.bind(this));
        this.router.put("/sync_templates_from_meta", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.syncTemplatesFromMeta.bind(this));
        this.router.put("/nuova_versione_locale_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.salvaInLocaleTemplateWhatsappSuperAdminPayload.bind(this));
        this.router.put("/send_modified_template_to_meta", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.sendModifiedTemplateToMeta.bind(this));

        // Presets
        this.router.get("/get_all_presets_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.getAllPresetsTemplateWhatsapp.bind(this));
        this.router.post("/crea_preset_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.creaPresetTemplateWhatsapp.bind(this));
        this.router.put("/modifica_preset_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.modificaPresetTemplateWhatsapp.bind(this));
        this.router.put("/set_default_preset_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.setDefaultPresetTemplateWhatsapp.bind(this));

        // Sending
        this.router.post("/invio_di_test_ad_utente", authMiddleware, permissionGuard('whatsapp.invia_campagna'), this.invioDiTestAdUtente.bind(this));
        this.router.post("/inizia_invio_campagna_whatsapp", authMiddleware, permissionGuard('whatsapp.invia_campagna'), this.iniziaInvioCampagnaWhatsApp.bind(this));

        // Outbox endpoints - viewing
        this.router.get("/campaigns", authMiddleware, permissionGuard('whatsapp.visualizza_campagne'), this.getAllCampaigns.bind(this));
        this.router.get("/campaigns/:bulkId/status", authMiddleware, permissionGuard('whatsapp.visualizza_campagne'), this.getCampaignStatus.bind(this));
        this.router.get("/campaigns/:bulkId/jobs", authMiddleware, permissionGuard('whatsapp.visualizza_campagne'), this.getCampaignJobs.bind(this));

        // Cancel campaign
        this.router.post("/campaigns/:bulkId/cancel", authMiddleware, permissionGuard('whatsapp.annulla_campagna'), this.cancelCampaign.bind(this));

        // Retry (sending)
        this.router.post("/campaigns/:bulkId/retry", authMiddleware, permissionGuard('whatsapp.invia_campagna'), this.retryCampaign.bind(this));
    }

    private async inviaBroadcastMessaggi(req: Request, res: Response): Promise<void> {
        try {
            const { msg } = req.body;
            const result = await this.whatsAppService.inviaBroadcastMessaggi(msg);
            AuditLogService.getInstance().bulkOperation(req, 'whatsapp', 'broadcast');
            res.json(result);
        } catch (error) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                errore: error instanceof Error ? error.message : "Errore nell'invio dei messaggi"
            });
        }
    }

    private async registraUtenteWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { email, nome, cognome, password, tipo, residenza, dataDiNascita, gdoScelta, telefono } = req.body;
            const result = await this.whatsAppService.registraUtenteWhatsapp({
                email,
                nome,
                cognome,
                password,
                tipo,
                residenza,
                dataDiNascita,
                gdoScelta,
                telefono
            });
            res.json(result);
        } catch (error) {
            res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
                errore: error instanceof Error ? error.message : "Errore nella registrazione dell'utente"
            });
        }
    }

    private async getAllUtentiGuestWhatsappCount(req: Request, res: Response): Promise<void> {
        try {
            const id_utente = req.session.id_utente as string;
            // Collect all possible filters from body
            const filtri: Record<string, any> = {};

            if (req.body.sesso) filtri['sesso'] = req.body.sesso;
            if (req.body.dateRange) filtri['dateRange'] = req.body.dateRange;

            // Geographical filters
            if (req.body.callFilter) {
                filtri['callFilter'] = req.body.callFilter;
            }

            // Add more filters as needed

            const gdo = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(id_utente);
            if (!gdo) {
                this.sendResponse(res, HttpStatusCode.OK, []);
                return;
            }
            const result = await this.whatsAppService.getAllUtentiGuestWhatsappCount(gdo.id, filtri);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async invioDiTestAdUtente(req: Request, res: Response): Promise<void> {
        try {
            const { id_utente, id_template } = req.body;
            const result = await this.whatsAppService.invioDiTestAdUtente(id_utente, id_template);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async getCurrentGDOWhatsappForCampaign(req: Request, res: Response): Promise<void> {
        try {
            const id_utente = req.session.id_utente as string;
            const result = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(id_utente);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async getAllGDOWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.whatsAppService.getAllGDOWhatsapp();
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async getGDOWhatsappById(req: Request, res: Response): Promise<void> {
        try {
            const id = req.query.id as string;
            const result = await this.whatsAppService.getGDOWhatsappById(id);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async getAllTemplatesWhatsappByGdo(req: Request, res: Response): Promise<void> {
        try {
            const idGdo = req.query.id as string;
            const result = await this.whatsAppService.getAllTemplatesWhatsappByGdo(idGdo);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            log.error('Errore nel recupero dei template WhatsApp per GDO', error);
            this.handleError(res, error);
        }
    }
    private async getWhatsappTemplateById(req: Request, res: Response): Promise<void> {
        try {
            const id = req.query.id as string;
            const result = await this.whatsAppService.getWhatsappTemplateById(id);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async syncTemplatesFromMeta(req: Request, res: Response): Promise<void> {
        try {
            const { gdoId } = req.body;
            const result = await this.whatsAppService.syncTemplatesFromMeta(gdoId);
            AuditLogService.getInstance().configurationChanged(req, 'whatsapp_template', 'sync');
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async salvaInLocaleTemplateWhatsappSuperAdminPayload(req: Request, res: Response): Promise<void> {
        try {
            const { id_template, json_meta } = req.body;
            const result = await this.whatsAppService.salvaInLocaleTemplateWhatsappSuperAdminPayload(id_template, json_meta);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async sendModifiedTemplateToMeta(req: Request, res: Response): Promise<void> {
        try {
            const { id_template } = req.body;
            const result = await this.whatsAppService.sendModifiedTemplateToMeta(id_template);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async getAllPresetsTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const id_template = req.query.id_template as string;
            const result = await this.whatsAppService.getAllPresetsTemplateWhatsapp(id_template);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async creaPresetTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { id_template, nome_preset, contenuto_preset } = req.body;
            const result = await this.whatsAppService.creaPresetTemplateWhatsapp(id_template, nome_preset, contenuto_preset);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async modificaPresetTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { id_preset, nome_preset, contenuto_preset } = req.body;
            const result = await this.whatsAppService.modificaPresetTemplateWhatsapp(id_preset, nome_preset, contenuto_preset);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async setDefaultPresetTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { id_template, id_preset } = req.body;
            const result = await this.whatsAppService.setDefaultPresetTemplateWhatsapp(id_preset);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async iniziaInvioCampagnaWhatsApp(req: Request, res: Response): Promise<void> {
        try {
            const { callFilter, templateId, userFilters, titoloCampagna } = req.body as {
                callFilter: {
                    type: 'circle' | 'comuni' | 'regioni';
                    center?: [number, number];
                    radiusKm?: number;
                    areaId?: string | null;
                    areaName?: string | null;
                    polygon?: [number, number][][];
                    minCalls?: number;
                    lastDays?: number;
                } | null;
                templateId: string;
                titoloCampagna: string;
                userFilters: {
                    sesso?: string | null;
                    dateRange?: string | null;
                };
            };

            // Validazione titolo campagna
            if (!titoloCampagna || titoloCampagna.trim() === '') {
                this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
                    success: false,
                    error: 'Il titolo della campagna è obbligatorio'
                });
                return;
            }

            const id_utente = req.session.id_utente as string;
            const gdo = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(id_utente);

            if (!gdo) {
                this.sendResponse(res, HttpStatusCode.NOT_FOUND, {
                    success: false,
                    error: 'GDO non trovato per questo utente'
                });
                return;
            }

            const result = await this.whatsAppService.iniziaInvioCampagnaWhatsApp(
                gdo.id,
                templateId,
                titoloCampagna,
                callFilter,
                userFilters
            );

            AuditLogService.getInstance().bulkOperation(req, 'whatsapp', 'campaign_start');
            this.sendResponse(res, HttpStatusCode.OK, {
                success: true,
                bulkId: result.bulkId,
                campagnaId: result.campagnaId,
                totalJobs: result.totalJobs,
                message: `Campagna "${titoloCampagna}" avviata con successo. ${result.totalJobs} messaggi in coda.`
            });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    /**
     * Ottiene tutte le campagne WhatsApp (bulk) per l'utente corrente
     */
    private async getAllCampaigns(req: Request, res: Response): Promise<void> {
        try {
            const id_utente = req.session.id_utente as string;
            const gdo = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(id_utente);

            if (!gdo) {
                this.sendResponse(res, HttpStatusCode.OK, {
                    success: true,
                    data: []
                });
                return;
            }

            // Import WhatsappQueueService
            const { WhatsappQueueService } = await import('../services/WhatsappQueueService');
            const queueService = new WhatsappQueueService();

            // Trova tutti i bulkId unici dalla queue per questo GDO
            // Per ora restituiamo tutti i bulk (in futuro potremmo filtrare per GDO)
            const { GDOWhatsappQueueJob } = await import('../models/whatsapp/gdo_whatsapp_message_queue');
            const { sequelize } = await import('../db');
            const { QueryTypes } = await import('sequelize');

            const bulks = await sequelize.query(
                `SELECT DISTINCT
                    q.bulk_id_whatsapp_queue_job as "bulkId",
                    c.id_whatsapp_campagna as "campagnaId",
                    c.titolo_whatsapp_campagna as "titolo",
                    MIN(q.createdat) as "createdAt"
                 FROM gdo_whatsapp_message_queue q
                 LEFT JOIN gdo_whatsapp_campagne c ON q.campagna_id_whatsapp_queue_job = c.id_whatsapp_campagna
                 GROUP BY q.bulk_id_whatsapp_queue_job, c.id_whatsapp_campagna, c.titolo_whatsapp_campagna
                 ORDER BY MIN(q.createdat) DESC
                 LIMIT 50`,
                { type: QueryTypes.SELECT }
            ) as Array<{ bulkId: string; campagnaId: string; titolo: string; createdAt: Date }>;

            // Per ogni bulk, ottieni lo stato
            const campaigns = await Promise.all(
                bulks.map(async (bulk) => {
                    const status = await queueService.getBulkStatus(bulk.bulkId);
                    return {
                        ...status,
                        campagnaId: bulk.campagnaId,
                        titolo: bulk.titolo,
                        createdAt: bulk.createdAt
                    };
                })
            );

            this.sendResponse(res, HttpStatusCode.OK, {
                success: true,
                data: campaigns
            });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    /**
     * Ottiene lo stato di una campagna specifica
     */
    private async getCampaignStatus(req: Request, res: Response): Promise<void> {
        try {
            const { bulkId } = req.params;

            const { WhatsappQueueService } = await import('../services/WhatsappQueueService');
            const queueService = new WhatsappQueueService();

            const status = await queueService.getBulkStatus(bulkId);

            this.sendResponse(res, HttpStatusCode.OK, {
                success: true,
                data: status
            });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    /**
     * Ottiene i job (messaggi) di una campagna specifica
     */
    private async getCampaignJobs(req: Request, res: Response): Promise<void> {
        try {
            const { bulkId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
            const status = req.query.status as string | undefined;

            const { WhatsappQueueService } = await import('../services/WhatsappQueueService');
            const queueService = new WhatsappQueueService();

            const jobs = await queueService.getBulkJobs(bulkId, {
                limit,
                offset,
                status: status as any
            });

            // Mappa i job al formato richiesto dal frontend
            const mappedJobs = jobs.map(job => ({
                jobId: job.id_whatsapp_queue_job,
                bulkId: job.bulk_id_whatsapp_queue_job,
                index: job.index_whatsapp_queue_job,
                total: job.total_whatsapp_queue_job,
                telefono: job.to_whatsapp_queue_job,
                attempts: job.attempts_whatsapp_queue_job,
                status: job.status_whatsapp_queue_job,
                error: job.last_error_whatsapp_queue_job
            }));

            this.sendResponse(res, HttpStatusCode.OK, {
                success: true,
                data: mappedJobs
            });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    /**
     * Annulla una campagna (mette tutti i job PENDING come FAILED)
     */
    private async cancelCampaign(req: Request, res: Response): Promise<void> {
        try {
            const { bulkId } = req.params;

            const { WhatsappQueueService } = await import('../services/WhatsappQueueService');
            const queueService = new WhatsappQueueService();

            const cancelled = await queueService.cancelBulk(bulkId);
            AuditLogService.getInstance().bulkOperation(req, 'whatsapp', 'campaign_cancel');

            this.sendResponse(res, HttpStatusCode.OK, {
                success: true,
                cancelled,
                message: `${cancelled} messaggi annullati con successo`
            });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    /**
     * Riprova i messaggi falliti di una campagna
     */
    private async retryCampaign(req: Request, res: Response): Promise<void> {
        try {
            const { bulkId } = req.params;

            const { WhatsappQueueService } = await import('../services/WhatsappQueueService');
            const queueService = new WhatsappQueueService();

            const retried = await queueService.retryFailedJobs(bulkId);

            this.sendResponse(res, HttpStatusCode.OK, {
                success: true,
                retried,
                message: `${retried} messaggi rimessi in coda con successo`
            });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
}
