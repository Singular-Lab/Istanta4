import { ApplicationError } from '../ApplicationError';
import { ErrorCodes } from '../ErrorCodes';

/**
 * Opzioni per la creazione di un RateLimitError
 */
export type RateLimitErrorOptions = {
  message: string;
  limitType?: 'auth' | 'registration' | 'password_reset' | 'api' | 'custom';
  retryAfter?: number; // secondi
  i18nKey?: string;
  details?: Record<string, unknown>;
  cause?: Error;
};

/**
 * Errore di rate limiting
 * Rappresenta errori quando il limite di richieste è stato superato
 */
export class RateLimitError extends ApplicationError {
  readonly limitType?: string;
  readonly retryAfter?: number;

  constructor(options: RateLimitErrorOptions) {
    super({
      name: 'RateLimitError',
      message: options.message || 'Rate limit exceeded',
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      httpStatus: 429, // TOO_MANY_REQUESTS
      details: {
        limitType: options.limitType,
        retryAfter: options.retryAfter,
        ...options.details
      },
      i18nKey: options.i18nKey,
      cause: options.cause
    });

    this.limitType = options.limitType;
    this.retryAfter = options.retryAfter;
  }

  /**
   * Ottiene il messaggio utente appropriato per il tipo di rate limit
   */
  getUserMessage(): string {
    const messages = {
      auth: 'Troppi tentativi di accesso. Riprova tra qualche minuto.',
      registration: 'Troppi tentativi di registrazione. Riprova tra qualche minuto.',
      password_reset: 'Troppi tentativi di reset password. Riprova tra qualche minuto.',
      api: 'Troppe richieste. Riprova tra qualche minuto.',
      custom: 'Limite di richieste superato. Riprova tra qualche minuto.'
    };

    return messages[this.limitType as keyof typeof messages] || this.message;
  }

  /**
   * Ottiene l'azione richiesta per il rate limit
   */
  getActionRequired(): string {
    if (this.retryAfter) {
      const minutes = Math.ceil(this.retryAfter / 60);
      return `Aspetta ${minutes} minuto${minutes > 1 ? 'i' : ''} prima di riprovare`;
    }

    return 'Riprova tra qualche minuto';
  }

  /**
   * Verifica se l'errore è retryable (sempre true per rate limit)
   */
  canRetry(): boolean {
    return true;
  }
}
