import { NotFoundError, wrapDatabaseError, wrapForbiddenError, wrapNotFoundError } from '../../../lib/errors';
import { FormatiAttributes } from '../../../lib/types';
import { CreateFormatiDTO, FormatiResponseDTO } from '../dto';
import { IFormatoService } from '../interfaces/IFormatoService';
import { Formati } from '../models/formati';
import { RaccoglitoreKit } from '../models/raccoglitore_kit';

export class FormatoService implements IFormatoService {

  async getAllFormati(): Promise<FormatiResponseDTO[]> {
    try {
      const formati = await Formati.findAll();
      return formati.map((formato: FormatiAttributes) => ({
        id: formato.id_formati ?? '',
        nome: formato.nome_formati,
        codice: formato.codice_formati,
        descrizione: formato.descrizione_formati,
        tipo_lavorazione: formato.tipo_lavorazione_formati,
        createdat: formato.createdat,
        updatedat: formato.updatedat ?? new Date()
      }));
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei formati"), {
        message: "Errore durante il recupero dei formati",
        operation: 'findAll',
        entity: 'Formati',
        details: { error }
      });
    }
  }

  async getFormatoById(id: string): Promise<FormatiResponseDTO | null> {
    try {
      const formato = await Formati.findByPk(id);
      if (!formato) return null;
      const response: FormatiResponseDTO = {
        id: formato.id_formati ?? '',
        nome: formato.nome_formati,
        codice: formato.codice_formati,
        descrizione: formato.descrizione_formati,
        tipo_lavorazione: formato.tipo_lavorazione_formati,
        createdat: formato.createdat,
        updatedat: formato.updatedat ?? new Date()
      };
      return response;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del formato"), {
        message: "Errore durante il recupero del formato",
        operation: 'findByPk',
        entity: 'Formati',
        details: { error }
      });
    }
  }

  async createFormato(data: CreateFormatiDTO): Promise<FormatiResponseDTO> {
    try {
      const dataToCreate: FormatiAttributes = {
        nome_formati: data.nome,
        codice_formati: data.codice,
        descrizione_formati: data.descrizione,
        tipo_lavorazione_formati: data.tipo_lavorazione
      };

      if (data.id != undefined) {
        const findFormato = await Formati.findOne({ where: { id_formati: data.id } });
        if (findFormato) {
          findFormato.nome_formati = data.nome;
          findFormato.codice_formati = data.codice;
          findFormato.descrizione_formati = data.descrizione;
          findFormato.tipo_lavorazione_formati = data.tipo_lavorazione;
          findFormato.updatedat = new Date();
          await findFormato.save();
          const response: FormatiResponseDTO = {
            id: findFormato.id_formati,
            nome: data.nome,
            codice: data.codice,
            descrizione: data.descrizione,
            tipo_lavorazione: data.tipo_lavorazione,
            createdat: findFormato.createdat ?? new Date(),
            updatedat: findFormato.updatedat ?? new Date()
          };
          return response;
        } else {
          dataToCreate.id_formati = data.id;
          const result = await Formati.create(dataToCreate);
          const response: FormatiResponseDTO = {
            id: result.id_formati,
            nome: result.nome_formati,
            codice: result.codice_formati,
            descrizione: result.descrizione_formati,
            tipo_lavorazione: result.tipo_lavorazione_formati,
            createdat: result.createdat,
            updatedat: result.updatedat ?? new Date()
          };
          return response;
        }
      } else {
        const result = await Formati.create(dataToCreate);
        const response: FormatiResponseDTO = {
          id: result.id_formati,
          nome: result.nome_formati,
          codice: result.codice_formati,
          descrizione: result.descrizione_formati,
          tipo_lavorazione: result.tipo_lavorazione_formati,
          createdat: result.createdat,
          updatedat: result.updatedat ?? new Date()
        };
        return response;
      }
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la creazione del formato"), {
        message: "Errore durante la creazione del formato",
        operation: 'create',
        entity: 'Formati',
        details: { data },
      });
    }
  }

  async deleteFormato(id: string): Promise<any> {
    try {
      const isPossibleToDelete = await RaccoglitoreKit.findOne({ where: { id_formato: id }, raw: true });
      if (isPossibleToDelete) {
        throw wrapForbiddenError(new Error(`Formato con id ${id} viene utilizzato in un raccoglitore kit`), {
          message: `Formato con id ${id} viene utilizzato in un raccoglitore kit`,
          resource: 'Formati',
          action: 'delete',
        });
      }
      const result = await Formati.destroy({ where: { id_formati: id } });
      if (result === 0) {
        throw wrapNotFoundError(new Error(`Formato con id ${id} non trovato`), {
          message: `Formato con id ${id} non trovato`,
          entityType: 'Formati',
          entityId: id,
          details: { id }
        });
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione del formato"), {
        message: "Errore durante l'eliminazione del formato",
        operation: 'destroy',
        entity: 'Formati',
        details: { id },
      });
    }
  }
}
