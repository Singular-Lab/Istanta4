import { Op, type WhereOptions } from 'sequelize';
import { StatisticheApi } from '../models/statistiche_api';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type StatisticheApiInstance = InstanceType<typeof StatisticheApi>;

// Define attributes interface locally since it's not exported from the model
interface StatisticheApiAttributes {
  id_statistiche_api: number;
  endpoint: string;
  metodo: string;
  codice_risposta: number;
  tempo_risposta_ms: number;
  dimensione_risposta_bytes: number;
  ip_richiedente: string;
  user_agent: string;
  ruolo_utente: string;
  api_key_utilizzata: string;
  parametri_richiesta: string;
  timestamp_richiesta: Date;
  timestamp_risposta: Date;
  errore: string | null;
  stack_trace: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StatisticheApiFilters {
  endpoint?: string;
  metodo?: string;
  codiceRisposta?: number;
  codiceRispostaRange?: { min: number; max: number };
  ruoloUtente?: string;
  hasError?: boolean;
  dateRange?: { start: Date; end: Date };
}

export interface StatisticheApiPaginationParams {
  page: number;
  pageSize: number;
  filters?: StatisticheApiFilters;
  sortBy?: 'timestamp_richiesta' | 'tempo_risposta_ms' | 'endpoint';
  sortDirection?: 'asc' | 'desc';
}

export interface IStatisticheApiRepository extends IBaseRepository<StatisticheApiInstance, number> {
  findByEndpoint(endpoint: string): Promise<StatisticheApiInstance[]>;
  findByMetodo(metodo: string): Promise<StatisticheApiInstance[]>;
  findByRuoloUtente(ruolo: string): Promise<StatisticheApiInstance[]>;
  findWithErrors(): Promise<StatisticheApiInstance[]>;
  findByDateRange(start: Date, end: Date): Promise<StatisticheApiInstance[]>;
  findPaginatedWithFilters(params: StatisticheApiPaginationParams): Promise<PaginatedResult<StatisticheApiInstance>>;
  countByEndpoint(endpoint: string): Promise<number>;
  countByMetodo(metodo: string): Promise<number>;
  countErrors(): Promise<number>;
  getAverageResponseTime(endpoint?: string): Promise<number>;
  deleteOlderThan(date: Date): Promise<number>;
}

export class StatisticheApiRepository
  extends BaseRepository<StatisticheApiInstance, StatisticheApiAttributes, number>
  implements IStatisticheApiRepository {

  constructor() {
    super(StatisticheApi, 'id_statistiche_api');
  }

  async findByEndpoint(endpoint: string): Promise<StatisticheApiInstance[]> {
    return this.model.findAll({
      where: {
        endpoint: { [Op.iLike]: `%${endpoint}%` }
      } as WhereOptions<StatisticheApiAttributes>
    });
  }

  async findByMetodo(metodo: string): Promise<StatisticheApiInstance[]> {
    return this.findWhere({ metodo } as WhereOptions<StatisticheApiAttributes>);
  }

  async findByRuoloUtente(ruolo: string): Promise<StatisticheApiInstance[]> {
    return this.findWhere({ ruolo_utente: ruolo } as WhereOptions<StatisticheApiAttributes>);
  }

  async findWithErrors(): Promise<StatisticheApiInstance[]> {
    return this.model.findAll({
      where: {
        errore: { [Op.ne]: null }
      } as WhereOptions<StatisticheApiAttributes>
    });
  }

  async findByDateRange(start: Date, end: Date): Promise<StatisticheApiInstance[]> {
    return this.model.findAll({
      where: {
        timestamp_richiesta: {
          [Op.between]: [start, end]
        }
      } as WhereOptions<StatisticheApiAttributes>
    });
  }

  async findPaginatedWithFilters(params: StatisticheApiPaginationParams): Promise<PaginatedResult<StatisticheApiInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'timestamp_richiesta',
      sortDirection = 'desc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.endpoint) {
        whereConditions.push({ endpoint: { [Op.iLike]: `%${filters.endpoint}%` } });
      }
      if (filters.metodo) whereConditions.push({ metodo: filters.metodo });
      if (filters.codiceRisposta) whereConditions.push({ codice_risposta: filters.codiceRisposta });
      if (filters.codiceRispostaRange) {
        whereConditions.push({
          codice_risposta: {
            [Op.between]: [filters.codiceRispostaRange.min, filters.codiceRispostaRange.max]
          }
        });
      }
      if (filters.ruoloUtente) whereConditions.push({ ruolo_utente: filters.ruoloUtente });
      if (filters.hasError) whereConditions.push({ errore: { [Op.ne]: null } });
      if (filters.dateRange) {
        whereConditions.push({
          timestamp_richiesta: {
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

  async countByEndpoint(endpoint: string): Promise<number> {
    return this.model.count({
      where: {
        endpoint: { [Op.iLike]: `%${endpoint}%` }
      } as WhereOptions<StatisticheApiAttributes>
    });
  }

  async countByMetodo(metodo: string): Promise<number> {
    return this.countWhere({ metodo } as WhereOptions<StatisticheApiAttributes>);
  }

  async countErrors(): Promise<number> {
    return this.model.count({
      where: {
        errore: { [Op.ne]: null }
      } as WhereOptions<StatisticheApiAttributes>
    });
  }

  async getAverageResponseTime(endpoint?: string): Promise<number> {
    const where: any = {};
    if (endpoint) {
      where.endpoint = { [Op.iLike]: `%${endpoint}%` };
    }

    const result = await this.model.findOne({
      attributes: [
        [this.model.sequelize!.fn('AVG', this.model.sequelize!.col('tempo_risposta_ms')), 'avgTime']
      ],
      where,
      raw: true
    });

    return (result as any)?.avgTime ?? 0;
  }

  async deleteOlderThan(date: Date): Promise<number> {
    return this.model.destroy({
      where: {
        timestamp_richiesta: { [Op.lt]: date }
      } as WhereOptions<StatisticheApiAttributes>
    });
  }
}
