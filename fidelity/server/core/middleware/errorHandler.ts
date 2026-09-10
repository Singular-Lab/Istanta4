import { NextFunction, Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { AppError } from '../../../lib/errors/AppError';
import { serializeError, wrapExternalError } from '../../../lib/errors/errorUtils';
import config from '../config/index';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';

/**
 * Opzioni per la configurazione del middleware di gestione errori
 */
export interface ErrorHandlerOptions {
  /**
   * Se true, include lo stack trace negli errori in ambiente di sviluppo
   * @default true
   */
  includeStackTrace?: boolean;

  /**
   * Funzione per il logging degli errori
   */
  logger?: (error: unknown, req: Request) => void;
}

/**
 * Middleware per la gestione centralizzata degli errori in Express
 */
export function errorHandler(options?: ErrorHandlerOptions) {
  const includeStackTrace = options?.includeStackTrace ?? true;
  const logger = options?.logger ?? defaultLogger;

  return (error: any, req: Request, res: Response, next: NextFunction): void => {
    // Log dell'errore
    logger(error, req);

    // Determina lo status code e il payload di risposta
    const statusCode = determineStatusCode(error);
    const payload = buildErrorPayload(error, req, includeStackTrace);

    // Audit log per errori 500
    if (statusCode >= 500) {
      AuditLogService.getInstance().systemError(req, 'unhandled_error', { message: error?.message, path: req?.path });
    }

    // Invia la risposta
    res.status(statusCode).json(payload);
  };
}

/**
 * Logger di default per gli errori non gestiti dal middleware Express
 */
function defaultLogger(error: any, req: Request): void {
  const ctx = { path: req.path, method: req.method };

  if (error instanceof AppError) {
    log.error(`[${error.code}] ${error.message}`, error, {
      ...ctx,
      httpStatus: error.httpStatus,
    });
  } else if (error instanceof Error) {
    log.error(error.message || 'Errore non gestito', error, ctx);
  } else {
    log.error('Errore sconosciuto nel middleware Express', null, {
      ...ctx,
      raw: String(error),
    });
  }
}

/**
 * Determina lo status code HTTP in base al tipo di errore
 */
function determineStatusCode(error: any): number {
  if (error instanceof AppError) {
    return error.httpStatus;
  }

  return HttpStatusCode.INTERNAL_SERVER_ERROR;
}

/**
 * Costruisce il payload di risposta per l'errore.
 * Wrappa errori non-AppError in InfrastructureError per garantire
 * che ogni risposta includa `source`, `code`, `httpStatus` —
 * il discriminante usato dal client (server_call.ts) per creare errori strutturati.
 */
function buildErrorPayload(error: NodeJS.ErrnoException, req: Request, includeStackTrace: boolean): Record<string, unknown> {
  let toSerialize: unknown = error;

  if (!(error instanceof AppError)) {
    toSerialize = wrapExternalError(error, {
      message: error?.message || 'Si è verificato un errore imprevisto',
      httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR,
    });
  }

  const serialized = serializeError(toSerialize);

  // In produzione, rimuovi lo stack trace
  if (config.NODE_ENV === 'production' || !includeStackTrace) {
    delete serialized.stack;
  }

  return serialized;
}
