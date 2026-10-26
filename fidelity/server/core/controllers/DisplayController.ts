import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { log } from '../logger';
import { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import type { IExternalApiService } from '../interfaces/IExternalApiService';

/**
 * Controller pubblico per i display dei punti vendita.
 * Autenticazione tramite token opaco (no session).
 * URL: /api/display/files?t=<token>
 */
export class DisplayController extends BaseController {
    constructor(
        private puntoVenditaService: IPuntoVenditaService,
        private externalApiService: IExternalApiService
    ) {
        super('/api');
    }

    protected setupRoutes(): void {
        this.initializeRoutes();
    }

    public initializeRoutes(): void {
        // Endpoint pubblici - autenticazione via token
        this.router.get('/display/files', this.displayFiles.bind(this));
        this.router.get('/display/info', this.displayInfo.bind(this));
    }

    /**
     * GET /api/display/files?t=<token>
     * Restituisce i file da mostrare sul display + settings di visualizzazione.
     */
    private async displayFiles(req: Request, res: Response): Promise<void> {
        try {
            const token = req.query.t as string;
            if (!token) {
                this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Token mancante" });
                return;
            }

            const device = await this.puntoVenditaService.getDispositivoByToken(token);
            if (!device || !device.is_active) {
                this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: "Token non valido o dispositivo disattivato" });
                return;
            }

            // Aggiorna heartbeat in modo asincrono (fire-and-forget)
            this.puntoVenditaService.deviceHeartbeat(token).catch(() => { });

            if (!device.displayContext) {
                this.sendResponse(res, HttpStatusCode.NOT_FOUND, {
                    message: "Nessun display context assegnato al dispositivo"
                });
                return;
            }

            // Applica i filtri del displayContext per recuperare i file effettivi
            const result = await this.externalApiService.getFiles({
                filters: device.displayContext.filters,
            });

            this.sendResponse(res, HttpStatusCode.OK, {
                device_id: device.id,
                display_context: {
                    endpoint_type: device.displayContext.endpoint_type,
                    auto_scroll: device.displayContext.auto_scroll,
                    scroll_speed: device.displayContext.scroll_speed,
                    show_indicators: device.displayContext.show_indicators,
                    show_nav_buttons: device.displayContext.show_nav_buttons,
                    render_type: device.displayContext.render_type,
                    meta_options: device.displayContext.meta_options,
                },
                files: result.files,
                conteggio: result.conteggio,
            });
        } catch (error: any) {
            log.error('Display files error: ', { error });
            this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
                message: "Errore durante il recupero dei contenuti display"
            });
        }
    }

    /**
     * GET /api/display/info?t=<token>
     * Restituisce informazioni sul dispositivo e display context (debugging/admin).
     */
    private async displayInfo(req: Request, res: Response): Promise<void> {
        try {
            const token = req.query.t as string;
            if (!token) {
                this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Token mancante" });
                return;
            }

            const device = await this.puntoVenditaService.getDispositivoByToken(token);
            if (!device) {
                this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: "Token non valido" });
                return;
            }

            this.sendResponse(res, HttpStatusCode.OK, {
                device: {
                    id: device.id,
                    nome: device.nome,
                    is_active: device.is_active,
                    is_online: device.is_online,
                    last_seen_at: device.last_seen_at,
                    metadata: device.metadata,
                },
                display_context: device.displayContext ?? null,
                punto_vendita: device.puntoVendita ?? null,
            });
        } catch (error: any) {
            log.error('Display info error: ', { error });
            this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
                message: "Errore durante il recupero delle informazioni display"
            });
        }
    }
}
