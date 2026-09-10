import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../../../lib/enums';
import { NotFoundError, UnauthorizedError, wrapApiError, wrapDatabaseError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import config from '../config/index';
import { CreateAreaDTO } from '../dto';
import { IAreaService } from '../interfaces/IAreaService';
import { IGdoService } from '../interfaces/IGdoService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { UtentiGDO } from '../models/utenti_gdo';
import { ServerUtils } from '../utils/ServerUtils';
export class AreaController extends BaseController {
  constructor(private areaService: IAreaService, private gdoService: IGdoService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/allAreeForGDO', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.getAllAreeForGDO.bind(this));
    this.router.put('/ACPV/salvaArea', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.salvaArea.bind(this));
    this.router.get('/all_aree', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.getAllAree.bind(this));
    this.router.delete('/ACPV/eliminaArea/:guidID', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.eliminaArea.bind(this));
  }

  private async getAllAreeForGDO(req: Request, res: Response): Promise<void> {
    try {
      if (!req.session.id_utente) {
        throw new UnauthorizedError({
          message: "Utente non autenticato"
        });
      }

      const gdo_utente = await UtentiGDO.findOne({
        where: {
          id_utente_utentegdo: req.session.id_utente
        }
      });
      if (!gdo_utente) {
        throw new NotFoundError({
          message: "GDO non specificata",
          entityType: "GDO",
          entityId: req.session.id_utente
        });
      }

      const idGDO = gdo_utente.id_gdo_utentegdo;
      const aree = await this.areaService.getAllAreeForGDO(idGDO);
      res.status(HttpStatusCode.OK).json(aree);
    } catch (error) {
      log.error('Errore nel recupero delle aree per GDO', error);
      this.handleError(res, error);
    }
  }


  private async getAllAree(req: Request, res: Response): Promise<void> {
    try {
      const aree = await this.areaService.getAllAreas();
      res.status(HttpStatusCode.OK).json(aree);
    } catch (error) {
      log.error('Errore nel recupero di tutte le aree', error);
      this.handleError(res, error);
    }
  }

  private async salvaArea(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as CreateAreaDTO;

      if (!data.id) {
        data.id = "";
      }
      if (data.id === "") {
        data.id = uuidv4();
      }
      if (!data.id_gdo) {
        if (req.session.id_utente) {
          const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente);
          if (gdo) {
            data.id_gdo = gdo.id as string;
          }
        }
      }

      if (req.headers['authorization']) {
        const area = await this.areaService.createArea(data);
        if (area) {
          // Determina se è una creazione o un aggiornamento
          const isUpdate = data.id && data.id !== '';
          const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
          const message = isUpdate ? 'Area aggiornata con successo' : 'Area creata con successo';

          res.status(statusCode).json({
            esito: true,
            error: "",
            message,
            isUpdate,
            data: area
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
        sigla: data.codice,
        nome: data.nome
      }
      try {
        console.log("dataPerIstanta", dataPerIstanta);
        console.log("config.ISTANTA_IP_ADDRESS", config.ISTANTA_IP_ADDRESS);
        const resultChiamataAreaIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          config.ISTANTA_IP_ADDRESS + '/ACPV/salvaArea',
          'PUT',
          dataPerIstanta
        );
        console.log("resultChiamataAreaIstanta", resultChiamataAreaIstanta);
        if (!resultChiamataAreaIstanta.data.esito && resultChiamataAreaIstanta.data.error !== "") {
          throw wrapApiError(new Error(resultChiamataAreaIstanta.data.error), {
            service: 'FICO API',
            endpoint: '/ACPV/salvaArea',
            message: "Errore durante l'inserimento dell'area in istanta",
            details: { dataPerIstanta }
          });
        }
      } catch (apiError) {
        throw wrapApiError(apiError, {
          service: 'FICO API',
          endpoint: '/ACPV/salvaArea',
          message: "Errore durante la chiamata all'API esterna",
          details: { dataPerIstanta }
        });
      }

      const area = await this.areaService.createArea(data);
      if (area) {
        // Determina se è una creazione o un aggiornamento
        const isUpdate = data.id && data.id !== '';
        const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
        const message = isUpdate ? 'Area aggiornata con successo' : 'Area creata con successo';

        res.status(statusCode).json({
          ...area,
          message,
          isUpdate
        });
      }
    } catch (error) {
      log.error('Errore nel salvataggio area', error);
      this.handleError(res, error);
    }
  }

  private async eliminaArea(req: Request, res: Response): Promise<void> {
    try {
      const guidID = req.params.guidID;

      if (req.headers['authorization']) {
        try {
          const result = await this.areaService.deleteArea(guidID);
          res.status(HttpStatusCode.OK).json({
            esito: result,
            error: ""
          });
          return;
        } catch (error) {
          throw wrapDatabaseError(error, {
            message: "Errore durante l'eliminazione dell'area",
            operation: "DELETE",
            entity: "Area",
            details: { guidID }
          });
        }
      }

      try {
        const resultChiamataAreaIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          config.ISTANTA_IP_ADDRESS + '/ACPV/eliminaArea/' + guidID,
          'DELETE',
          undefined
        );

        if (!resultChiamataAreaIstanta.data.esito && resultChiamataAreaIstanta.data.error !== "") {
          throw wrapApiError(new Error(resultChiamataAreaIstanta.data.error), {
            service: 'FICO API',
            endpoint: '/ACPV/eliminaArea',
            message: "Errore durante l'eliminazione dell'area in istanta",
            details: { guidID }
          });
        }
      } catch (apiError) {
        throw wrapApiError(apiError, {
          service: 'FICO API',
          endpoint: '/ACPV/eliminaArea',
          message: "Errore durante la chiamata all'API esterna",
          details: { guidID }
        });
      }

      const result = await this.areaService.deleteArea(guidID);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      log.error('Errore nella cancellazione area', error);
      this.handleError(res, error);
    }
  }
}
