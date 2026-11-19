import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../../../lib/enums';
import { DatabaseError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { ICanaleService } from '../interfaces/ICanaleService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { GDO } from '../models/gdo';
import { UtentiGDO } from '../models/utenti_gdo';
import { ServerUtils } from '../utils/ServerUtils';
import { scriviSuIstanta } from '../utils/istanta';
import { membriDaRichiesta, problemiVoce, proxyCheContengono, voceDa } from '../../../lib/areeCanali/proxy';

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
      const data = req.body as { nome: string, sigla: string, id: string, idGDO: string, membri?: unknown };
      // Senza id e' una creazione: l'id lo genera FP e Istanta lo riceve gia' fatto
      const idInviato = ServerUtils.checkIfValueIsValid(data.id) ? data.id : '';

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
        // Da Istanta, che non conosce i membri: restano quelli che ci sono
        const canale = await this.canaleService.createCanale({ nome: data.nome, sigla: data.sigla, id: data.id, idGDO: data.idGDO });
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

      // Dalla pagina Aree e canali: codice unico nella GDO e regole dei proxy (lib/areeCanali/proxy.ts)
      const membri = membriDaRichiesta(data.membri);
      const [canaliGdo, esistente] = await Promise.all([
        data.idGDO ? this.canaleService.getCanaliByGDOId(data.idGDO) : Promise.resolve([]),
        idInviato ? this.canaleService.getCanaleById(idInviato) : Promise.resolve(null),
      ]);
      const problemi = problemiVoce('canale', { id: data.id, codice: data.sigla ?? '', membri }, canaliGdo.map(voceDa), esistente && voceDa(esistente));
      if (problemi.length > 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ esito: false, error: problemi.join(' '), message: problemi.join(' '), problemi });
        return;
      }

      // Anche un proxy va a Istanta, come un canale qualsiasi: i membri restano in FP
      const dataPerIstanta: {
        guidID: string;
        sigla: string;
        nome: string;
      } = {
        guidID: data.id,
        sigla: data.sigla,
        nome: data.nome
      }
      await scriviSuIstanta(req, '/ACPV/salvaCanale', 'PUT', dataPerIstanta);

      const canale = await this.canaleService.createCanale({ ...data, membri });
      if (!canale) {
        throw new DatabaseError({ message: 'Errore durante il salvataggio del canale', entity: 'canale' });
      }
      const isUpdate = Boolean(esistente);
      const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
      const message = isUpdate ? 'Canale aggiornato con successo' : 'Canale creato con successo';

      res.status(statusCode).json({
        esito: true,
        error: "",
        message,
        isUpdate,
        data: {
          id: canale.id_canali ?? data.id,
          codice: canale.codice_canali,
          nome: canale.nome_canali,
          id_gdo: canale.id_gdo_canali,
          membri: canale.membri_canali ?? membri,
        }
      });

    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaCanale(req: Request<{ guidID: string }>, res: Response): Promise<void> {
    try {
      const guidID = req.params.guidID;

      // Dalla pagina: un canale membro di un proxy non si elimina finche' il proxy lo contiene
      if (!req.headers['authorization']) {
        const canale = await this.canaleService.getCanaleById(guidID);
        const proxy = canale ? proxyCheContengono(guidID, (await this.canaleService.getCanaliByGDOId(canale.id_gdo)).map(voceDa)) : [];
        if (proxy.length > 0) {
          const nomi = proxy.map(p => p.nome).join(', ');
          res.status(HttpStatusCode.CONFLICT).json({ esito: false, error: `Il canale è membro di ${nomi}: toglilo prima dal proxy.`, message: `Il canale è membro di ${nomi}: toglilo prima dal proxy.` });
          return;
        }
      }

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
