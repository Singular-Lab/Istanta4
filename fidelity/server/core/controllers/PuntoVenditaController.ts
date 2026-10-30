import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import { ExternalApiError } from '../../../lib/errors';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { BaseController } from '../base/BaseController';
import { uploadSpreadsheet } from '../config/multerConfig';
import { sequelize } from '../db/SequelizeConnector';
import type { CreatePuntoVenditaDTO, IndirizzoTrovatoDTO, StatoImportPuntiVenditaDTO } from '../dto';
import { IGdoService } from '../interfaces/IGdoService';
import { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import { gdoOperativaPerRichiesta } from '../accessi/contestoAccesso';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { routeDeprecata } from '../middleware/routeDeprecata';
import { permissionGuard } from '../middleware/permissionGuard';
import {
  DecisioneNonApplicabile,
  eventoImportPuntiVendita,
  GestoreImportPuntiVendita,
  ImportGiaInCorso,
  importPuntiVenditaJobs,
  type ScritturaRigaImport,
} from '../services/ImportPuntiVenditaJob';
import { importPuntiVenditaGenerico, preparaImportPuntiVendita, righeDaImportare } from '../services/importPuntiVendita';
import { ServerUtils } from '../utils/ServerUtils';
import { roomUtente } from '../utils/socketRooms';
import { emitToClients } from '../../ws-server';
import { cercaIndirizzi } from '../utils/geocodifica';
import { scriviSuIstanta } from '../utils/istanta';

/** Il body del form Punti Vendita (salvaPV e modificaPV), e delle chiamate interne. */
type FormPuntoVendita = {
  guidID?: string;
  idGDO?: string;
  guidIDCombinazione: string;
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  lat?: number | null;
  lon?: number | null;
  ragioneSociale?: string;
  provincia?: string;
  regione?: string;
  telefono?: string;
};

// Un campo lasciato vuoto non si scrive: il modello rifiuterebbe provincia o telefono vuoti
const testo = (valore?: string) => valore?.trim() || undefined;
const coordinata = (valore: unknown) => (typeof valore === 'number' && Number.isFinite(valore) ? valore : undefined);

function datiDaForm(body: FormPuntoVendita, idGdo: string): CreatePuntoVenditaDTO {
  return {
    nome: body.nome,
    indirizzo: body.indirizzo,
    citta: body.citta,
    cap: body.cap,
    id_combinazione_canale_area: body.guidIDCombinazione,
    id_gdo: idGdo,
    ragionesociale: testo(body.ragioneSociale),
    provincia: testo(body.provincia),
    regione: testo(body.regione),
    telefono: testo(body.telefono),
    lat: coordinata(body.lat),
    lon: coordinata(body.lon),
  };
}

/** Ricerca Nominatim di un PV importato: via e civico, CAP e citta, provincia. */
const queryIndirizzo = (dati: Pick<CreatePuntoVenditaDTO, 'indirizzo' | 'cap' | 'citta' | 'provincia'>) =>
  [dati.indirizzo, [dati.cap, dati.citta].filter(Boolean).join(' '), dati.provincia].filter(Boolean).join(', ');

/** Dopo un import la view delle combinazioni conta i nuovi PV; se non riesce i PV restano comunque. */
async function aggiornaVistaCombinazioni(): Promise<void> {
  try {
    await sequelize.query('SELECT refresh_mv_combinazioni()');
  } catch (error) {
    log.warn('Punti vendita importati, ma aggiornamento della view combinazioni non riuscito', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export class PuntoVenditaController extends BaseController {
  constructor(
    private puntoVenditaService: IPuntoVenditaService,
    private gdoService: IGdoService,
    private agenziaLib: IAgenziaLib,
    private importJobs: GestoreImportPuntiVendita = importPuntiVenditaJobs,
    private emetti: (evento: string, dati: unknown, room: string) => void = emitToClients,
    private aggiornaVista: () => Promise<void> = aggiornaVistaCombinazioni,
    private cerca: (query: string, limite?: number) => Promise<IndirizzoTrovatoDTO[]> = cercaIndirizzi
  ) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    this.router.put('/ACPV/salvaPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.salvaPuntoVendita.bind(this));
    this.router.delete('/ACPV/eliminaPV/:guidID', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.eliminaPV.bind(this));
    this.router.put('/ACPV/modificaPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.salvaPuntoVendita.bind(this));
    this.router.post('/ACPV/importaPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), uploadSpreadsheet.single('file'), this.importaPV.bind(this));
    this.router.get('/ACPV/importaPV/stato', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.statoImportPV.bind(this));
    this.router.post('/ACPV/importaPV/:jobId/annulla', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.annullaImportPV.bind(this));
    this.router.post('/ACPV/importaPV/:jobId/decisione', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.decisioneImportPV.bind(this));
    this.router.get('/ACPV/geocodifica/cerca', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.cercaIndirizzo.bind(this));
    this.router.get('/getAllPVFromIdGDO', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPVFromIdGDO.bind(this));
    this.router.get('/getAllPVFromIdGDO_paginated', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), routeDeprecata, this.getAllPVFromIdGDOPaginated.bind(this));
    this.router.get('/getAllPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPV.bind(this));
    this.router.get("/get_pv_by_id", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getPvById.bind(this))
    // I volantini attivi del punto vendita sono nella consultazione (ConsultazionePuntiVenditaController)
    this.router.get("/get_all_punti_lat_lon_pv", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPuntiLatLonPV.bind(this))

    // DISPOSITIVI PUNTO VENDITA
    this.router.get("/dispositivi", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getDispositiviPuntoVendita.bind(this))
    this.router.get("/dispositivo/:id", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), routeDeprecata, this.getSingoloDispositivoPuntoVendita.bind(this))
    this.router.post("/dispositivi", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.createDispositivo.bind(this))
    this.router.put("/dispositivi/:id", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.updateDispositivo.bind(this))
    this.router.delete("/dispositivi/:id", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.deleteDispositivo.bind(this))
    this.router.post("/dispositivi/:id/regenerate-token", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.regenerateToken.bind(this))
    this.router.post("/dispositivi/heartbeat", this.deviceHeartbeat.bind(this))
  }

  /* ======================================================
   * DISPOSITIVI PUNTO VENDITA
   * ====================================================== */

  private async getDispositiviPuntoVendita(req: Request, res: Response): Promise<void> {
    try {
      const idPuntoVendita = req.query.idPuntoVendita as string;
      if (!ServerUtils.checkIfValueIsValid(idPuntoVendita)) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
          message: "Parametro idPuntoVendita mancante",
          error: "idPuntoVendita is required"
        });
        return;
      }
      const resultDispositivi = await this.puntoVenditaService.getAllDispositiviPuntoVendita(idPuntoVendita);
      this.sendResponse(res, HttpStatusCode.OK, resultDispositivi);
    } catch (error: any) {
      log.error('Get dispositivi punto vendita error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante la richiesta dei dispositivi per il punto vendita",
        error
      });
    }
  }

  private async getSingoloDispositivoPuntoVendita(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const dispositivo = await this.puntoVenditaService.getDispositivoById(id);
      if (!dispositivo) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, {
          message: "Dispositivo non trovato"
        });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, dispositivo);
    } catch (error: any) {
      log.error('Get dispositivo punto vendita error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante la richiesta del dispositivo per il punto vendita",
        error
      });
    }
  }

  private async createDispositivo(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (
        !ServerUtils.checkIfValueIsValid(data?.nome) ||
        !ServerUtils.checkIfValueIsValid(data?.id_puntivendita) ||
        !ServerUtils.checkIfValueIsValid(data?.secret_dispositivo)
      ) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
          message: "Campi obbligatori mancanti: nome, id_puntivendita, secret_dispositivo"
        });
        return;
      }
      const dispositivo = await this.puntoVenditaService.createDispositivo(data);
      this.sendResponse(res, HttpStatusCode.CREATED, dispositivo);
    } catch (error: any) {
      log.error('Create dispositivo error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante la creazione del dispositivo",
        error
      });
    }
  }

  private async updateDispositivo(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const result = await this.puntoVenditaService.updateDispositivo(id, req.body);
      if (!result) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Dispositivo non trovato" });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      log.error('Update dispositivo error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'aggiornamento del dispositivo",
        error
      });
    }
  }

  private async deleteDispositivo(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const deleted = await this.puntoVenditaService.deleteDispositivo(id);
      if (!deleted) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Dispositivo non trovato" });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { message: "Dispositivo eliminato" });
    } catch (error: any) {
      log.error('Delete dispositivo error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'eliminazione del dispositivo",
        error
      });
    }
  }

  private async regenerateToken(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const newToken = await this.puntoVenditaService.regenerateDeviceToken(id);
      if (!newToken) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Dispositivo non trovato" });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { token_display: newToken });
    } catch (error: any) {
      log.error('Regenerate token error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante la rigenerazione del token",
        error
      });
    }
  }

  private async deviceHeartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { token, metadata } = req.body;
      if (!ServerUtils.checkIfValueIsValid(token)) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Token mancante" });
        return;
      }
      const success = await this.puntoVenditaService.deviceHeartbeat(token, metadata);
      if (!success) {
        this.sendResponse(res, HttpStatusCode.UNAUTHORIZED, { message: "Token non valido" });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, { message: "OK" });
    } catch (error: any) {
      log.error('Device heartbeat error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'heartbeat",
        error
      });
    }
  }

  /**
   * Crea (guidID vuoto) o modifica un PV dal form: salvaPV e modificaPV fanno la stessa cosa.
   * Dall'interfaccia scrive prima su Istanta e poi in FP con lo stesso GUID; una chiamata
   * interna (header Authorization) scrive solo in FP.
   */
  private async salvaPuntoVendita(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as FormPuntoVendita;
      const interna = Boolean(req.headers['authorization']);
      const idGdo = await this.gdoDellaRichiesta(req, body.idGDO, interna);
      if (!idGdo) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'GDO non specificata' });
        return;
      }

      const isUpdate = Boolean(body.guidID);
      const id = body.guidID || randomUUID();
      const dati = datiDaForm(body, idGdo);
      const data = interna
        ? await this.scriviInFp(id, dati, isUpdate)
        : (await this.salvaSuIstantaEFp(req, id, dati, isUpdate)).data;

      log.info(`salvaPuntoVendita - punto vendita ${isUpdate ? 'aggiornato' : 'creato'}`, { id, idGdo, interna });
      this.sendResponse(res, isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED, {
        esito: true,
        error: '',
        message: isUpdate ? 'Punto vendita aggiornato con successo' : 'Punto vendita creato con successo',
        isUpdate,
        data,
      });
    } catch (error) {
      if (error instanceof ExternalApiError) return this.handleError(res, error);
      log.error('salvaPuntoVendita - Error', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: 'Errore durante il salvataggio del punto vendita',
      });
    }
  }

  /** GDO su cui si opera: quella della sessione; Superadmin e Agenzia possono indicarne un'altra (ruoli-permessi). */
  private async gdoDellaRichiesta(req: Request, indicata: string | undefined, interna: boolean): Promise<string | undefined> {
    const tipo = req.session.tipo_utente;
    if (indicata && (interna || tipo === TIPO_UTENTI.SUPERADMIN || tipo === TIPO_UTENTI.AGENZIA)) return indicata;
    return (await this.gdoService.getGDOByUtenteId(req.session.id_utente as string))?.id;
  }

  /**
   * Istanta crea o aggiorna per guidID (non lo genera: un GUID vuoto farebbe coincidere
   * tutti i PV nuovi), poi FP con lo stesso GUID. Se Istanta rifiuta, FP non viene toccato;
   * in development, se Istanta non risponde, il PV resta solo in FP (sincronizzato false).
   */
  private async salvaSuIstantaEFp(req: Request, id: string, dati: CreatePuntoVenditaDTO, aggiorna: boolean) {
    const { sincronizzato } = await scriviSuIstanta(req, '/ACPV/salvaPV', 'PUT', {
      guidID: id,
      nome: dati.nome,
      indirizzo: dati.indirizzo,
      citta: dati.citta,
      cap: dati.cap,
      lat: dati.lat ?? 0,
      lon: dati.lon ?? 0,
      guidIDCombinazione: dati.id_combinazione_canale_area,
      idGDO: dati.id_gdo,
    });
    return { data: await this.scriviInFp(id, dati, aggiorna), sincronizzato };
  }

  /** Aggiorna il PV o, se in FP non c'e ancora, lo crea con quel GUID: come fa Istanta. */
  private async scriviInFp(id: string, dati: CreatePuntoVenditaDTO, aggiorna: boolean) {
    const aggiornato = aggiorna ? await this.puntoVenditaService.updatePuntoVendita(id, dati) : null;
    return aggiornato ?? this.puntoVenditaService.createPuntoVendita({ ...dati, id });
  }

  private async eliminaPV(req: Request<{ guidID: string }>, res: Response): Promise<void> {
    try {
      const guidID = req.params.guidID;

      if (req.headers['authorization']) {
        try {
          const result = await this.puntoVenditaService.deletePuntoVendita(guidID);
          this.sendResponse(res, HttpStatusCode.OK, {
            esito: result,
            error: ""
          });
          return;
        } catch (error) {
          this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
            message: "Errore durante l'eliminazione del punto vendita",
            error
          });
          return;
        }
      }

      await scriviSuIstanta(req, `/ACPV/eliminaPV/${guidID}`, 'DELETE', undefined);

      const resultPuntoVenditaEliminato = await this.puntoVenditaService.deletePuntoVendita(guidID);
      this.sendResponse(res, HttpStatusCode.OK, resultPuntoVenditaEliminato);
    } catch (error: any) {
      if (error instanceof ExternalApiError) return this.handleError(res, error);
      log.error("Errore durante l'eliminazione del punto vendita", error);
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'eliminazione del punto vendita"
      });
    }
  }

  /**
   * Import dei PV da Excel col tracciato della libreria agenzia (o quello generico).
   * Con ?anteprima=true dice cosa farebbe di ogni riga, con il punteggio di affidabilita,
   * senza scrivere. Altrimenti avvia l'import in background e risponde subito con il jobId:
   * l'avanzamento arriva via socket (importPV_<jobId>_progress/_complete) all'utente che l'ha avviato.
   * Sulla riga ambigua l'import si ferma (stato in_attesa) finche l'utente non la decide.
   */
  private async importaPV(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'Nessun file caricato' });
        return;
      }
      // La GDO e sempre quella della sessione, mai una indicata nella richiesta
      const idGdo = await this.gdoDellaRichiesta(req, undefined, false);
      if (!idGdo) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'GDO non specificata' });
        return;
      }

      const importer = this.agenziaLib.importPuntiVendita ?? importPuntiVenditaGenerico;
      const esiti = preparaImportPuntiVendita(
        righeDaImportare(req.file.buffer, importer),
        importer,
        await this.puntoVenditaService.getContestoImport(idGdo),
        idGdo
      );
      if (req.query.anteprima === 'true') {
        this.sendResponse(res, HttpStatusCode.OK, { righe: esiti });
        return;
      }

      const idUtente = req.session.id_utente as string;
      // Il controllo "un import per GDO" e atomico nel registro dei lavori, valido fra tutti i worker
      const { stato } = await this.importJobs.avvia(idGdo, idUtente, esiti, {
        scrivi: this.scritturaRigaImport(req),
        geocodifica: async dati => {
          const [trovato] = await this.cerca(queryIndirizzo(dati), 1);
          return trovato && { lat: trovato.lat, lon: trovato.lon };
        },
        notifica: (evento, statoJob) => this.emetti(eventoImportPuntiVendita(statoJob.jobId, evento), statoJob, roomUtente(idUtente)),
        alTermine: () => this.aggiornaVista(),
      });
      log.info('importaPV - avviato', { idGdo, jobId: stato.jobId, righe: esiti.length });
      this.sendResponse(res, HttpStatusCode.ACCEPTED, { jobId: stato.jobId, stato });
    } catch (error) {
      if (error instanceof ImportGiaInCorso) {
        this.sendResponse(res, HttpStatusCode.CONFLICT, { message: error.message, stato: error.stato });
        return;
      }
      this.handleError(res, error);
    }
  }

  /** Scrive una riga dell'import su Istanta e FP con la sessione della richiesta che la elabora. */
  private scritturaRigaImport(req: Request): ScritturaRigaImport {
    return async esito => ({
      sincronizzato: (await this.salvaSuIstantaEFp(req, esito.id ?? randomUUID(), esito.dati, Boolean(esito.id))).sincronizzato,
    });
  }

  /** Stato di un import (?jobId=) o, senza jobId, quello in corso sulla GDO o l'ultimo dell'utente. */
  private async statoImportPV(req: Request, res: Response): Promise<void> {
    try {
      const idUtente = req.session.id_utente as string;
      const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : undefined;
      let stato: StatoImportPuntiVenditaDTO | undefined;
      if (jobId) {
        stato = await this.importJobs.stato(jobId, idUtente);
      } else {
        const idGdo = await this.gdoDellaRichiesta(req, undefined, false);
        stato = (idGdo && (await this.importJobs.inCorso(idGdo))) || (await this.importJobs.ultimo(idUtente));
      }
      this.sendResponse(res, HttpStatusCode.OK, { stato: stato ?? null });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Ferma l'import dopo la riga in corso: le righe gia scritte restano, le altre non si elaborano. */
  private async annullaImportPV(req: Request<{ jobId: string }>, res: Response): Promise<void> {
    try {
      const stato = await this.importJobs.annulla(req.params.jobId, req.session.id_utente as string);
      if (!stato) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Import non trovato' });
        return;
      }
      log.info('importaPV - annullamento richiesto', { jobId: req.params.jobId });
      this.sendResponse(res, HttpStatusCode.OK, { stato });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Decisione dell'utente sulla riga su cui l'import e fermo: inserirla con i dati confermati
   * nel modale (prima su Istanta e poi in FP, con le chiavi del cliente lette dal file nei meta),
   * oppure scartarla. Poi l'import riprende. Se Istanta rifiuta, la riga resta in attesa.
   * La richiesta puo arrivare a un worker diverso da quello che esegue l'import: la riga la scrive
   * questo worker, cosi l'errore di Istanta arriva nella risposta, e l'import riparte dal registro.
   */
  private async decisioneImportPV(req: Request<{ jobId: string }>, res: Response): Promise<void> {
    try {
      const idUtente = req.session.id_utente as string;
      const body = (req.body ?? {}) as { azione?: string } & Partial<FormPuntoVendita>;
      const stato = await this.importJobs.stato(req.params.jobId, idUtente);
      const riga = stato?.rigaInAttesa;
      if (!stato) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: 'Import non trovato' });
        return;
      }
      if (body.azione === 'scarta') {
        this.sendResponse(res, HttpStatusCode.OK, { stato: await this.importJobs.decidi(req.params.jobId, idUtente, { azione: 'scarta' }) });
        return;
      }
      if (body.azione !== 'inserisci' || !riga) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: !riga ? "L'import non e in attesa di una decisione" : 'Azione non valida' });
        return;
      }
      if (!body.guidIDCombinazione || !body.nome || !body.indirizzo || !body.citta || !/^\d{5}$/.test(body.cap ?? '')) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'Completare nome, indirizzo, citta, CAP, canale e area del punto vendita' });
        return;
      }
      const dati: CreatePuntoVenditaDTO = { ...datiDaForm(body as FormPuntoVendita, riga.dati.id_gdo), meta: riga.dati.meta };
      const nuovo = await this.importJobs.decidi(req.params.jobId, idUtente, { azione: 'inserisci', dati }, this.scritturaRigaImport(req));
      this.sendResponse(res, HttpStatusCode.OK, { stato: nuovo });
    } catch (error) {
      if (error instanceof DecisioneNonApplicabile) {
        this.sendResponse(res, HttpStatusCode.CONFLICT, { message: error.message });
        return;
      }
      if (error instanceof ExternalApiError) return this.handleError(res, error);
      log.error('decisioneImportPV - Error', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, { message: "Errore durante l'inserimento del punto vendita" });
    }
  }

  /** Indirizzi trovati da Nominatim per la ricerca ?q=, per confermare quello giusto sulla mappa. */
  private async cercaIndirizzo(req: Request, res: Response): Promise<void> {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 3) {
      this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Indicare l'indirizzo da cercare" });
      return;
    }
    try {
      this.sendResponse(res, HttpStatusCode.OK, { risultati: await this.cerca(query) });
    } catch (error) {
      log.warn('cercaIndirizzo - Nominatim non disponibile', { error: error instanceof Error ? error.message : String(error) });
      this.sendResponse(res, HttpStatusCode.SERVICE_UNAVAILABLE, {
        message: error instanceof Error ? error.message : 'Nominatim non disponibile, riprova tra poco',
      });
    }
  }

  private async getAllPVFromIdGDO(req: Request, res: Response): Promise<void> {
    try {
      const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
      if (gdo == undefined) {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Errore durante il recupero dei punti vendita",
          error: "Non è stato trovato nessun punto vendita"
        });
        return;
      }
      const result = await this.puntoVenditaService.getAllPuntiVenditaFromIdGDO(gdo?.id as string);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante il recupero dei punti vendita",
        error
      });
    }
  }

  private async getAllPVFromIdGDOPaginated(req: Request, res: Response): Promise<void> {
    try {
      const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
      if (gdo == undefined) {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Errore durante il recupero dei punti vendita",
          error: "GDO non trovato"
        });
        return;
      }

      const {
        page,
        pageSize,
        search,
        sortBy,
        sortDirection,
        hasCoordinate,
        idCombinazioneCanaleArea
      } = req.query;

      const result = await this.puntoVenditaService.getAllPuntiVenditaPaginated({
        idGDO: gdo.id as string,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        search: search as string,
        sortBy: sortBy as 'nome' | 'citta' | 'cap' | 'createdat',
        sortDirection: sortDirection as 'asc' | 'desc',
        hasCoordinate: hasCoordinate === 'true' ? true : hasCoordinate === 'false' ? false : undefined,
        idCombinazioneCanaleArea: idCombinazioneCanaleArea as string
      });

      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      log.error('Get punti vendita paginated error: ', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante il recupero paginato dei punti vendita",
        error
      });
    }
  }

  private async getAllPV(req: Request, res: Response): Promise<void> {
    try {
      // Superadmin e Agenzia scelgono la GDO; per gli altri vale quella della sessione (ruoli-permessi)
      const idGDO = await gdoOperativaPerRichiesta(req, res, req.query.IdGDO);
      if (!idGDO) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'GDO non specificata' });
        return;
      }
      const result = await this.puntoVenditaService.getAllPuntiVenditaFromIdGDO(idGDO);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante il recupero dei punti vendita",
        error
      });
    }
  }
  private async getPvById(req: Request, res: Response): Promise<void> {
    try {
      const idPv = req.query.idPv as string;
      const result = await this.puntoVenditaService.getPuntoVenditaById(idPv);
      this.sendResponse(res, HttpStatusCode.OK, result)
    } catch (error) {
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante il recupero del punto vendita"
      })
    }
  }

  private async getAllPuntiLatLonPV(req: Request, res: Response): Promise<void> {
    try {
      log.debug('getAllPuntiLatLonPV - Start', { sessionUser: req.session.id_utente });
      const id_utente = req.session.id_utente as string;
      const gdo = await this.gdoService.getGDOByUtenteId(id_utente);
      log.debug('getAllPuntiLatLonPV - GDO fetched', { gdo });
      if (gdo == undefined) {
        log.warn('getAllPuntiLatLonPV - No GDO found for user', { id_utente });
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Errore durante il recupero dei punti vendita con latitudine e longitudine",
          error: "Non è stato trovato nessun punto vendita"
        });
        return;
      }
      const result = await this.puntoVenditaService.getAllPuntiVenditaFromIdGDO(gdo.id as string);
      log.debug('getAllPuntiLatLonPV - PuntiVendita fetched', { count: result.length });
      const puntiLatLon: { lat: number, lon: number }[] = result
        .filter(pv => typeof pv.coordinate.lat === 'number' && typeof pv.coordinate.lon === 'number')
        .map(pv => ({ lat: pv.coordinate.lat as number, lon: pv.coordinate.lon as number }));
      log.debug('getAllPuntiLatLonPV - puntiLatLon computed', { puntiLatLon });

      this.sendResponse(res, HttpStatusCode.OK, puntiLatLon);
    } catch (error: any) {
      log.error('getAllPuntiLatLonPV - Error', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante il recupero dei punti vendita con latitudine e longitudine",
        error
      });
    }
  }
}
