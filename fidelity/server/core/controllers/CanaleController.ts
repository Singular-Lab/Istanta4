import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../../../lib/enums';
import { wrapApiError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { ICanaleService } from '../interfaces/ICanaleService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { GDO } from '../models/gdo';
import { UtentiGDO } from '../models/utenti_gdo';
import { ServerUtils } from '../utils/ServerUtils';

export class CanaleController extends BaseController {
  constructor(private canaleService: ICanaleService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/allCanaliForGDO', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.getAllCanaliForGDO.bind(this));
    this.router.put('/ACPV/salvaCanale', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.salvaCanale.bind(this));
    this.router.delete('/ACPV/eliminaCanale/:guidID', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.eliminaCanale.bind(this));
    this.router.get('/all_canali', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.getAllCanali.bind(this));
  }

  private async getAllCanali(req: Request, res: Response): Promise<void> {
    try {
      const canali = await this.canaleService.getAllCanali();
      res.status(HttpStatusCode.OK).json(canali);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getAllCanaliForGDO(req: Request, res: Response): Promise<void> {
    try {
      const session = req.session;
      const utenti_gdo = await UtentiGDO.findOne({
        where: { id_utente_utentegdo: session.id_utente }
      });
      if (!utenti_gdo) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "GDO non specificata" });
        return;
      }
      const gdo = await GDO.findOne({
        where: { id_gdo: utenti_gdo.id_gdo_utentegdo }
      });
      if (!gdo) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "GDO non specificata" });
        return;
      }

      const canali = await this.canaleService.getAllCanaliForGDO(gdo.id_gdo);
      res.status(HttpStatusCode.OK).json(canali);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async salvaCanale(req: Request, res: Response): Promise<void> {
    try {
      const session = req.session;
      const data = req.body as { nome: string, sigla: string, id: string, idGDO: string };

      if (!ServerUtils.checkIfValueIsValid(data.id)) {
        data.id = "";
      }
      if (!ServerUtils.checkIfValueIsValid(data.id)) {
        data.id = uuidv4();
      }
      if (!ServerUtils.checkIfValueIsValid(data.idGDO)) {
        const utenti_gdo = await UtentiGDO.findOne({
          where: { id_utente_utentegdo: session.id_utente }
        });
        if (utenti_gdo) {
          data.idGDO = utenti_gdo.id_gdo_utentegdo;
        }
      }

      if (req.headers['authorization']) {
        const canale = await this.canaleService.createCanale(data);
        if (canale) {
          // Determina se è una creazione o un aggiornamento
          const isUpdate = data.id && data.id !== '';
          const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
          const message = isUpdate ? 'Canale aggiornato con successo' : 'Canale creato con successo';

          res.status(statusCode).json({
            esito: true,
            error: "",
            message,
            isUpdate,
            data: canale
          });
          return;
        }
      }
      const dataPerIstanta: {
        guidID: string;
        sigla: string;
        nome: string;
      } = {
        guidID: data.id,
        sigla: data.sigla,
        nome: data.nome
      }
      const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/ACPV/salvaCanale',
        'PUT',
        dataPerIstanta
      );

      if (!result.data.esito && result.data.error != "") {
        throw wrapApiError(new Error(result.data.error), {
          service: 'FICO API',
          endpoint: '/ACPV/salvaCanale',
          message: "Errore durante l'inserimento del canale in istanta",
          details: { dataPerIstanta }
        });
      } else {
        const canale = await this.canaleService.createCanale(data);
        if (canale) {
          // Determina se è una creazione o un aggiornamento
          const isUpdate = data.id && data.id !== '';
          const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
          const message = isUpdate ? 'Canale aggiornato con successo' : 'Canale creato con successo';

          res.status(statusCode).json({
            ...canale,
            message,
            isUpdate
          });
        }
      }

    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaCanale(req: Request, res: Response): Promise<void> {
    try {
      const session = req.session;
      const guidID = req.params.guidID;

      const result = await this.canaleService.deleteCanale(
        guidID,
        req
      );

      if (req.headers['authorization']) {
        res.status(HttpStatusCode.OK).json({
          esito: result,
          error: ""
        });
      } else {
        res.status(HttpStatusCode.OK).json(result);
      }
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
