import { ApplicationError } from '../ApplicationError';
import { ErrorCodes } from '../ErrorCodes';

/**
 * Opzioni per la creazione di un ForbiddenError
 */
export type ForbiddenErrorOptions = {
  message: string;
  resource?: string;
  action?: string;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di autorizzazione
 * Rappresenta errori quando un utente non ha i permessi necessari
 */
export class ForbiddenError extends ApplicationError {
  constructor(options: ForbiddenErrorOptions) {
    super({
      name: 'ForbiddenError',
      message: options.message || 'Access denied',
      code: ErrorCodes.FORBIDDEN,
      httpStatus: 403, // FORBIDDEN
      details: {
        resource: options.resource,
        action: options.action,
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
