import { Request } from "express";
import { Buffer } from "node:buffer";
import { Op, QueryTypes } from "sequelize";
import * as XLSX from 'xlsx';
import { BadRequestError, DatabaseError, NotFoundError } from '../../../lib/errors';
import { TracciatiAttributes, type AnalisiMomentoResponse, type AnalisiMomentoTracciato, type CategoryScoreboardTimeline, type DataFields, type MomentoSelectorQuery, type PromoFilterQuery, type ReportOptionDTO, type RisultatoConfrontoMomento, type SavedPromoScoreboard, type SavedReportConfronto, type SavedReportConfrontoSummary, type TipoSchema, type TracciatiMomentoConfrontoResponseDTO, type TracciatiMomentoResponseDTO, type TracciatiSchemaConfronto, type TracciatiSchemaItem, type TracciatiSchemaResponseDTO, type TracciatoQueryPromoResult, type TracciatoQueryRequest, type TracciatoQueryResult, type TracciatoReport, type TracciatoWidgetScoreAudit, type TracciatoWidgetScoreboardCodiceRow, type TracciatoWidgetScoreboardRow } from '../../../lib/types';
import type { CellaConfronto, IAgenziaLib, MatricePromo, PromoScoreboardInput, StoriaDelCampo } from "../agenzia_lib/types.js";
import config from '../config';
import { sequelize } from '../db/SequelizeConnector';
import { CreateTracciatiDTO, TracciatiResponseDTO } from '../dto';
import { ITracciatoService } from '../interfaces/ITracciatoService';
import { log } from '../logger';
import { Area, Canale } from '../models';
import { Promo } from '../models/promo';
import type { ITracciatiMomentoRepository } from '../repositories/TracciatiMomentoRepository';
import { TracciatiMomentoRepository } from '../repositories/TracciatiMomentoRepository';
import type { ITracciatiReportRepository } from '../repositories/TracciatiReportRepository';
import { TracciatiReportRepository } from '../repositories/TracciatiReportRepository';
import type { ITracciatiRepository } from '../repositories/TracciatiRepository';
import { TracciatiRepository } from '../repositories/TracciatiRepository';
import type { ITracciatiSchemaRepository } from '../repositories/TracciatiSchemaRepository';
import { TracciatiSchemaRepository } from '../repositories/TracciatiSchemaRepository';
import { ServerUtils } from '../utils/ServerUtils';
import { removeSinglesIncludedInGroups as _removeSinglesUtil, resolveGroupMembersFromScattoCodice as _resolveGroupMembersUtil } from './TracciatoScoreboardUtils.js';



// ── Scoring engine ────────────────────────────────────────────────────────────

export type Avviso = TracciatoWidgetScoreAudit;

type CodiceAcc = {
  repartoNome: string;
  uscenti: number;
  entranti: number;
  modificati: number;
  modificatiCampi: string[][];
  inalterati: number;
  percentualeIntegra: number;
  totale: number;
  hasTerremoto?: boolean;
  audit?: Array<Avviso>;
};

type RepartoAgg = {
  uscenti: number; entranti: number; modificati: number; inalterati: number;
  totale: number; percentualeIntegraSomma: number; codiciCount: number; codici: TracciatoWidgetScoreboardCodiceRow[];
  hasTerremoto?: boolean;
  audit: Avviso[];
};

type EventoScoreboard = "uscita" | "entrata" | "modifica";

type AllCodiceInfo = {
  outerKey: string;
  canaleArea: string;
  repartoNome: string;
  scattoCodice: string;
  codiceReferenza: string;
};

type PreparedCanaleAreaMaps = {
  primarioByCodice: Map<string, Map<string, DataFields>>;
  secondarioByCodice: Map<string, Map<string, DataFields>>;
};

type InnerEvento = {
  innerCode: string;
  tipo: EventoScoreboard;
  rec: DataFields;
  campiModificati: string[];
};

export class TracciatoService implements ITracciatoService {
  constructor(
    private readonly tracciatiRepository: ITracciatiRepository = new TracciatiRepository(),
    private readonly agenziaLib?: IAgenziaLib,
    private readonly reportRepository: ITracciatiReportRepository = new TracciatiReportRepository(),
    private readonly momentoRepository: ITracciatiMomentoRepository = new TracciatiMomentoRepository(),
    private readonly schemaRepository: ITracciatiSchemaRepository = new TracciatiSchemaRepository()
  ) { }

  // ─── Static scoring engine ─────────────────────────────────────────────────

