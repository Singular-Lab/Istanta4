import { DomainError } from '../DomainError';
import { ErrorCodes } from '../ErrorCodes';

/**
 * Opzioni per la creazione di un BusinessError
 */
export type BusinessErrorOptions = {
  message: string;
  rule?: string;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di business
 * Rappresenta errori relativi a violazioni di regole di business
 */
export class BusinessError extends DomainError {
  constructor(options: BusinessErrorOptions) {
    super({
      name: 'BusinessError',
      message: options.message,
      code: ErrorCodes.BUSINESS_RULE_VIOLATION,
      httpStatus: 422, // UNPROCESSABLE_ENTITY
      details: {
        rule: options.rule,
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
