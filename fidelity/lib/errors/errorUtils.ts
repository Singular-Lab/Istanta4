import { AppError } from './AppError';
import { ErrorCodes } from './ErrorCodes';
import { InfrastructureError } from './InfrastructureError';
import { ForbiddenError } from './application/ForbiddenError';
import { RateLimitError } from './application/RateLimitError';
import { NotFoundError } from './domain/NotFoundError';
import { DatabaseError } from './infrastructure/DatabaseError';
import { ExternalApiError } from './infrastructure/ExternalApiError';
import { ErrorSource } from './types';

/**
 * Type guard per verificare se un errore è un AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Converte un errore in una rappresentazione JSON sicura
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    };
  }

  return { message: String(error) };
}

/**
 * Wrappa errori esterni (es. da librerie o API) in un InfrastructureError
 */
export function wrapExternalError(
  error: unknown,
  options?: {
    code?: string;
    message?: string;
    httpStatus?: number;
    details?: Record<string, unknown>;
  }
): InfrastructureError {
  const defaultMessage = 'An external service error occurred';

  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InfrastructureError({
      name: 'ExternalError',
      message: options?.message || error.message || defaultMessage,
      code: options?.code || ErrorCodes.EXTERNAL_API_ERROR,
      httpStatus: options?.httpStatus || 502,
      cause: error,
      details: {
        originalError: error.name,
        originalMessage: error.message,
        ...options?.details
      }
    });
  }

  return new InfrastructureError({
    name: 'UnknownExternalError',
    message: options?.message || defaultMessage,
    code: options?.code || ErrorCodes.EXTERNAL_API_ERROR,
    httpStatus: options?.httpStatus || 502,
    details: {
      originalError: String(error),
      ...options?.details
    }
  });
}

/**
 * Wrappa errori di database
 */
export function wrapDatabaseError(
  error: unknown,
  options?: {
    message?: string;
    operation?: string;
    entity?: string;
    query?: string;
    details?: Record<string, unknown>;
  }
): DatabaseError {
  const defaultMessage = 'A database error occurred';

  return new DatabaseError({
    message: options?.message || (error instanceof Error ? error.message : defaultMessage),
    operation: options?.operation,
    entity: options?.entity,
    query: options?.query,
    details: options?.details,
    cause: error instanceof Error ? error : undefined
  });
}

/**
 * Wrappa errori di API esterne
 */
export function wrapApiError(
  error: unknown,
  options: {
    service: string;
    endpoint: string;
    statusCode?: number;
    message?: string;
    details?: Record<string, unknown>;
  }
): ExternalApiError {
  const defaultMessage = `Error calling ${options.service} API`;

  return new ExternalApiError({
    message: options.message || (error instanceof Error ? error.message : defaultMessage),
    service: options.service,
    endpoint: options.endpoint,
    statusCode: options.statusCode,
    details: options.details,
    cause: error instanceof Error ? error : undefined
  });
}

export function wrapNotFoundError(
  error: unknown,
  options?: {
    message?: string;
    entityType?: string;
    entityId?: string | number;
    details?: Record<string, unknown>;
  }
): NotFoundError {
  const defaultMessage = 'A not found error occurred';

  return new NotFoundError({
    message: options?.message || (error instanceof Error ? error.message : defaultMessage),
    entityType: options?.entityType || 'entity',
    entityId: options?.entityId || 'entityId',
    details: options?.details,
  });
}

export function wrapForbiddenError(
  error: unknown,
  options?: {
    message?: string;
    resource?: string;
    action?: string;
    details?: Record<string, unknown>;
  }
): ForbiddenError {
  const defaultMessage = 'A forbidden error occurred';
  return new ForbiddenError({
    message: options?.message || (error instanceof Error ? error.message : defaultMessage),
    resource: options?.resource || 'resource',
    action: options?.action || 'action',
    details: options?.details,
  });
}

/**
 * Wrappa errori di rate limiting
 */
export function wrapRateLimitError(
  error: unknown,
  options?: {
    message?: string;
    limitType?: 'auth' | 'registration' | 'password_reset' | 'api' | 'custom';
    retryAfter?: number;
    details?: Record<string, unknown>;
  }
): RateLimitError {
  const defaultMessage = 'Rate limit exceeded';

  return new RateLimitError({
    message: options?.message || (error instanceof Error ? error.message : defaultMessage),
    limitType: options?.limitType || 'custom',
    retryAfter: options?.retryAfter,
    details: options?.details,
    cause: error instanceof Error ? error : undefined
  });
}

export function wrapAppError(
  error: unknown,
  options?: {
    message?: string;
    details?: Record<string, unknown>;
  }
): AppError {
  return new AppError({
    message: options?.message || (error instanceof Error ? error.message : 'An application error occurred'),
    details: options?.details,
    name: 'ApplicationError',
    code: 'APPLICATION_ERROR',
    httpStatus: 500,
    source: ErrorSource.APPLICATION,
    cause: error instanceof Error ? error : undefined,
  });
}

/**
 * Invia un AppError serializzato come risposta HTTP.
 * Utility per middleware che devono rispondere direttamente
 * (non possono usare next(err) perché operano fuori dal pipeline Express principale).
 */
export function sendAppError(res: any, error: AppError): void {
  res.status(error.httpStatus).json(serializeError(error));
}
