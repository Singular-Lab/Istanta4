import { Request, Response } from 'express';
import 'express-session';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import config from '../config';
import { CreateFormatiDTO, FormatiResponseDTO } from '../dto';
import { IFormatoService } from '../interfaces/IFormatoService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';

export class FormatoController extends BaseController {
  constructor(private formatoService: IFormatoService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.get('/get_all_formati', authMiddleware, permissionGuard('impostazioni.gestisci_formati'), this.getAllFormati.bind(this));
    this.router.put('/salvaFormato', authMiddleware, permissionGuard('impostazioni.gestisci_formati'), this.salvaFormato.bind(this));
    this.router.delete('/deleteFormato/:id', authMiddleware, permissionGuard('impostazioni.gestisci_formati'), this.deleteFormato.bind(this));
  }

  private async getAllFormati(req: Request, res: Response): Promise<void> {
    try {
      const formati = await this.formatoService.getAllFormati();
      res.status(HttpStatusCode.OK).json(formati);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async salvaFormato(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as FormatiResponseDTO;
      if (
        !ServerUtils.checkIfValueIsValid(data.nome) ||
        !ServerUtils.checkIfValueIsValid(data.descrizione) ||
        !ServerUtils.checkIfValueIsValid(data.codice) ||
        !ServerUtils.checkIfValueIsValid(data.tipo_lavorazione)
      ) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: "Dati mancanti" });
        return;
      }

      const formatoToCreate: CreateFormatiDTO = {
        id: data.id ?? uuidv4(),
        nome: data.nome,
        codice: data.codice,
        descrizione: data.descrizione,
        tipo_lavorazione: data.tipo_lavorazione,
      };

      const objToIstanta = {
        guidID: formatoToCreate.id,
        titolo: formatoToCreate.nome,
        codice: formatoToCreate.codice,
        descrizione: formatoToCreate.descrizione,
        tipo: formatoToCreate.tipo_lavorazione
      };

      const resultApi = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/salvaFormato`,
        'PUT',
        objToIstanta
      );
      if (resultApi.data.error != "") {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la creazione del formato in istanta", error: resultApi.data.error });
        return;
      }
      if (resultApi.data.esito == false) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante la creazione del formato in istanta", error: resultApi.data.error });
        return;
      }

      const resultCreate = await this.formatoService.createFormato(formatoToCreate);
      res.status(HttpStatusCode.OK).json(resultCreate);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }

  private async deleteFormato(req: Request, res: Response): Promise<void> {
    try {
      const idFormato = req.params.id;
      const resultIstanta = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/FicoProcess/eliminaFormato/' + idFormato,
        'PUT',
        undefined
      );
      if (!resultIstanta.data.esito && resultIstanta.data.error !== "") {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante l'eliminazione del formato in istanta", error: resultIstanta.data.error });
        return;
      }
      if (resultIstanta.data.esito == false) {
        res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({ message: "Errore durante l'eliminazione del formato in istanta", error: resultIstanta.data.error });
        return;
      }
      const result = await this.formatoService.deleteFormato(idFormato as string);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      this.handleError(res, error);
    }
  }
}
