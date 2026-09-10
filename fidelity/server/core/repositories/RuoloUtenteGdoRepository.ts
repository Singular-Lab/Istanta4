import { Op, type WhereOptions } from 'sequelize';
import type { RuoloUtenteGDOAttributes } from '../../../lib/types';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type RuoloUtenteGdoInstance = InstanceType<typeof RuoloUtenteGDO>;

export interface IRuoloUtenteGdoRepository extends IBaseRepository<RuoloUtenteGdoInstance, string> {
  findByRuolo(ruolo: string): Promise<RuoloUtenteGdoInstance | null>;
  findByApiKey(apiKey: string): Promise<RuoloUtenteGdoInstance | null>;
  search(query: string): Promise<RuoloUtenteGdoInstance[]>;
}

export class RuoloUtenteGdoRepository
  extends BaseRepository<RuoloUtenteGdoInstance, RuoloUtenteGDOAttributes, string>
  implements IRuoloUtenteGdoRepository {

  constructor() {
    super(RuoloUtenteGDO, 'id_ruolo_utente_gdo');
  }

  async findByRuolo(ruolo: string): Promise<RuoloUtenteGdoInstance | null> {
    return this.findOneWhere({ ruolo_ruolo_utente_gdo: ruolo } as WhereOptions<RuoloUtenteGDOAttributes>);
  }

  async findByApiKey(apiKey: string): Promise<RuoloUtenteGdoInstance | null> {
    return this.findOneWhere({ api_key_ruolo_utente_gdo: apiKey } as WhereOptions<RuoloUtenteGDOAttributes>);
  }

  async search(query: string): Promise<RuoloUtenteGdoInstance[]> {
    return this.model.findAll({
      where: {
        ruolo_ruolo_utente_gdo: { [Op.iLike]: `%${query}%` }
      } as WhereOptions<RuoloUtenteGDOAttributes>
    });
  }
}
