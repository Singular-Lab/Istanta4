import { Op, type WhereOptions } from 'sequelize';
import type { ReferenzeAttributes } from '../models/referenze';
import { Referenze } from '../models/referenze';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type ReferenzeInstance = InstanceType<typeof Referenze>;

export interface ReferenzeFilters {
  promoId?: string;
  runtimeKitId?: string;
  meccanica?: string;
  codiceBox?: string;
}

export interface ReferenzePaginationParams {
  page: number;
  pageSize: number;
  filters?: ReferenzeFilters;
  sortBy?: 'createdAt' | 'meccanica' | 'codice_box';
  sortDirection?: 'asc' | 'desc';
}

export interface IReferenzeRepository extends IBaseRepository<ReferenzeInstance, string> {
  findByPromoId(promoId: string): Promise<ReferenzeInstance[]>;
  findByRuntimeKitId(runtimeKitId: string): Promise<ReferenzeInstance[]>;
  findByMeccanica(meccanica: string): Promise<ReferenzeInstance[]>;
  findByCodiceBox(codiceBox: string): Promise<ReferenzeInstance | null>;
  findPaginatedWithFilters(params: ReferenzePaginationParams): Promise<PaginatedResult<ReferenzeInstance>>;
  countByPromoId(promoId: string): Promise<number>;
  countByRuntimeKitId(runtimeKitId: string): Promise<number>;
  deleteByPromoId(promoId: string): Promise<number>;
  deleteByRuntimeKitId(runtimeKitId: string): Promise<number>;
  findByPromoIdWithPagination(promoId: string, page: number, pageSize: number): Promise<PaginatedResult<ReferenzeInstance>>;
}

export class ReferenzeRepository
  extends BaseRepository<ReferenzeInstance, ReferenzeAttributes, string>
  implements IReferenzeRepository {

  constructor() {
    super(Referenze, 'id');
  }

  async findByPromoId(promoId: string): Promise<ReferenzeInstance[]> {
    return this.findWhere({ id_promo: promoId } as WhereOptions<ReferenzeAttributes>);
  }

  async findByRuntimeKitId(runtimeKitId: string): Promise<ReferenzeInstance[]> {
    return this.findWhere({ id_runtime_kit: runtimeKitId } as WhereOptions<ReferenzeAttributes>);
  }

  async findByMeccanica(meccanica: string): Promise<ReferenzeInstance[]> {
    return this.findWhere({ meccanica } as WhereOptions<ReferenzeAttributes>);
  }

  async findByCodiceBox(codiceBox: string): Promise<ReferenzeInstance | null> {
    return this.findOneWhere({ codice_box: codiceBox } as WhereOptions<ReferenzeAttributes>);
  }

  async findPaginatedWithFilters(params: ReferenzePaginationParams): Promise<PaginatedResult<ReferenzeInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.promoId) {
        whereConditions.push({ id_promo: filters.promoId });
      }
      if (filters.runtimeKitId) {
        whereConditions.push({ id_runtime_kit: filters.runtimeKitId });
      }
      if (filters.meccanica) {
        whereConditions.push({ meccanica: filters.meccanica });
      }
      if (filters.codiceBox) {
        whereConditions.push({ codice_box: { [Op.iLike]: `%${filters.codiceBox}%` } });
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

  async countByPromoId(promoId: string): Promise<number> {
    return this.countWhere({ id_promo: promoId } as WhereOptions<ReferenzeAttributes>);
  }

  async countByRuntimeKitId(runtimeKitId: string): Promise<number> {
    return this.countWhere({ id_runtime_kit: runtimeKitId } as WhereOptions<ReferenzeAttributes>);
  }

  async deleteByPromoId(promoId: string): Promise<number> {
    return this.model.destroy({
      where: { id_promo: promoId } as WhereOptions<ReferenzeAttributes>
    });
  }

  async deleteByRuntimeKitId(runtimeKitId: string): Promise<number> {
    return this.model.destroy({
      where: { id_runtime_kit: runtimeKitId } as WhereOptions<ReferenzeAttributes>
    });
  }

  async findByPromoIdWithPagination(promoId: string, page: number, pageSize: number): Promise<PaginatedResult<ReferenzeInstance>> {
    const offset = (page - 1) * pageSize;

    const { rows, count } = await this.model.findAndCountAll({
      where: { id_promo: promoId } as WhereOptions<ReferenzeAttributes>,
      order: [['createdAt', 'DESC']],
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
}
