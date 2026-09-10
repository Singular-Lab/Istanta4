import { Op, type WhereOptions } from 'sequelize';
import { EVENTI_WEBHOOK, STATO_WEBHOOK } from '../../../lib/enums';
import type { WebhookAttributes } from '../../../lib/types';
import { Webhook } from '../models/Webhook';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type WebhookInstance = InstanceType<typeof Webhook>;

export interface WebhookFilters {
  stato?: STATO_WEBHOOK;
  evento?: EVENTI_WEBHOOK;
  createdBy?: string;
  search?: string;
}

export interface WebhookPaginationParams {
  page: number;
  pageSize: number;
  filters?: WebhookFilters;
  sortBy?: 'createdat_webhook' | 'nome_webhook' | 'stato_webhook';
  sortDirection?: 'asc' | 'desc';
}

export interface IWebhookRepository extends IBaseRepository<WebhookInstance, string> {
  findByStato(stato: STATO_WEBHOOK): Promise<WebhookInstance[]>;
  findByEvento(evento: EVENTI_WEBHOOK): Promise<WebhookInstance[]>;
  findByCreatedBy(userId: string): Promise<WebhookInstance[]>;
  findActiveByEvento(evento: EVENTI_WEBHOOK): Promise<WebhookInstance[]>;
  findPaginatedWithFilters(params: WebhookPaginationParams): Promise<PaginatedResult<WebhookInstance>>;
  search(query: string): Promise<WebhookInstance[]>;
  updateStato(id: string, stato: STATO_WEBHOOK): Promise<WebhookInstance | null>;
  countByStato(stato: STATO_WEBHOOK): Promise<number>;
  countActive(): Promise<number>;
}

export class WebhookRepository
  extends BaseRepository<WebhookInstance, WebhookAttributes, string>
  implements IWebhookRepository {

  constructor() {
    super(Webhook, 'id_webhook');
  }

  async findByStato(stato: STATO_WEBHOOK): Promise<WebhookInstance[]> {
    return this.findWhere({ stato_webhook: stato } as WhereOptions<WebhookAttributes>);
  }

  async findByEvento(evento: EVENTI_WEBHOOK): Promise<WebhookInstance[]> {
    return this.model.findAll({
      where: {
        eventi_webhook: { [Op.contains]: [evento] }
      } as WhereOptions<WebhookAttributes>
    });
  }

  async findByCreatedBy(userId: string): Promise<WebhookInstance[]> {
    return this.findWhere({ createdby_webhook: userId } as WhereOptions<WebhookAttributes>);
  }

  async findActiveByEvento(evento: EVENTI_WEBHOOK): Promise<WebhookInstance[]> {
    return this.model.findAll({
      where: {
        stato_webhook: STATO_WEBHOOK.ATTIVO,
        eventi_webhook: { [Op.contains]: [evento] }
      } as WhereOptions<WebhookAttributes>
    });
  }

  async findPaginatedWithFilters(params: WebhookPaginationParams): Promise<PaginatedResult<WebhookInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'createdat_webhook',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.stato) whereConditions.push({ stato_webhook: filters.stato });
      if (filters.evento) whereConditions.push({ eventi_webhook: { [Op.contains]: [filters.evento] } });
      if (filters.createdBy) whereConditions.push({ createdby_webhook: filters.createdBy });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { nome_webhook: { [Op.iLike]: `%${filters.search}%` } },
            { descrizione_webhook: { [Op.iLike]: `%${filters.search}%` } },
            { url_webhook: { [Op.iLike]: `%${filters.search}%` } }
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

  async search(query: string): Promise<WebhookInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { nome_webhook: { [Op.iLike]: `%${query}%` } },
          { descrizione_webhook: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<WebhookAttributes>
    });
  }

  async updateStato(id: string, stato: STATO_WEBHOOK): Promise<WebhookInstance | null> {
    return this.update(id, { stato_webhook: stato } as Partial<WebhookAttributes>);
  }

  async countByStato(stato: STATO_WEBHOOK): Promise<number> {
    return this.countWhere({ stato_webhook: stato } as WhereOptions<WebhookAttributes>);
  }

  async countActive(): Promise<number> {
    return this.countWhere({ stato_webhook: STATO_WEBHOOK.ATTIVO } as WhereOptions<WebhookAttributes>);
  }
}
