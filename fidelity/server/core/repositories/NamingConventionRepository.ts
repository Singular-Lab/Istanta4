import { Op, type WhereOptions } from 'sequelize';
import type { NamingConventionAttributes } from '../../../lib/types';
import { NamingConvention } from '../models/naming_convention';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type NamingConventionInstance = InstanceType<typeof NamingConvention>;

export interface INamingConventionRepository extends IBaseRepository<NamingConventionInstance, string> {
  findByNome(nome: string): Promise<NamingConventionInstance | null>;
  search(query: string): Promise<NamingConventionInstance[]>;
  findByFormatiIds(formatoIds: string[]): Promise<NamingConventionInstance[]>;
}

export class NamingConventionRepository
  extends BaseRepository<NamingConventionInstance, NamingConventionAttributes, string>
  implements INamingConventionRepository {

  constructor() {
    super(NamingConvention, 'id_naming_convention');
  }

  async findByNome(nome: string): Promise<NamingConventionInstance | null> {
    return this.findOneWhere({ nome_naming_convention: nome } as WhereOptions<NamingConventionAttributes>);
  }

  async search(query: string): Promise<NamingConventionInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { nome_naming_convention: { [Op.iLike]: `%${query}%` } },
          { descrizione_naming_convention: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<NamingConventionAttributes>
    });
  }

  async findByFormatiIds(formatoIds: string[]): Promise<NamingConventionInstance[]> {
    if (formatoIds.length === 0) return [];
    return this.model.findAll({
      where: {
        fields_naming_convention: { [Op.overlap]: formatoIds }
      } as WhereOptions<NamingConventionAttributes>
    });
  }
}
