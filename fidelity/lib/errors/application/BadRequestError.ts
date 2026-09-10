import { ApplicationError } from '../ApplicationError';
import { ErrorCodes } from '../ErrorCodes';

/**
 * Opzioni per la creazione di un BadRequestError
 */
export type BadRequestErrorOptions = {
  message: string;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di richiesta non valida
 * Rappresenta errori quando la richiesta non è valida
 */
export class BadRequestError extends ApplicationError {
  constructor(options: BadRequestErrorOptions) {
    super({
      name: 'BadRequestError',
      message: options.message || 'Invalid request',
      code: ErrorCodes.INVALID_REQUEST,
      httpStatus: 400, // BAD_REQUEST
      details: options.details,
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
