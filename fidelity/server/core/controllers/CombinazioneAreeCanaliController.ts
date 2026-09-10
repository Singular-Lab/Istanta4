import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../../../lib/enums';
import { wrapApiError } from '../../../lib/errors/errorUtils';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { ICombinazioneAreeCanaliService } from '../interfaces/ICombinazioneAreeCanaliService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { UtentiGDO } from '../models/utenti_gdo';
import { ServerUtils } from '../utils/ServerUtils';
export class CombinazioneAreeCanaliController extends BaseController {
  protected setupRoutes(): void {
    this.initializeRoutes();
  }
  private combinazioneService: ICombinazioneAreeCanaliService;

  constructor(combinazioneService: ICombinazioneAreeCanaliService) {
    super('/api');
    this.combinazioneService = combinazioneService;
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    this.router.get('/all_combinazion_for_gdo', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.getAllCombinazioniForGDO.bind(this));
    this.router.put('/ACPV/setCombinazione', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.setCombinazione.bind(this));
    this.router.delete('/ACPV/deleteCombinazione/:guidID', authMiddleware, permissionGuard('gdo.gestisci_aree_canali'), this.deleteCombinazione.bind(this));
  }

  private async getAllCombinazioniForGDO(req: Request, res: Response): Promise<void> {
    try {
      const gdo_utente = await UtentiGDO.findOne({ where: { id_utente_utentegdo: req.session.id_utente } });
      if (!gdo_utente) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "GDO non specificata" });
        return;
      }

      const idGDO = gdo_utente.id_gdo_utentegdo;
      const combinazioni = await this.combinazioneService.getAllCombinazioniForGDOReworked(idGDO);
      res.status(HttpStatusCode.OK).json(combinazioni);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async setCombinazione(req: Request, res: Response): Promise<void> {
    try {
      let data = req.body as { guidID: string, guidIDCanale: string, guidIDArea: string, enabled: boolean, idGDO: string };

      if (!data.guidID) {
        data.guidID = uuidv4();
      }

      if (!data.idGDO) {
        const gdo_utente = await UtentiGDO.findOne({ where: { id_utente_utentegdo: req.session.id_utente } });
        if (gdo_utente) {
          data.idGDO = gdo_utente.id_gdo_utentegdo;
        }
      }
      const dataPerIstanta: {
        guidID: string;
        guidIDCanale: string;
        guidIDArea: string;
        enabled: boolean;
        idGDO: string;
      } = {
        guidID: data.guidID,
        guidIDCanale: data.guidIDCanale,
        guidIDArea: data.guidIDArea,
        enabled: data.enabled,
        idGDO: data.idGDO
      }
      if (req.headers['authorization']) {
        const resultCombinazione = await this.combinazioneService.createCombinazione(data);

        // Determina se è una creazione o un aggiornamento
        const isUpdate = data.guidID && data.guidID !== '';
        const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
        const message = isUpdate ? 'Combinazione aggiornata con successo' : 'Combinazione creata con successo';

        res.status(statusCode).json({
          esito: true,
          error: "",
          message,
          isUpdate,
          data: resultCombinazione
        });
        return;
      }

      const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/ACPV/setCombinazione',
        'PUT',
        dataPerIstanta
      );

      if (!result.data.esito && result.data.error !== "") {
        throw wrapApiError(new Error(result.data.error), {
          service: 'FICO API',
          endpoint: '/ACPV/setCombinazione',
          message: "Errore durante l'inserimento della combinazione in istanta",
          details: { dataPerIstanta }
        });
      }

      const resultCombinazione = await this.combinazioneService.createCombinazione(data);

      // Determina se è una creazione o un aggiornamento
      const isUpdate = data.guidID && data.guidID !== '';
      const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
      const message = isUpdate ? 'Combinazione aggiornata con successo' : 'Combinazione creata con successo';

      res.status(statusCode).json({
        ...resultCombinazione,
        message,
        isUpdate
      });

    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteCombinazione(req: Request, res: Response): Promise<void> {
    try {
      const { guidID } = req.params;

      const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + `/ACPV/eliminaCombinazione/${guidID}`,
        'DELETE',
        undefined
      );

      if (!result.data.esito && result.data.error !== "") {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
          message: "Errore durante l'eliminazione della combinazione",
          error: result.data.error
        });
        return;
      }

      const success = await this.combinazioneService.deleteCombinazione(guidID);
      if (success) {
        res.status(HttpStatusCode.OK).json({ esito: true, error: "" });
      } else {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
          message: "Errore durante l'eliminazione della combinazione"
        });
      }
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
