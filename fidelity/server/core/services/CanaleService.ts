import { Request } from 'express';
import { DatabaseError, ExternalApiError, wrapDatabaseError } from '../../../lib/errors';
import { CanaliAttributes } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db';
import { CanaleResponseDTO } from '../dto';
import { ICanaleService } from '../interfaces/ICanaleService';
import { log } from '../logger';
import type { ICanaleRepository } from '../repositories/CanaleRepository';
import { CanaleRepository } from '../repositories/CanaleRepository';
import { ServerUtils } from '../utils/ServerUtils';

export class CanaleService implements ICanaleService {
  constructor(
    private readonly canaleRepository: ICanaleRepository = new CanaleRepository()
  ) {}

  private mapToDTO(canale: any): CanaleResponseDTO {
    return {
      id: canale.id_canali ?? '',
      codice: canale.codice_canali ?? '',
      nome: canale.nome_canali ?? '',
      id_gdo: canale.id_gdo_canali ?? '',
      createdat: canale.createdat,
      updatedat: canale.updatedat
    };
  }

  async getAllCanali(): Promise<CanaleResponseDTO[]> {
    try {
      const canali = await this.canaleRepository.findAll();
      return canali.map(this.mapToDTO);
    } catch (error) {
      log.error('Impossibile recuperare tutti i canali', error);
      throw wrapDatabaseError(error, {
        message: 'Error getting all channels',
        operation: 'findAll',
        entity: 'Canale',
      });
    }
  }

  async getCanaleById(id: string): Promise<CanaleResponseDTO | null> {
    try {
      const canale = await this.canaleRepository.findById(id);
      if (!canale) return null;
      return this.mapToDTO(canale);
    } catch (error) {
      log.error('Impossibile recuperare il canale', error, { id });
      throw wrapDatabaseError(error, {
        message: `Error retrieving channel with ID ${id}`,
        operation: 'findByPk',
        entity: 'Canale',
      });
    }
  }

  async updateCanale(id: string, data: Partial<CanaleResponseDTO>): Promise<CanaleResponseDTO | null> {
    try {
      const canale = await this.getCanaleById(id);
      if (!canale) return null;
      const canale_to_update: Partial<CanaliAttributes> = {
        codice_canali: data.codice ?? canale.codice,
        nome_canali: data.nome ?? canale.nome,
        id_gdo_canali: data.id_gdo ?? canale.id_gdo,
      };
      const updated = await this.canaleRepository.update(id, canale_to_update);
      if (!updated) return null;
      return this.mapToDTO(updated);
    } catch (error) {
      log.error('Impossibile aggiornare il canale', error, { id });
      throw wrapDatabaseError(error, {
        message: `Error updating channel ${id}`,
        operation: 'update',
        entity: 'Canale',
        details: { id, data },
      });
    }
  }

  async getCanaliByGDOId(idGDO: string): Promise<CanaleResponseDTO[]> {
    try {
      const canali = await this.canaleRepository.findByGdoId(idGDO);
      return canali.map(this.mapToDTO);
    } catch (error) {
      log.error('Impossibile recuperare i canali per il GDO', error, { idGDO });
      throw wrapDatabaseError(error, {
        message: `Error getting channels for GDO ${idGDO}`,
        operation: 'findAll',
        entity: 'Canale',
        details: { idGDO },
      });
    }
  }


