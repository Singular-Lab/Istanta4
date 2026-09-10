/**
 * Base Repository Interface
 *
 * Defines the standard CRUD operations that all repositories must implement.
 * This provides a consistent data access layer abstraction.
 *
 * @typeParam T - The entity type
 * @typeParam TId - The ID type (typically string for UUID)
 */

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IBaseRepository<T, TId = string, TCreate = T> {
  /**
   * Find an entity by its ID
   */
  findById(id: TId): Promise<T | null>;

  /**
   * Find all entities
   */
  findAll(): Promise<T[]>;

  /**
   * Find entities with pagination
   */
  findPaginated(options: PaginationOptions): Promise<PaginatedResult<T>>;

  /**
   * Create a new entity
   */
  create(entity: Partial<TCreate>): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: TId, entity: Partial<TCreate>): Promise<T | null>;

  /**
   * Delete an entity by ID
   */
  delete(id: TId): Promise<boolean>;

  /**
   * Check if an entity exists
   */
  exists(id: TId): Promise<boolean>;

  /**
   * Count all entities
   */
  count(): Promise<number>;
}

/**
 * Extended repository interface for soft delete support
 */
export interface ISoftDeleteRepository<T, TId = string, TCreate = T> extends IBaseRepository<T, TId, TCreate> {
  /**
   * Soft delete an entity
   */
  softDelete(id: TId): Promise<boolean>;

  /**
   * Restore a soft-deleted entity
   */
  restore(id: TId): Promise<boolean>;

  /**
   * Find all including soft-deleted
   */
  findAllWithDeleted(): Promise<T[]>;
}
