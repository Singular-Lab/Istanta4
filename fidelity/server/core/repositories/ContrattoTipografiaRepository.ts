import { Op, type WhereOptions } from 'sequelize';
import type { ContrattoTipografiaAttributes } from '../../../lib/types';
import { ContrattoTipografia } from '../models/contratto_tipografia';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type ContrattoTipografiaInstance = InstanceType<typeof ContrattoTipografia>;

export interface IContrattoTipografiaRepository extends IBaseRepository<ContrattoTipografiaInstance, string> {
  findByGdoId(gdoId: string): Promise<ContrattoTipografiaInstance[]>;
  findByNome(nome: string): Promise<ContrattoTipografiaInstance[]>;
  findByTipoExport(tipoExport: string): Promise<ContrattoTipografiaInstance[]>;
  search(query: string, gdoId?: string): Promise<ContrattoTipografiaInstance[]>;
  countByGdoId(gdoId: string): Promise<number>;
}

export class ContrattoTipografiaRepository
  extends BaseRepository<ContrattoTipografiaInstance, ContrattoTipografiaAttributes, string>
  implements IContrattoTipografiaRepository {

  constructor() {
    super(ContrattoTipografia, 'id_contrattotipografia');
  }

  async findByGdoId(gdoId: string): Promise<ContrattoTipografiaInstance[]> {
    return this.findWhere({ id_gdo_contrattotipografia: gdoId } as WhereOptions<ContrattoTipografiaAttributes>);
  }

  async findByNome(nome: string): Promise<ContrattoTipografiaInstance[]> {
    return this.model.findAll({
      where: {
        nome_contrattotipografia: { [Op.iLike]: `%${nome}%` }
      } as WhereOptions<ContrattoTipografiaAttributes>
    });
  }

  async findByTipoExport(tipoExport: string): Promise<ContrattoTipografiaInstance[]> {
    return this.model.findAll({
      where: {
        tipiexport_contrattotipografia: { [Op.contains]: [tipoExport] }
      } as WhereOptions<ContrattoTipografiaAttributes>
    });
  }

  async search(query: string, gdoId?: string): Promise<ContrattoTipografiaInstance[]> {
    const where: any = {
      nome_contrattotipografia: { [Op.iLike]: `%${query}%` }
    };

    if (gdoId) {
      where.id_gdo_contrattotipografia = gdoId;
    }

    return this.model.findAll({ where });
  }

  async countByGdoId(gdoId: string): Promise<number> {
    return this.countWhere({ id_gdo_contrattotipografia: gdoId } as WhereOptions<ContrattoTipografiaAttributes>);
  }
}
