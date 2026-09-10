import { Op } from 'sequelize';
import { DatabaseError, NotFoundError, wrapDatabaseError } from '../../../lib/errors';
import { sequelize } from '../db';
import { CombinazioneCanaleAreaResponseDTO } from '../dto';
import { ICombinazioneAreeCanaliService } from '../interfaces/ICombinazioneAreeCanaliService';
import { log } from '../logger';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import type { IAreaRepository } from '../repositories/AreaRepository';
import { AreaRepository } from '../repositories/AreaRepository';
import type { ICanaleRepository } from '../repositories/CanaleRepository';
import { CanaleRepository } from '../repositories/CanaleRepository';
import type { ICombinazioneCanaleAreaRepository } from '../repositories/CombinazioneCanaleAreaRepository';
import { CombinazioneCanaleAreaRepository } from '../repositories/CombinazioneCanaleAreaRepository';

export class CombinazioneAreeCanaliService implements ICombinazioneAreeCanaliService {
  constructor(
    private readonly combinazioneRepository: ICombinazioneCanaleAreaRepository = new CombinazioneCanaleAreaRepository(),
    private readonly canaleRepository: ICanaleRepository = new CanaleRepository(),
    private readonly areaRepository: IAreaRepository = new AreaRepository()
  ) {}
  async getAllCombinazioniForGDO(idGDO: string): Promise<CombinazioneCanaleAreaResponseDTO[]> {
    try {
      const combinazioni = await this.combinazioneRepository.findByGdoId(idGDO);
      if (!combinazioni) {
        throw new NotFoundError({
          message: `No combinations found for GDO ${idGDO}`,
          entityType: 'CombinazioneCanaleArea',
          details: { idGDO }
        });
      }
      return combinazioni.map(combinazione => ({
        id: combinazione.id_combinazione_canale_area,
        id_gdo: idGDO,
        id_canale: combinazione.id_canale_combinazione_canale_area,
        id_area: combinazione.id_area_combinazione_canale_area ?? '',
        stato: combinazione.stato_combinazione_canale_area as 'ATTIVO' | 'DISATTIVO',
        sigla: combinazione.id_canale_combinazione_canale_area + '_' + combinazione.id_area_combinazione_canale_area,
        createdat: combinazione.createdat ?? new Date(),
        updatedat: combinazione.updatedat ?? new Date()
      }));
    } catch (error) {
      log.error(`Error getting all combinations for GDO ${idGDO}:`, error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: `Error getting all combinations for GDO ${idGDO}`,
        operation: 'findAll',
        entity: 'CombinazioneCanaleArea',
        details: { idGDO },
      });
    }
  }


  async getAllCombinazioniForGDOReworked(idGDO: string): Promise<{
    id: string;
    sigla_combinazione: string;
    stato_combinazione: string;
  }[]> {
    try {
      const combinazioni = await this.combinazioneRepository.findByGdoId(idGDO);
      if (!combinazioni) {
        throw new NotFoundError({
          message: `No combinations found for GDO ${idGDO}`,
          entityType: 'CombinazioneCanaleArea',
          details: { idGDO }
        });
      }
      const canaleIds = [...new Set(combinazioni.map(c => c.id_canale_combinazione_canale_area))];
      const areaIds = [...new Set(combinazioni.map(c => c.id_area_combinazione_canale_area).filter((id): id is string => !!id))];
      const [canali, aree] = await Promise.all([
        Canale.findAll({ where: { id_canali: { [Op.in]: canaleIds } } }),
        Area.findAll({ where: { id_aree: { [Op.in]: areaIds } } }),
      ]);
      const canaleMap = new Map(canali.map(c => [c.id_canali, c]));
      const areaMap = new Map(aree.map(a => [a.id_aree, a]));
      return combinazioni.map(combinazione => {
        const canale = canaleMap.get(combinazione.id_canale_combinazione_canale_area);
        const area = areaMap.get(combinazione.id_area_combinazione_canale_area ?? '');
        return {
          id: combinazione.id_combinazione_canale_area,
          sigla_combinazione: canale?.codice_canali + '_' + area?.codice_aree,
          stato_combinazione: combinazione.stato_combinazione_canale_area
        };
      });
    } catch (error) {
      log.error(`Error getting all combinations for GDO ${idGDO}:`, error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: `Error getting all combinations for GDO ${idGDO}`,
        operation: 'findAll',
        entity: 'CombinazioneCanaleArea',
        details: { idGDO },
      });
    }
  }

  async createCombinazione(data: {
    guidID: string,
    guidIDCanale: string,
    guidIDArea: string,
    enabled: boolean,
    idGDO: string
  }): Promise<CombinazioneCanaleAreaResponseDTO> {
    try {
      // Prima controlla se esiste già una combinazione con questo ID
      const existingCombinazione = await this.combinazioneRepository.findById(data.guidID);

      let combinazione;
      let isUpdate = false;

      if (existingCombinazione) {
        // Se esiste, aggiorna i dati
        log.info(`Updating existing combination with ID: ${data.guidID}`);
        await this.combinazioneRepository.update(data.guidID, {
          id_canale_combinazione_canale_area: data.guidIDCanale,
          id_area_combinazione_canale_area: data.guidIDArea,
          id_gdo_combinazione_canale_area: data.idGDO,
          stato_combinazione_canale_area: data.enabled ? 'ATTIVO' : 'DISATTIVO',
          updatedat: new Date()
        });

        combinazione = await this.combinazioneRepository.findById(data.guidID);
        isUpdate = true;
      } else {
        // Se non esiste, crea una nuova combinazione
        log.info(`Creating new combination with ID: ${data.guidID}`);
        combinazione = await this.combinazioneRepository.create({
          id_combinazione_canale_area: data.guidID,
          id_canale_combinazione_canale_area: data.guidIDCanale,
          id_area_combinazione_canale_area: data.guidIDArea,
          id_gdo_combinazione_canale_area: data.idGDO,
          stato_combinazione_canale_area: data.enabled ? 'ATTIVO' : 'DISATTIVO'
        });
      }

      if (!combinazione) {
        throw wrapDatabaseError(new Error(`${isUpdate ? 'Aggiornamento' : 'Creazione'} combinazione fallita`), {
          message: `Failed to ${isUpdate ? 'update' : 'create'} combination`,
          operation: isUpdate ? 'update' : 'create',
          entity: 'CombinazioneCanaleArea',
          details: { data },
        });
      }

      log.info(`Combination ${isUpdate ? 'updated' : 'created'} successfully: ${data.guidID}`);
      const canale = await this.canaleRepository.findById(data.guidIDCanale);
      const area = await this.areaRepository.findById(data.guidIDArea);
      await sequelize.query('SELECT refresh_mv_combinazioni()');
      return {
        id: data.guidID,
        id_gdo: data.idGDO,
        id_canale: data.guidIDCanale,
        id_area: data.guidIDArea ?? '',
        stato: data.enabled ? 'ATTIVO' : 'DISATTIVO',
        sigla: canale?.codice_canali + '_' + area?.codice_aree,
        createdat: combinazione.createdat ?? new Date(),
        updatedat: combinazione.updatedat ?? new Date(),
      };
    } catch (error) {
      log.error('Error creating/updating combination:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: 'Creazione/aggiornamento combinazione fallita',
        operation: 'createOrUpdate',
        entity: 'CombinazioneCanaleArea',
        details: { data },
      });
    }
  }

  async deleteCombinazione(guidID: string): Promise<boolean> {
    try {
      const deleted = await this.combinazioneRepository.delete(guidID);
      if (deleted) {
        await sequelize.query('SELECT refresh_mv_combinazioni()');
        return true;
      }
      return false;
    } catch (error) {
      log.error(`Error deleting combination ${guidID}:`, error);
      throw wrapDatabaseError(error, {
        message: `Errore nella cancellazione della combinazione ${guidID}`,
        operation: 'delete',
        entity: 'CombinazioneCanaleArea',
        details: { guidID },
      });
    }
  }

  // Materialized View Operations
  async getAllCombinazioniFromMaterializedView(): Promise<CombinazioneCanaleAreaResponseDTO[]> {
    try {
      const { sequelize } = await import('../db/SequelizeConnector');
      const queryStr = `
      SELECT
          id,
          id_gdo,
          id_canale,
          id_area,
          stato,
          canale_codice,
          canale_nome,
          area_codice,
          area_nome,
          createdat,
          updatedat
        FROM mv_combinazioni_ottimizzata
        ORDER BY createdat DESC
      `;
      let [results] = await sequelize.query(queryStr);
      if (results.length === 0) {
        //Provo ad aggiornare la materialized view
        await sequelize.query('REFRESH MATERIALIZED VIEW mv_combinazioni_ottimizzata;');
      }
      results = await sequelize.query(queryStr).then(([res]) => res);
      const newResults = results.map((result: any) => ({
        ...result,
        sigla: result.canale_codice + '_' + result.area_codice
      }));
      return newResults as CombinazioneCanaleAreaResponseDTO[];
    } catch (error) {
      log.error('Error getting combinazioni from materialized view:', error);
      throw wrapDatabaseError(error, {
        message: 'Error getting combinazioni from materialized view',
        operation: 'materialized_view_query',
        entity: 'CombinazioneCanaleArea',
      });
    }
  }

  async getCombinazioniByGDOIdFromMaterializedView(idGDO: string): Promise<CombinazioneCanaleAreaResponseDTO[]> {
    try {
      const { sequelize } = await import('../db/SequelizeConnector');
      const [results] = await sequelize.query(`
        SELECT
          id,
          id_gdo,
          id_canale,
          id_area,
          stato,
          canale_codice,
          canale_nome,
          area_codice,
          area_nome,
          sigla,
          createdat,
          updatedat
        FROM mv_combinazioni_ottimizzata
        WHERE id_gdo = :idGDO
        ORDER BY createdat DESC
      `, {
        replacements: { idGDO }
      });

      return results as CombinazioneCanaleAreaResponseDTO[];
    } catch (error) {
      log.error('Error getting combinazioni by GDO from materialized view:', error);
      throw wrapDatabaseError(error, {
        message: `Error getting combinazioni for GDO ${idGDO} from materialized view`,
        operation: 'materialized_view_query',
        entity: 'CombinazioneCanaleArea',
        details: { idGDO },
      });
    }
  }

}
