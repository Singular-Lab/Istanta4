import { ErrorCodes } from '../ErrorCodes';
import { InfrastructureError } from '../InfrastructureError';

/**
 * Opzioni per la creazione di un ExternalApiError
 */
export type ExternalApiErrorOptions = {
  message: string;
  service?: string;
  endpoint?: string;
  statusCode?: number;
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di API esterna
 * Rappresenta errori relativi alle chiamate a servizi esterni
 */
export class ExternalApiError extends InfrastructureError {
  constructor(options: ExternalApiErrorOptions) {
    super({
      name: 'ExternalApiError',
      message: options.message,
      code: ErrorCodes.EXTERNAL_API_ERROR,
      // Usa BAD_GATEWAY come default per errori di API esterne
      httpStatus: 502, // BAD_GATEWAY
      details: {
        service: options.service,
        endpoint: options.endpoint,
        statusCode: options.statusCode,
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });
  }
}
