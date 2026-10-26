import { Op } from 'sequelize';
import { MODALITA_TIPO_EXPORT, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { NotFoundError, wrapDatabaseError, wrapForbiddenError } from '../../../lib/errors';
import { TipiDiExportAttributes } from '../../../lib/types';
import { CreateTipiDiExportDTO, TipiDiExportResponseDTO } from '../dto';
import { ITipoExportService } from '../interfaces/ITipoExportService';
import { DesignKit } from '../models/design_kit';
import { RaccoglitoreKit } from '../models/raccoglitore_kit';
import { RuntimeKit } from '../models/runtime_kit';
import { TipiDiExport } from '../models/tipi_di_export';
import type { IFormatiRepository } from '../repositories/FormatiRepository';
import type { IRaccoglitoreKitRepository } from '../repositories/RaccoglitoreKitRepository';
import type { ITipiDiExportRepository } from '../repositories/TipiDiExportRepository';

export class TipoExportService implements ITipoExportService {

  constructor(
    private tipiDiExportRepository: ITipiDiExportRepository,
    private formatiRepository: IFormatiRepository,
    private raccoglitoreKitRepository: IRaccoglitoreKitRepository
  ) {}

  async creaTipoExport(data: CreateTipiDiExportDTO): Promise<TipiDiExportResponseDTO> {
    try {
      const dataToCreate: TipiDiExportAttributes = {
        nome_tipiexport: data.nome,
        codice_tipiexport: data.codice,
        modalita_tipiexport: data.modalita,
        guid_namingconvention_tipiexport: data.guid_namingconvention,
        filtri_tipiexport: data.filtri
      };

      if (data.id) {
        const existingTipoExport = await TipiDiExport.findOne({ where: { id_tipiexport: data.id } });
        if (existingTipoExport) {
          existingTipoExport.nome_tipiexport = data.nome;
          existingTipoExport.codice_tipiexport = data.codice;
          existingTipoExport.modalita_tipiexport = data.modalita;
          existingTipoExport.guid_namingconvention_tipiexport = data.guid_namingconvention;
          existingTipoExport.filtri_tipiexport = data.filtri;
          existingTipoExport.updatedat = new Date();
          await existingTipoExport.save();

          const response: TipiDiExportResponseDTO = {
            id: existingTipoExport.id_tipiexport,
            nome: existingTipoExport.nome_tipiexport,
            codice: existingTipoExport.codice_tipiexport,
            modalita: existingTipoExport.modalita_tipiexport as MODALITA_TIPO_EXPORT,
            guid_namingconvention: existingTipoExport.guid_namingconvention_tipiexport,
            filtri: existingTipoExport.filtri_tipiexport,
            createdat: existingTipoExport.createdat,
            updatedat: existingTipoExport.updatedat
          };
          return response;
        } else {
          dataToCreate.id_tipiexport = data.id;
          const result = await TipiDiExport.create(dataToCreate);
          const response: TipiDiExportResponseDTO = {
            id: result.id_tipiexport,
            nome: result.nome_tipiexport,
            codice: result.codice_tipiexport,
            modalita: result.modalita_tipiexport as MODALITA_TIPO_EXPORT,
            guid_namingconvention: result.guid_namingconvention_tipiexport,
            filtri: result.filtri_tipiexport,
            createdat: result.createdat,
            updatedat: result.updatedat ?? new Date()
          };
          return response;
        }
      } else {
        const result = await TipiDiExport.create(dataToCreate);
        const response: TipiDiExportResponseDTO = {
          id: result.id_tipiexport,
          nome: result.nome_tipiexport,
          codice: result.codice_tipiexport,
          modalita: result.modalita_tipiexport as MODALITA_TIPO_EXPORT,
          guid_namingconvention: result.guid_namingconvention_tipiexport,
          filtri: result.filtri_tipiexport,
          createdat: result.createdat,
          updatedat: result.updatedat ?? new Date()
        };
        return response;
      }
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la creazione o aggiornamento del tipo di export"), {
        message: "Errore durante la creazione o aggiornamento del tipo di export",
        operation: 'createOrUpdate',
        entity: 'TipiDiExport',
        details: { error }
      });
    }
  }

  async getTipoExportById(id: string): Promise<TipiDiExportResponseDTO | null> {
    try {
      const tipoExport = await TipiDiExport.findByPk(id);
      if (!tipoExport) return null;
      const response: TipiDiExportResponseDTO = {
        id: tipoExport.id_tipiexport,
        nome: tipoExport.nome_tipiexport,
        codice: tipoExport.codice_tipiexport,
        modalita: tipoExport.modalita_tipiexport as MODALITA_TIPO_EXPORT,
        guid_namingconvention: tipoExport.guid_namingconvention_tipiexport,
        filtri: tipoExport.filtri_tipiexport,
        createdat: tipoExport.createdat,
        updatedat: tipoExport.updatedat
      };
      return response;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del tipo di export"), {
        message: "Errore durante il recupero del tipo di export",
        operation: 'findByPk',
        entity: 'TipiDiExport',
        details: { id },
      });
    }
  }

  async getTipoExportByCodice(codice: string): Promise<TipiDiExportResponseDTO | null> {
    try {
      const tipoExport = await TipiDiExport.findOne({ where: { codice_tipiexport: codice }, raw: true });
      if (!tipoExport) return null;

      const response: TipiDiExportResponseDTO = {
        id: tipoExport.id_tipiexport,
        nome: tipoExport.nome_tipiexport,
        codice: tipoExport.codice_tipiexport,
        modalita: tipoExport.modalita_tipiexport as MODALITA_TIPO_EXPORT,
        guid_namingconvention: tipoExport.guid_namingconvention_tipiexport,
        filtri: tipoExport.filtri_tipiexport,
        createdat: tipoExport.createdat,
        updatedat: tipoExport.updatedat
      };
      return response;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del tipo di export"), {
        message: "Errore durante il recupero del tipo di export",
        operation: 'findOne',
        entity: 'TipiDiExport',
        details: { codice },
      });
    }
  }

  async getAllTipiExport(): Promise<TipiDiExportResponseDTO[]> {
    try {
      const tipiExport = await TipiDiExport.findAll();
      return tipiExport.map((tipoExport: TipiDiExportAttributes) => ({
        id: tipoExport.id_tipiexport ?? '',
        nome: tipoExport.nome_tipiexport,
        codice: tipoExport.codice_tipiexport,
        modalita: tipoExport.modalita_tipiexport as MODALITA_TIPO_EXPORT,
        guid_namingconvention: tipoExport.guid_namingconvention_tipiexport,
        filtri: tipoExport.filtri_tipiexport,
        createdat: tipoExport.createdat,
        updatedat: tipoExport.updatedat ?? new Date()
      }));
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei tipi di export"), {
        message: "Errore durante il recupero dei tipi di export",
        operation: 'findAll',
        entity: 'TipiDiExport',
        details: { error },
      });
    }
  }

  async getTipiExportPerPOP(): Promise<TipiDiExportResponseDTO[]> {
    try {
      // Step 1: ottieni gli ID dei formati POP
      const formatiPopIds = await this.formatiRepository.findIdsByTipoLavorazione(TIPO_LAVORAZIONE.POP);
      if (formatiPopIds.length === 0) return [];

      // Step 2: ottieni i kit template che usano un formato POP
      const raccoglitori = await this.raccoglitoreKitRepository.findByFormatiIds(formatiPopIds);
      if (raccoglitori.length === 0) return [];

      // Step 3: estrai gli ID dei tipi di export dai kit template (deduplicati)
      const tipiDiExportIds = [
        ...new Set(
          raccoglitori
            .flatMap(r => r.tipi_di_export_in_kit)
            .map(item => item.tipo_di_export_guid_id)
            .filter((id): id is string => Boolean(id))
        )
      ];
      if (tipiDiExportIds.length === 0) return [];

      // Step 4: ottieni i tipi di export per quegli ID
      const tipiDiExport = await this.tipiDiExportRepository.findByIds(tipiDiExportIds);

      return tipiDiExport.map(tipoExport => ({
        id: tipoExport.id_tipiexport ?? '',
        nome: tipoExport.nome_tipiexport,
        codice: tipoExport.codice_tipiexport,
        modalita: tipoExport.modalita_tipiexport as MODALITA_TIPO_EXPORT,
        guid_namingconvention: tipoExport.guid_namingconvention_tipiexport,
        filtri: tipoExport.filtri_tipiexport,
        createdat: tipoExport.createdat,
        updatedat: tipoExport.updatedat ?? new Date()
      }));
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei tipi di export per POP"), {
        message: "Errore durante il recupero dei tipi di export per POP",
        operation: 'findAll',
        entity: 'TipiDiExport',
        details: { error },
      });
    }
  }

  async deleteTipoExport(id: string): Promise<any> {
    try {
      const kitDesign = await DesignKit.findOne({ where: { tipi_di_export_in_kit: { [Op.contains]: [{ tipo_di_export_guid_id: id }] } } as any, raw: true });
      if (kitDesign) {
        throw wrapForbiddenError(new Error(`Tipo di export con id ${id} viene utilizzato in un kit design o template`), {
          message: `Tipo di export con id ${id} viene utilizzato in un kit design o template`,
          resource: 'TipiDiExport',
          action: 'delete',
          details: { id }
        });
      }
      const templateCombinazione = await RaccoglitoreKit.findOne({ where: { tipi_di_export_in_kit: { [Op.contains]: [{ tipo_di_export_guid_id: id }] } } as any, raw: true });
      if (templateCombinazione) {
        throw wrapForbiddenError(new Error(`Tipo di export con id ${id} viene utilizzato in un template combinazione`), {
          message: `Tipo di export con id ${id} viene utilizzato in un template combinazione`,
          resource: 'TipiDiExport',
          action: 'delete',
          details: { id }
        });
      }
      const kitRuntime = await RuntimeKit.findOne({ where: { tipi_di_export_in_kit: { [Op.contains]: [{ tipo_di_export_guid_id: id }] } } as any, raw: true });
      if (kitRuntime) {
        throw wrapForbiddenError(new Error(`Tipo di export con id ${id} viene utilizzato in un kit runtime`), {
          message: `Tipo di export con id ${id} viene utilizzato in un kit runtime`,
          resource: 'TipiDiExport',
          action: 'delete',
          details: { id }
        });
      }
      const result = await TipiDiExport.destroy({ where: { id_tipiexport: id } });
      if (result === 0) {
        throw new NotFoundError({
          message: `Tipo di export con id ${id} non trovato`,
          entityType: 'TipiDiExport',
          entityId: id
        });
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione del tipo di export"), {
        message: "Errore durante l'eliminazione del tipo di export",
        operation: 'destroy',
        entity: 'TipiDiExport',
        details: { error }
      });
    }
  }
}
