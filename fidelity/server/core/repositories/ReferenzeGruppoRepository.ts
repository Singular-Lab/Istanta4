import { Op, type WhereOptions } from 'sequelize';
import { ReferenzeGruppo, type ReferenzeGruppoAttributes } from '../models/referenze_gruppo';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type ReferenzeGruppoInstance = InstanceType<typeof ReferenzeGruppo>;

export interface ReferenzeGruppoFilters {
  gdoId?: string;
  areaId?: string;
  canaleId?: string;
  pvId?: string;
  attivo?: boolean;
  search?: string;
}

export interface ReferenzeGruppoPaginationParams {
  page: number;
  pageSize: number;
  filters?: ReferenzeGruppoFilters;
  sortBy?: 'createdAt' | 'nome_gruppo' | 'ordine';
  sortDirection?: 'asc' | 'desc';
}

export interface IReferenzeGruppoRepository extends IBaseRepository<ReferenzeGruppoInstance, string> {
  findByGdoId(gdoId: string): Promise<ReferenzeGruppoInstance[]>;
  findByAreaId(areaId: string): Promise<ReferenzeGruppoInstance[]>;
  findByCanaleId(canaleId: string): Promise<ReferenzeGruppoInstance[]>;
  findByPvId(pvId: string): Promise<ReferenzeGruppoInstance[]>;
  findActive(): Promise<ReferenzeGruppoInstance[]>;
  findActiveByGdo(gdoId: string): Promise<ReferenzeGruppoInstance[]>;
  findPaginatedWithFilters(params: ReferenzeGruppoPaginationParams): Promise<PaginatedResult<ReferenzeGruppoInstance>>;
  search(query: string, gdoId?: string): Promise<ReferenzeGruppoInstance[]>;
  countByGdoId(gdoId: string): Promise<number>;
}

export class ReferenzeGruppoRepository
  extends BaseRepository<ReferenzeGruppoInstance, ReferenzeGruppoAttributes, string>
  implements IReferenzeGruppoRepository {

  constructor() {
    super(ReferenzeGruppo, 'id');
  }

  async findByGdoId(gdoId: string): Promise<ReferenzeGruppoInstance[]> {
    return this.findWhere({ id_gdo: gdoId } as WhereOptions<ReferenzeGruppoAttributes>);
  }

  async findByAreaId(areaId: string): Promise<ReferenzeGruppoInstance[]> {
    return this.findWhere({ id_area: areaId } as WhereOptions<ReferenzeGruppoAttributes>);
  }

  async findByCanaleId(canaleId: string): Promise<ReferenzeGruppoInstance[]> {
    return this.findWhere({ id_canale: canaleId } as WhereOptions<ReferenzeGruppoAttributes>);
  }

  async findByPvId(pvId: string): Promise<ReferenzeGruppoInstance[]> {
    return this.findWhere({ id_pv: pvId } as WhereOptions<ReferenzeGruppoAttributes>);
  }

  async findActive(): Promise<ReferenzeGruppoInstance[]> {
    return this.model.findAll({
      where: { attivo: true } as WhereOptions<ReferenzeGruppoAttributes>,
      order: [['ordine', 'ASC']]
    });
  }

  async findActiveByGdo(gdoId: string): Promise<ReferenzeGruppoInstance[]> {
    return this.model.findAll({
      where: {
        id_gdo: gdoId,
        attivo: true
      } as WhereOptions<ReferenzeGruppoAttributes>,
      order: [['ordine', 'ASC']]
    });
  }

  async findPaginatedWithFilters(params: ReferenzeGruppoPaginationParams): Promise<PaginatedResult<ReferenzeGruppoInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'ordine',
      sortDirection = 'asc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.gdoId) whereConditions.push({ id_gdo: filters.gdoId });
      if (filters.areaId) whereConditions.push({ id_area: filters.areaId });
      if (filters.canaleId) whereConditions.push({ id_canale: filters.canaleId });
      if (filters.pvId) whereConditions.push({ id_pv: filters.pvId });
      if (filters.attivo !== undefined) whereConditions.push({ attivo: filters.attivo });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { nome_gruppo: { [Op.iLike]: `%${filters.search}%` } },
            { descrizione: { [Op.iLike]: `%${filters.search}%` } }
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

  async search(query: string, gdoId?: string): Promise<ReferenzeGruppoInstance[]> {
    const where: any = {
      [Op.or]: [
        { nome_gruppo: { [Op.iLike]: `%${query}%` } },
        { descrizione: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (gdoId) {
      where.id_gdo = gdoId;
    }

    return this.model.findAll({ where, order: [['ordine', 'ASC']] });
  }

  async countByGdoId(gdoId: string): Promise<number> {
    return this.countWhere({ id_gdo: gdoId } as WhereOptions<ReferenzeGruppoAttributes>);
  }
}
