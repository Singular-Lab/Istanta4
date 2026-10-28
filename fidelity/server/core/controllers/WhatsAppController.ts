import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { validate as isUuid } from 'uuid';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import { ForbiddenError, NotFoundError } from '../../../lib/errors';
import "../../global.d.ts";
import { BaseController } from '../base/BaseController';
import { sequelize } from '../db/SequelizeConnector';
import { IWhatsAppService } from '../interfaces/IWhatsAppService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { UtentiGDO } from '../models';
import { GDOWhatsappPreset } from '../models/whatsapp/gdo_whatsapp_preset';
import { GDOWhatsappTemplate } from '../models/whatsapp/gdo_whatsapp_template';
import { AuditLogService } from '../services/AuditLogService';
import { WhatsappQueueService } from '../services/WhatsappQueueService';
import { log } from '../logger';
export class WhatsAppController extends BaseController {
    private whatsAppService: IWhatsAppService;
    private readonly queueService = new WhatsappQueueService();

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

        // Templates
        this.router.get('/get_all_gdo_whatsapp', authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getAllGDOWhatsapp.bind(this));
        this.router.get("/get_whatsapp_gdo_by_id", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getGDOWhatsappById.bind(this));
        this.router.put("/setup_gdo_whatsapp", authMiddleware, permissionGuard('sistema.gestisci_whatsapp'), this.salvaSetupGDOWhatsapp.bind(this));
        this.router.get("/get_all_templates_whatsapp_by_gdo", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getAllTemplatesWhatsappByGdo.bind(this));
        this.router.get("/get_whatsapp_template_by_id", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.getWhatsappTemplateById.bind(this));
        this.router.put("/sync_templates_from_meta", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.syncTemplatesFromMeta.bind(this));
        this.router.post("/crea_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.creaTemplateWhatsapp.bind(this));
        this.router.put("/nuova_versione_locale_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.salvaInLocaleTemplateWhatsappSuperAdminPayload.bind(this));
        this.router.put("/send_modified_template_to_meta", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.sendModifiedTemplateToMeta.bind(this));
        this.router.delete("/template/:id", authMiddleware, permissionGuard('whatsapp.gestisci_templates'), this.eliminaTemplateWhatsapp.bind(this));

        // Presets
        this.router.get("/get_all_presets_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.getAllPresetsTemplateWhatsapp.bind(this));
        this.router.post("/crea_preset_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.creaPresetTemplateWhatsapp.bind(this));
        this.router.put("/modifica_preset_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.modificaPresetTemplateWhatsapp.bind(this));
        this.router.put("/set_default_preset_template_whatsapp", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.setDefaultPresetTemplateWhatsapp.bind(this));
        this.router.delete("/preset/:id", authMiddleware, permissionGuard('whatsapp.gestisci_presets'), this.eliminaPresetTemplateWhatsapp.bind(this));

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
            const { id_utente, id_template } = req.body ?? {};
            const template = await this.templateAmmesso(req, id_template);
            // Anche per il Superadmin il destinatario deve essere della GDO del modello: il messaggio parte dal suo numero
            await this.verificaDestinatarioDellaGdo(id_utente, template.id_gdo_gdowhatsapptemplate);
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
            const ammessa = await this.gdoAmmessa(req);
            // Senza GDO non c'e' nulla da mostrare: evita di leggere tutte le GDO
            const tutte = ammessa === '' ? [] : await this.whatsAppService.getAllGDOWhatsapp();
            // Fuori dal Superadmin si vede solo la propria GDO, come per le campagne
            const result = ammessa === null ? tutte : tutte.filter(gdo => gdo.id === ammessa);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async getGDOWhatsappById(req: Request, res: Response): Promise<void> {
        try {
            const id = req.query.id as string;
            await this.verificaGdoAmmessa(req, id);
            const result = await this.whatsAppService.getGDOWhatsappById(id);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    // Il canale di una GDO (numero, WABA, token) lo configura solo il Superadmin
    private async salvaSetupGDOWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            if (req.session.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
                throw new ForbiddenError({
                    message: 'Solo il Superadmin configura il canale WhatsApp di una GDO',
                    resource: 'whatsapp_numero',
                    action: 'setup'
                });
            }
            const { id_gdo, display_name, id_numero_whatsapp, whatsapp_business_account_id, stato, access_token, verify_token } = req.body ?? {};
            const result = await this.whatsAppService.salvaSetupGDOWhatsapp({
                id_gdo,
                display_name,
                id_numero_whatsapp,
                whatsapp_business_account_id,
                stato,
                access_token,
                verify_token
            });
            // Nel registro i nomi dei campi cambiati, mai i valori dei token
            AuditLogService.getInstance().configurationChanged(req, 'whatsapp_numero', result.creato ? 'create' : 'update', {
                id_gdo,
                campi: result.campiModificati
            });
            this.sendResponse(res, HttpStatusCode.OK, { success: true, creato: result.creato });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async getAllTemplatesWhatsappByGdo(req: Request, res: Response): Promise<void> {
        try {
            const idGdo = req.query.id as string;
            await this.verificaGdoAmmessa(req, idGdo);
            const result = await this.whatsAppService.getAllTemplatesWhatsappByGdo(idGdo);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            log.error('Errore nel recupero dei template WhatsApp per GDO', error);
            this.handleError(res, error);
        }
    }
    private async getWhatsappTemplateById(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.templateAmmesso(req, req.query.id as string);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async syncTemplatesFromMeta(req: Request, res: Response): Promise<void> {
        try {
            const { gdoId } = req.body;
            await this.verificaGdoAmmessa(req, gdoId);
            const result = await this.whatsAppService.syncTemplatesFromMeta(gdoId);
            AuditLogService.getInstance().configurationChanged(req, 'whatsapp_template', 'sync');
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    // Nuovo modello come bozza locale: l'invio a Meta passa da send_modified_template_to_meta
    private async creaTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { id_gdo, json_meta } = req.body ?? {};
            await this.verificaGdoAmmessa(req, id_gdo);
            const result = await this.whatsAppService.creaTemplateLocale(id_gdo, json_meta);
            AuditLogService.getInstance().configurationChanged(req, 'whatsapp_template', 'create', {
                id_gdo,
                id_template: result.newTemplateId
            });
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async salvaInLocaleTemplateWhatsappSuperAdminPayload(req: Request, res: Response): Promise<void> {
        try {
            const { id_template, json_meta } = req.body;
            await this.templateAmmesso(req, id_template);
            const result = await this.whatsAppService.salvaInLocaleTemplateWhatsappSuperAdminPayload(id_template, json_meta);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async sendModifiedTemplateToMeta(req: Request, res: Response): Promise<void> {
        try {
            const { id_template } = req.body;
            await this.templateAmmesso(req, id_template);
            const result = await this.whatsAppService.sendModifiedTemplateToMeta(id_template);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async getAllPresetsTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const id_template = req.query.id_template as string;
            await this.templateAmmesso(req, id_template);
            const result = await this.whatsAppService.getAllPresetsTemplateWhatsapp(id_template);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async creaPresetTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { id_template, nome_preset, contenuto_preset } = req.body ?? {};
            await this.templateAmmesso(req, id_template);
            const result = await this.whatsAppService.creaPresetTemplateWhatsapp(id_template, nome_preset, contenuto_preset);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    private async modificaPresetTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            const { id_preset, nome_preset, contenuto_preset } = req.body ?? {};
            await this.presetAmmesso(req, id_preset);
            const result = await this.whatsAppService.modificaPresetTemplateWhatsapp(id_preset, nome_preset, contenuto_preset);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error: any) {
            this.handleError(res, error);
        }
    }
    // null = Superadmin, che gestisce il WhatsApp di tutte le GDO; '' non corrisponde a nessuna GDO
    private async gdoAmmessa(req: Request): Promise<string | null> {
        if (req.session.tipo_utente === TIPO_UTENTI.SUPERADMIN) return null;
        const gdo = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(req.session.id_utente as string);
        return gdo?.id ?? '';
    }

    // Una GDO diversa da quella dell'utente risulta inesistente, come le campagne
    private async verificaGdoAmmessa(req: Request, idGdo: unknown): Promise<void> {
        const ammessa = await this.gdoAmmessa(req);
        if (ammessa !== null && (typeof idGdo !== 'string' || idGdo !== ammessa)) {
            throw new NotFoundError({ message: 'GDO non trovata', entityType: 'GDO', entityId: typeof idGdo === 'string' ? idGdo : undefined });
        }
    }

    private async templateAmmesso(req: Request, idTemplate: unknown) {
        const template = typeof idTemplate === 'string' && idTemplate
            ? await this.whatsAppService.getWhatsappTemplateById(idTemplate)
            : null;
        const ammessa = await this.gdoAmmessa(req);
        if (!template || (ammessa !== null && template.id_gdo_gdowhatsapptemplate !== ammessa)) {
            throw new NotFoundError({
                message: 'Template non trovato',
                entityType: 'GDOWhatsappTemplate',
                entityId: typeof idTemplate === 'string' ? idTemplate : undefined
            });
        }
        return template;
    }

    // Il preset appartiene alla GDO del suo modello: quello di un'altra GDO risulta inesistente
    private async presetAmmesso(req: Request, idPreset: unknown) {
        const preset = typeof idPreset === 'string' && isUuid(idPreset)
            ? await GDOWhatsappPreset.findByPk(idPreset)
            : null;
        const template = preset
            ? await GDOWhatsappTemplate.findByPk(preset.id_template_gdowhatsappreset, { attributes: ['id_gdo_gdowhatsapptemplate'] })
            : null;
        const ammessa = await this.gdoAmmessa(req);
        if (!preset || !template || (ammessa !== null && template.id_gdo_gdowhatsapptemplate !== ammessa)) {
            throw new NotFoundError({
                message: 'Preset non trovato',
                entityType: 'GDOWhatsappPreset',
                entityId: typeof idPreset === 'string' ? idPreset : undefined
            });
        }
        return preset;
    }

    // Un destinatario non associato alla GDO risulta inesistente: nessun messaggio parte verso Meta
    private async verificaDestinatarioDellaGdo(idUtente: unknown, idGdo: string): Promise<void> {
        const associazione = typeof idUtente === 'string' && isUuid(idUtente)
            ? await UtentiGDO.findOne({
                where: { id_utente_utentegdo: idUtente, id_gdo_utentegdo: idGdo },
                attributes: ['id_utentegdo']
            })
            : null;
        if (!associazione) {
            throw new NotFoundError({
                message: 'Utente non trovato',
                entityType: 'Utente',
                entityId: typeof idUtente === 'string' ? idUtente : undefined
            });
        }
    }

    private async eliminaPresetTemplateWhatsapp(req: Request<{ id: string }>, res: Response): Promise<void> {
        try {
            await this.whatsAppService.eliminaPresetTemplateWhatsapp(req.params.id, await this.gdoAmmessa(req));
            AuditLogService.getInstance().configurationChanged(req, 'whatsapp_preset', 'delete', { id_preset: req.params.id });
            this.sendResponse(res, HttpStatusCode.OK, { success: true });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async eliminaTemplateWhatsapp(req: Request<{ id: string }>, res: Response): Promise<void> {
        try {
            await this.whatsAppService.eliminaTemplateWhatsapp(req.params.id, await this.gdoAmmessa(req));
            AuditLogService.getInstance().configurationChanged(req, 'whatsapp_template', 'delete', { id_template: req.params.id });
            this.sendResponse(res, HttpStatusCode.OK, { success: true });
        } catch (error: any) {
            this.handleError(res, error);
        }
    }

    private async setDefaultPresetTemplateWhatsapp(req: Request, res: Response): Promise<void> {
        try {
            // Il modello si ricava dal preset: l'id_template del corpo non decide nulla
            const { id_preset } = req.body ?? {};
            await this.presetAmmesso(req, id_preset);
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
                    // message e' il campo che il client mostra all'operatore
                    message: 'Il titolo della campagna è obbligatorio',
                    error: 'Il titolo della campagna è obbligatorio'
                });
                return;
            }

            const id_utente = req.session.id_utente as string;
            const gdo = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(id_utente);

            if (!gdo) {
                this.sendResponse(res, HttpStatusCode.NOT_FOUND, {
                    success: false,
                    message: 'GDO non trovato per questo utente',
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

            // Solo i bulk della GDO dell'utente: la GDO di una campagna e' quella del suo template
            const bulks = await sequelize.query(
                `SELECT DISTINCT
                    q.bulk_id_whatsapp_queue_job as "bulkId",
                    c.id_whatsapp_campagna as "campagnaId",
                    c.titolo_whatsapp_campagna as "titolo",
                    MIN(q.createdat) as "createdAt"
                 FROM gdo_whatsapp_message_queue q
                 JOIN gdo_whatsapp_campagne c ON q.campagna_id_whatsapp_queue_job = c.id_whatsapp_campagna
                 JOIN gdo_whatsapp_template t ON c.template_id_whatsapp_campagna = t.id_gdowhatsapptemplate
                 WHERE t.id_gdo_gdowhatsapptemplate = :idGdo
                 GROUP BY q.bulk_id_whatsapp_queue_job, c.id_whatsapp_campagna, c.titolo_whatsapp_campagna
                 ORDER BY MIN(q.createdat) DESC
                 LIMIT 50`,
                { type: QueryTypes.SELECT, replacements: { idGdo: gdo.id } }
            ) as Array<{ bulkId: string; campagnaId: string; titolo: string; createdAt: Date }>;

            // Per ogni bulk, ottieni lo stato
            const campaigns = await Promise.all(
                bulks.map(async (bulk) => {
                    const status = await this.queueService.getBulkStatus(bulk.bulkId);
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
     * Le campagne di altre GDO risultano inesistenti (404): i job contengono i telefoni dei clienti
     */
    private async verificaBulkDellaGdo(req: Request<{ bulkId: string }>): Promise<string> {
        const { bulkId } = req.params;
        const gdo = await this.whatsAppService.getCurrentGDOWhatsappForCampaign(req.session.id_utente as string);
        await this.queueService.verificaBulkDellaGdo(bulkId, gdo?.id);
        return bulkId;
    }

    /**
     * Ottiene lo stato di una campagna specifica
     */
    private async getCampaignStatus(req: Request<{ bulkId: string }>, res: Response): Promise<void> {
        try {
            const bulkId = await this.verificaBulkDellaGdo(req);

            const status = await this.queueService.getBulkStatus(bulkId);

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
    private async getCampaignJobs(req: Request<{ bulkId: string }>, res: Response): Promise<void> {
        try {
            const bulkId = await this.verificaBulkDellaGdo(req);
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
            const status = req.query.status as string | undefined;

            const jobs = await this.queueService.getBulkJobs(bulkId, {
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
     * Annulla una campagna (mette tutti i job PENDING come CANCELLED)
     */
    private async cancelCampaign(req: Request<{ bulkId: string }>, res: Response): Promise<void> {
        try {
            const bulkId = await this.verificaBulkDellaGdo(req);

            const cancelled = await this.queueService.cancelBulk(bulkId);
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
    private async retryCampaign(req: Request<{ bulkId: string }>, res: Response): Promise<void> {
        try {
            const bulkId = await this.verificaBulkDellaGdo(req);

            const retried = await this.queueService.retryFailedJobs(bulkId);

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
