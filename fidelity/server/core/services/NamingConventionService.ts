import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ExternalApiError, NotFoundError, wrapDatabaseError, wrapForbiddenError } from '../../../lib/errors';
import config from '../config';
import { NamingConventionResponseDTO } from '../dto';
import { INamingConventionService } from '../interfaces/INamingConventionService';
import { log } from '../logger';
import { NamingConvention } from '../models/naming_convention';
import { TipiDiExport } from '../models/tipi_di_export';
import { ServerUtils } from '../utils/ServerUtils';

export class NamingConventionService implements INamingConventionService {

  async getAllNamingConventions(): Promise<NamingConventionResponseDTO[]> {
    try {
      const namingConventions = await NamingConvention.findAll();
      return namingConventions.map((nc) => ({
        id: nc.id_naming_convention,
        nome: nc.nome_naming_convention,
        descrizione: nc.descrizione_naming_convention,
        fields: nc.fields_naming_convention,
        createdat: nc.createdat,
        updatedat: nc.updatedat
      }));
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle naming conventions"), {
        message: "Errore durante il recupero delle naming conventions",
        operation: 'findAll',
        entity: 'NamingConvention',
        details: { error }
      });
    }
  }

  async creaNamingConventionConReq(data: any, req: Request): Promise<any> {
    try {
      const existingNamingConvention = data.id_naming_convention
        ? await NamingConvention.findOne({
          where: { id_naming_convention: data.id_naming_convention }
        })
        : null;

      const id = data.id_naming_convention || uuidv4();
      const allUids = data.namingConvention.map((item: any) => {
        if (item.id == "0") {
          return item.nome;
        }
        return item.id;
      });

      const obj = {
        id_naming_convention: id,
        nome_naming_convention: data.nome,
        descrizione_naming_convention: data.descrizione,
        fields_naming_convention: allUids
      };

      const objIstanta = {
        guidId: id,
        combinazione: allUids
      };

      const resultChiamataIstanta = await ServerUtils.sendToFICOApi<{
        content: any, esito: boolean, error: string
      }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/salvaNamingConvention`,
        'PUT',
        objIstanta
      );

      if (!resultChiamataIstanta.data.esito) {
        throw new ExternalApiError({
          message: resultChiamataIstanta.data.error,
          service: 'ISTANTA',
          endpoint: '/FicoProcess/salvaNamingConvention',
          details: { objIstanta }
        });
      }

      let resultCreazioneCombinazioneDesign;
      let isUpdate = false;

      if (existingNamingConvention) {
        await NamingConvention.update({
          nome_naming_convention: data.nome,
          descrizione_naming_convention: data.descrizione,
          fields_naming_convention: allUids,
          updatedat: new Date()
        }, {
          where: { id_naming_convention: id }
        });

        resultCreazioneCombinazioneDesign = await NamingConvention.findOne({
          where: { id_naming_convention: id }
        });
        isUpdate = true;
      } else {
        resultCreazioneCombinazioneDesign = await NamingConvention.create(obj);
        isUpdate = false;
      }

      return {
        ...resultCreazioneCombinazioneDesign?.toJSON(),
        isUpdate
      };
    } catch (error: any) {
      log.info(error.message);
      throw wrapDatabaseError(new Error("Errore durante la creazione della naming convention"), {
        message: error.message || "Errore durante la creazione della naming convention",
        operation: 'create',
        entity: 'NamingConvention',
        details: { data },
      });
    }
  }

  async deleteNamingConvention(id: string): Promise<any> {
    try {
      const namingExistsInTipoDiExport = await TipiDiExport.findOne({ where: { guid_namingconvention_tipiexport: id } });
      if (namingExistsInTipoDiExport) {
        throw wrapForbiddenError(new Error(`Naming convention con id ${id} viene utilizzata in un tipo di export`), {
          message: `Naming convention con id ${id} viene utilizzata in un tipo di export`,
          resource: 'NamingConvention',
          action: 'delete',
        });
      }
      const result = await NamingConvention.destroy({ where: { id_naming_convention: id } });
      if (result === 0) {
        throw new NotFoundError({
          message: `Naming convention con id ${id} non trovata`,
          entityType: 'NamingConvention',
          entityId: id
        });
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione della naming convention"), {
        message: "Errore durante l'eliminazione della naming convention",
        operation: 'destroy',
        entity: 'NamingConvention',
        details: { error }
      });
    }
  }

  async getAllNamingConventionFromIstanta(req: Request): Promise<any[]> {
    try {
      const result = await ServerUtils.sendToFICOApi<{ content: any[], esito: boolean, error: string }>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getAllNamingConventionComponents`,
        'GET',
        undefined
      );
      if (!result.data.esito) {
        throw new ExternalApiError({
          message: result.data.error || 'Errore API Istanta per naming convention',
          service: 'Istanta',
          endpoint: '/FicoProcess/getAllNamingConventionComponents',
        });
      }
      return result.data.content;
    } catch (error) {
      if (error instanceof ExternalApiError) throw error;
      throw wrapDatabaseError(new Error("Errore durante il recupero delle naming convention"), {
        message: "Errore durante il recupero delle naming convention",
        operation: 'sendToFICOApi',
        entity: 'ServerUtils',
        details: { error }
      });
    }
  }
}
