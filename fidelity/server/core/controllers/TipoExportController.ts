import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { EXPORT_DI_SISTEMA, HttpStatusCode, MODALITA_TIPO_EXPORT, modalitaTipiDiExportReverseMapping } from '../../../lib/enums';
import { TipiDiExportAttributes } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { CreateTipiDiExportDTO } from '../dto';
import { ITipoExportService } from '../interfaces/ITipoExportService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';

export class TipoExportController extends BaseController {

  constructor(private tipoExportService: ITipoExportService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.put('/creaTipoExport', authMiddleware, permissionGuard('impostazioni.gestisci_tipo_export'), this.creaTipoExport.bind(this));
    this.router.get('/getTipoExportById/:id', authMiddleware, permissionGuard('impostazioni.gestisci_tipo_export'), this.getTipoExportById.bind(this));
    this.router.get('/get_all_tipi_export', authMiddleware, permissionGuard('impostazioni.gestisci_tipo_export'), this.getAllTipiExport.bind(this));
    this.router.get("/get_all_tipi_export_POP", authMiddleware, permissionGuard('impostazioni.gestisci_tipo_export'), this.getAllTipiExportPOP.bind(this))
    this.router.delete('/deleteTipiExport/:id', authMiddleware, permissionGuard('impostazioni.gestisci_tipo_export'), this.deleteTipiExport.bind(this));
  }

  private async creaTipoExport(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as TipiDiExportAttributes;
      if (data.nome_tipiexport == undefined || data.codice_tipiexport == undefined) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }
      //NOTE lo abbiamo disattivato perchè si è presentata la casistica in cui usano tutti lo stesso codice.
      // const tipoExport = await this.tipoExportService.getTipoExportByCodice(data.codice_tipiexport);
      // if (tipoExport != null) {
      //   res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Tipo di export già esistente" });
      //   return;
      // }

      const exportToCreate: CreateTipiDiExportDTO = {
        id: data.id_tipiexport ?? uuidv4(),
        nome: data.nome_tipiexport,
        codice: data.codice_tipiexport,
        guid_namingconvention: data.guid_namingconvention_tipiexport,
        filtri: data.filtri_tipiexport,
        modalita: data.modalita_tipiexport ?? MODALITA_TIPO_EXPORT.ESPORTA_PER_PAGINA,
      };

      const oggettoPerIstanta = {
        guidId: exportToCreate.id,
        titolo: exportToCreate.nome,
        codice: exportToCreate.codice,
        guidIdNamingConvention: exportToCreate.guid_namingconvention,
        modalita: data.modalita_tipiexport ? modalitaTipiDiExportReverseMapping[data.modalita_tipiexport] : undefined,
        filtro: exportToCreate.filtri
      };

      const resultIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/salvaTipoDiExport`,
        'PUT',
        oggettoPerIstanta
      );

      if (resultIstanta.data.esito == false) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la creazione del tipo di export in istanta", error: resultIstanta.data.error });
        return;
      }

      const result = await this.tipoExportService.creaTipoExport(exportToCreate);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getTipoExportById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.tipoExportService.getTipoExportById(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllTipiExport(req: Request, res: Response): Promise<void> {
    try {
      const tipiExport = await this.tipoExportService.getAllTipiExport();
      res.status(HttpStatusCode.OK).json(tipiExport);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async getAllTipiExportPOP(req: Request, res: Response): Promise<void> {
    try {
      const tipiExport = await this.tipoExportService.getTipiExportPerPOP();

      res.status(HttpStatusCode.OK).json(tipiExport);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async deleteTipiExport(req: Request, res: Response): Promise<void> {
    try {
      const idTipoExport = req.params.id;
      const resultChiamataIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/eliminaTipoDiExport/${idTipoExport}`,
        'PUT',
        undefined
      );
      if (resultChiamataIstanta.data.error != "") {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante l'eliminazione del tipo di export in istanta", error: resultChiamataIstanta.data.error });
        return;
      }
      if (resultChiamataIstanta.data.esito == false) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante l'eliminazione del tipo di export in istanta", error: resultChiamataIstanta.data.error });
        return;
      }
      const result = await this.tipoExportService.deleteTipoExport(idTipoExport as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
