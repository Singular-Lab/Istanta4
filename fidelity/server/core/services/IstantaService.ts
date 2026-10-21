import { Request } from "express";
import { Op } from 'sequelize';
import { OperationStatus, operationStatusReverseMapping } from "../../../lib/enums";
import { BadRequestError, DatabaseError, ExternalApiError, NotFoundError } from "../../../lib/errors";
import { FileItemKit } from "../../../lib/types";
import config from "../config";
import { IIstantaService } from "../interfaces/IIstantaService";
import { log } from "../logger";
import { Tracciati } from "../models";
import { FilesRuntime } from "../models/files_runtime";
import { RuntimeKit } from "../models/runtime_kit";
import { ServerUtils } from "../utils/ServerUtils";
import { esitoIstanta, verificaRisposta } from "../utils/rispostaServizi";


export class IstantaService implements IIstantaService {

  async getStatusImportazione(guidId: string, req: Request): Promise<any> {
    type StatoImportazione = { stato: OperationStatus; error: string; esito: boolean };
    const data = verificaRisposta<StatoImportazione>(
      await ServerUtils.sendToFICOApi<StatoImportazione>(req, `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getStatoImportazione/${guidId}`, "GET", {}),
      'ISTANTA',
      '/FicoProcess/getStatoImportazione'
    );
    if (data.stato === OperationStatus.Scartata) {
      const updateTracciato = await Tracciati.findOne({
        where: { id_tracciati: guidId }
      })
      if (updateTracciato) {
        updateTracciato.stato_tracciati = 'Scartato';
        await updateTracciato.save();
      }
    }
    if (data.stato === OperationStatus.Terminata) {
      const updateTracciato = await Tracciati.findOne({
        where: { id_tracciati: guidId }
      })
      if (updateTracciato) {
        updateTracciato.stato_tracciati = 'Terminata';
        await updateTracciato.save();
      }
    }
    const datoDaRitornareCorretto = {
      ...data,
      stato: operationStatusReverseMapping[data.stato],
    }
    return datoDaRitornareCorretto;
  }

