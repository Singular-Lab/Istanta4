/**
 * Base Repository Implementation for Sequelize
 *
 * Provides generic CRUD operations using Sequelize ORM.
 * Extend this class to create entity-specific repositories.
 *
 * @example
 * ```typescript
 * class UserRepository extends BaseRepository<Utente, UtenteAttributes, string> {
 *   constructor() {
 *     super(Utente, 'id_utenti');
 *   }
 *
 *   async findByEmail(email: string): Promise<Utente | null> {
 *     return this.model.findOne({ where: { email_utenti: email } });
 *   }
 * }
 * ```
 */

import { Model, ModelStatic, WhereOptions, FindOptions, Order, Op } from 'sequelize';
import { IBaseRepository, PaginationOptions, PaginatedResult } from './IBaseRepository';
import { log } from '../logger';

export abstract class BaseRepository<
  TModel extends Model,
  TAttributes,
  TId = string
> implements IBaseRepository<TModel, TId, TAttributes> {

  protected readonly model: ModelStatic<TModel>;
  protected readonly primaryKey: string;

  constructor(model: ModelStatic<TModel>, primaryKey: string) {
    this.model = model;
    this.primaryKey = primaryKey;
  }

  /**
   * Find an entity by its ID
   */
  async findById(id: TId): Promise<TModel | null> {
    try {
      const where = { [this.primaryKey]: id } as WhereOptions<TAttributes>;
      return await this.model.findOne({ where });
    } catch (error) {
      log.error(`Repository findById error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name,
        id
      });
      throw error;
    }
  }

  /**
   * Find all entities
   */
  async findAll(): Promise<TModel[]> {
    try {
      return await this.model.findAll();
    } catch (error) {
      log.error(`Repository findAll error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }

  /**
   * Find entities with pagination
   */
  async findPaginated(options: PaginationOptions): Promise<PaginatedResult<TModel>> {
    try {
      const { page, limit, sortBy, sortOrder = 'ASC' } = options;
      const offset = (page - 1) * limit;

      const order: Order = sortBy ? [[sortBy, sortOrder]] : [];

      const { rows, count } = await this.model.findAndCountAll({
        limit,
        offset,
        order
      });

      return {
        data: rows,
        total: count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      log.error(`Repository findPaginated error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name,
        options
      });
      throw error;
    }
  }

  /**
   * Create a new entity
   */
  async create(entity: Partial<TAttributes>): Promise<TModel> {
    try {
      return await this.model.create(entity as any);
    } catch (error) {
      log.error(`Repository create error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }

  /**
   * Update an existing entity
   */
  async update(id: TId, entity: Partial<TAttributes>): Promise<TModel | null> {
    try {
      const where = { [this.primaryKey]: id } as WhereOptions<TAttributes>;
      const [affectedRows] = await this.model.update(entity as any, { where });

      if (affectedRows === 0) {
        return null;
      }

      return await this.findById(id);
    } catch (error) {
      log.error(`Repository update error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name,
        id
      });
      throw error;
    }
  }

  /**
   * Delete an entity by ID
   */
  async delete(id: TId): Promise<boolean> {
    try {
      const where = { [this.primaryKey]: id } as WhereOptions<TAttributes>;
      const deletedCount = await this.model.destroy({ where });
      return deletedCount > 0;
    } catch (error) {
      log.error(`Repository delete error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name,
        id
      });
      throw error;
    }
  }

  /**
   * Check if an entity exists
   */
  async exists(id: TId): Promise<boolean> {
    try {
      const where = { [this.primaryKey]: id } as WhereOptions<TAttributes>;
      const count = await this.model.count({ where });
      return count > 0;
    } catch (error) {
      log.error(`Repository exists error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name,
        id
      });
      throw error;
    }
  }

  /**
   * Count all entities
   */
  async count(): Promise<number> {
    try {
      return await this.model.count();
    } catch (error) {
      log.error(`Repository count error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }

  /**
   * Find entities by conditions
   */
  protected async findWhere(where: WhereOptions<TAttributes>, options?: FindOptions): Promise<TModel[]> {
    try {
      return await this.model.findAll({ where, ...options });
    } catch (error) {
      log.error(`Repository findWhere error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }

  /**
   * Find one entity by conditions
   */
  protected async findOneWhere(where: WhereOptions<TAttributes>, options?: FindOptions): Promise<TModel | null> {
    try {
      return await this.model.findOne({ where, ...options });
    } catch (error) {
      log.error(`Repository findOneWhere error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }

  /**
   * Count entities by conditions
   */
  protected async countWhere(where: WhereOptions<TAttributes>): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      log.error(`Repository countWhere error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }

  /**
   * Bulk create entities
   */
  async bulkCreate(entities: Partial<TAttributes>[]): Promise<TModel[]> {
    try {
      return await this.model.bulkCreate(entities as any[]);
    } catch (error) {
      log.error(`Repository bulkCreate error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name,
        count: entities.length
      });
      throw error;
    }
  }

  /**
   * Upsert an entity
   */
  async upsert(entity: Partial<TAttributes>): Promise<[TModel, boolean]> {
    try {
      return await this.model.upsert(entity as any);
    } catch (error) {
      log.error(`Repository upsert error`, error instanceof Error ? error : new Error(String(error)), {
        model: this.model.name
      });
      throw error;
    }
  }
}
