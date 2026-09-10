import { Op, type FindOptions, type WhereOptions } from 'sequelize';
import { STATO_PROMO } from '../../../lib/enums';
import type { PromoAttributes } from '../models/promo';
import { Promo } from '../models/promo';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type PromoInstance = InstanceType<typeof Promo>;

export interface PromoFilters {
  gdoId?: string;
  stato?: STATO_PROMO;
  dataInizio?: Date;
  dataFine?: Date;
  search?: string;
}

export interface PromoPaginationParams {
  page: number;
  pageSize: number;
  filters?: PromoFilters;
  sortBy?: 'nome_promo' | 'validita_dal' | 'validita_al' | 'createdat';
  sortDirection?: 'asc' | 'desc';
}

interface FindByIdsOptions {
  attributes?: Array<keyof PromoAttributes>;
  order?: [keyof PromoAttributes, 'asc' | 'desc'];
}

export interface IPromoRepository extends IBaseRepository<PromoInstance, string> {
  findByGdoId(gdoId: string): Promise<PromoInstance[]>;
  findByStato(stato: STATO_PROMO): Promise<PromoInstance[]>;
  findByGdoAndStato(gdoId: string, stato: STATO_PROMO): Promise<PromoInstance[]>;
  findActiveByGdo(gdoId: string): Promise<PromoInstance[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<PromoInstance[]>;
  findPaginatedWithFilters(params: PromoPaginationParams): Promise<PaginatedResult<PromoInstance>>;
  search(query: string, gdoId?: string): Promise<PromoInstance[]>;
  countByGdoAndStato(gdoId: string, stato: STATO_PROMO): Promise<number>;
  updateStato(id: string, stato: STATO_PROMO): Promise<PromoInstance | null>;
  findActiveOnDate(date: Date): Promise<PromoInstance[]>;
  findActive(): Promise<PromoInstance[]>;
  findByIds(ids: string[], options?: FindByIdsOptions): Promise<PromoInstance[]>;
  findExpiredBefore(date: Date, orderDirection?: 'asc' | 'desc'): Promise<PromoInstance[]>;
  countByWhere(where: WhereOptions<PromoAttributes>): Promise<number>;
  findAllWithOptions(options: FindOptions<PromoAttributes>): Promise<PromoInstance[]>;
  findOneWithOptions(options: FindOptions<PromoAttributes>): Promise<PromoInstance | null>;
  countByStatoNotIn(stati: STATO_PROMO[]): Promise<number>;

}

export class PromoRepository
  extends BaseRepository<PromoInstance, PromoAttributes, string>
  implements IPromoRepository {

  constructor() {
    super(Promo, 'id_promo');
  }

  async findByGdoId(gdoId: string): Promise<PromoInstance[]> {
    return this.findWhere({ gdo: gdoId } as WhereOptions<PromoAttributes>);
  }

  async findByStato(stato: STATO_PROMO): Promise<PromoInstance[]> {
    return this.findWhere({ stato } as WhereOptions<PromoAttributes>);
  }

  async findByGdoAndStato(gdoId: string, stato: STATO_PROMO): Promise<PromoInstance[]> {
    return this.findWhere({ gdo: gdoId, stato } as WhereOptions<PromoAttributes>);
  }

  async findActiveByGdo(gdoId: string): Promise<PromoInstance[]> {
    return this.model.findAll({
      where: {
        gdo: gdoId,
        stato: STATO_PROMO.VALIDA
        // stato: { [Op.notIn]: [STATO_PROMO.ELIMINATA, STATO_PROMO.VALIDA] },
        // validita_dal: { [Op.lte]: now },
        // validita_al: { [Op.gte]: now }
      } as WhereOptions<PromoAttributes>
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<PromoInstance[]> {
    return this.model.findAll({
      where: {
        validita_dal: { [Op.gte]: startDate },
        validita_al: { [Op.lte]: endDate }
      } as WhereOptions<PromoAttributes>
    });
  }

  async findPaginatedWithFilters(params: PromoPaginationParams): Promise<PaginatedResult<PromoInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdat',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.gdoId) {
        whereConditions.push({ gdo: filters.gdoId });
      }
      if (filters.stato) {
        whereConditions.push({ stato: filters.stato });
      }
      if (filters.dataInizio) {
        whereConditions.push({ validita_dal: { [Op.gte]: filters.dataInizio } });
      }
      if (filters.dataFine) {
        whereConditions.push({ validita_al: { [Op.lte]: filters.dataFine } });
      }
      if (filters.search) {
        whereConditions.push({
          nome_promo: { [Op.iLike]: `%${filters.search}%` }
        });
      }
    }

    const where = whereConditions.length > 0
      ? { [Op.and]: whereConditions }
      : {};

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

  async search(query: string, gdoId?: string): Promise<PromoInstance[]> {
    const where: any = {
      nome_promo: { [Op.iLike]: `%${query}%` }
    };

    if (gdoId) {
      where.gdo = gdoId;
    }

    return this.model.findAll({ where });
  }

  async countByGdoAndStato(gdoId: string, stato: STATO_PROMO): Promise<number> {
    return this.countWhere({ gdo: gdoId, stato } as WhereOptions<PromoAttributes>);
  }

  async updateStato(id: string, stato: STATO_PROMO): Promise<PromoInstance | null> {
    return this.update(id, { stato } as Partial<PromoAttributes>);
  }

  async findActiveOnDate(date: Date): Promise<PromoInstance[]> {
    return this.model.findAll({
      where: {
        validita_dal: { [Op.lte]: date },
        validita_al: { [Op.gte]: date }
      } as WhereOptions<PromoAttributes>
    });
  }
  async findActive(): Promise<PromoInstance[]> {
    return this.model.findAll({
      where: {
        stato: STATO_PROMO.VALIDA
      } as WhereOptions<PromoAttributes>
    });
  }

  async findByIds(ids: string[], options?: FindByIdsOptions): Promise<PromoInstance[]> {
    if (!ids.length) {
      return [];
    }

    return this.model.findAll({
      where: {
        id_promo: { [Op.in]: ids }
      } as WhereOptions<PromoAttributes>,
      attributes: options?.attributes,
      order: options?.order
        ? [[options.order[0], options.order[1]?.toUpperCase() as 'ASC' | 'DESC']]
        : undefined
    });
  }

  async findExpiredBefore(date: Date, orderDirection: 'asc' | 'desc' = 'desc'): Promise<PromoInstance[]> {
    return this.model.findAll({
      where: {
        validita_al: { [Op.lt]: date }
      } as WhereOptions<PromoAttributes>,
      order: [['validita_al', orderDirection.toUpperCase() as 'ASC' | 'DESC']]
    });
  }

  async countByWhere(where: WhereOptions<PromoAttributes>): Promise<number> {
    return this.model.count({ where });
  }

  async findAllWithOptions(options: FindOptions<PromoAttributes>): Promise<PromoInstance[]> {
    return this.model.findAll(options);
  }

  async findOneWithOptions(options: FindOptions<PromoAttributes>): Promise<PromoInstance | null> {
    return this.model.findOne(options);
  }

  async countByStatoNotIn(stati: STATO_PROMO[]): Promise<number> {
    return this.model.count({
      where: {
        stato: { [Op.notIn]: stati }
      } as WhereOptions<PromoAttributes>
    });
  }
}
