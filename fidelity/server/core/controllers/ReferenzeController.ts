import dayjs from 'dayjs';
import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from "uuid";
import { EVENTI_WEBHOOK, HttpStatusCode, STATO_LOG_FILE } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { log } from '../logger';
import type { FileItemKitLog, OggettoTipiDiExport, ReferenzeIstanta } from '../../../lib/types';
import { dataConsultazioneConsentita, puoConfigurareWebpliant } from '../accessi/consultazioneWebpliant';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { TYPES, container } from '../di';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { IReferenzeService } from '../interfaces/IReferenzeService';
import type { IWebPliantService } from '../interfaces/IWebPliantService';
import type { IWebhookService } from '../interfaces/IWebhookService';
import { authMiddleware } from '../middleware/authMiddleware';
import { routeDeprecata } from '../middleware/routeDeprecata';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';
import { esitoIstanta, verificaRisposta } from '../utils/rispostaServizi';
import { TraduttoreReferenze } from '../utils/Translator';

export class ReferenzeController extends BaseController {

  /**
   * webPliantService serve solo alla scritta di validità dei caroselli: se non arriva dal
   * costruttore si prende dal container quando serve.
   */
  constructor(private referenzeService: IReferenzeService, private webPliantService?: IWebPliantService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    // Referenze CRUD (from PromoController)
    this.router.get('/getReferenzaByEAN', authMiddleware, permissionGuard('referenze.visualizza'), this.getReferenzaByEAN.bind(this));
    this.router.get('/allReferenze', authMiddleware, permissionGuard('referenze.visualizza'), this.getAllReferenze.bind(this));
    this.router.get('/getAllLoghiDaReferenze', authMiddleware, permissionGuard('referenze.visualizza'), this.getAllLoghiDaReferenze.bind(this));
    this.router.post('/creaContenutiAggiuntiviReferenza', authMiddleware, permissionGuard('referenze.crea_contenuti_aggiuntivi'), this.creaContenutiAggiuntiviReferenza.bind(this));
    this.router.put('/getContenutiAggiuntiviReferenza', authMiddleware, permissionGuard('referenze.visualizza'), this.getContenutiAggiuntiviReferenza.bind(this));
    this.router.get('/getAllContenutiAggiuntivi', authMiddleware, permissionGuard('referenze.visualizza'), this.getAllContenutiAggiuntivi.bind(this));
    this.router.post('/ricercaReferenzePromo', this.ricercaReferenzePromo.bind(this));
    this.router.get('/resolveImmaginiGruppo', authMiddleware, permissionGuard('referenze.visualizza'), routeDeprecata, this.resolveImmaginiGruppo.bind(this));
    this.router.post('/get_filtered_referenze', this.getFilteredReferenze.bind(this));

    // Referenze from ImpostazioniController
    this.router.get('/getReferenzaById', authMiddleware, permissionGuard('referenze.visualizza'), routeDeprecata, this.getReferenzaById.bind(this));
    this.router.get('/getReferenzaByCodice', authMiddleware, permissionGuard('referenze.visualizza'), this.getReferenzaByCodice.bind(this));
    this.router.put('/updateReferenzaWebpliant', authMiddleware, permissionGuard('referenze.modifica'), this.updateReferenzaWebpliant.bind(this));
    this.router.get('/getDatiPerWebPliantDisponibili', authMiddleware, permissionGuard('referenze.visualizza'), routeDeprecata, this.getDatiPerWebPliantDisponibili.bind(this));
    this.router.get('/get_addestramenti_da_istanta', authMiddleware, permissionGuard('referenze.visualizza'), this.getAddestramentiDaIstanta.bind(this));
    this.router.get('/richiediReferenzeWebpliant', authMiddleware, permissionGuard('referenze.importa'), this.richiediReferenzeWebpliant.bind(this));
  }


