import { Op, type WhereOptions } from 'sequelize';
import { CATEGORIA_ATTIVITA, PRIORITA_ATTIVITA, TIPO_ATTIVITA } from '../../../lib/enums';
import type { AttivitaAttributes } from '../../../lib/types';
import { Attivita } from '../models/attivita';
import { AttivitaUtente } from '../models/attivita_utente';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository, PaginatedResult } from './IBaseRepository';

type AttivitaInstance = InstanceType<typeof Attivita>;

export interface AttivitaFilters {
  utenteId?: string;
  tipo?: TIPO_ATTIVITA;
  categoria?: CATEGORIA_ATTIVITA;
  priorita?: PRIORITA_ATTIVITA;
  dataInizio?: Date;
  dataFine?: Date;
  onlyUnread?: boolean;
}

export interface AttivitaPaginationParams {
  page: number;
  pageSize: number;
  filters?: AttivitaFilters;
  sortBy?: 'createdat' | 'priorita_attivita' | 'tipo_attivita';
  sortDirection?: 'asc' | 'desc';
}

export interface IAttivitaRepository extends IBaseRepository<AttivitaInstance, string> {
  findByUtenteId(utenteId: string): Promise<AttivitaInstance[]>;
  findByTipo(tipo: TIPO_ATTIVITA): Promise<AttivitaInstance[]>;
  findByCategoria(categoria: CATEGORIA_ATTIVITA): Promise<AttivitaInstance[]>;
  findByPriorita(priorita: PRIORITA_ATTIVITA): Promise<AttivitaInstance[]>;
  findPaginatedWithFilters(params: AttivitaPaginationParams): Promise<PaginatedResult<AttivitaInstance>>;
  findUnreadByUtente(utenteId: string): Promise<AttivitaInstance[]>;
  countUnreadByUtente(utenteId: string): Promise<number>;
  markAsRead(attivitaId: string, utenteId: string): Promise<boolean>;
  markAllAsReadForUtente(utenteId: string): Promise<number>;
  findExpired(): Promise<AttivitaInstance[]>;
  deleteExpired(): Promise<number>;
}

export class AttivitaRepository
  extends BaseRepository<AttivitaInstance, AttivitaAttributes, string>
  implements IAttivitaRepository {

  constructor() {
    super(Attivita, 'id_attivita');
  }

  async findByUtenteId(utenteId: string): Promise<AttivitaInstance[]> {
    return this.findWhere({ idutente_attivita: utenteId } as WhereOptions<AttivitaAttributes>);
  }

  async findByTipo(tipo: TIPO_ATTIVITA): Promise<AttivitaInstance[]> {
    return this.findWhere({ tipo_attivita: tipo } as WhereOptions<AttivitaAttributes>);
  }

  async findByCategoria(categoria: CATEGORIA_ATTIVITA): Promise<AttivitaInstance[]> {
    return this.findWhere({ categoria_attivita: categoria } as WhereOptions<AttivitaAttributes>);
  }

  async findByPriorita(priorita: PRIORITA_ATTIVITA): Promise<AttivitaInstance[]> {
    return this.findWhere({ priorita_attivita: priorita } as WhereOptions<AttivitaAttributes>);
  }

  async findPaginatedWithFilters(params: AttivitaPaginationParams): Promise<PaginatedResult<AttivitaInstance>> {
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
        whereConditions.push({ idutente_attivita: filters.utenteId });
      }
      if (filters.tipo) {
        whereConditions.push({ tipo_attivita: filters.tipo });
      }
      if (filters.categoria) {
        whereConditions.push({ categoria_attivita: filters.categoria });
      }
      if (filters.priorita) {
        whereConditions.push({ priorita_attivita: filters.priorita });
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

  async findUnreadByUtente(utenteId: string): Promise<AttivitaInstance[]> {
    return this.model.findAll({
      include: [{
        model: AttivitaUtente,
        as: 'attivitaUtenti',
        where: {
          id_utente_attivita_utente: utenteId,
          letto: false
        },
        required: true
      }]
    });
  }

  async countUnreadByUtente(utenteId: string): Promise<number> {
    return AttivitaUtente.count({
      where: {
        id_utente_attivita_utente: utenteId,
        letto_attivita_utente: false
      }
    });
  }

  async markAsRead(attivitaId: string, utenteId: string): Promise<boolean> {
    const [affectedRows] = await AttivitaUtente.update(
      { letto_attivita_utente: true },
      {
        where: {
          id_attivita_attivita_utente: attivitaId,
          id_utente_attivita_utente: utenteId
        }
      }
    );
    return affectedRows > 0;
  }

  async markAllAsReadForUtente(utenteId: string): Promise<number> {
    const [affectedRows] = await AttivitaUtente.update(
      { letto_attivita_utente: true },
      {
        where: {
          id_utente_attivita_utente: utenteId,
          letto_attivita_utente: false
        }
      }
    );
    return affectedRows;
  }

  async findExpired(): Promise<AttivitaInstance[]> {
    const now = new Date();
    return this.model.findAll({
      where: {
        expires_at: { [Op.lt]: now }
      } as WhereOptions<AttivitaAttributes>
    });
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    return this.model.destroy({
      where: {
        expires_at: { [Op.lt]: now }
      } as WhereOptions<AttivitaAttributes>
    });
  }
}
