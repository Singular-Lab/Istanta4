import { Op, type WhereOptions } from 'sequelize';
import type { FormatiAttributes } from '../../../lib/types';
import { Formati } from '../models/formati';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type FormatiInstance = InstanceType<typeof Formati>;

export interface IFormatiRepository extends IBaseRepository<FormatiInstance, string> {
  findByCodice(codice: string): Promise<FormatiInstance | null>;
  findByNome(nome: string): Promise<FormatiInstance[]>;
  findByTipoLavorazione(tipo: number): Promise<FormatiInstance[]>;
  search(query: string): Promise<FormatiInstance[]>;
  findIdsByTipoLavorazione(tipo: number): Promise<string[]>;
}

export class FormatiRepository
  extends BaseRepository<FormatiInstance, FormatiAttributes, string>
  implements IFormatiRepository {

  constructor() {
    super(Formati, 'id_formati');
  }

  async findByCodice(codice: string): Promise<FormatiInstance | null> {
    return this.findOneWhere({ codice_formati: codice } as WhereOptions<FormatiAttributes>);
  }

  async findByNome(nome: string): Promise<FormatiInstance[]> {
    return this.model.findAll({
      where: {
        nome_formati: { [Op.iLike]: `%${nome}%` }
      } as WhereOptions<FormatiAttributes>
    });
  }

  async findByTipoLavorazione(tipo: number): Promise<FormatiInstance[]> {
    return this.findWhere({ tipo_lavorazione_formati: tipo } as WhereOptions<FormatiAttributes>);
  }

  async findIdsByTipoLavorazione(tipo: number): Promise<string[]> {
    const formati = await this.model.findAll({
      where: { tipo_lavorazione_formati: tipo } as WhereOptions<FormatiAttributes>,
      attributes: ['id_formati']
    });

    return formati
      .map((formato) => formato.getDataValue('id_formati'))
      .filter((id): id is string => Boolean(id));
  }

  async search(query: string): Promise<FormatiInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { nome_formati: { [Op.iLike]: `%${query}%` } },
          { codice_formati: { [Op.iLike]: `%${query}%` } },
          { descrizione_formati: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<FormatiAttributes>
    });
  }
}