  private static normalizeCode(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private static resolveRecordCodes(record: { scatto_codice?: unknown; codice_referenza?: unknown }) {
    const scattoCodice = TracciatoService.normalizeCode(record.scatto_codice);
    const codiceReferenza = TracciatoService.normalizeCode(record.codice_referenza);
    return { scattoCodice, codiceReferenza };
  }

  public static sottraiPercentualeDaPi(piCorrente: number, percentualeDaSottrarre: number): number {
    if (piCorrente <= 0 || percentualeDaSottrarre <= 0) return Math.max(0, piCorrente);
    const perdita = (percentualeDaSottrarre / 100) * piCorrente;
    return Math.max(0, piCorrente - perdita);
  }

  private static isGroupByScattoCodice(record: { scatto_codice?: unknown; codice_referenza?: unknown }): boolean {
    const { scattoCodice, codiceReferenza } = TracciatoService.resolveRecordCodes(record);
    return scattoCodice.length > 0 && scattoCodice !== codiceReferenza;
  }

  public static buildRows(
    celle: CellaConfronto[],
    auditByOuterKey: Map<string, Avviso[]> = new Map(),
  ): TracciatoWidgetScoreboardRow[] {
    const codiceMap = new Map<string, CodiceAcc>();
    for (const cella of celle) {
      if (cella.stato === 'non_esistente') continue;
      const pesoEvento = Math.max(1, cella.totaleReferenzeNelGruppo || 1);
      const existing = codiceMap.get(cella.outerKey);
      const acc = existing ?? {
        repartoNome: cella.repartoNome || '—',
        uscenti: 0,
        entranti: 0,
        modificati: 0,
        modificatiCampi: [],
        inalterati: 0,
        percentualeIntegra: 100,
        totale: 0,
        hasTerremoto: false,
        audit: [],
      };

      acc.percentualeIntegra = Math.min(acc.percentualeIntegra, cella.piDopoEvento);
      acc.totale += pesoEvento;
      if (cella.hasTerremoto) acc.hasTerremoto = true;
      if (cella.stato === 'uscita') acc.uscenti += pesoEvento;
      else if (cella.stato === 'entrata') acc.entranti += pesoEvento;
      else if (cella.stato === 'modifica') { acc.modificati += pesoEvento; acc.modificatiCampi.push(cella.campiModificatiCumulativi); }
      else if (cella.stato === 'inalterata') acc.inalterati += pesoEvento;

      if (!existing) {
        const audit = auditByOuterKey.get(cella.outerKey);
        if (audit?.length) acc.audit = [...audit];
      }
      codiceMap.set(cella.outerKey, acc);
    }

    const repartoAgg = new Map<string, RepartoAgg>();
    for (const [codiceKey, acc] of codiceMap.entries()) {
      const percentualeIntegra = Math.round(acc.percentualeIntegra);
      const codiceRow: TracciatoWidgetScoreboardCodiceRow = {
        codice: codiceKey, percentualeIntegra, score: percentualeIntegra,
        inalterati: acc.inalterati, uscenti: acc.uscenti,
        entranti: acc.entranti, modificati: acc.modificati, totale: acc.totale,
        audit: acc.audit,
      };
      const nome = acc.repartoNome;
      const agg = repartoAgg.get(nome) ?? { uscenti: 0, entranti: 0, modificati: 0, inalterati: 0, totale: 0, percentualeIntegraSomma: 0, codiciCount: 0, codici: [], hasTerremoto: false, audit: [] };
      agg.uscenti += acc.uscenti; agg.entranti += acc.entranti;
      agg.modificati += acc.modificati; agg.inalterati += acc.inalterati;
      agg.totale += acc.totale; agg.percentualeIntegraSomma += percentualeIntegra; agg.codiciCount++;
      agg.codici.push(codiceRow);
      if (acc.hasTerremoto) agg.hasTerremoto = true;
      if (acc.audit?.length) agg.audit.push(...acc.audit);
      repartoAgg.set(nome, agg);
    }
    return Array.from(repartoAgg.entries())
      .map(([reparto, agg]) => {
        const percentualeIntegra = agg.codiciCount > 0 ? Math.round(agg.percentualeIntegraSomma / agg.codiciCount) : 100;
        const codiciSorted = agg.codici.sort((a, b) => a.codice.localeCompare(b.codice));
        return {
          reparto, percentualeIntegra, score: percentualeIntegra,
          inalterati: agg.inalterati, uscenti: agg.uscenti,
          entranti: agg.entranti, modificati: agg.modificati, totale: agg.totale,
          codici: codiciSorted.length > 1 ? codiciSorted : undefined,
          hasTerremoto: agg.hasTerremoto,
          audit: agg.audit,
        };
      })
      .sort((a, b) => b.percentualeIntegra - a.percentualeIntegra);
  }

  private static byCodice(recs: DataFields[]): Map<string, Map<string, DataFields>> {
    const m = new Map<string, Map<string, DataFields>>();
    for (const r of recs) {
      const isGroup = TracciatoService.isGroupByScattoCodice(r);
      const codiceKey = isGroup ? TracciatoService.normalizeCode(r.scatto_codice) : TracciatoService.normalizeCode(r.codice_referenza);
      if (!codiceKey || codiceKey === "—") continue;
      const ck = String(r['codiceKey'] ?? '—');
      if (!m.has(ck)) m.set(ck, new Map());
      m.get(ck)!.set(codiceKey, r);
    }
    return m;
  }

  public static resolveGroupSizeFromScattoCodice(scattoCodice: unknown, codiceReferenza: unknown): number {
    const members = TracciatoService.resolveGroupMembersFromScattoCodice(scattoCodice, codiceReferenza);
    return members.length > 0 ? members.length : 1;
  }

  public static resolveGroupMembersFromScattoCodice(scattoCodice: unknown, codiceReferenza: unknown): string[] {
    return _resolveGroupMembersUtil(scattoCodice, codiceReferenza);
  }

  public static removeSinglesIncludedInGroups(
    primMap: Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>,
    secMap: Map<string, { codice_referenza?: unknown; scatto_codice?: unknown; tipo?: unknown }>,
    externalGroupedCodes?: Set<string>,
  ): void {
    _removeSinglesUtil(primMap, secMap, externalGroupedCodes);
  }

  private static getCanaleAreaKey(guidCanale: unknown, guidArea: unknown): string {
    return `${String(guidCanale)}::${String(guidArea)}`;
  }

  private static getMatrixKey(outerKey: string, canaleArea: string): string {
    return `${outerKey}\u0001${canaleArea}`;
  }

  private static getCanaleAreaKeys(confronto: PromoScoreboardInput[number]): string[] {
    const keys = new Set<string>();
    for (const t of [...confronto.risultato.primario.tracciati, ...confronto.risultato.secondario.tracciati]) {
      keys.add(TracciatoService.getCanaleAreaKey(t.guidCanale, t.guidArea));
    }
    return [...keys];
  }

  private static getRecordsForCanaleArea(confronto: PromoScoreboardInput[number], canaleArea: string, side: 'primario' | 'secondario'): DataFields[] {
    const sepIdx = canaleArea.indexOf('::');
    const guidCanale = canaleArea.slice(0, sepIdx);
    const guidArea = canaleArea.slice(sepIdx + 2);
    return confronto.risultato[side].tracciati
      .filter(t => String(t.guidCanale) === guidCanale && String(t.guidArea) === guidArea)
      .flatMap(t => t.records);
  }

  private static prepareCanaleAreaMaps(primRecords: DataFields[], secRecords: DataFields[]): PreparedCanaleAreaMaps {
    const primarioByCodice = TracciatoService.byCodice(primRecords);
    const secondarioByCodice = TracciatoService.byCodice(secRecords);
    const groupedCodes = new Set<string>();
    for (const rec of [...primRecords, ...secRecords]) {
      for (const codice of TracciatoService.resolveGroupMembersFromScattoCodice(rec.scatto_codice, rec.codice_referenza)) {
        groupedCodes.add(codice);
      }
    }

    const allOuterKeys = new Set([...primarioByCodice.keys(), ...secondarioByCodice.keys()]);
    for (const outerKey of allOuterKeys) {
      const primMap = primarioByCodice.get(outerKey);
      const secMap = secondarioByCodice.get(outerKey);
      if (primMap || secMap) {
        TracciatoService.removeSinglesIncludedInGroups(
          primMap ?? new Map(),
          secMap ?? new Map(),
          groupedCodes,
        );
      }
      if (primMap?.size === 0) primarioByCodice.delete(outerKey);
      if (secMap?.size === 0) secondarioByCodice.delete(outerKey);
    }

    return { primarioByCodice, secondarioByCodice };
  }

  private static cloneStoria(storia: Record<string, StoriaDelCampo>): Record<string, StoriaDelCampo> {
    return Object.fromEntries(
      Object.entries(storia).map(([campo, item]) => [
        campo,
        {
          valoreIniziale: item.valoreIniziale,
          valoreFinale: item.valoreFinale,
          variazioni: item.variazioni.map(v => ({ ...v })),
        },
      ]),
    );
  }

  private static mergeStorieForInners(
    innerCodes: Iterable<string>,
    campiStoriaPerInner: Map<string, Record<string, StoriaDelCampo>>,
  ): Record<string, StoriaDelCampo> {
    const merged: Record<string, StoriaDelCampo> = {};
    for (const innerCode of innerCodes) {
      const storia = campiStoriaPerInner.get(innerCode);
      if (!storia) continue;
      for (const [campo, item] of Object.entries(storia)) {
        const target = merged[campo] ?? {
          valoreIniziale: item.valoreIniziale,
          valoreFinale: item.valoreFinale,
          variazioni: [],
        };
        target.variazioni.push(...item.variazioni.map(v => ({ ...v })));
        target.variazioni.sort((a, b) => a.confrontoIndex - b.confrontoIndex);
        target.variazioni = target.variazioni.filter(
          (v, idx, arr) => idx === 0 || arr[idx - 1].confrontoIndex !== v.confrontoIndex,
        );
        target.valoreIniziale = target.variazioni[0]?.valoreA ?? item.valoreIniziale;
        target.valoreFinale = target.variazioni[target.variazioni.length - 1]?.valoreB ?? item.valoreFinale;
        merged[campo] = target;
      }
    }
    return merged;
  }

  public static _buildMatricePromo(confrontiData: PromoScoreboardInput, agenziaLib: IAgenziaLib): MatricePromo {
    const allCodici = new Map<string, AllCodiceInfo>();

    for (const confronto of confrontiData) {
      for (const canaleArea of TracciatoService.getCanaleAreaKeys(confronto)) {
        const primRecords = TracciatoService.getRecordsForCanaleArea(confronto, canaleArea, 'primario');
        const secRecords = TracciatoService.getRecordsForCanaleArea(confronto, canaleArea, 'secondario');
        const { primarioByCodice, secondarioByCodice } = TracciatoService.prepareCanaleAreaMaps(primRecords, secRecords);
        const outerKeys = new Set([...primarioByCodice.keys(), ...secondarioByCodice.keys()]);

        for (const outerKey of outerKeys) {
          const firstRec = primarioByCodice.get(outerKey)?.values().next().value
            ?? secondarioByCodice.get(outerKey)?.values().next().value;
          if (!firstRec) continue;
          const matrixKey = TracciatoService.getMatrixKey(outerKey, canaleArea);
          if (!allCodici.has(matrixKey)) {
            allCodici.set(matrixKey, {
              outerKey,
              canaleArea,
              repartoNome: String(firstRec.reparto_business ?? firstRec.reparto ?? '—'),
              scattoCodice: firstRec.scatto_codice,
              codiceReferenza: firstRec.codice_referenza,
            });
          }
        }
      }
    }

    const piPerKey = new Map<string, number>();
    const prevEventPerInner = new Map<string, EventoScoreboard>();
    const campiAccumulatiPerInner = new Map<string, Set<string>>();
    const campiStoriaPerInner = new Map<string, Record<string, StoriaDelCampo>>();
    const matrice: MatricePromo = [];

    for (let i = 0; i < confrontiData.length; i++) {
      const confronto = confrontiData[i];
      const mapsByCanaleArea = new Map<string, PreparedCanaleAreaMaps>();
      for (const canaleArea of TracciatoService.getCanaleAreaKeys(confronto)) {
        const primRecords = TracciatoService.getRecordsForCanaleArea(confronto, canaleArea, 'primario');
        const secRecords = TracciatoService.getRecordsForCanaleArea(confronto, canaleArea, 'secondario');
        mapsByCanaleArea.set(canaleArea, TracciatoService.prepareCanaleAreaMaps(primRecords, secRecords));
      }

      const nextPrevEvents = new Map<string, EventoScoreboard>();
      const prevEventsToClear = new Set<string>();
      const celle: CellaConfronto[] = [];

      for (const [matrixKey, info] of allCodici) {
        const prepared = mapsByCanaleArea.get(info.canaleArea);
        const mapPrimario = new Map(prepared?.primarioByCodice.get(info.outerKey) ?? new Map<string, DataFields>());
        const mapSecondario = new Map(prepared?.secondarioByCodice.get(info.outerKey) ?? new Map<string, DataFields>());
        const piPrimaDellEvento = piPerKey.get(matrixKey) ?? 100;

        if (mapPrimario.size === 0 && mapSecondario.size === 0) {
          celle.push({
            outerKey: info.outerKey,
            canaleArea: info.canaleArea,
            repartoNome: info.repartoNome,
            confrontoIndex: i,
            labelPrimario: confronto.primarioNome,
            labelSecondario: confronto.secondarioNome,
            stato: 'non_esistente',
            campiModificatiCumulativi: [],
            campiDettaglio: {},
            campiStoria: {},
            piPrimaDellEvento,
            contributo: 0,
            piDopoEvento: piPrimaDellEvento,
            hasTerremoto: false,
            totaleReferenzeNelGruppo: 0,
            scattoCodice: info.scattoCodice,
            codiceReferenza: info.codiceReferenza,
          });
          piPerKey.set(matrixKey, piPrimaDellEvento);
          continue;
        }

        const allInnerCodes = new Set([...mapPrimario.keys(), ...mapSecondario.keys()]);
        const firstRec = mapPrimario.values().next().value ?? mapSecondario.values().next().value;
        const repartoNome = String(firstRec?.reparto_business ?? firstRec?.reparto ?? info.repartoNome ?? '—');
        const totaleReferenzeNelGruppo = allInnerCodes.size;
        const campiDettaglio: CellaConfronto['campiDettaglio'] = {};
        const eventi: InnerEvento[] = [];
        let inalterati = 0;

        for (const [innerCode, primRec] of mapPrimario) {
          const secRec = mapSecondario.get(innerCode);
          if (!secRec) {
            eventi.push({ innerCode, tipo: 'uscita', rec: primRec, campiModificati: [] });
            continue;
          }

          const changes = agenziaLib.getChangedFields(primRec, secRec);
          if (changes.length === 0) {
            inalterati++;
            prevEventsToClear.add(innerCode);
            continue;
          }

          const accumulated = campiAccumulatiPerInner.get(innerCode) ?? new Set<string>();
          const storia = campiStoriaPerInner.get(innerCode) ?? {};
          for (const change of changes) {
            accumulated.add(change.campo);
            campiDettaglio[change.campo] = { valoreA: change.valoreA, valoreB: change.valoreB };
            storia[change.campo] ??= {
              valoreIniziale: change.valoreA,
              valoreFinale: change.valoreB,
              variazioni: [],
            };
            storia[change.campo].variazioni.push({
              confrontoIndex: i,
              valoreA: change.valoreA,
              valoreB: change.valoreB,
            });
            storia[change.campo].valoreFinale = change.valoreB;
          }
          campiAccumulatiPerInner.set(innerCode, accumulated);
          campiStoriaPerInner.set(innerCode, storia);
          eventi.push({ innerCode, tipo: 'modifica', rec: primRec, campiModificati: [...accumulated] });
        }

        for (const [innerCode, secRec] of mapSecondario) {
          if (mapPrimario.has(innerCode)) continue;
          eventi.push({ innerCode, tipo: 'entrata', rec: secRec, campiModificati: [] });
        }

        let stato: CellaConfronto['stato'] = 'inalterata';
        if (eventi.some(e => e.tipo === 'modifica')) stato = 'modifica';
        else if (eventi.some(e => e.tipo === 'uscita')) stato = 'uscita';
        else if (eventi.some(e => e.tipo === 'entrata')) stato = 'entrata';
        else if (inalterati > 0) stato = 'inalterata';

        let piCorrente = piPrimaDellEvento;
        let hasTerremoto = false;
        const campiCumulativi = new Set<string>();

        for (const evento of eventi) {
          for (const campo of evento.campiModificati) campiCumulativi.add(campo);
          const storiaEvento = TracciatoService.cloneStoria(campiStoriaPerInner.get(evento.innerCode) ?? {});
          const { contributoRaw, hasTerremoto: eventoHaTerremoto } = agenziaLib.computeContributo(
            evento.tipo,
            repartoNome,
            evento.campiModificati,
            {
              prevEvent: prevEventPerInner.get(evento.innerCode),
              campiStoria: storiaEvento,
            },
          );
          const totaleValidato = totaleReferenzeNelGruppo > 0 ? totaleReferenzeNelGruppo : 1;
          const dimensioneGruppo = TracciatoService.resolveGroupSizeFromScattoCodice(evento.rec.scatto_codice, evento.rec.codice_referenza);
          const contributoEvento = Math.max(0, contributoRaw) / (totaleValidato * dimensioneGruppo);
          piCorrente = TracciatoService.sottraiPercentualeDaPi(piCorrente, contributoEvento);
          if (eventoHaTerremoto) {
            hasTerremoto = true;
            nextPrevEvents.set(evento.innerCode, evento.tipo);
          } else {
            prevEventsToClear.add(evento.innerCode);
          }
        }

        const contributo = piPrimaDellEvento > 0
          ? ((piPrimaDellEvento - piCorrente) / piPrimaDellEvento) * 100
          : 0;
        const campiStoria = TracciatoService.mergeStorieForInners(allInnerCodes, campiStoriaPerInner);
        const scattoCodice = firstRec?.scatto_codice ?? info.scattoCodice;
        const codiceReferenza = firstRec?.codice_referenza ?? info.codiceReferenza;

        piPerKey.set(matrixKey, piCorrente);
        celle.push({
          outerKey: info.outerKey,
          canaleArea: info.canaleArea,
          repartoNome,
          confrontoIndex: i,
          labelPrimario: confronto.primarioNome,
          labelSecondario: confronto.secondarioNome,
          stato,
          campiModificatiCumulativi: [...campiCumulativi].sort(),
          campiDettaglio,
          campiStoria,
          piPrimaDellEvento,
          contributo,
          piDopoEvento: piCorrente,
          hasTerremoto,
          totaleReferenzeNelGruppo,
          scattoCodice,
          codiceReferenza,
        });
      }

      for (const innerCode of prevEventsToClear) prevEventPerInner.delete(innerCode);
      for (const [innerCode, event] of nextPrevEvents) prevEventPerInner.set(innerCode, event);
      matrice.push({
        confrontoIndex: i,
        labelPrimario: confronto.primarioNome,
        labelSecondario: confronto.secondarioNome,
        terremotoDegradoMassimo: confronto.terremotoDegradoMassimo,
        celle,
      });
    }

    return matrice;
  }

  private mapToDTO = (tracciato: TracciatiAttributes, getBlob = true): TracciatiResponseDTO => {
    const blob = tracciato.blobfile_tracciati;
    return {
      id: tracciato.id_tracciati as string,
      id_promo: tracciato.id_promo_tracciati as string,
      context: tracciato.context_tracciati,
      filename: tracciato.filename_tracciati,
      stato: tracciato.stato_tracciati,
      ...(getBlob && { blobfile: blob }),
      filesize: blob ? Buffer.from(blob).length : undefined,
      createdat: tracciato.createdat as Date,
      updatedat: tracciato.updatedat as Date
    };
  };

  async getAllTracciati(includeBlob = false): Promise<TracciatiResponseDTO[]> {
    try {
      const tracciati = await this.tracciatiRepository.findAll();
      return tracciati.map((tracciato: TracciatiAttributes) => {
        return this.mapToDTO(tracciato, includeBlob);
      });
    } catch (error) {
      log.error('Error in getAllTracciati:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero di tutti i tracciati',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async getTracciatoById(id: string, includeBlob = false): Promise<TracciatiResponseDTO | null> {
    try {
      const tracciato = await this.tracciatiRepository.findById(id);
      return tracciato ? this.mapToDTO(tracciato as TracciatiAttributes, includeBlob) : null;
    } catch (error) {
      log.error('Error in getTracciatoById:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero del tracciato per ID',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async createTracciato(data: CreateTracciatiDTO): Promise<TracciatiResponseDTO> {
    try {
      const dataToCreate: Partial<TracciatiAttributes> = {
        id_promo_tracciati: data.id_promo,
        context_tracciati: data.context,
        filename_tracciati: data.filename,
        blobfile_tracciati: data.blobfile,
      };
      const tracciato = await this.tracciatiRepository.create(dataToCreate);
      return this.mapToDTO(tracciato as TracciatiAttributes);
    } catch (error) {
      log.error('Error in createTracciato:', error);
      throw new DatabaseError({
        message: 'Errore durante la creazione del tracciato',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async updateTracciato(id: string, data: Partial<CreateTracciatiDTO>): Promise<TracciatiResponseDTO | null> {
    try {
      // Mappa i campi DTO agli attributi del modello
      const updateData: Partial<TracciatiAttributes> = {
        ...(data.id_promo !== undefined && { id_promo_tracciati: data.id_promo }),
        ...(data.context !== undefined && { context_tracciati: data.context }),
        ...(data.filename !== undefined && { filename_tracciati: data.filename }),
        ...(data.blobfile !== undefined && { blobfile_tracciati: data.blobfile }),
      };

      const tracciatoAggiornato = await this.tracciatiRepository.update(id, updateData);

      if (!tracciatoAggiornato) return null;
      return this.mapToDTO(tracciatoAggiornato as TracciatiAttributes);
    } catch (error) {
      log.error('Error in updateTracciato:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento del tracciato',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async deleteTracciato(id: string): Promise<boolean> {
    try {
      return await this.tracciatiRepository.delete(id);
    } catch (error) {
      log.error('Error in deleteTracciato:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'eliminazione del tracciato',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }



  async getTracciatiByPromoId(promoId: string, includeBlob = false): Promise<TracciatiResponseDTO[]> {
    try {
      const tracciati = await this.tracciatiRepository.findByPromoId(promoId);
      return tracciati.map((tracciato: TracciatiAttributes) => this.mapToDTO(tracciato, includeBlob));
    } catch (error) {
      log.error('Error in getTracciatiByPromoId:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei tracciati per ID promo',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async getTracciatiByDataCreazione(dataInizio: Date, dataFine: Date): Promise<TracciatiResponseDTO[]> {
    try {
      const tracciati = await this.tracciatiRepository.findByDateRange(dataInizio, dataFine);
      if (!tracciati || tracciati.length === 0) {
        return [];
      }
      return tracciati.map((tracciato: TracciatiAttributes) => this.mapToDTO(tracciato));
    } catch (error) {
      log.error('Error in getTracciatiByDataCreazione:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei tracciati per data di creazione',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async getTracciatiByDataModifica(dataInizio: Date, dataFine: Date): Promise<TracciatiResponseDTO[]> {
    try {
      const tracciati = await this.tracciatiRepository.findByUpdateDateRange(dataInizio, dataFine);
      return tracciati.map((tracciato: TracciatiAttributes) => this.mapToDTO(tracciato));
    } catch (error) {
      log.error('Error in getTracciatiByDataModifica:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei tracciati per data di modifica',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async searchTracciati(query: string): Promise<TracciatiResponseDTO[]> {
    try {
      const tracciati = await this.tracciatiRepository.search(query);
      return tracciati.map((tracciato: TracciatiAttributes) => this.mapToDTO(tracciato));
    } catch (error) {
      log.error('Error in searchTracciati:', error);
      throw new DatabaseError({
        message: 'Errore durante la ricerca dei tracciati',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async getTracciatiByFilters(filters: {
    gdoId?: string;
    promoId?: string;
    stato?: string;
    tipo?: string;
    dataCreazioneInizio?: Date;
    dataCreazioneFine?: Date;
    dataModificaInizio?: Date;
    dataModificaFine?: Date;
  }): Promise<TracciatiResponseDTO[]> {
    try {
      // Use repository findAll for now - repository can be extended with filter support
      const tracciati = await this.tracciatiRepository.findAll();
      // Filter in memory for now (can be optimized in repository)
      let filtered = tracciati;
      if (filters.promoId) {
        filtered = filtered.filter((t: any) => t.id_promo_tracciati === filters.promoId);
      }
      return filtered.map((tracciato: TracciatiAttributes) => this.mapToDTO(tracciato));
    } catch (error) {
      log.error('Error in getTracciatiByFilters:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei tracciati con filtri',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async processTracciato(id: string): Promise<TracciatiResponseDTO | null> {
    try {
      const tracciato = await this.tracciatiRepository.findById(id);
      if (!tracciato) return null;

      // Implementa la logica di elaborazione del tracciato
      const updated = await this.tracciatiRepository.update(id, {
        updatedat: new Date()
      });

      return updated ? this.mapToDTO(updated as TracciatiAttributes) : null;
    } catch (error) {
      log.error('Error in processTracciato:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'elaborazione del tracciato',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async validateTracciato(id: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const tracciato = await this.tracciatiRepository.findById(id);
      if (!tracciato) {
        return { isValid: false, errors: ['Tracciato not found'] };
      }

      const errors: string[] = [];
      const tracciatoData = tracciato as unknown as TracciatiAttributes;

      // Implementa la logica di validazione
      if (!tracciatoData.filename_tracciati) errors.push('FileName is required');
      if (!tracciatoData.id_promo_tracciati) errors.push('Promo ID is required');
      if (!tracciatoData.context_tracciati) errors.push('Context is required');
      if (!tracciatoData.blobfile_tracciati) errors.push('Blob file is required');

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      log.error('Error in validateTracciato:', error);
      throw new DatabaseError({
        message: 'Errore durante la validazione del tracciato',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async getAllTracciatiPerPromo(idPromo: string): Promise<TracciatiResponseDTO[]> {
    try {
      if (!idPromo) {
        throw new BadRequestError({
          message: 'ID Promo non specificato',
          details: { field: 'idPromo' },
        });
      }

      const tracciati = await this.tracciatiRepository.findByPromoId(idPromo);
      return tracciati.map((tracciato: TracciatiAttributes) => this.mapToDTO(tracciato, false));
    } catch (error) {
      log.error('Error in getAllTracciatiPerPromo:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei tracciati per ID promo',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async parseTracciatoById(id: string): Promise<{ sheets: { name: string; rows: (string | number | null)[][] }[] }> {
    try {
      const tracciato = await this.tracciatiRepository.findById(id);
      if (!tracciato) {
        throw new NotFoundError({
          message: 'Tracciato non trovato',
          entityType: 'Tracciati',
          entityId: id,
        });
      }

      const tracciatoData = tracciato as unknown as TracciatiAttributes;
      if (!tracciatoData.blobfile_tracciati) {
        throw new BadRequestError({
          message: 'Il tracciato non contiene un file',
          details: { entityType: 'Tracciati', entityId: id },
        });
      }

      // Converti il buffer in workbook
      const buffer = Buffer.from(tracciatoData.blobfile_tracciati);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });

      // Processa tutti i fogli
      const sheets = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];

        // Converti il foglio in array di array, mantenendo TUTTI i dati
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          blankrows: true,
          raw: false // Formatta i valori come stringhe
        }) as (string | number | null)[][];

        return {
          name: sheetName,
          rows: jsonData
        };
      });

      log.info(`Parsed tracciato ${id}: ${sheets.length} sheets`);

      return { sheets };
    } catch (error) {
      log.error('Error in parseTracciatoById:', error);
      throw new DatabaseError({
        message: 'Errore durante il parsing del tracciato',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }


  async getReportsConfronto(idPromo: string): Promise<SavedReportConfrontoSummary[]> {
    const records = await this.reportRepository.findByPromoId(idPromo);
    return records.map((r: any) => ({
      id: r.id,
      idPromo: r.id_promo,
      reportTitle: (r.report as any)?.title ?? '',
      reportSubtitle: (r.report as any)?.subtitle,
      createdAt: (r.createdat as Date).toISOString(),
    }));
  }

  async getReportConfrontoById(id: string): Promise<SavedReportConfronto | null> {
    const r = await this.reportRepository.findById(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      idPromo: r.id_promo,
      reportTitle: r.report?.title ?? '',
      reportSubtitle: r.report?.subtitle,
      createdAt: (r.createdat as Date).toISOString(),
      tracciatiIds: r.tracciati_ids,
      context: r.context,
      istantaResult: r.istanta_result,
      report: r.report,
    };
  }

  private mapMomentoToDTO(
    r: any,
    excludeRisultato: boolean,
    confrontiConRisultato: string[] = [],
    confrontiConId: Array<{ momentoId: string; confrontoId: string; terremotoDegradoMassimo?: number | null }> = [],
  ): TracciatiMomentoResponseDTO {
    return {
      id: r.id,
      id_promo: r.id_promo,
      nome: r.nome,
      tracciati_ids: r.tracciati_ids ?? [],
      confronti_ids: r.confronti_ids ?? [],
      confronti_con_risultato: confrontiConRisultato,
      confronti_con_id: confrontiConId,
      ordine: r.ordine ?? 0,
      snapshot: r.snapshot ?? false,
      risultato: excludeRisultato ? undefined : ((r.risultato as AnalisiMomentoTracciato[]) ?? null),
      hasRisultato: ((r.risultato as AnalisiMomentoTracciato[]) != null),
      createdat: r.createdat instanceof Date ? r.createdat.toISOString() : r.createdat,
      updatedat: r.updatedat instanceof Date ? r.updatedat.toISOString() : r.updatedat,
    };
  }

  private mapMomentoConfrontoToDTO(r: any, excludeRisultato = true): TracciatiMomentoConfrontoResponseDTO {
    const tipo: TracciatiMomentoConfrontoResponseDTO['tipo'] =
      r.tipo === 'lineare' || r.tipo === 'non_lineare'
        ? r.tipo
        : 'lineare';

    return {
      id: r.id,
      primario: r.primario,
      secondario: r.secondario,
      tipo,
      risultato: excludeRisultato ? undefined : ((r.risultato ?? null) as unknown | null),
      report: (r.report ?? null) as TracciatiMomentoConfrontoResponseDTO['report'],
      hasRisultato: r.risultato != null,
      terremoto_degrado_massimo: r.terremoto_degrado_massimo ?? null,
      createdat: r.createdat instanceof Date ? r.createdat.toISOString() : r.createdat,
      updatedat: r.updatedat instanceof Date ? r.updatedat.toISOString() : r.updatedat,
    };
  }

  private normalizeAnalisiTracciati(risultato: unknown): AnalisiMomentoTracciato[] {
    const source = (() => {
      if (Array.isArray(risultato)) return risultato;
      if (risultato && typeof risultato === 'object' && Array.isArray((risultato as any).tracciati)) {
        return (risultato as any).tracciati as unknown[];
      }
      return [];
    })();

    return source
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const raw = item as Record<string, unknown>;
        const contextValue = raw.context;
        const normalizedContext = typeof contextValue === 'string'
          ? contextValue
          : JSON.stringify(contextValue ?? []);

        const rawRecords = Array.isArray(raw.records) ? raw.records : [];
        const records = rawRecords
          .filter((r) => r != null && typeof r === 'object')
          .map((r) => ({ ...(r as DataFields) }));

        return {
          guidCanale: String(raw.guidCanale ?? ''),
          guidArea: String(raw.guidArea ?? ''),
          context: normalizedContext,
          records,
        } satisfies AnalisiMomentoTracciato;
      })
      .filter((t): t is AnalisiMomentoTracciato => t !== null);
  }

  private findReferenzaCodice(record: Record<string, unknown>): string | null {
    const direct = record['Referenza.Codice'];
    if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();

    const referenza = record.Referenza as Record<string, unknown> | undefined;
    const nested = referenza?.Codice;
    if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim();

    return null;
  }

  private mergeRecordsByReferenzaCodice(
    baseRecords: Array<Record<string, unknown>>,
    incomingRecords: Array<Record<string, unknown>>,
  ): Array<DataFields> {
    const queueByCodice = new Map<string, Array<Record<string, unknown>>>();
    const incomingWithoutCodice: Array<Record<string, unknown>> = [];

    incomingRecords.forEach((record) => {
      const codice = this.findReferenzaCodice(record);
      if (!codice) {
        incomingWithoutCodice.push(record);
        return;
      }
      const queue = queueByCodice.get(codice) ?? [];
      queue.push(record);
      queueByCodice.set(codice, queue);
    });

    const castToDataFields = (obj: Record<string, unknown>): DataFields => {
      const result: DataFields = {};
      for (const key in obj) {
        const value = obj[key];
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          (Array.isArray(value) && value.every(v => typeof v === "string")) ||
          (Array.isArray(value) && value.every(v => typeof v === "object" && v !== null && "codice" in v && "descrizione" in v))
        ) {
          // Acceptable types for DataFields
          result[key] = value as any;
        } else if (value === null || value === undefined) {
          // Optionally skip or set as undefined
          // result[key] = undefined as any;
        } else {
          // Fallback: convert to string
          result[key] = String(value);
        }
      }
      return result;
    };
    const merged: Array<DataFields> = baseRecords.map((record) => {
      const codice = this.findReferenzaCodice(record);
      // Helper to cast all values to DataFields value type

      if (!codice) return castToDataFields(record);
      const queue = queueByCodice.get(codice);
      if (!queue || queue.length === 0) return castToDataFields(record);
      const next = queue.shift() as Record<string, unknown>;
      return castToDataFields({ ...record, ...next });
    });

    queueByCodice.forEach((queue) => {
      queue.forEach((record) => merged.push(castToDataFields(record)));
    });
    incomingWithoutCodice.forEach((record) => merged.push(castToDataFields(record)));

    return merged;
  }

  private mergeConfrontoTracciati(
    source: AnalisiMomentoTracciato[],
    incoming: unknown,
  ): AnalisiMomentoTracciato[] {
    const incomingNormalized = this.normalizeAnalisiTracciati(incoming);
    const byKey = new Map<string, AnalisiMomentoTracciato>();

    source.forEach((item) => {
      const key = `${item.guidArea}::${item.guidCanale}::${item.context}`;
      byKey.set(key, {
        ...item,
        records: Array.isArray(item.records) ? item.records.map((r) => ({ ...r })) : [],
      });
    });

    incomingNormalized.forEach((item) => {
      const key = `${item.guidArea}::${item.guidCanale}::${item.context}`;
      const current = byKey.get(key);
      const incomingRecords = Array.isArray(item.records)
        ? item.records.map((r) => ({ ...r }))
        : [];

      if (!current) {
        byKey.set(key, { ...item, records: incomingRecords });
        return;
      }

      const baseRecords = Array.isArray(current.records)
        ? current.records.map((r) => ({ ...r }))
        : [];

      byKey.set(key, {
        ...current,
        ...item,
        records: this.mergeRecordsByReferenzaCodice(baseRecords, incomingRecords),
      });
    });

    return [...byKey.values()];
  }

  async getMomentiPerPromo(idPromo: string): Promise<TracciatiMomentoResponseDTO[]> {
    try {
      const momenti = await this.momentoRepository.findByPromoId(idPromo);
      if (momenti.length === 0) return [];

      const ids = momenti.map((m) => m.id);
      const confronti = await this.momentoRepository.findConfrontiByMomentoIds(ids);

      // Per ogni momento, lista degli ID degli altri momenti con confronto già calcolato
      // e lista degli ID confronto usati dalla UI per modificare i metadati del collegamento.
      const confrontiConRisultatoMap = new Map<string, string[]>();
      const confrontiConIdMap = new Map<string, Array<{ momentoId: string; confrontoId: string; terremotoDegradoMassimo?: number | null }>>();
      for (const c of confronti) {
        const { id: confrontoId, primario, secondario, tipo, terremoto_degrado_massimo } = c as any;
        const hasRisultato = Boolean((c as any).get?.('hasRisultato') ?? (c as any).hasRisultato);
        if (!confrontiConRisultatoMap.has(primario)) confrontiConRisultatoMap.set(primario, []);
        if (!confrontiConRisultatoMap.has(secondario)) confrontiConRisultatoMap.set(secondario, []);
        if (hasRisultato) {
          confrontiConRisultatoMap.get(primario)!.push(secondario);
          confrontiConRisultatoMap.get(secondario)!.push(primario);
        }

        const terremoto = tipo === 'lineare' ? (terremoto_degrado_massimo ?? null) : undefined;
        if (!confrontiConIdMap.has(primario)) confrontiConIdMap.set(primario, []);
        if (!confrontiConIdMap.has(secondario)) confrontiConIdMap.set(secondario, []);
        confrontiConIdMap.get(primario)!.push({ momentoId: secondario, confrontoId, terremotoDegradoMassimo: terremoto });
        confrontiConIdMap.get(secondario)!.push({ momentoId: primario, confrontoId, terremotoDegradoMassimo: terremoto });
      }

      return momenti.map((m) =>
        this.mapMomentoToDTO(m, true, confrontiConRisultatoMap.get(m.id) ?? [], confrontiConIdMap.get(m.id) ?? [])
      );
    } catch (error) {
      log.error('Error in getMomentiPerPromo:', error);
      throw new DatabaseError({
        message: 'Errore durante il recupero dei momenti',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async createMomento(idPromo: string, nome: string, snapshot = false): Promise<TracciatiMomentoResponseDTO> {
    try {
      const existing = await this.momentoRepository.findByPromoId(idPromo);
      const ordine = existing.length;
      const created = await this.momentoRepository.create({
        id_promo: idPromo,
        nome,
        tracciati_ids: [],
        confronti_ids: [],
        ordine,
        snapshot,
        createdat: new Date(),
        updatedat: new Date(),
      });
      return this.mapMomentoToDTO(created, true);
    } catch (error) {
      log.error('Error in createMomento:', error);
      throw new DatabaseError({
        message: 'Errore durante la creazione del momento',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async updateMomento(id: string, data: { nome?: string; tracciati_ids?: string[]; confronti_ids?: string[]; ordine?: number }): Promise<TracciatiMomentoResponseDTO | null> {
    try {
      const updated = await this.momentoRepository.update(id, {
        ...data,
        updatedat: new Date(),
      });
      return updated ? this.mapMomentoToDTO(updated, true) : null;
    } catch (error) {
      log.error('Error in updateMomento:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'aggiornamento del momento',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async deleteMomento(id: string): Promise<boolean> {
    try {
      const momento = await this.momentoRepository.findById(id);
      if (!momento) return false;

      const confrontiByMomento = await this.momentoRepository.findConfrontiByMomentoId(id);
      for (const confronto of confrontiByMomento) {
        await this.momentoRepository.deleteConfronto(confronto.id);
      }

      const samePromo = await this.momentoRepository.findByPromoId(momento.id_promo);
      for (const other of samePromo) {
        if (other.id === id) continue;
        const currentConfronti = (other as any).confronti_ids as string[] | undefined;
        if (!Array.isArray(currentConfronti) || !currentConfronti.includes(id)) continue;
        await this.momentoRepository.update(other.id, {
          confronti_ids: currentConfronti.filter((linkedId) => linkedId !== id),
          updatedat: new Date(),
        } as any);
      }

      return await this.momentoRepository.delete(id);
    } catch (error) {
      log.error('Error in deleteMomento:', error);
      throw new DatabaseError({
        message: 'Errore durante l\'eliminazione del momento',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async calcolaRisultatoMomento(idMomento: string, req: Request): Promise<TracciatiMomentoResponseDTO> {
    try {
      const momento = await this.momentoRepository.findById(idMomento);
      if (!momento) {
        throw new NotFoundError({ message: 'Momento non trovato', entityType: 'TracciatiMomento' });
      }

      const oggettoPerIstantaAnalisi = {
        guidPromo: momento.id_promo,
        snapshot: momento.snapshot ?? false,
        listeCaricate: momento.tracciati_ids
      }
      // analisiMomento chiamata ad Istanta
      const { data: analisiData } = await ServerUtils.sendToFICOApi<AnalisiMomentoResponse>(
        req,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/analisiMomento`,
        "POST",
        oggettoPerIstantaAnalisi
      );
      log.info("DATO IN ARRIVO DA ISTANTA " + String(analisiData.esito))
      // Persiste solo l'array tracciati nel campo `risultato` del momento
      const updated = await this.momentoRepository.update(idMomento, {
        risultato: analisiData.tracciati,
        updatedat: new Date(),
      });
      return this.mapMomentoToDTO(updated ?? momento, true);
    } catch (error) {
      log.error('Error in calcolaRisultatoMomento:', error);
      throw error instanceof NotFoundError
        ? error
        : new DatabaseError({
          message: 'Errore durante il calcolo del risultato del momento',
          cause: error instanceof Error ? error : undefined,
        });
    }
  }

  async createMomentoConfronto(primario: string, secondario: string, terremotoDegradoMassimo?: number | null): Promise<TracciatiMomentoConfrontoResponseDTO> {
    if (primario === secondario) {
      throw new BadRequestError({ message: 'primario e secondario devono essere momenti diversi' });
    }

    const momentoA = await this.momentoRepository.findById(primario);
    const momentoB = await this.momentoRepository.findById(secondario);

    if (!momentoA || !momentoB) {
      throw new NotFoundError({ message: 'Momento non trovato', entityType: 'TracciatiMomento' });
    }

    if (momentoA.id_promo !== momentoB.id_promo) {
      throw new BadRequestError({ message: 'I momenti devono appartenere alla stessa promo' });
    }

    const ordered = [momentoA, momentoB].sort((a, b) => {
      const byOrdine = (a.ordine ?? 0) - (b.ordine ?? 0);
      if (byOrdine !== 0) return byOrdine;
      return a.id.localeCompare(b.id);
    });

    const orderedPrimario = ordered[0].id;
    const orderedSecondario = ordered[1].id;

    const tipo: 'lineare' | 'non_lineare' =
      Math.abs((momentoA.ordine ?? 0) - (momentoB.ordine ?? 0)) === 1 ? 'lineare' : 'non_lineare';

    const existing = await this.momentoRepository.findConfrontoByPair(orderedPrimario, orderedSecondario);
    if (existing) {
      let confronto = existing;
      if ((existing.tipo !== 'lineare' && existing.tipo !== 'non_lineare') || existing.tipo !== tipo) {
        confronto = await this.momentoRepository.updateConfronto(existing.id, {
          tipo,
          updatedat: new Date(),
        } as any);
      }

      if (terremotoDegradoMassimo !== undefined && confronto) {
        confronto = await this.momentoRepository.updateConfronto(confronto.id, {
          terremoto_degrado_massimo: terremotoDegradoMassimo,
          updatedat: new Date(),
        } as any) ?? confronto;
      }

      if (tipo === 'non_lineare') {
        const [aData, bData] = await Promise.all([
          this.momentoRepository.findById(orderedPrimario),
          this.momentoRepository.findById(orderedSecondario),
        ]);

        const aIds = [...new Set([...(aData?.confronti_ids ?? []), orderedSecondario])];
        const bIds = [...new Set([...(bData?.confronti_ids ?? []), orderedPrimario])];
        const updates: Promise<unknown>[] = [];

        if ((aData?.confronti_ids ?? []).length !== aIds.length) {
          updates.push(this.momentoRepository.update(orderedPrimario, { confronti_ids: aIds, updatedat: new Date() } as any));
        }

        if ((bData?.confronti_ids ?? []).length !== bIds.length) {
          updates.push(this.momentoRepository.update(orderedSecondario, { confronti_ids: bIds, updatedat: new Date() } as any));
        }

        if (updates.length > 0) {
          await Promise.all(updates);
        }
      }

      return this.mapMomentoConfrontoToDTO(confronto, true);
    }

    const created = await this.momentoRepository.createConfronto({
      primario: orderedPrimario,
      secondario: orderedSecondario,
      tipo,
      risultato: null,
      terremoto_degrado_massimo: terremotoDegradoMassimo ?? null,
      createdat: new Date(),
      updatedat: new Date(),
    });

    if (tipo === 'non_lineare') {
      const [aData, bData] = await Promise.all([
        this.momentoRepository.findById(orderedPrimario),
        this.momentoRepository.findById(orderedSecondario),
      ]);
      const aIds = [...new Set([...(aData?.confronti_ids ?? []), orderedSecondario])];
      const bIds = [...new Set([...(bData?.confronti_ids ?? []), orderedPrimario])];
      await Promise.all([
        this.momentoRepository.update(orderedPrimario, { confronti_ids: aIds, updatedat: new Date() } as any),
        this.momentoRepository.update(orderedSecondario, { confronti_ids: bIds, updatedat: new Date() } as any),
      ]);
    }

    return this.mapMomentoConfrontoToDTO(created, true);
  }

  async getMomentoConfrontoById(idConfronto: string): Promise<TracciatiMomentoConfrontoResponseDTO | null> {
    const confronto = await this.momentoRepository.findConfrontoById(idConfronto);
    if (!confronto) return null;
    return this.mapMomentoConfrontoToDTO(confronto, true);
  }

  async updateConfrontoMeta(
    idConfronto: string,
    data: { terremoto_degrado_massimo?: number | null },
  ): Promise<TracciatiMomentoConfrontoResponseDTO | null> {
    const confronto = await this.momentoRepository.findConfrontoById(idConfronto);
    if (!confronto) return null;

    const rawTerremoto = data.terremoto_degrado_massimo;
    const terremoto_degrado_massimo = rawTerremoto == null ? null : Number(rawTerremoto);
    if (
      terremoto_degrado_massimo !== null &&
      (!Number.isFinite(terremoto_degrado_massimo) || terremoto_degrado_massimo < 0 || terremoto_degrado_massimo > 100)
    ) {
      throw new BadRequestError({ message: 'terremoto_degrado_massimo deve essere un numero tra 0 e 100 oppure null' });
    }

    const updated = await this.momentoRepository.updateConfronto(idConfronto, {
      terremoto_degrado_massimo,
      updatedat: new Date(),
    });
    return this.mapMomentoConfrontoToDTO(updated ?? confronto, true);
  }

  async calcolaRisultatoMomentoConfronto(idConfronto: string, req: Request): Promise<TracciatiMomentoConfrontoResponseDTO> {
    const confronto = await this.momentoRepository.findConfrontoById(idConfronto);
    if (!confronto) {
      throw new NotFoundError({ message: 'Confronto momento non trovato', entityType: 'TracciatiMomentoConfronto' });
    }

    const primario = await this.momentoRepository.findById(confronto.primario);
    const secondario = await this.momentoRepository.findById(confronto.secondario);

    if (!primario || !secondario) {
      throw new NotFoundError({ message: 'Momento collegato al confronto non trovato', entityType: 'TracciatiMomento' });
    }

    if (primario.risultato == null || secondario.risultato == null) {
      throw new BadRequestError({ message: 'Entrambi i momenti devono avere un risultato prima del confronto' });
    }

    const primarioTracciati = this.normalizeAnalisiTracciati(primario.risultato);
    const secondarioTracciati = this.normalizeAnalisiTracciati(secondario.risultato);
    if (primarioTracciati.length === 0 || secondarioTracciati.length === 0) {
      throw new BadRequestError({ message: 'Risultato momento non valido: lista tracciati assente per primario o secondario' });
    }

    const payloadIstanta = {
      primario: {
        guidId: primario.id,
        tracciati: primarioTracciati,
      },
      secondario: {
        guidId: secondario.id,
        tracciati: secondarioTracciati,
      },
    };
    console.log(payloadIstanta);
    const { data: analisiConfronto, status, statusText } = await ServerUtils.sendToFICOApi<unknown>(
      req,
      `${config.ISTANTA_IP_ADDRESS}/FicoProcess/analisiConfronto`,
      "POST",
      payloadIstanta,
    );
    log.info("STATUS");
    log.info(status.toString());
    log.info("STATUS TEXT");
    log.info(statusText);
    log.info("DATO FINALE");
    log.info(analisiConfronto.toString());
    const confrontoObj = (analisiConfronto && typeof analisiConfronto === 'object')
      ? (analisiConfronto as Record<string, unknown>)
      : {};
    const primarioObj = (confrontoObj.primario && typeof confrontoObj.primario === 'object')
      ? (confrontoObj.primario as Record<string, unknown>)
      : {};
    const secondarioObj = (confrontoObj.secondario && typeof confrontoObj.secondario === 'object')
      ? (confrontoObj.secondario as Record<string, unknown>)
      : {};

    const risultatoConfronto: RisultatoConfrontoMomento = {
      ...confrontoObj,
      primario: {
        ...primarioObj,
        guidId: primario.id,
        nomeMomento: primario.nome,
        tracciati: this.mergeConfrontoTracciati(primarioTracciati, primarioObj.tracciati),
      },
      secondario: {
        ...secondarioObj,
        guidId: secondario.id,
        nomeMomento: secondario.nome,
        tracciati: this.mergeConfrontoTracciati(secondarioTracciati, secondarioObj.tracciati),
      },
    } as RisultatoConfrontoMomento;

    const report = await this.agenziaLib.elaboraDatoPerAgenzia(risultatoConfronto);

    // ── Arricchimento views con nomi canale/area da DB ────────────────────────
    if (report.viewsPerCanaleArea?.length) {
      const guidCanali = [...new Set(report.viewsPerCanaleArea.map(v => v.guidCanale))];
      const guidAree = [...new Set(report.viewsPerCanaleArea.map(v => v.guidArea))];
      const [canali, aree] = await Promise.all([
        Canale.findAll({ where: { id_canali: { [Op.in]: guidCanali } }, attributes: ['id_canali', 'nome_canali'] }),
        Area.findAll({ where: { id_aree: { [Op.in]: guidAree } }, attributes: ['id_aree', 'nome_aree'] }),
      ]);
      const canaleMap = new Map(canali.map(c => [c.id_canali as string, c.nome_canali as string]));
      const areaMap = new Map(aree.map(a => [a.id_aree as string, a.nome_aree as string]));
      for (const view of report.viewsPerCanaleArea) {
        view.nomeCanale = canaleMap.get(view.guidCanale) ?? view.guidCanale;
        view.nomeArea = areaMap.get(view.guidArea) ?? view.guidArea;
        view.label = `${view.nomeCanale} — ${view.nomeArea}`;
      }
    }

    const updated = await this.momentoRepository.updateConfronto(idConfronto, {
      risultato: risultatoConfronto,
      report,
      updatedat: new Date(),
    });

    return this.mapMomentoConfrontoToDTO(updated ?? confronto, true);
  }
  async resetRisultatoMomento(idMomento: string): Promise<TracciatiMomentoResponseDTO | null> {
    const momento = await this.momentoRepository.findById(idMomento);
    if (!momento) {
      throw new NotFoundError({ message: 'Momento non trovato', entityType: 'TracciatiMomento' });
    }
    const updated = await this.momentoRepository.update(idMomento, {
      risultato: null,
      updatedat: new Date(),
    } as any);
    return this.mapMomentoToDTO(updated ?? momento, true);
  }

  async resetRisultatoConfronto(idConfronto: string): Promise<TracciatiMomentoConfrontoResponseDTO | null> {
    const confronto = await this.momentoRepository.findConfrontoById(idConfronto);
    if (!confronto) {
      throw new NotFoundError({ message: 'Confronto non trovato', entityType: 'TracciatiMomentoConfronto' });
    }
    const updated = await this.momentoRepository.updateConfronto(idConfronto, {
      risultato: null,
      report: null,
      updatedat: new Date(),
    });
    return this.mapMomentoConfrontoToDTO(updated ?? confronto, false);
  }

  async getPromoScoreboard(idPromo: string): Promise<TracciatoReport | null> {
    try {
      const rows = await sequelize.query<{ report: TracciatoReport }>(
        `
          SELECT report
          FROM promo_scoreboard
          WHERE id_promo = :idPromo
          LIMIT 1
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { idPromo },
        },
      );
      const row = rows[0] ?? null;
      return row?.report ?? null;
    } catch (error) {
      log.error('Error in getPromoScoreboard:', error);
      throw new DatabaseError({ message: 'Errore durante il recupero dello scoreboard promo', cause: error instanceof Error ? error : undefined });
    }
  }

  async getAllPromoScoreboards(): Promise<SavedPromoScoreboard[]> {
    try {
      let rows = await sequelize.query<{
        id_promo: string;
        report: TracciatoReport;
        computedat: string | Date;
      }>(
        `
          SELECT id_promo, report, computedat
          FROM promo_scoreboard
          ORDER BY computedat ASC
        `,
        { type: QueryTypes.SELECT },
      );
      if (rows.length === 0) return [];

      const promoIds = [...new Set(rows.map(row => row.id_promo))];
      const promos = await sequelize.query<{
        id_promo: string;
        nome_promo: string;
        data_scadenza: string | Date | null;
      }>(
        `
          SELECT id_promo, nome_promo, data_scadenza
          FROM promo
          WHERE id_promo IN (:promoIds)
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { promoIds },
        },
      );
      const promoNameById = new Map(
        promos.map(promo => [promo.id_promo as string, {
          nome: promo.nome_promo,
          data: promo.data_scadenza
        }]),
      );

      // Ordina per data promo (ascendente), poi per computedAt (ascendente)
      rows = rows.sort((a, b) => {
        const aDataRaw = promoNameById.get(a.id_promo)?.data;
        const bDataRaw = promoNameById.get(b.id_promo)?.data;
        const aData = aDataRaw ? new Date(typeof aDataRaw === 'string' ? aDataRaw : aDataRaw.toISOString()) : new Date(0);
        const bData = bDataRaw ? new Date(typeof bDataRaw === 'string' ? bDataRaw : bDataRaw.toISOString()) : new Date(0);
        if (aData.getTime() !== bData.getTime()) {
          return aData.getTime() - bData.getTime();
        }
        // fallback: ordina per computedat
        const aComputed = a.computedat ? new Date(typeof a.computedat === 'string' ? a.computedat : a.computedat.toISOString()) : new Date(0);
        const bComputed = b.computedat ? new Date(typeof b.computedat === 'string' ? b.computedat : b.computedat.toISOString()) : new Date(0);
        return aComputed.getTime() - bComputed.getTime();
      });

      return rows.map((row) => ({
        // Compatibilità con schema legacy senza colonna "id" su promo_scoreboard
        id: row.id_promo,
        idPromo: row.id_promo,
        promoNome: promoNameById.get(row.id_promo)?.nome ?? row.id_promo,
        data: promoNameById.get(row.id_promo)?.data,
        computedAt: new Date(row.computedat).toISOString(),
        report: row.report,
      }));
    } catch (error) {
      log.error('Error in getAllPromoScoreboards:', error);
      throw new DatabaseError({ message: 'Errore durante il recupero degli scoreboard promo', cause: error instanceof Error ? error : undefined });
    }
  }

  async getCategoryScoreboardTimeline(settoriNomi: string[]): Promise<CategoryScoreboardTimeline> {
    if (!settoriNomi.length) return { promos: [], series: [], canaleAreaSeries: [], settoriNomi: [] };

    const allScoreboards = await this.getAllPromoScoreboards();
    const allowed = new Set(settoriNomi);
    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
    const getRepartoScoreFromWidgets = (
      widgets: { type: string }[],
      reparto: string,
    ): number | null => {
      for (const w of widgets) {
        if (w.type !== 'scoreboard') continue;
        const sw = w as unknown as { rows: TracciatoWidgetScoreboardRow[] };
        const row = sw.rows.find(r => r.reparto === reparto);
        if (row) return clamp(row.score);
      }
      return null;
    };
    const hasAllowedRepartoInWidgets = (widgets: { type: string }[]): boolean => {
      for (const w of widgets) {
        if (w.type !== 'scoreboard') continue;
        const sw = w as unknown as { rows: TracciatoWidgetScoreboardRow[] };
        if (sw.rows.some(r => allowed.has(r.reparto))) return true;
      }
      return false;
    };

    const filtered = allScoreboards.filter(sb =>
      hasAllowedRepartoInWidgets(sb.report.widgets as unknown as { type: string }[])
      || (sb.report.viewsPerCanaleArea ?? []).some(view =>
        hasAllowedRepartoInWidgets(view.widgets as unknown as { type: string }[]),
      ),
    );

    if (!filtered.length) return { promos: [], series: [], canaleAreaSeries: [], settoriNomi };

    const promoIds = [...new Set(filtered.map(sb => sb.idPromo))];
    const promoRecords = await sequelize.query<{
      id_promo: string;
      validita_dal: string | null;
      validita_al: string | null;
    }>(
      `
        SELECT id_promo, validita_dal, validita_al
        FROM promo
        WHERE id_promo IN (:promoIds)
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { promoIds },
      },
    );
    const promoDatesMap = new Map(promoRecords.map(p => [p.id_promo, { dal: p.validita_dal, al: p.validita_al }]));

    const promos = filtered.map(sb => {
      const dates = promoDatesMap.get(sb.idPromo);
      return {
        id: sb.id,
        nome: sb.promoNome,
        computedAt: sb.computedAt,
        validaDal: dates?.dal ? new Date(dates.dal).toISOString().slice(0, 10) : undefined,
        validaAl: dates?.al ? new Date(dates.al).toISOString().slice(0, 10) : undefined,
      };
    });

    const series = settoriNomi.map(reparto => {
      const data: (number | null)[] = filtered.map(sb => {
        // Prova prima i widget top-level (aggregato globale)
        const topLevel = getRepartoScoreFromWidgets(
          sb.report.widgets as unknown as { type: string }[],
          reparto,
        );
        if (topLevel !== null) return topLevel;

        // Fallback: media dei view per-canale/area che contengono il reparto
        const viewScores = (sb.report.viewsPerCanaleArea ?? [])
          .map(view => getRepartoScoreFromWidgets(
            view.widgets as unknown as { type: string }[],
            reparto,
          ))
          .filter((v): v is number => v !== null);

        return viewScores.length
          ? Math.round(viewScores.reduce((a, b) => a + b, 0) / viewScores.length)
          : null;
      });
      const nums = data.filter((v): v is number => v !== null);
      return {
        reparto,
        data,
        average: nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0,
      };
    });

    const canaleAreaMeta = new Map<string, {
      key: string;
      guidCanale: string;
      guidArea: string;
      label: string;
    }>();

    for (const sb of filtered) {
      for (const view of sb.report.viewsPerCanaleArea ?? []) {
        const key = `${view.guidCanale}::${view.guidArea}`;
        const hasAllowed = hasAllowedRepartoInWidgets(view.widgets as unknown as { type: string }[]);
        if (!hasAllowed) continue;
        if (!canaleAreaMeta.has(key)) {
          canaleAreaMeta.set(key, {
            key,
            guidCanale: view.guidCanale,
            guidArea: view.guidArea,
            label: view.label,
          });
        }
      }
    }

    const canaleAreaSeries = [...canaleAreaMeta.values()]
      .map(meta => {
        const seriesByReparto = settoriNomi.map(reparto => {
          const data: (number | null)[] = filtered.map(sb => {
            const view = (sb.report.viewsPerCanaleArea ?? [])
              .find(v => v.guidCanale === meta.guidCanale && v.guidArea === meta.guidArea);
            if (!view) return null;
            return getRepartoScoreFromWidgets(
              view.widgets as unknown as { type: string }[],
              reparto,
            );
          });
          const nums = data.filter((v): v is number => v !== null);
          return {
            reparto,
            data,
            average: nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0,
          };
        });

        const allScores = seriesByReparto.flatMap(s => s.data).filter((v): v is number => v !== null);
        return {
          ...meta,
          average: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
          series: seriesByReparto,
        };
      })
      .filter(view => view.series.some(s => s.data.some(value => value !== null)))
      .sort((a, b) => b.average - a.average || a.label.localeCompare(b.label));

    return { promos, series, canaleAreaSeries, settoriNomi };
  }

  async calcolaPromoScoreboard(idPromo: string): Promise<TracciatoReport> {
    try {
      if (!this.agenziaLib) {
        throw new NotFoundError({ message: 'Scoreboard non supportato per questo client', entityType: 'PromoScoreboard' });
      }

      const momenti = await this.momentoRepository.findByPromoId(idPromo);
      if (momenti.length === 0) {
        throw new NotFoundError({ message: 'Nessun momento trovato per questa promo', entityType: 'TracciatiMomento' });
      }

      const ids = momenti.map((m) => m.id);
      const confrontiRaw = await this.momentoRepository.findConfrontiWithRisultatoByMomentoIds(ids);

      if (confrontiRaw.length === 0) {
        throw new NotFoundError({ message: 'Nessun confronto con risultato disponibile per questa promo', entityType: 'TracciatiMomentoConfronto' });
      }

      const momentoNomeById = new Map(momenti.map((m) => [m.id, m.nome as string]));
      const momentoOrdineById = new Map(momenti.map((m, index) => [m.id, index]));

      const confrontiData = confrontiRaw
        .map((c: any) => {
          const risultato = c.risultato as RisultatoConfrontoMomento | null;
          if (!risultato) return null;
          return {
            primarioId: c.primario as string,
            secondarioId: c.secondario as string,
            primarioNome: momentoNomeById.get(c.primario) ?? c.primario,
            secondarioNome: momentoNomeById.get(c.secondario) ?? c.secondario,
            risultato,
            terremotoDegradoMassimo: c.terremoto_degrado_massimo ?? undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => {
          const aSecondario = momentoOrdineById.get(a.secondarioId) ?? Number.MAX_SAFE_INTEGER;
          const bSecondario = momentoOrdineById.get(b.secondarioId) ?? Number.MAX_SAFE_INTEGER;
          if (aSecondario !== bSecondario) return aSecondario - bSecondario;

          const aPrimario = momentoOrdineById.get(a.primarioId) ?? Number.MAX_SAFE_INTEGER;
          const bPrimario = momentoOrdineById.get(b.primarioId) ?? Number.MAX_SAFE_INTEGER;
          if (aPrimario !== bPrimario) return aPrimario - bPrimario;

          return a.secondarioNome.localeCompare(b.secondarioNome);
        })
        .map(({ primarioNome, secondarioNome, risultato, terremotoDegradoMassimo }) => ({
          primarioNome,
          secondarioNome,
          risultato,
          terremotoDegradoMassimo,
        }));

      if (confrontiData.length === 0) {
        throw new NotFoundError({ message: 'Nessun report di confronto disponibile', entityType: 'TracciatiMomentoConfronto' });
      }
      const normalizzati = await this.agenziaLib.normalizzaDatoConfrontoPerScore(confrontiData);

      const matrice = TracciatoService._buildMatricePromo(normalizzati, this.agenziaLib);
      const matriceConTerremoto = await this.agenziaLib.calcolaTerremotoPerMatriceDiValori(matrice);
      const report = await this.agenziaLib.buildScoreboardReport(matriceConTerremoto, normalizzati);

      // ── Arricchimento views con nomi canale/area da DB ──────────────────────
      const realViews = report.viewsPerCanaleArea?.filter(v => v.guidCanale !== '__all__') ?? [];
      if (realViews.length > 0) {
        const guidCanali = [...new Set(realViews.map(v => v.guidCanale))];
        const guidAree = [...new Set(realViews.map(v => v.guidArea))];
        const [canali, aree] = await Promise.all([
          Canale.findAll({ where: { id_canali: { [Op.in]: guidCanali } }, attributes: ['id_canali', 'nome_canali'] }),
          Area.findAll({ where: { id_aree: { [Op.in]: guidAree } }, attributes: ['id_aree', 'nome_aree'] }),
        ]);
        const canaleMap = new Map(canali.map(c => [c.id_canali as string, c.nome_canali as string]));
        const areaMap = new Map(aree.map(a => [a.id_aree as string, a.nome_aree as string]));
        for (const view of realViews) {
          view.nomeCanale = canaleMap.get(view.guidCanale) ?? view.guidCanale;
          view.nomeArea = areaMap.get(view.guidArea) ?? view.guidArea;
          view.label = `${view.nomeCanale} — ${view.nomeArea}`;
        }
      }

      const now = new Date();
      await sequelize.query(
        `
          INSERT INTO promo_scoreboard (id_promo, report, computedat)
          VALUES (:idPromo, CAST(:report AS jsonb), :computedat)
          ON CONFLICT (id_promo)
          DO UPDATE SET
            report = EXCLUDED.report,
            computedat = EXCLUDED.computedat
        `,
        {
          type: QueryTypes.INSERT,
          replacements: {
            idPromo,
            report: JSON.stringify(report),
            computedat: now.toISOString(),
          },
        },
      );

      return report;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error('Error in calcolaPromoScoreboard:', error);
      throw new DatabaseError({ message: 'Errore durante il calcolo dello scoreboard promo', cause: error instanceof Error ? error : undefined });
    }
  }

  async calcolaMultiPromoScoreboard(
    promoIds: string[],
    confrontoFilter?: { primarioIndex: number; secondarioIndex: number },
  ): Promise<TracciatoReport> {
    try {
      if (!this.agenziaLib) {
        throw new NotFoundError({ message: 'Scoreboard non supportato per questo client', entityType: 'PromoScoreboard' });
      }

      const allConfrontinData: Array<{
        primarioNome: string;
        secondarioNome: string;
        risultato: RisultatoConfrontoMomento;
        terremotoDegradoMassimo?: number;
      }> = [];

      for (const idPromo of promoIds) {
        const momenti = await this.momentoRepository.findByPromoId(idPromo);
        if (momenti.length === 0) continue;

        const ids = momenti.map((m) => m.id);
        const confrontiRaw = await this.momentoRepository.findConfrontiWithRisultatoByMomentoIds(ids);
        if (confrontiRaw.length === 0) continue;

        const momentoNomeById = new Map(momenti.map((m) => [m.id, m.nome as string]));
        const momentoOrdineById = new Map(momenti.map((m, index) => [m.id, index]));

        const confrontiPromo = confrontiRaw
          .map((c: any) => {
            const risultato = c.risultato as RisultatoConfrontoMomento | null;
            if (!risultato) return null;
            const primarioIndex = momentoOrdineById.get(c.primario);
            const secondarioIndex = momentoOrdineById.get(c.secondario);
            if (primarioIndex === undefined || secondarioIndex === undefined) return null;
            if (
              confrontoFilter !== undefined &&
              (primarioIndex !== confrontoFilter.primarioIndex || secondarioIndex !== confrontoFilter.secondarioIndex)
            ) return null;
            return {
              primarioId: c.primario as string,
              secondarioId: c.secondario as string,
              primarioIndex,
              secondarioIndex,
              primarioNome: momentoNomeById.get(c.primario) ?? c.primario,
              secondarioNome: momentoNomeById.get(c.secondario) ?? c.secondario,
              risultato,
              terremotoDegradoMassimo: c.terremoto_degrado_massimo ?? undefined,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => {
            if (a.secondarioIndex !== b.secondarioIndex) return a.secondarioIndex - b.secondarioIndex;
            return a.primarioIndex - b.primarioIndex;
          })
          .map(({ primarioNome, secondarioNome, risultato, terremotoDegradoMassimo }) => ({
            primarioNome,
            secondarioNome,
            risultato,
            terremotoDegradoMassimo,
          }));

        allConfrontinData.push(...confrontiPromo);
      }

      if (allConfrontinData.length === 0) {
        throw new NotFoundError({ message: 'Nessun confronto con risultato disponibile per le promo selezionate', entityType: 'TracciatiMomentoConfronto' });
      }

      const normalizzati = await this.agenziaLib.normalizzaDatoConfrontoPerScore(allConfrontinData);
      const matrice = TracciatoService._buildMatricePromo(normalizzati, this.agenziaLib);
      const matriceConTerremoto = await this.agenziaLib.calcolaTerremotoPerMatriceDiValori(matrice);
      const report = await this.agenziaLib.buildScoreboardReport(matriceConTerremoto, normalizzati);

      const realViews = report.viewsPerCanaleArea?.filter(v => v.guidCanale !== '__all__') ?? [];
      if (realViews.length > 0) {
        const guidCanali = [...new Set(realViews.map(v => v.guidCanale))];
        const guidAree = [...new Set(realViews.map(v => v.guidArea))];
        const [canali, aree] = await Promise.all([
          Canale.findAll({ where: { id_canali: { [Op.in]: guidCanali } }, attributes: ['id_canali', 'nome_canali'] }),
          Area.findAll({ where: { id_aree: { [Op.in]: guidAree } }, attributes: ['id_aree', 'nome_aree'] }),
        ]);
        const canaleMap = new Map(canali.map(c => [c.id_canali as string, c.nome_canali as string]));
        const areaMap = new Map(aree.map(a => [a.id_aree as string, a.nome_aree as string]));
        for (const view of realViews) {
          view.nomeCanale = canaleMap.get(view.guidCanale) ?? view.guidCanale;
          view.nomeArea = areaMap.get(view.guidArea) ?? view.guidArea;
          view.label = `${view.nomeCanale} — ${view.nomeArea}`;
        }
      }

      return report;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error('Error in calcolaMultiPromoScoreboard:', error);
      throw new DatabaseError({ message: 'Errore durante il calcolo dello scoreboard multi-promo', cause: error instanceof Error ? error : undefined });
    }
  }

  async calcolaQueryScoreboard(query: TracciatoQueryRequest): Promise<TracciatoQueryResult> {
    if (!this.agenziaLib) {
      throw new NotFoundError({ message: 'Scoreboard non supportato per questo client', entityType: 'PromoScoreboard' });
    }

    // 1. Risolvi promo in base al filtro
    const promos = await this._resolvePromos(query.promoFilter);
    if (promos.length === 0) {
      throw new NotFoundError({ message: 'Nessuna promo trovata con il filtro specificato', entityType: 'Promo' });
    }

    const computedAt = new Date().toISOString();

    if (query.aggregazione === 'merged') {
      // Raggruppa tutti i confronti di tutte le promo in un unico report
      const allConfrontinData = await this._collectConfrontinData(promos, query.momentoSelector);
      if (allConfrontinData.length === 0) {
        throw new NotFoundError({ message: 'Nessun confronto con risultato disponibile per le promo selezionate', entityType: 'TracciatiMomentoConfronto' });
      }
      const normalizzati = await this.agenziaLib.normalizzaDatoConfrontoPerScore(allConfrontinData);
      const matrice = TracciatoService._buildMatricePromo(normalizzati, this.agenziaLib);
      const matriceConTerremoto = await this.agenziaLib.calcolaTerremotoPerMatriceDiValori(matrice);
      let report = await this.agenziaLib.buildScoreboardReport(matriceConTerremoto, normalizzati);
      report = await this._enrichReportViews(report);
      report = this._applyReportFilters(report, query);

      return { query, promoCount: promos.length, computedAt, aggregazione: 'merged', report };
    }

    // per_promo | trend — calcola un report separato per ogni promo
    const perPromoResults: TracciatoQueryPromoResult[] = [];

    for (const promo of promos) {
      const confrontiData = await this._collectConfrontinData([promo], query.momentoSelector);
      if (confrontiData.length === 0) continue;

      try {
        const normalizzati = await this.agenziaLib!.normalizzaDatoConfrontoPerScore(confrontiData);
        const matrice = TracciatoService._buildMatricePromo(normalizzati, this.agenziaLib!);
        const matriceConTerremoto = await this.agenziaLib!.calcolaTerremotoPerMatriceDiValori(matrice);
        let report = await this.agenziaLib!.buildScoreboardReport(matriceConTerremoto, normalizzati);
        report = await this._enrichReportViews(report);
        report = this._applyReportFilters(report, query);

        perPromoResults.push({
          promoId: promo.id_promo as string,
          promoNome: promo.nome_promo as string,
          date: promo.validita_al instanceof Date ? promo.validita_al.toISOString() : String(promo.validita_al),
          report,
        });
      } catch {
        // skip promo senza confronti validi
      }
    }

    if (perPromoResults.length === 0) {
      throw new NotFoundError({ message: 'Nessun confronto con risultato disponibile per le promo selezionate', entityType: 'TracciatiMomentoConfronto' });
    }

    // trend: ordina per data validita_al
    if (query.aggregazione === 'trend') {
      perPromoResults.sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf());
    }

    return { query, promoCount: promos.length, computedAt, aggregazione: query.aggregazione, reports: perPromoResults };
  }

  private async _resolvePromos(filter: PromoFilterQuery) {
    switch (filter.type) {
      case 'all':
        return Promo.findAll();
      case 'by_ids':
        return Promo.findAll({ where: { id_promo: { [Op.in]: filter.ids } } });
      case 'date_range':
        return Promo.findAll({
          where: {
            validita_al: { [Op.between]: [new Date(filter.from), new Date(filter.to)] },
          },
        });
      case 'name_pattern':
        return Promo.findAll({ where: { nome_promo: { [Op.iLike]: `%${filter.pattern}%` } } });
    }
  }

  private async _collectConfrontinData(
    promos: Awaited<ReturnType<typeof Promo.findAll>>,
    selector: MomentoSelectorQuery,
  ): Promise<PromoScoreboardInput> {
    const result: PromoScoreboardInput = [];

    for (const promo of promos) {
      const momenti = await this.momentoRepository.findByPromoId(
        (promo as any).id_promo ?? promo.get?.('id_promo')
      );
      if (momenti.length === 0) continue;

      const ids = momenti.map((m) => m.id);
      const confrontiRaw = await this.momentoRepository.findConfrontiWithRisultatoByMomentoIds(ids);
      if (confrontiRaw.length === 0) continue;

      const momentoNomeById = new Map(momenti.map((m) => [m.id, m.nome as string]));
      const momentoOrdineById = new Map(momenti.map((m, index) => [m.id, index]));

      const confrontiMapped = confrontiRaw
        .map((c: any) => {
          const risultato = c.risultato as RisultatoConfrontoMomento | null;
          if (!risultato) return null;
          const primarioIndex = momentoOrdineById.get(c.primario);
          const secondarioIndex = momentoOrdineById.get(c.secondario);
          if (primarioIndex === undefined || secondarioIndex === undefined) return null;
          return {
            primarioIndex,
            secondarioIndex,
            primarioNome: momentoNomeById.get(c.primario) ?? c.primario,
            secondarioNome: momentoNomeById.get(c.secondario) ?? c.secondario,
            risultato,
            terremotoDegradoMassimo: c.terremoto_degrado_massimo ?? undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) =>
          a.secondarioIndex !== b.secondarioIndex
            ? a.secondarioIndex - b.secondarioIndex
            : a.primarioIndex - b.primarioIndex,
        );

      const filtered = this._applyMomentoSelector(confrontiMapped, selector);
      result.push(...filtered.map(({ primarioNome, secondarioNome, risultato, terremotoDegradoMassimo }) => ({
        primarioNome, secondarioNome, risultato, terremotoDegradoMassimo,
      })));
    }

    return result;
  }

  private _applyMomentoSelector(
    confronti: Array<{ primarioIndex: number; secondarioIndex: number; primarioNome: string; secondarioNome: string; risultato: RisultatoConfrontoMomento; terremotoDegradoMassimo?: number }>,
    selector: MomentoSelectorQuery,
  ) {
    switch (selector.type) {
      case 'all_confronti':
        return confronti;
      case 'first_per_promo': {
        const first = confronti[0];
        return first ? [first] : [];
      }
      case 'last_per_promo': {
        const last = confronti[confronti.length - 1];
        return last ? [last] : [];
      }
      case 'index_per_promo': {
        const slot = confronti[selector.n];
        return slot ? [slot] : [];
      }
    }
  }

  private async _enrichReportViews(report: TracciatoReport): Promise<TracciatoReport> {
    const realViews = report.viewsPerCanaleArea?.filter(v => v.guidCanale !== '__all__') ?? [];
    if (realViews.length === 0) return report;

    const guidCanali = [...new Set(realViews.map(v => v.guidCanale))];
    const guidAree = [...new Set(realViews.map(v => v.guidArea))];
    const [canali, aree] = await Promise.all([
      Canale.findAll({ where: { id_canali: { [Op.in]: guidCanali } }, attributes: ['id_canali', 'nome_canali'] }),
      Area.findAll({ where: { id_aree: { [Op.in]: guidAree } }, attributes: ['id_aree', 'nome_aree'] }),
    ]);
    const canaleMap = new Map(canali.map(c => [c.id_canali as string, c.nome_canali as string]));
    const areaMap = new Map(aree.map(a => [a.id_aree as string, a.nome_aree as string]));
    for (const view of realViews) {
      view.nomeCanale = canaleMap.get(view.guidCanale) ?? view.guidCanale;
      view.nomeArea = areaMap.get(view.guidArea) ?? view.guidArea;
      view.label = `${view.nomeCanale} — ${view.nomeArea}`;
    }
    return report;
  }

  private _applyReportFilters(report: TracciatoReport, query: TracciatoQueryRequest): TracciatoReport {
    const { repartoFilter, canaleFilter, areaFilter } = query;
    if (!repartoFilter?.length && !canaleFilter?.length && !areaFilter?.length) return report;

    const filterScoreboardWidgets = (widgets: TracciatoReport['widgets']): TracciatoReport['widgets'] =>
      widgets.map(w => {
        if (w.type !== 'scoreboard') return w;
        const rows = repartoFilter?.length
          ? w.rows.filter(r => repartoFilter.some(f => r.reparto.toLowerCase().includes(f.toLowerCase())))
          : w.rows;
        const totalScore = rows.length > 0
          ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
          : 0;
        return { ...w, rows, totalScore };
      });

    let views = report.viewsPerCanaleArea;
    if (canaleFilter?.length || areaFilter?.length) {
      views = views?.filter(v =>
        (!canaleFilter?.length || canaleFilter.some(f => v.nomeCanale?.toLowerCase().includes(f.toLowerCase()))) &&
        (!areaFilter?.length || areaFilter.some(f => v.nomeArea?.toLowerCase().includes(f.toLowerCase())))
      );
    }

    return {
      ...report,
      widgets: filterScoreboardWidgets(report.widgets),
      viewsPerCanaleArea: views?.map(v => ({ ...v, widgets: filterScoreboardWidgets(v.widgets) })),
    };
  }

  // ─── Schemi ────────────────────────────────────────────────────────────────

  private mapSchemaToDTO(r: any): TracciatiSchemaResponseDTO {
    return {
      id: r.id,
      nome: r.nome,
      tipo: (r.tipo ?? []) as TipoSchema[],
      items: (r.items ?? []) as TracciatiSchemaItem[],
      confronti: (r.confronti ?? []) as TracciatiSchemaConfronto[],
      createdat: r.createdat instanceof Date ? r.createdat.toISOString() : r.createdat,
      updatedat: r.updatedat instanceof Date ? r.updatedat.toISOString() : r.updatedat,
    };
  }

  async getAllSchemi(): Promise<TracciatiSchemaResponseDTO[]> {
    try {
      const schemi = await this.schemaRepository.findAll();
      return schemi.map((s) => this.mapSchemaToDTO(s));
    } catch (error) {
      log.error('Error in getAllSchemi:', error);
      throw new DatabaseError({ message: 'Errore durante il recupero degli schemi', cause: error instanceof Error ? error : undefined });
    }
  }

  async createSchema(nome: string, tipo: TipoSchema[], items: TracciatiSchemaItem[], confronti: TracciatiSchemaConfronto[] = []): Promise<TracciatiSchemaResponseDTO> {
    try {
      const created = await this.schemaRepository.create({
        nome,
        tipo,
        items: items.map((item, i) => ({ ...item, ordine: item.ordine ?? i })),
        confronti,
        createdat: new Date(),
        updatedat: new Date(),
      });
      return this.mapSchemaToDTO(created);
    } catch (error) {
      log.error('Error in createSchema:', error);
      throw new DatabaseError({ message: 'Errore durante la creazione dello schema', cause: error instanceof Error ? error : undefined });
    }
  }

  async updateSchema(id: string, data: { nome?: string; tipo?: TipoSchema[]; items?: TracciatiSchemaItem[]; confronti?: TracciatiSchemaConfronto[] }): Promise<TracciatiSchemaResponseDTO | null> {
    try {
      const updated = await this.schemaRepository.update(id, { ...data, updatedat: new Date() });
      return updated ? this.mapSchemaToDTO(updated) : null;
    } catch (error) {
      log.error('Error in updateSchema:', error);
      throw new DatabaseError({ message: 'Errore durante l\'aggiornamento dello schema', cause: error instanceof Error ? error : undefined });
    }
  }

  async deleteSchema(id: string): Promise<boolean> {
    try {
      return await this.schemaRepository.delete(id);
    } catch (error) {
      log.error('Error in deleteSchema:', error);
      throw new DatabaseError({ message: 'Errore durante l\'eliminazione dello schema', cause: error instanceof Error ? error : undefined });
    }
  }

  async applicaSchema(idSchema: string, idPromo: string): Promise<TracciatiMomentoResponseDTO[]> {
    try {
      const schema = await this.schemaRepository.findById(idSchema);
      if (!schema) throw new NotFoundError({ message: 'Schema non trovato', entityType: 'TracciatiSchema' });

      const existing = await this.momentoRepository.findByPromoId(idPromo);
      const baseOrdine = existing.length;

      const created: TracciatiMomentoResponseDTO[] = [];
      for (const item of schema.items) {
        const momento = await this.momentoRepository.create({
          id_promo: idPromo,
          nome: item.nome,
          tracciati_ids: [],
          confronti_ids: [],
          ordine: baseOrdine + (item.ordine ?? 0),
          snapshot: item.snapshot,
          createdat: new Date(),
          updatedat: new Date(),
        });
        created.push(this.mapMomentoToDTO(momento, true));
      }

      if ((schema.confronti ?? []).length > 0 && created.length > 0) {
        const byOrdine = new Map<number, TracciatiMomentoResponseDTO>();
        created.forEach((m) => byOrdine.set(m.ordine, m));

        const relazioneById = new Map<string, Set<string>>();
        created.forEach((m) => relazioneById.set(m.id, new Set<string>()));
        const uniquePairs = new Map<string, { aId: string; bId: string; terremotoDegradoMassimo?: number | null }>();

        (schema.confronti ?? []).forEach((c) => {
          const momentoA = byOrdine.get(baseOrdine + c.a) ?? byOrdine.get(c.a);
          const momentoB = byOrdine.get(baseOrdine + c.b) ?? byOrdine.get(c.b);
          if (!momentoA || !momentoB || momentoA.id === momentoB.id) return;
          relazioneById.get(momentoA.id)?.add(momentoB.id);
          relazioneById.get(momentoB.id)?.add(momentoA.id);

          const key = [momentoA.id, momentoB.id].sort().join('::');
          if (!uniquePairs.has(key)) {
            uniquePairs.set(key, { aId: momentoA.id, bId: momentoB.id, terremotoDegradoMassimo: c.terremotoDegradoMassimo ?? null });
          }
        });

        for (const pair of uniquePairs.values()) {
          await this.createMomentoConfronto(pair.aId, pair.bId, pair.terremotoDegradoMassimo);
        }

        for (const momento of created) {
          const confronti_ids = [...(relazioneById.get(momento.id) ?? new Set<string>())];
          if (confronti_ids.length === 0) continue;
          await this.momentoRepository.update(momento.id, {
            confronti_ids,
            updatedat: new Date(),
          } as any);
          momento.confronti_ids = confronti_ids;
        }
      }

      return created;
    } catch (error) {
      log.error('Error in applicaSchema:', error);
      throw error instanceof NotFoundError
        ? error
        : new DatabaseError({ message: 'Errore durante l\'applicazione dello schema', cause: error instanceof Error ? error : undefined });
    }
  }

  async getContestoPerConfronto(idPromo: string, req: Request): Promise<{
    list: {
      content: { titolo: string; valore: string }[],
      idField: string,
      titoloField: string,
      tipoField: string,
      visible: boolean,
      esito: boolean,
      error: string | null
      nullable: boolean
    }[], esito: boolean, error: string | null
  }> {
    const resultContesto = await ServerUtils.sendToFICOApi<{
      list: {
        content: { titolo: string; valore: string }[],
        idField: string,
        titoloField: string,
        tipoField: string,
        visible: boolean,
        esito: boolean,
        error: string | null
        nullable: boolean
      }[], esito: boolean, error: string | null
    }>(
      req,
      //NOTE abbiamo cambiato la dicitura aggiungendo l'ultimo parametro che è lo scope.
      `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getSourceFields/${req.query.guidId}/importInConfronto`,
      "GET",
      undefined
    );
    if (resultContesto.data == undefined) {
      throw new Error(resultContesto.statusText)
    }
    if (resultContesto.data.error != undefined) {
      throw new Error(resultContesto.statusText)
    }
    return resultContesto.data

  }

  // ── Opzioni report per cliente ─────────────────────────────────────────────

  getReportOptions(): ReportOptionDTO[] {
    if (!this.agenziaLib) return [];
    return this.agenziaLib.getReportOptions().map(o => ({
      id: o.id,
      titolo: o.titolo,
      descrizione: o.descrizione,
      icona: o.icona,
      plugins: o.plugins.map(p => ({ id: p.id, titolo: p.titolo })),
    }));
  }

  async calcolaQueryDaOpzione(optionId: string): Promise<TracciatoQueryResult> {
    if (!this.agenziaLib) {
      throw new NotFoundError({ message: 'Scoreboard non supportato per questo client', entityType: 'PromoScoreboard' });
    }

    const option = this.agenziaLib.getReportOptions().find(o => o.id === optionId);
    if (!option) {
      throw new NotFoundError({ message: `Opzione report '${optionId}' non trovata`, entityType: 'ReportOption' });
    }

    const promos = await this._resolvePromos(option.query.promoFilter);
    if (promos.length === 0) {
      throw new NotFoundError({ message: 'Nessuna promo trovata con il filtro dell\'opzione', entityType: 'Promo' });
    }

    const allConfrontinData = await this._collectConfrontinData(promos, option.query.momentoSelector);
    if (allConfrontinData.length === 0) {
      throw new NotFoundError({ message: 'Nessun confronto con risultato disponibile', entityType: 'TracciatiMomentoConfronto' });
    }

    const normalizzati = await this.agenziaLib.normalizzaDatoConfrontoPerScore(allConfrontinData);
    const matrice = TracciatoService._buildMatricePromo(normalizzati, this.agenziaLib);
    const matriceConTerremoto = await this.agenziaLib.calcolaTerremotoPerMatriceDiValori(matrice);

    const widgets = await Promise.all(
      option.plugins.map(plugin => plugin.builder(matriceConTerremoto, normalizzati)),
    );

    const report: TracciatoReport = {
      title: option.titolo,
      subtitle: `${promos.length} promo · ${allConfrontinData.length} confronti`,
      generatedAt: new Date().toISOString(),
      widgets,
    };

    return {
      query: option.query,
      promoCount: promos.length,
      computedAt: new Date().toISOString(),
      aggregazione: option.query.aggregazione,
      report,
    };
  }
}
