import { AppError } from './AppError';
import { ErrorSource } from './types';

/**
 * Classe base per errori di applicazione
 */
export class ApplicationError extends AppError {
  constructor(options: {
    name: string;
    message: string;
    code: string;
    httpStatus: number;
    details?: Record<string, unknown>;
    i18nKey?: string;
    cause?: Error;
  }) {
    super({
      ...options,
      source: ErrorSource.APPLICATION
    });
  }
}
