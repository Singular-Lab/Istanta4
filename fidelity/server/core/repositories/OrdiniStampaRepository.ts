import { Op, type WhereOptions } from 'sequelize';
import { STATO_ORDINI_STAMPA } from '../../../lib/enums';
import type { OrdiniDiStampaAttributes } from '../../../lib/types';
import { OrdiniDiStampa } from '../models/ordini_di_stampa';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type OrdiniStampaInstance = InstanceType<typeof OrdiniDiStampa>;

export interface OrdiniStampaFilters {
  utenteId?: string;
  promoId?: string;
  stato?: STATO_ORDINI_STAMPA;
  dataInizio?: Date;
  dataFine?: Date;
}

export interface OrdiniStampaPaginationParams {
  page: number;
  pageSize: number;
  filters?: OrdiniStampaFilters;
  sortBy?: 'createdat' | 'data_di_conferma_ordinistampa' | 'stato_ordinistampa';
  sortDirection?: 'asc' | 'desc';
}

export interface IOrdiniStampaRepository extends IBaseRepository<OrdiniStampaInstance, string> {
  findByUtenteId(utenteId: string): Promise<OrdiniStampaInstance[]>;
  findByPromoId(promoId: string): Promise<OrdiniStampaInstance[]>;
  findByStato(stato: STATO_ORDINI_STAMPA): Promise<OrdiniStampaInstance[]>;
  findByUtenteAndStato(utenteId: string, stato: STATO_ORDINI_STAMPA): Promise<OrdiniStampaInstance[]>;
  findPaginatedWithFilters(params: OrdiniStampaPaginationParams): Promise<PaginatedResult<OrdiniStampaInstance>>;
  countByStato(stato: STATO_ORDINI_STAMPA): Promise<number>;
  countByUtenteAndStato(utenteId: string, stato: STATO_ORDINI_STAMPA): Promise<number>;
  updateStato(id: string, stato: STATO_ORDINI_STAMPA): Promise<OrdiniStampaInstance | null>;
  findPendingOlderThan(date: Date): Promise<OrdiniStampaInstance[]>;
}

export class OrdiniStampaRepository
  extends BaseRepository<OrdiniStampaInstance, OrdiniDiStampaAttributes, string>
  implements IOrdiniStampaRepository {

  constructor() {
    super(OrdiniDiStampa, 'id_ordinistampa');
  }

  async findByUtenteId(utenteId: string): Promise<OrdiniStampaInstance[]> {
    return this.findWhere({ idutente_ordinistampa: utenteId } as WhereOptions<OrdiniDiStampaAttributes>);
  }

  async findByPromoId(promoId: string): Promise<OrdiniStampaInstance[]> {
    return this.findWhere({ id_promo_ordinistampa: promoId } as WhereOptions<OrdiniDiStampaAttributes>);
  }

  async findByStato(stato: STATO_ORDINI_STAMPA): Promise<OrdiniStampaInstance[]> {
    return this.findWhere({ stato_ordinistampa: stato } as WhereOptions<OrdiniDiStampaAttributes>);
  }

  async findByUtenteAndStato(utenteId: string, stato: STATO_ORDINI_STAMPA): Promise<OrdiniStampaInstance[]> {
    return this.findWhere({
      idutente_ordinistampa: utenteId,
      stato_ordinistampa: stato
    } as WhereOptions<OrdiniDiStampaAttributes>);
  }

  async findPaginatedWithFilters(params: OrdiniStampaPaginationParams): Promise<PaginatedResult<OrdiniStampaInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdat',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.utenteId) {
        whereConditions.push({ idutente_ordinistampa: filters.utenteId });
      }
      if (filters.promoId) {
        whereConditions.push({ id_promo_ordinistampa: filters.promoId });
      }
      if (filters.stato) {
        whereConditions.push({ stato_ordinistampa: filters.stato });
      }
      if (filters.dataInizio) {
        whereConditions.push({ createdat: { [Op.gte]: filters.dataInizio } });
      }
      if (filters.dataFine) {
        whereConditions.push({ createdat: { [Op.lte]: filters.dataFine } });
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

  async countByStato(stato: STATO_ORDINI_STAMPA): Promise<number> {
    return this.countWhere({ stato_ordinistampa: stato } as WhereOptions<OrdiniDiStampaAttributes>);
  }

  async countByUtenteAndStato(utenteId: string, stato: STATO_ORDINI_STAMPA): Promise<number> {
    return this.countWhere({
      idutente_ordinistampa: utenteId,
      stato_ordinistampa: stato
    } as WhereOptions<OrdiniDiStampaAttributes>);
  }

  async updateStato(id: string, stato: STATO_ORDINI_STAMPA): Promise<OrdiniStampaInstance | null> {
    return this.update(id, { stato_ordinistampa: stato } as Partial<OrdiniDiStampaAttributes>);
  }

  async findPendingOlderThan(date: Date): Promise<OrdiniStampaInstance[]> {
    return this.model.findAll({
      where: {
        stato_ordinistampa: STATO_ORDINI_STAMPA.IN_REVISIONE,
        createdat: { [Op.lt]: date }
      } as WhereOptions<OrdiniDiStampaAttributes>
    });
  }
}
