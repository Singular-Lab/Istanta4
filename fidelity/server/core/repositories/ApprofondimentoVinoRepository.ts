import { Op, type WhereOptions } from 'sequelize';
import { ApprofondimentoVino, type ApprofondimentoVinoAttributes } from '../models/approfondimento_vino';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type ApprofondimentoVinoInstance = InstanceType<typeof ApprofondimentoVino>;

export interface ApprofondimentoVinoFilters {
  cantina?: string;
  anno?: number;
  vino?: string;
  provenienza?: string;
  colore?: string;
  search?: string;
}

export interface ApprofondimentoVinoPaginationParams {
  page: number;
  pageSize: number;
  filters?: ApprofondimentoVinoFilters;
  sortBy?: 'createdAt' | 'nome' | 'cantina' | 'anno';
  sortDirection?: 'asc' | 'desc';
}

export interface IApprofondimentoVinoRepository extends IBaseRepository<ApprofondimentoVinoInstance, string> {
  findByCodice(codice: string): Promise<ApprofondimentoVinoInstance | null>;
  findByCantina(cantina: string): Promise<ApprofondimentoVinoInstance[]>;
  findByAnno(anno: number): Promise<ApprofondimentoVinoInstance[]>;
  findByVino(vino: string): Promise<ApprofondimentoVinoInstance[]>;
  findByProvenienza(provenienza: string): Promise<ApprofondimentoVinoInstance[]>;
  findPaginatedWithFilters(params: ApprofondimentoVinoPaginationParams): Promise<PaginatedResult<ApprofondimentoVinoInstance>>;
  search(query: string): Promise<ApprofondimentoVinoInstance[]>;
  countByCantina(cantina: string): Promise<number>;
}

export class ApprofondimentoVinoRepository
  extends BaseRepository<ApprofondimentoVinoInstance, ApprofondimentoVinoAttributes, string>
  implements IApprofondimentoVinoRepository {

  constructor() {
    super(ApprofondimentoVino, 'id');
  }

  async findByCodice(codice: string): Promise<ApprofondimentoVinoInstance | null> {
    return this.findOneWhere({ codice } as WhereOptions<ApprofondimentoVinoAttributes>);
  }

  async findByCantina(cantina: string): Promise<ApprofondimentoVinoInstance[]> {
    return this.model.findAll({
      where: {
        cantina: { [Op.iLike]: `%${cantina}%` }
      } as WhereOptions<ApprofondimentoVinoAttributes>
    });
  }

  async findByAnno(anno: number): Promise<ApprofondimentoVinoInstance[]> {
    return this.findWhere({ anno } as WhereOptions<ApprofondimentoVinoAttributes>);
  }

  async findByVino(vino: string): Promise<ApprofondimentoVinoInstance[]> {
    return this.model.findAll({
      where: {
        vino: { [Op.iLike]: `%${vino}%` }
      } as WhereOptions<ApprofondimentoVinoAttributes>
    });
  }

  async findByProvenienza(provenienza: string): Promise<ApprofondimentoVinoInstance[]> {
    return this.model.findAll({
      where: {
        provenienza: { [Op.iLike]: `%${provenienza}%` }
      } as WhereOptions<ApprofondimentoVinoAttributes>
    });
  }

  async findPaginatedWithFilters(params: ApprofondimentoVinoPaginationParams): Promise<PaginatedResult<ApprofondimentoVinoInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.cantina) whereConditions.push({ cantina: { [Op.iLike]: `%${filters.cantina}%` } });
      if (filters.anno) whereConditions.push({ anno: filters.anno });
      if (filters.vino) whereConditions.push({ vino: { [Op.iLike]: `%${filters.vino}%` } });
      if (filters.provenienza) whereConditions.push({ provenienza: { [Op.iLike]: `%${filters.provenienza}%` } });
      if (filters.colore) whereConditions.push({ colore: { [Op.iLike]: `%${filters.colore}%` } });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { nome: { [Op.iLike]: `%${filters.search}%` } },
            { cantina: { [Op.iLike]: `%${filters.search}%` } },
            { vino: { [Op.iLike]: `%${filters.search}%` } },
            { codice: { [Op.iLike]: `%${filters.search}%` } }
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

  async search(query: string): Promise<ApprofondimentoVinoInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { nome: { [Op.iLike]: `%${query}%` } },
          { cantina: { [Op.iLike]: `%${query}%` } },
          { vino: { [Op.iLike]: `%${query}%` } },
          { codice: { [Op.iLike]: `%${query}%` } },
          { provenienza: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<ApprofondimentoVinoAttributes>
    });
  }

  async countByCantina(cantina: string): Promise<number> {
    return this.model.count({
      where: {
        cantina: { [Op.iLike]: `%${cantina}%` }
      } as WhereOptions<ApprofondimentoVinoAttributes>
    });
  }
}
