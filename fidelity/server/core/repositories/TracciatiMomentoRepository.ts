import type { TracciatiMomentoAttributes } from '../models/tracciati_momento';
import { TracciatiMomento } from '../models/tracciati_momento';
import type { TracciatiMomentoConfrontiAttributes } from '../models/tracciati_momento_confronti';
import { TracciatiMomentoConfronti } from '../models/tracciati_momento_confronti';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';
import { literal, Op } from 'sequelize';

type TracciatiMomentoInstance = InstanceType<typeof TracciatiMomento>;
type TracciatiMomentoConfrontoInstance = InstanceType<typeof TracciatiMomentoConfronti>;

export interface ITracciatiMomentoRepository
  extends IBaseRepository<TracciatiMomentoInstance, string> {
  findByPromoId(idPromo: string): Promise<TracciatiMomentoInstance[]>;
  createConfronto(data: Partial<TracciatiMomentoConfrontiAttributes>): Promise<TracciatiMomentoConfrontoInstance>;
  findConfrontoById(id: string): Promise<TracciatiMomentoConfrontoInstance | null>;
  findConfrontoByPair(primario: string, secondario: string): Promise<TracciatiMomentoConfrontoInstance | null>;
  updateConfronto(id: string, data: Partial<TracciatiMomentoConfrontiAttributes>): Promise<TracciatiMomentoConfrontoInstance | null>;
  deleteConfronto(id: string): Promise<boolean>;
  findConfrontiByMomentoId(idMomento: string): Promise<TracciatiMomentoConfrontoInstance[]>;
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

  async findByPromoId(idPromo: string): Promise<TracciatiMomentoInstance[]> {
    return this.model.findAll({
      where: { id_promo: idPromo } as any,
      order: [['ordine', 'ASC'], ['createdat', 'ASC']],
    });
  }

  async createConfronto(data: Partial<TracciatiMomentoConfrontiAttributes>): Promise<TracciatiMomentoConfrontoInstance> {
    return this.confrontoModel.create(data as any);
  }

  async findConfrontoById(id: string): Promise<TracciatiMomentoConfrontoInstance | null> {
    return this.confrontoModel.findOne({ where: { id } as any });
  }

  async findConfrontoByPair(primario: string, secondario: string): Promise<TracciatiMomentoConfrontoInstance | null> {
    return this.confrontoModel.findOne({
      where: {
        [Op.or]: [
          { primario, secondario },
          { primario: secondario, secondario: primario },
        ],
      } as any,
    });
  }

  async updateConfronto(id: string, data: Partial<TracciatiMomentoConfrontiAttributes>): Promise<TracciatiMomentoConfrontoInstance | null> {
    const [affectedRows] = await this.confrontoModel.update(data as any, { where: { id } as any });
    if (affectedRows === 0) return null;
    return this.findConfrontoById(id);
  }

  async deleteConfronto(id: string): Promise<boolean> {
    const deletedRows = await this.confrontoModel.destroy({ where: { id } as any });
    return deletedRows > 0;
  }

  async findConfrontiByMomentoId(idMomento: string): Promise<TracciatiMomentoConfrontoInstance[]> {
    return this.confrontoModel.findAll({
      where: {
        [Op.or]: [
          { primario: idMomento },
          { secondario: idMomento },
        ],
      } as any,
      order: [['createdat', 'ASC']],
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
