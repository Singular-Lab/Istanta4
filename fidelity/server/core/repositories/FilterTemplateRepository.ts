import { Op, type WhereOptions } from 'sequelize';
import { FilterTemplate, type FilterTemplateAttributes, type FilterTemplateEndpointType } from '../models/filter_template';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type FilterTemplateInstance = InstanceType<typeof FilterTemplate>;

export interface FilterTemplateFilters {
  gdoId?: string;
  agenziaId?: string;
  endpointType?: FilterTemplateEndpointType;
  isActive?: boolean;
  isLatest?: boolean;
  creatoreId?: string;
  search?: string;
}

export interface FilterTemplatePaginationParams {
  page: number;
  pageSize: number;
  filters?: FilterTemplateFilters;
  sortBy?: 'createdat' | 'nome' | 'version';
  sortDirection?: 'asc' | 'desc';
}

export interface IFilterTemplateRepository extends IBaseRepository<FilterTemplateInstance, string> {
  findByGdoId(gdoId: string): Promise<FilterTemplateInstance[]>;
  findBySlug(slug: string, gdoId: string): Promise<FilterTemplateInstance | null>;
  findBySlugLatest(slug: string, gdoId: string): Promise<FilterTemplateInstance | null>;
  findByEndpointType(endpointType: FilterTemplateEndpointType): Promise<FilterTemplateInstance[]>;
  findActiveByGdo(gdoId: string): Promise<FilterTemplateInstance[]>;
  findLatestByGdo(gdoId: string): Promise<FilterTemplateInstance[]>;
  findPaginatedWithFilters(params: FilterTemplatePaginationParams): Promise<PaginatedResult<FilterTemplateInstance>>;
  search(query: string, gdoId?: string): Promise<FilterTemplateInstance[]>;
  countByGdoId(gdoId: string): Promise<number>;
  softDelete(id: string, deletedBy: string): Promise<FilterTemplateInstance | null>;
}

export class FilterTemplateRepository
  extends BaseRepository<FilterTemplateInstance, FilterTemplateAttributes, string>
  implements IFilterTemplateRepository {

  constructor() {
    super(FilterTemplate, 'id_filter_template');
  }

  async findByGdoId(gdoId: string): Promise<FilterTemplateInstance[]> {
    return this.findWhere({ id_gdo: gdoId } as WhereOptions<FilterTemplateAttributes>);
  }

  async findBySlug(slug: string, gdoId: string): Promise<FilterTemplateInstance | null> {
    return this.findOneWhere({
      slug,
      id_gdo: gdoId
    } as WhereOptions<FilterTemplateAttributes>);
  }

  async findBySlugLatest(slug: string, gdoId: string): Promise<FilterTemplateInstance | null> {
    return this.findOneWhere({
      slug,
      id_gdo: gdoId,
      is_latest: true
    } as WhereOptions<FilterTemplateAttributes>);
  }

  async findByEndpointType(endpointType: FilterTemplateEndpointType): Promise<FilterTemplateInstance[]> {
    return this.findWhere({ endpoint_type: endpointType } as WhereOptions<FilterTemplateAttributes>);
  }

  async findActiveByGdo(gdoId: string): Promise<FilterTemplateInstance[]> {
    return this.findWhere({
      id_gdo: gdoId,
      is_active: true,
      deleted_at: null
    } as WhereOptions<FilterTemplateAttributes>);
  }

  async findLatestByGdo(gdoId: string): Promise<FilterTemplateInstance[]> {
    return this.findWhere({
      id_gdo: gdoId,
      is_latest: true,
      deleted_at: null
    } as WhereOptions<FilterTemplateAttributes>);
  }

  async findPaginatedWithFilters(params: FilterTemplatePaginationParams): Promise<PaginatedResult<FilterTemplateInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdat',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [{ deleted_at: null }];

    if (filters) {
      if (filters.gdoId) whereConditions.push({ id_gdo: filters.gdoId });
      if (filters.agenziaId) whereConditions.push({ id_agenzia: filters.agenziaId });
      if (filters.endpointType) whereConditions.push({ endpoint_type: filters.endpointType });
      if (filters.isActive !== undefined) whereConditions.push({ is_active: filters.isActive });
      if (filters.isLatest !== undefined) whereConditions.push({ is_latest: filters.isLatest });
      if (filters.creatoreId) whereConditions.push({ id_utente_creatore: filters.creatoreId });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { nome: { [Op.iLike]: `%${filters.search}%` } },
            { slug: { [Op.iLike]: `%${filters.search}%` } },
            { descrizione: { [Op.iLike]: `%${filters.search}%` } }
          ]
        });
      }
    }

    const where = { [Op.and]: whereConditions };
    const offset = (page - 1) * pageSize;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [[sortBy, sortDirection.toUpperCase() as 'ASC' | 'DESC']],
      limit: pageSize,
      offset
    });

    return {
      data: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  }

  async search(query: string, gdoId?: string): Promise<FilterTemplateInstance[]> {
    const where: any = {
      deleted_at: null,
      [Op.or]: [
        { nome: { [Op.iLike]: `%${query}%` } },
        { slug: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (gdoId) {
      where.id_gdo = gdoId;
    }

    return this.model.findAll({ where });
  }

  async countByGdoId(gdoId: string): Promise<number> {
    return this.countWhere({
      id_gdo: gdoId,
      deleted_at: null
    } as WhereOptions<FilterTemplateAttributes>);
  }

  async softDelete(id: string, deletedBy: string): Promise<FilterTemplateInstance | null> {
    return this.update(id, {
      deleted_at: new Date(),
      deleted_by: deletedBy
    } as Partial<FilterTemplateAttributes>);
  }
}
