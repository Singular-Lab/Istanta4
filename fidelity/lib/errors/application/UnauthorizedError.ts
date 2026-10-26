import { ApplicationError } from '../ApplicationError';
import { ErrorCodes } from '../ErrorCodes';

/**
 * Opzioni per la creazione di un UnauthorizedError
 */
export type UnauthorizedErrorOptions = {
  message: string;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di autenticazione
 * Rappresenta errori quando un utente non è autenticato o la sessione è scaduta
 */
export class UnauthorizedError extends ApplicationError {
  constructor(options: UnauthorizedErrorOptions) {
    super({
      name: 'UnauthorizedError',
      message: options.message || 'Authentication required',
      code: ErrorCodes.UNAUTHORIZED,
      httpStatus: 401, // UNAUTHORIZED
      details: options.details,
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
