import { DomainError } from '../DomainError';
import { ErrorCodes } from '../ErrorCodes';

/**
 * Opzioni per la creazione di un ValidationError
 */
export type ValidationErrorOptions = {
  message: string;
  field?: string;
  value?: unknown;
  constraint?: string;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di validazione
 * Rappresenta errori di validazione dei dati di input
 */
export class ValidationError extends DomainError {
  constructor(options: ValidationErrorOptions) {
    super({
      name: 'ValidationError',
      message: options.message,
      code: ErrorCodes.VALIDATION_FAILED,
      httpStatus: 400, // BAD_REQUEST
      details: {
        field: options.field,
        value: options.value,
        constraint: options.constraint,
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
