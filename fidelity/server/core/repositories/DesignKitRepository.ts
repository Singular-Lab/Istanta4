import { Op, type WhereOptions } from 'sequelize';
import { TIPO_KIT_DESIGN } from '../../../lib/enums';
import type { DesignKitAttributes } from '../models/design_kit';
import { DesignKit } from '../models/design_kit';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type DesignKitInstance = InstanceType<typeof DesignKit>;

export interface DesignKitFilters {
  areaId?: string;
  canaleId?: string;
  formatoId?: string;
  raccoglitoreId?: string;
  stato?: string;
  tipo?: TIPO_KIT_DESIGN;
  search?: string;
}

export interface DesignKitPaginationParams {
  page: number;
  pageSize: number;
  filters?: DesignKitFilters;
  sortBy?: 'createdAt' | 'titolo' | 'stato';
  sortDirection?: 'asc' | 'desc';
}

export interface IDesignKitRepository extends IBaseRepository<DesignKitInstance, string> {
  findByAreaId(areaId: string): Promise<DesignKitInstance[]>;
  findByCanaleId(canaleId: string): Promise<DesignKitInstance[]>;
  findByFormatoId(formatoId: string): Promise<DesignKitInstance[]>;
  findByRaccoglitoreId(raccoglitoreId: string): Promise<DesignKitInstance[]>;
  findByTipo(tipo: TIPO_KIT_DESIGN): Promise<DesignKitInstance[]>;
  findByStato(stato: string): Promise<DesignKitInstance[]>;
  findPaginatedWithFilters(params: DesignKitPaginationParams): Promise<PaginatedResult<DesignKitInstance>>;
  search(query: string): Promise<DesignKitInstance[]>;
  countByTipo(tipo: TIPO_KIT_DESIGN): Promise<number>;
  countByStato(stato: string): Promise<number>;
}

export class DesignKitRepository
  extends BaseRepository<DesignKitInstance, DesignKitAttributes, string>
  implements IDesignKitRepository {

  constructor() {
    super(DesignKit, 'id');
  }

  async findByAreaId(areaId: string): Promise<DesignKitInstance[]> {
    return this.findWhere({ id_area: areaId } as WhereOptions<DesignKitAttributes>);
  }

  async findByCanaleId(canaleId: string): Promise<DesignKitInstance[]> {
    return this.findWhere({ id_canale: canaleId } as WhereOptions<DesignKitAttributes>);
  }

  async findByFormatoId(formatoId: string): Promise<DesignKitInstance[]> {
    return this.findWhere({ id_formato: formatoId } as WhereOptions<DesignKitAttributes>);
  }

  async findByRaccoglitoreId(raccoglitoreId: string): Promise<DesignKitInstance[]> {
    return this.findWhere({ id_raccoglitore: raccoglitoreId } as WhereOptions<DesignKitAttributes>);
  }

  async findByTipo(tipo: TIPO_KIT_DESIGN): Promise<DesignKitInstance[]> {
    return this.findWhere({ tipo } as WhereOptions<DesignKitAttributes>);
  }

  async findByStato(stato: string): Promise<DesignKitInstance[]> {
    return this.findWhere({ stato } as WhereOptions<DesignKitAttributes>);
  }

  async findPaginatedWithFilters(params: DesignKitPaginationParams): Promise<PaginatedResult<DesignKitInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.areaId) whereConditions.push({ id_area: filters.areaId });
      if (filters.canaleId) whereConditions.push({ id_canale: filters.canaleId });
      if (filters.formatoId) whereConditions.push({ id_formato: filters.formatoId });
      if (filters.raccoglitoreId) whereConditions.push({ id_raccoglitore: filters.raccoglitoreId });
      if (filters.stato) whereConditions.push({ stato: filters.stato });
      if (filters.tipo) whereConditions.push({ tipo: filters.tipo });
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

  async search(query: string): Promise<DesignKitInstance[]> {
    return this.model.findAll({
      where: {
        titolo: { [Op.iLike]: `%${query}%` }
      } as WhereOptions<DesignKitAttributes>
    });
  }

  async countByTipo(tipo: TIPO_KIT_DESIGN): Promise<number> {
    return this.countWhere({ tipo } as WhereOptions<DesignKitAttributes>);
  }

  async countByStato(stato: string): Promise<number> {
    return this.countWhere({ stato } as WhereOptions<DesignKitAttributes>);
  }
}
