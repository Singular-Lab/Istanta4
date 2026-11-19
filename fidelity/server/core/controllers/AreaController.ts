import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../../../lib/enums';
import { DatabaseError, NotFoundError, UnauthorizedError, wrapDatabaseError } from '../../../lib/errors';
import { BaseController } from '../base/BaseController';
import config from '../config/index';
import { CreateAreaDTO } from '../dto';
import { IAreaService } from '../interfaces/IAreaService';
import { IGdoService } from '../interfaces/IGdoService';
import { gdoOperativaPerRichiesta } from '../accessi/contestoAccesso';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { UtentiGDO } from '../models/utenti_gdo';
import { ServerUtils } from '../utils/ServerUtils';
import { scriviSuIstanta } from '../utils/istanta';
import { membriDaRichiesta, problemiVoce, proxyCheContengono, voceDa } from '../../../lib/areeCanali/proxy';
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
      // Senza id e' una creazione: l'id lo genera FP e Istanta lo riceve gia' fatto
      const idInviato = typeof data.id === 'string' ? data.id : '';

      if (!data.id) {
        data.id = "";
      }
      if (data.id === "") {
        data.id = uuidv4();
      }
      // Solo Superadmin e Agenzia (o le chiamate di servizio) scelgono la GDO; gli altri usano la propria.
      const gdoDellArea = await gdoOperativaPerRichiesta(req, res, data.id_gdo);
      if (gdoDellArea) data.id_gdo = gdoDellArea;

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
      // Dalla pagina Aree e canali: codice unico nella GDO e regole dei proxy (lib/areeCanali/proxy.ts)
      const membri = membriDaRichiesta(data.membri);
      const [areeGdo, esistente] = await Promise.all([
        data.id_gdo ? this.areaService.getAreasByGDOId(data.id_gdo) : Promise.resolve([]),
        idInviato ? this.areaService.getAreaById(idInviato) : Promise.resolve(null),
      ]);
      const problemi = problemiVoce('area', { id: data.id, codice: data.codice ?? '', membri }, areeGdo.map(voceDa), esistente && voceDa(esistente));
      if (problemi.length > 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ esito: false, error: problemi.join(' '), message: problemi.join(' '), problemi });
        return;
      }

      // Anche un proxy va a Istanta, come un'area qualsiasi: i membri restano in FP
      const dataPerIstanta: {
        guidID: string;
        sigla: string;
        nome: string;
      } = {
        guidID: data.id,
        sigla: data.codice,
        nome: data.nome
      }
      await scriviSuIstanta(req, '/ACPV/salvaArea', 'PUT', dataPerIstanta);

      const area = await this.areaService.createArea({ ...data, membri });
      if (!area) {
        throw new DatabaseError({ message: "Errore durante il salvataggio dell'area", entity: 'Area' });
      }
      const isUpdate = Boolean(esistente);
      const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
      const message = isUpdate ? 'Area aggiornata con successo' : 'Area creata con successo';

      res.status(statusCode).json({
        esito: true,
        error: "",
        message,
        isUpdate,
        data: area
      });
    } catch (error) {
      log.error('Errore nel salvataggio area', error);
      this.handleError(res, error);
    }
  }

  private async eliminaArea(req: Request<{ guidID: string }>, res: Response): Promise<void> {
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

      // Un'area membro di un proxy non si elimina finche' il proxy la contiene
      const area = await this.areaService.getAreaById(guidID);
      const areeGdo = area ? (await this.areaService.getAreasByGDOId(area.id_gdo)).map(voceDa) : [];
      const proxy = proxyCheContengono(guidID, areeGdo);
      if (proxy.length > 0) {
        const motivo = `L'area è membro di ${proxy.map(p => p.nome).join(', ')}: toglila prima dal proxy.`;
        res.status(HttpStatusCode.CONFLICT).json({ esito: false, error: motivo, message: motivo });
        return;
      }
      await scriviSuIstanta(req, `/ACPV/eliminaArea/${guidID}`, 'DELETE', undefined);

      const result = await this.areaService.deleteArea(guidID);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      log.error('Errore nella cancellazione area', error);
      this.handleError(res, error);
    }
  }
}