  // --- Handlers from PromoController ---
  private async richiediReferenzeWebpliant(req: Request, res: Response): Promise<void> {
    try {
      const idKitRuntime = req.query.id as string;
      if (idKitRuntime == undefined) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ error: "Id mancante", esito: false, content: [] });
        return;
      }
      const configWebpliant = await container.get<IConfigService>(TYPES.ConfigService).getConfigWebPliantFromVolantino();
      const webpliantFields = configWebpliant.data_fields_refs.map((data_field) => data_field.expected_input);
      const runtimekit = await container.get<IKitRuntimeService>(TYPES.KitRuntimeService).getKitRuntimeById(idKitRuntime);
      const runtimekitPerWebhook = await container.get<IKitRuntimeService>(TYPES.KitRuntimeService).getKitRuntimeByIdPerWebhook(idKitRuntime);
      // Le referenze esistenti si eliminano solo dopo che Istanta ha restituito quelle nuove
      const { results: referenze } = verificaRisposta<{ esito: boolean, error: string, results: ReferenzeIstanta[] }>(
        await ServerUtils.sendToFICOApi(
          req,
          `${config.ISTANTA_IP_ADDRESS}/FicoProcess/downloadKitRuntimeFromFP`,
          'PUT',
          {
            kit: runtimekit,
            dataFieldsRequest: webpliantFields
          },
          undefined,
          undefined,
          // Istanta ricostruisce le referenze dell'intero kit: puo' superare il minuto
          { categoria: 'lunga' }
        ),
        'ISTANTA',
        '/FicoProcess/downloadKitRuntimeFromFP',
        // senza la lista non c'è nulla con cui sostituire le referenze: è un fallimento
        (d) => esitoIstanta(d) && Array.isArray(d.results)
      );
      const cfg = configWebpliant.data_fields_refs;
      //aggiunta campi
      for (let i = 0; i < referenze.length; i++) {
        const ref = referenze[i];
        // Traduce i tre insiemi principali una sola volta
        const dataFields = TraduttoreReferenze.traduci_data_fields(ref.dataFields, cfg);
        const compiledFields = TraduttoreReferenze.traduci_compiled_fields(ref.compiledFields, cfg);
        const deletedFields = TraduttoreReferenze.traduci_deleted_fields(ref.deletedFields, cfg);

        // Gruppi: trasforma in-place senza creare nuovi array
        if (Array.isArray(ref.groupElements) && ref.groupElements.length) {
          for (let j = 0; j < ref.groupElements.length; j++) {
            ref.groupElements[j] = TraduttoreReferenze.traduci_data_fields(ref.groupElements[j], cfg);
          }
        }

        // Aggiorna il ref in un unico Object.assign (meno property writes sparse)
        Object.assign(ref, {
          dataFields,
          compiledFields,
          deletedFields,
          guidIdKitRuntime: idKitRuntime,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          idPromo: runtimekit.idPromo,
          id: uuidv4(),
        });
      }
      const fileLog: FileItemKitLog = {
        id: uuidv4(),
        guid_kit_runtime: idKitRuntime,
        nome_file: "main.json",
        data_registrazione: new Date(),
        versione: 1,
        logs: [
          {
            azione: 'Download',
            messaggio: `File main.json scaricato con successo per kit ${runtimekit.titolo}, ${referenze.length} referenze create`,
            data_notifica: new Date(),
            utente_notifica: req.session.id_utente as string
          }
        ],
        stato: STATO_LOG_FILE.PUBBLICATO
      }
      await this.referenzeService.sostituisciReferenzeKit(idKitRuntime, referenze);
      // Il webhook annuncia referenze gia salvate: parte solo dopo la sostituzione riuscita
      log.debug('Tipi di export nel kit runtime', { tipiDiExportInKit: runtimekit.tipiDiExportInKit });
      if (runtimekit.tipiDiExportInKit && runtimekit.tipiDiExportInKit.some((tipo: OggettoTipiDiExport) =>
        tipo.useWebhook && (tipo.webhookEvents === EVENTI_WEBHOOK.KIT_MATERIALE_ARRIVATO || tipo.webhookEvents === 'all'))) {
        try {
          await container.get<IWebhookService>(TYPES.WebhookService).scatenaEvento({
            evento: EVENTI_WEBHOOK.KIT_MATERIALE_ARRIVATO,
            dati: {
              referenze,
              kit: runtimekitPerWebhook
            },
            meta: {
              user_id: req.session.id_utente as string,
              source: 'webpliant',
              request_id: uuidv4()
            }
          });
        } catch (webhookError) {
          log.error("Errore durante l'invio del webhook per kit materiale arrivato", webhookError instanceof Error ? webhookError : new Error(String(webhookError)));
          // Continuiamo l'esecuzione anche se il webhook fallisce
        }
      }
      await container.get<IKitRuntimeService>(TYPES.KitRuntimeService).insertNewFileRuntimeLog(fileLog);
      res.status(HttpStatusCode.OK).json({ esito: true, content: referenze, error: "" });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
  private async getReferenzaByEAN(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getReferenzaByEAN(req.query.ean as string);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllReferenze(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getAllReferenze();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllLoghiDaReferenze(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getAllLoghiDaReferenze(req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async creaContenutiAggiuntiviReferenza(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.creaContenutiAggiuntiviReferenza(req.body);
      this.sendResponse(res, HttpStatusCode.CREATED, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getContenutiAggiuntiviReferenza(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getContenutiAggiuntiviDaRegolePerReferenza(req.body.referenza);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllContenutiAggiuntivi(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getAllContenutiAggiuntivi();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async ricercaReferenzePromo(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.ricercaReferenzePromo(req.body);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async resolveImmaginiGruppo(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.resolveImmaginiGruppo();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getFilteredReferenze(req: Request, res: Response): Promise<void> {
    try {
      const {
        idWorkspace,
        idArea,
        idCanale,
        idPV,
        item,
      } = req.body ?? {};
      // Senza l'elemento della pagina (filtri e policy) la richiesta non e' valida: 400, non 500
      if (!item || typeof item !== 'object') {
        throw new BadRequestError({ message: "Elemento della pagina (item) mancante" });
      }
      // Route pubblica: data e modalita' editor dal browser valgono solo per chi configura WebPliant
      const dataSelezionata = (await dataConsultazioneConsentita(req, res, req.body.dataSelezionata))
        ?? dayjs().format('YYYY-MM-DD');
      const isEditor = req.body.isEditor === true && await puoConfigurareWebpliant(req, res);
      const referenze = await this.referenzeService.getFilteredReferenze(
        idWorkspace,
        dataSelezionata,
        idArea,
        idCanale,
        idPV,
        item,
        isEditor
      );
      // Il carosello chiede con conValidita anche la scritta di validità, che prima otteneva con una
      // seconda chiamata (PUT /getDataValiditaPerCarosello, ancora attiva per i bundle in cache).
      // Senza conValidita la risposta resta l'elenco delle referenze.
      if (req.body.conValidita === true) {
        const validita = await this.validitaCarosello(item.content, referenze);
        this.sendResponse(res, HttpStatusCode.OK, { referenze, validita });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, referenze);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  /**
   * Stessa logica di PUT /getDataValiditaPerCarosello (WebPliantService.getDataValiditaPerCarosello).
   * Se il calcolo fallisce le referenze arrivano comunque, senza scritta: come prima, quando la
   * seconda chiamata falliva e il carosello restava senza data.
   */
  private async validitaCarosello(content: unknown, referenze: ReferenzeIstanta[]): Promise<string> {
    try {
      const webPliantService = this.webPliantService ?? container.get<IWebPliantService>(TYPES.WebPliantService);
      return await webPliantService.getDataValiditaPerCarosello(content, referenze);
    } catch (error) {
      log.warn('Scritta di validita del carosello non calcolata', {
        error: error instanceof Error ? error.message : String(error),
      });
      return '';
    }
  }

  // --- Handlers from ImpostazioniController ---

  private async getReferenzaById(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getReferenzaById(req.query.id as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getReferenzaByCodice(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getReferenzaByCodice(req.query.codice as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async updateReferenzaWebpliant(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      if (!data) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      const result = await this.referenzeService.updateReferenzaWebpliant(data);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getDatiPerWebPliantDisponibili(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getDatiPerWebPliantDisponibili();
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAddestramentiDaIstanta(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.referenzeService.getAddestramentiDaIstanta(req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
