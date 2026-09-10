import { Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { PuntiVenditaAttributes } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { IGdoService } from '../interfaces/IGdoService';
import { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';

export class PuntoVenditaController extends BaseController {
  constructor(private puntoVenditaService: IPuntoVenditaService, private gdoService: IGdoService) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    this.router.put('/ACPV/salvaPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.salvaPV.bind(this));
    this.router.delete('/ACPV/eliminaPV/:guidID', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.eliminaPV.bind(this));
    this.router.put('/ACPV/modificaPV', authMiddleware, permissionGuard('gdo.gestisci_punti_vendita'), this.modificaPV.bind(this));
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

  private async getSingoloDispositivoPuntoVendita(req: Request, res: Response): Promise<void> {
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

  private async updateDispositivo(req: Request, res: Response): Promise<void> {
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

  private async deleteDispositivo(req: Request, res: Response): Promise<void> {
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

  private async regenerateToken(req: Request, res: Response): Promise<void> {
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

  private async salvaPV(req: Request, res: Response): Promise<void> {
    try {
      log.info('salvaPV - Start', {
        body: req.body,
        sessionUser: req.session.id_utente
      });

      const data = req.body as {
        nome: string,
        idGDO: string,
        indirizzo: string,
        guidID: string,
        guidIDCombinazione: string,
        citta: string,
        cap: string,
        lat: number,
        lon: number,
        ragioneSociale: string,
        provincia: string,
        regione: string,
        telefono: string,
      };

      log.info('salvaPV - Extracted data', {
        nome: data.nome,
        idGDO: data.idGDO,
        guidID: data.guidID
      });

      if (!ServerUtils.checkIfValueIsValid(data.idGDO)) {
        log.info('salvaPV - No idGDO provided, fetching from current user');
        const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
        if (gdo) {
          data.idGDO = gdo.id as string;
          log.info('salvaPV - Using GDO from current user', { idGDO: data.idGDO });
        } else {
          log.warn('salvaPV - No GDO found for current user');
        }
      }

      // Controlla se la richiesta non è interna
      if (req.headers['authorization']) {
        log.info('salvaPV - Processing internal request with authorization');
        const puntoVenditaData: Partial<PuntiVenditaAttributes> = {
          id_puntivendita: data.guidID,
          nome_puntivendita: data.nome,
          indirizzo_puntivendita: data.indirizzo,
          id_combinazione_canale_area_puntivendita: data.guidIDCombinazione,
          citta_puntivendita: data.citta,
          cap_puntivendita: data.cap,
          lat_puntivendita: data.lat,
          lon_puntivendita: data.lon,
          id_gdo_puntivendita: data.idGDO
        };

        // Determina se è una creazione o un aggiornamento
        const isUpdate = data.guidID && data.guidID !== '';
        const resultPuntoVendita = isUpdate
          ? await this.puntoVenditaService.updatePuntoVendita(data.guidID, puntoVenditaData)
          : await this.puntoVenditaService.createPuntoVendita(puntoVenditaData);

        const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
        const message = isUpdate ? 'Punto vendita aggiornato con successo' : 'Punto vendita creato con successo';

        log.info(`salvaPV - PuntoVendita ${isUpdate ? 'updated' : 'created'} successfully`, { id: data.guidID });
        this.sendResponse(res, statusCode, {
          esito: true,
          error: "",
          message,
          isUpdate,
          data: resultPuntoVendita
        });
        return;
      }

      log.info('salvaPV - Sending request to FICO API');
      const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/ACPV/salvaPV',
        'PUT',
        data
      );

      if (!result.data.esito && result.data.error != "") {
        log.error('salvaPV - Error from FICO API', { error: result.data.error });
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Errore durante l'inserimento del punto vendita",
          error: result.data.error
        });
        return;
      }

      log.info('salvaPV - FICO API request successful, creating PuntoVendita locally');
      const puntoVenditaData: Partial<PuntiVenditaAttributes> = {
        id_puntivendita: data.guidID,
        nome_puntivendita: data.nome,
        indirizzo_puntivendita: data.indirizzo,
        id_combinazione_canale_area_puntivendita: data.guidIDCombinazione,
        citta_puntivendita: data.citta,
        cap_puntivendita: data.cap,
        lat_puntivendita: data.lat,
        lon_puntivendita: data.lon,
        id_gdo_puntivendita: data.idGDO
      };
      // Determina se è una creazione o un aggiornamento
      const isUpdate = data.guidID && data.guidID !== '';
      const resultPuntoVendita = isUpdate
        ? await this.puntoVenditaService.updatePuntoVendita(data.guidID, puntoVenditaData)
        : await this.puntoVenditaService.createPuntoVendita(puntoVenditaData);

      const statusCode = isUpdate ? HttpStatusCode.OK : HttpStatusCode.CREATED;
      const message = isUpdate ? 'Punto vendita aggiornato con successo' : 'Punto vendita creato con successo';

      log.info(`salvaPV - PuntoVendita ${isUpdate ? 'updated' : 'created'} successfully`, { id: data.guidID });
      this.sendResponse(res, statusCode, {
        ...resultPuntoVendita,
        message,
        isUpdate
      });
    } catch (error: any) {
      log.error('salvaPV - Error', { error });
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'inserimento del punto vendita",
        error: error
      });
    }
  }

  private async eliminaPV(req: Request, res: Response): Promise<void> {
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

      const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/ACPV/eliminaPV/' + guidID,
        'DELETE',
        undefined
      );

      if (!result.data.esito && result.data.error != "") {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Errore durante l'eliminazione del punto vendita",
          error: result.data.error
        });
        return;
      }

      const resultPuntoVenditaEliminato = await this.puntoVenditaService.deletePuntoVendita(guidID);
      this.sendResponse(res, HttpStatusCode.OK, resultPuntoVenditaEliminato);
    } catch (error: any) {
      error = JSON.stringify(error);
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante l'eliminazione del punto vendita"
      });
    }
  }

  private async modificaPV(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as {
        nome: string,
        indirizzo: string,
        guidID: string,
        guidIDCombinazione: string,
        citta: string,
        cap: string,
        lat: number,
        lon: number,
        idGDO: string
      };

      const gdo = await this.gdoService.getGDOByUtenteId(req.session.id_utente as string);
      if (gdo) {
        data.idGDO = gdo.id as string;
      }

      const puntoVenditaModificato: PuntiVenditaAttributes = {
        id_puntivendita: data.guidID,
        nome_puntivendita: data.nome,
        indirizzo_puntivendita: data.indirizzo,
        id_combinazione_canale_area_puntivendita: data.guidIDCombinazione,
        citta_puntivendita: data.citta,
        cap_puntivendita: data.cap,
        lat_puntivendita: data.lat,
        lon_puntivendita: data.lon,
        id_gdo_puntivendita: data.idGDO
      }

      if (req.headers['authorization']) {
        const resultPuntoVenditaModificato = await this.puntoVenditaService.updatePuntoVendita(data.guidID, puntoVenditaModificato);
        this.sendResponse(res, HttpStatusCode.OK, {
          esito: true,
          error: ""
        });
        return;
      }

      const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/ACPV/modificaPV',
        'PUT',
        data
      );

      if (!result.data.esito && result.data.error != "") {
        this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
          message: "Errore durante la modifica del punto vendita",
          error: result.data.error
        });
        return;
      }

      const resultPuntoVenditaModificato = await this.puntoVenditaService.updatePuntoVendita(data.guidID, puntoVenditaModificato);
      this.sendResponse(res, HttpStatusCode.OK, resultPuntoVenditaModificato);
    } catch (error: any) {
      this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, {
        message: "Errore durante la modifica del punto vendita",
        error: error
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
