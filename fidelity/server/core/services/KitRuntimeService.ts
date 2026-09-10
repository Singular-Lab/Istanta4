import { Request } from 'express';
import 'express-session';
import { Op, Transaction } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Colorize } from '../../../lib/Colorize';
import { EVENTI_WEBHOOK, EXPORT_DI_SISTEMA, STATO_COMBINAZIONI, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, TIPO_KIT_DESIGN, TIPO_LAVORAZIONE } from '../../../lib/enums';
import { BusinessError, DatabaseError, ForbiddenError, NotFoundError, ServiceUnavailableError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import { DESIGN_KIT_MONGO, FileItemKit, FileItemKitLog, OggettoTipiDiExport, PaylodKitPubblicato, RUNTIME_KIT_MONGO, TipiDiExportAttributes } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db';
import { IIstantaService } from '../interfaces/IIstantaService';
import { IKitRuntimeService } from '../interfaces/IKitRuntimeService';
import { IWebhookService } from '../interfaces/IWebhookService';
import { log } from '../logger';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import { DesignKit } from '../models/design_kit';
import { FilesRuntime } from '../models/files_runtime';
import { FilesRuntimeLog } from '../models/files_runtime_log';
import { Formati } from '../models/formati';
import { Promo, PromoAttributes } from '../models/promo';
import { RaccoglitoreKit } from '../models/raccoglitore_kit';
import { Referenze } from '../models/referenze';
import { RuntimeKit } from '../models/runtime_kit';
import { TipiDiExport } from '../models/tipi_di_export';
import { Utente } from '../models/utenti';

/** Maps a raw PG RuntimeKit (snake_case) to the camelCase shape expected by the client */
function normalizeRuntimeKitFromPg(raw: any): RUNTIME_KIT_MONGO {
  const rawTipi: any[] = raw.tipiDiExportInKit ?? raw.tipi_di_export_in_kit ?? [];
  return {
    ...raw,
    guidId: raw.guidId ?? raw.id,
    guidArea: raw.guidArea ?? raw.id_area,
    guidCanale: raw.guidCanale ?? raw.id_canale,
    guidFormato: raw.guidFormato ?? raw.id_formato,
    guidIdDesign: raw.guidIdDesign ?? raw.id_design,
    guidIdRaccoglitore: raw.guidIdRaccoglitore ?? raw.id_raccoglitore,
    idPromo: raw.idPromo ?? raw.id_promo,
    tipiDiExportInKit: rawTipi.map((t: any) => ({
      ...t,
      tipoDiExportGuidID: t.tipoDiExportGuidID ?? t.tipo_di_export_guid_id,
      useWebhook: t.useWebhook ?? t.use_webhook,
      webhookEvents: t.webhookEvents ?? t.webhook_events,
    })),
    quantitaCopie: raw.quantitaCopie ?? raw.quantita_copie,
    filtroContesto: raw.filtroContesto ?? raw.filtro_contesto ?? [],
    nomeArea: raw.nomeArea ?? raw.nome_area,
    nomeCanale: raw.nomeCanale ?? raw.nome_canale,
    codiceArea: raw.codiceArea ?? raw.codice_area,
    codiceCanale: raw.codiceCanale ?? raw.codice_canale,
    inizioLavorazione: raw.inizioLavorazione ?? raw.inizio_lavorazione,
    fineLavorazione: raw.fineLavorazione ?? raw.fine_lavorazione,
    files: raw.files ?? raw.files_data ?? [],
  } as RUNTIME_KIT_MONGO;
}

/** Maps a raw PG DesignKit (snake_case) to camelCase shape expected by the client */
function normalizeDesignKitFromPg(raw: any): any {
  const rawTipi: any[] = raw.tipiDiExportInKit ?? raw.tipi_di_export_in_kit ?? [];
  return {
    ...raw,
    guidId: raw.guidId ?? raw.id,
    guidArea: raw.guidArea ?? raw.id_area,
    guidCanale: raw.guidCanale ?? raw.id_canale,
    guidFormato: raw.guidFormato ?? raw.id_formato,
    guidIdRaccoglitore: raw.guidIdRaccoglitore ?? raw.id_raccoglitore,
    tipiDiExportInKit: rawTipi.map((t: any) => ({
      ...t,
      tipoDiExportGuidID: t.tipoDiExportGuidID ?? t.tipo_di_export_guid_id,
      useWebhook: t.useWebhook ?? t.use_webhook,
      webhookEvents: t.webhookEvents ?? t.webhook_events,
    })),
    quantitaCopie: raw.quantitaCopie ?? raw.quantita_copie,
    filtroContesto: raw.filtroContesto ?? raw.filtro_contesto ?? [],
  };
}

/** Converts FileItemKit[] (from raccoglitore_kit.files) to files_data format for runtime_kit */
function mapRaccoglitoreFilesToFilesData(files: any[], newRuntimeId?: string): any[] {
  if (!files || !Array.isArray(files) || files.length === 0) return [];
  return files.map((f: any) => ({
    id: f.id,
    nome: f.nome,
    direttive: f.direttive || '',
    is_optional: f.isOptional ?? f.is_optional ?? false,
    isOptional: f.isOptional ?? f.is_optional ?? false,
    nome_originale: f.nome_originale || f.nomeOriginale || '',
    tipo_export: f.tipo_export || f.tipoExport || '',
    tipo_export_codice: f.tipo_export_codice || f.tipoExportCodice || '',
    id_runtime: newRuntimeId || f.id_runtime || f.idRuntime || '',
  }));
}

export class KitRuntimeService implements IKitRuntimeService {
  constructor(
    private readonly istantaService: IIstantaService,
    private readonly webhookService: IWebhookService
  ) { }

  /** ──────────────── Retrieval ──────────────── */

  async getAllKitPerGestioneLavorazione(idPromo: string, req: Request): Promise<{
    lavorazioni: any[];
    volantini: Array<{
      guidId: string;
      titolo: string;
      nomeArea?: string;
      nomeCanale?: string;
      stato_lavorazione: string;
      files: any[];
    }>;
  }> {
    try {
      const resultCombinazioniDaIstanta = await this.istantaService.getCombinazioniDaIstanta(idPromo, req);
      const listaCombinazioniDaIstanta = resultCombinazioniDaIstanta.lista;

      // Estrai e deduplica per ridurre cardinalita query.
      const areaIds = Array.from(
        new Set(listaCombinazioniDaIstanta.map(item => item.guidIdArea).flat().filter(Boolean))
      ) as string[];
      const canaleIds = Array.from(
        new Set(listaCombinazioniDaIstanta.map(item => item.guidIdCanale).flat().filter(Boolean))
      ) as string[];

      const [_rawDesignKits, _rawKitRuntime] = await Promise.all([
        DesignKit.findAll({
          where: {
            id_area: { [Op.in]: areaIds },
            id_canale: { [Op.in]: canaleIds }
          },
          raw: true
        }) as unknown as Promise<any[]>,
        RuntimeKit.findAll({
          where: {
            id_promo: idPromo,
            id_area: { [Op.in]: areaIds },
            id_canale: { [Op.in]: canaleIds },
            stato_lavorazione: { [Op.notIn]: [STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO] }
          },
          raw: true
        }) as unknown as Promise<any[]>
      ]);
      const resultCreazioneCombinazioneDesign = _rawDesignKits.map(normalizeDesignKitFromPg) as (DESIGN_KIT_MONGO & { nomeCanale: string, nomeArea: string, lavorazioneStarted: boolean })[];
      const getKitRuntime = _rawKitRuntime.map(normalizeRuntimeKitFromPg);

      const runtimeByDesignId = new Map<string, RUNTIME_KIT_MONGO>();
      const formatoIds = new Set<string>();
      const tipiExportIds = new Set<string>();
      const runtimeIds: string[] = [];
      const promoIds = new Set<string>();

      for (const design of resultCreazioneCombinazioneDesign) {
        if (design.guidFormato) {
          formatoIds.add(design.guidFormato);
        }
        for (const tipoExport of design.tipiDiExportInKit || []) {
          if (tipoExport.tipoDiExportGuidID) {
            tipiExportIds.add(tipoExport.tipoDiExportGuidID);
          }
        }
      }

      for (const runtime of getKitRuntime) {
        if (runtime.guidIdDesign) {
          runtimeByDesignId.set(runtime.guidIdDesign, runtime);
        }
        if (runtime.guidFormato) {
          formatoIds.add(runtime.guidFormato);
        }
        if (runtime.guidId) {
          runtimeIds.push(runtime.guidId);
        }
        if (runtime.idPromo) {
          promoIds.add(runtime.idPromo);
        }
        for (const tipoExport of runtime.tipiDiExportInKit || []) {
          if (tipoExport.tipoDiExportGuidID) {
            tipiExportIds.add(tipoExport.tipoDiExportGuidID);
          }
        }
      }

      const [getTipiExportRaw, canaliRaw, areeRaw, formatiRaw, promoRaw] = await Promise.all([
        tipiExportIds.size
          ? TipiDiExport.findAll({
            where: { id_tipiexport: { [Op.in]: Array.from(tipiExportIds) } },
            raw: true
          })
          : Promise.resolve([]),
        canaleIds.length
          ? Canale.findAll({
            where: { id_canali: { [Op.in]: canaleIds } },
            raw: true
          })
          : Promise.resolve([]),
        areaIds.length
          ? Area.findAll({
            where: { id_aree: { [Op.in]: areaIds } },
            raw: true
          })
          : Promise.resolve([]),
        formatoIds.size
          ? Formati.findAll({
            where: { id_formati: { [Op.in]: Array.from(formatoIds) } },
            raw: true
          })
          : Promise.resolve([]),
        promoIds.size
          ? Promo.findAll({
            where: { id_promo: { [Op.in]: Array.from(promoIds) } },
            raw: true
          })
          : Promise.resolve([])
      ]);

      const getTipiExport = getTipiExportRaw as unknown as TipiDiExportAttributes[];
      const canali = canaliRaw as unknown as Array<{ id_canali?: string; nome_canali: string }>;
      const aree = areeRaw as unknown as Array<{ id_aree?: string; nome_aree: string }>;
      const formati = formatiRaw as unknown as Array<{ id_formati?: string; tipo_lavorazione_formati: number }>;
      const promoList = promoRaw as unknown as Array<{ id_promo: string; validita_al?: Date; validita_dal?: Date }>;

      const canaleById = new Map<string, string>();
      for (const canale of canali) {
        if (canale.id_canali) {
          canaleById.set(canale.id_canali, canale.nome_canali);
        }
      }

      const areaById = new Map<string, string>();
      for (const area of aree) {
        if (area.id_aree) {
          areaById.set(area.id_aree, area.nome_aree);
        }
      }

      const formatoTipoById = new Map<string, number>();
      for (const formato of formati) {
        if (formato.id_formati) {
          formatoTipoById.set(formato.id_formati, formato.tipo_lavorazione_formati);
        }
      }

      const promoById = new Map<string, { validita_al?: Date; validita_dal?: Date }>();
      for (const promo of promoList) {
        if (promo.id_promo) {
          promoById.set(promo.id_promo, {
            validita_al: promo.validita_al,
            validita_dal: promo.validita_dal
          });
        }
      }

      const tipiExportById = new Map<string, TipiDiExportAttributes>();
      for (const tipoExport of getTipiExport) {
        if (tipoExport.id_tipiexport) {
          tipiExportById.set(tipoExport.id_tipiexport, tipoExport);
        }
      }

      const runtimeVolantinoExportId = new Map<string, string>();
      const allVolantinoExportIds = new Set<string>();

      for (const runtime of getKitRuntime) {
        const volantinoExport = runtime.tipiDiExportInKit.find((tipoExport) => {
          const tipoExportData = tipiExportById.get(tipoExport.tipoDiExportGuidID);
          return tipoExportData?.codice_tipiexport === EXPORT_DI_SISTEMA.VOL;
        });
        if (runtime.guidId && volantinoExport?.tipoDiExportGuidID) {
          runtimeVolantinoExportId.set(runtime.guidId, volantinoExport.tipoDiExportGuidID);
          allVolantinoExportIds.add(volantinoExport.tipoDiExportGuidID);
        }
      }

      // Fetch files count per runtime kit
      const filesCountByRuntime = new Map<string, number>();
      const referenzeCountByRuntime = new Map<string, number>();
      const volantinoFilesByRuntime = new Map<string, any[]>();

      if (runtimeIds.length) {
        const allFilesCount = await FilesRuntime.findAll({
          where: { id_runtime: { [Op.in]: runtimeIds } },
          attributes: ['id_runtime'],
          raw: true
        }) as unknown as Array<{ id_runtime: string }>;
        for (const f of allFilesCount) {
          if (f.id_runtime) {
            filesCountByRuntime.set(f.id_runtime, (filesCountByRuntime.get(f.id_runtime) || 0) + 1);
          }
        }

        const allReferenzeCount = await Referenze.findAll({
          where: { id_runtime_kit: { [Op.in]: runtimeIds } },
          attributes: ['id_runtime_kit'],
          raw: true
        }) as unknown as Array<{ id_runtime_kit: string }>;
        for (const r of allReferenzeCount) {
          if (r.id_runtime_kit) {
            referenzeCountByRuntime.set(r.id_runtime_kit, (referenzeCountByRuntime.get(r.id_runtime_kit) || 0) + 1);
          }
        }

        if (allVolantinoExportIds.size) {
          const volantinoFilesRaw = await FilesRuntime.findAll({
            where: {
              id_runtime: { [Op.in]: runtimeIds },
              tipo_export: { [Op.in]: Array.from(allVolantinoExportIds) }
            },
            raw: true
          }) as unknown as any[];

          for (const file of volantinoFilesRaw) {
            if (!file?.id_runtime) continue;

            const expectedVolantinoExport = runtimeVolantinoExportId.get(file.id_runtime);
            if (!expectedVolantinoExport || file.tipo_export !== expectedVolantinoExport) {
              continue;
            }

            const fileWithUrls = {
              ...file,
              url: file.id_olimpo_cloud
                ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`
                : file.url,
              url_download: file.id_olimpo_cloud
                ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`
                : file.url
            };

            const current = volantinoFilesByRuntime.get(file.id_runtime) || [];
            current.push(fileWithUrls);
            volantinoFilesByRuntime.set(file.id_runtime, current);
          }
        }
      }

      const arrayMistoPerFrontEnd = resultCreazioneCombinazioneDesign.map((item) => {
        const kitRuntime = runtimeByDesignId.get(item.guidId);
        const tipoLavorazione = formatoTipoById.get(kitRuntime?.guidFormato || item.guidFormato);

        if (kitRuntime) {
          const tipiDiExportInKit = kitRuntime.tipiDiExportInKit
            .map((tipoExport) => tipiExportById.get(tipoExport.tipoDiExportGuidID))
            .filter((tipoExport): tipoExport is TipiDiExportAttributes => Boolean(tipoExport));
          const promo = promoById.get(kitRuntime.idPromo);

          return {
            ...kitRuntime,
            lavorazioneStarted: true,
            nomeCanale: canaleById.get(item.guidCanale) || "",
            nomeArea: areaById.get(item.guidArea) || "",
            isDesignKit: false,
            numero_files: filesCountByRuntime.get(kitRuntime.guidId) || 0,
            files: volantinoFilesByRuntime.get(kitRuntime.guidId) || [],
            numero_referenze: referenzeCountByRuntime.get(kitRuntime.guidId) || 0,
            tipiExport: tipiDiExportInKit,
            tipiDiExportInKit: kitRuntime.tipiDiExportInKit.map((tipoExport) => ({
              ...tipoExport,
              codice: tipiExportById.get(tipoExport.tipoDiExportGuidID)?.codice_tipiexport || ""
            })),
            updatedAt: kitRuntime.updatedAt,
            tipo_lavorazione: tipoLavorazione,
            validita_al: promo?.validita_al,
            validita_dal: promo?.validita_dal
          };
        }

        return {
          ...item,
          lavorazioneStarted: false,
          nomeCanale: canaleById.get(item.guidCanale) || "",
          nomeArea: areaById.get(item.guidArea) || "",
          isDesignKit: true,
          numero_files: 0,
          numero_referenze: 0,
          tipiDiExportInKit: (item.tipiDiExportInKit || []).map((tipoExport) => ({
            ...tipoExport,
            codice: tipiExportById.get(tipoExport.tipoDiExportGuidID)?.codice_tipiexport || ""
          })),
          tipo_lavorazione: tipoLavorazione,
        };
      });

      arrayMistoPerFrontEnd.sort((a, b) => {
        if (!a || !b) return 0;
        if (a.lavorazioneStarted === b.lavorazioneStarted) {
          // Se lo stato è lo stesso, ordina alfabeticamente per titolo
          return (a.titolo || '').localeCompare(b.titolo || '');
        }
        // Altrimenti, metti quelli con lavorazioneStarted: true prima
        return a.lavorazioneStarted ? -1 : 1;
      });

      // Filtra volantini: tipo_lavorazione = 1 (VOLANTINO) con files
      const volantini = arrayMistoPerFrontEnd
        .filter((kit: any) =>
          kit.tipo_lavorazione === TIPO_LAVORAZIONE.VOLANTINO &&
          kit.files &&
          kit.files.length > 0
        )
        .map((kit: any) => ({
          guidId: kit.guidId,
          titolo: kit.titolo,
          nomeArea: kit.nomeArea,
          nomeCanale: kit.nomeCanale,
          stato_lavorazione: kit.stato_lavorazione,
          files: kit.files,
        }));

      return {
        lavorazioni: arrayMistoPerFrontEnd,
        volantini: volantini
      };
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni design per la gestione della lavorazione"), {
        message: "Errore durante il recupero delle combinazioni design per la gestione della lavorazione",
        operation: 'find',
        entity: 'RuntimeKit',
        details: { message: error.message, error }
      });
    }
  }

  async getKitPerGestioneLavorazione(idPromo: string, idKit: string, req: Request): Promise<any> {
    try {
      // Prima cerchiamo se l'id corrisponde a un kit runtime
      const _rawKitRuntime1 = await RuntimeKit.findOne({
        where: {
          id: idKit,
          id_promo: idPromo,
          stato_lavorazione: { [Op.notIn]: [STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO] }
        },
        raw: true
      });
      let kitRuntime = _rawKitRuntime1 ? normalizeRuntimeKitFromPg(_rawKitRuntime1) : null as unknown as RUNTIME_KIT_MONGO;

      let kitDesign: DESIGN_KIT_MONGO | null = null;

      if (kitRuntime) {
        // Se troviamo un kit runtime, cerchiamo il design kit corrispondente
        const rawDesign1 = await DesignKit.findOne({ where: { id: kitRuntime.guidIdDesign }, raw: true });
        kitDesign = rawDesign1 ? normalizeDesignKitFromPg(rawDesign1) : null;
      } else {
        // Altrimenti, cerchiamo un kit design con l'id fornito
        const rawDesign2 = await DesignKit.findOne({ where: { id: idKit }, raw: true });
        kitDesign = rawDesign2 ? normalizeDesignKitFromPg(rawDesign2) : null;
        if (kitDesign) {
          // E poi verifichiamo se esiste un kit runtime associato a quel design kit
          const _rawKitRuntime2 = await RuntimeKit.findOne({
            where: {
              id_design: kitDesign.guidId,
              stato_lavorazione: { [Op.notIn]: [STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO] },
              id_promo: idPromo
            },
            raw: true
          });
          kitRuntime = _rawKitRuntime2 ? normalizeRuntimeKitFromPg(_rawKitRuntime2) : null as unknown as RUNTIME_KIT_MONGO;
        }
      }

      if (!kitDesign) {
        throw wrapDatabaseError(new Error(`Kit con id ${idKit} non trovato.`), {
          message: `Kit con id ${idKit} non trovato.`,
          operation: 'findOne',
          entity: 'DesignKit/RuntimeKit',
          details: { idKit }
        });
      }

      const canale = await Canale.findByPk(kitDesign.guidCanale);
      const area = await Area.findByPk(kitDesign.guidArea);
      const getTipiExport = await TipiDiExport.findAll() as unknown as TipiDiExportAttributes[];

      if (kitRuntime) {
        const tipiDiExportInKit = await TipiDiExport.findAll({
          where: {
            id_tipiexport: {
              [Op.in]: kitRuntime.tipiDiExportInKit.map((tipo) => tipo.tipoDiExportGuidID)
            }
          }
        }) as unknown as TipiDiExportAttributes[];
        const numeroReferenzeTrovate = await Referenze.count({
          where: { id_runtime_kit: kitRuntime.guidId }
        });
        const promo = await Promo.findOne({ where: { id_promo: idPromo } });
        const promoData = promo ? {
          id: promo.dataValues.id_promo,
          nome: promo.dataValues.nome_promo,
          stato: promo.dataValues.stato,
          validita_dal: promo.dataValues.validita_dal,
          validita_al: promo.dataValues.validita_al
        } : undefined;

        return {
          ...kitRuntime,
          numero_referenze_trovate: numeroReferenzeTrovate,
          titolo: kitDesign.titolo,
          lavorazioneStarted: true,
          nomeCanale: canale?.nome_canali || "",
          nomeArea: area?.nome_aree || "",
          isDesignKit: false,
          tipiExport: tipiDiExportInKit,
          tipiDiExportInKit: kitRuntime.tipiDiExportInKit.map((tipoExport) => ({
            ...tipoExport,
            codice: getTipiExport.find((tipoExportInternal) => tipoExportInternal.id_tipiexport == tipoExport.tipoDiExportGuidID)?.codice_tipiexport || ""
          })),
          promo: promoData
        };
      } else {
        const tipiDiExportInKit = await TipiDiExport.findAll({
          where: {
            id_tipiexport: {
              [Op.in]: kitDesign.tipiDiExportInKit.map((tipo: any) => tipo.tipoDiExportGuidID)
            }
          }
        }) as unknown as TipiDiExportAttributes[];

        // Fetch promo data for the design kit too
        const promo = await Promo.findOne({ where: { id_promo: idPromo } });
        const promoData = promo ? {
          id: promo.dataValues.id_promo,
          nome: promo.dataValues.nome_promo,
          stato: promo.dataValues.stato,
          validita_dal: promo.dataValues.validita_dal,
          validita_al: promo.dataValues.validita_al
        } : undefined;

        return {
          ...kitDesign,
          idPromo,
          lavorazioneStarted: false,
          nomeCanale: canale?.nome_canali || "",
          nomeArea: area?.nome_aree || "",
          codiceArea: area?.codice_aree || "",
          codiceCanale: canale?.codice_canali || "",
          isDesignKit: true,
          files: kitDesign.files || [],
          tipiExport: tipiDiExportInKit,
          tipiDiExportInKit: kitDesign.tipiDiExportInKit.map((tipoExport: any) => ({
            ...tipoExport,
            codice: getTipiExport.find((tipoExportInternal) => tipoExportInternal.id_tipiexport == tipoExport.tipoDiExportGuidID)?.codice_tipiexport || ""
          })),
          promo: promoData,
        };
      }
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del kit per la gestione lavorazione"), {
        message: "Errore durante il recupero del kit per la gestione lavorazione",
        operation: 'getKitPerGestioneLavorazione',
        entity: 'RuntimeKit/DesignKit',
        details: { error }
      });
    }
  }

  async getFilesPerGestioneLavorazione(idKit: string, req: Request): Promise<any> {
    try {
      // Fetch all files for this runtime kit, dedup by name (prefer those with id_olimpo_cloud)
      const allFiles = await FilesRuntime.findAll({
        where: { id_runtime: idKit },
        raw: true
      }) as unknown as any[];

      // Dedup by nome: prefer file with id_olimpo_cloud
      const filesByNome = new Map<string, any>();
      for (const file of allFiles) {
        const existing = filesByNome.get(file.nome);
        if (!existing) {
          filesByNome.set(file.nome, file);
        } else {
          // prefer the one with id_olimpo_cloud
          if (file.id_olimpo_cloud && !existing.id_olimpo_cloud) {
            filesByNome.set(file.nome, file);
          }
        }
      }

      const dedupedFiles = Array.from(filesByNome.values());

      // Fetch logs for all files of this kit
      const logsRaw = await FilesRuntimeLog.findAll({
        where: { id_kit_runtime: idKit },
        raw: true
      }) as unknown as any[];

      const logsByNomeFile = new Map<string, any>();
      for (const logEntry of logsRaw) {
        if (logEntry.nome_file) {
          logsByNomeFile.set(logEntry.nome_file, logEntry);
        }
      }

      // Enrich files with logs and OLYMPUS URLs
      const filesWithLogs = dedupedFiles.map(file => {
        const logEntry = logsByNomeFile.get(file.nome) || null;
        return {
          ...file,
          log: logEntry,
          url: (file.id_olimpo_cloud && file.id_olimpo_cloud !== '')
            ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`
            : file.url,
          url_download: (file.id_olimpo_cloud && file.id_olimpo_cloud !== '')
            ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`
            : file.url,
        };
      });

      // Raccogli tutti gli user IDs unici dai log per fetch in batch
      const userIds = new Set<string>();
      for (const file of filesWithLogs) {
        if (file.log?.logs) {
          for (const logItem of file.log.logs) {
            if (logItem.utente_notifica && logItem.utente_notifica !== 'system' && logItem.utente_notifica !== 'unknown') {
              userIds.add(logItem.utente_notifica);
            }
          }
        }
      }

      // Fetch tutti gli utenti in una singola query
      const userIdsArray = Array.from(userIds);
      const usersMap = new Map<string, string>();
      if (userIdsArray.length > 0) {
        const users = await Utente.findAll({
          where: { id_utenti: userIdsArray },
          attributes: ['id_utenti', "nome_utenti", 'cognome_utenti']
        });
        for (const user of users) {
          usersMap.set(user.id_utenti, user.getNomeCompleto());
        }
      }

      // Mappa i nomi utente nei log
      const result = filesWithLogs.map(file => {
        if (file.log?.logs) {
          file.log.logs = file.log.logs.map((logItem: any) => {
            if (logItem.utente_notifica && logItem.utente_notifica !== 'system' && logItem.utente_notifica !== 'unknown') {
              logItem.utente_notifica = usersMap.get(logItem.utente_notifica) || logItem.utente_notifica;
            }
            return logItem;
          });
        }
        return file;
      });

      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei file per la gestione lavorazione"), {
        message: "Errore durante il recupero dei file per la gestione lavorazione",
        operation: 'getFilesPerGestioneLavorazione',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async getKitRuntimeById(id: string): Promise<RUNTIME_KIT_MONGO> {
    try {
      const raw = await RuntimeKit.findOne({ where: { id }, raw: true });
      const resultCreazioneCombinazioneDesign = raw ? normalizeRuntimeKitFromPg(raw) : null as unknown as RUNTIME_KIT_MONGO;

      // Aggiungi i dati della promozione se presente idPromo
      if (resultCreazioneCombinazioneDesign?.idPromo) {
        const promo = await Promo.findOne({ where: { id_promo: resultCreazioneCombinazioneDesign.idPromo } });
        if (promo) {
          resultCreazioneCombinazioneDesign.promo = {
            id: promo.dataValues.id_promo,
            nome: promo.dataValues.nome_promo,
            stato: promo.dataValues.stato,
            validita_dal: promo.dataValues.validita_dal,
            validita_al: promo.dataValues.validita_al
          };
        }
      }

      return resultCreazioneCombinazioneDesign;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione di design"), {
        message: "Errore durante la creazione della combinazione di design",
        operation: 'findOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async getKitRuntimeByIdPerWebhook(id: string): Promise<{
    id_kit: string,
    id_promo: string,
    area: {
      id: string,
      nome: string,
      codice: string
    },
    canale: {
      id: string,
      nome: string,
      codice: string
    },
    formato: {
      id: string,
      nome: string,
      codice: string
    },
    tipi_di_export: {
      id: string,
      nome: string,
      codice: string,
      filtri: any[]
    }[]
  }> {
    try {
      const rawKit = await RuntimeKit.findOne({ where: { id }, raw: true });
      const resultCreazioneCombinazioneDesign = rawKit ? normalizeRuntimeKitFromPg(rawKit) : null as unknown as RUNTIME_KIT_MONGO;
      const area = await Area.findByPk(resultCreazioneCombinazioneDesign.guidArea);
      const canale = await Canale.findByPk(resultCreazioneCombinazioneDesign.guidCanale);
      const formato = await Formati.findByPk(resultCreazioneCombinazioneDesign.guidFormato);
      const tipiDiExport = await TipiDiExport.findAll({
        where: {
          id_tipiexport: { [Op.in]: resultCreazioneCombinazioneDesign.tipiDiExportInKit.map((tipo: OggettoTipiDiExport) => tipo.tipoDiExportGuidID) }
        }
      }) as unknown as TipiDiExportAttributes[];
      const kitRilavorato: {
        id_kit: string,
        id_promo: string,
        area: {
          id: string,
          nome: string,
          codice: string
        },
        canale: {
          id: string,
          nome: string,
          codice: string
        },
        formato: {
          id: string,
          nome: string,
          codice: string
        },
        tipi_di_export: {
          id: string,
          nome: string,
          codice: string,
          filtri: any[]
        }[]
      } = {
        id_kit: resultCreazioneCombinazioneDesign.guidId,
        id_promo: resultCreazioneCombinazioneDesign.idPromo,
        area: {
          id: area?.id_aree ?? "",
          nome: area?.nome_aree ?? "",
          codice: area?.codice_aree ?? ""
        },
        canale: {
          id: canale?.id_canali ?? "",
          nome: canale?.nome_canali ?? "",
          codice: canale?.codice_canali ?? ""
        },
        formato: {
          id: formato?.id_formati ?? "",
          nome: formato?.nome_formati ?? "",
          codice: formato?.codice_formati ?? ""
        },
        tipi_di_export: resultCreazioneCombinazioneDesign.tipiDiExportInKit.map((tipo: OggettoTipiDiExport) => {
          const tipoDiExport = tipiDiExport.find((t: TipiDiExportAttributes) => t.id_tipiexport === tipo.tipoDiExportGuidID);
          return {
            id: tipo.tipoDiExportGuidID ?? "",
            nome: tipoDiExport?.nome_tipiexport ?? "",
            codice: tipoDiExport?.codice_tipiexport ?? "",
            filtri: tipo.filtro ?? []
          }
        }),
      }
      return kitRilavorato;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione di design"), {
        message: "Errore durante la creazione della combinazione di design",
        operation: 'findOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async getAllKitRuntimeByIdPromo(idPromo: string): Promise<RUNTIME_KIT_MONGO[]> {
    try {
      const rawKits = await RuntimeKit.findAll({
        where: { id_promo: idPromo },
        raw: true
      });
      const resultCreazioneCombinazioneDesign = (rawKits || []).map(normalizeRuntimeKitFromPg);

      // Recupera i dati della promozione una volta sola
      const promo = await Promo.findOne({ where: { id_promo: idPromo } });
      const promoData = promo ? {
        id: promo.dataValues.id_promo,
        nome: promo.dataValues.nome_promo,
        stato: promo.dataValues.stato,
        validita_dal: promo.dataValues.validita_dal,
        validita_al: promo.dataValues.validita_al
      } : undefined;

      // Filter kit runtime by tipo_lavorazione_formati = 2
      const filteredKits = await Promise.all(
        resultCreazioneCombinazioneDesign.map(async (item) => {
          // Aggiungi i dati della promozione
          if (promoData) {
            item.promo = promoData;
          }
          // Get formato details
          const formato = await Formati.findOne({ where: { id_formati: item.guidFormato } });

          // Skip if formato doesn't have tipo_lavorazione_formati = 2
          if (!formato || formato.tipo_lavorazione_formati !== 2) {
            return null;
          }

          const rawFiles = await FilesRuntime.findAll({
            where: { id_runtime: item.guidId },
            raw: true
          }) as unknown as any[];
          const file = rawFiles.map((f: any) => ({
            ...f,
            isOptional: f.isOptional ?? f.is_optional ?? false,
            url: f.id_olimpo_cloud
              ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${f.id_olimpo_cloud}`
              : f.url,
          })) as FileItemKit[];
          item.files = file;
          return item;
        })
      );

      // Remove null values (filtered out kits)
      return filteredKits.filter((kit): kit is RUNTIME_KIT_MONGO => kit !== null);
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento delle combinazioni di design"), {
        message: "Errore durante l'aggiornamento delle combinazioni di design",
        operation: 'find',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  // questa funzione cerca nelle combinazione design
  async getAllKitByAreaCanalePV(data: {
    idArea?: string,
    idCanale?: string,
    idPv?: string,
    idPromo?: string,
    idFormato?: string,
    id?: string,
    promoContext?: {
      nome_field: string;
      user_value: string;
    }[],
    tags?: string[]
    tipoLavorazione?: number
  }) {
    try {

      let combinazioni: any[] = [];

      const whereClause: any = {};
      if (data.id) whereClause.id = data.id;
      if (data.idArea) whereClause.id_area = data.idArea;
      if (data.idCanale) whereClause.id_canale = data.idCanale;
      if (data.idFormato) whereClause.id_formato = data.idFormato;
      if (data.tipoLavorazione) {
        const formati = await Formati.findAll({
          where: {
            tipo_lavorazione_formati: data.tipoLavorazione
          }
        })
        whereClause.id_formato = {
          [Op.in]: formati.map(f => f.id_formati)
        }
      }
      const normalizedTags = (data.tags ?? [])
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => Boolean(tag));
      if (normalizedTags.length > 0) {
        // Match combinazioni che contengono almeno uno dei tag richiesti
        whereClause.tags = { [Op.overlap]: normalizedTags };
      }
      // For filtro_contesto with promoContext we fetch all and filter in-memory
      // since Sequelize JSONB containment query for nested conditions is complex
      combinazioni = await DesignKit.findAll({
        where: whereClause,
        raw: true
      }) as unknown as any[] || [];

      if (!combinazioni) return [];

      // Apply filtro_contesto filter in-memory
      const promoContext = Array.isArray(data.promoContext) ? data.promoContext : [];

      const isEmptyContextCondition = (condizione: any): boolean => {
        const nomeField = (condizione?.nome_field ?? '').trim();
        const colonna = (condizione?.colonna ?? '').trim();
        const valore = (condizione?.valore ?? '').trim();
        const operatore = (condizione?.operatore ?? '').trim();

        return operatore === "=" && (nomeField === "." || nomeField === "") && colonna === "" && valore === "";
      };

      if (promoContext.length > 0) {
        combinazioni = combinazioni.filter((combinazione: any) => {
          if (!Array.isArray(combinazione.filtro_contesto) || combinazione.filtro_contesto.length === 0) return false;
          return combinazione.filtro_contesto.some((fc: any) => {
            if (!Array.isArray(fc.condizioni)) return false;
            return fc.condizioni.some((condizione: any) => {
              return promoContext.some(ctx =>
                condizione.colonna === ctx.nome_field &&
                condizione.valore === ctx.user_value &&
                condizione.operatore === "="
              );
            });
          });
        });
      } else {
        combinazioni = combinazioni.filter((combinazione: any) => {
          if (!Array.isArray(combinazione.filtro_contesto) || combinazione.filtro_contesto.length === 0) {
            return true;
          }
          return combinazione.filtro_contesto.some((fc: any) => {
            if (!Array.isArray(fc.condizioni) || fc.condizioni.length === 0) return true;
            return fc.condizioni.every((condizione: any) => isEmptyContextCondition(condizione));
          });
        });
      }

      combinazioni = combinazioni.filter((combinazione) => combinazione.stato == STATO_COMBINAZIONI.ATTIVO);

      await Promise.all(combinazioni.map(async (combinazione) => {
        const area = await Area.findByPk(combinazione.id_area);
        if (area) {
          combinazione.nomeArea = area.nome_aree;
        }
        const canale = await Canale.findByPk(combinazione.id_canale);
        if (canale) {
          combinazione.nomeCanale = canale.nome_canali;
        }
        const kit = await RaccoglitoreKit.findOne({ where: { id: combinazione.id_raccoglitore }, raw: true });
        if (kit) {
          combinazione.namingConvention = (kit as any).naming_convention || null;
        }
      }));

      return combinazioni.map((c: any) => ({
        ...c,
        guidId: c.guidId ?? c.id,
        guidArea: c.guidArea ?? c.id_area,
        guidCanale: c.guidCanale ?? c.id_canale,
        guidFormato: c.guidFormato ?? c.id_formato,
        guidIdRaccoglitore: c.guidIdRaccoglitore ?? c.id_raccoglitore,
        tipiDiExportInKit: (c.tipiDiExportInKit ?? c.tipi_di_export_in_kit ?? []).map((t: any) => ({
          ...t,
          tipoDiExportGuidID: t.tipoDiExportGuidID ?? t.tipo_di_export_guid_id,
          useWebhook: t.useWebhook ?? t.use_webhook,
          webhookEvents: t.webhookEvents ?? t.webhook_events,
        })),
        quantitaCopie: c.quantitaCopie ?? c.quantita_copie,
        filtroContesto: c.filtroContesto ?? c.filtro_contesto ?? [],
      }));

    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni"), {
        message: "Errore durante il recupero delle combinazioni",
        operation: 'find',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  /** ──────────────── Mutations ──────────────── */

  async createKitRunTime(data: RUNTIME_KIT_MONGO) {
    try {
      const kit = await RuntimeKit.findOne({
        where: {
          id_design: data.guidIdDesign,
          id_promo: data.idPromo,
        },
        raw: true
      }) as unknown as RUNTIME_KIT_MONGO;
      if (kit != null) {
        return normalizeRuntimeKitFromPg(kit);
      }
      const pgData: any = {
        id: data.guidId || uuidv4(),
        id_area: data.guidArea,
        id_canale: data.guidCanale,
        id_formato: data.guidFormato,
        id_design: data.guidIdDesign,
        id_raccoglitore: data.guidIdRaccoglitore,
        id_promo: data.idPromo,
        tipi_di_export_in_kit: (data.tipiDiExportInKit || []).map((t: any) => ({
          tipo_di_export_guid_id: t.tipo_di_export_guid_id,
          filtro: t.filtro || [],
          use_webhook: t.use_webhook,
          webhook_events: t.webhook_events
        })),
        filtro_contesto: data.filtroContesto || [],
        quantita_copie: data.quantitaCopie || 1,
        nome_area: data.nomeArea,
        nome_canale: data.nomeCanale,
        codice_area: data.codiceArea,
        codice_canale: data.codiceCanale,
        inizio_lavorazione: data.inizioLavorazione,
        fine_lavorazione: data.fineLavorazione,
        files_data: data.files || [],
        stato_lavorazione: data.stato_lavorazione,
        stato: data.stato,
        titolo: data.titolo,
        tipo: data.tipo,
        filtro: data.filtro || [],
        declinazioni: data.declinazioni || [],
      };
      const result = await RuntimeKit.create(pgData as any, {
        validate: false
      });
      return normalizeRuntimeKitFromPg(result.get({ plain: true }));
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione del runtime kit"), {
        message: "Errore durante la creazione del runtime kit",
        operation: 'insertOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async creaKitRuntimeManuale(idPromo: string, kitDesign: DESIGN_KIT_MONGO) {
    try {
      const newId = uuidv4();

      // Recupera i files dal raccoglitore_kit (template) perché design_kit non ha il campo files
      const idRaccoglitore = kitDesign.guidIdRaccoglitore ?? (kitDesign as any).id_raccoglitore;
      let filesFromTemplate: any[] = [];
      if (idRaccoglitore) {
        const raccoglitore = await RaccoglitoreKit.findOne({ where: { id: idRaccoglitore }, raw: true });
        if (raccoglitore) {
          filesFromTemplate = (raccoglitore as any).files ?? [];
        }
      }

      const pgData: any = {
        id: newId,
        id_area: kitDesign.guidArea,
        id_design: kitDesign.guidId,
        id_canale: kitDesign.guidCanale,
        id_formato: kitDesign.guidFormato,
        tipi_di_export_in_kit: (kitDesign.tipiDiExportInKit || []).map((t: any) => ({
          tipo_di_export_guid_id: t.tipoDiExportGuidID,
          filtro: t.filtro || [],
          use_webhook: t.use_webhook,
          webhook_events: t.webhook_events
        })),
        quantita_copie: kitDesign.quantitaCopie || 1,
        titolo: kitDesign.titolo,
        id_raccoglitore: idRaccoglitore,
        stato: kitDesign.stato,
        id_promo: idPromo,
        tipo: TIPO_KIT_DESIGN.MANUALE,
        filtro_contesto: kitDesign.filtroContesto || [],
        filtro: kitDesign.filtro || [],
        declinazioni: kitDesign.declinazioni || [],
        stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
        files_data: mapRaccoglitoreFilesToFilesData(filesFromTemplate, newId),
      };

      const result = await RuntimeKit.create(pgData as any);
      return normalizeRuntimeKitFromPg(result.get({ plain: true }));
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione del runtime kit manuali"), {
        message: "Errore durante la creazione del runtime kit manuali",
        operation: 'insertOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async bulkCreateRuntime(data: (DESIGN_KIT_MONGO & { idPromo: string })[]): Promise<RUNTIME_KIT_MONGO[]> {
    try {
      let result: (RUNTIME_KIT_MONGO & { guidIdDesign: string })[] = [];
      // Estrai gli ID delle combinazioni dal dato in ingresso

      await Promise.all(data.map(async (item) => {
        const existingCombinations = await RuntimeKit.findAll({
          where: {
            id_design: item.guidId,
            id_promo: item.idPromo
          },
          raw: true
        }) as unknown as RUNTIME_KIT_MONGO[];
        if (existingCombinations.length == 0) {
          const raccoglitoreKit = await RaccoglitoreKit.findOne({ where: { id: item.guidIdRaccoglitore }, raw: true });
          if (!raccoglitoreKit) {
            throw new NotFoundError({ message: 'Raccoglitore non trovato', entityType: 'raccoglitore_kit', entityId: item.guidIdRaccoglitore });
          }
          const newId = uuidv4();
          const runtimeKitPromo: RUNTIME_KIT_MONGO & { guidIdDesign: string } = {
            ...item,
            guidId: newId,
            filtro: (raccoglitoreKit as any).filtro ? (raccoglitoreKit as any).filtro : [],
            guidIdDesign: item.guidId,
            tipiDiExportInKit: item.tipiDiExportInKit,
            declinazioni: item.declinazioni,
            stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          const pgData: any = {
            id: newId,
            id_area: item.guidArea,
            id_canale: item.guidCanale,
            id_formato: item.guidFormato,
            id_design: item.guidId,
            id_raccoglitore: item.guidIdRaccoglitore,
            id_promo: item.idPromo,
            tipi_di_export_in_kit: (item.tipiDiExportInKit || []).map((t: any) => ({
              tipo_di_export_guid_id: t.tipoDiExportGuidID,
              filtro: t.filtro || [],
              use_webhook: t.useWebhook ?? t.use_webhook,
              webhook_events: t.webhookEvents ?? t.webhook_events
            })),
            filtro_contesto: item.filtroContesto || [],
            quantita_copie: item.quantitaCopie || 1,
            nome_area: item.nomeArea,
            nome_canale: item.nomeCanale,
            codice_area: (item as any).codiceArea,
            codice_canale: (item as any).codiceCanale,
            files_data: mapRaccoglitoreFilesToFilesData(
              (item.files && item.files.length > 0) ? item.files : ((raccoglitoreKit as any).files ?? []),
              newId
            ),
            stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
            stato: item.stato,
            titolo: item.titolo,
            tipo: item.tipo,
            filtro: (raccoglitoreKit as any).filtro || [],
            declinazioni: item.declinazioni || [],
          };
          await RuntimeKit.create(pgData as any);
          const createdRaw = await RuntimeKit.findByPk(newId, { raw: true });
          result.push({ ...normalizeRuntimeKitFromPg(createdRaw), guidIdDesign: item.guidId } as RUNTIME_KIT_MONGO & { guidIdDesign: string });
        } else {
          result.push(normalizeRuntimeKitFromPg(existingCombinations[0] as any));
        }
      }));

      return result;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione di design"), {
        message: "Errore durante la creazione della combinazione di design",
        operation: 'insertMany',
        entity: 'RuntimeKit',
        details: { error }
      });
    }


  }


  async mettiInStatoDiEliminazione(id: string): Promise<any> {
    try {
      const result = await RuntimeKit.findOne({ where: { id }, raw: false });
      if (result === null) {
        throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
          message: 'Kit runtime not found',
          entityId: id,
          entityType: 'RuntimeKit'
        });
      }
      if (result.stato_lavorazione == STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO) {
        throw new BusinessError({ message: 'Kit runtime already deleted', rule: 'Kit runtime già eliminato, impossibile eliminare nuovamente' });
      }
      result.stato_lavorazione = STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO;
      await result.save();
      return result.get({ plain: true });
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione della lavorazione runtime"), {
        message: "Errore durante l'eliminazione della lavorazione runtime",
        operation: 'deleteOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async eliminaKitRuntime(id: string): Promise<any> {
    try {
      return await sequelize.transaction(async (t) => {
        const result = await RuntimeKit.findOne({ where: { id }, raw: false, transaction: t });
        if (!result) {
          throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
            message: 'Kit runtime non trovato',
            entityId: id,
            entityType: 'RuntimeKit'
          });
        }
        if (result.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO) {
          throw new BusinessError({ message: 'Kit runtime pubblicato, errore fatale', rule: 'Kit runtime pubblicato non può essere eliminato' });
        }
        await FilesRuntime.destroy({ where: { id_runtime: id }, transaction: t });
        await RuntimeKit.destroy({ where: { id }, limit: 1, transaction: t });
        return result.get({ plain: true });
      });
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante l'eliminazione del kit runtime",
        operation: 'deleteOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async eliminaFileKitRuntime(id: string): Promise<any> {
    try {
      const findFile = await FilesRuntime.findOne({ where: { id }, raw: true });
      if (!findFile) {
        throw wrapNotFoundError(new Error("File non trovato"), {
          message: 'File non trovato',
          entityId: id,
          entityType: 'FilesRuntime'
        });
      }
      const findKitRuntime = await RuntimeKit.findOne({ where: { id: findFile.id_runtime }, raw: true });
      if (!findKitRuntime) {
        throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
          message: 'Kit runtime non trovato',
          entityId: findFile.id_runtime || '',
          entityType: 'RuntimeKit'
        });
      }
      await FilesRuntime.destroy({ where: { id }, limit: 1 });
      return findFile;
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw error;
      }
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione del file"), {
        message: "Errore durante l'eliminazione del file",
        operation: 'deleteOne',
        entity: 'FilesRuntime',
        details: { error }
      });
    }
  }

  /** ──────────────── Workflow & States ──────────────── */


  async avvioRevisioneKitManuale(idLavorazione: string): Promise<any> {
    try {
      return await sequelize.transaction(async (t) => {
        // Check kit exists and state
        const existing = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: false, transaction: t });

        if (!existing) {
          throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
            message: 'Kit runtime non trovato',
            entityId: idLavorazione,
            entityType: 'RuntimeKit'
          });
        }

        if (existing.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE) {
          throw new BusinessError({ message: 'Kit runtime già in revisione', rule: 'Kit runtime è già in stato di revisione' });
        }

        if (existing.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO) {
          throw new BusinessError({ message: 'Kit runtime eliminato, errore fatale', rule: 'Kit runtime eliminato non può essere messo in revisione' });
        }

        await RuntimeKit.update(
          { stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE },
          {
            where: {
              id: idLavorazione,
              stato_lavorazione: { [Op.notIn]: [STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE, STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO] }
            },
            validate: false,
            transaction: t
          },
        );

        const result = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: true, transaction: t });
        return result ? normalizeRuntimeKitFromPg(result as any) : null;
      });
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'avvio della revisione " + error.message), {
        message: "Errore durante l'avvio della revisione",
        operation: 'updateOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async avvioRevisioneKitAutomatico(idLavorazione: string): Promise<any> {
    try {
      return await sequelize.transaction(async (t) => {
        // Verifica lo stato del kit prima dell'aggiornamento
        const kitCheck = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: false, transaction: t });
        if (!kitCheck) {
          throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
            message: 'Kit runtime non trovato',
            entityId: idLavorazione,
            entityType: 'RuntimeKit'
          });
        }
        if (kitCheck.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE) {
          throw new BusinessError({ message: 'Kit runtime già in revisione', rule: 'Kit runtime è già in stato di revisione' });
        }
        if (kitCheck.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO) {
          throw new BusinessError({ message: 'Kit runtime eliminato, errore fatale', rule: 'Kit runtime eliminato non può essere messo in revisione' });
        }

        const filesInLavorazione = await FilesRuntime.findAll({
          where: { id_runtime: idLavorazione },
          raw: true,
          transaction: t
        });
        if (filesInLavorazione.length === 0) {
          throw new NotFoundError({ message: 'Nessun file in lavorazione trovato', entityType: 'files_runtime', details: { idLavorazione } });
        }

        const EXPORT_CORREGGO = await TipiDiExport.findOne({
          where: {
            codice_tipiexport: EXPORT_DI_SISTEMA.CORREGGO
          },
          transaction: t
        });
        if (!EXPORT_CORREGGO) {
          throw new NotFoundError({ message: 'Tipo di export correggo non trovato', entityType: 'tipi_di_export' });
        }

        const filesNonCorreggo = filesInLavorazione.filter(f => f.tipo_export !== EXPORT_CORREGGO.id_tipiexport);
        if (filesNonCorreggo.length <= 0) {
          throw new BusinessError({ message: 'Nessun file in attesa di correzione trovato', rule: 'Devono essere presenti file non-correggo per avviare la revisione automatica' });
        }

        // Aggiorna i file log in batch per ogni file
        await Promise.all(filesNonCorreggo.map(async (file) => {
          // Prendi il file log con la versione maggiore per questo file e kit
          const fileLogVersione = await FilesRuntimeLog.findOne({
            where: {
              id_kit_runtime: idLavorazione,
              nome_file: file.nome
            },
            order: [['versione', 'DESC']],
            raw: true,
            transaction: t
          }) as unknown as any;

          if (!fileLogVersione) {
            throw new NotFoundError({ message: 'File log non trovato per il file: ' + file.nome, entityType: 'files_runtime_log', details: { nomeFile: file.nome, idLavorazione } });
          }

          // Aggiorna il file log aggiungendo il nuovo log entry
          const updatedLogs = [...(fileLogVersione.logs || []), {
            messaggio: 'File passato in revisione',
            data_notifica: new Date(),
            azione: "Upload",
          }];
          await FilesRuntimeLog.update(
            {
              logs: updatedLogs,
              stato: STATO_LOG_FILE.IN_REVISIONE
            },
            { where: { id: fileLogVersione.id }, validate: false, transaction: t }
          );
        }));

        // Aggiorna lo stato del kit runtime
        await RuntimeKit.update(
          { stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE },
          { where: { id: idLavorazione }, validate: false, transaction: t }
        );

        const result = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: true, transaction: t });
        return result ? normalizeRuntimeKitFromPg(result as any) : null;
      });
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante l'avvio della revisione " + error.message,
        operation: 'updateOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async riportaInLavorazione(
    idLavorazione: string,
    filesAccepted: string[],
    filesRejected: { id: string, log: { messaggio: string } }[],
    req: Request
  ): Promise<any> {
    try {
      return await sequelize.transaction(async (t) => {
        await RuntimeKit.update(
          { stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE },
          {
            where: {
              id: idLavorazione,
              stato_lavorazione: { [Op.notIn]: [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE, STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO] },
              stato: { [Op.notIn]: [STATO_COMBINAZIONI.DISATTIVO] }
            },
            validate: false,
            transaction: t
          }
        );
        const kitUpdate = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: true, transaction: t });

        // non ci interessano i file rifiutati per ora, perchè non si aggiorna il log di essi
        const file_rifiutati = await FilesRuntime.findAll({
          where: {
            id_runtime: idLavorazione,
            id: { [Op.in]: filesRejected.map(f => f.id) }
          },
          raw: true,
          transaction: t
        });

        await Promise.all(file_rifiutati.map(async (file) => {
          // Trova la versione più alta esistente e incrementala
          const maxVersionDoc = await FilesRuntimeLog.findOne({
            where: { id_kit_runtime: idLavorazione, nome_file: file.nome },
            order: [['versione', 'DESC']],
            raw: true,
            transaction: t
          }) as unknown as any;
          const nuovaVersione = maxVersionDoc?.versione !== undefined ? maxVersionDoc.versione + 1 : 1;

          // Fetch existing log to append to its logs array
          const existingLog = await FilesRuntimeLog.findOne({
            where: { id_kit_runtime: idLavorazione, nome_file: file.nome, versione: nuovaVersione },
            raw: true,
            transaction: t
          }) as unknown as any;

          const newLogEntry = {
            messaggio: filesRejected.find(f => f.id === file.id)?.log.messaggio || '',
            data_notifica: new Date(),
            azione: 'Rifiutato',
            utente_notifica: req.session.id_utente as string,
            stato_revisione: 'Rifiutato'
          };

          if (existingLog) {
            const updatedLogs = [...(existingLog.logs || []), newLogEntry];
            await FilesRuntimeLog.update(
              { logs: updatedLogs },
              { where: { id_kit_runtime: idLavorazione, nome_file: file.nome, versione: nuovaVersione }, transaction: t }
            );
          } else {
            await FilesRuntimeLog.create({
              id: uuidv4(),
              id_kit_runtime: idLavorazione,
              nome_file: file.nome || '',
              versione: nuovaVersione,
              data_registrazione: new Date(),
              stato: STATO_LOG_FILE.IN_ATTESA,
              logs: [newLogEntry]
            } as any, { transaction: t });
          }
          console.log('Nuovo log creato con versione:', nuovaVersione, 'per file:', file.nome);
        }));

        //cancella anche tutti i file rifiutati - set stato to null
        if (filesRejected.length > 0) {
          await FilesRuntime.update(
            { stato: undefined } as any,
            { where: { id_runtime: idLavorazione, id: { [Op.in]: filesRejected.map(f => f.id) } }, transaction: t }
          );
        }
        return kitUpdate;
      });
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il riporto della lavorazione"), {
        message: "Errore durante il riporto della lavorazione",
        operation: 'updateOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async riportaInLavorazioneConErroriAutomatico(
    idLavorazione: string,
    filesAccepted: string[],
    filesRejected: { id: string, log: { messaggio: string } }[],
    req: Request
  ): Promise<any> {
    try {
      return await sequelize.transaction(async (t) => {
        const kitRuntime = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: true, transaction: t }) as unknown as RUNTIME_KIT_MONGO;
        if (!kitRuntime) {
          throw wrapNotFoundError(new Error(`Kit runtime con id ${idLavorazione} non trovato`), {
            message: `Kit runtime con id ${idLavorazione} non trovato`,
            entityType: 'RuntimeKit',
            details: { idLavorazione }
          });
        }

        // Gestione file rifiutati con log
        await Promise.all(filesRejected.map(async (file) => {
          const fileRejected = await FilesRuntime.findOne({ where: { id: file.id }, raw: true, transaction: t }) as unknown as FileItemKit;
          if (fileRejected) {
            const getFilelog = await FilesRuntimeLog.findOne({
              where: {
                nome_file: fileRejected.nome,
                id_kit_runtime: idLavorazione
              },
              raw: true,
              transaction: t
            }) as unknown as FileItemKitLog;
            if (getFilelog) {
              const updatedLogs = [...(getFilelog.logs || []), {
                messaggio: file.log.messaggio,
                data_notifica: new Date(),
                azione: 'Rifiutato',
                utente_notifica: req.session?.id_utente || 'unknown',
                dettagli_aggiuntivi: {}
              }];
              await FilesRuntimeLog.update(
                { logs: updatedLogs as any, stato: STATO_LOG_FILE.ERRORE },
                { where: { id: getFilelog.id }, validate: false, transaction: t }
              );
            } else {
              const logEntry: any = {
                id: uuidv4(),
                id_kit_runtime: idLavorazione,
                nome_file: fileRejected.nome,
                stato: STATO_LOG_FILE.ERRORE,
                data_registrazione: new Date(),
                versione: 1,
                logs: [{
                  azione: 'Rifiutato',
                  messaggio: file.log.messaggio,
                  data_notifica: new Date(),
                  utente_notifica: req.session?.id_utente || 'unknown',
                  dettagli_aggiuntivi: {}
                }]
              };
              await FilesRuntimeLog.create(logEntry as any, { transaction: t });
            }
          }
        }));

        // Gestione file accettati con log
        await Promise.all(filesAccepted.map(async (file) => {
          const fileAccepted = await FilesRuntime.findOne({ where: { id: file }, raw: true, transaction: t }) as unknown as FileItemKit;
          if (fileAccepted) {
            const getFilelog = await FilesRuntimeLog.findOne({
              where: {
                nome_file: fileAccepted.nome,
                id_kit_runtime: idLavorazione
              },
              raw: true,
              transaction: t
            }) as unknown as FileItemKitLog;
            if (getFilelog) {
              const updatedLogs = [...(getFilelog.logs || []), {
                azione: 'Accettato',
                messaggio: 'File accettato e riportato in lavorazione',
                data_notifica: new Date(),
                utente_notifica: req.session?.id_utente || 'unknown',
                dettagli_aggiuntivi: {}
              }];
              await FilesRuntimeLog.update(
                { logs: updatedLogs as any, stato: STATO_LOG_FILE.ACCETTATO },
                { where: { id: getFilelog.id }, transaction: t }
              );
            } else {
              const logEntry: any = {
                id: uuidv4(),
                id_kit_runtime: idLavorazione,
                nome_file: fileAccepted.nome,
                data_registrazione: new Date(),
                versione: 1,
                logs: [{
                  azione: 'Accettato',
                  messaggio: 'File accettato e riportato in lavorazione',
                  data_notifica: new Date(),
                  utente_notifica: req.session?.id_utente || 'unknown',
                  dettagli_aggiuntivi: {}
                }],
                stato: STATO_LOG_FILE.ACCETTATO
              };
              await FilesRuntimeLog.create(logEntry as any, { transaction: t });
            }
          }
        }));

        // Aggiorna stato del kit in base ai file rifiutati
        if (filesRejected.length > 0) {
          await RuntimeKit.update({ stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI }, { where: { id: idLavorazione }, validate: false, transaction: t });
        } else {
          await RuntimeKit.update({ stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE }, { where: { id: idLavorazione }, validate: false, transaction: t });
        }
        return {
          success: true,
          message: "File riportati in lavorazione automatico"
        }
      });
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il riporto in lavorazione automatico"), { message: "Errore durante il riporto in lavorazione automatico", operation: 'riportaInLavorazioneConErroriAutomatico', entity: 'RuntimeKit', details: { error } });
    }
  }

  async pubblicaKitRuntime(idLavorazione: string, req: Request): Promise<any> {
    try {
      const { result, dati } = await sequelize.transaction(async (t) => {
        await RuntimeKit.update(
          { stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO, fine_lavorazione: new Date() },
          { where: { id: idLavorazione }, validate: false, transaction: t }
        );
        const result = await RuntimeKit.findOne({ where: { id: idLavorazione }, raw: true, transaction: t }) as unknown as any;
        if (!result) {
          throw wrapNotFoundError(new Error("Kit runtime non trovato"), {
            message: 'Kit runtime non trovato',
            entityId: idLavorazione,
            entityType: 'RuntimeKit'
          });
        }

        await this.creaLogPubblicazioneFiles(idLavorazione, req.session.id_utente as string, t);

        const area = await Area.findOne({ where: { id_aree: result.id_area }, transaction: t });
        const canale = await Canale.findOne({ where: { id_canali: result.id_canale }, transaction: t });
        const files = await FilesRuntime.findAll({ where: { id_runtime: result.id }, raw: true, transaction: t });
        const promo = await Promo.findOne({
          where: {
            id_promo: result.id_promo
          },
          transaction: t
        }) as unknown as PromoAttributes;
        const dati: PaylodKitPubblicato = {
          area: {
            nome: area?.nome_aree || '',
            codice: area?.codice_aree || ''
          },
          canale: {
            nome: canale?.nome_canali || '',
            codice: canale?.codice_canali || ''
          },
          tipo: result.tipo,
          titolo: result.titolo || '',
          quantita: result.quantita_copie || 0,
          files: files.map((f: any) => ({
            id: f.id,
            nome: f.nome,
            url: f.url || '',
            tipo_export: f.tipo_export || ''
          })),
          filtri: result.filtro || [],
          filtriContesto: result.filtro_contesto || [],
          gdo: '',
          promo: {
            nome: promo?.nome_promo || '',
            id: promo?.id_promo || ''
          }
        };

        return { result, dati };
      });

      await this.webhookService.scatenaEvento({
        evento: EVENTI_WEBHOOK.KIT_PUBBLICATO,
        dati: dati,
        meta: {
          source: 'Istanta 2 GDO Suite',
          request_id: result.id
        }
      });
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la pubblicazione del kit runtime"), {
        message: "Errore durante la pubblicazione del kit runtime",
        operation: 'updateOne',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  /** ──────────────── Combinations ──────────────── */

  async getAllKitRuntime(): Promise<RUNTIME_KIT_MONGO[]> {
    try {
      const resultCreazioneCombinazioneDesign = await RuntimeKit.findAll({ raw: true }) as unknown as any[];
      return resultCreazioneCombinazioneDesign.map(normalizeRuntimeKitFromPg);
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento delle combinazioni di design"), {
        message: "Errore durante l'aggiornamento delle combinazioni di design",
        operation: 'find',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  async getAllCombinazioniRuntimeFilters(filters: { idArea?: string; idCanale?: string; idPv?: string; idPromo?: string; idFormato?: string; id?: string; idTipoExport?: string; idLavorazione?: string; idCombinazione?: string; nome?: string }): Promise<RUNTIME_KIT_MONGO[]> {
    try {
      // Gestione idLavorazione: stringa di ID separati da virgola -> array per Op.in
      const promoIds = filters.idLavorazione ? filters.idLavorazione.split(',').filter(id => id.trim()) : null;

      const whereClause: any = {
        ...(filters.idArea && { id_area: filters.idArea }),
        ...(filters.idCanale && { id_canale: filters.idCanale }),
        ...(filters.idPromo && { id_promo: filters.idPromo }),
        // idLavorazione: filtra per lista di ID promo (ha priorità su idPromo singolo)
        ...(promoIds && promoIds.length > 0 && { id_promo: { [Op.in]: promoIds } }),
        ...(filters.idFormato && { id_formato: filters.idFormato }),
        ...(filters.id && { id: filters.id }),
        ...(filters.idCombinazione && { id: filters.idCombinazione }),
        ...(filters.idTipoExport && { tipi_di_export_in_kit: { [Op.contains]: [{ tipo_di_export_guid_id: filters.idTipoExport }] } }),
        ...(filters.nome && { titolo: { [Op.iLike]: `%${filters.nome}%` } })
      };

      const files = await RuntimeKit.findAll({
        where: whereClause,
        raw: true
      }) as unknown as any[];
      return files.map(normalizeRuntimeKitFromPg);
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero delle combinazioni runtime:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero delle combinazioni runtime"), {
        message: "Errore durante il recupero delle combinazioni runtime",
        operation: 'find',
        entity: 'RuntimeKit',
        details: { filters },
      });
    }
  }

  async cambioStatoCombinazione(guidId: string, stato: "ATTIVO" | "DISATTIVO"): Promise<any> {
    try {
      const result = await DesignKit.update(
        { stato },
        { where: { id: guidId } }
      );
      return result;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il cambio di stato della combinazione:'), error);
      throw wrapDatabaseError(new Error("Errore durante il cambio di stato della combinazione"), {
        message: "Errore durante il cambio di stato della combinazione",
        operation: 'updateOne',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }

  /** ──────────────── File Runtime ──────────────── */

  async getFilesRuntimeByIdKitRuntime(id: string): Promise<FileItemKit[]> {
    try {
      // Fetch all files for this runtime kit, dedup by name (prefer those with id_olimpo_cloud)
      const allFiles = await FilesRuntime.findAll({
        where: { id_runtime: id },
        raw: true
      }) as unknown as any[];

      // Dedup by nome: prefer file with id_olimpo_cloud
      const filesByNome = new Map<string, any>();
      for (const file of allFiles) {
        const existing = filesByNome.get(file.nome);
        if (!existing) {
          filesByNome.set(file.nome, file);
        } else {
          if (file.id_olimpo_cloud && !existing.id_olimpo_cloud) {
            filesByNome.set(file.nome, file);
          }
        }
      }

      const dedupedFiles = Array.from(filesByNome.values());

      // Fetch logs for all files of this kit
      const logsRaw = await FilesRuntimeLog.findAll({
        where: { id_kit_runtime: id },
        raw: true
      }) as unknown as any[];

      const logsByNomeFile = new Map<string, any>();
      for (const logEntry of logsRaw) {
        if (logEntry.nome_file) {
          logsByNomeFile.set(logEntry.nome_file, logEntry);
        }
      }

      // Enrich files with logs and OLYMPUS URLs
      const files = dedupedFiles.map(file => {
        const logEntry = logsByNomeFile.get(file.nome) || null;
        return {
          ...file,
          isOptional: file.isOptional ?? file.is_optional ?? false,
          log: logEntry,
          url: (file.id_olimpo_cloud && file.id_olimpo_cloud !== '')
            ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`
            : file.url,
          url_download: (file.id_olimpo_cloud && file.id_olimpo_cloud !== '')
            ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`
            : file.url,
        };
      });

      return files;
    } catch (error: any) {
      throw new DatabaseError({
        message: "Errore durante la creazione della combinazione di design",
        operation: 'find',
        entity: 'FilesRuntime',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getFilesRuntimeByIdKitRuntimePaginated(params: {
    idKitRuntime: string;
    page?: number;
    pageSize?: number;
    search?: string;
    searchProperty?: string;
  }): Promise<{
    files: FileItemKit[];
    totalItems: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
    stats: {
      totalFiles: number;
      inRevisionCount: number;
      filesWithMetaCount: number;
      duplicateCount: number;
    };
  }> {
    const { idKitRuntime, page = 1, pageSize = 24, search = '', searchProperty = '' } = params;
    const skip = (page - 1) * pageSize;

    try {
      // Fetch all files for this runtime kit, dedup by name (prefer those with id_olimpo_cloud)
      const allFiles = await FilesRuntime.findAll({
        where: { id_runtime: idKitRuntime },
        raw: true
      }) as unknown as any[];

      // Dedup by nome: prefer file with id_olimpo_cloud
      const filesByNome = new Map<string, any>();
      for (const file of allFiles) {
        const existing = filesByNome.get(file.nome);
        if (!existing) {
          filesByNome.set(file.nome, file);
        } else {
          if (file.id_olimpo_cloud && !existing.id_olimpo_cloud) {
            filesByNome.set(file.nome, file);
          }
        }
      }

      let dedupedFiles = Array.from(filesByNome.values());

      // Fetch logs for all files of this kit
      const logsRaw = await FilesRuntimeLog.findAll({
        where: { id_kit_runtime: idKitRuntime },
        raw: true
      }) as unknown as any[];

      const logsByNomeFile = new Map<string, any>();
      for (const logEntry of logsRaw) {
        if (logEntry.nome_file) {
          logsByNomeFile.set(logEntry.nome_file, logEntry);
        }
      }

      // Enrich files with logs and OLYMPUS URLs
      let enrichedFiles = dedupedFiles.map(file => {
        const logEntry = logsByNomeFile.get(file.nome) || null;
        return {
          ...file,
          isOptional: file.isOptional ?? file.is_optional ?? false,
          log: logEntry,
          url: (file.id_olimpo_cloud && file.id_olimpo_cloud !== '')
            ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`
            : file.url,
          url_download: (file.id_olimpo_cloud && file.id_olimpo_cloud !== '')
            ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`
            : file.url,
        };
      });

      // Apply search filter
      if (search.trim()) {
        const searchLower = search.trim().toLowerCase();
        if (searchProperty) {
          switch (searchProperty) {
            case 'nome':
              enrichedFiles = enrichedFiles.filter(f => (f.nome || '').toLowerCase().includes(searchLower));
              break;
            case 'tipo_export_codice':
              enrichedFiles = enrichedFiles.filter(f => (f.tipo_export_codice || '').toLowerCase().includes(searchLower));
              break;
            case 'stato':
              enrichedFiles = enrichedFiles.filter(f => (f.log?.stato || '').toLowerCase().includes(searchLower));
              break;
            default:
              enrichedFiles = enrichedFiles.filter(f => {
                const metaVal = f.meta_olimpo_cloud?.[searchProperty];
                return metaVal && String(metaVal).toLowerCase().includes(searchLower);
              });
              break;
          }
        } else {
          // Search across all properties
          enrichedFiles = enrichedFiles.filter(f =>
            (f.nome || '').toLowerCase().includes(searchLower) ||
            (f.tipo_export_codice || '').toLowerCase().includes(searchLower) ||
            (f.log?.stato || '').toLowerCase().includes(searchLower) ||
            (f.meta_olimpo_cloud?.codice_referenza || '').toLowerCase().includes(searchLower) ||
            (f.meta_olimpo_cloud?.ean_referenza || '').toLowerCase().includes(searchLower) ||
            (f.meta_olimpo_cloud?.descrizione_uno || '').toLowerCase().includes(searchLower) ||
            (f.meta_olimpo_cloud?.reparto || '').toLowerCase().includes(searchLower) ||
            (f.meta_olimpo_cloud?.settore || '').toLowerCase().includes(searchLower) ||
            (f.meta_olimpo_cloud?.tema || '').toLowerCase().includes(searchLower)
          );
        }
      }

      // Sort by nome
      enrichedFiles.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

      // Compute stats before pagination
      const totalItems = enrichedFiles.length;
      const inRevisionCount = enrichedFiles.filter(f => f.log?.stato === 'IN_REVISIONE').length;
      const filesWithMetaCount = enrichedFiles.filter(f => f.meta_olimpo_cloud?.codice_referenza && f.meta_olimpo_cloud.codice_referenza !== '').length;
      const totalPages = Math.ceil(totalItems / pageSize);

      // Apply pagination
      const paginatedFiles = enrichedFiles.slice(skip, skip + pageSize);

      return {
        files: paginatedFiles,
        totalItems,
        currentPage: page,
        totalPages,
        pageSize,
        stats: {
          totalFiles: totalItems,
          inRevisionCount,
          filesWithMetaCount,
          duplicateCount: 0, // Backend already deduplicates by name
        }
      };
    } catch (error: any) {
      throw new DatabaseError({
        message: "Errore durante il recupero paginato dei file runtime",
        operation: 'aggregate',
        entity: 'FilesRuntime',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getFilesRuntimeByIdKitRuntimeFilters(filters: Partial<FileItemKit>): Promise<FileItemKit[]> {
    try {
      const whereClause: any = {
        ...(filters.id_runtime && { id_runtime: filters.id_runtime }),
        ...(filters.id_olimpo_cloud && { id_olimpo_cloud: filters.id_olimpo_cloud }),
      };
      const rawFiles = await FilesRuntime.findAll({
        where: whereClause,
        raw: true
      }) as unknown as any[];
      return rawFiles.map(f => ({
        ...f,
        isOptional: f.isOptional ?? f.is_optional ?? false,
      })) as FileItemKit[];
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero dei file runtime:'), error);
      throw wrapDatabaseError(new Error("Errore durante il recupero dei file runtime"), {
        message: "Errore durante il recupero dei file runtime",
        operation: 'findAll',
        entity: 'FileItemKit',
        details: { filters },
      });
    }
  }

  async clearAllFilesKitRuntime(idKitRuntime: string, guidIdExport: string): Promise<boolean> {
    try {
      const result = await FilesRuntime.destroy({ where: { id_runtime: idKitRuntime, tipo_export: guidIdExport } });
      return result > 0;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la cancellazione del materiale pubblicazione"), {
        message: "Errore durante la cancellazione del materiale pubblicazione",
        operation: 'delete',
        entity: 'RuntimeKit',
        details: { error }
      });
    }
  }

  //FIX questo poi dovrà poi gestire correttamente il dato che gli arriva
  async insertNewFileRuntimeLog(data: FileItemKitLog): Promise<any> {
    try {
      const getLogFromIdKitAndFileName = await FilesRuntimeLog.findOne({
        where: {
          id_kit_runtime: data.guid_kit_runtime || (data as any).id_kit_runtime,
          nome_file: data.nome_file
        },
        order: [['versione', 'DESC']],
        raw: true
      }) as unknown as FileItemKitLog | null;
      if (getLogFromIdKitAndFileName) {
        data.versione = getLogFromIdKitAndFileName.versione + 1;
      }
      const result = await FilesRuntimeLog.create({
        ...data,
        id_kit_runtime: data.guid_kit_runtime || (data as any).id_kit_runtime
      } as any);
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'inserimento del log del file runtime"), {
        message: "Errore durante l'inserimento del log del file runtime",
        operation: 'insertOne',
        entity: 'FileItemKitLog',
        details: { error }
      });
    }
  }

  async getFileRunTimeLogByNomeFileEIdKitRuntime(nomeFile: string, idKitRuntime: string): Promise<FileItemKitLog | null> {
    try {
      const result = await FilesRuntimeLog.findOne({
        where: { nome_file: nomeFile, id_kit_runtime: idKitRuntime },
        raw: true
      }) as unknown as FileItemKitLog | null;
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del log del file"), {
        message: "Errore durante il recupero del log del file",
        operation: 'findOne',
        entity: 'FilesRuntimeLog',
        details: { error }
      });
    }
  }

  async insertNewFileRuntime(data: FileItemKit): Promise<any> {
    try {
      const resultCreazioneCombinazioneDesign = await FilesRuntime.create({
        ...data,
        is_optional: data.isOptional ?? (data as any).is_optional ?? false,
      } as any);
      return resultCreazioneCombinazioneDesign;
    }
    catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'inserimento del file runtime"), {
        message: "Errore durante l'inserimento del file runtime",
        operation: 'insertOne',
        entity: 'FilesRuntime',
        details: { error }
      });
    }
  }

  async updateSingleFileRuntime(data: FileItemKit) {
    try {
      const resultCreazioneCombinazioneDesign = await FilesRuntime.update(
        {
          ...data,
          is_optional: data.isOptional ?? (data as any).is_optional ?? false,
        } as any,
        { where: { id: data.id } }
      );
      return resultCreazioneCombinazioneDesign;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento delle combinazioni di design"), {
        message: "Errore durante l'aggiornamento delle combinazioni di design",
        operation: 'updateOne',
        entity: 'FilesRuntime',
        details: { error }
      });
    }
  }

  async updateSingleFileRuntimeLog(data: FileItemKitLog): Promise<any> {
    try {
      const result = await FilesRuntimeLog.update(
        data as any,
        { where: { id: data.id } }
      );
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento del log del file runtime"), {
        message: "Errore durante l'aggiornamento del log del file runtime",
        operation: 'updateOne',
        entity: 'FilesRuntimeLog',
        details: { error }
      });
    }
  }

  async getKitManualeDaId(id: string): Promise<DESIGN_KIT_MONGO> {
    try {
      const raw = await DesignKit.findOne({
        where: { id },
        raw: true
      });
      return normalizeDesignKitFromPg(raw) as unknown as DESIGN_KIT_MONGO;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento delle combinazioni di design"), {
        message: "Errore durante l'aggiornamento delle combinazioni di design",
        operation: 'find',
        entity: 'DesignKit',
        details: { error }
      });
    }
  }


  /** ──────────────── Private Helpers ──────────────── */

  /**
   * Crea log di pubblicazione per tutti i file di un kit runtime
   * @param idLavorazione ID del kit runtime
   * @param idUtente ID dell'utente che sta pubblicando
   * @param transaction Transazione Sequelize opzionale
   * @private
   */
  private async creaLogPubblicazioneFiles(idLavorazione: string, idUtente: string, transaction?: Transaction): Promise<void> {
    try {
      // Ottieni tutti i file runtime per questo kit
      const filesRuntime = await FilesRuntime.findAll({
        where: { id_runtime: idLavorazione },
        raw: true,
        transaction
      }) as unknown as FileItemKit[];

      if (filesRuntime.length === 0) {
        log.info(`Nessun file runtime trovato per il kit ${idLavorazione}`);
        return;
      }

      // Ottieni tutti i log files esistenti per questo kit
      const logFilesEsistenti = await FilesRuntimeLog.findAll({
        where: { id_kit_runtime: idLavorazione },
        raw: true,
        transaction
      }) as unknown as FileItemKitLog[];

      // Raggruppa i log per nome file e trova la versione massima per ciascuno
      const versioneMaxPerFile = new Map<string, number>();

      logFilesEsistenti.forEach(logFile => {
        const nomeFile = logFile.nome_file;
        const versioneCorrente = logFile.versione || 0;
        const versioneMax = versioneMaxPerFile.get(nomeFile) || 0;

        if (versioneCorrente > versioneMax) {
          versioneMaxPerFile.set(nomeFile, versioneCorrente);
        }
      });

      // Crea i nuovi log di pubblicazione per tutti i file runtime
      const nuoviLogFiles = filesRuntime.map(fileRuntime => {
        const nomeFile = fileRuntime.nome;
        const versioneMax = versioneMaxPerFile.get(nomeFile || '') || 0;

        return {
          id: uuidv4(),
          id_kit_runtime: idLavorazione,
          nome_file: nomeFile,
          data_registrazione: new Date(),
          versione: versioneMax + 1,
          stato: STATO_LOG_FILE.PUBBLICATO,
          logs: [{
            azione: "Accettato",
            messaggio: 'File pubblicato con successo',
            data_notifica: new Date(),
            utente_notifica: idUtente,
            dettagli_aggiuntivi: {
              azione_precedente: versioneMax === 0 ? 'PRIMO_UPLOAD' : 'REVISIONE_COMPLETATA'
            }
          }]
        } as any;
      });

      // Salva tutti i nuovi log in batch
      if (nuoviLogFiles.length > 0) {
        await FilesRuntimeLog.bulkCreate(nuoviLogFiles as any, { transaction });
        log.info(`Creati ${nuoviLogFiles.length} log di pubblicazione per il kit ${idLavorazione}`);
      }

    } catch (error) {
      log.error(`Errore durante la creazione dei log di pubblicazione per il kit ${idLavorazione}:`, error);
      throw wrapDatabaseError(new Error("Errore durante la creazione dei log di pubblicazione"), {
        message: "Errore durante la creazione dei log di pubblicazione",
        operation: 'creaLogPubblicazioneFiles',
        entity: 'FilesRuntimeLog',
        details: { idLavorazione, idUtente, error }
      });
    }
  }
}
