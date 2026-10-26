import { Op, type WhereOptions } from 'sequelize';
import type { CombinazioneCanaleAreaAttributes } from '../../../lib/types';
import { CombinazioneCanaleArea } from '../models/combinazioni_canali_aree';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type CombinazioneInstance = InstanceType<typeof CombinazioneCanaleArea>;

export interface ICombinazioneCanaleAreaRepository extends IBaseRepository<CombinazioneInstance, string> {
  findByGdoId(gdoId: string): Promise<CombinazioneInstance[]>;
  findByCanaleId(canaleId: string): Promise<CombinazioneInstance[]>;
  findByAreaId(areaId: string): Promise<CombinazioneInstance[]>;
  findByGdoAndCanale(gdoId: string, canaleId: string): Promise<CombinazioneInstance[]>;
  findByGdoAndArea(gdoId: string, areaId: string): Promise<CombinazioneInstance[]>;
  findByCanaleAndArea(canaleId: string, areaId: string): Promise<CombinazioneInstance | null>;
  findByGdoCanaleAndArea(gdoId: string, canaleId: string, areaId: string): Promise<CombinazioneInstance | null>;
  findActiveByGdo(gdoId: string): Promise<CombinazioneInstance[]>;
  updateStato(id: string, stato: 'ATTIVO' | 'DISATTIVO'): Promise<CombinazioneInstance | null>;
}

export class CombinazioneCanaleAreaRepository
  extends BaseRepository<CombinazioneInstance, CombinazioneCanaleAreaAttributes, string>
  implements ICombinazioneCanaleAreaRepository {

  constructor() {
    super(CombinazioneCanaleArea, 'id_combinazione_canale_area');
  }

  async findByGdoId(gdoId: string): Promise<CombinazioneInstance[]> {
    return this.findWhere({
      id_gdo_combinazione_canale_area: gdoId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findByCanaleId(canaleId: string): Promise<CombinazioneInstance[]> {
    return this.findWhere({
      id_canale_combinazione_canale_area: canaleId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findByAreaId(areaId: string): Promise<CombinazioneInstance[]> {
    return this.findWhere({
      id_area_combinazione_canale_area: areaId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findByGdoAndCanale(gdoId: string, canaleId: string): Promise<CombinazioneInstance[]> {
    return this.findWhere({
      id_gdo_combinazione_canale_area: gdoId,
      id_canale_combinazione_canale_area: canaleId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findByGdoAndArea(gdoId: string, areaId: string): Promise<CombinazioneInstance[]> {
    return this.findWhere({
      id_gdo_combinazione_canale_area: gdoId,
      id_area_combinazione_canale_area: areaId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findByCanaleAndArea(canaleId: string, areaId: string): Promise<CombinazioneInstance | null> {
    return this.findOneWhere({
      id_canale_combinazione_canale_area: canaleId,
      id_area_combinazione_canale_area: areaId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findByGdoCanaleAndArea(gdoId: string, canaleId: string, areaId: string): Promise<CombinazioneInstance | null> {
    return this.findOneWhere({
      id_gdo_combinazione_canale_area: gdoId,
      id_canale_combinazione_canale_area: canaleId,
      id_area_combinazione_canale_area: areaId
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async findActiveByGdo(gdoId: string): Promise<CombinazioneInstance[]> {
    return this.findWhere({
      id_gdo_combinazione_canale_area: gdoId,
      stato_combinazione_canale_area: 'ATTIVO'
    } as WhereOptions<CombinazioneCanaleAreaAttributes>);
  }

  async updateStato(id: string, stato: 'ATTIVO' | 'DISATTIVO'): Promise<CombinazioneInstance | null> {
    return this.update(id, {
      stato_combinazione_canale_area: stato
    } as Partial<CombinazioneCanaleAreaAttributes>);
  }
}
