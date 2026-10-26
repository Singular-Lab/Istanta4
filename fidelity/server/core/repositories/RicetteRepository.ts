import { Op, type WhereOptions } from 'sequelize';
import { Ricette, type RicetteAttributes } from '../models/ricette';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type RicetteInstance = InstanceType<typeof Ricette>;

export interface RicetteFilters {
  tipo?: string;
  stato?: string;
  search?: string;
}

export interface RicettePaginationParams {
  page: number;
  pageSize: number;
  filters?: RicetteFilters;
  sortBy?: 'createdAt' | 'titolo' | 'tipo' | 'stato';
  sortDirection?: 'asc' | 'desc';
}

export interface IRicetteRepository extends IBaseRepository<RicetteInstance, string> {
  findByTipo(tipo: string): Promise<RicetteInstance[]>;
  findByStato(stato: string): Promise<RicetteInstance[]>;
  findPaginatedWithFilters(params: RicettePaginationParams): Promise<PaginatedResult<RicetteInstance>>;
  search(query: string): Promise<RicetteInstance[]>;
  countByTipo(tipo: string): Promise<number>;
  countByStato(stato: string): Promise<number>;
}

export class RicetteRepository
  extends BaseRepository<RicetteInstance, RicetteAttributes, string>
  implements IRicetteRepository {

  constructor() {
    super(Ricette, 'id');
  }

  async findByTipo(tipo: string): Promise<RicetteInstance[]> {
    return this.findWhere({ tipo } as WhereOptions<RicetteAttributes>);
  }

  async findByStato(stato: string): Promise<RicetteInstance[]> {
    return this.findWhere({ stato } as WhereOptions<RicetteAttributes>);
  }

  async findPaginatedWithFilters(params: RicettePaginationParams): Promise<PaginatedResult<RicetteInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.tipo) whereConditions.push({ tipo: filters.tipo });
      if (filters.stato) whereConditions.push({ stato: filters.stato });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { titolo: { [Op.iLike]: `%${filters.search}%` } },
            { procedimento: { [Op.iLike]: `%${filters.search}%` } }
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

  async search(query: string): Promise<RicetteInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { titolo: { [Op.iLike]: `%${query}%` } },
          { procedimento: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<RicetteAttributes>
    });
  }

  async countByTipo(tipo: string): Promise<number> {
    return this.countWhere({ tipo } as WhereOptions<RicetteAttributes>);
  }

  async countByStato(stato: string): Promise<number> {
    return this.countWhere({ stato } as WhereOptions<RicetteAttributes>);
  }
}
