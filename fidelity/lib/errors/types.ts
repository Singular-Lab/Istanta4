/**
 * Classificazione delle fonti di errore (corrispondente al backend)
 */
export enum ErrorSource {
  DOMAIN = 'domain',
  APPLICATION = 'application',
  INFRASTRUCTURE = 'infrastructure'
}

/**
 * Opzioni per la creazione di un AppError
 */
export interface AppErrorOptions {
  name: string;
  message: string;
  code: string;
  httpStatus: number;
  source: ErrorSource;
  cause?: Error;
  details?: Record<string, unknown>;
  i18nKey?: string;
}