  async getCombinazioniDaIstanta(promoId: string, req: Request): Promise<{
    esito: boolean;
    error: string;
    lista: Array<{
      guidIdArea: string;
      guidIdCanale: string;
      traccia: any[];
    }>;
  }> {
    type Combinazioni = {
      esito: boolean;
      error: string;
      lista: Array<{
        guidIdArea: string;
        guidIdCanale: string;
        tracciatoContext: any[];
      }>;
    };
    const data = verificaRisposta<Combinazioni>(
      await ServerUtils.sendToFICOApi<Combinazioni>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getCombinazioniLavorazioneByPromo/${promoId}`,
        "GET",
        {}
      ),
      'ISTANTA',
      '/FicoProcess/getCombinazioniLavorazioneByPromo',
      // Una promo senza tracciati torna esito false con lista vuota e nessun errore: non e un fallimento
      (d) => esitoIstanta(d) || (Array.isArray(d?.lista) && !d?.error)
    );
    // Map the response to match the expected interface
    return {
      ...data,
      lista: data.lista.map(item => ({
        ...item,
        traccia: item.tracciatoContext
      }))
    };
  }

  async downloadKitsByTipoDiExport(data: {
    guidIdTipoDiExport: string,
    guidIdKitRuntime?: string,
    guidIdGdo?: string,
    guidIdArea?: string,
    guidIdCanale?: string,
    data_da?: Date,
    data_a?: Date
  }, req: Request): Promise<any> {
    try {
      if (!data.guidIdTipoDiExport) {
        throw new BadRequestError({
          message: 'guidIdTipoDiExport is required',
          details: { field: 'guidIdTipoDiExport' },
        });
      }

      // If guidIdKitRuntime is specified, we only need to check that specific kit
      if (data.guidIdKitRuntime) {
        const kitRuntime = await RuntimeKit.findOne({
          where: {
            id: data.guidIdKitRuntime,
            tipi_di_export_in_kit: { [Op.contains]: [{ tipo_di_export_guid_id: data.guidIdTipoDiExport }] }
          } as any,
          raw: true
        }) as any;

        if (!kitRuntime) {
          throw new NotFoundError({
            message: 'Kit runtime not found with specified export type',
            entityId: data.guidIdKitRuntime,
            entityType: 'RuntimeKit'
          });
        }

        const files = await FilesRuntime.findAll({
          where: { id_runtime: kitRuntime.id },
          raw: true
        }) as unknown as FileItemKit[];

        const formattedFiles = await Promise.all(files.map(async file => {
          const fileBuffer = verificaRisposta<{ content: Buffer, esito: boolean, error: string }>(
            await ServerUtils.sendToFICOApi<{ content: Buffer, esito: boolean, error: string }>(
              req,
              `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getMaterialeRuntime/${file.id}`,
              'GET',
              undefined
            ),
            'ISTANTA',
            '/FicoProcess/getMaterialeRuntime'
          );
          return {
            guiIdRegistro: file.id,
            nomeFileOrigine: file.nome,
            versione: 1,
            file: fileBuffer.content
          };
        }));

        return {
          guidIdKitRuntime: kitRuntime.id,
          guidIdArea: kitRuntime.id_area,
          guidIdCanale: kitRuntime.id_canale,
          files: formattedFiles
        };
      }

      // Build query for multiple kits
      const whereClause: any = {
        tipi_di_export_in_kit: { [Op.contains]: [{ tipo_di_export_guid_id: data.guidIdTipoDiExport }] }
      };

      // Add optional filters
      if (data.guidIdArea) {
        whereClause.id_area = data.guidIdArea;
      }

      if (data.guidIdCanale) {
        whereClause.id_canale = data.guidIdCanale;
      }

      // guidIdGdo: not available in RuntimeKit PG model — filter skipped

      const kits = await RuntimeKit.findAll({ where: whereClause, raw: true }) as any[];

      const kitIds = kits.map(k => k.id);
      const allFiles = await FilesRuntime.findAll({
        where: { id_runtime: { [Op.in]: kitIds } },
        raw: true
      }) as unknown as FileItemKit[];

      const filesByKit = new Map<string, FileItemKit[]>();
      for (const file of allFiles) {
        const bucket = filesByKit.get(file.id_runtime as string) ?? [];
        bucket.push(file);
        filesByKit.set(file.id_runtime as string, bucket);
      }

      const formattedKits = await Promise.all(kits.map(async kit => {
        const files = filesByKit.get(kit.id) ?? [];

        const formattedFiles = await Promise.all(files.map(async file => {
          const fileBuffer = verificaRisposta<{ content: Buffer, esito: boolean, error: string }>(
            await ServerUtils.sendToFICOApi<{ content: Buffer, esito: boolean, error: string }>(
              req,
              `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getMaterialeRuntime/${file.id}`,
              'GET',
              undefined
            ),
            'ISTANTA',
            '/FicoProcess/getMaterialeRuntime'
          );
          return {
            guiIdRegistro: file.id,
            nomeFileOrigine: file.nome,
            versione: 1,
            file: fileBuffer.content
          };
        }));

        return {
          guidIdKitRuntime: kit.id,
          guidIdArea: kit.id_area,
          guidIdCanale: kit.id_canale,
          files: formattedFiles
        };
      }));

      return {
        list: formattedKits,
        error: ""
      };

    } catch (error) {
      if (error instanceof ExternalApiError) throw error;
      log.error('Errore durante il download dei kit per tipo di export', error instanceof Error ? error : new Error(String(error)), { data });
      throw new DatabaseError({
        message: "Errore durante il download dei kit per tipo di export",
        operation: 'findAll',
        entity: 'RuntimeKit',
        details: { data },
        cause: error instanceof Error ? error : undefined
      });
    }
  }

}
