import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import { ExternalApiError } from '../../../lib/errors';
import type { IAgenziaLib } from '../agenzia_lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { uploadSpreadsheet } from '../config/multerConfig';
import type { CreatePuntoVenditaDTO, ImportPuntiVenditaResponseDTO } from '../dto';
import { IGdoService } from '../interfaces/IGdoService';
import { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { importPuntiVenditaGenerico, leggiFoglio, preparaImportPuntiVendita } from '../services/importPuntiVendita';
import { ServerUtils } from '../utils/ServerUtils';
import { verificaRisposta } from '../utils/rispostaServizi';

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

export class PuntoVenditaController extends BaseController {
  constructor(private puntoVenditaService: IPuntoVenditaService, private gdoService: IGdoService, private agenziaLib: IAgenziaLib) {
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
    this.router.get('/getAllPVFromIdGDO', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPVFromIdGDO.bind(this));
    this.router.get('/getAllPVFromIdGDO_paginated', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPVFromIdGDOPaginated.bind(this));
    this.router.get('/getAllPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPV.bind(this));
    this.router.get("/get_pv_by_id", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getPvById.bind(this))
    this.router.get("/get_all_punti_lat_lon_pv", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getAllPuntiLatLonPV.bind(this))

    // DISPOSITIVI PUNTO VENDITA
    this.router.get("/dispositivi", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getDispositiviPuntoVendita.bind(this))
    this.router.get("/dispositivo/:id", authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.getSingoloDispositivoPuntoVendita.bind(this))
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
        error: error
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
        error: error
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
        error: error
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
        error: error
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
        error: error
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
        error: error
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
        error: error
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
        : await this.salvaSuIstantaEFp(req, id, dati, isUpdate);

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
   * tutti i PV nuovi), poi FP con lo stesso GUID. Se Istanta rifiuta, FP non viene toccato.
   */
  private async salvaSuIstantaEFp(req: Request, id: string, dati: CreatePuntoVenditaDTO, aggiorna: boolean) {
    verificaRisposta(
      await ServerUtils.sendToFICOApi(req, config.ISTANTA_IP_ADDRESS + '/ACPV/salvaPV', 'PUT', {
        guidID: id,
        nome: dati.nome,
        indirizzo: dati.indirizzo,
        citta: dati.citta,
        cap: dati.cap,
        lat: dati.lat ?? 0,
        lon: dati.lon ?? 0,
        guidIDCombinazione: dati.id_combinazione_canale_area,
        idGDO: dati.id_gdo,
      }),
      'ISTANTA',
      '/ACPV/salvaPV'
    );
    return this.scriviInFp(id, dati, aggiorna);
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
            error: error
          });
          return;
        }
      }

      verificaRisposta(
        await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          config.ISTANTA_IP_ADDRESS + '/ACPV/eliminaPV/' + guidID,
          'DELETE',
          undefined
        ),
        'ISTANTA',
        '/ACPV/eliminaPV'
      );

      const resultPuntoVenditaEliminato = await this.puntoVenditaService.deletePuntoVendita(guidID);
      this.sendResponse(res, HttpStatusCode.OK, resultPuntoVenditaEliminato);
    } catch (error: any) {
      if (error instanceof ExternalApiError) return this.handleError(res, error);
      error = JSON.stringify(error);
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'eliminazione del punto vendita"
      });
    }
  }

  /**
   * Import dei PV da Excel col tracciato della libreria agenzia (o quello generico).
   * Con ?anteprima=true dice cosa farebbe di ogni riga senza scrivere; altrimenti scrive
   * riga per riga, prima su Istanta e poi in FP, con lo stesso GUID nei due sistemi.
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

      const esiti = preparaImportPuntiVendita(
        leggiFoglio(req.file.buffer),
        this.agenziaLib.importPuntiVendita ?? importPuntiVenditaGenerico,
        await this.puntoVenditaService.getContestoImport(idGdo),
        idGdo
      );
      if (req.query.anteprima === 'true') {
        this.sendResponse(res, HttpStatusCode.OK, { righe: esiti });
        return;
      }

      const risultato: ImportPuntiVenditaResponseDTO = { total_imported: 0, total_updated: 0, total_skipped: 0, errors: [] };
      // ponytail: una chiamata a Istanta per riga, in sequenza; job asincrono se i file diventano di migliaia di righe
      for (const esito of esiti) {
        if (esito.azione === 'scarta') {
          risultato.total_skipped++;
          risultato.errors.push({ row: esito.riga, error: esito.errore });
          continue;
        }
        try {
          await this.salvaSuIstantaEFp(req, esito.id ?? randomUUID(), esito.dati, Boolean(esito.id));
          if (esito.id) risultato.total_updated++;
          else risultato.total_imported++;
        } catch (error) {
          log.error('importaPV - riga non importata', { riga: esito.riga, error });
          risultato.total_skipped++;
          risultato.errors.push({ row: esito.riga, error: error instanceof Error ? error.message : String(error) });
        }
      }
      log.info('importaPV - completato', { idGdo, ...risultato, errors: risultato.errors.length });
      this.sendResponse(res, HttpStatusCode.OK, risultato);
    } catch (error) {
      this.handleError(res, error);
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
        error: error
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
        error: error
      });
    }
  }

  private async getAllPV(req: Request, res: Response): Promise<void> {
    try {
      let idGDO = req.query.IdGDO as string;
      if (idGDO == undefined) {
        idGDO = req.session.id_gdo!
      }
      const result = await this.puntoVenditaService.getAllPuntiVenditaFromIdGDO(idGDO);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error: any) {
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante il recupero dei punti vendita",
        error: error
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
        error: error
      });
    }
  }
}
