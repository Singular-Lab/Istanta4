import { Request, Response } from 'express';
import 'express-session';
import { HttpStatusCode } from '../../../lib/enums';
import { ValidationError } from '../../../lib/errors';
import { RootFileTree } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import { IContrattoTipografiaService } from '../interfaces/IContrattoTipografiaService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { GDO } from '../models/gdo';

type ContrattoTipografiaRequestBody = {
  id?: string;
  nome: string;
  idTipiExport: string[];
  idGdo?: string;
  contratto: RootFileTree;
  hostFtp?: string | null;
  userFtp?: string | null;
  pwdFtp?: string | null;
  portFtp?: number | string | null;
};

export class ContrattoTipografiaController extends BaseController {

  constructor(private contrattoTipografiaService: IContrattoTipografiaService) {
    super('/api');
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.router.put('/creaContrattoTipografia', authMiddleware, permissionGuard('impostazioni.gestisci_contratti_tipografia'), this.creaContrattoTipografia.bind(this));
    this.router.put('/updateContrattoTipografia', authMiddleware, permissionGuard('impostazioni.gestisci_contratti_tipografia'), this.updateContrattoTipografia.bind(this));
  }

  private async creaContrattoTipografia(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as ContrattoTipografiaRequestBody;
      const normalizedPort = this.normalizePortFtp(data.portFtp);
      if (normalizedPort === null || typeof normalizedPort === 'number') {
        data.portFtp = normalizedPort;
      }

      // HACK temporaneo per l'idGDO
      data.idGdo = (await GDO.findAll())[0].id_gdo as string;
      const result = await this.contrattoTipografiaService.creaContrattoTipografia(data.idGdo, {
        nome: data.nome,
        idTipiExport: data.idTipiExport,
        contratto: data.contratto,
        hostFtp: data.hostFtp,
        userFtp: data.userFtp,
        pwdFtp: data.pwdFtp,
        portFtp: data.portFtp as number | null | undefined
      });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      if (error instanceof Error && error.message === 'INVALID_FTP_PORT') {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Porta FTP non valida: deve essere un intero tra 0 e 65535' });
        return;
      }
      this.handleError(res, error);
    }
  }

  private async updateContrattoTipografia(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as ContrattoTipografiaRequestBody;
      if (!data) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Dati mancanti' });
        return;
      }
      if (!data.id) {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Id contratto mancante' });
        return;
      }

      const normalizedPort = this.normalizePortFtp(data.portFtp);
      if (normalizedPort === null || typeof normalizedPort === 'number') {
        data.portFtp = normalizedPort;
      } else {
        delete data.portFtp;
      }

      const payload: {
        id: string;
        nome: string;
        idTipiExport: string[];
        contratto: RootFileTree;
        hostFtp?: string | null;
        userFtp?: string | null;
        pwdFtp?: string | null;
        portFtp?: number | null;
      } = {
        id: data.id,
        nome: data.nome,
        idTipiExport: data.idTipiExport,
        contratto: data.contratto
      };

      if (Object.prototype.hasOwnProperty.call(data, 'hostFtp')) {
        payload.hostFtp = data.hostFtp ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'userFtp')) {
        payload.userFtp = data.userFtp ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'pwdFtp')) {
        payload.pwdFtp = data.pwdFtp ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(data, 'portFtp')) {
        payload.portFtp = (data.portFtp as number | null | undefined) ?? null;
      }

      const result = await this.contrattoTipografiaService.updateContrattoTipografia(payload);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error: any) {
      if (error instanceof Error && error.message === 'INVALID_FTP_PORT') {
        res.status(HttpStatusCode.BAD_REQUEST).json({ message: 'Porta FTP non valida: deve essere un intero tra 0 e 65535' });
        return;
      }
      this.handleError(res, error);
    }
  }

  private normalizePortFtp(value: unknown): number | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return null;
      }

      const parsedValueFromString = Number(trimmed);
      if (!Number.isInteger(parsedValueFromString) || parsedValueFromString < 0 || parsedValueFromString > 65535) {
        throw new ValidationError({ message: 'Porta FTP non valida', field: 'ftp_port', constraint: 'Deve essere un numero intero tra 0 e 65535' });
      }

      return parsedValueFromString;
    }

    if (typeof value !== 'number') {
      throw new ValidationError({ message: 'Porta FTP non valida', field: 'ftp_port', constraint: 'Deve essere un numero intero tra 0 e 65535' });
    }

    const parsedValue = value;
    if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 65535) {
      throw new ValidationError({ message: 'Porta FTP non valida', field: 'ftp_port', constraint: 'Deve essere un numero intero tra 0 e 65535' });
    }

    return parsedValue as number;
  }
}
