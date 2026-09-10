import { Op, type WhereOptions } from 'sequelize';
import type { AreeAttributes } from '../../../lib/types';
import { Area } from '../models/aree';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type AreaInstance = InstanceType<typeof Area>;

export interface IAreaRepository extends IBaseRepository<AreaInstance, string> {
  findByGdoId(gdoId: string): Promise<AreaInstance[]>;
  findByCodice(codice: string): Promise<AreaInstance | null>;
  findByGdoAndCodice(gdoId: string, codice: string): Promise<AreaInstance | null>;
  findByNome(nome: string): Promise<AreaInstance[]>;
  search(query: string, gdoId?: string): Promise<AreaInstance[]>;
}

export class AreaRepository
  extends BaseRepository<AreaInstance, AreeAttributes, string>
  implements IAreaRepository {

  constructor() {
    super(Area, 'id_aree');
  }

  async findByGdoId(gdoId: string): Promise<AreaInstance[]> {
    return this.findWhere({ id_gdo_aree: gdoId } as WhereOptions<AreeAttributes>);
  }

  async findByCodice(codice: string): Promise<AreaInstance | null> {
    return this.findOneWhere({ codice_aree: codice } as WhereOptions<AreeAttributes>);
  }

  async findByGdoAndCodice(gdoId: string, codice: string): Promise<AreaInstance | null> {
    return this.findOneWhere({
      id_gdo_aree: gdoId,
      codice_aree: codice
    } as WhereOptions<AreeAttributes>);
  }

  async findByNome(nome: string): Promise<AreaInstance[]> {
    return this.model.findAll({
      where: {
        nome_aree: { [Op.iLike]: `%${nome}%` }
      } as WhereOptions<AreeAttributes>
    });
  }

  async search(query: string, gdoId?: string): Promise<AreaInstance[]> {
    const where: any = {
      [Op.or]: [
        { nome_aree: { [Op.iLike]: `%${query}%` } },
        { codice_aree: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (gdoId) {
      where.id_gdo_aree = gdoId;
    }

    return this.model.findAll({ where });
  }
}
