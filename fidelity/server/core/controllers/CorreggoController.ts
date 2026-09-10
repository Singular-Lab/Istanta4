import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORIA_ATTIVITA, EXPORT_DI_SISTEMA, HttpStatusCode, STATO_LOG_FILE, TIPO_ATTIVITA } from '../../../lib/enums';
import { ApplicationError, BadRequestError, UnauthorizedError } from '../../../lib/errors';
import { FileItemKitLog } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { IServiceFacade } from '../interfaces/IServiceFacade';
import { ServerUtils } from '../utils/ServerUtils';




export class CorreggoController extends BaseController {
  constructor(
    private kitRuntimeService: IKitRuntimeService,
    private facadeService: IServiceFacade
  ) {
    super('/api');
  }

  protected setupRoutes(): void {
    this.router.put("/notificaRisultatoPubblicazioneSuCorreggo", this.notificaRisultatoPubblicazioneSuCorreggo.bind(this));
  }

  private async notificaRisultatoPubblicazioneSuCorreggo(req: Request, res: Response): Promise<void> {
    try {
      const confrontoSecrete = req.headers["authorization"] === "Bearer " + config.FICO_SECRET;
      if (!confrontoSecrete) {
        throw new UnauthorizedError({
          message: "Secret non valida",
          details: { secret: req.headers["authorization"] }
        });
      }
      const { guidIdKitRuntime, id_vol, error, versione } = req.body as {
        guidIdKitRuntime: string;
        id_vol: string;
        error: string;
        versione: number;
      };
      const kit_runtime = await this.kitRuntimeService.getKitRuntimeById(guidIdKitRuntime);
      if (!kit_runtime) {
        throw new BadRequestError({
          message: "Kit runtime non trovato",
          details: { guidIdKitRuntime }
        });
      }
      const getAllTipiExport = await this.facadeService.getAllTipiExport();
      const containsCorreggo = kit_runtime.tipiDiExportInKit.find(tipo => getAllTipiExport.find(t => t.id === tipo.tipoDiExportGuidID)?.codice === EXPORT_DI_SISTEMA.CORREGGO);
      if (!containsCorreggo) {
        throw new ApplicationError({
          message: "Kit runtime non contiene il tipo di export Correggo",
          details: { guidIdKitRuntime },
          code: 'KIT_RUNTIME_NON_CONTENENTE_CORREGGO',
          name: 'KIT_RUNTIME_NON_CONTENENTE_CORREGGO',
          httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR
        });
      }
      // per il tipo di export correggo, è sempre presente un solo file,
      // quindi dobbiamo recuperare il file e passargli la versione nuova.
      const getFileKitRuntime = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(guidIdKitRuntime);
      if (!getFileKitRuntime) {
        throw new ApplicationError({
          message: "Non è presente nessun file per questo kit",
          details: { guidIdKitRuntime },
          code: 'KIT_RUNTIME_NON_CONTENENTE_FILE',
          name: 'KIT_RUNTIME_NON_CONTENENTE_FILE',
          httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR
        });
      }
      const tipoDiExportCorreggo = getAllTipiExport.find(tipo => tipo.codice === EXPORT_DI_SISTEMA.CORREGGO);
      const fileCorreggoTrovato = getFileKitRuntime.find(fileItemKit => {
        return fileItemKit.tipo_export === tipoDiExportCorreggo?.id;
      });
      if (!fileCorreggoTrovato) {
        throw new ApplicationError({
          message: "Non è presente un file con export CORREGGO in questo kit",
          details: { guidIdKitRuntime },
          code: 'KIT_RUNTIME_NON_CONTENENTE_FILE_CORREGGO',
          name: 'KIT_RUNTIME_NON_CONTENENTE_FILE_CORREGGO',
          httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR
        });
      }
      let logPerFileCorreggo = await this.kitRuntimeService.getFileRunTimeLogByNomeFileEIdKitRuntime(
        fileCorreggoTrovato.nome,
        guidIdKitRuntime
      );
      if (!logPerFileCorreggo) {
        const objLog: FileItemKitLog = {
          id: uuidv4(),
          guid_kit_runtime: guidIdKitRuntime,
          nome_file: fileCorreggoTrovato.nome,
          data_registrazione: new Date(),
          logs: [],
          stato: STATO_LOG_FILE.CORREGGO_PUBBLICATO,
          versione: 1
        }
        logPerFileCorreggo = objLog;
      }
      if (!logPerFileCorreggo.logs) {
        logPerFileCorreggo.logs = [];
      }

      // Determina lo stato revisione in base alla presenza di errori
      let messaggioLog: string;

      if (!error || error.trim() === "") {
        messaggioLog = 'Pubblicazione completata con successo su Correggo';
      } else {
        messaggioLog = `Errore pubblicazione su Correggo: ${error}`;
      }
      logPerFileCorreggo.logs.push({
        messaggio: messaggioLog,
        data_notifica: new Date(),
        azione: 'Upload',
        utente_notifica: 'system',
        dettagli_aggiuntivi: {
          nome_file: fileCorreggoTrovato.nome_originale,
          id_olimpo_cloud: '',
          tipo_export: tipoDiExportCorreggo?.id,
          tipo_export_codice: tipoDiExportCorreggo?.codice,
          versione_pubblicata_correggo: versione
        }
      });
      if (error != null && error != undefined && error != "") {
        logPerFileCorreggo.stato = STATO_LOG_FILE.CORREGGO_ERRORE;
      } else {
        logPerFileCorreggo.stato = STATO_LOG_FILE.CORREGGO_PUBBLICATO;
      }
      await this.kitRuntimeService.updateSingleFileRuntimeLog(logPerFileCorreggo as unknown as FileItemKitLog);
      await ServerUtils.CREA_ATTIVITA(null,
        TIPO_ATTIVITA.PUBBLICAZIONE_FILE_CORREGGO,
        CATEGORIA_ATTIVITA.PUBBLICAZIONE,
        {
          id_kit_runtime: guidIdKitRuntime,
          id_vol: id_vol,
          error: error,
          versione: versione,
        });

      res.status(HttpStatusCode.OK).json({
        message: "Notifica inviata con successo",
        details: { guidIdKitRuntime, id_vol, error, versione }
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

}
