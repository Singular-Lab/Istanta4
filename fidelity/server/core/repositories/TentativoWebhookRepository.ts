import { Op, type WhereOptions } from 'sequelize';
import { STATO_TENTATIVO_WEBHOOK } from '../../../lib/enums';
import { TentativoWebhook, type TentativoWebhookAttributes } from '../models/TentativoWebhook';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type TentativoWebhookInstance = InstanceType<typeof TentativoWebhook>;

export interface TentativoWebhookFilters {
  webhookId?: string;
  payloadId?: string;
  stato?: STATO_TENTATIVO_WEBHOOK;
  dateRange?: { start: Date; end: Date };
}

export interface TentativoWebhookPaginationParams {
  page: number;
  pageSize: number;
  filters?: TentativoWebhookFilters;
  sortBy?: 'createdat_tentativo' | 'numero_tentativo_tentativo' | 'durata_ms_tentativo';
  sortDirection?: 'asc' | 'desc';
}

export interface ITentativoWebhookRepository extends IBaseRepository<TentativoWebhookInstance, string> {
  findByWebhookId(webhookId: string): Promise<TentativoWebhookInstance[]>;
  findByPayloadId(payloadId: string): Promise<TentativoWebhookInstance[]>;
  findByStato(stato: STATO_TENTATIVO_WEBHOOK): Promise<TentativoWebhookInstance[]>;
  findPaginatedWithFilters(params: TentativoWebhookPaginationParams): Promise<PaginatedResult<TentativoWebhookInstance>>;
  countByWebhookId(webhookId: string): Promise<number>;
  countByStato(stato: STATO_TENTATIVO_WEBHOOK): Promise<number>;
  getLatestByWebhook(webhookId: string): Promise<TentativoWebhookInstance | null>;
  deleteByWebhookId(webhookId: string): Promise<number>;
  deleteOlderThan(date: Date): Promise<number>;
}

export class TentativoWebhookRepository
  extends BaseRepository<TentativoWebhookInstance, TentativoWebhookAttributes, string>
  implements ITentativoWebhookRepository {

  constructor() {
    super(TentativoWebhook, 'id_tentativo');
  }

  async findByWebhookId(webhookId: string): Promise<TentativoWebhookInstance[]> {
    return this.findWhere({ webhook_id_tentativo: webhookId } as WhereOptions<TentativoWebhookAttributes>);
  }

  async findByPayloadId(payloadId: string): Promise<TentativoWebhookInstance[]> {
    return this.findWhere({ payload_id_tentativo: payloadId } as WhereOptions<TentativoWebhookAttributes>);
  }

  async findByStato(stato: STATO_TENTATIVO_WEBHOOK): Promise<TentativoWebhookInstance[]> {
    return this.findWhere({ stato_tentativo: stato } as WhereOptions<TentativoWebhookAttributes>);
  }

  async findPaginatedWithFilters(params: TentativoWebhookPaginationParams): Promise<PaginatedResult<TentativoWebhookInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdat_tentativo',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.webhookId) whereConditions.push({ webhook_id_tentativo: filters.webhookId });
      if (filters.payloadId) whereConditions.push({ payload_id_tentativo: filters.payloadId });
      if (filters.stato) whereConditions.push({ stato_tentativo: filters.stato });
      if (filters.dateRange) {
        whereConditions.push({
          createdat_tentativo: {
            [Op.between]: [filters.dateRange.start, filters.dateRange.end]
          }
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

  async countByWebhookId(webhookId: string): Promise<number> {
    return this.countWhere({ webhook_id_tentativo: webhookId } as WhereOptions<TentativoWebhookAttributes>);
  }

  async countByStato(stato: STATO_TENTATIVO_WEBHOOK): Promise<number> {
    return this.countWhere({ stato_tentativo: stato } as WhereOptions<TentativoWebhookAttributes>);
  }

  async getLatestByWebhook(webhookId: string): Promise<TentativoWebhookInstance | null> {
    return this.model.findOne({
      where: { webhook_id_tentativo: webhookId } as WhereOptions<TentativoWebhookAttributes>,
      order: [['createdat_tentativo', 'DESC']]
    });
  }

  async deleteByWebhookId(webhookId: string): Promise<number> {
    return this.model.destroy({
      where: { webhook_id_tentativo: webhookId } as WhereOptions<TentativoWebhookAttributes>
    });
  }

  async deleteOlderThan(date: Date): Promise<number> {
    return this.model.destroy({
      where: {
        createdat_tentativo: { [Op.lt]: date }
      } as WhereOptions<TentativoWebhookAttributes>
    });
  }
}
