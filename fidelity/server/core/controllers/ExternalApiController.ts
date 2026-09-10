import { createHash } from 'crypto';
import { Request, Response } from "express";
import * as fs from "fs";
import multer from 'multer';
import crypto from "node:crypto";
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EXPORT_DI_SISTEMA, STATO_LOG_FILE } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import type { CompiledField, DataFields, FileItemKit, FileItemKitLog, ReferenzeIstanta } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { uploadMaterialiPubblicazioni, uploadOlimpoImages } from '../config/multerConfig';
import { container, TYPES } from '../di';
import {
  CreateFilterTemplateDTO,
  FilterTemplateEndpointType,
  UpdateFilterTemplateDTO,
  type CreateStatisticheApiDTO,
  type PromoContextValue
} from '../dto';
import type { IAreaService } from '../interfaces/IAreaService';
import type { ICanaleService } from '../interfaces/ICanaleService';
import type { IExternalApiService } from '../interfaces/IExternalApiService';
import type { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import type { IPromoService } from '../interfaces/IPromoService';
import type { IReferenzeService } from '../interfaces/IReferenzeService';
import type { ITipoExportService } from '../interfaces/ITipoExportService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { ephemeralTokenAuthMiddleware } from '../middleware/ephemeralTokenAuthMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { FilterTemplateService } from '../services/FilterTemplateService';
import { StatisticheApiService } from '../services/StatisticheApiService';
import { ServerUtils } from '../utils/ServerUtils';

interface JSONMetaFoto {
  Id?: string;
  IdRef?: number;
  FileName?: string;
  FileHash?: string;
}
interface SyncJsonPluginPayload {
  promo: string;
  promoId?: string;
  canale?: string;
  canaleId?: string;
  area?: string;
  areaId?: string;
  kitGuidId?: string;
  fileName: string;
  scannedAt: string; // ISO date string
  refs: unknown[];   // se vuoi, sostituisci con BoxRecord[]
  pv?: string;
  pageCount?: number;
  docName?: string;
  exportPath: string;
  // "nome_field": "ap_name",
  // "user_value": "LA SPEZIA"
  promoContext?: Array<{ nome_field: string, user_value: PromoContextValue }>
}


interface SyncJsonPluginRef {
  groupId?: number | string;
  dna?: string;
  compiledFields?: CompiledField[];
  dataFields?: DataFields;
  foto: Array<string>
  pag?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  wPage?: number;
  hPage?: number;
  percIngombro?: number;
  aspectRatio?: number;
}
export class ExternalApiController extends BaseController {
  private externalApiService: IExternalApiService;
  private statisticheApiService: StatisticheApiService;
  private filterTemplateService: FilterTemplateService;

  constructor(
    externalApiService: IExternalApiService,
    statisticheApiService: StatisticheApiService,
    filterTemplateService: FilterTemplateService
  ) {
    super('/api/external');
    this.externalApiService = externalApiService;
    this.statisticheApiService = statisticheApiService;
    this.filterTemplateService = filterTemplateService;
  }

  protected setupRoutes(): void {
    // Rotte protette da token effimero (con fallback ad API Key)
    this.router.post("/refs", ephemeralTokenAuthMiddleware, this.getRefs.bind(this));
    this.router.post("/refs-html", ephemeralTokenAuthMiddleware, this.getRefsHtml.bind(this));
    this.router.get("/css", ephemeralTokenAuthMiddleware, this.getCss.bind(this));
    this.router.post("/files", ephemeralTokenAuthMiddleware, this.getFiles.bind(this));
    this.router.get("/files/metadata-fields", authMiddleware, this.getFilesMetadataFields.bind(this));
    this.router.post("/refs/field-values", authMiddleware, this.getRefsFieldValues.bind(this));
    this.router.post("/files/field-values", authMiddleware, this.getFilesFieldValues.bind(this));

    this.router.get("/promo", ephemeralTokenAuthMiddleware, this.getPromoValide.bind(this));


    this.router.get("/status", ephemeralTokenAuthMiddleware, this.getStatus.bind(this));


    this.router.post("/generate-api-key", authMiddleware, permissionGuard('api.gestisci_chiavi'), this.generateApiKey.bind(this));
    this.router.get("/get_api_key", authMiddleware, permissionGuard('api.gestisci_chiavi'), this.getApiKey.bind(this));

    // Rotte per le statistiche API
    this.router.get("/statistiche/aggregate", authMiddleware, permissionGuard('api.visualizza_statistiche'), this.getStatisticheAggregate.bind(this));
    this.router.get("/statistiche/dettagli", authMiddleware, permissionGuard('api.visualizza_statistiche'), this.getStatisticheDettagli.bind(this));
    this.router.post("/statistiche/pulisci", authMiddleware, permissionGuard('api.visualizza_statistiche'), this.pulisciStatistiche.bind(this));

    // Rotte pubbliche (se necessarie)
    this.router.get('/health', this.getHealth.bind(this));

    this.router.get("/refs/today", ephemeralTokenAuthMiddleware, this.getRefs.bind(this));

    // Route test (solo sessione, bypass validità promo)
    this.router.post("/test/refs", authMiddleware, permissionGuard('api.test'), this.getRefsTest.bind(this));
    this.router.post("/test/files", authMiddleware, permissionGuard('api.test'), this.getFilesTest.bind(this));
    this.router.get("/test/promo", authMiddleware, permissionGuard('api.test'), this.getPromoValideTest.bind(this));

    // Route per Filter Templates - CRUD completo
    this.router.post("/filter-templates", authMiddleware, permissionGuard('api.gestisci_plugin'), this.createFilterTemplate.bind(this));
    this.router.get("/filter-templates", authMiddleware, permissionGuard('api.gestisci_plugin'), this.getAllFilterTemplates.bind(this));
    this.router.get("/filter-templates", ephemeralTokenAuthMiddleware, this.getAllFilterTemplates.bind(this));
    this.router.get("/filter-templates/by-endpoint-type/:endpointType", authMiddleware, permissionGuard('api.gestisci_plugin'), this.getFilterTemplatesByEndpointType.bind(this));
    this.router.post("/filter-templates/validate-slug", authMiddleware, permissionGuard('api.gestisci_plugin'), this.validateFilterTemplateSlug.bind(this));
    this.router.get("/filter-templates/slug/:slug/versions", authMiddleware, permissionGuard('api.gestisci_plugin'), this.getFilterTemplateVersionHistory.bind(this));
    this.router.post("/filter-templates/slug/:slug/restore", authMiddleware, permissionGuard('api.gestisci_plugin'), this.restoreFilterTemplateVersion.bind(this));
    this.router.get("/filter-templates/slug/:slug", ephemeralTokenAuthMiddleware, this.getFilterTemplateBySlug.bind(this));
    this.router.get("/filter-templates/:id", authMiddleware, permissionGuard('api.gestisci_plugin'), this.getFilterTemplateById.bind(this));
    this.router.put("/filter-templates/:id", authMiddleware, permissionGuard('api.gestisci_plugin'), this.updateFilterTemplate.bind(this));
    this.router.delete("/filter-templates/:id", authMiddleware, permissionGuard('api.gestisci_plugin'), this.deleteFilterTemplate.bind(this));
    //routes interne per plugin analizzatore volantini
    this.router.post(
      "/sync_foto_plugin",
      authMiddleware,
      permissionGuard('api.gestisci_plugin'),
      (req, res, next) => {
        uploadOlimpoImages.single('file')(req, res, (err) => {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: err.code, message: err.message });
          } else if (err) {
            return res.status(500).json({ success: false, error: 'UPLOAD_ERROR', message: err.message });
          }
          next();
        });
      },
      this.sync_foto_plugin.bind(this)
    );
    this.router.post("/sync_json_plugin",
      authMiddleware,
      (req, res, next) => {
        uploadMaterialiPubblicazioni.single('file')(req, res, (err) => {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: err.code, message: err.message });
          } else if (err) {
            return res.status(500).json({ success: false, error: 'UPLOAD_ERROR', message: err.message });
          }
          next();
        });
      },
      this.sync_json_plugin.bind(this)
    )
    // Route per gestione interazione plugin

  }



  private async sync_json_plugin(req: Request, res: Response): Promise<void> {
    try {
      let payloadString = req.body.payload;
      let payload: SyncJsonPluginPayload
      try {
        payload = JSON.parse(payloadString);
      } catch {
        throw new BadRequestError({
          message: "Errore durante il parsing del json"
        })
      }
      const file = req.file;
      const kitRuntimeService = container.get<IKitRuntimeService>(TYPES.KitRuntimeService);
      const referenzeService = container.get<IReferenzeService>(TYPES.ReferenzeService)
      //#region NOTE: controllo dei campi
      if (!ServerUtils.checkIfValueIsValid(file)) {
        throw new BadRequestError({
          message: "Il file non è presente"
        })
      }
      if (!ServerUtils.checkIfValueIsValid(payload.promoId)) {
        throw new BadRequestError({
          message: "L'id promo non è valido"
        })
      }
      if (!ServerUtils.checkIfValueIsValid(payload.areaId)) {
        throw new BadRequestError({
          message: "L'id dell'area non è valido"
        })
      }
      if (!ServerUtils.checkIfValueIsValid(payload.canaleId)) {
        throw new BadRequestError({
          message: "L'id del canale non è valido"
        })
      }

      const promo = await container.get<IPromoService>(TYPES.PromoService).getPromoById(payload.promoId);
      if (!ServerUtils.checkIfValueIsValid(promo)) {
        throw new BadRequestError({
          message: "Non esiste nessuna promo con questo id"
        })
      }
      const area = await container.get<IAreaService>(TYPES.AreaService).getAreaById(payload.areaId)
      if (!ServerUtils.checkIfValueIsValid(area)) {
        throw new BadRequestError({
          message: "Non esiste nessuna area con questo id"
        })
      }
      const canale = await container.get<ICanaleService>(TYPES.CanaleService).getCanaleById(payload.canaleId);
      if (!ServerUtils.checkIfValueIsValid(canale)) {
        throw new BadRequestError({
          message: "Non esiste nessuna area con questo id"
        })
      }
      const kitRuntime = await kitRuntimeService.getKitRuntimeById(payload.kitGuidId)
      if (!ServerUtils.checkIfValueIsValid(kitRuntime)) {
        throw new BadRequestError({
          message: "Non esiste nessuna kit runtime con questo id"
        })
      }
      const tipoExportVOL = await container.get<ITipoExportService>(TYPES.TipoExportService).getTipoExportByCodice(EXPORT_DI_SISTEMA.VOL)
      if (!ServerUtils.checkIfValueIsValid(tipoExportVOL)) {
        throw new BadRequestError({
          message: "Non esiste nessuna kit runtime con questo id"
        })
      }
      //#endregion
      /*
        prima di passare il payload al DB1 aggiungiamo la chiave
        promoContext prendendo il dato dalla promo e ripulendolo del dato non necessario
      */
      const promoContext = promo.context.map(c => {
        return {
          nome_field: c.nome_field,
          user_value: c.user_value
        }
      })
      payload = {
        ...payload,
        promoContext
      }

      //NOTE ora dobbiamo mandare al DB1 questo payload per avere indietro il dato migliorato
      const resultDB1 = await ServerUtils.sendToFICOApi<SyncJsonPluginPayload>(
        req,
        config.DBUNO_URL + "/UploadVolStorico.ashx",
        "POST",
        payload
      )
      /*
        da questo punto dobbiamo prendere e caricare il file
        per tipo di export VOL per prendere poi le referenze
        e caricare anche loro.
      */

      const formData = new FormData();
      const filePath = req.file.path;
      const fileResolve = payload.fileName || req.file.filename;
      const fileBuffer = fs.readFileSync(filePath);
      const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

      formData.append("file", fileBlob, path.basename(req.file.filename));
      formData.append("json_meta_materiale", JSON.stringify({
        Id: "",
        FileHash: hash,
        FileName: fileResolve,
        JsonMeta: {}
      }));

      const resultUpload = await ServerUtils.sendToFICOApi<{
        esito: boolean,
        error: string,
        content: {
          id: string,
          file_name: string,
          json_meta: string
        }
      }>(
        req,
        `${config.OLYMPUS_IP_ADDRESS}/materiali/uploadMateriale`,
        "POST",
        formData,
        { "Authorization": req.headers.authorization as string }
      );

      if (!resultUpload.data?.esito) {
        throw new BadRequestError({
          message: resultUpload.data?.error || resultUpload.statusText || "Errore durante il caricamento del materiale"
        })
      }

      let files = await kitRuntimeService.getFilesRuntimeByIdKitRuntime(resultDB1.data.kitGuidId);
      if (!files) {
        throw new BadRequestError({
          message: "Kit non trovato"
        })
      }

      const fileCercatoPerNome = files.find(f => f.nome === fileResolve);
      const ricercaPerId = files.find(f => f.id_olimpo_cloud === resultUpload.data.content.id);

      let newFile: FileItemKit = {
        id: '',
        id_runtime: '',
        direttive: '',
        nome: '',
        nome_originale: '',
        isOptional: false,
        meta_olimpo_cloud: undefined,
        tipo_export: '',
        tipo_export_codice: '',
        pages: resultDB1.data.pageCount
      };

      let isNewFile = false;
      if (!fileCercatoPerNome && !ricercaPerId) {
        newFile = {
          id: uuidv4(),
          id_runtime: resultDB1.data.kitGuidId,
          id_olimpo_cloud: resultUpload.data.content.id,
          nome_originale: resultUpload.data.content.file_name,
          nome: fileResolve,
          tipo_export: tipoExportVOL.id,
          direttive: "",
          isOptional: false,
          meta_olimpo_cloud: resultUpload.data.content.json_meta,
          tipo_export_codice: tipoExportVOL.codice
        };
        isNewFile = true;
        files.push(newFile);
      } else if (fileCercatoPerNome && !ricercaPerId) {
        const index = files.indexOf(fileCercatoPerNome);
        files[index].id_olimpo_cloud = resultUpload.data.content.id;
        files[index].meta_olimpo_cloud = resultUpload.data.content.json_meta;
        newFile = files[index];
      } else if (!fileCercatoPerNome && ricercaPerId) {
        const index = files.indexOf(ricercaPerId);
        files[index].nome = fileResolve;
        files[index].meta_olimpo_cloud = resultUpload.data.content.json_meta;
        newFile = files[index];
      } else if (fileCercatoPerNome && ricercaPerId) {
        const index = files.indexOf(fileCercatoPerNome);
        files[index].id_olimpo_cloud = resultUpload.data.content.id;
        files[index].meta_olimpo_cloud = resultUpload.data.content.json_meta;
        newFile = files[index];
      }

      await fs.promises.rm(filePath);

      if (isNewFile) {
        await kitRuntimeService.insertNewFileRuntime(newFile);
      } else {
        await kitRuntimeService.updateSingleFileRuntime(newFile);
      }

      const existLog = await kitRuntimeService.getFileRunTimeLogByNomeFileEIdKitRuntime(fileResolve, resultDB1.data.kitGuidId);
      if (ServerUtils.checkIfValueIsValid(existLog)) {
        const log: FileItemKitLog = {
          id: uuidv4(),
          guid_kit_runtime: resultDB1.data.kitGuidId,
          nome_file: fileResolve,
          data_registrazione: new Date(),
          versione: existLog?.versione ? existLog.versione + 1 : 1,
          logs: existLog?.logs,
          stato: STATO_LOG_FILE.IN_ATTESA
        }
        await kitRuntimeService.insertNewFileRuntimeLog(log);
      } else {
        const newLog: FileItemKitLog = {
          id: uuidv4(),
          guid_kit_runtime: resultDB1.data.kitGuidId,
          nome_file: fileResolve,
          data_registrazione: new Date(),
          versione: existLog?.versione ? existLog.versione + 1 : 1,
          logs: [{
            messaggio: `Caricato volantino: ${fileResolve} per storico`,
            data_notifica: new Date(),
            azione: 'Upload',
            utente_notifica: req.session.id_utente
          }],
          stato: STATO_LOG_FILE.IN_ATTESA
        }
        await kitRuntimeService.insertNewFileRuntimeLog(newLog)
      }
      //adesso salviamo i dati nuovi delle referenze
      const refsDaMappare = Array.isArray((resultDB1.data as any)?.refs) ? (resultDB1.data as any).refs as SyncJsonPluginRef[] : [];
      const datoReferenze: ReferenzeIstanta[] = refsDaMappare.map((ref) => {
        const compiledFields = (Array.isArray(ref.compiledFields) ? ref.compiledFields : []).map((field) => ({
          labelName: field.labelName,
          paragraphName: field.paragraphName,
          content: field.content,
          // Manteniamo anche lo snake_case per compatibilita con i consumer lato DB/API
          label_name: field.labelName,
          paragraph_name: field.paragraphName
        }));




        return {
          _id: uuidv4(),
          id: uuidv4(),
          guidIdKitRuntime: resultDB1.data.kitGuidId,
          idPromo: payload.promoId,
          contextPromo: payload.promoContext ?? [],
          contextTracciato: [],
          visibile: true,
          compiledFields,
          deletedFields: [],
          foto: ref.foto,
          fotoGruppo: '',
          meccanica: '',
          codiceBox: "",
          fotoExtra: [],
          groupElements: [],
          dataFields: ref.dataFields,
          pag: ref.pag,
          x: ref.x,
          y: ref.y,
          w: ref.w,
          h: ref.h,
          wPage: ref.wPage,
          hPage: ref.hPage,
          percIngombro: ref.percIngombro,
          aspectRatio: ref.aspectRatio,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });
      await referenzeService.bulkCreateReferenze(datoReferenze)

      res.status(200).json({
        success: true,
        message: "Payload valido"
      });
    } catch (e: any) {
      this.handleError(res, e)
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        await fs.promises.unlink(req.file.path)
      }
    }
  }

  /**
   * Proxy verso OLYMPUS /foto/uploadFoto.
   * Riceve multipart/form-data con `file` e `dna`, estrae l'IdRef dal dna,
   * calcola FileName e FileHash, poi invia a OLYMPUS.
   */
  private async sync_foto_plugin(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: 'File mancante' });
        return;
      }

      const dna: string = req.body.dna ?? '';
      const isFotoExtra = req.body.is_extra === "true";
      const fileName = file.originalname;
      const fileHash = createHash('md5').update(file.buffer).digest('hex');

      let idRef = 0;
      if (!isFotoExtra) {
        const match = dna.match(/\{[\s\n]*(\d+)/);
        if (!match) {
          res.status(400).json({ success: false, message: 'DNA non valido o IdRef non trovato' });
          return;
        }
        idRef = parseInt(match[1], 10);
      }

      const metaFoto: JSONMetaFoto = {
        IdRef: idRef,
        FileName: fileName,
        FileHash: fileHash,
      };

      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, fileName);
      formData.append('json_meta_foto', JSON.stringify(metaFoto));

      const response = await ServerUtils.sendToFicoApiAxiosUpload<{
        record: {
          IdRef: string;
          FileName: string;
          FileHash: string;
          Id: string;
        },
        error: string
      }>(
        req,
        `${config.OLYMPUS_IP_ADDRESS}/foto/uploadFoto`,
        formData,
      );

      if (response.data.error) {
        res.status(500).json({ success: false, error: response.data.error });
        return;
      }

      res.json({ success: true, data: response.data.record });
    } catch (error: any) {
      log.error('Errore in sync_foto_plugin', { error: error.message });
      this.handleError(res, error);
    }
  }

  /**
   * Endpoint per ottenere i files runtime - protetto da ephemeral token
   */
  private async getFiles(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('Richiesta files runtime da API esterna', {
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo,
        userAgent: req.get('User-Agent')
      });
      const result = await this.externalApiService.getFiles(req.body || {});
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.apiKeyInfo?.ruolo
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('Errore nel recupero files runtime', {
        error: error.message,
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      // Registra la statistica in modo asincrono per non rallentare la risposta
      this.registraStatisticaAsync({
        endpoint: '/api/external/files',
        metodo: 'POST',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: req.apiKeyInfo?.ruolo || undefined,
        api_key_utilizzata: req.apiKeyInfo?.apiKey || undefined,
        parametri_richiesta: JSON.stringify(req.body),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint per ottenere i campi disponibili in meta_olimpo_cloud dei files
   */
  private async getFilesMetadataFields(req: Request, res: Response): Promise<void> {
    try {
      const fields = await this.externalApiService.getFilesMetadataFields();
      res.json({
        success: true,
        data: fields,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      log.error('Errore nel recupero campi metadata files', {
        error: error.message,
        ip: req.ip
      });

      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint per ottenere i valori distinti di un campo specifico delle referenze
   */
  private async getRefsFieldValues(req: Request, res: Response): Promise<any> {
    try {
      const { field, template_id } = req.body;

      if (!field) {
        return res.status(400).json({
          success: false,
          error: 'Il parametro "field" è obbligatorio'
        });
      }

      const values = await this.externalApiService.getRefsFieldValues(field, template_id);
      res.json({
        success: true,
        data: {
          field,
          values
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      log.error('Errore nel recupero valori campo refs', {
        error: error.message,
        ip: req.ip
      });

      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint per ottenere i valori distinti di un campo dei metadata files
   */
  private async getFilesFieldValues(req: Request, res: Response): Promise<any> {
    try {
      const { field } = req.body;

      if (!field) {
        return res.status(400).json({
          success: false,
          error: 'Il parametro "field" è obbligatorio'
        });
      }

      const values = await this.externalApiService.getFilesFieldValues(field);
      res.json({
        success: true,
        data: {
          field,
          values
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      log.error('Errore nel recupero valori campo files', {
        error: error.message,
        ip: req.ip
      });

      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint per ottenere le referenze - protetto da API Key
   */
  private async getRefs(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('Richiesta referenze da API esterna', {
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getRefs(req.body);
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.apiKeyInfo?.ruolo
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('Errore nel recupero referenze', {
        error: error.message,
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      // Registra la statistica in modo asincrono per non rallentare la risposta
      this.registraStatisticaAsync({
        endpoint: '/api/external/refs',
        metodo: 'POST',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: req.apiKeyInfo?.ruolo || undefined,
        api_key_utilizzata: req.apiKeyInfo?.apiKey || undefined,
        parametri_richiesta: JSON.stringify(req.body),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint per ottenere il CSS configurato per le referenze - protetto da token effimero
   */
  private async getCss(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('Richiesta CSS da API esterna', {
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getCss();
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.apiKeyInfo?.ruolo
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('Errore nel recupero CSS', {
        error: error.message,
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      this.registraStatisticaAsync({
        endpoint: '/api/external/css',
        metodo: 'GET',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: req.apiKeyInfo?.ruolo || undefined,
        api_key_utilizzata: req.apiKeyInfo?.apiKey || undefined,
        parametri_richiesta: JSON.stringify({}),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint per ottenere le referenze con HTML pre-renderizzato - protetto da token effimero
   */
  private async getRefsHtml(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('Richiesta referenze HTML da API esterna', {
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getRefsHtml(req.body);
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.apiKeyInfo?.ruolo
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('Errore nel recupero referenze HTML', {
        error: error.message,
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      // Registra la statistica in modo asincrono per non rallentare la risposta
      this.registraStatisticaAsync({
        endpoint: '/api/external/refs-html',
        metodo: 'POST',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: req.apiKeyInfo?.ruolo || undefined,
        api_key_utilizzata: req.apiKeyInfo?.apiKey || undefined,
        parametri_richiesta: JSON.stringify(req.body),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  private async getPromoValide(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('Richiesta promozioni valide da API esterna', {
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getPromoValide();
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.apiKeyInfo?.ruolo
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('Errore nel recupero promozioni valide', {
        error: error.message,
        ip: req.ip,
        ruolo: req.apiKeyInfo?.ruolo
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      // Registra la statistica in modo asincrono per non rallentare la risposta
      this.registraStatisticaAsync({
        endpoint: '/api/external/promo',
        metodo: 'GET',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: req.apiKeyInfo?.ruolo || undefined,
        api_key_utilizzata: req.apiKeyInfo?.apiKey || undefined,
        parametri_richiesta: JSON.stringify(req.query), // GET usa query params
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint TEST per ottenere le referenze - bypass validità promo (solo sessione)
   */
  private async getRefsTest(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('[TEST] Richiesta referenze TEST (skip validità promo) da sessione', {
        ip: req.ip,
        userId: req.session.id_utente,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getRefs({
        ...req.body,
        skipValidityCheck: true
      });
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        test_mode: true,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.session.id_utente
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('[TEST] Errore nel recupero referenze test', {
        error: error.message,
        ip: req.ip
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      this.registraStatisticaAsync({
        endpoint: '/api/external/test/refs',
        metodo: 'POST',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: (req.session as any).tipo_utente || undefined,
        api_key_utilizzata: undefined,
        parametri_richiesta: JSON.stringify(req.body),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint TEST per ottenere i files runtime - bypass validità promo (solo sessione)
   */
  private async getFilesTest(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('[TEST] Richiesta files runtime TEST da sessione', {
        ip: req.ip,
        userId: req.session.id_utente,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getFiles(req.body || {});
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        test_mode: true,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.session.id_utente
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('[TEST] Errore nel recupero files runtime test', {
        error: error.message,
        ip: req.ip
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      this.registraStatisticaAsync({
        endpoint: '/api/external/test/files',
        metodo: 'POST',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: (req.session as any).tipo_utente || undefined,
        api_key_utilizzata: undefined,
        parametri_richiesta: JSON.stringify(req.body),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint TEST per ottenere le promozioni - bypass validità date (solo sessione)
   */
  private async getPromoValideTest(req: Request, res: Response): Promise<void> {
    const timestampRichiesta = new Date();
    let timestampRisposta = new Date();
    let codiceRisposta = 200;
    let dimensioneRisposta = 0;
    let errore: string | undefined = undefined;
    let stackTrace: string | undefined = undefined;

    try {
      log.info('[TEST] Richiesta promozioni TEST (skip validità) da sessione', {
        ip: req.ip,
        userId: req.session.id_utente,
        userAgent: req.get('User-Agent')
      });

      const result = await this.externalApiService.getPromoValide(true);
      timestampRisposta = new Date();

      const responseData = {
        success: true,
        data: result,
        test_mode: true,
        timestamp: timestampRisposta.toISOString(),
        requestedBy: req.session.id_utente
      };

      dimensioneRisposta = JSON.stringify(responseData).length;
      res.json(responseData);

    } catch (error: any) {
      timestampRisposta = new Date();
      codiceRisposta = error.status || 500;
      errore = error.message;
      stackTrace = error.stack;

      log.error('[TEST] Errore nel recupero promozioni test', {
        error: error.message,
        ip: req.ip
      });

      this.handleErrorWithReturn(res, error);
    } finally {
      this.registraStatisticaAsync({
        endpoint: '/api/external/test/promo',
        metodo: 'GET',
        codice_risposta: codiceRisposta,
        tempo_risposta_ms: timestampRisposta.getTime() - timestampRichiesta.getTime(),
        dimensione_risposta_bytes: dimensioneRisposta,
        ip_richiedente: req.ip || 'unknown',
        user_agent: req.get('User-Agent') || undefined,
        ruolo_utente: (req.session as any).tipo_utente || undefined,
        api_key_utilizzata: undefined,
        parametri_richiesta: JSON.stringify(req.query),
        timestamp_richiesta: timestampRichiesta,
        timestamp_risposta: timestampRisposta,
        errore,
        stack_trace: stackTrace
      });
    }
  }

  /**
   * Endpoint per verificare lo stato del servizio
   */
  private async getStatus(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        status: 'active',
        timestamp: new Date().toISOString(),
        service: 'ExternalApiService',
        requestedBy: req.apiKeyInfo?.ruolo
      });
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint per eseguire chiamate API esterne
   */



  private async generateApiKey(req: Request, res: Response): Promise<void> {
    try {
      let { id_utente } = req.body;
      if (!ServerUtils.checkIfValueIsValid(id_utente)) {
        id_utente = req.session.id_utente as string;
      }
      const apiKey = await this.externalApiService.generateApiKey(id_utente);
      res.json({ success: true, apiKey });
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  private async getApiKey(req: Request, res: Response): Promise<void> {
    try {
      const apiKey = await this.externalApiService.getApiKey(req.session.id_utente as string);
      res.json(apiKey);
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint per ottenere le statistiche aggregate
   */
  private async getStatisticheAggregate(req: Request, res: Response): Promise<void> {
    try {
      const statistiche = await this.statisticheApiService.getStatisticheAggregate();
      res.json({
        success: true,
        data: statistiche,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint per ottenere le statistiche con filtri
   */
  private async getStatisticheDettagli(req: Request, res: Response): Promise<void> {
    try {
      const filtri = {
        endpoint: req.query.endpoint as string,
        metodo: req.query.metodo as string,
        codice_risposta: req.query.codice_risposta ? parseInt(req.query.codice_risposta as string) : undefined,
        ruolo_utente: req.query.ruolo_utente as string,
        data_da: req.query.data_da ? new Date(req.query.data_da as string) : undefined,
        data_a: req.query.data_a ? new Date(req.query.data_a as string) : undefined,
        limite: req.query.limite ? parseInt(req.query.limite as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
        ordina_per: req.query.ordina_per as 'timestamp_richiesta' | 'tempo_risposta_ms' | 'codice_risposta',
        direzione_ordine: req.query.direzione_ordine as 'ASC' | 'DESC'
      };

      const result = await this.statisticheApiService.getStatisticheConFiltri(filtri);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Crea un nuovo filter template
   */
  private async createFilterTemplate(req: Request, res: Response): Promise<void> {
    try {
      const {
        mode,
        renderType,
        nome,
        descrizione,
        filters,
        templateIds,
        exportIds,
        // Opzioni di visualizzazione plugin
        autoScroll,
        scrollSpeed,
        showIndicators,
        showNavButtons,
        slug
      } = req.body;
      const userId = req.session.id_utente as string;
      const gdoId = req.session.id_gdo as string;

      if (!ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'GDO non presente per questo utente'
        });
        return;
      }

      const dto: CreateFilterTemplateDTO = {
        nome,
        slug,
        descrizione: descrizione || undefined,
        filters: filters || [],
        endpoint_type: (mode as FilterTemplateEndpointType) || 'refs',
        render_type: renderType,
        template_ids: templateIds || [],
        export_codes: exportIds || [],
        // Opzioni di visualizzazione
        auto_scroll: autoScroll,
        scroll_speed: scrollSpeed,
        show_indicators: showIndicators,
        show_nav_buttons: showNavButtons
      };

      const template = await this.filterTemplateService.create(dto, userId, gdoId);

      log.info('FilterTemplate creato via API', {
        id: template.id_filter_template,
        slug: template.slug,
        userId,
        gdoId
      });

      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nella creazione FilterTemplate', {
        error: error.message,
        userId: req.session.id_utente
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Aggiorna un filter template esistente
   */
  private async updateFilterTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        mode,
        renderType,
        nome,
        descrizione,
        filters,
        templateIds,
        exportIds,
        // Opzioni di visualizzazione plugin
        autoScroll,
        scrollSpeed,
        showIndicators,
        showNavButtons,
        slug,
        is_active
      } = req.body;
      const userId = req.session.id_utente as string;
      const gdoId = req.session.id_gdo as string;

      if (!ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'GDO non presente per questo utente'
        });
        return;
      }

      const dto: UpdateFilterTemplateDTO = {
        ...(nome && { nome }),
        ...(slug && { slug }),
        ...(descrizione !== undefined && { descrizione }),
        ...(filters && { filters }),
        ...(mode && { endpoint_type: mode as FilterTemplateEndpointType }),
        ...(renderType !== undefined && { render_type: renderType }),
        ...(templateIds && { template_ids: templateIds }),
        ...(exportIds && { export_codes: exportIds }),
        // Opzioni di visualizzazione
        ...(autoScroll !== undefined && { auto_scroll: autoScroll }),
        ...(scrollSpeed !== undefined && { scroll_speed: scrollSpeed }),
        ...(showIndicators !== undefined && { show_indicators: showIndicators }),
        ...(showNavButtons !== undefined && { show_nav_buttons: showNavButtons }),
        ...(is_active !== undefined && { is_active })
      };

      const template = await this.filterTemplateService.update(id, dto, userId, gdoId);

      log.info('FilterTemplate aggiornato via API', {
        id: template.id_filter_template,
        slug: template.slug,
        userId,
        gdoId
      });

      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nell\'aggiornamento FilterTemplate', {
        error: error.message,
        id: req.params.id,
        userId: req.session.id_utente
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Elimina un filter template
   */
  private async deleteFilterTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const gdoId = req.session.id_gdo as string;
      const userId = req.session.id_utente as string;

      if (!ServerUtils.checkIfValueIsValid(gdoId) || !ServerUtils.checkIfValueIsValid(userId)) {
        res.status(400).json({
          success: false,
          error: 'GDO o utente non valido per questa sessione'
        });
        return;
      }

      await this.filterTemplateService.delete(id, gdoId, userId);

      log.info('FilterTemplate eliminato via API', {
        id,
        userId,
        gdoId
      });

      res.json({
        success: true,
        message: 'Template eliminato con successo',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nell\'eliminazione FilterTemplate', {
        error: error.message,
        id: req.params.id,
        userId: req.session.id_utente
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Recupera un filter template per ID
   */
  private async getFilterTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const gdoId = req.session.id_gdo as string;

      if (!ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'GDO non presente per questo utente'
        });
        return;
      }

      const template = await this.filterTemplateService.getById(id, gdoId);

      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nel recupero FilterTemplate per ID', {
        error: error.message,
        id: req.params.id
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Recupera un filter template per slug (usato dal plugin)
   * Questo endpoint è pubblico (via ephemeral token o API key) e cerca il template
   * solo per slug, dato che gli slug sono già unici per GDO
   */
  private async getFilterTemplateBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const versionParam = req.query.version;

      if (!ServerUtils.checkIfValueIsValid(slug)) {
        res.status(400).json({
          success: false,
          error: 'Slug è obbligatorio'
        });
        return;
      }

      let version: number | undefined;
      if (versionParam !== undefined) {
        version = parseInt(versionParam as string, 10);
        if (Number.isNaN(version) || version < 1) {
          res.status(400).json({
            success: false,
            error: 'Il parametro "version" deve essere un intero positivo'
          });
          return;
        }
      }

      // Usa il metodo getBySlugPublic che cerca solo per slug
      // (lo slug è unico per GDO quindi non serve passare gdoId)
      const template = await this.filterTemplateService.getBySlugPublic(slug, version);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template non trovato o non attivo'
        });
        return;
      }

      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nel recupero FilterTemplate per slug', {
        error: error.message,
        slug: req.params.slug
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  private async getFilterTemplateVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const gdoId = req.session.id_gdo as string;

      if (!ServerUtils.checkIfValueIsValid(slug) || !ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'Slug e GDO sono obbligatori'
        });
        return;
      }

      const history = await this.filterTemplateService.getVersionHistory(slug, gdoId);

      res.json({
        success: true,
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nel recupero cronologia versioni FilterTemplate', {
        error: error.message,
        slug: req.params.slug
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  private async restoreFilterTemplateVersion(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const { target_version } = req.body;
      const gdoId = req.session.id_gdo as string;
      const userId = req.session.id_utente as string;

      if (!ServerUtils.checkIfValueIsValid(slug) || !ServerUtils.checkIfValueIsValid(gdoId) || !ServerUtils.checkIfValueIsValid(userId)) {
        res.status(400).json({
          success: false,
          error: 'Slug, GDO e utente sono obbligatori'
        });
        return;
      }

      const parsedVersion = parseInt(target_version, 10);
      if (Number.isNaN(parsedVersion) || parsedVersion < 1) {
        res.status(400).json({
          success: false,
          error: 'Il campo target_version deve essere un intero positivo'
        });
        return;
      }

      const template = await this.filterTemplateService.restoreVersion(slug, parsedVersion, userId, gdoId);

      res.json({
        success: true,
        data: template,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nel ripristino FilterTemplate', {
        error: error.message,
        slug: req.params.slug,
        target_version: req.body?.target_version
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Recupera tutti i filter templates per la GDO dell'utente
   */
  private async getAllFilterTemplates(req: Request, res: Response): Promise<void> {
    try {
      const gdoId = req.session.id_gdo as string;
      const includeInactive = req.query.includeInactive === 'true';

      if (!ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'GDO non presente per questo utente'
        });
        return;
      }

      const result = await this.filterTemplateService.getAllForOrganization(gdoId, includeInactive);

      res.json({
        success: true,
        data: result.templates,
        totale: result.totale,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nel recupero FilterTemplates', {
        error: error.message,
        gdoId: req.session.id_gdo
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Recupera i filter templates per tipo di endpoint
   */
  private async getFilterTemplatesByEndpointType(req: Request, res: Response): Promise<void> {
    try {
      const { endpointType } = req.params;
      const gdoId = req.session.id_gdo as string;

      if (!ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'GDO non presente per questo utente'
        });
        return;
      }

      const validEndpointTypes: FilterTemplateEndpointType[] = ['refs', 'refs-html', 'files'];
      if (!validEndpointTypes.includes(endpointType as FilterTemplateEndpointType)) {
        res.status(400).json({
          success: false,
          error: `Tipo endpoint non valido. Valori accettati: ${validEndpointTypes.join(', ')}`
        });
        return;
      }

      const templates = await this.filterTemplateService.getByEndpointType(
        gdoId,
        endpointType as FilterTemplateEndpointType
      );

      res.json({
        success: true,
        data: templates,
        totale: templates.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nel recupero FilterTemplates per endpoint type', {
        error: error.message,
        endpointType: req.params.endpointType
      });
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Valida la disponibilità di uno slug
   */
  private async validateFilterTemplateSlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug, excludeId } = req.body;
      const gdoId = req.session.id_gdo as string;

      if (!ServerUtils.checkIfValueIsValid(gdoId)) {
        res.status(400).json({
          success: false,
          error: 'GDO non presente per questo utente'
        });
        return;
      }

      if (!ServerUtils.checkIfValueIsValid(slug)) {
        res.status(400).json({
          success: false,
          error: 'Il parametro "slug" è obbligatorio'
        });
        return;
      }

      const result = await this.filterTemplateService.validateSlug(slug, gdoId, excludeId);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      log.error('Errore nella validazione slug', {
        error: error.message,
        slug: req.body.slug
      });
      this.handleErrorWithReturn(res, error);
    }
  }
  /**
   * Endpoint per pulire le statistiche vecchie
   */
  private async pulisciStatistiche(req: Request, res: Response): Promise<void> {
    try {
      const statisticheEliminate = await this.statisticheApiService.pulisciStatisticheVecchie();
      res.json({
        success: true,
        message: `Eliminate ${statisticheEliminate} statistiche vecchie`,
        statistiche_eliminate: statisticheEliminate,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Endpoint di health check pubblico
   */
  private async getHealth(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'ExternalApiController'
      });
    } catch (error: any) {
      this.handleErrorWithReturn(res, error);
    }
  }

  /**
   * Metodo helper per registrare le statistiche in modo asincrono
   */
  private registraStatisticaAsync(dto: CreateStatisticheApiDTO): void {
    // Esegue la registrazione in modo asincrono per non bloccare la risposta
    setImmediate(async () => {
      try {
        await this.statisticheApiService.registraStatistica(dto);
      } catch (error) {
        // Log dell'errore ma non blocca la risposta principale
        log.error('Errore nella registrazione statistica asincrona', {
          error: error instanceof Error ? error.message : 'Unknown error',
          dto
        });
      }
    });
  }
}
