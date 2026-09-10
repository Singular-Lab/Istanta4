import { Op, type WhereOptions } from 'sequelize';
import { ContenutiAggiuntiviReferenza, type ContenutiAggiuntiviReferenzaAttributes } from '../models/contenuti_aggiuntivi_referenza';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type ContenutiAggiuntiviReferenzaInstance = InstanceType<typeof ContenutiAggiuntiviReferenza>;

export interface ContenutiAggiuntiviReferenzaFilters {
  referenzaId?: string;
  tipoContenuto?: string;
  attivo?: boolean;
  search?: string;
}

export interface ContenutiAggiuntiviReferenzaPaginationParams {
  page: number;
  pageSize: number;
  filters?: ContenutiAggiuntiviReferenzaFilters;
  sortBy?: 'createdAt' | 'ordine' | 'titolo';
  sortDirection?: 'asc' | 'desc';
}

export interface IContenutiAggiuntiviReferenzaRepository extends IBaseRepository<ContenutiAggiuntiviReferenzaInstance, string> {
  findByReferenzaId(referenzaId: string): Promise<ContenutiAggiuntiviReferenzaInstance[]>;
  findByTipoContenuto(tipoContenuto: string): Promise<ContenutiAggiuntiviReferenzaInstance[]>;
  findActiveByReferenza(referenzaId: string): Promise<ContenutiAggiuntiviReferenzaInstance[]>;
  findPaginatedWithFilters(params: ContenutiAggiuntiviReferenzaPaginationParams): Promise<PaginatedResult<ContenutiAggiuntiviReferenzaInstance>>;
  countByReferenzaId(referenzaId: string): Promise<number>;
  deleteByReferenzaId(referenzaId: string): Promise<number>;
}

export class ContenutiAggiuntiviReferenzaRepository
  extends BaseRepository<ContenutiAggiuntiviReferenzaInstance, ContenutiAggiuntiviReferenzaAttributes, string>
  implements IContenutiAggiuntiviReferenzaRepository {

  constructor() {
    super(ContenutiAggiuntiviReferenza, 'id');
  }

  async findByReferenzaId(referenzaId: string): Promise<ContenutiAggiuntiviReferenzaInstance[]> {
    return this.model.findAll({
      where: { id_referenza: referenzaId } as WhereOptions<ContenutiAggiuntiviReferenzaAttributes>,
      order: [['ordine', 'ASC']]
    });
  }

  async findByTipoContenuto(tipoContenuto: string): Promise<ContenutiAggiuntiviReferenzaInstance[]> {
    return this.findWhere({ tipo_contenuto: tipoContenuto } as WhereOptions<ContenutiAggiuntiviReferenzaAttributes>);
  }

  async findActiveByReferenza(referenzaId: string): Promise<ContenutiAggiuntiviReferenzaInstance[]> {
    return this.model.findAll({
      where: {
        id_referenza: referenzaId,
        attivo: true
      } as WhereOptions<ContenutiAggiuntiviReferenzaAttributes>,
      order: [['ordine', 'ASC']]
    });
  }

  async findPaginatedWithFilters(params: ContenutiAggiuntiviReferenzaPaginationParams): Promise<PaginatedResult<ContenutiAggiuntiviReferenzaInstance>> {
    const {
      page,
      pageSize,
      filters,
      sortBy = 'ordine',
      sortDirection = 'asc'
    } = params;

    const whereConditions: any[] = [];

    if (filters) {
      if (filters.referenzaId) whereConditions.push({ id_referenza: filters.referenzaId });
      if (filters.tipoContenuto) whereConditions.push({ tipo_contenuto: filters.tipoContenuto });
      if (filters.attivo !== undefined) whereConditions.push({ attivo: filters.attivo });
      if (filters.search) {
        whereConditions.push({
          [Op.or]: [
            { titolo: { [Op.iLike]: `%${filters.search}%` } },
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

  async countByReferenzaId(referenzaId: string): Promise<number> {
    return this.countWhere({ id_referenza: referenzaId } as WhereOptions<ContenutiAggiuntiviReferenzaAttributes>);
  }

  async deleteByReferenzaId(referenzaId: string): Promise<number> {
    return this.model.destroy({
      where: { id_referenza: referenzaId } as WhereOptions<ContenutiAggiuntiviReferenzaAttributes>
    });
  }
}
