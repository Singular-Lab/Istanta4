import { Request, Response } from 'express';
import 'express-session';
import { HttpStatusCode } from '../../../lib/enums';
import { ambitoGdoDellaRichiesta } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import { IVolantinoService } from '../interfaces/IVolantinoService';
import { authMiddleware } from '../middleware/authMiddleware';
import { routeDeprecata } from '../middleware/routeDeprecata';
import { permissionGuard } from '../middleware/permissionGuard';

export class VolantinoController extends BaseController {

  constructor(private volantinoService: IVolantinoService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/flyer-insights/:guidIdKitRuntime', authMiddleware, permissionGuard('materiali.visualizza'), this.getFlyerInsights.bind(this));
    this.router.get('/prendiIVolantiniCaricatiDaDB', authMiddleware, permissionGuard('kit_runtime.visualizza'), routeDeprecata, this.prendiIVolantiniCaricatiDaDB.bind(this));
  }

  private async getFlyerInsights(req: Request<{ guidIdKitRuntime: string }>, res: Response): Promise<void> {
    try {
      const { guidIdKitRuntime } = req.params;
      if (!guidIdKitRuntime) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: "guidIdKitRuntime è obbligatorio" });
        return;
      }
      // La GDO della sessione (Superadmin e Agenzia: tutte, o quella in ?gdo=): fuori ambito e' un 404
      const ambito = await ambitoGdoDellaRichiesta(req, res, req.query.gdo);
      const result = await this.volantinoService.getFlyerInsights(guidIdKitRuntime, ambito, req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async prendiIVolantiniCaricatiDaDB(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.volantinoService.prendiIVolantiniCaricatiDaDB();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }
}
