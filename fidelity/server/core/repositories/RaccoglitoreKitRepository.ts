import { Op, type WhereOptions } from 'sequelize';
import { TIPO_KIT_DESIGN } from '../../../lib/enums';
import { RaccoglitoreKit, type RaccoglitoreKitAttributes } from '../models/raccoglitore_kit';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type RaccoglitoreKitInstance = InstanceType<typeof RaccoglitoreKit>;

export interface RaccoglitoreKitFilters {
  formatoId?: string;
  tipo?: TIPO_KIT_DESIGN;
  areaId?: string;
  canaleId?: string;
  search?: string;
}

export interface RaccoglitoreKitPaginationParams {
  page: number;
  pageSize: number;
  filters?: RaccoglitoreKitFilters;
  sortBy?: 'createdAt' | 'titolo' | 'quantita';
  sortDirection?: 'asc' | 'desc';
}

export interface IRaccoglitoreKitRepository extends IBaseRepository<RaccoglitoreKitInstance, string> {
  findByFormatoId(formatoId: string): Promise<RaccoglitoreKitInstance[]>;
  findByFormatiIds(formatoIds: string[]): Promise<RaccoglitoreKitInstance[]>;
  findByTipo(tipo: TIPO_KIT_DESIGN): Promise<RaccoglitoreKitInstance[]>;
  findByAreaId(areaId: string): Promise<RaccoglitoreKitInstance[]>;
  findByCanaleId(canaleId: string): Promise<RaccoglitoreKitInstance[]>;
  findPaginatedWithFilters(params: RaccoglitoreKitPaginationParams): Promise<PaginatedResult<RaccoglitoreKitInstance>>;
  search(query: string): Promise<RaccoglitoreKitInstance[]>;
  countByTipo(tipo: TIPO_KIT_DESIGN): Promise<number>;
}

export class RaccoglitoreKitRepository
  extends BaseRepository<RaccoglitoreKitInstance, RaccoglitoreKitAttributes, string>
  implements IRaccoglitoreKitRepository {

  constructor() {
    super(RaccoglitoreKit, 'id');
  }

  async findByFormatoId(formatoId: string): Promise<RaccoglitoreKitInstance[]> {
    return this.findWhere({ id_formato: formatoId } as WhereOptions<RaccoglitoreKitAttributes>);
  }

  async findByFormatiIds(formatoIds: string[]): Promise<RaccoglitoreKitInstance[]> {
    if (formatoIds.length === 0) return [];
    return this.model.findAll({
      where: {
        id_formato: { [Op.in]: formatoIds }
      } as WhereOptions<RaccoglitoreKitAttributes>
    });
  }

  async findByTipo(tipo: TIPO_KIT_DESIGN): Promise<RaccoglitoreKitInstance[]> {
    return this.findWhere({ tipo } as WhereOptions<RaccoglitoreKitAttributes>);
  }

  async findByAreaId(areaId: string): Promise<RaccoglitoreKitInstance[]> {
    return this.model.findAll({
      where: {
        id_aree: { [Op.contains]: [areaId] }
      } as WhereOptions<RaccoglitoreKitAttributes>
    });
  }

  async findByCanaleId(canaleId: string): Promise<RaccoglitoreKitInstance[]> {
    return this.model.findAll({
      where: {
        id_canali: { [Op.contains]: [canaleId] }
      } as WhereOptions<RaccoglitoreKitAttributes>
    });
  }

  async findPaginatedWithFilters(params: RaccoglitoreKitPaginationParams): Promise<PaginatedResult<RaccoglitoreKitInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.formatoId) whereConditions.push({ id_formato: filters.formatoId });
      if (filters.tipo) whereConditions.push({ tipo: filters.tipo });
      if (filters.areaId) whereConditions.push({ id_aree: { [Op.contains]: [filters.areaId] } });
      if (filters.canaleId) whereConditions.push({ id_canali: { [Op.contains]: [filters.canaleId] } });
      if (filters.search) {
        whereConditions.push({ titolo: { [Op.iLike]: `%${filters.search}%` } });
      }
    }

    const where = whereConditions.length > 0 ? { [Op.and]: whereConditions } : {};
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

  async search(query: string): Promise<RaccoglitoreKitInstance[]> {
    return this.model.findAll({
      where: {
        titolo: { [Op.iLike]: `%${query}%` }
      } as WhereOptions<RaccoglitoreKitAttributes>
    });
  }

  async countByTipo(tipo: TIPO_KIT_DESIGN): Promise<number> {
    return this.countWhere({ tipo } as WhereOptions<RaccoglitoreKitAttributes>);
  }
}
