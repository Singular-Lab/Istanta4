import { Request, Response } from 'express';
import { CATEGORIA_ATTIVITA, HttpStatusCode, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_ORDINI_STAMPA, TIPO_ATTIVITA } from '../../../lib/enums';
import { NotFoundError } from '../../../lib/errors';
import { log } from '../logger';
import { OrdiniDiStampaAttributes, RUNTIME_KIT_MONGO } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import { IGdoService } from '../interfaces/IGdoService';
import { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { IOrdiniStampaService } from '../interfaces/IOrdiniStampaService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { AuditLogService } from '../services/AuditLogService';
import { ServerUtils } from '../utils/ServerUtils';

export class OrdiniDiStampaController extends BaseController {
  constructor(
    private ordiniStampaService: IOrdiniStampaService,
    private gdoService: IGdoService,
    private kitRuntimeService: IKitRuntimeService
  ) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/getOrdiniDiStampaInCorso', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getOrdiniDiStampaInCorso.bind(this));
    this.router.put('/creaOrdineDiStampa', authMiddleware, permissionGuard('ordini_stampa.crea'), this.creaOrdineDiStampa.bind(this));
    this.router.get('/getOrdineDiStampaById', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getOrdineDiStampaById.bind(this));
    this.router.get('/getAllOrdiniDiStampaFiniti', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getAllOrdiniDiStampaFiniti.bind(this));
    this.router.put('/iniziaFTPPopOlimpo', authMiddleware, permissionGuard('ordini_stampa.avvia_ftp'), this.iniziaFTPPopOlimpo.bind(this));
    this.router.get('/getDettagliOrdineDiStampa', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getDettagliOrdineDiStampa.bind(this));
    this.router.get('/getPromoDaIdStampa', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getPromoDaIdStampa.bind(this));
    this.router.get('/get_contratto_tipografia', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.get_contratto_tipografia.bind(this));
    this.router.get('/getFileFromOlimpo', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getFileFromOlimpo.bind(this));
    this.router.get('/getOrdiniInviiByOrdineStampa', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getOrdiniInviiByOrdineStampa.bind(this));
    this.router.get('/downloadReportExcel', authMiddleware, permissionGuard('ordini_stampa.download_report'), this.downloadReportExcel.bind(this));
    this.router.post('/ordini-stampa/group-files-by-equality', authMiddleware, permissionGuard('ordini_stampa.raggruppa_file'), this.groupFilesByEquality.bind(this));
    this.router.get('/ordini-stampa/group-files-status', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getGroupingStatus.bind(this));
    this.router.get('/ordini-stampa/virtual-directories', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getVirtualDirectories.bind(this));
    this.router.post('/ordini-stampa/merge-group', authMiddleware, permissionGuard('ordini_stampa.raggruppa_file'), this.mergeGroupFiles.bind(this));
    this.router.get('/ordini-stampa/merged-groups', authMiddleware, permissionGuard('ordini_stampa.visualizza'), this.getMergedGroups.bind(this));
    this.router.delete('/ordini-stampa/merged-groups/:mergedFileId', authMiddleware, permissionGuard('ordini_stampa.raggruppa_file'), this.deleteMergedGroup.bind(this));
  }

  private async getAllOrdiniDiStampa(req: Request, res: Response): Promise<void> {
    try {
      const ordini = await this.ordiniStampaService.getAllOrdiniDiStampaInCorso();
      res.status(HttpStatusCode.OK).json(ordini);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async creaOrdineDiStampa(req: Request, res: Response): Promise<void> {
    let { idPromo } = req.body;
    try {
      if (!idPromo) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idPromo non puÃ² essere vuoto' });
        return;
      }

      const idUtente = req.session?.id_utente;
      if (!idUtente) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idUtente non puÃ² essere vuoto' });
        return;
      }

      const data: OrdiniDiStampaAttributes = {
        id_promo_ordinistampa: idPromo,
        stato_ordinistampa: STATO_ORDINI_STAMPA.IN_REVISIONE,
        data_di_conferma_ordinistampa: new Date().toISOString(),
        idutente_ordinistampa: idUtente
      };

      const ordineCreato = await this.ordiniStampaService.creaOrdineDiStampa(data);
      if (!ordineCreato) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la creazione dell'ordine di stampa" });
        return;
      } else {
        await ServerUtils.CREA_ATTIVITA(
          idUtente,
          TIPO_ATTIVITA.CREAZIONE_ORDINE_DI_STAMPA,
          CATEGORIA_ATTIVITA.STAMPA,
          ordineCreato);
      }

      AuditLogService.getInstance().bulkOperation(req, 'ordine_stampa', 'create', { ordineId: ordineCreato.id_ordinistampa });
      res.status(HttpStatusCode.OK).json(ordineCreato);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getOrdineDiStampaById(req: Request, res: Response): Promise<void> {
    try {
      const ordine = await this.ordiniStampaService.getOrdineDiStampaById(req.query.id as string);
      res.status(HttpStatusCode.OK).json(ordine);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getOrdiniDiStampaInCorso(req: Request, res: Response): Promise<void> {
    try {
      const ordini = await this.ordiniStampaService.getAllOrdiniDiStampaInCorso();
      res.status(HttpStatusCode.OK).json(ordini);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async iniziaFTPPopOlimpo(req: Request, res: Response): Promise<void> {
    try {
      const { idOrdineDiStampa, kitIds } = req.body as { idOrdineDiStampa: string; kitIds: Record<string, boolean> };
      const socketId = `ftp_progress_${idOrdineDiStampa}_${Date.now()}`;

      AuditLogService.getInstance().bulkOperation(req, 'ordine_stampa', 'ftp_start', { ordineId: idOrdineDiStampa });
      res.status(HttpStatusCode.OK).json({
        esito: true,
        socketId,
        message: "Processo FTP avviato, connettiti al socket per monitorare l'avanzamento"
      });

      await this.ordiniStampaService.processFTPPopOlimpo({
        req,
        idOrdineDiStampa,
        kitIds,
        socketId
      });
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllOrdiniDiStampaFiniti(req: Request, res: Response): Promise<void> {
    try {
      const ordini = await this.ordiniStampaService.getAllOrdiniDiStampaFiniti();
      res.status(HttpStatusCode.OK).json(ordini);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getDettagliOrdineDiStampa(req: Request, res: Response): Promise<void> {
    try {
      const idOrdine = req.query.id as string;
      if (!idOrdine) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idOrdine non puÃ² essere vuoto' });
        return;
      }

      const ordine = await this.ordiniStampaService.getOrdineById(idOrdine);
      if (!ordine) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Ordine non trovato' });
        return;
      }

      const contratto = await this.ordiniStampaService.getContrattoTipografia();
      if (contratto == null) {
        throw new NotFoundError({
          message: "Contratto tipografia non trovato",
          entityType: "ContrattoTipografia",
          entityId: "0"
        });
      }
      const idPromo = ordine.id_promo_ordinistampa;
      let kitRuntimePromo = await this.kitRuntimeService.getAllKitRuntimeByIdPromo(idPromo) as RUNTIME_KIT_MONGO[];
      kitRuntimePromo = kitRuntimePromo.filter(kit => kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO);
      const kitFiltered = await Promise.all(kitRuntimePromo.map(async (kit) => {
        const tipiExportKit = kit.tipiDiExportInKit;
        const tipiExportContratto = contratto?.tipi_export;
        const tipiExportKitPresenti = tipiExportKit.filter((tipoExport) =>
          tipiExportContratto?.includes(tipoExport.tipoDiExportGuidID));
        return tipiExportKitPresenti.length > 0 ? kit : null;
      }));

      const kitFilteredNonNull = kitFiltered.filter(kit => kit !== null);
      res.status(HttpStatusCode.OK).json(kitFilteredNonNull);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPromoDaIdStampa(req: Request, res: Response): Promise<void> {
    try {
      const id = req.query.id as string;
      if (!id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'id non puÃ² essere vuoto' });
        return;
      }

      const promo = await this.ordiniStampaService.getPromoDaIdStampa(id);
      res.status(HttpStatusCode.OK).json(promo);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async get_contratto_tipografia(req: Request, res: Response): Promise<void> {
    try {
      const idUtente = req.session.id_utente as string;
      if (!idUtente) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Utente non autenticato' });
        return;
      }

      const contratto = await this.ordiniStampaService.getContrattoTipografia();
      res.status(HttpStatusCode.OK).json(contratto);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getFileFromOlimpo(req: Request, res: Response): Promise<void> {
    try {
      const id = req.query.id as string;
      if (!id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'id non puÃ² essere vuoto' });
        return;
      }

      const fileBuffer = await this.ordiniStampaService.getFileFromOlimpo(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.status(HttpStatusCode.OK).send(fileBuffer);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getOrdiniInviiByOrdineStampa(req: Request, res: Response): Promise<void> {
    try {
      const idOrdineDiStampa = req.query.id as string;
      if (!idOrdineDiStampa) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Id ordine di stampa mancante" });
        return;
      }

      const invii = await this.ordiniStampaService.getOrdiniInviiByOrdineStampa(idOrdineDiStampa);
      res.status(HttpStatusCode.OK).json(invii);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async downloadReportExcel(req: Request, res: Response): Promise<void> {
    try {
      const idInvio = req.query.id as string;
      if (!idInvio) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'id invio non puÃ² essere vuoto' });
        return;
      }

      const excelBuffer = await this.ordiniStampaService.getExcelReportBuffer(idInvio);
      if (!excelBuffer) {
        res.status(HttpStatusCode.NOT_FOUND).json({ message: 'Report Excel non trovato' });
        return;
      }

      AuditLogService.getInstance().dataExport(req, 'ordine_stampa');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report_stampa_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.status(HttpStatusCode.OK).send(excelBuffer);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async groupFilesByEquality(req: Request, res: Response): Promise<void> {
    try {
      const { idOrdineDiStampa } = req.body as { idOrdineDiStampa: string };
      const privateKey = req.session.private_key as string;

      if (!idOrdineDiStampa) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idOrdineDiStampa è obbligatorio' });
        return;
      }

      if (!privateKey) {
        res.status(HttpStatusCode.UNAUTHORIZED).json({ message: 'Sessione non valida o chiave privata assente' });
        return;
      }

      // If a job is already running for this order, return its socketId
      const existingJob = this.ordiniStampaService.getGroupingStatus(idOrdineDiStampa);
      if (existingJob && existingJob.status === 'running') {
        res.status(HttpStatusCode.OK).json({
          esito: true,
          socketId: existingJob.socketId,
          message: "Un processo di raggruppamento è già in corso"
        });
        return;
      }

      const socketId = `grouping_${idOrdineDiStampa}_${Date.now()}`;

      // Return immediately with socketId (same pattern as iniziaFTPPopOlimpo)
      res.status(HttpStatusCode.OK).json({
        esito: true,
        socketId,
        message: "Processo di raggruppamento avviato, connettiti al socket per monitorare l'avanzamento"
      });

      // Fire-and-forget async processing
      this.ordiniStampaService.groupFilesByEquality({
        req,
        idOrdineDiStampa,
        socketId
      }).catch((err) => {
        log.error('Errore non gestito in groupFilesByEquality', err);
      });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getGroupingStatus(req: Request, res: Response): Promise<void> {
    try {
      const idOrdineDiStampa = req.query.idOrdineDiStampa as string;

      if (!idOrdineDiStampa) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idOrdineDiStampa è obbligatorio' });
        return;
      }

      const job = this.ordiniStampaService.getGroupingStatus(idOrdineDiStampa);

      if (!job) {
        res.status(HttpStatusCode.OK).json({ status: 'idle' });
        return;
      }

      res.status(HttpStatusCode.OK).json(job);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getVirtualDirectories(req: Request, res: Response): Promise<void> {
    try {
      const idOrdineDiStampa = req.query.idOrdineDiStampa as string;

      if (!idOrdineDiStampa) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idOrdineDiStampa è obbligatorio' });
        return;
      }

      const directories = await this.ordiniStampaService.getVirtualDirectories({
        req,
        idOrdineDiStampa
      });

      res.status(HttpStatusCode.OK).json({ esito: true, directories });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async mergeGroupFiles(req: Request, res: Response): Promise<void> {
    try {
      const { idOrdineDiStampa, groupId, nome, virtualDir, files } = req.body;

      if (!idOrdineDiStampa || !groupId || !nome || !files || files.length === 0) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          message: 'idOrdineDiStampa, groupId, nome e files sono obbligatori'
        });
        return;
      }

      const result = await this.ordiniStampaService.mergeGroupFiles({
        idOrdineDiStampa,
        groupId,
        nome,
        virtualDir: virtualDir || '',
        files
      });

      res.status(HttpStatusCode.OK).json({ esito: true, mergedFile: result });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getMergedGroups(req: Request, res: Response): Promise<void> {
    try {
      const idOrdineDiStampa = req.query.idOrdineDiStampa as string;

      if (!idOrdineDiStampa) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'idOrdineDiStampa è obbligatorio' });
        return;
      }

      const mergedGroups = await this.ordiniStampaService.getMergedFilesByOrdine(idOrdineDiStampa);
      res.status(HttpStatusCode.OK).json({ esito: true, mergedGroups });
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async deleteMergedGroup(req: Request, res: Response): Promise<void> {
    try {
      const { mergedFileId } = req.params;
      const idOrdineDiStampa = req.query.idOrdineDiStampa as string;

      if (!idOrdineDiStampa || !mergedFileId) {
        res.status(HttpStatusCode.BAD_REQUEST).json({
          message: 'idOrdineDiStampa e mergedFileId sono obbligatori'
        });
        return;
      }

      await this.ordiniStampaService.deleteMergedGroup({
        idOrdineDiStampa,
        mergedFileId
      });

      res.status(HttpStatusCode.OK).json({ esito: true });
    } catch (error) {
      this.handleError(res, error);
    }
  }

}
