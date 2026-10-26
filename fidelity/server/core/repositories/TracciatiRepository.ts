import { Op, type WhereOptions } from 'sequelize';
import type { TracciatiAttributes } from '../../../lib/types';
import { Tracciati } from '../models/tracciati';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type TracciatiInstance = InstanceType<typeof Tracciati>;

export interface TracciatiFilters {
  promoId?: string;
  stato?: string;
  filename?: string;
}

export interface TracciatiPaginationParams {
  page: number;
  pageSize: number;
  filters?: TracciatiFilters;
  sortBy?: 'createdat' | 'filename_tracciati';
  sortDirection?: 'asc' | 'desc';
}

export interface ITracciatiRepository extends IBaseRepository<TracciatiInstance, string> {
  findByIds(ids: string[]): Promise<TracciatiInstance[]>
  findByPromoId(promoId: string): Promise<TracciatiInstance[]>;
  findByStato(stato: string): Promise<TracciatiInstance[]>;
  findByFilename(filename: string): Promise<TracciatiInstance[]>;
  findPaginatedWithFilters(params: TracciatiPaginationParams): Promise<PaginatedResult<TracciatiInstance>>;
  countByPromoId(promoId: string): Promise<number>;
  deleteByPromoId(promoId: string): Promise<number>;
  findLatestByPromoId(promoId: string): Promise<TracciatiInstance | null>;
  findByDateRange(dataInizio: Date, dataFine: Date): Promise<TracciatiInstance[]>;
  findByUpdateDateRange(dataInizio: Date, dataFine: Date): Promise<TracciatiInstance[]>;
  search(query: string): Promise<TracciatiInstance[]>;
}

export class TracciatiRepository
  extends BaseRepository<TracciatiInstance, TracciatiAttributes, string>
  implements ITracciatiRepository {

  constructor() {
    super(Tracciati, 'id_tracciati');
  }

  async findByIds(ids: string[]): Promise<TracciatiInstance[]> {
    if (!ids.length) return [];

    return this.model.findAll({
      where: {
        id_tracciati: {
          [Op.in]: ids
        }
      } as WhereOptions<TracciatiAttributes>
    });
  }

  async findByPromoId(promoId: string): Promise<TracciatiInstance[]> {
    return this.findWhere({ id_promo_tracciati: promoId } as WhereOptions<TracciatiAttributes>);
  }

  async findByStato(stato: string): Promise<TracciatiInstance[]> {
    return this.findWhere({ stato_tracciati: stato } as WhereOptions<TracciatiAttributes>);
  }

  async findByFilename(filename: string): Promise<TracciatiInstance[]> {
    return this.model.findAll({
      where: {
        filename_tracciati: { [Op.iLike]: `%${filename}%` }
      } as WhereOptions<TracciatiAttributes>
    });
  }

  async findPaginatedWithFilters(params: TracciatiPaginationParams): Promise<PaginatedResult<TracciatiInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdat',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.promoId) whereConditions.push({ id_promo_tracciati: filters.promoId });
      if (filters.stato) whereConditions.push({ stato_tracciati: filters.stato });
      if (filters.filename) {
        whereConditions.push({ filename_tracciati: { [Op.iLike]: `%${filters.filename}%` } });
      }
    }

    const where = whereConditions.length > 0 ? { [Op.and]: whereConditions } : {};
    const offset = (page - 1) * pageSize;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [[sortBy, sortDirection.toUpperCase() as 'ASC' | 'DESC']],
      limit: pageSize,
      offset,
      attributes: { exclude: ['blobfile_tracciati'] } // Exclude blob for performance
    });

    return {
      data: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  }

  async countByPromoId(promoId: string): Promise<number> {
    return this.countWhere({ id_promo_tracciati: promoId } as WhereOptions<TracciatiAttributes>);
  }

  async deleteByPromoId(promoId: string): Promise<number> {
    return this.model.destroy({
      where: { id_promo_tracciati: promoId } as WhereOptions<TracciatiAttributes>
    });
  }

  async findLatestByPromoId(promoId: string): Promise<TracciatiInstance | null> {
    return this.model.findOne({
      where: { id_promo_tracciati: promoId } as WhereOptions<TracciatiAttributes>,
      order: [['createdat', 'DESC']]
    });
  }

  async findByDateRange(dataInizio: Date, dataFine: Date): Promise<TracciatiInstance[]> {
    return this.model.findAll({
      where: {
        createdat: { [Op.between]: [dataInizio, dataFine] }
      } as WhereOptions<TracciatiAttributes>
    });
  }

  async findByUpdateDateRange(dataInizio: Date, dataFine: Date): Promise<TracciatiInstance[]> {
    return this.model.findAll({
      where: {
        updatedat: { [Op.between]: [dataInizio, dataFine] }
      } as WhereOptions<TracciatiAttributes>
    });
  }

  async search(query: string): Promise<TracciatiInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { filename_tracciati: { [Op.iLike]: `%${query}%` } },
          { id_promo_tracciati: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<TracciatiAttributes>
    });
  }
}
