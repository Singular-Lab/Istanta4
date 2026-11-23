import { NextFunction, Request, Response } from 'express';
import { HttpStatusCode } from '../../../lib/enums';
import { AppError } from '../../../lib/errors/AppError';
import { ApplicationError } from '../../../lib/errors/ApplicationError';
import { BadRequestError } from '../../../lib/errors/application/BadRequestError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { GENERIC_ERROR_MESSAGE, redactErrorForClient, serializeError, wrapExternalError } from '../../../lib/errors/errorUtils';
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

  return (rawError: any, req: Request, res: Response, next: NextFunction): void => {
    // Errori del client nella lettura del corpo (JSON rotto, corpo troppo grande):
    // sono richieste sbagliate, non guasti. Messaggio fisso, nessun dettaglio interno.
    const errorePerCorpo = convertiErroreCorpoRichiesta(rawError);
    const error = errorePerCorpo ?? rawError;

    // Log dell'errore
    if (errorePerCorpo) {
      log.warn(`${req.method} ${req.originalUrl} - corpo della richiesta rifiutato (${rawError.type})`, {
        ip: req.ip,
        userId: req.session?.id_utente || 'guest',
      });
    } else {
      logger(error, req);
    }

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

/** Tipi di errore di body-parser che dipendono dal client e non dal server. */
const ERRORI_CORPO_RICHIESTA = new Set([
  'entity.parse.failed',
  'entity.too.large',
  'entity.verify.failed',
  'encoding.unsupported',
  'charset.unsupported',
  'request.aborted',
  'request.size.invalid',
  'stream.encoding.set',
  'parameters.too.many',
]);

/**
 * Converte un errore di body-parser (corpo non leggibile) in un errore applicativo
 * 4xx con messaggio fisso. Restituisce null per qualunque altro errore.
 */
export function convertiErroreCorpoRichiesta(errore: unknown): AppError | null {
  const error = errore as { type?: string; status?: number; statusCode?: number } | null | undefined;
  const status = Number(error?.status ?? error?.statusCode);
  if (!error || !error.type || !ERRORI_CORPO_RICHIESTA.has(error.type) || !(status >= 400 && status < 500)) {
    return null;
  }
  if (status === HttpStatusCode.PAYLOAD_TOO_LARGE) {
    return new ApplicationError({
      name: 'PayloadTooLargeError',
      message: 'Corpo della richiesta troppo grande',
      code: ErrorCodes.INVALID_REQUEST,
      httpStatus: status,
    });
  }
  return new BadRequestError({ message: 'Corpo della richiesta non valido' });
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
  const isApplicationError = error instanceof AppError;
  let toSerialize: unknown = error;

  if (!isApplicationError) {
    toSerialize = wrapExternalError(error, {
      message: error?.message || GENERIC_ERROR_MESSAGE,
      httpStatus: HttpStatusCode.INTERNAL_SERVER_ERROR,
    });
  }

  const serialized = redactErrorForClient(serializeError(toSerialize), isApplicationError);

  if (!includeStackTrace) {
    delete serialized.stack;
  }

  return serialized;
}
