import { AppError } from './AppError';
import { ErrorSource } from './types';

/**
 * Classe base per errori di dominio
 */
export class DomainError extends AppError {
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
      source: ErrorSource.DOMAIN
    });
  }
}
