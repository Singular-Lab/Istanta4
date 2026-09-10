import { Op, type WhereOptions } from 'sequelize';
import { STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN } from '../../../lib/enums';
import type { RuntimeKitAttributes } from '../models/runtime_kit';
import { RuntimeKit } from '../models/runtime_kit';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type RuntimeKitInstance = InstanceType<typeof RuntimeKit>;

export interface RuntimeKitFilters {
  promoId?: string;
  areaId?: string;
  canaleId?: string;
  formatoId?: string;
  raccoglitoreId?: string;
  stato?: string;
  statoLavorazione?: STATO_LAVORAZIONE_KIT_RUNTIME;
  tipo?: TIPO_KIT_DESIGN;
}

export interface RuntimeKitPaginationParams {
  page: number;
  pageSize: number;
  filters?: RuntimeKitFilters;
  sortBy?: 'createdAt' | 'titolo' | 'stato_lavorazione';
  sortDirection?: 'asc' | 'desc';
}

export interface IRuntimeKitRepository extends IBaseRepository<RuntimeKitInstance, string> {
  findByPromoId(promoId: string): Promise<RuntimeKitInstance[]>;
  findByAreaId(areaId: string): Promise<RuntimeKitInstance[]>;
  findByCanaleId(canaleId: string): Promise<RuntimeKitInstance[]>;
  findByFormatoId(formatoId: string): Promise<RuntimeKitInstance[]>;
  findByRaccoglitoreId(raccoglitoreId: string): Promise<RuntimeKitInstance[]>;
  findByDesignId(designId: string): Promise<RuntimeKitInstance[]>;
  findByStatoLavorazione(stato: STATO_LAVORAZIONE_KIT_RUNTIME): Promise<RuntimeKitInstance[]>;
  findByTipo(tipo: TIPO_KIT_DESIGN): Promise<RuntimeKitInstance[]>;
  findPaginatedWithFilters(params: RuntimeKitPaginationParams): Promise<PaginatedResult<RuntimeKitInstance>>;
  countByPromoId(promoId: string): Promise<number>;
  countByStatoLavorazione(stato: STATO_LAVORAZIONE_KIT_RUNTIME): Promise<number>;
  updateStatoLavorazione(id: string, stato: STATO_LAVORAZIONE_KIT_RUNTIME): Promise<RuntimeKitInstance | null>;
  deleteByPromoId(promoId: string): Promise<number>;
}

export class RuntimeKitRepository
  extends BaseRepository<RuntimeKitInstance, RuntimeKitAttributes, string>
  implements IRuntimeKitRepository {

  constructor() {
    super(RuntimeKit, 'id');
  }

  async findByPromoId(promoId: string): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ id_promo: promoId } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByAreaId(areaId: string): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ id_area: areaId } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByCanaleId(canaleId: string): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ id_canale: canaleId } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByFormatoId(formatoId: string): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ id_formato: formatoId } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByRaccoglitoreId(raccoglitoreId: string): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ id_raccoglitore: raccoglitoreId } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByDesignId(designId: string): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ id_design: designId } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByStatoLavorazione(stato: STATO_LAVORAZIONE_KIT_RUNTIME): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ stato_lavorazione: stato } as WhereOptions<RuntimeKitAttributes>);
  }

  async findByTipo(tipo: TIPO_KIT_DESIGN): Promise<RuntimeKitInstance[]> {
    return this.findWhere({ tipo } as WhereOptions<RuntimeKitAttributes>);
  }

  async findPaginatedWithFilters(params: RuntimeKitPaginationParams): Promise<PaginatedResult<RuntimeKitInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.promoId) whereConditions.push({ id_promo: filters.promoId });
      if (filters.areaId) whereConditions.push({ id_area: filters.areaId });
      if (filters.canaleId) whereConditions.push({ id_canale: filters.canaleId });
      if (filters.formatoId) whereConditions.push({ id_formato: filters.formatoId });
      if (filters.raccoglitoreId) whereConditions.push({ id_raccoglitore: filters.raccoglitoreId });
      if (filters.stato) whereConditions.push({ stato: filters.stato });
      if (filters.statoLavorazione) whereConditions.push({ stato_lavorazione: filters.statoLavorazione });
      if (filters.tipo) whereConditions.push({ tipo: filters.tipo });
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

  async countByPromoId(promoId: string): Promise<number> {
    return this.countWhere({ id_promo: promoId } as WhereOptions<RuntimeKitAttributes>);
  }

  async countByStatoLavorazione(stato: STATO_LAVORAZIONE_KIT_RUNTIME): Promise<number> {
    return this.countWhere({ stato_lavorazione: stato } as WhereOptions<RuntimeKitAttributes>);
  }

  async updateStatoLavorazione(id: string, stato: STATO_LAVORAZIONE_KIT_RUNTIME): Promise<RuntimeKitInstance | null> {
    return this.update(id, { stato_lavorazione: stato } as Partial<RuntimeKitAttributes>);
  }

  async deleteByPromoId(promoId: string): Promise<number> {
    return this.model.destroy({
      where: { id_promo: promoId } as WhereOptions<RuntimeKitAttributes>
    });
  }
}
