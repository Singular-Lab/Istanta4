import { DomainError } from '../DomainError';

/**
 * Opzioni per la creazione di un NotFoundError
 */
export type NotFoundErrorOptions = {
  message: string;
  entityType: string;
  entityId?: string | number;
  i18nKey?: string;
  details?: Record<string, unknown>;
};

/**
 * Errore di risorsa non trovata
 * Rappresenta errori quando una risorsa richiesta non è stata trovata
 */
export class NotFoundError extends DomainError {
  constructor(options: NotFoundErrorOptions) {
    super({
      name: 'NotFoundError',
      message: options.message,
      // Genera un codice specifico per il tipo di entità o usa il generico NOT_FOUND
      code: `${options.entityType.toUpperCase()}_NOT_FOUND`,
      httpStatus: 404, // NOT_FOUND
      details: {
        entityType: options.entityType,
        entityId: options.entityId,
        ...options.details
      },
      i18nKey: options.i18nKey
    });
  }
}
