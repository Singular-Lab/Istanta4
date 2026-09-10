import { ErrorCodes } from '../ErrorCodes';
import { InfrastructureError } from '../InfrastructureError';

/**
 * Opzioni per la creazione di un DatabaseError
 */
export type DatabaseErrorOptions = {
  message: string;
  operation?: string;
  entity?: string;
  query?: string;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di database
 * Rappresenta errori relativi alle operazioni sul database
 */
export class DatabaseError extends InfrastructureError {
  constructor(options: DatabaseErrorOptions) {
    super({
      name: 'DatabaseError',
      message: options.message,
      code: ErrorCodes.DATABASE_ERROR,
      httpStatus: 500, // INTERNAL_SERVER_ERROR
      details: {
        operation: options.operation,
        entity: options.entity,
        // Includi la query solo in ambiente di sviluppo
        ...(process.env.NODE_ENV !== 'production' && { query: options.query }),
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
