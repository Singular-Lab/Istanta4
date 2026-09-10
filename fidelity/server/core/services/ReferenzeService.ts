import dayjs from 'dayjs';
import { Request as ExpressRequest } from 'express';
import { Op, type WhereOptions } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Colorize } from '../../../lib/Colorize';
import { FieldType } from '../../../lib/enums';
import { DatabaseError, ExternalApiError, NotFoundError, wrapApiError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import {
  ContenutoAggiuntivoReferenza,
  FilterCondition,
  FilterConditionContesto,
  LoghiReferenza,
  PageLayoutItem,
  ReferenzeIstanta
} from '../../../lib/types';
import config from '../config';
import { IReferenzeService } from '../interfaces/IReferenzeService';
import { IWebPliantService } from '../interfaces/IWebPliantService';
import { log } from '../logger';
import { ContenutiAggiuntiviReferenza } from '../models/contenuti_aggiuntivi_referenza';
import { PromoAttributes } from '../models/promo';
import { Referenze } from '../models/referenze';
import { ReferenzeGruppo } from '../models/referenze_gruppo';
import { RuntimeKit } from '../models/runtime_kit';
import { WorkspaceWebpliant } from '../models/workspace_webpliant';
import type { IPromoRepository } from '../repositories/PromoRepository';
import { normalizePromoModel } from '../utils/PromoModelUtils';
import { ServerUtils } from '../utils/ServerUtils';

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

/**
 * ReferenzeServicePg - Autonomous service for referenze operations
 *
 * Handles all referenze-related business logic including:
 * - CRUD operations on referenze
 * - Search and filtering with Sequelize queries
 * - Contenuti aggiuntivi management
 * - ISTANTA API integration (loghi, addestramenti)
 * - Policy-based filtering engine
 */
/** Maps a raw PG referenza (snake_case) to the camelCase shape expected by the client */
function normalizeReferenzaFromPg(raw: any): ReferenzeIstanta {
  const fotoExtra: any[] = Array.isArray(raw.foto_extra)
    ? raw.foto_extra.map((f: any) => ({
        ...f,
        guidId: f.guidId ?? f.guid_id,
      }))
    : (Array.isArray(raw.fotoExtra) ? raw.fotoExtra : []);

  return {
    ...raw,
    // identity fields that may differ
    guidIdKitRuntime: raw.guidIdKitRuntime ?? raw.id_runtime_kit,
    idPromo:          raw.idPromo          ?? raw.id_promo,
    compiledFields:   raw.compiledFields   ?? raw.compiled_fields  ?? [],
    deletedFields:    raw.deletedFields    ?? raw.deleted_fields   ?? [],
    dataFields:       raw.dataFields       ?? raw.data_fields      ?? {},
    groupElements:    raw.groupElements    ?? raw.group_elements   ?? [],
    fotoExtra,
    codiceBox:        raw.codiceBox        ?? raw.codice_box,
    wPage:            raw.wPage            ?? raw.w_page,
    hPage:            raw.hPage            ?? raw.h_page,
    percIngombro:     raw.percIngombro     ?? raw.perc_ingombro,
    aspectRatio:      raw.aspectRatio      ?? raw.aspect_ratio,
    fotoSingolaForzata: raw.fotoSingolaForzata ?? raw.foto_singola_forzata,
    // keep foto as-is (already transformed before calling this function, or left for the caller)
  } as ReferenzeIstanta;
}

export class ReferenzeService implements IReferenzeService {

  constructor(
    private readonly promoRepository: IPromoRepository,
    private readonly webPliantService: IWebPliantService
  ) { }

  // ─── Referenze CRUD ────────────────────────────────────────────────

  async getReferenzaByEAN(ean: string): Promise<ReferenzeIstanta> {
    try {
      const result = await Referenze.findOne({ where: { ean } as any, raw: true });
      if (!result) throw wrapNotFoundError(new Error("Riferimento non trovato"), {
        message: "Riferimento non trovato",
        entityType: "ReferenzeIstanta",
        entityId: ean
      });
      return normalizeReferenzaFromPg(result);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw wrapDatabaseError(new Error("Errore durante il recupero del riferimento"), {
        message: "Errore durante il recupero del riferimento",
        operation: 'get',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  async getAllReferenze(): Promise<ReferenzeIstanta[]> {
    try {
      const referenze = await Referenze.findAll({ raw: true }) as unknown as any[];
      const uniqueReferenze = referenze.filter((ref, index, self) =>
        index === self.findIndex((t) => t.data_fields?.codice_referenza === (ref as any).data_fields?.codice_referenza)
      );
      return uniqueReferenze.map(normalizeReferenzaFromPg);
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle referenze"), {
        message: "Errore durante il recupero delle referenze",
        operation: 'get',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  async getReferenzaById(id: string): Promise<ReferenzeIstanta> {
    try {
      const result = await Referenze.findOne({ where: { id }, raw: true });
      return result ? normalizeReferenzaFromPg(result) : result as unknown as ReferenzeIstanta;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della referenza"), {
        message: "Errore durante la creazione della referenza",
        operation: 'findOne',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  async getReferenzaByCodice(codice: string): Promise<ReferenzeIstanta | null> {
    try {
      const result = await Referenze.findOne({
        where: { data_fields: { codice_referenza: codice } } as any,
        raw: true
      }) as unknown as any | null;

      if (result) {
        result.foto = Array.isArray(result.foto)
          ? result.foto.map((fotoId: string) =>
              `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${fotoId}`
            )
          : [];
      }

      return result ? normalizeReferenzaFromPg(result) : null;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero della referenza"), {
        message: "Errore durante il recupero della referenza",
        operation: 'findOne',
        entity: 'ReferenzeIstanta',
        details: { codice },
      });
    }
  }

  async updateReferenzaWebpliant(data: ReferenzeIstanta): Promise<any> {
    try {
      const result = await Referenze.update(data as any, { where: { id: data.id } });
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della referenza"), {
        message: "Errore durante l'aggiornamento della referenza",
        operation: 'updateOne',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }




  async updateReferenza(id: string, data: ReferenzeIstanta): Promise<any> {
    try {
      const result = await Referenze.update(data as any, { where: { id } });
      return result;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della referenza"), {
        message: "Errore durante la creazione della referenza",
        operation: 'updateOne',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  async bulkCreateReferenze(refs: ReferenzeIstanta[]): Promise<any> {
    try {
      const pgRefs = refs.map(referenzaToSnakeCase);
      const result = await Referenze.bulkCreate(pgRefs);
      return result;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della referenza"), {
        message: "Errore durante la creazione della referenza",
        operation: 'insertMany',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  async bulkEliminateReferenzeFromGuidIdKitRuntime(idKitRuntime: string): Promise<any> {
    try {
      const result = await Referenze.destroy({ where: { id_runtime_kit: idKitRuntime } });
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione delle referenze"), {
        message: "Errore durante l'eliminazione delle referenze",
        operation: 'deleteMany',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  // ─── Ricerca ───────────────────────────────────────────────────────

  async ricercaReferenzePromo(data: { query: string; idWorkspace: string; idArea: string; idCanale: string }): Promise<any[]> {
    try {
      if (!data.query || typeof data.query !== "string") {
        throw wrapDatabaseError(new Error("Query non valida"), {
          message: "Query non valida",
          operation: 'get',
          entity: 'CombinazioniRuntime',
        });
      }

      const searchTerms = data.query.toLowerCase().split(" ");
      let kitRuntime = await this.webPliantService.getReferenzeWebPliant(data.idWorkspace, new Date(), data.idArea, data.idCanale);

      if (!Array.isArray(kitRuntime) || kitRuntime.length === 0) {
        throw wrapNotFoundError(new Error("Nessuna referenza trovata"), {
          message: "Nessuna referenza trovata",
          entityType: "ReferenzeIstanta",
          entityId: data.idWorkspace
        });
      }

      const refsGruppo = await ReferenzeGruppo.findAll({ raw: true }) as unknown as any[];
      const referenze = await Promise.all(
        kitRuntime.flatMap((kit) =>
          kit.webpliant.map(async (ref: any) => {
            ref.foto = ref.foto?.map((f: string) => `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${f}&performante=true`) || [];
            let refGruppo = refsGruppo.find(r => r.codice_referenza === (ref as any).data_fields?.codice_referenza && r.id_area === data.idArea && r.id_canale === data.idCanale);
            if (!refGruppo) {
              refGruppo = refsGruppo.find(r => r.codice_referenza === (ref as any).data_fields?.codice_referenza && r.id_area === undefined && r.id_canale === undefined);
            }
            if (!refGruppo) {
              refGruppo = refsGruppo.find(r => r.codice_referenza === (ref as any).data_fields?.codice_referenza && r.id_area === undefined && r.id_canale === data.idCanale);
            }
            if (!refGruppo) {
              refGruppo = refsGruppo.find(r => r.codice_referenza === (ref as any).data_fields?.codice_referenza && r.id_area === data.idArea && r.id_canale === undefined);
            }
            if (!refGruppo) {
              refGruppo = refsGruppo.find(r => r.codice_referenza === (ref as any).data_fields?.codice_referenza);
            }
            ref.fotoGruppo = refGruppo ? `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${refGruppo.guid_id_olympo}&performante=true` : undefined;
            (ref as any).foto_extra = (ref as any).foto_extra?.map((f: LoghiReferenza) => ({
              ...f,
              guidId: `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${f.guidId}&performante=true`
            })) || [];
            return ref;
          })
        )
      );

      const calculateScore = (ref: any) => {
        let score = 0;
        const fieldsToCheck = [
          { field: "descrizione_uno", exactMatchWeight: 3, partialMatchWeight: 2 },
          { field: "descrizione_due", exactMatchWeight: 3, partialMatchWeight: 0.8 },
          { field: "descrizione_tre", exactMatchWeight: 2, partialMatchWeight: 0.5 },
          { field: "descrizione_peso", exactMatchWeight: 0.8, partialMatchWeight: 0.1 }
        ];

        const checkSimilarity = (searchTerm: string, fieldValue: string) => {
          if (fieldValue === searchTerm) {
            return { isMatch: true, isExact: true };
          }

          if (fieldValue.includes(searchTerm)) {
            return { isMatch: true, isExact: false };
          }

          const minLength = Math.min(searchTerm.length, fieldValue.length);
          const commonPrefix = minLength >= 4 ? searchTerm.substring(0, 4) === fieldValue.substring(0, 4) : false;

          const isPluralOrSingular =
            (searchTerm.endsWith('o') && fieldValue === searchTerm.slice(0, -1) + 'i') ||
            (searchTerm.endsWith('i') && fieldValue === searchTerm.slice(0, -1) + 'o') ||
            (searchTerm.endsWith('a') && fieldValue === searchTerm.slice(0, -1) + 'e') ||
            (searchTerm.endsWith('e') && fieldValue === searchTerm.slice(0, -1) + 'a');

          return {
            isMatch: commonPrefix || isPluralOrSingular,
            isExact: false,
            isSimilar: true
          };
        };

        for (const searchTerm of searchTerms) {
          for (const { field, exactMatchWeight, partialMatchWeight } of fieldsToCheck) {
            const fieldValue = (ref as any).data_fields[field];

            if (typeof fieldValue !== 'string') continue;

            const fieldWords = fieldValue.toLowerCase().split(/\s+/);

            for (const word of fieldWords) {
              const similarity = checkSimilarity(searchTerm, word);

              if (similarity.isMatch) {
                if (similarity.isExact) {
                  score += searchTerm.length * exactMatchWeight;
                } else if (similarity.isSimilar) {
                  score += searchTerm.length * (partialMatchWeight * 0.8);
                } else {
                  score += searchTerm.length * partialMatchWeight;
                }
              }
            }
          }
        }

        return score;
      };

      const results = referenze
        .map(ref => ({ ref: normalizeReferenzaFromPg(ref), score: calculateScore(ref) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      return results;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof DatabaseError) throw error;
      throw wrapDatabaseError(new Error("Errore durante la ricerca delle referenze"), {
        message: "Errore durante la ricerca delle referenze",
        operation: 'get',
        entity: 'ReferenzeIstanta',
        details: { error }
      });
    }
  }

  async getAllReferenzePromoInCorso(filtri: {
    idArea?: string,
    idCanale?: string,
    idPromo?: string,
    data_da?: string,
    data_a?: string,
    sigle_reparto?: string[]
  }): Promise<ReferenzeIstanta[]> {
    try {
      if (filtri === undefined) {
        filtri = {}
      }
      const promoInCorso = await this.promoRepository.findAllWithOptions({
        where: {
          ...(filtri.data_da && { validita_dal: { [Op.lte]: dayjs(filtri.data_da).toDate() } }),
          ...(filtri.data_a && { validita_al: { [Op.gte]: dayjs(filtri.data_a).toDate() } })
        } as WhereOptions<PromoAttributes>
      });
      const promoIdsInCorso = promoInCorso.map((promo) => normalizePromoModel(promo).id_promo);
      const kitRuntime = await RuntimeKit.findAll({
        where: { id_promo: { [Op.in]: promoIdsInCorso } },
        raw: true
      }) as unknown as any[];
      if (kitRuntime.length === 0) {
        return []
      }
      let referenze = await Referenze.findAll({
        where: {
          id_runtime_kit: { [Op.in]: kitRuntime.map((kit) => kit.id) },
          ...(filtri.idArea && { id_area: filtri.idArea } as any),
          ...(filtri.idCanale && { id_canale: filtri.idCanale } as any)
        },
        raw: true
      }) as any[];
      if (referenze.length === 0) {
        return []
      }
      if (filtri.sigle_reparto) {
        referenze = referenze.filter((referenza) => {
          return filtri.sigle_reparto?.includes((referenza as any).data_fields["reparto"] as string)
        })
      }
      return referenze.map(normalizeReferenzaFromPg);
    } catch (error) {
      throw new DatabaseError({
        message: "Errore durante il recupero delle referenze delle promozioni in corso",
        operation: 'get',
        entity: 'ReferenzeIstanta',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getFilteredReferenze(
    idWorkspace: string,
    dataSelezionata: Date,
    idArea: string | undefined,
    idCanale: string | undefined,
    idPV: string | undefined,
    item: PageLayoutItem,
    isEditor: boolean
  ): Promise<ReferenzeIstanta[]> {
    try {
      // Step 1: Verifica esistenza workspace
      const workspace = await WorkspaceWebpliant.findOne({ where: { id: idWorkspace }, raw: true });
      if (!workspace) {
        throw new NotFoundError({
          message: "Workspace non trovato",
          entityType: "WorkspaceDataWebPliant",
          entityId: idWorkspace
        });
      }

      // Step 2: Ottieni le promo valide da Sequelize
      const promoValide = await this.promoRepository.findAllWithOptions({
        where: {
          validita_dal: { [Op.lte]: dataSelezionata },
          validita_al: { [Op.gte]: dataSelezionata }
        } as WhereOptions<PromoAttributes>,
        attributes: ['id_promo', 'validita_dal', 'validita_al', 'offset_visibilita']
      });

      if (promoValide.length === 0) {
        return [];
      }

      const promoIds = promoValide.map(promo => normalizePromoModel(promo).id_promo);

      // Step 3: Ottieni i kit runtime per area/canale
      const kitRuntimeWhere: any = {
        id_promo: { [Op.in]: promoIds },
        ...(idArea && { id_area: idArea }),
        ...(idCanale && { id_canale: idCanale })
      };
      const kitRuntimeList = await RuntimeKit.findAll({ where: kitRuntimeWhere, raw: true });

      if (kitRuntimeList.length === 0) {
        return [];
      }

      const kitRuntimeIds = kitRuntimeList.map((kit: any) => kit.id);

      // Step 4: Ottieni le referenze per i kit runtime trovati
      const referenzeWhere: any = {
        id_runtime_kit: { [Op.in]: kitRuntimeIds },
        id_promo: { [Op.in]: promoIds }
      };

      let referenze = await Referenze.findAll({ where: referenzeWhere, raw: true }) as unknown as ReferenzeIstanta[];

      // Step 5: Applica filtri contesto se presenti (in JS)
      if (item.content?.filtriContesto) {
        referenze = this.applyContestoFilters(referenze, item.content.filtriContesto);
      }

      // Step 6: Applica filtri nuovi se presenti (in JS)
      if (item.content?.filtersNew) {
        referenze = this.applyFiltersNew(referenze, item.content.filtersNew);
      }

      // Step 7: Applica filtri policy contenuto (in JS)
      referenze = this.applyPolicyFilters(referenze, item, idArea, idCanale, idPV);

      // Step 8: Deduplicazione per codice_referenza
      const seen = new Set<string>();
      referenze = referenze.filter((ref) => {
        const codice = (ref as any).data_fields?.codice_referenza;
        if (codice === undefined || codice === null) return true;
        if (seen.has(String(codice))) return false;
        seen.add(String(codice));
        return true;
      });

      // Step 9: Trasforma le foto e normalizza i campi per il client
      referenze = referenze.map((ref) => {
        const raw = ref as any;
        const fotoTransformed = Array.isArray(raw.foto)
          ? raw.foto.map((f: string) =>
              `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${f}&performante=true`
            )
          : [];
        const fotoExtraTransformed = Array.isArray(raw.foto_extra)
          ? raw.foto_extra.map((f: any) => ({
              ...f,
              guidId: `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${f.guid_id ?? f.guidId}&performante=true`,
              sigla: f.sigla,
              tipo: f.tipo,
            }))
          : (Array.isArray(raw.fotoExtra) ? raw.fotoExtra : []);
        return normalizeReferenzaFromPg({ ...raw, foto: fotoTransformed, foto_extra: fotoExtraTransformed });
      });

      // Step 10: Limita risultati se editor
      if (isEditor) {
        referenze = referenze.slice(0, 20);
      }

      log.info(`Referenze filtrate trovate: ${referenze.length}`);
      return referenze;

    } catch (error) {
      log.error('Errore nella pipeline getFilteredReferenze', {
        error: error instanceof Error ? error.message : 'Unknown error',
        idWorkspace,
        idArea,
        idCanale
      });
      throw error;
    }
  }

  // ─── Loghi e Immagini ─────────────────────────────────────────────

  async getAllLoghiDaReferenze(req: ExpressRequest): Promise<LoghiReferenza[]> {
    try {
      const resultDaIstantaPerLoghi = await ServerUtils.sendToFICOApi<{
        esito: boolean,
        content: {
          id: string;
          nome: string;
          guidId: string;
          sigla: string;
          dataModifica: string;
          tipo: number;
          escluso: boolean;
        }[];
      }>(
        req,
        config.ISTANTA_IP_ADDRESS + "/FicoProcess/getLoghiBolli",
        "GET",
        {},
      );

      if (!resultDaIstantaPerLoghi || !resultDaIstantaPerLoghi.data) {
        throw wrapNotFoundError(new Error("Nessun logo trovato"), {
          message: "Nessun logo trovato",
          entityType: "LoghiReferenza",
          entityId: ""
        });
      }

      if (resultDaIstantaPerLoghi.data.content.length === 0) {
        throw wrapNotFoundError(new Error("Nessun logo trovato"), {
          message: "Nessun logo trovato",
          entityType: "LoghiReferenza",
          entityId: ""
        });
      }

      return resultDaIstantaPerLoghi.data.content.map(r => ({
        guidId: config.OLYMPUS_IP_ADDRESS + "/foto/getThumbNailOnDemand?guidId=" + r.guidId,
        sigla: r.sigla,
        tipo: r.tipo,
      }));

    } catch (error) {
      console.error('Errore durante il recupero dei loghi:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero dei loghi"), {
        message: "Errore durante il recupero dei loghi",
        operation: 'get',
        entity: 'LoghiReferenza',
        details: { error }
      });
    }
  }

  async resolveImmaginiGruppo(): Promise<any> {
    try {
      const resultAllRefsConGruppo = await Referenze.findAll({ raw: true }) as unknown as ReferenzeIstanta[];
      if (!resultAllRefsConGruppo || resultAllRefsConGruppo.length === 0) {
        throw wrapNotFoundError(new Error("Nessuna referenza con foto di gruppo trovata"), {
          message: "Nessuna referenza con foto di gruppo trovata",
          entityType: "ReferenzeIstanta",
          entityId: "all"
        });
      }

      log.debug(`Trovate ${resultAllRefsConGruppo.length} referenze con potenziali foto di gruppo`);

      const results: { codiceReferenza: string, inserted: boolean }[] = [];
      for (const r of resultAllRefsConGruppo) {
        const fotoGruppo = (r as any).fotoGruppo;
        if (fotoGruppo !== undefined && fotoGruppo !== null) {
          const inserimentoResult = await ReferenzeGruppo.create({
            id: uuidv4(),
            guid_id_olympo: fotoGruppo,
            codice_referenza: (r as any).data_fields?.codice_referenza
          } as any);

          results.push({
            codiceReferenza: (r as any).data_fields?.codice_referenza as string,
            inserted: !!inserimentoResult
          });
        }
      }

      return {
        totalProcessed: resultAllRefsConGruppo.length,
        inserted: results.filter(r => r.inserted).length,
        details: results
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante la risoluzione delle immagini di gruppo"), {
          message: "Errore durante la risoluzione delle immagini di gruppo",
          operation: 'create',
          entity: 'ReferenzeGruppo',
          details: { error }
        });
      }
    }
  }

  // ─── Contenuti Aggiuntivi ─────────────────────────────────────────

  async creaContenutiAggiuntiviReferenza(data: ContenutoAggiuntivoReferenza): Promise<boolean> {
    try {
      if (!data.guidId) {
        data.guidId = uuidv4();
        const result = await ContenutiAggiuntiviReferenza.create({
          id: data.guidId,
          ...(data as any)
        });
        return !!result;
      } else {
        delete (data as any)._id;
        const [affectedCount] = await ContenutiAggiuntiviReferenza.update(
          data as any,
          { where: { id: data.guidId } }
        );
        return affectedCount === 1;
      }
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la creazione/aggiornamento dei contenuti aggiuntivi"), {
        message: "Errore durante la creazione/aggiornamento dei contenuti aggiuntivi",
        operation: 'create',
        entity: 'ContenutoAggiuntivoReferenza',
        details: { error }
      });
    }
  }

  async getAllContenutiAggiuntivi(): Promise<ContenutoAggiuntivoReferenza[]> {
    try {
      const contenuti = await ContenutiAggiuntiviReferenza.findAll({ raw: true }) as unknown as ContenutoAggiuntivoReferenza[];
      return contenuti;
    } catch (error) {
      console.error('Errore durante il recupero dei contenuti aggiuntivi:', error);
      throw wrapDatabaseError(new Error("Errore durante il recupero dei contenuti aggiuntivi"), {
        message: "Errore durante il recupero dei contenuti aggiuntivi",
        operation: 'get',
        entity: 'ContenutoAggiuntivoReferenza',
        details: { error }
      });
    }
  }

  async getContenutiAggiuntiviDaRegolePerReferenza(referenza: ReferenzeIstanta): Promise<ContenutoAggiuntivoReferenza[]> {
    try {
      const allContenuti = await this.getAllContenutiAggiuntivi();
      if (Array.isArray(allContenuti)) {
        const contenutiScelti = allContenuti.filter((contenuto) => {
          if (contenuto.regole && contenuto.regole.length > 0) {
            for (const regola of contenuto.regole) {
              // First check if we're dealing with the special "loghi" field
              if (regola.field === "loghi") {
                const logo = (referenza as any).foto_extra.find((f: any) => (f.guidId ?? f.guid_id) === regola.value);
                if (logo) {
                  return true;
                }
                return false;
              }
              // For normal fields in data_fields
              else if ((referenza as any).data_fields[regola.field] !== undefined) {
                const fieldValue = (referenza as any).data_fields[regola.field];
                const ruleValue = regola.value;

                // Handle array comparisons
                if (Array.isArray(fieldValue)) {
                  switch (regola.operator) {
                    case "equal":
                      // For arrays, check if arrays are identical or if item exists in array
                      if (Array.isArray(ruleValue)) {
                        // Compare two arrays
                        return JSON.stringify(fieldValue.sort()) === JSON.stringify(ruleValue.sort());
                      } else {
                        // Check if single value exists in array
                        return fieldValue.includes(ruleValue);
                      }
                    case "not-equal":
                      if (Array.isArray(ruleValue)) {
                        return JSON.stringify(fieldValue.sort()) !== JSON.stringify(ruleValue.sort());
                      } else {
                        return !fieldValue.includes(ruleValue);
                      }
                    case "contains":
                      // Check if array contains the item
                      return fieldValue.includes(ruleValue);
                    default:
                      // Other operators don't make sense for arrays
                      return false;
                  }
                }
                // Handle numeric comparisons
                else if (typeof fieldValue === 'number' || !isNaN(Number(fieldValue))) {
                  const numFieldValue = Number(fieldValue);
                  const numRuleValue = Number(ruleValue);

                  switch (regola.operator) {
                    case "equal":
                      return numFieldValue === numRuleValue;
                    case "not-equal":
                      return numFieldValue !== numRuleValue;
                    case "greater-than":
                      return numFieldValue > numRuleValue;
                    case "less-than":
                      return numFieldValue < numRuleValue;
                    default:
                      // String operations don't apply to numbers
                      return false;
                  }
                }
                // Handle string comparisons
                else if (typeof fieldValue === 'string') {
                  const strFieldValue = String(fieldValue);
                  const strRuleValue = String(ruleValue);

                  switch (regola.operator) {
                    case "equal":
                      return strFieldValue === strRuleValue;
                    case "not-equal":
                      return strFieldValue !== strRuleValue;
                    case "greater-than":
                      return strFieldValue > strRuleValue;
                    case "less-than":
                      return strFieldValue < strRuleValue;
                    case "contains":
                      return strFieldValue.includes(strRuleValue);
                    case "startsWith":
                      return strFieldValue.startsWith(strRuleValue);
                    case "endsWith":
                      return strFieldValue.endsWith(strRuleValue);
                    default:
                      return false;
                  }
                }
                // Handle boolean values
                else if (typeof fieldValue === 'boolean') {
                  // Convert rule value to boolean for comparison
                  const boolRuleValue = Boolean(ruleValue) === true || ruleValue === 'true';

                  switch (regola.operator) {
                    case "equal":
                      return fieldValue === boolRuleValue;
                    case "not-equal":
                      return fieldValue !== boolRuleValue;
                    default:
                      // Other operations don't make sense for booleans
                      return false;
                  }
                }
                // Default case if type is not handled
                return false;
              }
            }
          }
          return false;
        });
        return contenutiScelti;
      }
      return [];
    } catch (error) {
      console.error('Errore durante il recupero dei contenuti aggiuntivi:', error);
      throw wrapDatabaseError(new Error("Errore durante il recupero dei contenuti aggiuntivi"), {
        message: "Errore durante il recupero dei contenuti aggiuntivi",
        operation: 'get',
        entity: 'ContenutoAggiuntivoReferenza',
        details: { error }
      });
    }
  }

  // ─── ISTANTA & WebPliant data ─────────────────────────────────────

  async getAddestramentiDaIstanta(req: ExpressRequest): Promise<any[]> {
    try {
      const result = await ServerUtils.sendToFICOApi
        <{
          content: {
            nome: string, id: number, fields: {
              idAddestramento: number,
              idCampo: number,
              indice: number,
              nomeColonna: string,
              nomeColonnaOriginale: string,
              nomeVisualizzato: string
            }[]
          }[], esito: boolean, error: string
        }>
        (req, `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getAddestramenti/true`, 'GET', undefined);
      if (!result.data.esito) {
        throw wrapApiError(new Error(result.data.error), {
          message: result.data.error,
          service: 'ISTANTA',
          endpoint: '/FicoProcess/getAllAddestramenti'
        });
      }
      return result.data.content;
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante il recupero degli addestramenti:'), error);
      if (error instanceof ExternalApiError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero degli addestramenti"), {
        message: "Errore durante il recupero degli addestramenti",
        operation: 'sendToFICOApi',
        entity: 'ServerUtils',
        details: { error }
      });
    }
  }

  async getDatiPerWebPliantDisponibili(): Promise<any[]> {
    try {
      const kit = await RuntimeKit.findAll({ where: { files_data: { [Op.ne]: null } } as any, raw: true });
      return kit;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei dati webpliant"), {
        message: "Errore durante il recupero dei dati webpliant",
        operation: 'find',
        entity: 'KitRunTimeModel',
        details: { error }
      });
    }
  }

  // ─── In-Memory Filter Helpers (private) ───────────────────────────
  // These replace the MongoDB aggregation pipeline filters, applying them
  // in JavaScript after fetching data from PostgreSQL.

  private applyFiltersNew(referenze: ReferenzeIstanta[], filters: Array<FilterCondition[]>): ReferenzeIstanta[] {
    if (!filters || filters.length === 0) return referenze;

    return referenze.filter((ref) => {
      // OR across filter groups
      return filters.some((filterGroup) => {
        if (!filterGroup || filterGroup.length === 0) return false;
        // AND within a filter group
        return filterGroup.every((filter) => {
          const fieldValue = (ref as any).data_fields?.[filter.field.toLowerCase().trim()];
          return this.evaluateSingleFilter(fieldValue, filter);
        });
      });
    });
  }

  private applyContestoFilters(referenze: ReferenzeIstanta[], filters: FilterConditionContesto[]): ReferenzeIstanta[] {
    if (!filters || filters.length === 0) return referenze;

    // Group filters by field name (same as MongoDB groupedFilters logic)
    const groupedFilters = filters.reduce((accumulator: any, filter: FilterConditionContesto) => {
      const fieldName = filter.nome_field.toLowerCase().trim();
      if (!accumulator[fieldName]) {
        accumulator[fieldName] = [];
      }
      accumulator[fieldName].push(filter);
      return accumulator;
    }, {});

    return referenze.filter((ref) => {
      // AND across field groups
      return Object.keys(groupedFilters).every((fieldName) => {
        const fieldFilters = groupedFilters[fieldName] as FilterConditionContesto[];
        // OR within field group
        return fieldFilters.some((filter) => {
          return this.evaluateContestoFilter(ref, fieldName, filter);
        });
      });
    });
  }

  private evaluateContestoFilter(ref: ReferenzeIstanta, fieldName: string, filter: FilterConditionContesto): boolean {
    const filterValue = typeof filter.user_value === 'string'
      ? filter.user_value.toLowerCase().trim()
      : filter.user_value;

    const getContextValue = (contextArray: any[], nome_field: string) => {
      if (!Array.isArray(contextArray)) return undefined;
      const entry = contextArray.find((e: any) =>
        e.nome_field?.toLowerCase() === nome_field.toLowerCase()
      );
      return entry?.user_value;
    };

    const contextPromo = (ref as any).data_fields?.context_promo;
    const contextTracciato = (ref as any).data_fields?.context_tracciato;

    const promoValue = getContextValue(contextPromo, fieldName);
    const tracciatoValue = getContextValue(contextTracciato, fieldName);

    switch (filter.operator) {
      case 'equals':
        return promoValue === filterValue || tracciatoValue === filterValue;
      case 'not_equals':
        return promoValue !== filterValue && tracciatoValue !== filterValue;
      case 'greater_than': {
        const converted = this.convertFilterValue(String(filterValue));
        return (promoValue !== undefined && promoValue > converted) ||
          (tracciatoValue !== undefined && tracciatoValue > converted);
      }
      case 'less_than': {
        const converted = this.convertFilterValue(String(filterValue));
        return (promoValue !== undefined && promoValue < converted) ||
          (tracciatoValue !== undefined && tracciatoValue < converted);
      }
      default:
        log.warn(`Operatore contesto non supportato: ${filter.operator}`);
        return false;
    }
  }

  private applyPolicyFilters(
    referenze: ReferenzeIstanta[],
    item: PageLayoutItem,
    idArea: string | undefined,
    idCanale: string | undefined,
    idPV: string | undefined
  ): ReferenzeIstanta[] {
    if (!item?.policy || item.policy.locked === false) {
      return referenze;
    }

    const visualizzazione = item.policy.visualizzazione;
    if (!visualizzazione || visualizzazione.length === 0) {
      return referenze;
    }

    return referenze.filter((ref) => {
      return visualizzazione.every((condition: any) => {
        let passesInclusione = true;
        let passesEsclusione = true;

        if (condition.inclusione && condition.inclusione.length > 0) {
          passesInclusione = condition.inclusione.every((inclusione: any) => {
            return this.evaluatePolicyInclusione(ref, inclusione, idArea, idCanale, idPV);
          });
        }

        if (condition.esclusione && condition.esclusione.length > 0) {
          passesEsclusione = condition.esclusione.every((esclusione: any) => {
            return this.evaluatePolicyEsclusione(ref, esclusione, idArea, idCanale, idPV);
          });
        }

        return passesInclusione && passesEsclusione;
      });
    });
  }

  private evaluatePolicyInclusione(
    ref: ReferenzeIstanta,
    inclusione: any,
    idArea: string | undefined,
    idCanale: string | undefined,
    idPV: string | undefined
  ): boolean {
    switch (inclusione.tipo) {
      case FieldType.AREA:
        return idArea ? (ref as any).data_fields?.area === idArea : true;
      case FieldType.CANALE:
        return idCanale ? (ref as any).data_fields?.canale === idCanale : true;
      case FieldType.PUNTO_VENDITA:
        return idPV ? (ref as any).data_fields?.punto_vendita === idPV : true;
      default:
        return true;
    }
  }

  private evaluatePolicyEsclusione(
    ref: ReferenzeIstanta,
    esclusione: any,
    idArea: string | undefined,
    idCanale: string | undefined,
    idPV: string | undefined
  ): boolean {
    switch (esclusione.tipo) {
      case FieldType.AREA:
        return idArea ? (ref as any).data_fields?.area !== idArea : true;
      case FieldType.CANALE:
        return idCanale ? (ref as any).data_fields?.canale !== idCanale : true;
      case FieldType.PUNTO_VENDITA:
        return idPV ? (ref as any).data_fields?.punto_vendita !== idPV : true;
      default:
        return true;
    }
  }

  private evaluateSingleFilter(fieldValue: any, filter: FilterCondition): boolean {
    switch (filter.operator) {
      case 'equals':
        return fieldValue === this.convertFilterValue(filter.value);

      case 'not_equals':
        return fieldValue !== this.convertFilterValue(filter.value);

      case 'greater_than':
        return fieldValue > this.convertFilterValue(filter.value);

      case 'less_than':
        return fieldValue < this.convertFilterValue(filter.value);

      case 'contains':
        return typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(filter.value.toLowerCase());

      case 'not_contains':
        return typeof fieldValue !== 'string' ||
          !fieldValue.toLowerCase().includes(filter.value.toLowerCase());

      case 'in': {
        const values = filter.value.split(',').map((v: string) => v.trim());
        return values.map((v: string) => this.convertFilterValue(v)).includes(fieldValue);
      }

      case 'not_in': {
        const excludeValues = filter.value.split(',').map((v: string) => v.trim());
        return !excludeValues.map((v: string) => this.convertFilterValue(v)).includes(fieldValue);
      }

      default:
        log.warn(`Operatore non supportato: ${filter.operator}`);
        return false;
    }
  }

  private convertFilterValue(value: string): any {
    // Conversione boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Conversione numerica
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }

    // Mantieni come stringa
    return value;
  }

  private convertBooleanString(value: any): any {
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true') return true;
      if (lowerValue === 'false') return false;
    }
    return value;
  }
}
