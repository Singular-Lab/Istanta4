/**
 * Sistema di gestione errori client
 * Replica la struttura degli errori del server per mantenere coerenza
 */

// Tipi di base
export * from './ErrorCodes';
export * from './types';

// Classe base per gli errori
export * from './AppError';

// Classi di errore principali
export * from './ApplicationError';
export * from './DomainError';
export * from './InfrastructureError';

// Errori di dominio
export * from './domain/BusinessError';
export * from './domain/NotFoundError';
export * from './domain/ValidationError';

// Errori di applicazione
export * from './application/BadRequestError';
export * from './application/ForbiddenError';
export * from './application/RateLimitError';
export * from './application/UnauthorizedError';

// Errori di infrastruttura
export * from './infrastructure/DatabaseError';
export * from './infrastructure/ExternalApiError';
export * from './infrastructure/ServiceUnavailableError';

// Utility per la gestione degli errori
export * from './errorUtils';

/**
 * Funzione di utilità per creare un errore AppError generico
 */
export { AppError } from './AppError';

/**
 * Funzione di utilità per verificare se un errore è un AppError
 */
export { isAppError } from './errorUtils';

/**
 * Funzione di utilità per serializzare un errore
 */
export { serializeError } from './errorUtils';

/**
 * Funzione di utilità per wrappare errori esterni
 */
export { wrapApiError, wrapDatabaseError, wrapExternalError } from './errorUtils';
