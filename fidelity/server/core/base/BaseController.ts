import { Express, Response, Router } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { AppError, isAppError, serializeError, wrapExternalError } from '../../../lib/errors';
import { IController } from '../interfaces/IController';
import { log } from '../logger';

export abstract class BaseController implements IController {
  protected router: Router;
  protected basePath: string;

  constructor(basePath: string) {
    this.router = Router();
    this.basePath = basePath;
  }

  public initializeRoutes(): void {
    this.setupRoutes();
  }

  public registerRoutes(app: Express): void {
    // Initialize route handlers lazily and only if the controller has not already done it.
    if (this.router.stack.length === 0) {
      this.initializeRoutes();
    }

    app.use(this.basePath, this.router);
  }

  protected abstract setupRoutes(): void;

  protected sendResponse(res: Response, status: number, data: any): void {
    res.status(status).json(data);
  }

  /**
   * Gestisce gli errori in modo tipizzato, mappandoli al corretto status HTTP
   * @param res Response di Express
   * @param error Errore da gestire
   */
  protected handleError(res: Response, error: unknown): void {
    const req = (res as any).req;
    const ctx = { path: req?.path ?? '–', method: req?.method ?? '–' };

    if (isAppError(error)) {
      const appError = error as AppError;
      log.error(`[${appError.code}] ${appError.message}`, appError, {
        ...ctx,
        httpStatus: appError.httpStatus,
      });
      res.status(appError.httpStatus).json(serializeError(appError));
      return;
    }

    if (error instanceof Error) {
      log.error(error.message || 'Errore imprevisto nel controller', error, ctx);
      const wrappedError = wrapExternalError(error, {
        message: 'Si è verificato un errore imprevisto',
        httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR,
      });
      res.status(wrappedError.httpStatus).json(serializeError(wrappedError));
      return;
    }

    log.error('Errore sconosciuto nel controller', null, {
      ...ctx,
      raw: typeof error === 'string' ? error : JSON.stringify(error),
    });
    const unknownWrapped = wrapExternalError(
      new Error(typeof error === 'string' ? error : 'Si è verificato un errore sconosciuto'),
      {
        message: 'Si è verificato un errore sconosciuto',
        httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR,
      }
    );
    res.status(unknownWrapped.httpStatus).json(serializeError(unknownWrapped));
  }

  /**
   * Versione di handleError che restituisce la Response per i metodi che la richiedono
   * @param res Response di Express
   * @param error Errore da gestire
   * @returns Response di Express
   */
  protected handleErrorWithReturn(res: Response, error: unknown): Response {
    this.handleError(res, error);
    return res;
  }
}
