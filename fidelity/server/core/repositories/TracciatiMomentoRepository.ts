import type { TracciatiMomentoAttributes } from '../models/tracciati_momento';
import { TracciatiMomento } from '../models/tracciati_momento';
import type { TracciatiMomentoConfrontiAttributes } from '../models/tracciati_momento_confronti';
import { TracciatiMomentoConfronti } from '../models/tracciati_momento_confronti';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';
import { literal, Op, type Transaction } from 'sequelize';

type TracciatiMomentoInstance = InstanceType<typeof TracciatiMomento>;
type TracciatiMomentoConfrontoInstance = InstanceType<typeof TracciatiMomentoConfronti>;

export interface ITracciatiMomentoRepository
  extends IBaseRepository<TracciatiMomentoInstance, string> {
  findByPromoId(idPromo: string, transaction?: Transaction): Promise<TracciatiMomentoInstance[]>;
  createConfronto(data: Partial<TracciatiMomentoConfrontiAttributes>, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance>;
  findConfrontoById(id: string, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance | null>;
  findConfrontoByPair(primario: string, secondario: string, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance | null>;
  updateConfronto(id: string, data: Partial<TracciatiMomentoConfrontiAttributes>, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance | null>;
  deleteConfronto(id: string, transaction?: Transaction): Promise<boolean>;
  findConfrontiByMomentoId(idMomento: string, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance[]>;
  findConfrontiByMomentoIds(ids: string[]): Promise<TracciatiMomentoConfrontoInstance[]>;
  findConfrontiWithRisultatoByMomentoIds(ids: string[]): Promise<TracciatiMomentoConfrontoInstance[]>;
}

export class TracciatiMomentoRepository
  extends BaseRepository<TracciatiMomentoInstance, TracciatiMomentoAttributes, string>
  implements ITracciatiMomentoRepository {
  private readonly confrontoModel = TracciatiMomentoConfronti;

  constructor() {
    super(TracciatiMomento, 'id');
  }

  async findByPromoId(idPromo: string, transaction?: Transaction): Promise<TracciatiMomentoInstance[]> {
    return this.model.findAll({
      where: { id_promo: idPromo } as any,
      order: [['ordine', 'ASC'], ['createdat', 'ASC']],
      transaction,
    });
  }

  async createConfronto(data: Partial<TracciatiMomentoConfrontiAttributes>, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance> {
    return this.confrontoModel.create(data as any, { transaction });
  }

  async findConfrontoById(id: string, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance | null> {
    return this.confrontoModel.findOne({ where: { id } as any, transaction });
  }

  async findConfrontoByPair(primario: string, secondario: string, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance | null> {
    return this.confrontoModel.findOne({
      where: {
        [Op.or]: [
          { primario, secondario },
          { primario: secondario, secondario: primario },
        ],
      } as any,
      transaction,
    });
  }

  async updateConfronto(id: string, data: Partial<TracciatiMomentoConfrontiAttributes>, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance | null> {
    const [affectedRows] = await this.confrontoModel.update(data as any, { where: { id } as any, transaction });
    if (affectedRows === 0) return null;
    return this.findConfrontoById(id, transaction);
  }

  async deleteConfronto(id: string, transaction?: Transaction): Promise<boolean> {
    const deletedRows = await this.confrontoModel.destroy({ where: { id } as any, transaction });
    return deletedRows > 0;
  }

  async findConfrontiByMomentoId(idMomento: string, transaction?: Transaction): Promise<TracciatiMomentoConfrontoInstance[]> {
    return this.confrontoModel.findAll({
      where: {
        [Op.or]: [
          { primario: idMomento },
          { secondario: idMomento },
        ],
      } as any,
      order: [['createdat', 'ASC']],
      transaction,
    });
  }

  async findConfrontiByMomentoIds(ids: string[]): Promise<TracciatiMomentoConfrontoInstance[]> {
    if (ids.length === 0) return [];
    return this.confrontoModel.findAll({
      attributes: ['id', 'primario', 'secondario', 'tipo', 'terremoto_degrado_massimo', [literal('risultato IS NOT NULL'), 'hasRisultato']],
      where: {
        [Op.or]: [
          { primario: { [Op.in]: ids } },
          { secondario: { [Op.in]: ids } },
        ],
      } as any,
    });
  }

  async findConfrontiWithRisultatoByMomentoIds(ids: string[]): Promise<TracciatiMomentoConfrontoInstance[]> {
    if (ids.length === 0) return [];
    return this.confrontoModel.findAll({
      attributes: ['id', 'primario', 'secondario', 'tipo', 'risultato', 'terremoto_degrado_massimo'],
      where: {
        risultato: { [Op.ne]: null },
        [Op.or]: [
          { primario: { [Op.in]: ids } },
          { secondario: { [Op.in]: ids } },
        ],
      } as any,
    });
  }
}
