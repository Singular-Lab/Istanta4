import { Request, Response } from 'express';
import 'express-session';
import { HttpStatusCode } from '../../../lib/enums';
import { Declinazione } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import { IRaccoglitoreKitService } from '../interfaces/IRaccoglitoreKitService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';

export class RaccoglitoreKitController extends BaseController {

  constructor(private raccoglitoreKitService: IRaccoglitoreKitService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/getRaccoglitoreKitById/:id', authMiddleware, permissionGuard('raccoglitore_kit.visualizza'), this.getRaccoglitoreKitById.bind(this));
    this.router.delete('/eliminaRaccoglitoreKit/:id', authMiddleware, permissionGuard('raccoglitore_kit.elimina'), this.eliminaRaccoglitoreKit.bind(this));
    this.router.put('/updateRaccoglitoreKit', authMiddleware, permissionGuard('raccoglitore_kit.modifica'), this.updateRaccoglitoreKit.bind(this));
    this.router.put('/creaFiltroPerRaccoglitoreById', authMiddleware, permissionGuard('raccoglitore_kit.gestisci_filtri'), this.creaFiltroPerRaccoglitoreById.bind(this));
    this.router.get('/getFiltroById/:id', authMiddleware, permissionGuard('raccoglitore_kit.visualizza'), this.getFiltroById.bind(this));
    this.router.get('/getFiltroContestoDaIstanta', authMiddleware, permissionGuard('raccoglitore_kit.visualizza'), this.getFiltroContestoDaIstanta.bind(this));
    this.router.put('/creaFiltroContestoPerRaccoglitoreById', authMiddleware, permissionGuard('raccoglitore_kit.gestisci_filtri'), this.creaFiltroContestoPerRaccoglitoreById.bind(this));
    this.router.get('/getAllDeclinazioniKitDaIstanta', authMiddleware, permissionGuard('raccoglitore_kit.visualizza'), this.getAllDeclinazioniKitDaIstanta.bind(this));
    this.router.put('/creaDeclinazioniPerRaccoglitoreById', authMiddleware, permissionGuard('raccoglitore_kit.gestisci_declinazioni'), this.creaDeclinazioniPerRaccoglitoreById.bind(this));
    this.router.put('/creaDeclinazioniPerCombinazioneById', authMiddleware, permissionGuard('raccoglitore_kit.gestisci_declinazioni'), this.creaDeclinazioniPerCombinazioneById.bind(this));
  }

  private async getRaccoglitoreKitById(req: Request, res: Response): Promise<void> {
    try {
      const idRaccoglitore = req.params.id;
      const result = await this.raccoglitoreKitService.getRaccoglitoreKitById(idRaccoglitore as string);
      if (!result) {
        res.status(HttpStatusCode.NOT_FOUND).json({ message: "Raccoglitore non trovato" });
        return;
      }
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaRaccoglitoreKit(req: Request, res: Response): Promise<void> {
    try {
      const idRaccoglitore = req.params.id;
      const result = await this.raccoglitoreKitService.eliminaRaccoglitoreKit(idRaccoglitore);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async updateRaccoglitoreKit(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (!ServerUtils.checkIfValueIsValid(data) || !ServerUtils.checkIfValueIsValid(data.id)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.raccoglitoreKitService.updateRaccoglitoreKit(data);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }



  private async creaFiltroPerRaccoglitoreById(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as { idCombinazione: string; filtri: any[] };
      if (!ServerUtils.checkIfValueIsValid(data.idCombinazione) || !ServerUtils.checkIfValueIsValid(data.filtri)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.raccoglitoreKitService.creaFiltroPerRaccoglitoreById(data.idCombinazione, data.filtri);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getFiltroById(req: Request, res: Response): Promise<void> {
    try {
      const idFiltro = req.params.id;
      const filtro = await this.raccoglitoreKitService.getFiltroById(idFiltro as string);
      res.status(HttpStatusCode.OK).json(filtro);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }



  private async getFiltroContestoDaIstanta(req: Request, res: Response): Promise<void> {
    try {
      const resultContesto = await this.raccoglitoreKitService.getFiltroContestoDaIstanta(req);
      res.status(HttpStatusCode.OK).json(resultContesto);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async creaFiltroContestoPerRaccoglitoreById(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as { filtroContesto?: any[]; idCombinazione?: string };
      if (!ServerUtils.checkIfValueIsValid(data.filtroContesto) || !ServerUtils.checkIfValueIsValid(data.idCombinazione)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.raccoglitoreKitService.creaFiltroContestoPerRaccoglitoreById(data.idCombinazione, data.filtroContesto);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllDeclinazioniKitDaIstanta(req: Request, res: Response): Promise<void> {
    try {
      const declinazioni = await this.raccoglitoreKitService.getAllDeclinazioniKitDaIstanta(req);
      res.status(HttpStatusCode.OK).json(declinazioni);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async creaDeclinazioniPerRaccoglitoreById(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (!ServerUtils.checkIfValueIsValid(data?.idCombinazione) || !ServerUtils.checkIfValueIsValid(data?.data?.declinazioni)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.raccoglitoreKitService.creaDeclinazioniPerRaccoglitoreById(data.idCombinazione, data.data.declinazioni);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async creaDeclinazioniPerCombinazioneById(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (!ServerUtils.checkIfValueIsValid(data?.guidId) || !ServerUtils.checkIfValueIsValid(data?.declinazioni)) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.raccoglitoreKitService.creaDeclinazioniPerCombinazioneById(data.guidId, data.declinazioni);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
