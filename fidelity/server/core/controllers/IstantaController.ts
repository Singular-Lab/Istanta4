import { Request, Response } from "express";
import { HttpStatusCode } from "../../../lib/enums";
import { BaseController } from "../base/BaseController";
import { IIstantaService } from "../interfaces/IIstantaService";
import { authMiddleware } from "../middleware/authMiddleware";
export class IstantaController extends BaseController {

    /**
     *
     */
    constructor(private istantaService: IIstantaService) {
        super('/api');
    }

    protected setupRoutes(): void {
        this.router.get("/getCombinazioniDaIstanta/:id", authMiddleware, this.getCombinazioniDaIstanta.bind(this));
        this.router.post("/downloadKitsByTipoDiExport", authMiddleware, this.downloadKitsByTipoDiExport.bind(this));
        this.router.get("/getStatusImportazione", authMiddleware, this.getStatusImportazione.bind(this));
    }

    private async getCombinazioniDaIstanta(req: Request, res: Response) {
        try {
            const istantaId = req.params.id;
            const combinazioni = await this.istantaService.getCombinazioniDaIstanta(istantaId, req);
            res.status(HttpStatusCode.OK).json(combinazioni);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async downloadKitsByTipoDiExport(req: Request, res: Response) {
        try {
            const data = req.body as {
                guidIdTipoDiExport: string;
                guidIdKitRuntime: string;
                guidIdGdo: string;
                guidIdArea: string;
                guidIdCanale: string;
                data_da: Date;
                data_a: Date;
            };
            const kits = await this.istantaService.downloadKitsByTipoDiExport(data, req);
            res.status(HttpStatusCode.OK).json(kits);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getStatusImportazione(req: Request, res: Response) {
        try {
            const guidId = req.query.idTracciato as string;
            const status = await this.istantaService.getStatusImportazione(guidId, req);
            res.status(HttpStatusCode.OK).json(status);
        } catch (error) {
            this.handleError(res, error);
        }
    }
}
