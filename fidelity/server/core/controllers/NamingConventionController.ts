import { Request, Response } from 'express';
import 'express-session';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { INamingConventionService } from '../interfaces/INamingConventionService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';

export class NamingConventionController extends BaseController {

  constructor(private namingConventionService: INamingConventionService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/get_all_naming_conventions', authMiddleware, permissionGuard('impostazioni.gestisci_naming_convention'), this.getAllNamingConventions.bind(this));
    this.router.put('/creaNamingConvention', authMiddleware, permissionGuard('impostazioni.gestisci_naming_convention'), this.creaNamingConvention.bind(this));
    this.router.get('/get_all_naming_convention_from_istanta', authMiddleware, permissionGuard('impostazioni.gestisci_naming_convention'), this.getAllNamingConventionFromIstanta.bind(this));
    this.router.delete('/deleteNamingConvention/:id', authMiddleware, permissionGuard('impostazioni.gestisci_naming_convention'), this.deleteNamingConvention.bind(this));
  }

  private async getAllNamingConventions(req: Request, res: Response): Promise<void> {
    try {
      const namingConventions = await this.namingConventionService.getAllNamingConventions();
      res.status(HttpStatusCode.OK).json(namingConventions);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async creaNamingConvention(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (!data || !data.namingConvention?.length) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.namingConventionService.creaNamingConventionConReq(data, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllNamingConventionFromIstanta(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.namingConventionService.getAllNamingConventionFromIstanta(req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async deleteNamingConvention(req: Request, res: Response): Promise<void> {
    try {
      const idNamingConvention = req.params.id;
      const resultChiamataIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/eliminaNamingConvention/${idNamingConvention}`,
        'PUT',
        undefined
      );
      if (resultChiamataIstanta.data.error != "") {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante l'eliminazione della naming convention in istanta", error: resultChiamataIstanta.data.error });
        return;
      }
      if (resultChiamataIstanta.data.esito == false) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante l'eliminazione della naming convention in istanta", error: resultChiamataIstanta.data.error });
        return;
      }
      const result = await this.namingConventionService.deleteNamingConvention(idNamingConvention as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
