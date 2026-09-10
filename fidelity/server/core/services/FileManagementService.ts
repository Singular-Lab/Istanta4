import archiver from 'archiver';
import axios from 'axios';
import dayjs from 'dayjs';
import { Request as ExpressRequest } from 'express';
import fs from 'fs';
import crypto from 'node:crypto';
import path from 'path';
import { Op } from 'sequelize';
import stream, { Readable } from 'stream';
import unzipper from 'unzipper';
import { log } from '../logger';
import { v4 as uuidv4 } from 'uuid';
import { CATEGORIA_ATTIVITA, EVENTI_WEBHOOK, EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, TIPO_ATTIVITA, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { AppError, BadRequestError, DatabaseError, ExternalApiError, NotFoundError, wrapApiError, wrapAppError, wrapDatabaseError, wrapExternalError, wrapNotFoundError } from '../../../lib/errors';
import {
  FileItemKit,
  FileItemKitLog,
  FotoGruppoReferenze,
  RUNTIME_KIT_MONGO,
  ReferenzeIstanta
} from '../../../lib/types';
import config from '../config';
import type { TipiDiExportResponseDTO } from '../dto';
import { IAreaService } from '../interfaces/IAreaService';
import { ICanaleService } from '../interfaces/ICanaleService';
import type { IConfigService } from '../interfaces/IConfigService';
import { IFileManagementService } from '../interfaces/IFileManagementService';
import type { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import type { ITipoExportService } from '../interfaces/ITipoExportService';
import type { IWebhookService } from '../interfaces/IWebhookService';
import { Config } from '../models/config';
import { FilesRuntime } from '../models/files_runtime';
import { FilesRuntimeLog, type FilesRuntimeLogAttributes } from '../models/files_runtime_log';
import { Referenze } from '../models/referenze';
import { ReferenzeGruppo } from '../models/referenze_gruppo';
import { RuntimeKit } from '../models/runtime_kit';
import type { IPromoRepository } from '../repositories/PromoRepository';
import { normalizePromoModel } from '../utils/PromoModelUtils';
import { ServerUtils } from '../utils/ServerUtils';
import { TraduttoreReferenze } from '../utils/Translator';

/** Converts a ReferenzeIstanta (camelCase) to snake_case for the Referenze PG model */
function referenzaToSnakeCase(ref: ReferenzeIstanta): any {
  return {
    id: ref.id,
    compiled_fields: ref.compiledFields ?? (ref as any).compiled_fields,
    deleted_fields: ref.deletedFields ?? (ref as any).deleted_fields,
    data_fields: ref.dataFields ?? (ref as any).data_fields,
    foto: ref.foto,
    meccanica: ref.meccanica,
    codice_box: ref.codiceBox ?? (ref as any).codice_box,
    foto_extra: ref.fotoExtra ?? (ref as any).foto_extra,
    group_elements: ref.groupElements ?? (ref as any).group_elements,
    id_runtime_kit: ref.guidIdKitRuntime ?? (ref as any).id_runtime_kit,
    id_promo: ref.idPromo ?? (ref as any).id_promo,
    pag: ref.pag,
    x: ref.x,
    y: ref.y,
    w: ref.w,
    h: ref.h,
    w_page: ref.wPage ?? (ref as any).w_page,
    h_page: ref.hPage ?? (ref as any).h_page,
    perc_ingombro: ref.percIngombro ?? (ref as any).perc_ingombro,
    aspect_ratio: ref.aspectRatio ?? (ref as any).aspect_ratio,
    createdAt: ref.createdAt ?? new Date(),
    updatedAt: ref.updatedAt ?? new Date(),
  };
}

interface MatchedFile {
  originalFile: FileItemKit;
  newFile: {
    name: string;
    content: string; // base64
    type: string;
  }
}

export class FileManagementService implements IFileManagementService {
  constructor(
    private readonly kitRuntimeService: IKitRuntimeService,
    private readonly tipoExportService: ITipoExportService,
    private readonly configService: IConfigService,
    private readonly areeService: IAreaService,
    private readonly canaliService: ICanaleService,
    private readonly webhookService: IWebhookService,
    private readonly promoRepository: IPromoRepository
  ) { }




  // ── Download ────────────────────────────────────────────────────────

  async downloadFilesAsZip(files: FileItemKit[]): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      const bufferStream = new stream.PassThrough();
      const buffers: Buffer[] = [];

      bufferStream.on('data', (data) => {
        buffers.push(data);
      });
      bufferStream.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      bufferStream.on('error', reject);

      archive.pipe(bufferStream);

      const downloadPromises = files.map(async (file) => {
        if (file.id_olimpo_cloud) {
          try {
            const localUrl = `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`;
            const response = await axios.get(localUrl, { responseType: 'stream' });
            archive.append(response.data, { name: file.nome });
            console.log(`File aggiunto all'archivio: ${file.nome}`);
          } catch (error) {
            console.error(`Failed to download file: ${file.nome} (ID: ${file.id_olimpo_cloud})`, error);
          }
        } else {
          console.warn(`File ${file.nome} non ha un id_olimpo_cloud valido`);
        }
      });

      try {
        await Promise.all(downloadPromises);
        await archive.finalize();
        console.log(`Archivio finalizzato con ${files.length} file processati`);
      } catch (error) {
        console.error('Errore durante la creazione dell\'archivio:', error);
        reject(error);
      }
    });
  }

  async downloadPromoFilesAsZip(files: FileItemKit[], promoName: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      const bufferStream = new stream.PassThrough();
      const buffers: Buffer[] = [];

      bufferStream.on('data', (data) => {
        buffers.push(data);
      });
      bufferStream.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      bufferStream.on('error', reject);

      archive.pipe(bufferStream);

      const filesByKit: { [kitName: string]: FileItemKit[] } = {};
      files.forEach(file => {
        const kitName = file.nome_kit || 'Kit Senza Nome';
        if (!filesByKit[kitName]) {
          filesByKit[kitName] = [];
        }
        filesByKit[kitName].push(file);
      });

      const downloadPromises = Object.entries(filesByKit).flatMap(([kitName, kitFiles]) => {
        const folderName = kitName.replace(/[<>:"/\\|?*]/g, '_');

        return kitFiles.map(async (file) => {
          if (file.id_olimpo_cloud) {
            try {
              const localUrl = `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`;
              const response = await axios.get(localUrl, { responseType: 'stream' });

              const cleanFileName = file.nome.split(' (Lavorazione:')[0];
              const filePath = `${folderName}/${cleanFileName}`;
              archive.append(response.data, { name: filePath });
              console.log(`File aggiunto all'archivio: ${filePath}`);
            } catch (error) {
              console.error(`Failed to download file: ${file.nome} (ID: ${file.id_olimpo_cloud})`, error);
            }
          } else {
            console.warn(`File ${file.nome} non ha un id_olimpo_cloud valido`);
          }
        });
      });

      try {
        await Promise.all(downloadPromises);
        await archive.finalize();
        console.log(`Archivio finalizzato con ${files.length} file processati organizzati in ${Object.keys(filesByKit).length} kit`);
      } catch (error) {
        console.error('Errore durante la creazione dell\'archivio:', error);
        reject(error);
      }
    });
  }

  public async processRejectedZip(zipBuffer: Buffer, rejectedFiles: FileItemKit[]): Promise<MatchedFile[]> {
    const bufferStream = Readable.from(zipBuffer);
    const matchedFiles: MatchedFile[] = [];

    //@ts-ignore
    const unzipped = bufferStream.pipe(unzipper.Parse({ forceStream: true }));
    //@ts-ignore
    for await (const entry of unzipped) {
      const filePath = entry.path;
      const fileName = path.basename(filePath);

      const originalFile = rejectedFiles.find(rf => rf.nome === fileName);

      if (originalFile) {
        const chunks: any[] = [];
        for await (const chunk of entry) {
          chunks.push(chunk);
        }
        const fileContent = Buffer.concat(chunks);

        matchedFiles.push({
          originalFile: originalFile,
          newFile: {
            name: fileName,
            content: fileContent.toString('base64'),
            type: 'application/pdf',
          }
        });
      } else {
        entry.autodrain();
      }
    }

    return matchedFiles;
  }


  // ── Retrieval ───────────────────────────────────────────────────────

  async getAllFiles(id: string): Promise<any> {
    try {
      const kit = await this.kitRuntimeService.getKitRuntimeById(id);
      const files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(id);

      if (!kit) {
        throw wrapNotFoundError(new Error("Kit non trovato"), {
          message: "Kit non trovato",
          entityType: "KitRuntime",
          entityId: id
        });
      }

      if (!files) {
        throw wrapNotFoundError(new Error("Kit senza file"), {
          message: "Kit senza file",
          entityType: "KitRuntime",
          entityId: id
        });
      }

      const filesArray = await Promise.all(files.map(async (f: FileItemKit) => {
        return {
          id: f.id_olimpo_cloud ?? '',
          nome: f.nome,
          url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${f.id_olimpo_cloud}`,
          url_download: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${f.id_olimpo_cloud}`,
          id_olimpo_cloud: f.id_olimpo_cloud,
          direttive: f.direttive,
          nome_originale: f.nome_originale,
          isOptional: f.isOptional,
          tipo_export: f.tipo_export
        };
      }));

      return {
        titolo: kit.titolo,
        files: filesArray
      };
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei file"), {
        message: "Errore durante il recupero dei file",
        operation: 'get',
        entity: 'KitRuntime',
        details: { error }
      });
    }
  }

  async getAllFilesDocumentale(page: number = 0, pageSize: number = 0, filters: {
    idArea?: string;
    idCanale?: string;
    idTipoExport?: string;
    idFormato?: string;
    idPuntoVendita?: string;
    idLavorazione?: string;
    idCombinazione?: string;
    nome?: string;
  }, metadataFilter?: { field: string; value: string }): Promise<any> {
    try {
      let allKit = await this.kitRuntimeService.getAllCombinazioniRuntimeFilters({
        idArea: filters.idArea,
        idCanale: filters.idCanale,
        idTipoExport: filters.idTipoExport,
        idFormato: filters.idFormato,
        idPv: filters.idPuntoVendita,
        idLavorazione: filters.idLavorazione,
        idCombinazione: filters.idCombinazione,
        nome: filters.nome
      });
      const correggoTipoExport = (await this.tipoExportService.getAllTipiExport()).find((t) => t.codice === EXPORT_DI_SISTEMA.CORREGGO);
      allKit = allKit.filter((kit) => kit.tipo === TIPO_KIT_DESIGN.AUTOMATICO);

      const configApp = await Config.findOne({ raw: true });
      const data_fields_files = configApp?.webpliant?.data_fields_files || [];

      const promoMap = new Map<string, { id: string; nome: string; validita_dal: any; validita_al: any; stato: string; kits: { id: string; nome: string; files: any[] }[] }>();

      for (const kit of allKit) {
        const kitId = (kit as any).id ?? (kit as any).guidId;
        let files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntimeFilters({
          id_runtime: kitId,
        });

        if (correggoTipoExport) {
          files = files.filter((f) => f.tipo_export !== correggoTipoExport.id);
        }

        let mappedFiles = files.map((f: FileItemKit) => ({
          id: f.id_olimpo_cloud ?? '',
          nome: f.nome,
          nome_originale: f.nome_originale,
          url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${f.id_olimpo_cloud}`,
          url_download: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${f.id_olimpo_cloud}`,
          id_olimpo_cloud: f.id_olimpo_cloud,
          direttive: f.direttive,
          isOptional: f.isOptional,
          tipo_export: f.tipo_export,
          tipo_export_codice: f.tipo_export_codice,
          meta_olimpo_cloud: f.meta_olimpo_cloud,
          pages: f.pages
        }));

        // Filtro metadata
        if (metadataFilter?.field && metadataFilter?.value) {
          const searchValue = metadataFilter.value.toLowerCase();
          mappedFiles = mappedFiles.filter((file) => {
            if (!file.meta_olimpo_cloud) return false;
            const meta = file.meta_olimpo_cloud as Record<string, any>;
            const parts = metadataFilter.field.split('.');
            let fieldValue: any = meta;
            for (const part of parts) {
              if (fieldValue == null || typeof fieldValue !== 'object') return false;
              fieldValue = fieldValue[part];
            }
            if (fieldValue && typeof fieldValue === 'object' && fieldValue.content !== undefined) {
              fieldValue = fieldValue.content;
            }
            if (typeof fieldValue !== 'string') return false;
            return fieldValue.toLowerCase().includes(searchValue);
          });
        }

        // Filtro nome
        if (filters.nome) {
          const searchTerm = filters.nome.toLowerCase();
          mappedFiles = mappedFiles.filter((file) =>
            file.nome.toLowerCase().includes(searchTerm) ||
            (data_fields_files?.some((field: string) =>
              (file.meta_olimpo_cloud?.[field]?.toLowerCase() || '').includes(searchTerm)
            ) ?? false)
          );
        }

        if (mappedFiles.length === 0) continue;

        const promoId = (kit as any).id_promo ?? (kit as any).idPromo;
        if (!promoMap.has(promoId)) {
          try {
            const promoInfo = await this.getPromoInfo(promoId);
            promoMap.set(promoId, {
              id: promoId,
              nome: promoInfo.nome,
              validita_dal: promoInfo.validita_dal,
              validita_al: promoInfo.validita_al,
              stato: promoInfo.stato,
              kits: []
            });
          } catch {
            promoMap.set(promoId, {
              id: promoId,
              nome: '',
              validita_dal: '',
              validita_al: '',
              stato: '',
              kits: []
            });
          }
        }

        promoMap.get(promoId)!.kits.push({
          id: kitId,
          nome: kit.titolo,
          files: mappedFiles
        });
      }

      const promos = Array.from(promoMap.values());
      const totalFiles = promos.reduce((acc, p) => acc + p.kits.reduce((a, k) => a + k.files.length, 0), 0);

      return {
        totalItems: totalFiles,
        totalPages: pageSize > 0 ? Math.ceil(totalFiles / pageSize) : 1,
        currentPage: page,
        pageSize: pageSize > 0 ? pageSize : totalFiles,
        promos
      };
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei file documentale " + error.message), {
        message: "Errore durante il recupero dei file documentale " + error.message,
        operation: 'get',
        entity: 'KitRuntime',
        details: { error }
      });
    }
  }

  //ALERT: questa funzione è identica a getAllFilesDocumentale ma filtra per kit MANUALI
  async getAllContenutiDigitali(page: number = 0, pageSize: number = 0, filters: {
    idArea?: string;
    idCanale?: string;
    idTipoExport?: string;
    idFormato?: string;
    idPuntoVendita?: string;
    idLavorazione?: string;
    idCombinazione?: string;
    nome?: string;
  }, metadataFilter?: { field: string; value: string }): Promise<any> {
    try {
      let allKit = await this.kitRuntimeService.getAllCombinazioniRuntimeFilters({
        idArea: filters.idArea,
        idCanale: filters.idCanale,
        idTipoExport: filters.idTipoExport,
        idFormato: filters.idFormato,
        idPv: filters.idPuntoVendita,
        idLavorazione: filters.idLavorazione,
        idCombinazione: filters.idCombinazione,
        nome: filters.nome
      });
      const correggoTipoExport = (await this.tipoExportService.getAllTipiExport()).find((t) => t.codice === EXPORT_DI_SISTEMA.CORREGGO);
      allKit = allKit.filter((kit) => kit.tipo === TIPO_KIT_DESIGN.MANUALE);

      const configApp = await Config.findOne({ raw: true });
      const data_fields_files = configApp?.webpliant?.data_fields_files || [];

      const promoMap = new Map<string, { id: string; nome: string; validita_dal: any; validita_al: any; stato: string; kits: { id: string; nome: string; files: any[] }[] }>();

      for (const kit of allKit) {
        const kitId = (kit as any).id ?? (kit as any).guidId;
        let files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntimeFilters({
          id_runtime: kitId,
        });

        if (correggoTipoExport) {
          files = files.filter((f) => f.tipo_export !== correggoTipoExport.id);
        }

        let mappedFiles = files.map((f: FileItemKit) => ({
          id: f.id_olimpo_cloud ?? '',
          nome: f.nome,
          nome_originale: f.nome_originale,
          url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${f.id_olimpo_cloud}`,
          url_download: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${f.id_olimpo_cloud}`,
          id_olimpo_cloud: f.id_olimpo_cloud,
          direttive: f.direttive,
          pages: f.pages,
          isOptional: f.isOptional,
          tipo_export: f.tipo_export,
          tipo_export_codice: f.tipo_export_codice,
          meta_olimpo_cloud: f.meta_olimpo_cloud,
        }));

        // Filtro metadata
        if (metadataFilter?.field && metadataFilter?.value) {
          const searchValue = metadataFilter.value.toLowerCase();
          mappedFiles = mappedFiles.filter((file) => {
            if (!file.meta_olimpo_cloud) return false;
            const meta = file.meta_olimpo_cloud as Record<string, any>;
            const parts = metadataFilter.field.split('.');
            let fieldValue: any = meta;
            for (const part of parts) {
              if (fieldValue == null || typeof fieldValue !== 'object') return false;
              fieldValue = fieldValue[part];
            }
            if (fieldValue && typeof fieldValue === 'object' && fieldValue.content !== undefined) {
              fieldValue = fieldValue.content;
            }
            if (typeof fieldValue !== 'string') return false;
            return fieldValue.toLowerCase().includes(searchValue);
          });
        }

        // Filtro nome
        if (filters.nome) {
          const searchTerm = filters.nome.toLowerCase();
          mappedFiles = mappedFiles.filter((file) =>
            file.nome.toLowerCase().includes(searchTerm) ||
            (data_fields_files?.some((field: string) =>
              (file.meta_olimpo_cloud?.[field]?.toLowerCase() || '').includes(searchTerm)
            ) ?? false)
          );
        }

        if (mappedFiles.length === 0) continue;

        const promoId = (kit as any).id_promo ?? (kit as any).idPromo;
        if (!promoMap.has(promoId)) {
          try {
            const promoInfo = await this.getPromoInfo(promoId);
            promoMap.set(promoId, {
              id: promoId,
              nome: promoInfo.nome,
              validita_dal: promoInfo.validita_dal,
              validita_al: promoInfo.validita_al,
              stato: promoInfo.stato,
              kits: []
            });
          } catch {
            promoMap.set(promoId, {
              id: promoId,
              nome: '',
              validita_dal: '',
              validita_al: '',
              stato: '',
              kits: []
            });
          }
        }

        promoMap.get(promoId)!.kits.push({
          id: kitId,
          nome: kit.titolo,
          files: mappedFiles
        });
      }

      const promos = Array.from(promoMap.values());
      const totalFiles = promos.reduce((acc, p) => acc + p.kits.reduce((a, k) => a + k.files.length, 0), 0);

      return {
        totalItems: totalFiles,
        totalPages: pageSize > 0 ? Math.ceil(totalFiles / pageSize) : 1,
        currentPage: page,
        pageSize: pageSize > 0 ? pageSize : totalFiles,
        promos
      };
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei contenuti digitali " + error.message), {
        message: "Errore durante il recupero dei contenuti digitali " + error.message,
        operation: 'get',
        entity: 'KitRuntime',
        details: { error }
      });
    }
  }

  async getKitRunTimeById(id: string, get_files: boolean = true): Promise<any> {
    try {
      let kit = await this.kitRuntimeService.getKitRuntimeById(id);
      if (!kit) {
        throw wrapNotFoundError(new Error("Kit non trovato"), {
          message: "Kit non trovato",
          entityType: "KitRuntime",
          entityId: id
        });
      }

      if (!get_files) {
        return kit;
      }

      let files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(id);
      if (!files) {
        throw wrapNotFoundError(new Error("Kit senza file"), {
          message: "Kit senza file",
          entityType: "KitRuntime",
          entityId: id
        });
      }

      const filesArray = await Promise.all(files.map(async (f: FileItemKit) => {
        return {
          id: f.id_olimpo_cloud ?? '',
          nome: f.nome,
          url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${f.id_olimpo_cloud}`,
          url_download: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${f.id_olimpo_cloud}`,
          id_olimpo_cloud: f.id_olimpo_cloud,
          direttive: f.direttive,
          nome_originale: f.nome_originale,
          isOptional: f.isOptional,
          tipo_export: f.tipo_export,
          id_runtime: f.id_runtime,
          meta_olimpo_cloud: f.meta_olimpo_cloud,
          tipo_export_codice: f.tipo_export_codice,
        };
      }));

      kit.files = filesArray;
      return kit;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del kit runtime"), {
        message: "Errore durante il recupero del kit runtime",
        operation: 'get',
        entity: 'KitRuntime',
        details: { error }
      });
    }
  }

  async getProprietaMetaFilesRuntime(idKitRuntime: string): Promise<string[]> {
    try {
      const resultCreazioneCombinazioneDesign = await FilesRuntime.findAll({
        where: { id_runtime: idKitRuntime },
        raw: true
      }) as unknown as FileItemKit[];
      let metaProprieta: string[] = [];
      await Promise.all(resultCreazioneCombinazioneDesign.map(async (item) => {
        Object.keys(item?.meta_olimpo_cloud ?? {}).forEach((key) => {
          if (!metaProprieta.includes(key)) {
            metaProprieta.push(key);
          }
        });
      }));
      return metaProprieta;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle proprietà meta dei file runtime"), {
        message: "Errore durante il recupero delle proprietà meta dei file runtime",
        operation: 'get',
        entity: 'FilesRuntime',
        details: { error }
      });
    }
  }

  async getAllCombinazioniRuntimePDF(codice?: string): Promise<any[]> {
    try {
      if (!codice) {
        codice = EXPORT_DI_SISTEMA.VOL;
      }
      const combinazioni = await RuntimeKit.findAll({ raw: true }) as unknown as RUNTIME_KIT_MONGO[];
      if (!combinazioni) {
        return [];
      }

      let files: {
        idCanale: string;
        idKit: string;
        idArea: string;
        nomeCanale: string;
        nomeArea: string;
        files_field: Array<{
          nome_file: string;
          id_olimpo_cloud: any;
          tipo_export: string;
          codice_tipiexport: string;
          idPromo: string;
          url: string;
          url_download: string;
        }>
      }[] = [];

      await Promise.all(combinazioni.map(async (combinazione) => {
        const area = await this.areeService.getAreaById(combinazione.guidArea);
        const canale = await this.canaliService.getCanaleById(combinazione.guidCanale);
        if (!canale) {
          throw wrapNotFoundError(new Error("Canale non trovato"), {
            message: "Canale non trovato",
            entityType: "Canale",
            entityId: combinazione.guidCanale
          });
        }
        const nomeCanale = canale.nome;
        const fileEntry = {
          idCanale: combinazione.guidCanale,
          idKit: combinazione.guidId,
          idArea: combinazione.guidArea,
          nomeCanale: nomeCanale,
          nomeArea: area?.nome ?? '',
          files_field: []
        } as any;

        const runtimeFiles = await FilesRuntime.findAll({
          where: { id_runtime: combinazione.guidId },
          raw: true
        }) as unknown as FileItemKit[];
        await Promise.all(runtimeFiles.map(async (file: FileItemKit) => {
          const exportType = await this.tipoExportService.getTipoExportById(file.tipo_export);
          if (exportType && exportType.codice === codice) {
            fileEntry.files_field.push({
              nome_file: file.nome,
              id_olimpo_cloud: file.id_olimpo_cloud,
              tipo_export: file.tipo_export,
              codice_tipiexport: exportType.codice,
              idPromo: combinazione.idPromo,
              url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`,
              url_download: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`
            });
            files.push(fileEntry);
          }
        }));
      }));

      return files;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni runtime PDF"), {
        message: "Errore durante il recupero delle combinazioni runtime PDF",
        operation: 'get',
        entity: 'CombinazioniRuntime',
        details: { error }
      });
    }
  }

  async getAllCombinazioniRuntimePDFWebPliant(idArea: string, idCanale: string, idsKitDesign: string[], idsTipiDiExport: string[]): Promise<any[]> {
    try {
      const whereClause: any = {
        id_area: idArea,
        id_canale: idCanale,
      };

      if (idsKitDesign && idsKitDesign.length > 0) {
        whereClause.id_design = { [Op.in]: idsKitDesign };
      }

      const combinazioni = await RuntimeKit.findAll({
        where: whereClause,
        raw: true
      }) as unknown as RUNTIME_KIT_MONGO[];

      if (combinazioni.length === 0) {
        return [];
      }

      // Filter in memory for tipiDiExportInKit matching
      const filteredCombinazioni = combinazioni.filter((c: any) => {
        const tipi = c.tipi_di_export_in_kit || [];
        return tipi.some((tipo: any) => idsTipiDiExport.includes(tipo.tipo_di_export_guid_id));
      });

      let files: {
        idCanale: string;
        idKit: string;
        idArea: string;
        nomeCanale: string;
        nomeArea: string;
        files_field: Array<{
          nome_file: string;
          id_olimpo_cloud: any;
          tipo_export: string;
          codice_tipiexport: string;
          idPromo: string;
          url: string;
          url_download: string;
        }>
      }[] = [];

      await Promise.all(filteredCombinazioni.map(async (combinazione) => {
        const area = await this.areeService.getAreaById(combinazione.guidArea);
        const canale = await this.canaliService.getCanaleById(combinazione.guidCanale);
        if (!canale) {
          throw new NotFoundError({
            message: "Canale non trovato",
            entityType: "Canale",
            entityId: combinazione.guidCanale
          });
        }
        const nomeCanale = canale.nome;
        const fileEntry = {
          idCanale: combinazione.guidCanale,
          idKit: combinazione.guidId,
          idArea: combinazione.guidArea,
          nomeCanale: nomeCanale,
          nomeArea: area?.nome ?? '',
          files_field: []
        } as any;

        const runtimeFiles = await FilesRuntime.findAll({
          where: { id_runtime: combinazione.guidId },
          raw: true
        }) as unknown as FileItemKit[];
        await Promise.all(runtimeFiles.map(async (file: FileItemKit) => {
          const exportType = await this.tipoExportService.getTipoExportById(file.tipo_export);
          if (exportType && idsTipiDiExport.includes(file.tipo_export)) {
            fileEntry.files_field.push({
              nome_file: file.nome,
              id_olimpo_cloud: file.id_olimpo_cloud,
              tipo_export: file.tipo_export,
              codice_tipiexport: exportType.codice,
              idPromo: combinazione.idPromo,
              url: `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`,
              url_download: `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`
            });
            files.push(fileEntry);
          }
        }));
      }));

      return files;
    } catch (error) {
      throw new DatabaseError({
        message: "Errore durante il recupero delle combinazioni runtime PDF per WebPliant",
        operation: 'get',
        entity: 'KitRunTime',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getContenutoDigitali(): Promise<any> {
    try {
      let oggettoArrayMisto: {
        fileRuntimeMateriali: FileItemKit[],
        fotoDiGruppo: FotoGruppoReferenze[],
      } = {
        fileRuntimeMateriali: [],
        fotoDiGruppo: []
      }

      const fileRuntimeMateriali = await FilesRuntime.findAll({
        where: { tipo_export: "DIG" },
        raw: true
      }) as unknown as FileItemKit[];
      const fotoDiGruppo = await ReferenzeGruppo.findAll({ raw: true }) as unknown as FotoGruppoReferenze[];

      oggettoArrayMisto.fileRuntimeMateriali = fileRuntimeMateriali;
      oggettoArrayMisto.fotoDiGruppo = fotoDiGruppo;

      return oggettoArrayMisto;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei contenuti digitali"), {
        message: "Errore durante il recupero dei contenuti digitali",
        operation: 'get',
        entity: 'FileItemKit',
        details: { error }
      });
    }
  }

  // ── Upload ──────────────────────────────────────────────────────────

  async uploadMateriale(file: Express.Multer.File, data: any, req: ExpressRequest): Promise<any> {
    try {
      const { guidKitRuntime, tipoExport, nomeFile, meta } = data;
      const dir = path.resolve(process.cwd(), "server/core/public/uploads/materiali_POP/");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      const fileResolve = nomeFile;
      const newFilePath = path.resolve(dir, fileResolve);

      if (file.mimetype === 'application/json') {
        await fs.promises.rename(file.path, newFilePath);
      } else {
        const fileBuffer = await fs.promises.readFile(file.path);
        const uint = new Uint8Array(fileBuffer);
        await fs.promises.writeFile(newFilePath, uint);
      }

      const file_extension = path.extname(file.originalname);
      const tipoDiExportModel = await this.tipoExportService.getTipoExportById(tipoExport);
      if (!tipoDiExportModel) {
        throw wrapNotFoundError(new Error("Tipo di export non trovato"), {
          message: "Tipo di export non trovato",
          entityType: "TipoExport",
          entityId: tipoExport
        });
      }

      const codiceExport = tipoDiExportModel.codice;

      if (file_extension === ".pdf" && codiceExport !== "WEB") {
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(newFilePath);
        const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        formData.append("file", fileBlob, path.basename(newFilePath));
        formData.append("json_meta_materiale", JSON.stringify({
          Id: "",
          FileHash: hash,
          FileName: fileResolve,
          JsonMeta: meta
        }));

        const result = await axios.post<{
          esito: boolean,
          error: string,
          content: {
            id: string,
            file_name: string,
            json_meta: string
          }
        }>(
          `${config.OLYMPUS_IP_ADDRESS}/materiali/uploadMateriale`,
          formData,
          { headers: { "Authorization": req.headers.authorization as string } }
        );

        if (!result.data.esito) {
          throw wrapApiError(new Error("Errore durante il caricamento del materiale"), {
            message: result.data.error,
            service: 'OLYMPUS',
            endpoint: '/materiali/uploadMateriale'
          });
        }
        let kitRuntime = await this.kitRuntimeService.getKitRuntimeById(guidKitRuntime);
        if (!kitRuntime) {
          throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
            message: "Kit runtime non trovato",
            entityType: "KitRuntime",
            entityId: guidKitRuntime
          });
        }
        if (kitRuntime.stato_lavorazione !== STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE) {
          throw wrapDatabaseError(new Error("Kit runtime non in lavorazione, in stato: " + kitRuntime.stato_lavorazione), {
            message: "Kit runtime non in lavorazione, in stato: " + kitRuntime.stato_lavorazione,
            operation: 'upload',
            entity: 'Materiale',
          });
        }
        let files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(guidKitRuntime);
        if (!files) {
          throw wrapNotFoundError(new Error("Kit non trovato"), {
            message: "Kit non trovato",
            entityType: "KitRuntime",
            entityId: guidKitRuntime
          });
        }

        const fileCercatoPerNome = files.find(f => f.nome == fileResolve);
        const ricercaPerId = files.find(f => f.id_olimpo_cloud == result.data.content.id);

        let newFile: FileItemKit = {
          id: '',
          id_runtime: '',
          direttive: '',
          nome: '',
          nome_originale: '',
          isOptional: false,
          meta_olimpo_cloud: undefined,
          tipo_export: '',
          tipo_export_codice: ''
        };

        let isNewFile = false;
        if (!fileCercatoPerNome && !ricercaPerId) {
          newFile = {
            id: uuidv4(),
            id_runtime: guidKitRuntime,
            id_olimpo_cloud: result.data.content.id,
            nome_originale: result.data.content.file_name,
            nome: fileResolve,
            tipo_export: tipoExport,
            direttive: "",
            isOptional: false,
            meta_olimpo_cloud: result.data.content.json_meta,
            tipo_export_codice: tipoDiExportModel.codice
          };
          isNewFile = true;
          files.push(newFile);
        } else if (fileCercatoPerNome && !ricercaPerId) {
          const index = files.indexOf(fileCercatoPerNome);
          files[index].id_olimpo_cloud = result.data.content.id;
          newFile = files[index];
        } else if (!fileCercatoPerNome && ricercaPerId) {
          const index = files.indexOf(ricercaPerId);
          files[index].nome = fileResolve;
          newFile = files[index];
        } else if (fileCercatoPerNome && ricercaPerId) {
          const index = files.indexOf(fileCercatoPerNome);
          files[index].id_olimpo_cloud = result.data.content.id;
          newFile = files[index];
        }

        await fs.promises.rm(newFilePath);

        if (isNewFile) {
          await this.kitRuntimeService.insertNewFileRuntime(newFile);
        } else {
          await this.kitRuntimeService.updateSingleFileRuntime(newFile);
        }
        const existLog = await this.kitRuntimeService.getFileRunTimeLogByNomeFileEIdKitRuntime(fileResolve, guidKitRuntime);
        const log: FileItemKitLog = {
          id: uuidv4(),
          guid_kit_runtime: guidKitRuntime,
          nome_file: fileResolve,
          data_registrazione: new Date(),
          versione: existLog?.versione ? existLog.versione + 1 : 0,
          logs: existLog?.logs,
          stato: STATO_LOG_FILE.IN_ATTESA
        }
        await this.kitRuntimeService.insertNewFileRuntimeLog(log);
      } else if ((file_extension === ".json" || file_extension === ".webpliant") && codiceExport === "WEB") {
        const fileBuffer = fs.readFileSync(newFilePath);
        const fileString = fileBuffer.toString();
        const fileJson: ReferenzeIstanta[] = JSON.parse(fileString);

        let kit = await this.kitRuntimeService.getKitRuntimeById(guidKitRuntime);
        if (!kit) {
          throw wrapNotFoundError(new Error("Kit non trovato"), {
            message: "Kit non trovato",
            entityType: "KitRuntime",
            entityId: guidKitRuntime
          });
        }

        await Promise.all(fileJson.map(async (referenza) => {
          referenza.id = uuidv4();
          referenza.guidIdKitRuntime = guidKitRuntime;
        }));

        await this.bulkEliminateReferenze(guidKitRuntime);
        const result = await this.bulkCreateReferenze(fileJson);
        const log: FileItemKitLog = {
          id: uuidv4(),
          guid_kit_runtime: guidKitRuntime,
          nome_file: "main.json",
          data_registrazione: new Date(),
          versione: 1,
          logs: undefined,
          stato: STATO_LOG_FILE.IN_ATTESA
        }
        await this.kitRuntimeService.insertNewFileRuntimeLog(log);
        await fs.promises.rm(newFilePath);
        return result;
      } else {
        await fs.promises.unlink(newFilePath);
        throw wrapDatabaseError(new Error("Tipo di file non supportato o tipo di export errato per il tipo di file"), {
          message: "Tipo di file non supportato o tipo di export errato per il tipo di file",
          operation: 'upload',
          entity: 'Materiale',
        });
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else if (error instanceof ExternalApiError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante l'upload del materiale"), {
          message: "Errore durante l'upload del materiale",
          operation: 'upload',
          entity: 'Materiale',
          details: { error }
        });
      }
    }
  }

  async uploadKitManuali(idPromo: string, idKit: string, files: Express.Multer.File[], metadata: any, req: ExpressRequest): Promise<any> {
    try {
      if (files.length === 0) {
        const getKit = await this.kitRuntimeService.getKitManualeDaId(idKit);
        return await this.kitRuntimeService.creaKitRuntimeManuale(idPromo, getKit);
      }

      const fileDataArray = await Promise.all(files.map(async (file, index) => {
        const fileBuffer = await fs.promises.readFile(file.path);
        return {
          id: uuidv4(),
          originalIndex: index,
          nome: metadata[index].nome,
          direttive: metadata[index].direttive,
          isOptional: metadata[index].isOptional,
          file: fileBuffer,
        };
      }));

      const uploadResults = await Promise.allSettled(fileDataArray.map(async (fileData) => {
        const formData = new FormData();
        const blobParts = new Uint8Array(fileData.file);
        const fileBlob = new Blob([blobParts], { type: 'application/pdf' });
        const hash = await crypto.createHash('md5').update(fileData.file).digest('hex');

        formData.append("file", fileBlob, path.basename(fileData.nome));
        formData.append("json_meta_materiale", JSON.stringify({
          Id: "",
          FileHash: hash,
          FileName: fileData.nome,
          JsonMeta: {
            direttive: fileData.direttive,
            isOptional: fileData.isOptional,
          }
        }));

        const result = await ServerUtils.sendToFicoApiAxiosUpload<{
          content: {
            id: string,
            file_name: string,
            json_meta: string
          }, esito: boolean, error: string
        }>(
          req,
          config.OLYMPUS_IP_ADDRESS + "/materiali/uploadMateriale",
          formData
        );

        return {
          uploadResult: result,
          originalFileData: fileData
        };
      }));

      const newFilesToSave: FileItemKit[] = uploadResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          const { uploadResult, originalFileData } = result.value;
          let jsonMeta = typeof uploadResult.data.content.json_meta === "string" ?
            JSON.parse(uploadResult.data.content.json_meta) :
            uploadResult.data.content.json_meta;

          return {
            id: originalFileData.id,
            id_runtime: idKit,
            id_olimpo_cloud: uploadResult.data.content.id,
            nome_originale: uploadResult.data.content.file_name,
            nome: originalFileData.nome,
            direttive: originalFileData.direttive,
            isOptional: originalFileData.isOptional,
            tipo_export: metadata[originalFileData.originalIndex].tipo_export,
            meta_olimpo_cloud: jsonMeta,
            tipo_export_codice: metadata[originalFileData.originalIndex].tipo_export_codice,
            error: undefined,
          };
        } else {
          const originalFileData = fileDataArray[index];
          return {
            id: originalFileData.id,
            id_runtime: idKit,
            id_olimpo_cloud: '',
            nome_originale: '',
            nome: '',
            direttive: '',
            isOptional: false,
            tipo_export: metadata[originalFileData.originalIndex].tipo_export,
            meta_olimpo_cloud: {},
            tipo_export_codice: metadata[originalFileData.originalIndex].tipo_export_codice,
            error: result.reason?.message || 'Upload failed',
          };
        }
      });

      let logs: (FileItemKitLog | null)[] = uploadResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            id: uuidv4(),
            guid_kit_runtime: idKit,
            nome_file: metadata[index].nome,
            data_registrazione: new Date(),
            azione: 'Upload',
            utente: req.session.id_utente as string,
            versione: 1,
            log: undefined,
            stato: STATO_LOG_FILE.IN_ATTESA
          }
        } else {
          return null;
        }
      });
      await Promise.all(logs.map(async (log) => {
        console.log(log);
        if (log) {
          await this.kitRuntimeService.insertNewFileRuntimeLog(log);
        }
      }));

      // Pulisci i file temporanei
      await Promise.all(files.map(async (file) => {
        try {
          await fs.promises.rm(file.path);
        } catch (cleanupError) {
          console.warn(`Errore nella pulizia del file ${file.path}:`, cleanupError);
        }
      }));

      const kit = await this.kitRuntimeService.getKitRuntimeById(idKit);
      if (!kit) {
        throw new NotFoundError({
          message: "Kit non trovato",
          entityType: "KitRuntime",
          entityId: idKit
        });
      }

      // Salva solo i file uploadati con successo
      const datiFileDaSalvare = newFilesToSave.filter((f) => f.error == undefined && f.id_olimpo_cloud !== "");
      await Promise.all(datiFileDaSalvare.map(async (f) => {
        await this.kitRuntimeService.insertNewFileRuntime(f);
      }));

      if (metadata.id_utente) {
        await ServerUtils.CREA_ATTIVITA(
          metadata.id_utente,
          TIPO_ATTIVITA.UPLOAD_FILE_MANUALE,
          CATEGORIA_ATTIVITA.PRODUZIONE,
          { ...kit }
        );
      }

      return newFilesToSave;
    } catch (error) {
      // Assicurati di pulire i file anche in caso di errore
      try {
        await Promise.all(files.map(async (file) => {
          await fs.promises.rm(file.path);
        }));
      } catch (cleanupError) {
        console.warn('Errore nella pulizia dei file dopo errore:', cleanupError);
      }

      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else if (error instanceof ExternalApiError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante l'upload dei kit manuali"), {
          message: "Errore durante l'upload dei kit manuali",
          operation: 'upload',
          entity: 'KitRuntime',
          details: { error }
        });
      }
    }
  }

  async replaceFileKitRuntime(idFile: string, file: Express.Multer.File, req: ExpressRequest): Promise<any> {
    try {
      // 1. Find the file to be replaced
      const fileToReplace = await FilesRuntime.findOne({
        where: {
          id: idFile,
          id_runtime: { [Op.ne]: null }
        },
        raw: true
      });
      if (!fileToReplace) {
        throw new NotFoundError({ message: `File con id ${idFile} non trovato.`, entityType: 'FilesRuntime' });
      }

      // 2. Upload the new file to Olimpo
      const formData = new FormData();
      const blobParts = new Uint8Array(file.buffer);
      const fileBlob = new Blob([blobParts], { type: file.mimetype });
      const hash = await crypto.createHash('md5').update(file.buffer).digest('hex');

      formData.append("file", fileBlob, path.basename(file.originalname));
      formData.append("json_meta_materiale", JSON.stringify({
        Id: "",
        FileHash: hash,
        FileName: file.originalname,
        JsonMeta: {
          direttive: "",
          isOptional: false,
        }
      }));

      const olimpusResponseAxios = await ServerUtils.sendToFicoApiAxiosUpload<{
        content: {
          id: string,
          file_name: string,
          json_meta: string
        }, esito: boolean, error: string
      }>(
        req,
        config.OLYMPUS_IP_ADDRESS + "/materiali/uploadMateriale",
        formData
      );
      const olimpusResponse = olimpusResponseAxios.data;

      if (!olimpusResponse || !olimpusResponse.esito || !olimpusResponse.content.id) {
        throw new ExternalApiError({
          message: 'Errore durante il caricamento del nuovo file su Olimpus.',
          details: { error: olimpusResponse.error }
        });
      }

      const lastLog = await FilesRuntimeLog.findOne({
        where: {
          id_kit_runtime: fileToReplace.id_runtime,
          nome_file: file.originalname
        },
        order: [['versione', 'DESC']],
        raw: true
      });

      const newVersion = lastLog ? lastLog.versione + 1 : 1;

      const log: FileItemKitLog = {
        id: uuidv4(),
        guid_kit_runtime: fileToReplace.id_runtime as string,
        nome_file: file.originalname,
        data_registrazione: new Date(),
        versione: newVersion,
        logs: [
          ...(lastLog?.logs || []),
          {
            azione: 'Upload',
            messaggio: `Sostituito con ${file.originalname}`,
            data_notifica: new Date(),
            utente_notifica: req.session.id_utente as string,
          }
        ] as any,
        stato: STATO_LOG_FILE.ACCETTATO
      }
      if (lastLog != undefined) {
        await FilesRuntimeLog.update(
          { logs: log.logs, stato: STATO_LOG_FILE.ACCETTATO },
          { where: { id: lastLog.id } }
        );
      } else {
        await FilesRuntimeLog.create({ ...log, id_kit_runtime: log.guid_kit_runtime } as any);
      }

    } catch (error) {
      console.error('Errore in replaceFileKitRuntime:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new DatabaseError({ message: 'Errore non previsto durante la sostituzione del file.', cause: error instanceof Error ? error : undefined, operation: 'update', entity: 'FilesRuntime' });
    }
  }

  async uploadForzatoImmaginiOlimpo(file: Express.Multer.File, guidId: string): Promise<any> {
    try {
      if (!file) {
        throw wrapNotFoundError(new Error("Nessun file caricato"), {
          message: "Nessun file caricato",
          entityType: "File",
          entityId: guidId
        });
      }
      const formData = new FormData();
      const blobParts = new Uint8Array(file.buffer);
      const blob = new Blob([blobParts], { type: file.mimetype });
      formData.append('file', blob, file.originalname);
      formData.append('id', guidId);

      const result = await axios.post(
        `${config.OLYMPUS_IP_ADDRESS}/foto/updateFotoPathWeb`,
        formData,
        {
          headers: {
            Authorization: guidId,
          },
        }
      );

      if (!result.data.esito) {
        throw wrapApiError(new Error("Errore durante il caricamento dell'immagine"), {
          message: result.data.error,
          service: 'OLYMPUS',
          endpoint: '/foto/updateFotoPathWeb'
        });
      }

      return result.data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else if (error instanceof ExternalApiError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il caricamento dell'immagine"), {
          message: "Errore durante il caricamento dell'immagine",
          operation: 'upload',
          entity: 'Foto',
          details: { error }
        });
      }
    }
  }

  async updateImmagineReferenza(file: Express.Multer.File, data: any): Promise<any> {
    try {
      const { guidId, guidIdReferenza } = data;
      if (!file) {
        throw wrapNotFoundError(new Error("Nessun file caricato"), {
          message: "Nessun file caricato",
          entityType: "File",
          entityId: guidId
        });
      }

      const formData = new FormData();
      const blobParts = new Uint8Array(file.buffer);
      const blob = new Blob([blobParts], { type: file.mimetype });
      formData.append('file', blob, file.originalname);
      formData.append('id', guidId);

      const result = await axios.post(
        `${config.OLYMPUS_IP_ADDRESS}/foto/updateFotoPathWeb`,
        formData,
        {
          headers: {
            Authorization: data.private_key,
          },
        }
      );

      if (!result.data.esito) {
        throw wrapApiError(new Error("Errore durante il caricamento dell'immagine"), {
          message: result.data.error,
          service: 'OLYMPUS',
          endpoint: '/foto/updateFotoPathWeb'
        });
      }

      const guidIdFoto = result.data.guidId;
      const getRef = await this.getReferenzaById(guidIdReferenza);
      if (!getRef) {
        throw wrapNotFoundError(new Error("Referenza non trovata"), {
          message: "Referenza non trovata",
          entityType: "Referenza",
          entityId: guidIdReferenza
        });
      }

      const nuovaRef: ReferenzeIstanta = {
        ...getRef,
        foto: [guidIdFoto],
      };

      const resultUpdate = await this.updateReferenza(guidIdReferenza, nuovaRef);
      if (!resultUpdate) {
        throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
          message: "Errore durante l'aggiornamento della referenza",
          operation: 'update',
          entity: 'Referenza',
        });
      }

      return result.data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else if (error instanceof ExternalApiError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante l'aggiornamento dell'immagine referenza"), {
          message: "Errore durante l'aggiornamento dell'immagine referenza",
          operation: 'update',
          entity: 'Referenza',
        });
      }
    }
  }

  async updateImmagineGruppoReferenza(file: Express.Multer.File, data: any): Promise<any> {
    try {
      const { guidId, idArea, idCanale } = data;
      if (!file) {
        throw wrapNotFoundError(new Error("Nessun file caricato"), {
          message: "Nessun file caricato",
          entityType: "File",
          entityId: guidId
        });
      }

      const formData = new FormData();
      const blobParts = new Uint8Array(file.buffer);
      const blob = new Blob([blobParts], { type: file.mimetype });
      formData.append('file', blob, file.originalname);
      formData.append('id', "");

      const result = await axios.post(
        `${config.OLYMPUS_IP_ADDRESS}/foto/updateFotoPathWeb`,
        formData,
        {
          headers: {
            Authorization: data.private_key,
          },
        }
      );

      if (!result.data.esito) {
        throw wrapApiError(new Error("Errore durante il caricamento dell'immagine"), {
          message: result.data.error,
          service: 'OLYMPUS',
          endpoint: '/foto/updateFotoPathWeb'
        });
      }

      const guidIdFoto = result.data.guidId;
      const getRef = await this.getReferenzaById(guidId);
      if (!getRef) {
        throw wrapNotFoundError(new Error("Referenza non trovata"), {
          message: "Referenza non trovata",
          entityType: "Referenza",
          entityId: guidId
        });
      }

      let findFotoGruppoAlreadyExist = await ReferenzeGruppo.findOne({
        where: {
          codice_referenza: getRef.dataFields?.codice_referenza,
          id_area: idArea,
          id_canale: idCanale
        },
        raw: true
      }) as unknown as FotoGruppoReferenze;

      if (!findFotoGruppoAlreadyExist) {
        findFotoGruppoAlreadyExist = await ReferenzeGruppo.findOne({
          where: {
            codice_referenza: getRef.dataFields?.codice_referenza,
            [Op.or]: [
              { id_area: null },
              { id_area: "" },
              { id_canale: null },
              { id_canale: "" }
            ]
          },
          raw: true
        }) as unknown as FotoGruppoReferenze;
      }

      if (findFotoGruppoAlreadyExist) {
        const newFotoGruppo: any = {
          guid_id_olympo: guidIdFoto,
          ...(idArea !== "" && { id_area: idArea }),
          ...(idCanale !== "" && { id_canale: idCanale }),
        };

        const resultUpdate = await ReferenzeGruppo.update(newFotoGruppo, {
          where: { codice_referenza: getRef.dataFields?.codice_referenza }
        });

        if (!resultUpdate) {
          throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
            message: "Errore durante l'aggiornamento della referenza",
            operation: 'update',
            entity: 'Referenza',
          });
        }

        const nuovaRef: ReferenzeIstanta = {
          ...getRef,
          fotoGruppo: guidIdFoto,
        };

        const resultUpdateReferenza = await this.updateReferenza(guidId, nuovaRef);
        if (!resultUpdateReferenza) {
          throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
            message: "Errore durante l'aggiornamento della referenza",
            operation: 'update',
            entity: 'Referenza',
          });
        }
      } else {
        const newFotoGruppo: any = {
          guid_id_olympo: guidIdFoto,
          codice_referenza: getRef.dataFields?.codice_referenza as string,
          id: uuidv4(),
          id_area: idArea,
          id_canale: idCanale,
        };

        const resultInsert = await ReferenzeGruppo.create(newFotoGruppo);
        if (!resultInsert) {
          throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
            message: "Errore durante l'aggiornamento della referenza",
            operation: 'update',
            entity: 'Referenza',
          });
        }

        const nuovaRef: ReferenzeIstanta = {
          ...getRef,
          fotoGruppo: guidIdFoto,
        };

        const resultUpdateReferenza = await this.updateReferenza(guidId, nuovaRef);
        if (!resultUpdateReferenza) {
          throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
            message: "Errore durante l'aggiornamento della referenza",
            operation: 'update',
            entity: 'Referenza',
          });
        }
      }

      return result.data;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else if (error instanceof ExternalApiError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante l'aggiornamento dell'immagine gruppo referenza"), {
          message: "Errore durante l'aggiornamento dell'immagine gruppo referenza",
          operation: 'update',
          entity: 'Referenza',
          details: { error }
        });
      }
    }
  }

  async invioMaterialeAdFP(
    guidKitRuntime: string,
    tipoExport: string,
    nomeFile: string,
    meta: any,
    file: Express.Multer.File,
    req: ExpressRequest,
  ): Promise<any> {
    try {
      const dir = path.resolve(process.cwd(), 'server/core/public/uploads/materiali_POP/');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      // Create uploads directory if it doesn't exist

      // Save file with new name
      const newFilePath = path.resolve(dir, nomeFile);
      const fileExtension = path.extname(file.originalname).toLowerCase();

      // Get export type
      const tipoDiExportModel = await this.tipoExportService.getTipoExportById(tipoExport);
      if (!tipoDiExportModel) {
        throw wrapNotFoundError(new Error("Tipo di export non trovato"), {
          message: "Tipo di export non trovato",
          entityType: "TipoExport",
          entityId: tipoExport
        });
      }
      const codiceExport = tipoDiExportModel.codice;

      if (this.isPdfForStandardExport(fileExtension, codiceExport)) {
        return await this.handlePdfUpload(file, nomeFile, meta, guidKitRuntime, tipoExport, tipoDiExportModel, newFilePath, req);
      }
      else if (this.isVolFile(fileExtension, codiceExport)) {
        return await this.handleVOLUpload(file, meta, guidKitRuntime, tipoExport, tipoDiExportModel, req)
      }
      else if (this.isWebpliantFile(fileExtension, codiceExport)) {
        return await this.handleWebpliantUpload(file, nomeFile, guidKitRuntime, newFilePath);
      }
      else if (this.isCorreggoPackFile(fileExtension, codiceExport)) {
        return await this.handleCorreggoPackUpload(file, nomeFile, meta, guidKitRuntime, tipoExport, tipoDiExportModel, req);
      }
      else {
        await fs.promises.unlink(newFilePath);
        throw wrapAppError(new Error("Tipo di file non supportato o tipo di export errato per il tipo di file"), {
          message: `Tipo di file '${fileExtension}' non supportato per il codice export '${codiceExport}'`,
        });
      }

    } catch (error) {
      if (error instanceof ExternalApiError) {
        throw error;
      }
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(error.message, {
        message: "Errore durante l'invio del materiale",
        operation: 'update',
        entity: 'FileItemKit',
        details: { error }
      });
    } finally {
      if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path)
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private isPdfForStandardExport(fileExtension: string, codiceExport: string): boolean {
    return fileExtension === ".pdf" && codiceExport !== "WEB" && codiceExport !== EXPORT_DI_SISTEMA.CORREGGO && codiceExport !== EXPORT_DI_SISTEMA.VOL;
  }

  private isVolFile(fileExtension: string, codiceExport: string): boolean {
    return fileExtension === ".pdf" && codiceExport === EXPORT_DI_SISTEMA.VOL
  }

  private isWebpliantFile(fileExtension: string, codiceExport: string): boolean {
    return (fileExtension === ".json" || fileExtension === ".webpliant") && codiceExport === "WEB";
  }

  private isCorreggoPackFile(fileExtension: string, codiceExport: string): boolean {
    return codiceExport === EXPORT_DI_SISTEMA.CORREGGO;
  }

  private isValidReferenzeIstantaMeta(meta: any): boolean {
    try {
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
      return Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed[0].dataFields !== undefined;
    } catch {
      return false;
    }
  }

  private async extractDataFieldsFromMeta(meta: any): Promise<Record<string, any>> {
    if (!this.isValidReferenzeIstantaMeta(meta)) {
      return {};
    }

    try {
      const referenza: ReferenzeIstanta[] = typeof meta === 'string' ? JSON.parse(meta) : meta;
      const configWebpliant = await this.configService.getConfigWebPliantFromVolantino();
      const cfg = configWebpliant.data_fields_refs;
      const ref = referenza[0];
      const dataFields = TraduttoreReferenze.traduci_data_fields(ref.dataFields, cfg);

      if (Array.isArray(ref.groupElements) && ref.groupElements.length) {
        for (let j = 0; j < ref.groupElements.length; j++) {
          ref.groupElements[j] = TraduttoreReferenze.traduci_data_fields(ref.groupElements[j], cfg);
        }
      }

      return dataFields;
    } catch {
      return {};
    }
  }

  private async savePdfToOlympusAndFP(
    file: Express.Multer.File,
    nomeFile: string,
    dataFields: Record<string, any>,
    guidKitRuntime: string,
    tipoExport: string,
    tipoDiExportModel: TipiDiExportResponseDTO,
    req: ExpressRequest
  ): Promise<{ content: any; esito: boolean; error: string; olympusId: string; pages: number }> {
    const fileBuffer = await fs.promises.readFile(file.path);
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

    const formData = new FormData();
    const blobParts = new Uint8Array(fileBuffer);
    const fileBlob = new Blob([blobParts], { type: 'application/pdf' });
    formData.append("file", fileBlob, nomeFile);
    formData.append("json_meta_materiale", JSON.stringify({
      Id: "",
      FileHash: hash,
      FileName: nomeFile,
      JsonMeta: dataFields
    }));

    const result = await axios.post<{
      esito: boolean,
      error: string,
      content: {
        id: string,
        id_path_materiali: string,
        file_name: string,
        md5: string,
        original_name: string,
        json_meta: any,
        pagine: number
      }
    }>(
      `${config.OLYMPUS_IP_ADDRESS}/materiali/uploadMateriale`,
      formData,
      { headers: { "Authorization": req.headers["authorization"] as string } }
    );

    if (!result.data.esito) {
      throw wrapExternalError(new Error("Errore durante l'invio del materiale a Olympus"), {
        message: "Errore durante l'invio del materiale a Olympus",
        details: { response: result.data },
      });
    }

    // Salva/aggiorna in FP
    let files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(guidKitRuntime);
    if (!files) {
      files = [];
    }

    const fileCercatoPerNome = files.find(f => f.nome === nomeFile);
    // Usa l'id esistente se stiamo aggiornando, altrimenti genera un nuovo UUID
    const fileId = fileCercatoPerNome?.id ?? uuidv4();
    const newFile: FileItemKit = {
      id: fileId,
      id_runtime: guidKitRuntime,
      id_olimpo_cloud: result.data.content.id,
      nome_originale: result.data.content.file_name,
      nome: nomeFile,
      tipo_export: tipoExport,
      direttive: "",
      isOptional: false,
      meta_olimpo_cloud: dataFields,
      tipo_export_codice: tipoDiExportModel.codice,
      pages: result.data.content.pagine
    };

    // Gestione log
    const findIfIsLog = await FilesRuntimeLog.findOne({
      where: {
        id_kit_runtime: guidKitRuntime,
        nome_file: nomeFile
      },
      raw: true
    });
    /*
      FIXME: Lo facciamo per previnire la doppia creazione del log per correggo
      questa è un correzione temporanea e va risolta correttamente la disposizione
      di queste funzioni che sono confusionarie.
    */
    if (tipoDiExportModel.codice != EXPORT_DI_SISTEMA.CORREGGO) {
      if (findIfIsLog != undefined && findIfIsLog != null) {
        const updatedLogs = [
          // Normalizza data_notifica: dal DB arriva come stringa ISO (JSONB), il validator richiede Date
          ...(findIfIsLog.logs || []).map((l) => ({
            ...l,
            data_notifica: l.data_notifica ? new Date(l.data_notifica) : undefined
          })),
          {
            messaggio: `File "${nomeFile}" caricato correttamente per l'export "${tipoDiExportModel.codice}".`,
            data_notifica: new Date(),
            azione: "Upload" as const,
          }
        ];
        await FilesRuntimeLog.update(
          {
            versione: (findIfIsLog.versione ?? 0) + 1,
            logs: updatedLogs
          },
          { where: { id: findIfIsLog.id } }
        );
      } else {
        const nowStr = dayjs().format('DD/MM/YYYY HH:mm:ss');
        const logFileRuntime: FilesRuntimeLogAttributes = {
          id: uuidv4(),
          id_kit_runtime: guidKitRuntime,
          nome_file: nomeFile,
          data_registrazione: new Date(),
          versione: 1,
          stato: STATO_LOG_FILE.IN_ATTESA,
          logs: [
            {
              messaggio: `File "${nomeFile}" caricato correttamente per l'export "${tipoDiExportModel.codice}". Data: ${nowStr}`,
              data_notifica: new Date(),
              azione: "Upload",
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await FilesRuntimeLog.create({ ...logFileRuntime });
      }
    }

    // Insert o update del file
    let saveResult;
    if (!fileCercatoPerNome) {
      saveResult = await this.kitRuntimeService.insertNewFileRuntime(newFile);
    } else {
      saveResult = await this.kitRuntimeService.updateSingleFileRuntime(newFile);
    }

    return {
      content: saveResult,
      esito: true,
      error: "",
      olympusId: result.data.content.id,
      pages: result.data.content.pagine
    };
  }

  private async handlePdfUpload(
    file: Express.Multer.File,
    nomeFile: string,
    meta: any,
    guidKitRuntime: string,
    tipoExport: string,
    tipoDiExportModel: TipiDiExportResponseDTO,
    newFilePath: string,
    req: ExpressRequest
  ): Promise<any> {
    if (!this.isValidReferenzeIstantaMeta(meta)) {
      throw wrapAppError(new Error("Meta non valido per export standard"), {
        message: "Il meta deve essere un array di ReferenzeIstanta per questo tipo di export",
      });
    }

    const dataFields = await this.extractDataFieldsFromMeta(meta);
    return await this.savePdfToOlympusAndFP(
      file,
      nomeFile,
      dataFields,
      guidKitRuntime,
      tipoExport,
      tipoDiExportModel,
      req
    );
  }

  private async handleWebpliantUpload(
    file: Express.Multer.File,
    nomeFile: string,
    guidKitRuntime: string,
    newFilePath: string
  ): Promise<any> {
    const fileBuffer = await fs.promises.readFile(file.path);
    const fileString = fileBuffer.toString();
    const fileJson: ReferenzeIstanta[] = JSON.parse(fileString);

    const kit = await this.kitRuntimeService.getKitRuntimeById(guidKitRuntime);
    if (!kit) {
      throw wrapNotFoundError(new Error("Kit non trovato"), {
        message: "Kit non trovato",
        entityType: "KitRuntime",
        entityId: guidKitRuntime,
      });
    }

    await Promise.all(fileJson.map(async (referenza) => {
      referenza.id = uuidv4();
      referenza.guidIdKitRuntime = guidKitRuntime;
    }));

    await this.bulkEliminateReferenze(guidKitRuntime);
    const result = await this.bulkCreateReferenze(fileJson);
    await fs.promises.unlink(file.path);

    return result;
  }

  private async handleCorreggoPackUpload(
    file: Express.Multer.File,
    nomeFile: string,
    meta: any,
    guidKitRuntime: string,
    tipoExport: string,
    tipoDiExportModel: TipiDiExportResponseDTO,
    req: ExpressRequest
  ): Promise<any> {
    try {
      // STEP 1: Salvataggio su Olympus e FP
      const dataFields = await this.extractDataFieldsFromMeta(meta);

      const olympusResult = await this.savePdfToOlympusAndFP(
        file,
        nomeFile,
        dataFields,
        guidKitRuntime,
        tipoExport,
        tipoDiExportModel,
        req
      );

      // STEP 2: Creazione e invio .pack a Correggo
      const pdfBuffer = await fs.promises.readFile(file.path);

      const headerJson = typeof meta === 'string' ? meta : JSON.stringify(meta);
      const headerBuffer = Buffer.from(headerJson, 'utf-8');

      const headerLength = headerBuffer.length;
      const pdfLength = pdfBuffer.length;

      const totalSize = 4 + headerLength + 4 + pdfLength;
      const packBuffer = Buffer.alloc(totalSize);
      let offset = 0;
      packBuffer.writeUInt32BE(headerLength, offset);
      offset += 4;
      headerBuffer.copy(packBuffer, offset);
      offset += headerLength;
      packBuffer.writeUInt32BE(pdfLength, offset);
      offset += 4;
      pdfBuffer.copy(packBuffer, offset);

      const packFileName = `${path.basename(file.originalname, path.extname(file.originalname))}.pack`;

      const correggoFormData = new FormData();
      correggoFormData.append('file', new Blob([packBuffer]), packFileName);

      const endpoint = `${config.CORREGGO_IP_ADDRESS}/UploadVolFromFP.ashx`;
      const resultCorreggo = await ServerUtils.sendToFICOApi<{ result: string; errorDetails: string }>(
        req,
        endpoint,
        'POST',
        correggoFormData,
        { Authorization: req.headers.authorization as string }
      );

      if (resultCorreggo.data.result !== 'ok') {
        throw wrapExternalError(new Error("Errore invio file a Correggo"), {
          message: 'Errore invio file a Correggo',
          httpStatus: resultCorreggo.status,
          details: { error: resultCorreggo.data.errorDetails }
        });
      }

      await fs.promises.unlink(file.path);

      await ServerUtils.CREA_ATTIVITA(
        null,
        TIPO_ATTIVITA.INVIO_FILE_CORREGGO,
        CATEGORIA_ATTIVITA.PUBBLICAZIONE,
        {
          nome_file: packFileName,
          id_kit_runtime: guidKitRuntime,
          tipo_export: tipoExport,
          codice_tipo_export: tipoDiExportModel.codice,
          id_olimpo_cloud: olympusResult.olympusId,
          meta: meta
        }
      );

      // Aggiorna il log per indicare l'invio a Correggo
      const existingLogs = await FilesRuntimeLog.findAll({
        where: { id_kit_runtime: guidKitRuntime, nome_file: nomeFile },
        raw: true
      }) as FilesRuntimeLogAttributes[];
      let maxVersion = 0;
      if (existingLogs && existingLogs.length > 0) {
        maxVersion = Math.max(...existingLogs.map(log => log.versione ?? 0));
      }
      const existingLog = existingLogs?.find(log => (log.versione ?? 0) === maxVersion);

      if (existingLog) {
        const updatedLogs = [
          // Normalizza data_notifica: dal DB arriva come stringa ISO (JSONB), il validator richiede Date
          ...(existingLog.logs || []).map((l: any) => ({
            ...l,
            data_notifica: l.data_notifica ? new Date(l.data_notifica) : undefined
          })),
          {
            messaggio: 'File inviato a Correggo',
            data_notifica: new Date(),
            azione: 'Upload' as const,
            utente_notifica: 'system',
            dettagli_aggiuntivi: {
              nome_file: packFileName,
              id_olimpo_cloud: olympusResult.olympusId,
              tipo_export: tipoExport,
              tipo_export_codice: tipoDiExportModel.codice
            }
          }
        ];
        await FilesRuntimeLog.update(
          {
            logs: updatedLogs,
            stato: STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO,
            versione: (existingLog.versione ?? 0) + 1,
          },
          { where: { id: existingLog.id }, validate: false }
        );
      }

      return {
        esito: true,
        error: '',
        content: {
          nome_file: packFileName,
          olympus_id: olympusResult.olympusId,
          pages: olympusResult.pages
        }
      };

    } catch (error) {
      throw wrapAppError(new Error("Errore gestione upload Correggo"), {
        message: 'Errore gestione upload Correggo',
        details: { error },
      });
    }
  }

  private async handleVOLUpload(
    file: Express.Multer.File,
    meta: any,
    guidKitRuntime: string,
    tipoExport: string,
    tipoDiExportModel: any,
    req: ExpressRequest
  ) {
    try {
      if (guidKitRuntime == null || guidKitRuntime == undefined || guidKitRuntime == "") {
        throw new BadRequestError({
          message: "il guid del kit nella chiamata è vuoto",
          details: { field: 'guidKitRuntime' },
        });
      }
      const runtimekit = await this.kitRuntimeService.getKitRuntimeById(guidKitRuntime);
      const runtimekitPg = runtimekit as any; // campi PG snake_case (id_promo, tipi_di_export_in_kit, ...)
      const runtimekitPerWebhook = await this.kitRuntimeService.getKitRuntimeByIdPerWebhook(guidKitRuntime);
      let referenze: ReferenzeIstanta[] = [];
      try {
        referenze = JSON.parse(meta);
      } catch (error: any) {
        throw error;
      }
      const nomeFile = file.filename;
      const fileBuffer = await fs.promises.readFile(file.path);
      const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

      const formData = new FormData();
      const blobParts = new Uint8Array(fileBuffer);
      const fileBlob = new Blob([blobParts], { type: 'application/pdf' });
      formData.append("file", fileBlob, nomeFile);
      formData.append("json_meta_materiale", JSON.stringify({
        Id: "",
        FileHash: hash,
        FileName: nomeFile,
        JsonMeta: {}
      }));

      const result = await axios.post<{
        esito: boolean,
        error: string,
        content: {
          id: string,
          id_path_materiali: string,
          file_name: string,
          md5: string,
          original_name: string,
          json_meta: any,
          pagine: number
        }
      }>(
        `${config.OLYMPUS_IP_ADDRESS}/materiali/uploadMateriale`,
        formData,
        { headers: { "Authorization": req.headers["authorization"] as string } }
      );

      if (!result.data.esito) {
        throw wrapExternalError(new Error("Errore durante l'invio del materiale"), {
          message: "Errore durante l'invio del materiale",
          details: { response: result.data },
        });
      }

      let files = await this.kitRuntimeService.getFilesRuntimeByIdKitRuntime(guidKitRuntime);
      if (!files) {
        files = [];
      }

      const fileCercatoPerNome = files.find(f => f.nome === nomeFile);
      // Usa l'id esistente se stiamo aggiornando, altrimenti genera un nuovo UUID
      const fileId = fileCercatoPerNome?.id ?? uuidv4();
      let newFile: FileItemKit = {
        id: fileId,
        id_runtime: guidKitRuntime,
        id_olimpo_cloud: result.data.content.id,
        nome_originale: result.data.content.file_name,
        nome: nomeFile,
        tipo_export: tipoExport,
        direttive: "",
        isOptional: false,
        meta_olimpo_cloud: {},
        tipo_export_codice: tipoDiExportModel.codice,
        pages: result.data.content.pagine
      };

      const findIfIsLog = await FilesRuntimeLog.findOne({
        where: {
          id_kit_runtime: guidKitRuntime,
          nome_file: nomeFile
        },
        raw: true
      });

      if (findIfIsLog != null) {
        const updatedLogs = [
          // Normalizza data_notifica: dal DB arriva come stringa ISO (JSONB), il validator richiede Date
          ...(findIfIsLog?.logs || []).map((l) => ({
            ...l,
            data_notifica: l.data_notifica ? new Date(l.data_notifica) : undefined
          })),
          {
            messaggio: `File "${nomeFile}" caricato correttamente per l'export "${tipoDiExportModel.codice}".`,
            data_notifica: new Date(),
            azione: "Upload" as const,
          }
        ];
        await FilesRuntimeLog.update(
          {
            versione: (findIfIsLog?.versione ?? 0) + 1,
            logs: updatedLogs
          },
          { where: { id: findIfIsLog?.id }, validate: false }
        );
      } else {
        const nowStr = dayjs().format('DD/MM/YYYY HH:mm:ss');

        const logFileRuntime: FileItemKitLog = {
          id: uuidv4(),
          guid_kit_runtime: guidKitRuntime,
          nome_file: nomeFile,
          data_registrazione: new Date(),
          versione: 1,
          stato: STATO_LOG_FILE.IN_ATTESA,
          logs: [
            {
              messaggio: `File "${nomeFile}" caricato correttamente per l'export "${tipoDiExportModel.codice}". Data: ${nowStr}`,
              data_notifica: new Date(),
              azione: "Upload",
            }
          ]
        }
        await FilesRuntimeLog.create({ ...logFileRuntime, id_kit_runtime: logFileRuntime.guid_kit_runtime } as any);
      }
      //INIZIO
      let configWebpliant = await this.configService.getConfigWebPliantFromVolantino();
      const cfg = configWebpliant.data_fields_refs
      for (let i = 0; i < referenze.length; i++) {
        const ref = referenze[i];
        const dataFields = TraduttoreReferenze.traduci_data_fields(ref.dataFields, cfg);
        const compiledFields = TraduttoreReferenze.traduci_compiled_fields(ref.compiledFields, cfg);
        const deletedFields = TraduttoreReferenze.traduci_deleted_fields(ref.deletedFields, cfg);

        if (Array.isArray(ref.groupElements) && ref.groupElements.length) {
          for (let j = 0; j < ref.groupElements.length; j++) {
            ref.groupElements[j] = TraduttoreReferenze.traduci_data_fields(ref.groupElements[j], cfg);
          }
        }

        Object.assign(ref, {
          dataFields,
          compiledFields,
          deletedFields,
          guidIdKitRuntime: guidKitRuntime,
          createdAt: new Date(),
          updatedAt: new Date(),
          idPromo: runtimekitPg.idPromo,
          /* hack:
            qui lo facciamo perché il dato che arriva nel meta delle referenza
            ha una diciatura diversa dal modello sequelize, quindi facendo cosi
            creiamo una struttura ridondante ma per il momento funziona.
          */
          id: uuidv4(),
          // snake_case fields required by the Sequelize Referenze model
          data_fields: dataFields,
          compiled_fields: compiledFields,
          deleted_fields: deletedFields,
          id_runtime_kit: guidKitRuntime,
          id_promo: runtimekitPg.idPromo,
          codice_box: ref.codiceBox ?? '',
          foto_extra: ref.fotoExtra ?? [],
          group_elements: ref.groupElements ?? [],
          w_page: (ref as any).wPage,
          h_page: (ref as any).hPage,
          perc_ingombro: (ref as any).percIngombro,
          aspect_ratio: (ref as any).aspectRatio,
        });
      }
      if (runtimekitPg.tipiDiExportInKit && runtimekitPg.tipiDiExportInKit.some((tipo: any) =>
        tipo.useWebhook && (tipo.webhookEvents === EVENTI_WEBHOOK.KIT_MATERIALE_ARRIVATO || tipo.webhookEvents === 'all'))) {
        try {
          await this.webhookService.scatenaEvento({
            evento: EVENTI_WEBHOOK.KIT_MATERIALE_ARRIVATO,
            dati: {
              referenze: referenze,
              kit: runtimekitPerWebhook
            },
            meta: {
              user_id: req.session.id_utente as string,
              source: 'webpliant',
              request_id: uuidv4()
            }
          });
        } catch (webhookError) {
          console.error("Errore durante l'invio del webhook:", webhookError);
        }
      }
      await this.bulkEliminateReferenze(guidKitRuntime);
      await this.bulkCreateReferenze(referenze);
      //FINE
      await fs.promises.unlink(file.path);
      if (!fileCercatoPerNome) {
        const result = await this.kitRuntimeService.insertNewFileRuntime(newFile);
        return { content: result, esito: true, error: "" };
      } else {
        const resultUpdate = await this.kitRuntimeService.updateSingleFileRuntime(newFile);
        return { content: resultUpdate, esito: true, error: "" };
      }
    } catch (error: any) {
      throw wrapAppError(error.message, {
        message: error.message,
        details: { error },
      });
    }
  }

  // ── PostgreSQL direct access helpers ────────────────────────────────

  private async getPromoInfo(id: string): Promise<{ nome: string; validita_dal: any; validita_al: any; stato: string }> {
    const promo = await this.promoRepository.findById(id);
    if (!promo) {
      throw wrapNotFoundError(new Error("Promozione non trovata"), {
        message: "Promozione non trovata",
        entityType: "Promo",
        entityId: id
      });
    }
    const promoValues = normalizePromoModel(promo);
    return {
      nome: promoValues.nome_promo,
      validita_dal: promoValues.validita_dal,
      validita_al: promoValues.validita_al,
      stato: promoValues.stato,
    };
  }

  private async getReferenzaById(id: string): Promise<ReferenzeIstanta> {
    try {
      const result = await Referenze.findOne({ where: { id }, raw: true });
      return result as unknown as ReferenzeIstanta;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero della referenza"), {
        message: "Errore durante il recupero della referenza",
        operation: 'findOne',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  private async updateReferenza(id: string, data: ReferenzeIstanta): Promise<any> {
    try {
      const result = await Referenze.update(data as any, { where: { id } });
      return result;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
        message: "Errore durante l'aggiornamento della referenza",
        operation: 'updateOne',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  private async bulkCreateReferenze(refs: ReferenzeIstanta[]): Promise<any> {
    try {
      const pgRefs = refs.map(referenzaToSnakeCase);
      const result = await Referenze.bulkCreate(pgRefs);
      return result;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione bulk delle referenze"), {
        message: "Errore durante la creazione bulk delle referenze",
        operation: 'insertMany',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  private async bulkEliminateReferenze(guidKitRuntime: string): Promise<any> {
    try {
      const result = await Referenze.destroy({ where: { id_runtime_kit: guidKitRuntime } });
      return result;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione delle referenze"), {
        message: "Errore durante l'eliminazione delle referenze",
        operation: 'deleteMany',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }
}
