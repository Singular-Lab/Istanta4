import { v4 as uuidv4 } from 'uuid';
import { wrapDatabaseError } from '../../../lib/errors';
import { sequelize } from '../db';
import { AreaResponseDTO, CreateAreaDTO } from '../dto';
import { IAreaService } from '../interfaces/IAreaService';
import { log } from '../logger';
import type { IAreaRepository } from '../repositories/AreaRepository';
import { AreaRepository } from '../repositories/AreaRepository';

export class AreaService implements IAreaService {
  constructor(
    private readonly areaRepository: IAreaRepository = new AreaRepository()
  ) {}

  private mapToDTO(area: any): AreaResponseDTO {
    return {
      id: area.id_aree,
      nome: area.nome_aree,
      codice: area.codice_aree,
      id_gdo: area.id_gdo_aree,
      createdat: area.createdat,
      updatedat: area.updatedat
    };
  }

  async getAllAreas(): Promise<AreaResponseDTO[]> {
    try {
      const aree = await this.areaRepository.findAll();
      return aree.map(this.mapToDTO);
    } catch (error) {
      log.error('Impossibile recuperare tutte le aree', error);
      throw wrapDatabaseError(error, {
        message: 'Error getting all areas',
        operation: 'findAll',
        entity: 'Area',
      });
    }
  }

  async getAreaById(id: string): Promise<AreaResponseDTO | null> {
    try {
      const area = await this.areaRepository.findById(id);
      if (!area) return null;
      return this.mapToDTO(area);
    } catch (error) {
      log.error('Impossibile recuperare l\'area', error, { id });
      throw wrapDatabaseError(error, {
        message: `Error retrieving area with ID ${id}`,
        operation: 'findByPk',
        entity: 'Area',
      });
    }
  }

  async createArea(data: CreateAreaDTO): Promise<AreaResponseDTO> {
    try {
      if (data.id) {
        // Cerca l'area esistente con l'ID fornito
        const findArea = await this.areaRepository.findById(data.id);

        if (findArea) {
          // Se l'area esiste, aggiorna i dati
          const updated = await this.areaRepository.update(data.id, {
            nome_aree: data.nome,
            codice_aree: data.codice,
            id_gdo_aree: data.id_gdo ?? "",
            updatedat: new Date()
          });
          await sequelize.query('SELECT refresh_mv_aree()');
          return updated ? this.mapToDTO(updated) : this.mapToDTO(findArea);
        } else {
          // Se non trova l'area con l'ID fornito, crea una nuova area con quell'ID
          const area = await this.areaRepository.create({
            nome_aree: data.nome,
            codice_aree: data.codice,
            id_aree: data.id,
            id_gdo_aree: data.id_gdo ?? ""
          });
          await sequelize.query('SELECT refresh_mv_aree()');
          return {
            id: area.id_aree,
            nome: area.nome_aree,
            codice: area.codice_aree,
            id_gdo: area.id_gdo_aree,
            createdat: area.createdat ?? new Date(),
            updatedat: area.updatedat ?? new Date()
          };
        }
      } else {
        // Se non è presente l'ID, crea una nuova area con ID generato
        const area = await this.areaRepository.create({
          nome_aree: data.nome,
          codice_aree: data.codice,
          id_aree: uuidv4(),
          id_gdo_aree: data.id_gdo ?? ""
        });
        await sequelize.query('SELECT refresh_mv_aree()');
        return {
          id: area.id_aree,
          nome: area.nome_aree,
          codice: area.codice_aree,
          id_gdo: area.id_gdo_aree,
          createdat: area.createdat ?? new Date(),
          updatedat: area.updatedat ?? new Date()
        };
      }

    } catch (error) {
      log.error('Impossibile creare l\'area', error, { data });
      throw wrapDatabaseError(error, {
        message: 'Error creating area',
        operation: 'create',
        entity: 'Area',
        details: { data },
      });
    }
  }

  async updateArea(id: string, data: Partial<AreaResponseDTO>): Promise<AreaResponseDTO | null> {
    try {
      const exists = await this.areaRepository.findById(id);
      if (!exists) return null;

      const updated = await this.areaRepository.update(id, data as any);
      if (!updated) return null;
      return this.mapToDTO(updated);
    } catch (error) {
      log.error('Impossibile aggiornare l\'area', error, { id });
      throw wrapDatabaseError(error, {
        message: `Error updating area ${id}`,
        operation: 'update',
        entity: 'Area',
        details: { id, data },
      });
    }
  }

  async deleteArea(guidID: string): Promise<boolean> {
    try {
      const deleted = await this.areaRepository.delete(guidID);
      if (deleted) {
        await sequelize.query('SELECT refresh_mv_aree()');
        return true;
      }
      return false;
    } catch (error) {
      log.error('Impossibile eliminare l\'area', error, { guidID });
      throw wrapDatabaseError(error, {
        message: `Error deleting area ${guidID}`,
        operation: 'delete',
        entity: 'Area',
      });
    }
  }

  async getAreasByGDOId(gdoId: string): Promise<AreaResponseDTO[]> {
    try {
      const aree = await this.areaRepository.findByGdoId(gdoId);
      return aree.map(this.mapToDTO);
    } catch (error) {
      log.error('Impossibile recuperare le aree per il GDO', error, { gdoId });
      throw wrapDatabaseError(error, {
        message: `Error getting areas for GDO ${gdoId}`,
        operation: 'findAll',
        entity: 'Area',
        details: { gdoId },
      });
    }
  }


  async getAllAreeForGDO(gdoId: string): Promise<AreaResponseDTO[]> {
    return this.getAreasByGDOId(gdoId);
  }

  // Materialized View Operations
  async getAllAreasFromMaterializedView(): Promise<AreaResponseDTO[]> {
    try {
      const [results] = await sequelize.query(`
        SELECT
          id,
          codice,
          nome,
          id_gdo,
          createdat,
          updatedat
        FROM mv_aree_ottimizzata
        ORDER BY nome
      `);

      return results as AreaResponseDTO[];
    } catch (error) {
      log.error('Impossibile recuperare le aree dalla materialized view', error);
      throw wrapDatabaseError(error, {
        message: 'Error getting areas from materialized view',
        operation: 'materialized_view_query',
        entity: 'Area',
      });
    }
  }

  async getAreasByGDOIdFromMaterializedView(gdoId: string): Promise<AreaResponseDTO[]> {
    try {
      const [results] = await sequelize.query(`
        SELECT
          id,
          codice,
          nome,
          id_gdo,
          createdat,
          updatedat
        FROM mv_aree_ottimizzata
        WHERE id_gdo = :gdoId
        ORDER BY nome
      `, {
        replacements: { gdoId }
      });

      return results as AreaResponseDTO[];
    } catch (error) {
      log.error('Impossibile recuperare le aree per GDO dalla materialized view', error, { gdoId });
      throw wrapDatabaseError(error, {
        message: `Error getting areas for GDO ${gdoId} from materialized view`,
        operation: 'materialized_view_query',
        entity: 'Area',
        details: { gdoId },
      });
    }
  }

}
