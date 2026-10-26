import { Op, type WhereOptions } from 'sequelize';
import type { CanaliAttributes } from '../../../lib/types';
import { Canale } from '../models/canali';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type CanaleInstance = InstanceType<typeof Canale>;

export interface ICanaleRepository extends IBaseRepository<CanaleInstance, string> {
  findByGdoId(gdoId: string): Promise<CanaleInstance[]>;
  findByCodice(codice: string): Promise<CanaleInstance | null>;
  findByGdoAndCodice(gdoId: string, codice: string): Promise<CanaleInstance | null>;
  findByNome(nome: string): Promise<CanaleInstance[]>;
  search(query: string, gdoId?: string): Promise<CanaleInstance[]>;
}

export class CanaleRepository
  extends BaseRepository<CanaleInstance, CanaliAttributes, string>
  implements ICanaleRepository {

  constructor() {
    super(Canale, 'id_canali');
  }

  async findByGdoId(gdoId: string): Promise<CanaleInstance[]> {
    return this.findWhere({ id_gdo_canali: gdoId } as WhereOptions<CanaliAttributes>);
  }

  async findByCodice(codice: string): Promise<CanaleInstance | null> {
    return this.findOneWhere({ codice_canali: codice } as WhereOptions<CanaliAttributes>);
  }

  async findByGdoAndCodice(gdoId: string, codice: string): Promise<CanaleInstance | null> {
    return this.findOneWhere({
      id_gdo_canali: gdoId,
      codice_canali: codice
    } as WhereOptions<CanaliAttributes>);
  }

  async findByNome(nome: string): Promise<CanaleInstance[]> {
    return this.model.findAll({
      where: {
        nome_canali: { [Op.iLike]: `%${nome}%` }
      } as WhereOptions<CanaliAttributes>
    });
  }

  async search(query: string, gdoId?: string): Promise<CanaleInstance[]> {
    const where: any = {
      [Op.or]: [
        { nome_canali: { [Op.iLike]: `%${query}%` } },
        { codice_canali: { [Op.iLike]: `%${query}%` } }
      ]
    };

    if (gdoId) {
      where.id_gdo_canali = gdoId;
    }

    return this.model.findAll({ where });
  }
}