  async getAllCanaliForGDO(idGDO: string): Promise<CanaleResponseDTO[]> {
    return this.getCanaliByGDOId(idGDO);
  }
  async createCanale(
    data: { nome: string; sigla: string; id?: string; idGDO: string },
  ): Promise<CanaliAttributes> {
    try {
      let canale: CanaliAttributes | null = null;
      if (data.id) {
        // Se è presente un id, cerca prima
        const existingCanale = await this.canaleRepository.findById(data.id);

        if (existingCanale) {
          // Se trova qualcosa, aggiorna
          const updatedCanale = await this.canaleRepository.update(data.id, {
            nome_canali: data.nome,
            codice_canali: data.sigla,
            id_gdo_canali: data.idGDO
          });
          canale = updatedCanale as unknown as CanaliAttributes;
        } else {
          // Se non trova, crea
          canale = (await this.canaleRepository.create({
            nome_canali: data.nome,
            codice_canali: data.sigla,
            id_canali: data.id,
            id_gdo_canali: data.idGDO
          })) as unknown as CanaliAttributes;
        }
      } else {
        // Se non è presente un id, crea
        canale = (await this.canaleRepository.create({
          nome_canali: data.nome,
          codice_canali: data.sigla,
          id_gdo_canali: data.idGDO
        })) as unknown as CanaliAttributes;
      }

      if (!canale) {
        throw wrapDatabaseError(new Error(`Failed to create channel`), {
          message: 'Failed to create channel',
          operation: 'create',
          entity: 'Canale',
          details: { data }
        });
      }
      await sequelize.query('SELECT refresh_mv_canali()');
      return canale;
    } catch (error) {
      log.error('Impossibile creare il canale', error, { data });
      if (error instanceof DatabaseError || error instanceof ExternalApiError) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: 'Error creating channel',
        operation: 'create',
        entity: 'Canale',
        details: { data },
      });
    }
  }

  async deleteCanale(guidID: string, req?: Request): Promise<boolean> {
    try {
      if (req) {
        const result = await ServerUtils.sendToFICOApi<{ esito: boolean, error: string }>(
          req,
          config.ISTANTA_IP_ADDRESS + '/ACPV/eliminaCanale/' + guidID,
          'DELETE',
          undefined
        );

        if (!result.data.esito && result.data.error !== "") {
          throw new ExternalApiError({
            message: `Error deleting channel in FICO: ${result.data.error}`,
            service: 'FICO',
            endpoint: '/ACPV/eliminaCanale',
            details: { guidID }
          });
        }
      }

      const deleted = await this.canaleRepository.delete(guidID);
      if (deleted) {
        await sequelize.query('SELECT refresh_mv_canali()');
        return true;
      }
      return false;
    } catch (error) {
      log.error('Impossibile eliminare il canale', error, { guidID });
      if (error instanceof ExternalApiError) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: `Error deleting channel ${guidID}`,
        operation: 'delete',
        entity: 'Canale',
        details: { guidID },
      });
    }
  }

  // Materialized View Operations
  async getAllCanaliFromMaterializedView(): Promise<CanaleResponseDTO[]> {
    try {
      const [results] = await sequelize.query(`
        SELECT
          id,
          codice,
          nome,
          id_gdo,
          createdat,
          updatedat
        FROM mv_canali_ottimizzata
        ORDER BY nome
      `);

      return results as CanaleResponseDTO[];
    } catch (error) {
      log.error('Impossibile recuperare i canali dalla materialized view', error);
      throw wrapDatabaseError(error, {
        message: 'Error getting canali from materialized view',
        operation: 'materialized_view_query',
        entity: 'Canale',
      });
    }
  }

  async getCanaliByGDOIdFromMaterializedView(idGDO: string): Promise<CanaleResponseDTO[]> {
    try {
      const [results] = await sequelize.query(`
        SELECT
          id,
          codice,
          nome,
          id_gdo,
          createdat,
          updatedat
        FROM mv_canali_ottimizzata
        WHERE id_gdo = :idGDO
        ORDER BY nome
      `, {
        replacements: { idGDO }
      });

      return results as CanaleResponseDTO[];
    } catch (error) {
      log.error('Impossibile recuperare i canali per GDO dalla materialized view', error, { idGDO });
      throw wrapDatabaseError(error, {
        message: `Error getting canali for GDO ${idGDO} from materialized view`,
        operation: 'materialized_view_query',
        entity: 'Canale',
        details: { idGDO },
      });
    }
  }

}
