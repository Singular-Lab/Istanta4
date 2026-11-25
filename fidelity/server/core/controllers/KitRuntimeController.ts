import { Request, Response } from 'express';
import 'express-session';
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_ATTIVITA } from '../../../lib/enums';
import {
  chiaveCoppia, eSuProxy, kitConfusiDaIstanta, messaggioKitConfusi, MESSAGGIO_AVVIO_PROXY, NESSUN_PROXY, vociRichieste,
  type KitConfrontabile,
} from '../../../lib/areeCanali/proxy';
import { DESIGN_KIT } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import { IDesignKitService } from '../interfaces/IDesignKitService';
import { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { log } from '../logger';
import { authMiddleware, integrationAuthMiddleware } from '../middleware/authMiddleware';
import { routeDeprecata } from '../middleware/routeDeprecata';
import { permissionGuard } from '../middleware/permissionGuard';
import { Promo } from '../models/promo';
import { caricaProxy, contestoPezzi, kitDellaPromo, NESSUN_PEZZO, pezziPerIstanta, trovaPezzo } from '../services/areeCanaliProxy';
import { ServerUtils } from '../utils/ServerUtils';

/** I dati del design che dicono cosa si sta avviando, senza scrivere nel log tutto l'oggetto. */
const riassuntoDesign = (design: DESIGN_KIT) => ({
  idDesign: design.guidId,
  titolo: design.titolo,
  tipo: design.tipo,
  stato: design.stato,
  canale: design.nomeCanale,
  area: design.nomeArea,
  idCanale: design.guidCanale,
  idArea: design.guidArea,
  idFormato: design.guidFormato,
  idRaccoglitore: design.guidIdRaccoglitore,
  tipiExport: design.tipiDiExportInKit?.length ?? 0,
  filtriContesto: design.filtroContesto?.length ?? 0,
});

/** I20-1271: quante promo Correggo4 puo' chiedere in una volta a getAreeKitByPromo. */
const MAX_PROMO_AREE = 200;

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
    this.router.put('/getKitByPromo', integrationAuthMiddleware, permissionGuard('kit_runtime.crea'), this.getKitByPromo.bind(this));
    // I20-1271: la chiama Correggo4 da server, col bearer di Olympus, per dividere per canale le promo attive
    this.router.get('/getAreeKitByPromo', integrationAuthMiddleware, permissionGuard('kit_runtime.visualizza'), this.getAreeKitByPromo.bind(this));
    this.router.delete('/mettiInStatoDiEliminazione/:id', authMiddleware, permissionGuard('kit_runtime.elimina'), this.mettiInStatoDiEliminazione.bind(this));
    this.router.delete('/eliminaKitRuntime/:id', authMiddleware, permissionGuard('kit_runtime.elimina'), this.eliminaKitRuntime.bind(this));
    this.router.delete('/eliminaFileKitRuntime/:id', authMiddleware, permissionGuard('kit_runtime.elimina_file'), this.eliminaFileKitRuntime.bind(this));
    this.router.put('/avvioRevisioneKitManuale', authMiddleware, permissionGuard('kit_runtime.revisione'), routeDeprecata, this.avvioRevisioneKitManuale.bind(this));
    this.router.put('/avvioRevisioneKitAutomatico', authMiddleware, permissionGuard('kit_runtime.revisione'), this.avvioRevisioneKitAutomatico.bind(this));
    this.router.put('/riportaInLavorazione', authMiddleware, permissionGuard('kit_runtime.riporta_in_lavorazione'), routeDeprecata, this.riportaInLavorazione.bind(this));
    this.router.put('/riportaInLavorazioneConErroriAutomatico', authMiddleware, permissionGuard('kit_runtime.riporta_in_lavorazione'), this.riportaInLavorazioneConErroriAutomatico.bind(this));
    this.router.put('/pubblicaKitRuntime', authMiddleware, permissionGuard('kit_runtime.pubblica'), this.pubblicaKitRuntime.bind(this));
    this.router.get('/getAllKitRuntime', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getAllKitRuntime.bind(this));
    this.router.put('/cambioStatoCombinazione', authMiddleware, permissionGuard('kit_runtime.cambia_stato'), this.cambioStatoCombinazione.bind(this));

    // From PromoController
    this.router.get('/get_kit_runtime_by_promo/:idPromo', authMiddleware, permissionGuard('kit_runtime.visualizza'), routeDeprecata, this.getKitRuntimeByPromo.bind(this));
    this.router.get('/get_all_kit_runtime_by_promo/:idPromo', authMiddleware, permissionGuard('kit_runtime.visualizza'), routeDeprecata, this.getAllKitRuntimeByPromo.bind(this));
    this.router.get('/getKitRunTimeById', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getKitRunTimeById.bind(this));
    this.router.get('/getKitRunTimeFilesPaginated', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getKitRunTimeFilesPaginated.bind(this));
    //NOTE: questa funzione viene chiamata dall'esterno non mettere il controllo.
    this.router.delete('/clearAllFilesKitRuntime/:idKitRuntime/:guidIdExport', integrationAuthMiddleware, permissionGuard('kit_runtime.elimina_file'), this.clearAllFilesKitRuntime.bind(this));
    this.router.get('/getFilesPerGestioneLavorazione/:idKit', authMiddleware, permissionGuard('kit_runtime.visualizza'), this.getFilesPerGestioneLavorazione.bind(this));
  }

  // === Handlers from ImpostazioniController ===

  private async getAllKitPerGestioneLavorazione(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const idPromo = req.params.idPromo;
      const result = await this.kitRuntimeService.getAllKitPerGestioneLavorazione(idPromo, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getKitPerGestioneLavorazione(req: Request<{ idPromo: string; idKit: string }>, res: Response): Promise<void> {
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
    const inizio = Date.now();
    // Tutte le righe di una chiamata hanno la stessa richiesta: si filtrano insieme
    const traccia = { context: 'getKitByPromo', richiesta: String((req as any).id ?? uuidv4()).slice(0, 8) };
    const durata = () => ({ durataMs: Date.now() - inizio });
    // se id esiste allora vuol dire che l'id è conosciuto e quindi devo fare la query
    const data = (req.body ?? {}) as {
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
    const parametri = {
      lettura: data.lettura,
      id: data.id,
      idPromo: data.idPromo,
      idCanale: data.idCanale,
      idArea: data.idArea,
      idPV: data.idPV,
      idFormato: data.idFormato,
      tipoLavorazione: data.tipoLavorazione,
      tags: data.tags,
      promoContext: data.promoContext?.map(c => `${c.nome_field}=${c.user_value}`),
    };
    try {
      log.info('Richiesta ricevuta', {
        ...traccia,
        ramo: data.id != undefined ? 'design' : 'combinazioni',
        autenticazione: res.locals.authVia ?? 'sessione',
        utente: req.session?.id_utente,
        tipoUtente: req.session?.tipo_utente,
        ...parametri,
      });
      // Istanta (bearer) conosce i proxy come voci normali: chiedendo un proxy riceve anche i kit dei
      // membri, e i design proxy gli arrivano divisi in pezzi, uno per combinazione membro attiva;
      // ogni pezzo ha un id suo e si avvia come un kit (lib/areeCanali/proxy.ts)
      const perIstanta = res.locals.authVia === 'bearer';
      const contesto = perIstanta ? await contestoPezzi() : NESSUN_PEZZO;
      const conProxy = contesto !== NESSUN_PEZZO;
      const rifiutaKitConfusi = (coppie: Array<[KitConfrontabile, KitConfrontabile]>) => {
        const motivo = messaggioKitConfusi(coppie);
        log.warn('Kit che Istanta unirebbe: risposta 409', { ...traccia, coppie: coppie.map(([a, b]) => [a.guidId, b.guidId]), ...durata() });
        res.status(HttpStatusCode.CONFLICT).json({ esito: false, content: null, error: motivo });
      };
      const rifiutaAvvioProxy = (titoli: Array<string | undefined>) => {
        log.warn('Avvio di un design proxy intero: risposta 400', { ...traccia, titoli, ...durata() });
        res.status(HttpStatusCode.BAD_REQUEST).json({ esito: false, content: null, error: MESSAGGIO_AVVIO_PROXY });
      };

      if (data.id != undefined) {
        let resultDesignKit = await this.designKitService.getCombinazioneDesignById(data.id) as DESIGN_KIT | undefined;
        // Un id che non e' un design puo' essere quello di un pezzo: il design proxy sul canale e l'area del membro
        let pezzo = false;
        if (resultDesignKit == undefined) {
          const trovato = await trovaPezzo(data.id);
          const design = trovato ? await this.designKitService.getCombinazioneDesignById(trovato.idDesign) as DESIGN_KIT | undefined : undefined;
          if (trovato && design) {
            const perPezzo = { ...(conProxy ? contesto : await contestoPezzi()), attive: new Set([chiaveCoppia(trovato.idCanale, trovato.idArea)]) };
            resultDesignKit = pezziPerIstanta([design], perPezzo)[0] as unknown as DESIGN_KIT;
            pezzo = true;
          }
        }
        if (resultDesignKit == undefined) {
          log.warn('Design non trovato: risposta 404', { ...traccia, id: data.id, ...durata() });
          res.status(HttpStatusCode.NOT_FOUND).json({ esito: false, content: null, error: "Kit runtime non trovato" });
          return;
        }
        const idDesign = pezzo ? (resultDesignKit as DESIGN_KIT & { guidIdDesign: string }).guidIdDesign : resultDesignKit.guidId;
        log.info(pezzo ? 'Pezzo di un design proxy trovato' : 'Design trovato', { ...traccia, ...riassuntoDesign(resultDesignKit), ...(pezzo ? { idDesign } : {}) });
        if (data.lettura == false) {
          if (data.idPromo == undefined) {
            log.warn('idPromo mancante: risposta 400', { ...traccia, ...durata() });
            res.status(HttpStatusCode.BAD_REQUEST).json({ esito: false, content: null, error: "Id promo mancante" });
            return;
          }
          if (!pezzo && eSuProxy(resultDesignKit, conProxy ? contesto.proxy : await caricaProxy())) {
            rifiutaAvvioProxy([resultDesignKit.titolo]);
            return;
          }
          if (conProxy) {
            const nuovo: KitConfrontabile = { ...resultDesignKit, guidId: `nuovo:${resultDesignKit.guidId}`, pezzo };
            const altri = (await kitDellaPromo(data.idPromo)).filter(k => k.guidIdDesign !== idDesign);
            const coppie = kitConfusiDaIstanta([nuovo, ...altri]).filter(([a, b]) => a === nuovo || b === nuovo);
            if (coppie.length > 0) {
              rifiutaKitConfusi(coppie);
              return;
            }
          }
          const kitPerPromo = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(data.idPromo)
          // getAllKitRuntimeByIdPromo conta solo i runtime con formato di tipo lavorazione 2
          log.info('Runtime gia presenti nella promo', { ...traccia, idPromo: data.idPromo, runtime: kitPerPromo.length });
          const guidIdNuovo = uuidv4();
          const resultInizioLavorazionePerIstanta = await this.kitRuntimeService.createKitRunTime({
            ...resultDesignKit,
            guidId: guidIdNuovo,
            idPromo: data.idPromo as string,
            guidIdDesign: idDesign,
            stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
            filtroContesto: resultDesignKit.filtroContesto || [],
            inizioLavorazione: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }, { perCombinazione: pezzo });
          // createKitRunTime restituisce il runtime gia esistente per design e promo (per un pezzo: anche canale e area), se c'e
          log.info(resultInizioLavorazionePerIstanta.guidId === guidIdNuovo ? 'Runtime creato' : 'Runtime gia esistente per design e promo: restituito quello', {
            ...traccia,
            idRuntime: resultInizioLavorazionePerIstanta.guidId,
            idDesign,
            idPromo: data.idPromo,
            statoLavorazione: resultInizioLavorazionePerIstanta.stato_lavorazione,
          });
          log.info('Attivita di creazione registrata', { ...traccia, autore: req.session.id_utente ?? 'sistema' });
          const datiAttivita = {
            titolo: resultDesignKit.titolo,
            guidId: idDesign,
            guidIdFormato: resultDesignKit.guidFormato,
            guidIdCanale: resultDesignKit.guidCanale,
            guidIdArea: resultDesignKit.guidArea,
            guidIdPv: resultDesignKit.guidPv ?? "",
            quantita: resultDesignKit.quantitaCopie,
            tipo: resultDesignKit.tipo,
            idPromo: data.idPromo as string
          };
          if (req.session.id_utente != undefined) {
            ServerUtils.CREA_ATTIVITA(
              req.session.id_utente as string,
              TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO,
              CATEGORIA_ATTIVITA.PRODUZIONE,
              datiAttivita).catch(error => log.warn('Attivita di creazione runtime non registrata', { ...traccia, error }))
          } else {
            //FIXME attenzione cambiato da "System" a null perché il DB crashava
            ServerUtils.CREA_ATTIVITA(
              null,
              TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO,
              CATEGORIA_ATTIVITA.PRODUZIONE,
              datiAttivita).catch(error => log.warn('Attivita di creazione runtime non registrata', { ...traccia, error }))
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
            log.info('Primo runtime della promo: promo passata a IN_LAVORAZIONE', { ...traccia, idPromo: data.idPromo });
          }
          log.info('Risposta inviata', { ...traccia, esito: 'runtime', runtime: 1, ...durata() });
          res.status(HttpStatusCode.OK).json({ esito: true, content: [resultInizioLavorazionePerIstanta], error: "" });
          return;
        } else {
          // Istanta che legge un design proxy per id lo riceve diviso in pezzi
          const content = conProxy && !pezzo ? pezziPerIstanta([resultDesignKit], contesto) : [resultDesignKit];
          log.info('Sola lettura: restituito il design', { ...traccia, pezzi: pezzo ? 1 : content.length, ...durata() });
          res.status(HttpStatusCode.OK).json({ esito: true, content, error: "" });
          return;
        }
      }
      const dataPerQuery = {
        ..._.omit(data, ["lettura"]),
        ...(conProxy && data.idCanale ? { idCanale: vociRichieste(data.idCanale, contesto.proxy.canali) } : {}),
        ...(conProxy && data.idArea ? { idArea: vociRichieste(data.idArea, contesto.proxy.aree) } : {}),
      };
      const trovati = await this.kitRuntimeService.getAllKitByAreaCanalePV(dataPerQuery, traccia);
      const result = conProxy ? pezziPerIstanta(trovati as DESIGN_KIT[], contesto) as Array<DESIGN_KIT & { guidIdDesign?: string; pezzo?: true }> : trovati;
      if (conProxy) {
        // Con la creazione contano anche i kit gia' nella promo, salvo quelli degli stessi design
        const design = new Set(result.map((k: DESIGN_KIT & { guidIdDesign?: string }) => k.guidIdDesign ?? k.guidId));
        const giaNellaPromo = data.lettura == false && data.idPromo
          ? (await kitDellaPromo(data.idPromo)).filter(k => !design.has(k.guidIdDesign ?? ''))
          : [];
        const coppie = kitConfusiDaIstanta([...(result as KitConfrontabile[]), ...giaNellaPromo]);
        if (coppie.length > 0) {
          rifiutaKitConfusi(coppie);
          return;
        }
      }
      if (data.lettura == false) {
        if (data.idPromo == undefined) {
          log.warn('idPromo mancante: i runtime vengono cercati e creati senza promo', traccia);
        }
        // Fuori da Istanta un design proxy non si avvia intero
        const proxyNoti = conProxy ? NESSUN_PROXY : await caricaProxy();
        const interi = result.filter((k: DESIGN_KIT) => eSuProxy(k, proxyNoti));
        if (interi.length > 0) {
          rifiutaAvvioProxy(interi.map((k: DESIGN_KIT) => k.titolo));
          return;
        }
        for (const singleKit of result) {
          singleKit.idPromo = data.idPromo;
        }
        // Per bulkCreateRuntime guidId e' il design: per un pezzo quello del design proxy
        const resultInizioLavorazionePerIstanta = await this.kitRuntimeService.bulkCreateRuntime(result.map((singleKit: DESIGN_KIT & { guidIdDesign?: string }) => ({
          ...singleKit,
          guidId: singleKit.guidIdDesign ?? singleKit.guidId,
          idPromo: data.idPromo,
        })) as (DESIGN_KIT & { idPromo: string; pezzo?: boolean })[], traccia)

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
          log.info('Attivita di creazione registrata', { ...traccia, autore: req.session.id_utente });
        } else {
          log.info('Attivita di creazione non registrata: chiamata senza utente', traccia);
        }

        log.info('Risposta inviata', { ...traccia, esito: 'runtime', runtime: resultInizioLavorazionePerIstanta.length, ...durata() });
        res.status(HttpStatusCode.OK).json({ esito: true, content: resultInizioLavorazionePerIstanta, error: "" });
        return;
      } else {
        log.info('Sola lettura: restituite le combinazioni', { ...traccia, combinazioni: result.length, ...durata() });
        res.status(HttpStatusCode.OK).json({ error: "", esito: true, content: result });
      }
    } catch (error: any) {
      log.error('Richiesta fallita', error, { ...traccia, ...parametri, ...durata() });
      this.handleError(res, error);
    }
  }




  private async mettiInStatoDiEliminazione(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const result = await this.kitRuntimeService.mettiInStatoDiEliminazione(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaKitRuntime(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const result = await this.kitRuntimeService.eliminaKitRuntime(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async eliminaFileKitRuntime(req: Request<{ id: string }>, res: Response): Promise<void> {
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

  private async getKitRuntimeByPromo(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
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

  /**
   * I20-1271: GET /api/getAreeKitByPromo?idPromo=<id>,<id>,... -> { aree: { <id>: ["A", ...] } }.
   * Gli id si possono anche ripetere (?idPromo=a&idPromo=b). Al massimo MAX_PROMO_AREE promo per chiamata.
   */
  private async getAreeKitByPromo(req: Request, res: Response): Promise<void> {
    try {
      const grezzi = ([] as unknown[]).concat(req.query.idPromo ?? []);
      const idPromo = grezzi
        .flatMap(v => typeof v === 'string' ? v.split(',') : [])
        .map(v => v.trim())
        .filter(Boolean);
      if (idPromo.length > MAX_PROMO_AREE) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: `Al massimo ${MAX_PROMO_AREE} promo per richiesta` });
        return;
      }
      const aree = await this.kitRuntimeService.getAreeKitByPromo(idPromo);
      res.status(HttpStatusCode.OK).json({ aree });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllKitRuntimeByPromo(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
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

  private async clearAllFilesKitRuntime(req: Request<{ idKitRuntime: string; guidIdExport: string }>, res: Response): Promise<void> {
    try {
      const { idKitRuntime, guidIdExport } = req.params;
      await this.kitRuntimeService.clearAllFilesKitRuntime(idKitRuntime, guidIdExport)
      res.status(HttpStatusCode.OK).json({ message: "File eliminati con successo" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getFilesPerGestioneLavorazione(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    try {
      const idKit = req.params.idKit;
      const result = await this.kitRuntimeService.getFilesPerGestioneLavorazione(idKit, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
