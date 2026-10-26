import { ErrorCodes } from '../ErrorCodes';
import { InfrastructureError } from '../InfrastructureError';

/**
 * Opzioni per la creazione di un ServiceUnavailableError
 */
export type ServiceUnavailableErrorOptions = {
  message: string;
  service?: string;
  retryAfter?: number; // secondi
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di servizio non disponibile
 * Rappresenta errori quando un servizio è temporaneamente non disponibile
 */
export class ServiceUnavailableError extends InfrastructureError {
  readonly service?: string;
  readonly retryAfter?: number;

  constructor(options: ServiceUnavailableErrorOptions) {
    super({
      name: 'ServiceUnavailableError',
      message: options.message,
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      httpStatus: 503, // SERVICE_UNAVAILABLE
      details: {
        service: options.service,
        retryAfter: options.retryAfter,
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });

    this.service = options.service;
    this.retryAfter = options.retryAfter;
  }

  /**
   * Ottiene il messaggio utente appropriato
   */
  getUserMessage(): string {
    const service = this.service ? ` del servizio ${this.service}` : '';
    let message = `Servizio${service} temporaneamente non disponibile`;

    if (this.retryAfter) {
      const minutes = Math.ceil(this.retryAfter / 60);
      message += `. Riprova tra ${minutes} minuto${minutes > 1 ? 'i' : ''}`;
    } else {
      message += '. Riprova tra qualche minuto';
    }

    return message;
  }

  /**
   * Ottiene l'azione richiesta
   */
  getActionRequired(): string {
    if (this.retryAfter) {
      const minutes = Math.ceil(this.retryAfter / 60);
      return `Aspetta ${minutes} minuto${minutes > 1 ? 'i' : ''} prima di riprovare`;
    }

    return 'Riprova tra qualche minuto';
  }

  /**
   * Verifica se l'errore è retryable (sempre true per service unavailable)
   */
  canRetry(): boolean {
    return true;
  }
}
