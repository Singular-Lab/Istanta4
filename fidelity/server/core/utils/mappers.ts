/**
 * Centralized DTO Mapping Utilities
 *
 * This module provides type-safe, reusable mapping functions to convert
 * between database models and DTOs (Data Transfer Objects).
 *
 * Benefits:
 * - Eliminates repetitive mapping code across services
 * - Type-safe transformations with explicit input/output types
 * - Centralized null/undefined handling
 * - Easy to maintain and update when DTO structure changes
 */

// ============================================
// GENERIC MAPPING UTILITIES
// ============================================

/**
 * Maps a single entity to a DTO using a provided mapper function
 */
export function mapToDTO<TEntity, TDTO>(
  entity: TEntity | null | undefined,
  mapper: (entity: TEntity) => TDTO
): TDTO | null {
  if (!entity) return null;
  return mapper(entity);
}

/**
 * Maps an array of entities to an array of DTOs
 */
export function mapArrayToDTO<TEntity, TDTO>(
  entities: TEntity[] | null | undefined,
  mapper: (entity: TEntity) => TDTO
): TDTO[] {
  if (!entities || !Array.isArray(entities)) return [];
  return entities.map(mapper);
}

/**
 * Maps a paginated result to DTOs
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function mapPaginatedToDTO<TEntity, TDTO>(
  result: { rows: TEntity[]; count: number },
  mapper: (entity: TEntity) => TDTO,
  page: number,
  pageSize: number
): PaginatedResult<TDTO> {
  return {
    data: mapArrayToDTO(result.rows, mapper),
    total: result.count,
    page,
    pageSize,
    totalPages: Math.ceil(result.count / pageSize)
  };
}

// ============================================
// COMMON FIELD TRANSFORMERS
// ============================================

/**
 * Safe string extraction with fallback
 */
export function safeString(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Safe number extraction with fallback
 */
export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * Safe boolean extraction with fallback
 */
export function safeBoolean(value: any, fallback: boolean = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

/**
 * Safe date extraction with fallback
 */
export function safeDate(value: any, fallback?: Date): Date | undefined {
  if (value === null || value === undefined) return fallback;
  const date = new Date(value);
  return isNaN(date.getTime()) ? fallback : date;
}

/**
 * Safe array extraction with fallback
 */
export function safeArray<T>(value: any, fallback: T[] = []): T[] {
  if (!value || !Array.isArray(value)) return fallback;
  return value;
}

/**
 * Transforms a date to ISO string or undefined
 */
export function dateToISOString(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString() : undefined;
}

/**
 * Transforms a date to timestamp or undefined
 */
export function dateToTimestamp(date: Date | null | undefined): number | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.getTime() : undefined;
}

// ============================================
// PICK/OMIT UTILITIES
// ============================================

/**
 * Picks specified keys from an object (type-safe)
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omits specified keys from an object (type-safe)
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete (result as any)[key];
  }
  return result as Omit<T, K>;
}

// ============================================
// MAPPER FACTORY
// ============================================

/**
 * Creates a typed mapper with validation
 */
export function createMapper<TEntity, TDTO>(
  mapFn: (entity: TEntity) => TDTO,
  options?: {
    validate?: (entity: TEntity) => boolean;
    onInvalid?: (entity: TEntity) => TDTO | null;
  }
): {
  map: (entity: TEntity | null | undefined) => TDTO | null;
  mapArray: (entities: TEntity[] | null | undefined) => TDTO[];
  mapPaginated: (
    result: { rows: TEntity[]; count: number },
    page: number,
    pageSize: number
  ) => PaginatedResult<TDTO>;
} {
  const validate = options?.validate ?? (() => true);
  const onInvalid = options?.onInvalid ?? (() => null);

  return {
    map: (entity) => {
      if (!entity) return null;
      if (!validate(entity)) return onInvalid(entity);
      return mapFn(entity);
    },
    mapArray: (entities) => {
      if (!entities || !Array.isArray(entities)) return [];
      return entities
        .filter(validate)
        .map(mapFn);
    },
    mapPaginated: (result, page, pageSize) => ({
      data: result.rows.filter(validate).map(mapFn),
      total: result.count,
      page,
      pageSize,
      totalPages: Math.ceil(result.count / pageSize)
    })
  };
}

// ============================================
// COMMON MODEL MAPPERS
// ============================================

/**
 * Common audit fields mapping
 */
export interface AuditFields {
  createdAt?: Date;
  updatedAt?: Date;
}

export function mapAuditFields(model: any): AuditFields {
  return {
    createdAt: safeDate(model.createdat || model.createdAt),
    updatedAt: safeDate(model.updatedat || model.updatedAt)
  };
}

/**
 * Maps model ID fields to a standardized format
 */
export function mapIdField(model: any, primaryKeyField: string): string {
  return safeString(model[primaryKeyField]);
}

// ============================================
// BATCH MAPPING UTILITIES
// ============================================

/**
 * Maps multiple entities in chunks to avoid memory issues
 */
export async function mapInChunks<TEntity, TDTO>(
  entities: TEntity[],
  mapper: (entity: TEntity) => Promise<TDTO> | TDTO,
  chunkSize: number = 100
): Promise<TDTO[]> {
  const results: TDTO[] = [];

  for (let i = 0; i < entities.length; i += chunkSize) {
    const chunk = entities.slice(i, i + chunkSize);
    const mappedChunk = await Promise.all(chunk.map(mapper));
    results.push(...mappedChunk);
  }

  return results;
}

/**
 * Maps with concurrency limit
 */
export async function mapWithConcurrency<TEntity, TDTO>(
  entities: TEntity[],
  mapper: (entity: TEntity) => Promise<TDTO>,
  concurrency: number = 10
): Promise<TDTO[]> {
  const results: TDTO[] = [];
  const executing: Promise<void>[] = [];

  for (const entity of entities) {
    const promise = mapper(entity).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}

// ============================================
// EXPORT DEFAULT UTILITIES
// ============================================

export default {
  mapToDTO,
  mapArrayToDTO,
  mapPaginatedToDTO,
  safeString,
  safeNumber,
  safeBoolean,
  safeDate,
  safeArray,
  dateToISOString,
  dateToTimestamp,
  pick,
  omit,
  createMapper,
  mapAuditFields,
  mapIdField,
  mapInChunks,
  mapWithConcurrency
};
