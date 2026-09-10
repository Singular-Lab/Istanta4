
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import * as crypto from "node:crypto";
import { Op, QueryTypes } from 'sequelize';
import { EXPORT_DI_SISTEMA } from '../../../lib/enums';
import { BadRequestError, NotFoundError, ValidationError } from '../../../lib/errors';
import { ReferenzeIstanta } from '../../../lib/types';
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { FilterConditionDTO, FilterTemplateDTO, PromoResponseDTO } from '../dto';
import { GetCssResponseDTO, GetRefsHtmlResponseDTO, IExternalApiService } from '../interfaces/IExternalApiService';
import { log } from '../logger';
import { TipiDiExport, UtentiGDO } from '../models';
import { DesignKit } from '../models/design_kit';
import { FilesRuntime } from '../models/files_runtime';
import FilterTemplate, { type FilterTemplateAttributes } from '../models/filter_template';
import { Promo } from '../models/promo';
import { RuntimeKit } from '../models/runtime_kit';
import { RuoloUtenteGDO } from '../models/ruolo_gdo';
import { ConfigService } from './ConfigService';
import { referenzeHtmlService } from './ReferenzeHtmlService';
dayjs.extend(isBetween);

// DTO per la risposta getRefs
interface KitRuntimeSummaryDTO {
  id_kit: string;
  id_template: string;
  id_promo: string;
  referenze: ReferenzeIstanta[];
}

interface PromoWithKitsDTO {
  id_promo: string;
  nome_promo: string;
  validita_dal: Date;
  validita_al: Date;
  kit: KitRuntimeSummaryDTO[];
}

interface GetRefsResponseDTO {
  conteggio: number;
  risposta: PromoWithKitsDTO[];
  timestamp: string;
  filtri_applicati: number;
  gruppi_filtri: number[];
  template_richiesti: number;
  template_trovati: number;
  kit_design_trovati: number;
  kit_runtime_trovati: number;
  promo_valide: number;
  flusso_pipeline: {
    template: number;
    design: number;
    runtime: number;
    referenze: number;
  };
}

/** Riga raw ritornata dal JOIN unico di _fetchReferenzeWithPipeline */
interface RawReferenzaRow {
  id: string;
  compiled_fields: any;
  deleted_fields: string[];
  foto: string[];
  meccanica: string;
  codice_box: string;
  foto_extra: any[];
  data_fields: any;
  group_elements: any[];
  id_runtime_kit: string;
  id_promo: string;
  pag?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  w_page?: number;
  h_page?: number;
  perc_ingombro?: number;
  aspect_ratio?: number;
  createdAt: Date;
  updatedAt: Date;
  // Campi aggiunti dal JOIN
  nome_promo: string;
  validita_dal: Date;
  validita_al: Date;
  kit_design_trovati: number;
  kit_runtime_trovati: number;
  promo_valide: number;
}

export class ExternalApiService implements IExternalApiService {

  constructor() {
    // Inizializzazione del servizio
  }

  // ─── Helpers sicuri per JSONB SQL ──────────────────────────────────────

  /**
   * Valida che un nome campo JSONB sia sicuro da usare in SQL (no injection)
   */
  private isSafeFieldName(field: string): boolean {
    return /^[a-zA-Z0-9_\-]+$/.test(field.trim());
  }

  /**
   * Traduce FilterConditionDTO[][] in un frammento SQL sicuro per JSONB.
   * I gruppi sono uniti con OR (basta che uno dei gruppi faccia match).
   * Dentro ogni gruppo le condizioni sono AND.
   *
   * Ritorna { whereSql, params } — whereSql inizia con "AND (" se non vuoto.
   */
  private buildJsonbSqlFilters(
    filters: Array<FilterConditionDTO[]>,
    jsonbCol: string
  ): { whereSql: string; params: Record<string, any> } {
    if (!filters || filters.length === 0) {
      return { whereSql: '', params: {} };
    }

    const params: Record<string, any> = {};
    let paramIdx = 0;
    const groupSqlParts: string[] = [];

    for (const group of filters) {
      if (!group || group.length === 0) continue;

      const condSqlParts: string[] = [];

      for (const f of group) {
        if (
          !f.field || !f.field.trim() ||
          !f.operator ||
          f.value === undefined || f.value === null
        ) continue;

        const field = f.field.toLowerCase().trim();
        if (!this.isSafeFieldName(field)) {
          log.warn(`[buildJsonbSqlFilters] Campo non sicuro ignorato: "${field}"`);
          continue;
        }

        const colPath = `"${jsonbCol}"->>'${field}'`;
        const pKey = `p${paramIdx++}`;

        let condSql: string | null = null;

        switch (f.operator) {
          case 'equals':
            params[pKey] = String(f.value);
            condSql = `(${colPath} = :${pKey})`;
            break;
          case 'not_equals':
            params[pKey] = String(f.value);
            condSql = `(${colPath} != :${pKey} OR ${colPath} IS NULL)`;
            break;
          case 'greater_than': {
            const numVal = Number(f.value);
            if (!isNaN(numVal)) {
              params[pKey] = numVal;
              condSql = `((${colPath})::float > :${pKey})`;
            }
            break;
          }
          case 'less_than': {
            const numValLt = Number(f.value);
            if (!isNaN(numValLt)) {
              params[pKey] = numValLt;
              condSql = `((${colPath})::float < :${pKey})`;
            }
            break;
          }
          case 'contains':
            params[pKey] = `%${f.value}%`;
            condSql = `(${colPath} ILIKE :${pKey})`;
            break;
          case 'not_contains':
            params[pKey] = `%${f.value}%`;
            condSql = `(${colPath} NOT ILIKE :${pKey} OR ${colPath} IS NULL)`;
            break;
          case 'in': {
            const arrIn = f.value.split(',').map(v => v.trim()).filter(Boolean);
            if (arrIn.length > 0) {
              params[pKey] = arrIn;
              // Sequelize replacements espande array come CSV — IN (...) è la forma corretta
              condSql = `(${colPath} IN (:${pKey}))`;
            }
            break;
          }
          case 'not_in': {
            const arrNin = f.value.split(',').map(v => v.trim()).filter(Boolean);
            if (arrNin.length > 0) {
              params[pKey] = arrNin;
              condSql = `(${colPath} NOT IN (:${pKey}) OR ${colPath} IS NULL)`;
            }
            break;
          }
          default:
            log.warn(`[buildJsonbSqlFilters] Operatore non supportato: ${f.operator}`);
        }

        if (condSql) condSqlParts.push(condSql);
      }

      if (condSqlParts.length > 0) {
        groupSqlParts.push(`(${condSqlParts.join(' AND ')})`);
      }
    }

    if (groupSqlParts.length === 0) {
      return { whereSql: '', params: {} };
    }

    return {
      whereSql: `AND (${groupSqlParts.join(' OR ')})`,
      params
    };
  }

