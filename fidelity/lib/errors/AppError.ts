import { AppErrorOptions, ErrorSource } from './types';

/**
 * Classe base per tutti gli errori dell'applicazione
 * Estende Error con proprietà aggiuntive per tracciamento e gestione
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly source: ErrorSource;
  readonly details?: Record<string, unknown>;
  readonly cause?: Error;
  readonly i18nKey?: string;
  readonly timestamp: Date;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = options.name;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.source = options.source;
    this.cause = options.cause;
    this.details = options.details;
    this.i18nKey = options.i18nKey;
    this.timestamp = new Date();

    // Preserva lo stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converte l'errore in un oggetto JSON serializzabile
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      source: this.source,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      ...(this.cause && {
        cause: this.cause instanceof AppError
          ? this.cause.toJSON()
          : { message: this.cause.message }
      }),
    };
  }
}
