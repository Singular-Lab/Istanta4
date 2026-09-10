import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { authMiddleware } from '../middleware/authMiddleware';
import { DisplayContextService } from '../services/DisplayContextService';

export class DisplayContextController extends BaseController {
    constructor(private displayContextService: DisplayContextService) {
        super('/api');
    }

    protected setupRoutes(): void {
        this.initializeRoutes();
    }

    public initializeRoutes(): void {
        this.router.post('/display-contexts', authMiddleware, this.createDisplayContext.bind(this));
        this.router.get('/display-contexts', authMiddleware, this.getAllDisplayContexts.bind(this));
        this.router.get('/display-contexts/:id', authMiddleware, this.getDisplayContextById.bind(this));
        this.router.put('/display-contexts/:id', authMiddleware, this.updateDisplayContext.bind(this));
        this.router.delete('/display-contexts/:id', authMiddleware, this.deleteDisplayContext.bind(this));
        this.router.get('/display-contexts/gdo/:id_gdo', authMiddleware, this.getDisplayContextsByGDO.bind(this));
        this.router.get('/display-contexts/pv/:id_pv', authMiddleware, this.getDisplayContextsByPV.bind(this));
    }

    private async createDisplayContext(req: Request, res: Response): Promise<void> {
        try {
            const data = req.body;
            if (!data.nome || !data.endpoint_type || !data.id_gdo) {
                this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
                    message: "Campi obbligatori mancanti: nome, endpoint_type, id_gdo"
                });
                return;
            }
            const result = await this.displayContextService.createDisplayContext(data);
            this.sendResponse(res, HttpStatusCode.CREATED, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getAllDisplayContexts(req: Request, res: Response): Promise<void> {
        try {
            const filters = {
                id_gdo: req.query.id_gdo as string | undefined,
                id_puntivendita: req.query.id_puntivendita as string | undefined,
                endpoint_type: req.query.endpoint_type as any,
                is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
            };
            const result = await this.displayContextService.getAllDisplayContexts(filters);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getDisplayContextById(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.displayContextService.getDisplayContextById(id);
            if (!result) {
                this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Display context non trovato" });
                return;
            }
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async updateDisplayContext(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.displayContextService.updateDisplayContext(id, req.body);
            if (!result) {
                this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Display context non trovato" });
                return;
            }
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async deleteDisplayContext(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const deleted = await this.displayContextService.deleteDisplayContext(id);
            if (!deleted) {
                this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Display context non trovato" });
                return;
            }
            this.sendResponse(res, HttpStatusCode.OK, { message: "Display context eliminato" });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getDisplayContextsByGDO(req: Request, res: Response): Promise<void> {
        try {
            const id_gdo = req.params.id_gdo;
            const result = await this.displayContextService.getDisplayContextsByGDO(id_gdo);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getDisplayContextsByPV(req: Request, res: Response): Promise<void> {
        try {
            const id_pv = req.params.id_pv;
            const result = await this.displayContextService.getDisplayContextsByPuntoVendita(id_pv);
            this.sendResponse(res, HttpStatusCode.OK, result);
        } catch (error) {
            this.handleError(res, error);
        }
    }
}
