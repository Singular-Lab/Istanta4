import { type WhereOptions } from 'sequelize';
import type { UtentiGDOAttributes } from '../../../lib/types';
import { UtentiGDO } from '../models/utenti_gdo';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type UtentiGdoInstance = InstanceType<typeof UtentiGDO>;

export interface IUtentiGdoRepository extends IBaseRepository<UtentiGdoInstance, string> {
  findByUtenteId(utenteId: string): Promise<UtentiGdoInstance[]>;
  findByGdoId(gdoId: string): Promise<UtentiGdoInstance[]>;
  findByRuoloId(ruoloId: string): Promise<UtentiGdoInstance[]>;
  findByUtenteAndGdo(utenteId: string, gdoId: string): Promise<UtentiGdoInstance | null>;
  deleteByUtenteId(utenteId: string): Promise<number>;
  deleteByGdoId(gdoId: string): Promise<number>;
  countByGdoId(gdoId: string): Promise<number>;
}

export class UtentiGdoRepository
  extends BaseRepository<UtentiGdoInstance, UtentiGDOAttributes, string>
  implements IUtentiGdoRepository {

  constructor() {
    super(UtentiGDO, 'id_utentegdo');
  }

  async findByUtenteId(utenteId: string): Promise<UtentiGdoInstance[]> {
    return this.findWhere({ id_utente_utentegdo: utenteId } as WhereOptions<UtentiGDOAttributes>);
  }

  async findByGdoId(gdoId: string): Promise<UtentiGdoInstance[]> {
    return this.findWhere({ id_gdo_utentegdo: gdoId } as WhereOptions<UtentiGDOAttributes>);
  }

  async findByRuoloId(ruoloId: string): Promise<UtentiGdoInstance[]> {
    return this.findWhere({ id_ruolo_utente_gdo: ruoloId } as WhereOptions<UtentiGDOAttributes>);
  }

  async findByUtenteAndGdo(utenteId: string, gdoId: string): Promise<UtentiGdoInstance | null> {
    return this.findOneWhere({
      id_utente_utentegdo: utenteId,
      id_gdo_utentegdo: gdoId
    } as WhereOptions<UtentiGDOAttributes>);
  }

  async deleteByUtenteId(utenteId: string): Promise<number> {
    return this.model.destroy({
      where: { id_utente_utentegdo: utenteId } as WhereOptions<UtentiGDOAttributes>
    });
  }

  async deleteByGdoId(gdoId: string): Promise<number> {
    return this.model.destroy({
      where: { id_gdo_utentegdo: gdoId } as WhereOptions<UtentiGDOAttributes>
    });
  }

  async countByGdoId(gdoId: string): Promise<number> {
    return this.countWhere({ id_gdo_utentegdo: gdoId } as WhereOptions<UtentiGDOAttributes>);
  }
}
