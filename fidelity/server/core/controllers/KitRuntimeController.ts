import { Request, Response } from 'express';
import 'express-session';
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_ATTIVITA } from '../../../lib/enums';
import { DESIGN_KIT_MONGO } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import { IDesignKitService } from '../interfaces/IDesignKitService';
import { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { Promo } from '../models/promo';
import { ServerUtils } from '../utils/ServerUtils';
export class KitRuntimeController extends BaseController {

  constructor(
    private kitRuntimeService: IKitRuntimeService,
    private designKitService: IDesignKitService
  ) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    // From ImpostazioniController
    this.router.get('/getAllKitPerGestioneLavorazione/:idPromo', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getAllKitPerGestioneLavorazione.bind(this));
    this.router.get('/get_kit_per_gestione_lavorazione/:idPromo/:idKit', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getKitPerGestioneLavorazione.bind(this));
    this.router.put('/getKitByPromo', authMiddleware, this.getKitByPromo.bind(this));
    this.router.delete('/mettiInStatoDiEliminazione/:id', authMiddleware, permissionGuard('kit_runtime.elimina'), this.mettiInStatoDiEliminazione.bind(this));
    this.router.delete('/eliminaKitRuntime/:id', authMiddleware, permissionGuard('kit_runtime.elimina'), this.eliminaKitRuntime.bind(this));
    this.router.delete('/eliminaFileKitRuntime/:id', authMiddleware, permissionGuard('kit_runtime.elimina_file'), this.eliminaFileKitRuntime.bind(this));
    this.router.put('/avvioRevisioneKitManuale', authMiddleware, permissionGuard('kit_runtime.revisione'), this.avvioRevisioneKitManuale.bind(this));
    this.router.put('/avvioRevisioneKitAutomatico', authMiddleware, permissionGuard('kit_runtime.revisione'), this.avvioRevisioneKitAutomatico.bind(this));
    this.router.put('/riportaInLavorazione', authMiddleware, permissionGuard('kit_runtime.riporta_in_lavorazione'), this.riportaInLavorazione.bind(this));
    this.router.put('/riportaInLavorazioneConErroriAutomatico', authMiddleware, permissionGuard('kit_runtime.riporta_in_lavorazione'), this.riportaInLavorazioneConErroriAutomatico.bind(this));
    this.router.put('/pubblicaKitRuntime', authMiddleware, permissionGuard('kit_runtime.pubblica'), this.pubblicaKitRuntime.bind(this));
    this.router.get('/getAllKitRuntime', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getAllKitRuntime.bind(this));
    this.router.put('/cambioStatoCombinazione', authMiddleware, permissionGuard('kit_runtime.cambia_stato'), this.cambioStatoCombinazione.bind(this));

    // From PromoController
    this.router.get('/get_kit_runtime_by_promo/:idPromo', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getKitRuntimeByPromo.bind(this));
    this.router.get('/get_all_kit_runtime_by_promo/:idPromo', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getAllKitRuntimeByPromo.bind(this));
    this.router.get('/getKitRunTimeById', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getKitRunTimeById.bind(this));
    this.router.get('/getKitRunTimeFilesPaginated', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getKitRunTimeFilesPaginated.bind(this));
    //NOTE: questa funzione viene chiamata dall'esterno non mettere il controllo.
    this.router.delete('/clearAllFilesKitRuntime/:idKitRuntime/:guidIdExport', authMiddleware, this.clearAllFilesKitRuntime.bind(this));
    this.router.get('/getFilesPerGestioneLavorazione/:idKit', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getFilesPerGestioneLavorazione.bind(this));
  }

  // === Handlers from ImpostazioniController ===

  private async getAllKitPerGestioneLavorazione(req: Request, res: Response): Promise<void> {
    try {
      const idPromo = req.params.idPromo;
      const result = await this.kitRuntimeService.getAllKitPerGestioneLavorazione(idPromo, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getKitPerGestioneLavorazione(req: Request, res: Response): Promise<void> {
    try {
      const idPromo = req.params.idPromo;
      const idKit = req.params.idKit;
      const result = await this.kitRuntimeService.getKitPerGestioneLavorazione(idPromo, idKit, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getKitByPromo(req: Request, res: Response): Promise<void> {
    try {
      // se id esiste allora vuol dire che l'id è conosciuto e quindi devo fare la query
      const data = req.body as {
        id: string,
        idPromo?: string
        idCanale?: string
        idArea?: string
        idPV?: string
        lettura: boolean
        idFormato?: string
        tags?: string[]
        promoContext?: {
          nome_field: string;
          user_value: string;
        }[],
        tipoLavorazione?: number
      }
      if (data.id != undefined) {
        const resultDesignKit = await this.designKitService.getCombinazioneDesignById(data.id) as DESIGN_KIT_MONGO
        if (resultDesignKit == undefined) {
          res.status(HttpStatusCode.NOT_FOUND).json({ esito: false, content: null, error: "Kit runtime non trovato" });
          return;
        }
        if (data.lettura == false) {
          if (data.idPromo == undefined) {
            res.status(HttpStatusCode.BAD_REQUEST).json({ esito: false, content: null, error: "Id promo mancante" });
            return;
          }
          const kitPerPromo = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(data.idPromo)
          const resultInizioLavorazionePerIstanta = await this.kitRuntimeService.createKitRunTime({
            ...resultDesignKit,
            guidId: uuidv4(),
            idPromo: data.idPromo as string,
            guidIdDesign: resultDesignKit.guidId,
            stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
            filtroContesto: resultDesignKit.filtroContesto || [],
            inizioLavorazione: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
          if (req.session.id_utente != undefined) {
            ServerUtils.CREA_ATTIVITA(
              req.session.id_utente as string,
              TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO,
              CATEGORIA_ATTIVITA.PRODUZIONE,
              {
                titolo: resultDesignKit.titolo,
                guidId: resultDesignKit.guidId,
                guidIdFormato: resultDesignKit.guidFormato,
                guidIdCanale: resultDesignKit.guidCanale,
                guidIdArea: resultDesignKit.guidArea,
                guidIdPv: resultDesignKit.guidPv ?? "",
                quantita: resultDesignKit.quantitaCopie,
                tipo: resultDesignKit.tipo,
                idPromo: data.idPromo as string
              })
          } else {
            //FIXME attenzione cambiato da "System" a null perché il DB crashava
            ServerUtils.CREA_ATTIVITA(
              null,
              TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO,
              CATEGORIA_ATTIVITA.PRODUZIONE,
              {
                titolo: resultDesignKit.titolo,
                guidId: resultDesignKit.guidId,
                guidIdFormato: resultDesignKit.guidFormato,
                guidIdCanale: resultDesignKit.guidCanale,
                guidIdArea: resultDesignKit.guidArea,
                guidIdPv: resultDesignKit.guidPv ?? "",
                quantita: resultDesignKit.quantitaCopie,
                tipo: resultDesignKit.tipo,
                idPromo: data.idPromo as string
              })
          }
          delete resultInizioLavorazionePerIstanta._id;
          if (kitPerPromo.length == 0) {
            await Promo.update(
              { updatedat: new Date(), stato: STATO_PROMO.IN_LAVORAZIONE },
              {
                where: {
                  id_promo: data.idPromo as string
                }
              }
            );
          }
          res.status(HttpStatusCode.OK).json({ esito: true, content: [resultInizioLavorazionePerIstanta], error: "" });
          return;
        } else {
          res.status(HttpStatusCode.OK).json({ esito: true, content: [resultDesignKit], error: "" });
          return;
        }
      }
      const dataPerQuery = _.omit(data, ["lettura"]);
      const result = await this.kitRuntimeService.getAllKitByAreaCanalePV(dataPerQuery);
      if (data.lettura == false) {
        for (let singleKit of result) {
          singleKit.idPromo = data.idPromo;
        }
        const resultInizioLavorazionePerIstanta = await this.kitRuntimeService.bulkCreateRuntime(result.map((singleKit: DESIGN_KIT_MONGO) => ({ ...singleKit, idPromo: data.idPromo })) as (DESIGN_KIT_MONGO & { idPromo: string; })[])

        if (req.session.id_utente) {
          await ServerUtils.CREA_ATTIVITA(
            req.session.id_utente as string,
            TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_MANUALE,
            CATEGORIA_ATTIVITA.PRODUZIONE,
            {
              idPromo: data.idPromo,
              quantita: result.length,
              nome_kit: result[0]?.titolo || result[0]?.nome || 'Kit manuale',
            }
          );
        }

        res.status(HttpStatusCode.OK).json({ esito: true, content: resultInizioLavorazionePerIstanta, error: "" });
        return;
      } else {
        res.status(HttpStatusCode.OK).json({ error: "", esito: true, content: result });
      }
    } catch (error: any) {
      this.handleError(res, error);
    }
  }




  private async mettiInStatoDiEliminazione(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const result = await this.kitRuntimeService.mettiInStatoDiEliminazione(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaKitRuntime(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const result = await this.kitRuntimeService.eliminaKitRuntime(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaFileKitRuntime(req: Request, res: Response): Promise<void> {
    try {
      const idFile = req.params.id;
      const result = await this.kitRuntimeService.eliminaFileKitRuntime(idFile);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async avvioRevisioneKitManuale(req: Request, res: Response): Promise<void> {
    try {
      const idLavorazione = req.body.idLavorazione;
      const result = await this.kitRuntimeService.avvioRevisioneKitManuale(idLavorazione);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async avvioRevisioneKitAutomatico(req: Request, res: Response): Promise<void> {
    try {
      const idLavorazione = req.body.idLavorazione;
      const result = await this.kitRuntimeService.avvioRevisioneKitAutomatico(idLavorazione);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async riportaInLavorazione(req: Request, res: Response): Promise<void> {
    try {
      const { idLavorazione, filesAccepted, filesRejected } = req.body;
      const result = await this.kitRuntimeService.riportaInLavorazione(idLavorazione, filesAccepted, filesRejected, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async riportaInLavorazioneConErroriAutomatico(req: Request, res: Response): Promise<void> {
    try {
      const { idLavorazione, filesAccepted, filesRejected } = req.body;
      const result = await this.kitRuntimeService.riportaInLavorazioneConErroriAutomatico(idLavorazione, filesAccepted, filesRejected, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async pubblicaKitRuntime(req: Request, res: Response): Promise<void> {
    try {
      const idLavorazione = req.body.idLavorazione;
      const result = await this.kitRuntimeService.pubblicaKitRuntime(idLavorazione, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllKitRuntime(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.kitRuntimeService.getAllKitRuntime();
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async cambioStatoCombinazione(req: Request, res: Response): Promise<void> {
    try {
      const { guidId, stato } = req.body;
      const result = await this.kitRuntimeService.cambioStatoCombinazione(guidId, stato);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  // === Handlers from PromoController ===

  private async getKitRuntimeByPromo(req: Request, res: Response): Promise<void> {
    try {
      const idPromo = req.params.idPromo;
      const allKitRuntime = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(idPromo);
      const published = allKitRuntime.filter(
        (kit: any) => kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO
      );
      res.status(HttpStatusCode.OK).json(published);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllKitRuntimeByPromo(req: Request, res: Response): Promise<void> {
    try {
      const idPromo = req.params.idPromo;
      const allKitRuntime = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(idPromo);
      res.status(HttpStatusCode.OK).json(allKitRuntime);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getKitRunTimeById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.query.id as string;
      const getFiles = req.query.get_files !== 'false';
      const result = await this.kitRuntimeService.getKitRuntimeById(id);

      if (getFiles) {
        const files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(id);
        res.status(HttpStatusCode.OK).json({ ...result, files });
      } else {
        res.status(HttpStatusCode.OK).json(result);
      }
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getKitRunTimeFilesPaginated(req: Request, res: Response): Promise<void> {
    try {
      const { id, page, pageSize, search, searchProperty } = req.query;

      if (!id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'id parameter is required' });
        return;
      }

      const result = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntimePaginated({
        idKitRuntime: id as string,
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 24,
        search: (search as string) || '',
        searchProperty: (searchProperty as string) || '',
      });

      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async clearAllFilesKitRuntime(req: Request, res: Response): Promise<void> {
    try {
      const { idKitRuntime, guidIdExport } = req.params;
      await this.kitRuntimeService.clearAllFilesKitRuntime(idKitRuntime, guidIdExport)
      res.status(HttpStatusCode.OK).json({ message: "File eliminati con successo" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getFilesPerGestioneLavorazione(req: Request, res: Response): Promise<void> {
    try {
      const idKit = req.params.idKit;
      const result = await this.kitRuntimeService.getFilesPerGestioneLavorazione(idKit, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
