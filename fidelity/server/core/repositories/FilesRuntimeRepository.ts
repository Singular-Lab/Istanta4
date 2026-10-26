import { Op, type WhereOptions } from 'sequelize';
import { FilesRuntime, type FilesRuntimeAttributes } from '../models/files_runtime';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type FilesRuntimeInstance = InstanceType<typeof FilesRuntime>;

export interface FilesRuntimeFilters {
  runtimeId?: string;
  tipoExport?: string;
  isOptional?: boolean;
  hasError?: boolean;
  search?: string;
}

export interface FilesRuntimePaginationParams {
  page: number;
  pageSize: number;
  filters?: FilesRuntimeFilters;
  sortBy?: 'createdAt' | 'nome' | 'tipo_export';
  sortDirection?: 'asc' | 'desc';
}

export interface IFilesRuntimeRepository extends IBaseRepository<FilesRuntimeInstance, string> {
  findByRuntimeId(runtimeId: string): Promise<FilesRuntimeInstance[]>;
  findByTipoExport(tipoExport: string): Promise<FilesRuntimeInstance[]>;
  findOptional(): Promise<FilesRuntimeInstance[]>;
  findWithErrors(): Promise<FilesRuntimeInstance[]>;
  findPaginatedWithFilters(params: FilesRuntimePaginationParams): Promise<PaginatedResult<FilesRuntimeInstance>>;
  countByRuntimeId(runtimeId: string): Promise<number>;
  deleteByRuntimeId(runtimeId: string): Promise<number>;
  search(query: string): Promise<FilesRuntimeInstance[]>;
}

export class FilesRuntimeRepository
  extends BaseRepository<FilesRuntimeInstance, FilesRuntimeAttributes, string>
  implements IFilesRuntimeRepository {

  constructor() {
    super(FilesRuntime, 'id');
  }

  async findByRuntimeId(runtimeId: string): Promise<FilesRuntimeInstance[]> {
    return this.findWhere({ id_runtime: runtimeId } as WhereOptions<FilesRuntimeAttributes>);
  }

  async findByTipoExport(tipoExport: string): Promise<FilesRuntimeInstance[]> {
    return this.findWhere({ tipo_export: tipoExport } as WhereOptions<FilesRuntimeAttributes>);
  }

  async findOptional(): Promise<FilesRuntimeInstance[]> {
    return this.findWhere({ is_optional: true } as WhereOptions<FilesRuntimeAttributes>);
  }

  async findWithErrors(): Promise<FilesRuntimeInstance[]> {
    return this.model.findAll({
      where: {
        error: { [Op.ne]: null }
      } as WhereOptions<FilesRuntimeAttributes>
    });
  }

  async findPaginatedWithFilters(params: FilesRuntimePaginationParams): Promise<PaginatedResult<FilesRuntimeInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.runtimeId) whereConditions.push({ id_runtime: filters.runtimeId });
      if (filters.tipoExport) whereConditions.push({ tipo_export: filters.tipoExport });
      if (filters.isOptional !== undefined) whereConditions.push({ is_optional: filters.isOptional });
      if (filters.hasError) whereConditions.push({ error: { [Op.ne]: null } });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { nome: { [Op.iLike]: `%${filters.search}%` } },
            { nome_originale: { [Op.iLike]: `%${filters.search}%` } }
          ]
        });
      }
    }

    const where = whereConditions.length > 0 ? { [Op.and]: whereConditions } : {};
    const offset = (page - 1) * pageSize;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [[sortBy, sortDirection.toUpperCase() as 'ASC' | 'DESC']],
      limit: pageSize,
      offset,
      attributes: { exclude: ['blob'] } // Exclude blob for performance
    });

    return {
      data: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  }

  async countByRuntimeId(runtimeId: string): Promise<number> {
    return this.countWhere({ id_runtime: runtimeId } as WhereOptions<FilesRuntimeAttributes>);
  }

  async deleteByRuntimeId(runtimeId: string): Promise<number> {
    return this.model.destroy({
      where: { id_runtime: runtimeId } as WhereOptions<FilesRuntimeAttributes>
    });
  }

  async search(query: string): Promise<FilesRuntimeInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { nome: { [Op.iLike]: `%${query}%` } },
          { nome_originale: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<FilesRuntimeAttributes>,
      attributes: { exclude: ['blob'] }
    });
  }
}