  /**
   * Calcola il _matchPriority per ogni referenza in base ai gruppi di filtri.
   * Priorità = priorità massima del primo gruppo che fa match (logica OR tra gruppi, AND dentro gruppo).
   */
  private computeMatchPriority(
    ref: any,
    filters: Array<FilterConditionDTO[]>
  ): number {
    if (!filters || filters.length === 0) return 0;

    const groupsWithPriority = filters
      .filter(g => g && g.length > 0)
      .map(g => ({
        filters: g,
        priority: Math.max(...g.map(f => f.priority ?? 0))
      }))
      .filter(g => g.priority > 0)
      .sort((a, b) => b.priority - a.priority);

    for (const { filters: groupFilters, priority } of groupsWithPriority) {
      if (this.matchesFiltersGroupJs(ref, groupFilters, 'data_fields')) {
        return priority;
      }
    }
    return 0;
  }

  /**
   * Verifica se un oggetto corrisponde a un gruppo di filtri (AND logic dentro il gruppo)
   * Usato SOLO per calcolare il _matchPriority dopo il fetch DB (dataset già filtrato).
   */
  private matchesFiltersGroupJs(obj: any, filters: FilterConditionDTO[], baseField: string): boolean {
    return filters.every(filter => {
      if (!filter.field || !filter.field.trim() || !filter.operator || filter.value === undefined || filter.value === null) {
        return true;
      }
      const fieldPath = `${baseField}.${filter.field.toLowerCase().trim()}`;
      const fieldValue = this.getNestedFieldValue(obj, fieldPath);
      return this.matchesFilterJs(fieldValue, filter);
    });
  }

  /**
   * Recupera il valore di un campo annidato con notazione puntata
   */
  private getNestedFieldValue(obj: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Converte il valore del filtro nel tipo appropriato
   */
  private convertFilterValue(value: string): any {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    if (!isNaN(Number(value)) && value.trim() !== '') return Number(value);
    return value;
  }

  /**
   * Verifica se un valore soddisfa un FilterConditionDTO in JS
   */
  private matchesFilterJs(fieldValue: any, filter: FilterConditionDTO): boolean {
    const value = this.convertFilterValue(filter.value);
    switch (filter.operator) {
      case 'equals': return fieldValue === value;
      case 'not_equals': return fieldValue !== value;
      case 'greater_than': return fieldValue > value;
      case 'less_than': return fieldValue < value;
      case 'contains': return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(filter.value).toLowerCase());
      case 'not_contains': return typeof fieldValue !== 'string' || !fieldValue.toLowerCase().includes(String(filter.value).toLowerCase());
      case 'in': {
        const inVals = filter.value.split(',').map(v => this.convertFilterValue(v.trim()));
        return inVals.includes(fieldValue);
      }
      case 'not_in': {
        const notInVals = filter.value.split(',').map(v => this.convertFilterValue(v.trim()));
        return !notInVals.includes(fieldValue);
      }
      default: return true;
    }
  }

