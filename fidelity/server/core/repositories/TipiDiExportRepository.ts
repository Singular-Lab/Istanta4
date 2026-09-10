import { Op, type WhereOptions } from 'sequelize';
import { MODALITA_TIPO_EXPORT } from '../../../lib/enums';
import type { TipiDiExportAttributes } from '../../../lib/types';
import { TipiDiExport } from '../models/tipi_di_export';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type TipiDiExportInstance = InstanceType<typeof TipiDiExport>;

export interface ITipiDiExportRepository extends IBaseRepository<TipiDiExportInstance, string> {
  findByCodice(codice: string): Promise<TipiDiExportInstance | null>;
  findByNome(nome: string): Promise<TipiDiExportInstance[]>;
  findByModalita(modalita: MODALITA_TIPO_EXPORT): Promise<TipiDiExportInstance[]>;
  findByNamingConventionId(namingConventionId: string): Promise<TipiDiExportInstance[]>;
  findByIds(ids: string[]): Promise<TipiDiExportInstance[]>;
  search(query: string): Promise<TipiDiExportInstance[]>;
}

export class TipiDiExportRepository
  extends BaseRepository<TipiDiExportInstance, TipiDiExportAttributes, string>
  implements ITipiDiExportRepository {

  constructor() {
    super(TipiDiExport, 'id_tipiexport');
  }

  async findByCodice(codice: string): Promise<TipiDiExportInstance | null> {
    return this.findOneWhere({ codice_tipiexport: codice } as WhereOptions<TipiDiExportAttributes>);
  }

  async findByNome(nome: string): Promise<TipiDiExportInstance[]> {
    return this.model.findAll({
      where: {
        nome_tipiexport: { [Op.iLike]: `%${nome}%` }
      } as WhereOptions<TipiDiExportAttributes>
    });
  }

  async findByModalita(modalita: MODALITA_TIPO_EXPORT): Promise<TipiDiExportInstance[]> {
    return this.findWhere({ modalita_tipiexport: modalita } as WhereOptions<TipiDiExportAttributes>);
  }

  async findByNamingConventionId(namingConventionId: string): Promise<TipiDiExportInstance[]> {
    return this.findWhere({
      guid_namingconvention_tipiexport: namingConventionId
    } as WhereOptions<TipiDiExportAttributes>);
  }

  async findByIds(ids: string[]): Promise<TipiDiExportInstance[]> {
    if (ids.length === 0) return [];
    return this.model.findAll({
      where: {
        id_tipiexport: { [Op.in]: ids }
      } as WhereOptions<TipiDiExportAttributes>
    });
  }

  async search(query: string): Promise<TipiDiExportInstance[]> {
    return this.model.findAll({
      where: {
        [Op.or]: [
          { nome_tipiexport: { [Op.iLike]: `%${query}%` } },
          { codice_tipiexport: { [Op.iLike]: `%${query}%` } }
        ]
      } as WhereOptions<TipiDiExportAttributes>
    });
  }
}
