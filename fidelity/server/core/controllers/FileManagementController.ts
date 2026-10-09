import axios from 'axios';
import { Request, Response } from 'express';
import 'express-session';
import multer from 'multer';
import { v4 as uuidv4 } from "uuid";
import { Colorize } from '../../../lib/Colorize';
import { CATEGORIA_ATTIVITA, HttpStatusCode, TIPO_ATTIVITA } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors/application/BadRequestError';
import { BaseController } from '../base/BaseController';
import config from '../config';
import {
  uploadMaterialiPubblicazioni,
  uploadOlimpoImages,
  uploadTracciati,
  uploadZipMemory
} from '../config/multerConfig';
import { IFileManagementService } from '../interfaces/IFileManagementService';
import { log } from '../logger';
import { authMiddleware, integrationAuthMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { Tracciati } from '../models';

const uploadForzatoImmaginiOlimpo = uploadOlimpoImages;
const processZipInMemory = uploadZipMemory;

import { getService } from '../../core/di/container';
import { TYPES } from '../../core/di/types';
import { IPromoService } from '../interfaces/IPromoService'; // <-- Add this import if not present
import { ServerUtils } from '../utils/ServerUtils';
import { verificaRisposta } from '../utils/rispostaServizi';

export class FileManagementController extends BaseController {
  private promoService: IPromoService;

  constructor(
    private fileManagementService: IFileManagementService,
  ) {
    super('/api');

  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    // Upload routes. Autenticazione e permesso vengono verificati PRIMA di multer:
    // una richiesta rifiutata non deve scrivere nulla su disco ne' occupare memoria.
    this.router.post(
      '/invioMaterialeAdFP',
      integrationAuthMiddleware,
      permissionGuard('file.upload_materiale'),
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
      this.invioMaterialeAdFP.bind(this)
    );

    this.router.post('/uploadTracciato/:idPromo', authMiddleware, permissionGuard('file.upload_tracciato'), uploadTracciati.single('file'), this.uploadTracciato.bind(this));
    this.router.post('/uploadMateriale', authMiddleware, permissionGuard('file.upload_materiale'), uploadMaterialiPubblicazioni.single('file'), this.uploadMateriale.bind(this));
    this.router.post('/uploadKitManuali/:idPromo/:idKit', authMiddleware, permissionGuard('file.upload_kit_manuali'), uploadMaterialiPubblicazioni.array('file'), this.uploadKitManuali.bind(this));
    this.router.post('/replaceFileKitRuntime/:idFile', authMiddleware, permissionGuard('file.sostituisci'), uploadForzatoImmaginiOlimpo.single('file'), this.replaceFileKitRuntime.bind(this));
    this.router.post('/uploadForzatoImmaginiOlimpo', authMiddleware, permissionGuard('file.upload_olympus'), uploadForzatoImmaginiOlimpo.single('file'), this.uploadForzatoImmaginiOlimpo.bind(this));
    this.router.post('/updateImmagineReferenza', authMiddleware, permissionGuard('file.aggiorna_immagine_referenza'), uploadForzatoImmaginiOlimpo.single('file'), this.updateImmagineReferenza.bind(this));
    this.router.post('/updateImmagineGruppoReferenza', authMiddleware, permissionGuard('file.aggiorna_immagine_referenza'), uploadForzatoImmaginiOlimpo.single('file'), this.updateImmagineGruppoReferenza.bind(this));
    this.router.post('/process-rejected-zip', authMiddleware, permissionGuard('file.upload_materiale'), processZipInMemory.single('file'), this.processRejectedZip.bind(this));

    // File listing and retrieval
    this.router.get('/getAllFiles', authMiddleware, permissionGuard('file.download'), this.getAllFiles.bind(this));
    this.router.put('/get_all_files_documentale', authMiddleware, permissionGuard('file.download'), this.getAllFilesDocumentale.bind(this));
    this.router.put('/get_all_contenuti_digitali', authMiddleware, permissionGuard('file.download'), this.getAllContenutiDigitali.bind(this));
    this.router.get('/getProprietaMetaFilesRuntime', authMiddleware, permissionGuard('file.download'), this.getProprietaMetaFilesRuntime.bind(this));
    this.router.get('/getAllCombinazioniRuntimePDF', authMiddleware, permissionGuard('file.download'), this.getAllCombinazioniRuntimePDF.bind(this));
    this.router.put('/getAllCombinazioniRuntimePDFWebPliant', authMiddleware, permissionGuard('file.download'), this.getAllCombinazioniRuntimePDFWebPliant.bind(this));
    this.router.get('/getContenutoDigitali', authMiddleware, permissionGuard('file.download'), this.getContenutoDigitali.bind(this));

    // Download routes
    this.router.get('/downloadPDFVolantino/:id', authMiddleware, permissionGuard('file.download'), this.downloadPDFVolantino.bind(this));
    this.router.post('/downloadKitZip', authMiddleware, permissionGuard('file.download'), this.downloadKitZip.bind(this));
    this.router.post('/downloadPromoZip', authMiddleware, permissionGuard('file.download'), this.downloadPromoZip.bind(this));

    this.router.post("/mergeFiles", authMiddleware, permissionGuard('file.merge'), this.mergeFiles.bind(this))
  }

  // --- Upload handlers ---

  private async invioMaterialeAdFP(req: Request, res: Response): Promise<void> {
    try {
      const { guidKitRuntime, tipoExport, nomeFile, meta } = req.body;
      await this.fileManagementService.invioMaterialeAdFP(guidKitRuntime, tipoExport, nomeFile, meta, req.file!, req);
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async uploadTracciato(req: Request, res: Response): Promise<void> {
    try {
      log.info(Colorize.bgYellow("==== INIZIO uploadTracciato ====")); log.info(Colorize.bgYellow("==== INIZIO uploadTracciato ===="));
      log.info(Colorize.yellow(`Request params: ${JSON.stringify(req.params)}`));
      log.info(Colorize.yellow(`Request body keys: ${Object.keys(req.body)}`));
      log.info(Colorize.yellow(`Request file: ${req.file ? JSON.stringify({
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        buffer: req.file.buffer ? `Buffer (${req.file.buffer.length} bytes)` : undefined
      }) : "Nessun file"}`));
      log.info(Colorize.yellow(`Session: ${req.session ? JSON.stringify({
        id_utente: req.session.id_utente,
        tipo_utente: req.session.tipo_utente,
        email: req.session.email
      }) : "No session"}`));

      this.promoService = getService(TYPES.PromoService) as IPromoService;
      const promo = await this.promoService.getPromoById(req.params.idPromo);
      if (!this.promoService) {
        // Lazy load promoService from IoC container
        // Avoid circular dependency in constructor
        // eslint-disable-next-line @typescript-eslint/no-var-requires
      }
      log.info(Colorize.cyan(`Promo trovata: ${promo ? JSON.stringify({ guid_id: promo.id, nome: promo.nome }) : "Nessuna promo"}`));
      const guidID = uuidv4();
      log.info(Colorize.magenta(`GUID generato per il tracciato: ${guidID}`));

      if (!promo) {
        log.warn(Colorize.red("Promo non trovata"));
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, { message: "Promo non trovata" });
        return;
      }
      if (!req.file) {
        log.warn(Colorize.red("Nessun file caricato"));
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Nessun file caricato" });
        return;
      }

      const file = req.file;

      // Il nome file del marketing si conserva cosi com'e' (I20-957): l'unicita vale solo nella promo,
      // cosi lo stesso nome puo ripetersi fra promo diverse (es. promo 2025 e 2026)
      log.info(Colorize.blue(`Controllo esistenza file con nome: ${file.originalname} nella promo ${promo.id}`));
      const getIfFileExists = await Tracciati.findOne({
        where: { filename_tracciati: file.originalname, id_promo_tracciati: promo.id }
      });
      if (getIfFileExists) {
        log.warn(Colorize.red("File con stesso nome già presente nella promo"));
        this.sendResponse(res, HttpStatusCode.CONFLICT, { message: "File con stesso nome gia presente nella promo" });
        return;
      }

      // Il file è già in memoria (multer memoryStorage)
      const fileBuffer = file.buffer;
      log.info(Colorize.green(`File buffer ricevuto da multer, size totale: ${fileBuffer.length}`));

      // Parsing del context dal body della request
      log.info(Colorize.blue("Parsing context dal body della request"));
      let contextDaRicevere;
      try {
        contextDaRicevere = JSON.parse(req.body.context);
        log.info(Colorize.green(`Context ricevuto: ${JSON.stringify(contextDaRicevere)}`));
      } catch (err) {
        log.error(Colorize.red("Errore nel parsing del context: " + err));
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "Context non valido" });
        return;
      }

      // Validazione lunghezza label personalizzata (max 40 caratteri)
      if (Array.isArray(contextDaRicevere)) {
        const labelField = contextDaRicevere.find((c: any) => c.nome_field === "idLabel");
        if (labelField && typeof labelField.user_value === "string" && labelField.user_value.length > 40) {
          log.warn(Colorize.red(`Label personalizzata troppo lunga: ${labelField.user_value.length} caratteri`));
          this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: "La label personalizzata non può superare i 40 caratteri" });
          return;
        }
      }

      // Log dettagli file
      log.info(Colorize.green(`File caricato: ${file.originalname} - ${file.size} bytes`));

      // Preparazione FormData per chiamata esterna
      log.info(Colorize.blue("Preparazione FormData per chiamata esterna"));
      const dataForIstanta = new FormData();
      const blobParts = new Uint8Array(fileBuffer);
      const blob = new Blob([blobParts], { type: file.mimetype });
      dataForIstanta.append("fileContent", blob, file.originalname);
      dataForIstanta.append("guid_id", guidID);
      dataForIstanta.append("idPromo", promo.id);
      dataForIstanta.append("fileName", file.originalname);
      dataForIstanta.append("context", JSON.stringify(contextDaRicevere));

      log.info("-------------------");
      log.info(Colorize.red("Grandezza Buffer per istanta"));
      log.info("Grandezza Buffer per istanta: " + fileBuffer.length);
      log.info("-------------------");

      log.info("-------------------");
      log.info(Colorize.red("dataForIstanta per istanta"));
      // Log FormData entries in modo leggibile
      for (const entry of (dataForIstanta as any).entries()) {
        log.info(Colorize.gray(`FormData entry: ${JSON.stringify(entry)}`));
      }
      log.info("-------------------");

      // Invio FormData a ServerUtils.sendToFicoApiAxiosUploadTracciato      // Invio FormData a ServerUtils.sendToFicoApiAxiosUploadTracciato
      log.info(Colorize.bgMagenta("Invio FormData a ServerUtils.sendToFicoApiAxiosUploadTracciato")); log.info(Colorize.bgMagenta("Invio FormData a ServerUtils.sendToFicoApiAxiosUploadTracciato"));
      const result = await ServerUtils.sendToFicoApiAxiosUploadTracciato<any>(
        req,
        dataForIstanta,
      );

      log.info("-------------------");
      log.info(Colorize.red("Risultato chiamata istanta"));
      log.info("Risultato chiamata istanta: " + JSON.stringify(result));
      log.info("-------------------");
      log.info(Colorize.red("Risultato chiamata istanta"));
      log.info("Risultato chiamata istanta: " + JSON.stringify(result.data));
      log.info("-------------------");
      log.info(Colorize.red("Status chiamata istanta"));
      log.info("Status chiamata istanta: " + result.status);
      log.info("-------------------");

      // Istanta risponde 200 anche quando rifiuta il tracciato: vale solo esito true
      verificaRisposta(result, 'ISTANTA', '/FicoProcess/uploadTracciato', (d) => d?.esito === true);

      // Salvataggio tracciato nel database
      log.info(Colorize.bgGreen("Salvataggio tracciato nel database"));
      const resultTracciatoSalvato = await Tracciati.create({
        id_tracciati: guidID,
        id_promo_tracciati: promo.id,
        filename_tracciati: file.originalname,
        blobfile_tracciati: fileBuffer,
        context_tracciati: contextDaRicevere,
        createdat: new Date(),
        updatedat: new Date()
      });
      log.info(Colorize.green(`Tracciato salvato: ${JSON.stringify({
        id_tracciati: resultTracciatoSalvato.id_tracciati,
        id_promo_tracciati: resultTracciatoSalvato.id_promo_tracciati,
        filename_tracciati: resultTracciatoSalvato.filename_tracciati
      })}`));

      // Non serve rimuovere file temporanei, multer memoryStorage

      if (req.session.id_utente) {
        log.info(Colorize.blue(`Chiamata CRE_ATTIVITA per utente: ${req.session.id_utente}`));
        await ServerUtils.CREA_ATTIVITA(
          req.session.id_utente,
          TIPO_ATTIVITA.IMPORT_TRACCIATO,
          CATEGORIA_ATTIVITA.PRODUZIONE,
          {
            id: resultTracciatoSalvato.id_tracciati,
            nome: resultTracciatoSalvato.filename_tracciati,
            idPromo: resultTracciatoSalvato.id_promo_tracciati,
            fileName: resultTracciatoSalvato.filename_tracciati,
            context: resultTracciatoSalvato.context_tracciati
          });
      } else {
        log.warn(Colorize.yellow("Sessione utente non presente, CRE_ATTIVITA non chiamata"));
      }

      log.info(Colorize.bgGreen("==== FINE uploadTracciato: invio risposta CREATED ====")); log.info(Colorize.bgGreen("==== FINE uploadTracciato: invio risposta CREATED ===="));
      this.sendResponse(res, HttpStatusCode.CREATED, resultTracciatoSalvato);
    } catch (error: any) {
      log.error(Colorize.bgRed("Errore in uploadTracciato: " + error)); log.error(Colorize.bgRed("Errore in uploadTracciato: " + error));
      // Non serve rimuovere file temporanei, multer memoryStorage
      this.handleError(res, error);
    }
  }

  private async uploadMateriale(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError({ message: "Nessun file caricato", i18nKey: 'errors.noFileUploaded' });
      }
      const result = await this.fileManagementService.uploadMateriale(req.file, req.body, req);
      this.sendResponse(res, HttpStatusCode.CREATED, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async uploadKitManuali(req: Request, res: Response): Promise<void> {
    try {
      const { idPromo, idKit } = req.params;
      const files = req.files as Express.Multer.File[];
      const metadata = JSON.parse(req.body.metadata);
      const result = await this.fileManagementService.uploadKitManuali(idPromo, idKit, files, metadata, req);
      this.sendResponse(res, HttpStatusCode.CREATED, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async replaceFileKitRuntime(req: Request, res: Response): Promise<void> {
    try {
      const { idFile } = req.params;
      if (!req.file) {
        throw new BadRequestError({ message: 'Nessun file fornito per la sostituzione.' });
      }
      const result = await this.fileManagementService.replaceFileKitRuntime(idFile, req.file, req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async uploadForzatoImmaginiOlimpo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'No file uploaded' });
        return;
      }
      const result = await this.fileManagementService.uploadForzatoImmaginiOlimpo(req.file, req.body.guidId, req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async updateImmagineReferenza(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'No file uploaded' });
        return;
      }
      const result = await this.fileManagementService.updateImmagineReferenza(req.file, req.body, req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async updateImmagineGruppoReferenza(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { message: 'No file uploaded' });
        return;
      }
      const result = await this.fileManagementService.updateImmagineGruppoReferenza(req.file, req.body, req);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async processRejectedZip(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError({ message: 'Nessun file ZIP caricato.' });
      }
      const rejectedFiles = JSON.parse(req.body.rejectedFiles);
      const zipBuffer = req.file.buffer;
      const results = await this.fileManagementService.processRejectedZip(zipBuffer, rejectedFiles);
      this.sendResponse(res, HttpStatusCode.OK, results);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  // --- File listing handlers ---

  private async getAllFiles(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.fileManagementService.getAllFiles(req.query.id as string);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllFilesDocumentale(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.body.page as string) || 1;
      const pageSize = parseInt(req.body.pageSize as string) || 10;
      const filters = req.body.filters as {
        idArea?: string;
        idCanale?: string;
        idTipoExport?: string;
        idFormato?: string;
        idPuntoVendita?: string;
        idLavorazione?: string;
        idCombinazione?: string;
        nome?: string;
      };
      const metadataFilter = req.body.metadataFilter as { field: string; value: string } | undefined;
      const result = await this.fileManagementService.getAllFilesDocumentale(page, pageSize, filters, metadataFilter);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllContenutiDigitali(req: Request, res: Response): Promise<void> {
    try {
      const metadataFilter = req.body.metadataFilter as { field: string; value: string } | undefined;
      const result = await this.fileManagementService.getAllContenutiDigitali(req.body.page, req.body.pageSize, req.body.filters, metadataFilter);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getProprietaMetaFilesRuntime(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.fileManagementService.getProprietaMetaFilesRuntime(req.query.id as string);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllCombinazioniRuntimePDF(req: Request, res: Response): Promise<void> {
    try {
      const codice = req.query.codice as string;
      const result = await this.fileManagementService.getAllCombinazioniRuntimePDF(codice);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getAllCombinazioniRuntimePDFWebPliant(req: Request, res: Response): Promise<void> {
    try {
      const { idArea, idCanale, idsKitDesign, idsTipiDiExport } = req.body;
      const result = await this.fileManagementService.getAllCombinazioniRuntimePDFWebPliant(idArea, idCanale, idsKitDesign, idsTipiDiExport);
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async getContenutoDigitali(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.fileManagementService.getContenutoDigitali();
      this.sendResponse(res, HttpStatusCode.OK, result);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  // --- Download handlers ---

  private async downloadPDFVolantino(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { fileName } = req.query;

      if (!id) {
        return this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: 'ID del PDF richiesto' });
      }

      const pdfUrl = `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${id}`;
      const response = await axios.get(pdfUrl, {
        responseType: 'stream',
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      if (response.status !== 200) {
        return this.sendResponse(res, HttpStatusCode.NOT_FOUND, { error: 'PDF non trovato sul server remoto' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'volantino.pdf'}"`);

      response.data.on('error', (streamError: Error) => {
        console.error('Errore durante lo streaming del PDF:', streamError);
        if (!res.headersSent) {
          this.sendResponse(res, HttpStatusCode.INTERNAL_SERVER_ERROR, { error: 'Errore durante il trasferimento del file' });
        }
      });

      response.data.pipe(res);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  private async downloadKitZip(req: Request, res: Response): Promise<void> {
    try {
      const { lavorazioneId, files } = req.body;
      if (!lavorazioneId || !files || !Array.isArray(files) || files.length === 0) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: 'Missing lavorazioneId or files' });
        return;
      }
      const zipBuffer = await this.fileManagementService.downloadFilesAsZip(files);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="kit_${lavorazioneId}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('Errore nella creazione dello ZIP:', error);
      if (!res.headersSent) {
        this.handleError(res, error as Error);
      }
    }
  }

  private async downloadPromoZip(req: Request, res: Response): Promise<void> {
    try {
      const { promoId, promoName, files } = req.body;
      if (!promoId || !files || !Array.isArray(files) || files.length === 0) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, { error: 'Missing promoId or files' });
        return;
      }
      const zipBuffer = await this.fileManagementService.downloadPromoFilesAsZip(files, promoName || promoId);
      const safePromoName = (promoName || promoId).replace(/[<>:"/\\|?*]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safePromoName}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error('Errore nella creazione dello ZIP della promo:', error);
      if (!res.headersSent) {
        this.handleError(res, error as Error);
      }
    }
  }


  private async mergeFiles(req: Request, res: Response): Promise<void> {
    try {
      const { files } = req.body as {
        files: Array<{
          id?: string;
          nome: string;
          id_olimpo_cloud: string;
          url_download?: string;
        }>;
      };

      if (!Array.isArray(files) || files.length < 2) {
        this.sendResponse(res, HttpStatusCode.BAD_REQUEST, {
          success: false,
          message: "Seleziona almeno 2 file per l'unione."
        });
        return;
      }

      this.sendResponse(res, HttpStatusCode.NOT_IMPLEMENTED, {
        success: false,
        message: 'mergePDF non ancora implementato. Endpoint pronto per futura integrazione API.'
      });
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }
}