  /**
   * Rimuove tag HTML e normalizza il testo
   */
  private stripHtmlTags(text: string): string {
    if (typeof text !== 'string') return String(text ?? '');
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Costruisce l'URL OLYMPUS per un GUID o restituisce l'URL già formato così com'è.
   * Gestisce sia GUID puri ('6bbf4a46-...') sia URL legacy già completi ('https://...olimpoGUID').
   */
  private buildOlympusUrl(guidOrUrl: string): string {
    if (typeof guidOrUrl === 'string' && guidOrUrl.startsWith('http')) {
      return guidOrUrl; // già URL completo (migrazione da MongoDB)
    }
    return `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?performante=true&guidId=${guidOrUrl}`;
  }

  /**
   * Mappa le foto di una referenza raw PG agli URL OLYMPUS.
   * Gestisce sia GUID puri sia URL legacy già formati (migrazione MongoDB → PG).
   */
  private mapFotoToUrls(ref: RawReferenzaRow): ReferenzeIstanta {
    // fotoExtra: normalizza guid_id → guidId e costruisce URL OLYMPUS per ogni logo/bollo
    const fotoExtra: any[] = Array.isArray(ref.foto_extra)
      ? ref.foto_extra.map((f: any) => {
        const rawGuidId = f.guidId ?? f.guid_id ?? '';
        return {
          tipo: f.tipo,
          sigla: f.sigla,
          guidId: this.buildOlympusUrl(rawGuidId),
        };
      })
      : [];

    return {
      ...ref,
      // Normalizzazione snake_case → camelCase
      guidIdKitRuntime: ref.id_runtime_kit,
      idPromo: ref.id_promo,
      compiledFields: ref.compiled_fields ?? [],
      deletedFields: ref.deleted_fields ?? [],
      dataFields: ref.data_fields ?? {},
      groupElements: ref.group_elements ?? [],
      fotoExtra,
      codiceBox: ref.codice_box,
      wPage: ref.w_page,
      hPage: ref.h_page,
      percIngombro: ref.perc_ingombro,
      aspectRatio: ref.aspect_ratio,
      // Mappa foto → URL Olympus (gestisce GUID puri e URL legacy già formati)
      foto: Array.isArray(ref.foto)
        ? ref.foto.map((fotoItem: any) => {
          const rawGuidId = fotoItem?.guidId ?? fotoItem;
          return this.buildOlympusUrl(String(rawGuidId));
        })
        : [],
    } as unknown as ReferenzeIstanta;
  }

  // ─── Pipeline referenze principale ─────────────────────────────────────

  /**
   * Esegue il JOIN unico Promo → RuntimeKit → DesignKit → RaccoglitoreKit → Referenze
   * con filtri JSONB su data_fields applicati direttamente in PostgreSQL.
   *
   * Ritorna le righe raw con metadati promo inline + contatori pipeline.
   */
  private async _fetchReferenzeWithPipeline(params: {
    templateIds: string[];
    filters?: Array<FilterConditionDTO[]>;
    skipValidityCheck?: boolean;
  }): Promise<{
    rows: RawReferenzaRow[];
    kitDesignTrovati: number;
    kitRuntimeTrovati: number;
    promoValide: number;
  }> {
    const { templateIds, filters, skipValidityCheck } = params;

    const { whereSql: jsonbWhereSql, params: jsonbParams } = this.buildJsonbSqlFilters(
      filters ?? [],
      'data_fields'
    );

    const validityClause = skipValidityCheck
      ? '1=1'
      : `p.validita_dal <= NOW() AND p.validita_al >= NOW()`;

    const sql = `
      WITH kit_chain AS (
        SELECT
          rk.id            AS runtime_kit_id,
          dk.id            AS kit_design_id,
          p.id_promo,
          p.nome_promo,
          p.validita_dal,
          p.validita_al
        FROM raccoglitore_kit rak
        JOIN design_kit      dk ON dk.id_raccoglitore = rak.id
        JOIN runtime_kit     rk ON rk.id_design = dk.id
        JOIN promo           p  ON p.id_promo = rk.id_promo
        WHERE rak.id IN (:templateIds)
          AND (${validityClause})
      ),
      pipeline_counts AS (
        SELECT
          COUNT(DISTINCT kit_design_id)   AS kit_design_trovati,
          COUNT(DISTINCT runtime_kit_id)  AS kit_runtime_trovati,
          COUNT(DISTINCT id_promo)        AS promo_valide
        FROM kit_chain
      )
      SELECT
        r.*,
        kc.nome_promo,
        kc.validita_dal,
        kc.validita_al,
        (SELECT kit_design_trovati  FROM pipeline_counts) AS kit_design_trovati,
        (SELECT kit_runtime_trovati FROM pipeline_counts) AS kit_runtime_trovati,
        (SELECT promo_valide        FROM pipeline_counts) AS promo_valide
      FROM referenze r
      JOIN kit_chain kc ON kc.runtime_kit_id = r.id_runtime_kit
      WHERE 1=1
        ${jsonbWhereSql}
      ORDER BY r."createdAt" DESC
    `;

    const rows = await sequelize.query<RawReferenzaRow>(sql, {
      replacements: { templateIds, ...jsonbParams },
      type: QueryTypes.SELECT
    });

    // Estrai i contatori dalla prima riga (o 0 se vuoto)
    const kitDesignTrovati = rows.length > 0 ? Number(rows[0].kit_design_trovati) : 0;
    const kitRuntimeTrovati = rows.length > 0 ? Number(rows[0].kit_runtime_trovati) : 0;
    const promoValide = rows.length > 0 ? Number(rows[0].promo_valide) : 0;

    // Se non ci sono referenze ma ci sono template, esegui contatori separati
    if (rows.length === 0) {
      const countSql = `
        WITH kit_chain AS (
          SELECT
            dk.id  AS kit_design_id,
            rk.id  AS runtime_kit_id,
            p.id_promo
          FROM raccoglitore_kit rak
          JOIN design_kit  dk ON dk.id_raccoglitore = rak.id
          JOIN runtime_kit rk ON rk.id_design = dk.id
          JOIN promo       p  ON p.id_promo = rk.id_promo
          WHERE rak.id IN (:templateIds)
            AND (${validityClause})
        )
        SELECT
          COUNT(DISTINCT kit_design_id)  AS kit_design_trovati,
          COUNT(DISTINCT runtime_kit_id) AS kit_runtime_trovati,
          COUNT(DISTINCT id_promo)       AS promo_valide
        FROM kit_chain
      `;
      const [countRow] = await sequelize.query<{
        kit_design_trovati: string;
        kit_runtime_trovati: string;
        promo_valide: string;
      }>(countSql, {
        replacements: { templateIds },
        type: QueryTypes.SELECT
      });

      return {
        rows: [],
        kitDesignTrovati: countRow ? Number(countRow.kit_design_trovati) : 0,
        kitRuntimeTrovati: countRow ? Number(countRow.kit_runtime_trovati) : 0,
        promoValide: countRow ? Number(countRow.promo_valide) : 0,
      };
    }

    return { rows, kitDesignTrovati, kitRuntimeTrovati, promoValide };
  }

  // ─── Metodi pubblici ────────────────────────────────────────────────────

  async getTemplateFromSlug(slug: string): Promise<Partial<FilterTemplateDTO> | null> {
    try {
      const t = await FilterTemplate.findOne({
        where: { slug }
      });

      if (!t) {
        throw new NotFoundError({
          message: "Nessun template corrisponde a questo slug",
          entityType: 'FilterTemplate',
          entityId: slug,
        });
      }

      return {
        id_filter_template: t.id_filter_template,
        nome: t.nome,
        slug: t.slug,
        descrizione: t.descrizione,
        template_ids: t.template_ids || [],
        filters: t.filters || [],
        endpoint_type: t.endpoint_type,
        render_type: t.render_type,
        meta_options: t.meta_options || {},
        is_active: t.is_active,
        createdat: t.createdat.toISOString(),
        updatedat: t.updatedat.toISOString(),
      };
    } catch (e: any) {
      log.error("Errore durante la richiesta per lo slug:" + e.message, slug);
      throw e;
    }
  }

  /**
   * Recupera i files runtime con filtri avanzati sui metadati.
   * I filtri su meta_olimpo_cloud vengono ora applicati direttamente in PostgreSQL.
   */
  async getFiles(params: {
    filters?: Array<FilterConditionDTO[]>,
    tipo_export?: string[]
  }): Promise<{
    conteggio: number;
    files: any[];
    timestamp: string;
    filtri_applicati: number;
    gruppi_filtri: number[];
    tipo_export_richiesti: number;
  }> {
    try {
      log.info('getFiles chiamato con parametri:', {
        filters: params.filters,
        tipo_export: params.tipo_export
      });

      if (!params.filters) {
        params.filters = [];
      }

      // Build the base where clause: only files without errors
      const filesWhere: any = {
        [Op.or]: [{ error: null }, { error: '' }]
      };

      // Filter by tipo_export if specified
      if (params.tipo_export && params.tipo_export.length > 0) {
        const findTipiExport = await TipiDiExport.findAll({
          where: {
            codice_tipiexport: {
              [Op.in]: params.tipo_export,
              [Op.not]: EXPORT_DI_SISTEMA.CORREGGO
            }
          },
          attributes: ['id_tipiexport', 'codice_tipiexport']
        });
        const idCodiciValidi = findTipiExport.map(te => te.id_tipiexport);
        filesWhere.tipo_export = { [Op.in]: idCodiciValidi };
      }

      // Build JSONB filters for meta_olimpo_cloud to apply in DB
      const { whereSql: jsonbWhereSql, params: jsonbParams } = this.buildJsonbSqlFilters(
        params.filters,
        'meta_olimpo_cloud'
      );

      let files: any[];

      if (jsonbWhereSql) {
        // Build tipo_export SQL clause if needed
        let tipoExportSql = '';
        const extraParams: Record<string, any> = { ...jsonbParams };

        if (params.tipo_export && params.tipo_export.length > 0) {
          const findTipiExport = await TipiDiExport.findAll({
            where: {
              codice_tipiexport: {
                [Op.in]: params.tipo_export,
                [Op.not]: EXPORT_DI_SISTEMA.CORREGGO
              }
            },
            attributes: ['id_tipiexport']
          });
          const idCodiciValidi = findTipiExport.map(te => te.id_tipiexport);
          if (idCodiciValidi.length > 0) {
            extraParams['tipoExportIds'] = idCodiciValidi;
            tipoExportSql = 'AND tipo_export IN (:tipoExportIds)';
          }
        }

        const sql = `
          SELECT *
          FROM files_runtime
          WHERE (error IS NULL OR error = '')
            ${tipoExportSql}
            ${jsonbWhereSql}
          ORDER BY "createdAt" DESC
        `;

        files = await sequelize.query<any>(sql, {
          replacements: extraParams,
          type: QueryTypes.SELECT
        });
      } else {
        // No JSONB filters: use Sequelize ORM
        files = await FilesRuntime.findAll({
          where: filesWhere,
          order: [['createdAt', 'DESC']],
          raw: true
        }) as any[];
      }

      // Compute _matchPriority and sort if priority filters are present
      const hasPriorityFilters = params.filters.some(g => g.some(f => (f.priority ?? 0) > 0));
      if (hasPriorityFilters) {
        const filtersWithPriority = params.filters
          .filter(g => g && g.length > 0)
          .map(g => ({
            filters: g,
            priority: Math.max(...g.map(f => f.priority ?? 0))
          }))
          .filter(g => g.priority > 0)
          .sort((a, b) => b.priority - a.priority);

        if (filtersWithPriority.length > 0) {
          files = files.map(file => {
            let matchPriority = 0;
            for (const { filters: gFilters, priority } of filtersWithPriority) {
              if (this.matchesFiltersGroupJs(file, gFilters, 'meta_olimpo_cloud')) {
                matchPriority = priority;
                break;
              }
            }
            return { ...file, _matchPriority: matchPriority };
          });

          files.sort((a, b) => {
            if (b._matchPriority !== a._matchPriority) return b._matchPriority - a._matchPriority;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
      }

      // Build URL for each file using id_olimpo_cloud
      files = files.map(file => ({
        ...file,
        url: file.id_olimpo_cloud
          ? `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`
          : file.url,
        _matchPriority: file._matchPriority ?? 0
      }));

      const count = files.length;

      log.info(`Files runtime trovati: ${count}`, {
        tipo_export_richiesti: params.tipo_export?.length || 0,
        filtri_applicati: params.filters?.length || 0
      });

      return {
        conteggio: count,
        files,
        timestamp: new Date().toISOString(),
        filtri_applicati: params.filters?.length || 0,
        gruppi_filtri: params.filters?.map(group => group.length) || [],
        tipo_export_richiesti: params.tipo_export?.length || 0
      };
    } catch (error) {
      log.error('Errore nel recupero files runtime', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: params.filters
      });
      throw error;
    }
  }

  /**
   * Recupera tutti i campi disponibili in meta_olimpo_cloud dai files runtime
   */
  async getFilesMetadataFields(): Promise<string[]> {
    try {
      const documents = await FilesRuntime.findAll({
        where: { meta_olimpo_cloud: { [Op.ne]: null } },
        attributes: ['meta_olimpo_cloud'],
        limit: 1000,
        raw: true
      });

      const fieldPaths = new Set<string>();

      const extractFieldPaths = (obj: any, prefix: string = '') => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;

        Object.keys(obj).forEach(key => {
          const fullPath = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];

          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const objKeys = Object.keys(value);
            const isContentWrapper = objKeys.every(k => k === 'content' || k === 'contentHtml');

            if (isContentWrapper && objKeys.includes('content')) {
              fieldPaths.add(fullPath);
            } else {
              extractFieldPaths(value, fullPath);
            }
          } else {
            fieldPaths.add(fullPath);
          }
        });
      };

      documents.forEach(doc => {
        if (doc.meta_olimpo_cloud) {
          extractFieldPaths(doc.meta_olimpo_cloud);
        }
      });

      const excludedPatterns = [
        /contentHtml$/i,
        /\.contentHtml\./i,
        /\.contentHtml$/i,
        /^errors$/,
        /^foto$/,
      ];

      const excludedExactFields = new Set([
        'descrizione_uno',
        'descrizione_due',
        'descrizione_tre',
        'descrizione_quattro'
      ]);

      const fields = Array.from(fieldPaths)
        .filter(field => !excludedPatterns.some(pattern => pattern.test(field)))
        .filter(field => !field.endsWith('.content'))
        .filter(field => !excludedExactFields.has(field))
        .sort();

      log.info(`Campi metadata trovati: ${fields.length}`, {
        sample: fields.slice(0, 20)
      });

      return fields;
    } catch (error) {
      log.error('Errore nel recupero campi metadata files', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async generatePluginTemplate(params: FilterTemplateAttributes): Promise<any> {
    const template = await FilterTemplate.create(params);
    return template;
  }

  async getAllTemplateFiltersForGDO(idgdo: string): Promise<any[]> {
    try {
      if (idgdo == undefined || idgdo == null || idgdo == "") {
        throw new BadRequestError({
          message: "Gdo non presente per questo utente.",
          details: { field: 'idgdo' },
        });
      }
      const allTemplateForGDO = await FilterTemplate.findAll({
        raw: true,
        where: { id_gdo: idgdo }
      });
      return allTemplateForGDO;
    } catch (error: any) {
      log.error('Errore nella richiesta dei filter template', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Recupera le referenze con la struttura gerarchica Promo → KitRuntime → Referenze.
   * Utilizza un singolo JOIN SQL con filtri JSONB applicati direttamente in PostgreSQL.
   */
  async getRefs(params: {
    filters?: Array<FilterConditionDTO[]>;
    template_id: string[];
    skipValidityCheck?: boolean;
  }): Promise<GetRefsResponseDTO> {
    if (!params.template_id || params.template_id.length === 0) {
      throw new BadRequestError({
        message: 'è obbligatorio selezionare almeno un template kit'
      });
    }

    try {
      const templateIds = params.template_id;

      const { rows, kitDesignTrovati, kitRuntimeTrovati, promoValide } =
        await this._fetchReferenzeWithPipeline({
          templateIds,
          filters: params.filters,
          skipValidityCheck: params.skipValidityCheck
        });

      log.info(`Referenze trovate con pipeline: ${rows.length}`, {
        kitDesignTrovati,
        kitRuntimeTrovati,
        promoValide
      });

      if (rows.length === 0) {
        return {
          conteggio: 0,
          risposta: [],
          timestamp: new Date().toISOString(),
          filtri_applicati: params.filters?.length || 0,
          gruppi_filtri: params.filters?.map(g => g.length) || [],
          template_richiesti: templateIds.length,
          template_trovati: templateIds.length,
          kit_design_trovati: kitDesignTrovati,
          kit_runtime_trovati: kitRuntimeTrovati,
          promo_valide: promoValide,
          flusso_pipeline: {
            template: templateIds.length,
            design: kitDesignTrovati,
            runtime: kitRuntimeTrovati,
            referenze: 0
          }
        };
      }

      // Calcola _matchPriority in JS sui dati già filtrati dal DB
      const hasPriorityFilters = (params.filters ?? []).some(g => g.some(f => (f.priority ?? 0) > 0));
      let referenze: any[] = rows.map(ref => ({
        ...this.mapFotoToUrls(ref),
        _matchPriority: hasPriorityFilters ? this.computeMatchPriority(ref, params.filters ?? []) : 0
      }));

      if (hasPriorityFilters) {
        referenze.sort((a, b) => {
          if (b._matchPriority !== a._matchPriority) return b._matchPriority - a._matchPriority;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      // Struttura gerarchica Promo → KitRuntime → Referenze
      const referenzeByKitRuntime = new Map<string, any[]>();
      const promoMeta = new Map<string, { nome_promo: string; validita_dal: Date; validita_al: Date }>();

      rows.forEach((row, idx) => {
        const kitId = row.id_runtime_kit;
        if (!referenzeByKitRuntime.has(kitId)) referenzeByKitRuntime.set(kitId, []);
        referenzeByKitRuntime.get(kitId)!.push(referenze[idx]);

        if (!promoMeta.has(row.id_promo)) {
          promoMeta.set(row.id_promo, {
            nome_promo: row.nome_promo,
            validita_dal: row.validita_dal,
            validita_al: row.validita_al
          });
        }
      });

      // Raggruppa i kitRuntime per promo
      const kitsByPromo = new Map<string, Set<string>>();
      rows.forEach(row => {
        if (!kitsByPromo.has(row.id_promo)) kitsByPromo.set(row.id_promo, new Set());
        kitsByPromo.get(row.id_promo)!.add(row.id_runtime_kit);
      });

      // Ottieni id_design per ogni kit runtime (presente nella join come kit_design_id — non esposto nel raw)
      // Usiamo una query leggera per recuperare il mapping runtime → design
      const uniqueKitRuntimeIds = [...new Set(rows.map(r => r.id_runtime_kit))];
      const kitDesignMapping = new Map<string, string>();
      if (uniqueKitRuntimeIds.length > 0) {
        const kitDesigns = await RuntimeKit.findAll({
          where: { id: { [Op.in]: uniqueKitRuntimeIds } },
          attributes: ['id', 'id_design'],
          raw: true
        }) as any[];
        kitDesigns.forEach((k: any) => kitDesignMapping.set(k.id, k.id_design));
      }

      const response: PromoWithKitsDTO[] = [];
      for (const [promoId, meta] of promoMeta.entries()) {
        const kitIds = [...(kitsByPromo.get(promoId) ?? [])];
        const kit: KitRuntimeSummaryDTO[] = kitIds.map(kitId => ({
          id_kit: kitId,
          id_template: kitDesignMapping.get(kitId) ?? '',
          id_promo: promoId,
          referenze: referenzeByKitRuntime.get(kitId) ?? []
        }));

        response.push({
          id_promo: promoId,
          nome_promo: meta.nome_promo,
          validita_dal: meta.validita_dal,
          validita_al: meta.validita_al,
          kit
        });
      }

      return {
        conteggio: referenze.length,
        risposta: response,
        timestamp: new Date().toISOString(),
        filtri_applicati: params.filters?.length || 0,
        gruppi_filtri: params.filters?.map(g => g.length) || [],
        template_richiesti: templateIds.length,
        template_trovati: templateIds.length,
        kit_design_trovati: kitDesignTrovati,
        kit_runtime_trovati: kitRuntimeTrovati,
        promo_valide: promoValide,
        flusso_pipeline: {
          template: templateIds.length,
          design: kitDesignTrovati,
          runtime: kitRuntimeTrovati,
          referenze: referenze.length
        }
      };
    } catch (error) {
      log.error('Errore nella pipeline di aggregazione', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: params.filters
      });
      throw error;
    }
  }

  async getPromoValide(skipValidityCheck?: boolean): Promise<PromoResponseDTO[]> {
    const oggi = dayjs().toDate();
    const promoValide = skipValidityCheck
      ? await Promo.findAll()
      : await Promo.findAll({
        where: {
          validita_dal: { [Op.lte]: oggi },
          validita_al: { [Op.gte]: oggi }
        }
      });
    return promoValide.map(promo => ({
      id: promo.id_promo,
      nome: promo.nome_promo,
      validita_dal: promo.validita_dal,
      validita_al: promo.validita_al,
      data_scadenza: promo.data_scadenza,
      is_active: dayjs().isBetween(dayjs(promo.validita_dal), dayjs(promo.validita_al), null, '[]'),
      is_expired: dayjs().isAfter(dayjs(promo.data_scadenza)),
      days_until_expiry: dayjs(promo.data_scadenza).diff(dayjs(), 'day'),
      days_since_start: dayjs().diff(dayjs(promo.validita_dal), 'day')
    })) as PromoResponseDTO[];
  }

  async getApiKey(idUtente: string): Promise<string> {
    const utenteGDO = await UtentiGDO.findOne({
      where: { id_utente_utentegdo: idUtente }
    });

    if (!utenteGDO) {
      throw new NotFoundError({
        message: 'Utente non trovato',
        entityType: 'UtenteGDO',
        entityId: idUtente
      });
    }
    const ruoloUtenteGDO = await RuoloUtenteGDO.findOne({
      where: { id_ruolo_utente_gdo: utenteGDO.id_ruolo_utente_gdo }
    });
    if (!ruoloUtenteGDO) {
      throw new NotFoundError({
        message: 'Ruolo utente non trovato',
        entityType: 'RuoloUtenteGDO',
        entityId: utenteGDO.id_ruolo_utente_gdo
      });
    }
    if (!ruoloUtenteGDO.api_key_ruolo_utente_gdo) {
      throw new NotFoundError({
        message: 'API Key utente non trovata',
        entityType: 'RuoloUtenteGDO',
        entityId: utenteGDO.id_ruolo_utente_gdo
      });
    }
    return ruoloUtenteGDO.api_key_ruolo_utente_gdo;
  }

  async generateApiKey(id_utente: string): Promise<any> {
    try {
      const utenteGDO = await UtentiGDO.findOne({
        where: { id_utente_utentegdo: id_utente }
      });

      if (!utenteGDO) {
        throw new NotFoundError({
          message: 'Utente non trovato',
          entityType: 'UtenteGDO',
          entityId: id_utente
        });
      }

      const ruoloUtenteGDO = await RuoloUtenteGDO.findOne({
        where: { id_ruolo_utente_gdo: utenteGDO.id_ruolo_utente_gdo }
      });

      if (!ruoloUtenteGDO) {
        throw new NotFoundError({
          message: 'Ruolo utente non trovato',
          entityType: 'RuoloUtenteGDO',
          entityId: utenteGDO.id_ruolo_utente_gdo
        });
      }

      const secret = config.FICO_SECRET;

      if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
        throw new ValidationError({
          message: 'FICO_SECRET non configurata o non valida',
          field: 'FICO_SECRET',
          constraint: 'required',
        });
      }

      if (secret.length < 16) {
        throw new ValidationError({
          message: 'FICO_SECRET deve essere di almeno 16 caratteri per garantire la sicurezza',
          field: 'FICO_SECRET',
          constraint: 'min-length',
          details: { minLength: 16, actualLength: secret.length },
        });
      }

      const randomData = crypto.randomBytes(32);
      const timestamp = dayjs().valueOf().toString();
      const keyData = `${randomData.toString('hex')}-${timestamp}`;

      const key = crypto.createHash('sha256').update(secret).digest();
      const iv = key.subarray(0, 16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(keyData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const apiKey = encrypted;

      await RuoloUtenteGDO.update({
        api_key_ruolo_utente_gdo: apiKey,
        updatedat: dayjs().toDate()
      }, {
        where: { id_ruolo_utente_gdo: utenteGDO.id_ruolo_utente_gdo }
      });

      log.info('API Key generata per utente', {
        id_utente,
        id_ruolo: utenteGDO.id_ruolo_utente_gdo,
        timestamp: dayjs().toISOString()
      });

      return {
        apiKey,
        id_utente,
        id_ruolo: utenteGDO.id_ruolo_utente_gdo,
        generated_at: dayjs().toISOString()
      };
    } catch (error) {
      log.error('Errore nella generazione API Key', {
        id_utente,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Recupera le referenze con HTML pre-renderizzato server-side.
   * Riusa _fetchReferenzeWithPipeline per evitare duplicazione.
   */
  async getRefsHtml(params: {
    filters?: Array<FilterConditionDTO[]>;
    template_id: string[];
  }): Promise<GetRefsHtmlResponseDTO> {
    if (!params.template_id || params.template_id.length === 0) {
      throw new BadRequestError({
        message: 'è obbligatorio selezionare almeno un template kit'
      });
    }

    try {
      const configService = new ConfigService();
      const configWebpliant = await configService.getConfigWebPliantFromVolantino();

      if (configWebpliant.css_text) {
        referenzeHtmlService.initialize(configWebpliant.css_text);
      }

      const { rows, kitDesignTrovati, kitRuntimeTrovati, promoValide } =
        await this._fetchReferenzeWithPipeline({
          templateIds: params.template_id,
          filters: params.filters,
          skipValidityCheck: false
        });

      log.info(`[getRefsHtml] Referenze trovate: ${rows.length}`, {
        kitDesignTrovati,
        kitRuntimeTrovati,
        promoValide
      });

      if (rows.length === 0) {
        return { conteggio: 0, risposta: [], timestamp: new Date().toISOString() };
      }

      const hasPriorityFilters = (params.filters ?? []).some(g => g.some(f => (f.priority ?? 0) > 0));
      let referenze: any[] = rows.map(ref => ({
        ...this.mapFotoToUrls(ref),
        _matchPriority: hasPriorityFilters ? this.computeMatchPriority(ref, params.filters ?? []) : 0
      }));

      if (hasPriorityFilters) {
        referenze.sort((a, b) => {
          if (b._matchPriority !== a._matchPriority) return b._matchPriority - a._matchPriority;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      // Struttura gerarchica Promo → KitRuntime → referenze_html
      const referenzeByKitRuntime = new Map<string, any[]>();
      const promoMeta = new Map<string, { nome_promo: string; validita_dal: Date; validita_al: Date }>();

      rows.forEach((row, idx) => {
        const kitId = row.id_runtime_kit;
        if (!referenzeByKitRuntime.has(kitId)) referenzeByKitRuntime.set(kitId, []);
        referenzeByKitRuntime.get(kitId)!.push(referenze[idx]);

        if (!promoMeta.has(row.id_promo)) {
          promoMeta.set(row.id_promo, {
            nome_promo: row.nome_promo,
            validita_dal: row.validita_dal,
            validita_al: row.validita_al
          });
        }
      });

      const kitsByPromo = new Map<string, Set<string>>();
      rows.forEach(row => {
        if (!kitsByPromo.has(row.id_promo)) kitsByPromo.set(row.id_promo, new Set());
        kitsByPromo.get(row.id_promo)!.add(row.id_runtime_kit);
      });

      const uniqueKitRuntimeIds = [...new Set(rows.map(r => r.id_runtime_kit))];
      const kitDesignMapping = new Map<string, string>();
      if (uniqueKitRuntimeIds.length > 0) {
        const kitDesigns = await RuntimeKit.findAll({
          where: { id: { [Op.in]: uniqueKitRuntimeIds } },
          attributes: ['id', 'id_design'],
          raw: true
        }) as any[];
        kitDesigns.forEach((k: any) => kitDesignMapping.set(k.id, k.id_design));
      }

      const renderOptions = { baseUrl: config.OLYMPUS_IP_ADDRESS };
      const response: GetRefsHtmlResponseDTO['risposta'] = [];

      for (const [promoId, meta] of promoMeta.entries()) {
        const kitIds = [...(kitsByPromo.get(promoId) ?? [])];
        const kit = kitIds.map(kitId => {
          const referenzeForKit = referenzeByKitRuntime.get(kitId) ?? [];
          const referenze_html = referenzeForKit
            .map(ref => referenzeHtmlService.renderReferenza(ref, configWebpliant, renderOptions))
            .filter(html => html !== '');

          return {
            id_kit: kitId,
            id_template: kitDesignMapping.get(kitId) ?? '',
            id_promo: promoId,
            referenze_html
          };
        });

        response.push({
          id_promo: promoId,
          nome_promo: meta.nome_promo,
          validita_dal: meta.validita_dal,
          validita_al: meta.validita_al,
          kit
        });
      }

      log.info(`[getRefsHtml] Referenze HTML generate: ${referenze.length}`);

      return {
        conteggio: referenze.length,
        risposta: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('[getRefsHtml] Errore nella generazione HTML referenze', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: params.filters
      });
      throw error;
    }
  }

  /**
   * Recupera il CSS completo per il plugin (Shadow DOM)
   */
  async getCss(): Promise<GetCssResponseDTO> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const pluginCssPath = path.join(import.meta.dirname, '../assets/plugin-styles.css');
      let pluginCss = '';

      try {
        pluginCss = await fs.readFile(pluginCssPath, 'utf-8');
        log.info('[getCss] CSS plugin caricato', { length: pluginCss.length });
      } catch (err) {
        log.warn('[getCss] CSS plugin non trovato, usa npm run plugin:css per generarlo', {
          path: pluginCssPath
        });
      }

      const configService = new ConfigService();
      const configCss = await configService.getStiliToText();

      const combinedCss = `\n\n/* === CSS Configurato Utente === */\n${configCss}\n${pluginCss}`;

      log.info('[getCss] CSS recuperato', {
        pluginCssLength: pluginCss.length,
        configCssLength: configCss.length,
        totalLength: combinedCss.length
      });

      return {
        css_text: combinedCss,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('[getCss] Errore nel recupero CSS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Ottiene i valori distinti di un campo specifico delle referenze usando SELECT DISTINCT in DB.
   */
  async getRefsFieldValues(field: string, template_id?: string[]): Promise<string[]> {
    try {
      log.info('[getRefsFieldValues] Recupero valori per campo', { field, template_id });

      const trimmedField = field.trim();
      // Rimuovi eventuale prefisso "dataFields."
      const fieldKey = trimmedField.startsWith('dataFields.')
        ? trimmedField.replace(/^dataFields\./, '')
        : trimmedField;

      if (!this.isSafeFieldName(fieldKey)) {
        log.warn('[getRefsFieldValues] Nome campo non sicuro', { field });
        return [];
      }

      let kitRuntimeIdsSql = '';
      const replacements: Record<string, any> = { field: fieldKey };

      if (template_id && template_id.length > 0) {
        // Risolvi kitRuntimeIds da template_id con 2 query leggere
        const kitDesigns = await DesignKit.findAll({
          where: { id_raccoglitore: { [Op.in]: template_id } },
          attributes: ['id'],
          raw: true
        }) as any[];

        const kitDesignIds = kitDesigns.map((k: any) => k.id);

        if (kitDesignIds.length === 0) return [];

        const kitRuntimes = await RuntimeKit.findAll({
          where: { id_design: { [Op.in]: kitDesignIds } },
          attributes: ['id'],
          raw: true
        }) as any[];

        const kitRuntimeIds = kitRuntimes.map((k: any) => k.id);
        if (kitRuntimeIds.length === 0) return [];

        replacements['kitRuntimeIds'] = kitRuntimeIds;
        kitRuntimeIdsSql = 'AND id_runtime_kit IN (:kitRuntimeIds)';
      }

      const sql = `
        SELECT DISTINCT data_fields->>:field AS val
        FROM referenze
        WHERE data_fields->>:field IS NOT NULL
          AND data_fields->>:field != ''
          ${kitRuntimeIdsSql}
        LIMIT 1000
      `;

      const rows = await sequelize.query<{ val: string }>(sql, {
        replacements,
        type: QueryTypes.SELECT
      });

      const values = rows
        .map(r => r.val)
        .filter(v => v && v !== 'null' && v !== 'undefined');
      //HACK se contiene nella key descrizione allora lo mandiamo vuoto
      if (field.includes("descrizione")) {
        return [];
      }
      log.info('[getRefsFieldValues] Valori trovati', { field, count: values.length });
      return values;
    } catch (error) {
      log.error('[getRefsFieldValues] Errore nel recupero valori', {
        field,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Ottiene i valori distinti di un campo dei metadata files usando GROUP BY in DB.
   */
  async getFilesFieldValues(field: string): Promise<string[]> {
    try {
      log.info('[getFilesFieldValues] Recupero valori per campo', { field });

      const trimmedField = field.trim();

      if (!this.isSafeFieldName(trimmedField)) {
        log.warn('[getFilesFieldValues] Nome campo non sicuro', { field });
        return [];
      }

      const sql = `
        SELECT meta_olimpo_cloud->>:field AS val, COUNT(*) AS cnt
        FROM files_runtime
        WHERE meta_olimpo_cloud IS NOT NULL
          AND meta_olimpo_cloud->>:field IS NOT NULL
          AND meta_olimpo_cloud->>:field != ''
        GROUP BY val
        ORDER BY cnt DESC
        LIMIT 1000
      `;

      const rows = await sequelize.query<{ val: string; cnt: string }>(sql, {
        replacements: { field: trimmedField },
        type: QueryTypes.SELECT
      });

      // Per i campi con struttura {content, contentHtml}, estraiamo il testo
      const values = rows
        .map(r => {
          let v = r.val;
          try {
            const parsed = JSON.parse(v);
            if (parsed && typeof parsed === 'object' && parsed.content !== undefined) {
              v = this.stripHtmlTags(String(parsed.content));
            }
          } catch {
            v = this.stripHtmlTags(v);
          }
          return v;
        })
        .filter(v => v && v !== 'null' && v !== 'undefined' && v !== '');

      log.info('[getFilesFieldValues] Valori trovati', { field, count: values.length });
      return values;
    } catch (error) {
      log.error('[getFilesFieldValues] Errore nel recupero valori', {
        field,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

}
