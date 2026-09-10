import { type WhereOptions } from 'sequelize';
import type { OrdiniDiStampaInviiAttributes } from '../../../lib/types';
import { OrdiniDiStampaInvii } from '../models/ordini_di_stampa_invii';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult, PaginationOptions } from './IBaseRepository';

type OrdiniStampaInviiInstance = InstanceType<typeof OrdiniDiStampaInvii>;

export interface OrdiniStampaInviiPaginationParams {
  page: number;
  pageSize: number;
  ordineStampaId?: string;
  utenteId?: string;
  sortBy?: 'createdat';
  sortDirection?: 'asc' | 'desc';
}

export interface IOrdiniStampaInviiRepository extends IBaseRepository<OrdiniStampaInviiInstance, string> {
  findByUtenteId(utenteId: string): Promise<OrdiniStampaInviiInstance[]>;
  findByOrdineStampaId(ordineStampaId: string): Promise<OrdiniStampaInviiInstance[]>;
  findLatestByOrdineStampa(ordineStampaId: string): Promise<OrdiniStampaInviiInstance | null>;
  findPaginated(params: OrdiniStampaInviiPaginationParams | PaginationOptions): Promise<PaginatedResult<OrdiniStampaInviiInstance>>;
  countByOrdineStampaId(ordineStampaId: string): Promise<number>;
  deleteByOrdineStampaId(ordineStampaId: string): Promise<number>;
}

export class OrdiniStampaInviiRepository
  extends BaseRepository<OrdiniStampaInviiInstance, OrdiniDiStampaInviiAttributes, string>
  implements IOrdiniStampaInviiRepository {

  constructor() {
    super(OrdiniDiStampaInvii, 'id_ordinistampainvii');
  }

  async findByUtenteId(utenteId: string): Promise<OrdiniStampaInviiInstance[]> {
    return this.findWhere({ idutente_ordinistampainvii: utenteId } as WhereOptions<OrdiniDiStampaInviiAttributes>);
  }

  async findByOrdineStampaId(ordineStampaId: string): Promise<OrdiniStampaInviiInstance[]> {
    return this.findWhere({ idordinestampa_ordinistampainvii: ordineStampaId } as WhereOptions<OrdiniDiStampaInviiAttributes>);
  }

  async findLatestByOrdineStampa(ordineStampaId: string): Promise<OrdiniStampaInviiInstance | null> {
    return this.model.findOne({
      where: { idordinestampa_ordinistampainvii: ordineStampaId } as WhereOptions<OrdiniDiStampaInviiAttributes>,
      order: [['createdat', 'DESC']]
    });
  }

  async findPaginated(params: OrdiniStampaInviiPaginationParams | PaginationOptions): Promise<PaginatedResult<OrdiniStampaInviiInstance>> {
    const normalizedParams: OrdiniStampaInviiPaginationParams = 'pageSize' in params
      ? params
      : {
          page: params.page,
          pageSize: params.limit
        };
    const {
      page,
      pageSize,
      ordineStampaId,
      utenteId,
      sortBy = 'createdat',
      sortDirection = 'desc'
    } = normalizedParams;

    const where: any = {};
    if (ordineStampaId) where.idordinestampa_ordinistampainvii = ordineStampaId;
    if (utenteId) where.idutente_ordinistampainvii = utenteId;

    const offset = (page - 1) * pageSize;

    const { rows, count } = await this.model.findAndCountAll({
      where,
      order: [[sortBy, sortDirection.toUpperCase() as 'ASC' | 'DESC']],
      limit: pageSize,
      offset,
      attributes: { exclude: ['excel_ordinistampainvii'] } // Exclude blob for performance
    });

    return {
      data: rows,
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  }

  async countByOrdineStampaId(ordineStampaId: string): Promise<number> {
    return this.countWhere({ idordinestampa_ordinistampainvii: ordineStampaId } as WhereOptions<OrdiniDiStampaInviiAttributes>);
  }

  async deleteByOrdineStampaId(ordineStampaId: string): Promise<number> {
    return this.model.destroy({
      where: { idordinestampa_ordinistampainvii: ordineStampaId } as WhereOptions<OrdiniDiStampaInviiAttributes>
    });
  }
}
