import ExcelJS from 'exceljs';
import { createRequire } from 'module';
import { Colorize } from "../../../../lib/Colorize";
import { RUOLO_UTENTE_GDO, STATO_UTENTI, TIPO_UTENTI } from "../../../../lib/enums";
import {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
    ServiceUnavailableError,
    UnauthorizedError
} from "../../../../lib/errors";
import type { AnalisiMomentoTracciato, DataFields, GlobalUserFilter, IndesignPluginExport, IndesignPluginFiltro, KpiCardItem, MenaboDivisioneParams, MenaboLayoutDivisioneSalvata, MenaboRisultato, RisultatoConfrontoMomento, TracciatoFieldChange, TracciatoReport, TracciatoReportCanaleAreaView, TracciatoReportWidget, TracciatoWidgetGroupedTableGroup, TracciatoWidgetGroupedTableRow, TracciatoWidgetLineChart, TracciatoWidgetPriceDiffExtraFields, TracciatoWidgetPriceDiffRow, TracciatoWidgetScoreboard, TracciatoWidgetScoreboardCodiceRow, TracciatoWidgetScoreboardRow, UtentiMeta } from "../../../../lib/types";
import config from "../../config/index";
import type { OidcUserClaims } from "../../interfaces/IOidcService";
import type { IUserService } from "../../interfaces/IUserService";
import { log } from "../../logger";
import { GDO } from "../../models";
import { RuoloUtenteGDO } from "../../models/ruolo_gdo";
import { Utente } from "../../models/utenti";
import { AuditLogService } from "../../services/AuditLogService";
import { removeSinglesIncludedInGroups, resolveGroupMembersFromScattoCodice } from "../../services/TracciatoScoreboardUtils.js";
import { TracciatoService } from "../../services/TracciatoService.js";
import { ServerUtils } from "../../utils/ServerUtils";
import type { AgenziaLibScoreRules, AzioniRule, CellaConfronto, FieldChange, IAgenziaLib, MatricePromo, ModificaRule, ParsedOIDCUtente, PromoScoreboardInput } from "../types.js";
import { buildCoopfiPolicyFromCodeV2 } from "./utility/coopfi-policy-v2";
import { COOPFI_TRACKED_FIELD_MAP, createCoopfiNormalizer } from "./utility/coopfi-referenza";
import { resolveRepartoNamesForSettoriFinali } from "./utility/coopfi-settore-finale-map";

const _require = createRequire(import.meta.url);
const scoreRules: AgenziaLibScoreRules = _require('./utility/data/coopfi-score-rules.json');

const TRACKED_FIELDS: { origKey: string; field: keyof DataFields; label: string; isNumeric: boolean }[] = [
    { origKey: 'tipo_evento', field: 'tipoEvento', label: 'Tipo evento', isNumeric: false },
    { origKey: 'Descrizioni.Peso', field: 'peso', label: 'Peso', isNumeric: false },
    { origKey: 'prestazione', field: 'prestazione', label: 'Prestazione', isNumeric: false },
    { origKey: 'Format_PdvRif', field: 'formatPdvRif', label: 'Format PdvRif', isNumeric: false },
    { origKey: 'format_1', field: 'format1', label: 'Format 1', isNumeric: false },
    { origKey: 'format_2', field: 'format2', label: 'Format 2', isNumeric: false },
    { origKey: 'txt_sconto', field: 'txtSconto', label: 'Sconto', isNumeric: false },
    { origKey: 'sconto', field: 'txtSconto', label: 'Sconto', isNumeric: false },
    { origKey: 'N_Punti', field: 'nPunti', label: 'N. Punti', isNumeric: false },
    { origKey: 'N_pezzi_soci', field: 'nPezziSoci', label: 'N. Pezzi soci', isNumeric: true },
    { origKey: 'prezzo_continuo', field: 'prezzoContinuo', label: 'Prezzo continuo', isNumeric: true },
    { origKey: 'prezzo', field: 'prezzo', label: 'Prezzo promo', isNumeric: true },
    { origKey: 'prezzo_promo_kgl', field: 'prezzoPromoKgl', label: 'Prezzo promo/kgl', isNumeric: true },
    { origKey: 'prezzo_kgl', field: 'prezzoPromoKgl', label: 'Prezzo promo/kgl', isNumeric: true },

    { origKey: 'txt_sconto_soci_doppia', field: 'txtScontoSociDoppia', label: 'Sconto Soci', isNumeric: false },
    { origKey: 'prezzo_promo_soci_doppia', field: 'prezzoPromoSociDoppia', label: 'Prezzo Soci', isNumeric: true },
    { origKey: 'prezzo_promo_kgl_soci_doppia', field: 'prezzoPromoKglSociDoppia', label: 'Prezzo promo/kgl Soci', isNumeric: true },
];

// Campi prezzo legati tra loro: se nel confronto ne cambia uno, nel report vanno mostrati sempre tutti e quattro
const PRICE_LINKED_ORIG_KEYS = new Set(['txt_sconto', 'prezzo', 'prezzo_continuo', 'prezzo_promo_kgl']);
const NUMERIC_STRING_TRACKED_ORIG_KEYS = new Set(['txt_sconto', 'sconto']);

const TIPI_CON_GDO = [
    TIPO_UTENTI.GDO,
    TIPO_UTENTI.SUPERADMIN,
    TIPO_UTENTI.AGENZIA,
    TIPO_UTENTI.CATEGORY,
    TIPO_UTENTI.IT,
    TIPO_UTENTI.MARKETING,
];
const DEFAULT_BIRTH_DATE = "1970-01-01";

const PREFIX_TO_RUOLO: Record<string, RUOLO_UTENTE_GDO> = {
    // --- Livello ADMIN (gestione, supervisione, coordinamento) ---
    RES: RUOLO_UTENTE_GDO.ADMIN,  // Responsabile
    IMR: RUOLO_UTENTE_GDO.ADMIN,  // Responsabile (alias di RES)
    DIR: RUOLO_UTENTE_GDO.ADMIN,  // Direttore
    ISP: RUOLO_UTENTE_GDO.ADMIN,  // Ispettore
    COO: RUOLO_UTENTE_GDO.ADMIN,  // Coordinatore
    COOSGD: RUOLO_UTENTE_GDO.ADMIN,  // Coordinatore Segreteria Direzione
    COS: RUOLO_UTENTE_GDO.ADMIN,  // Coordinatore Specializzato
    CSF: RUOLO_UTENTE_GDO.ADMIN,  // Coordinatore Segreteria
    BMR: RUOLO_UTENTE_GDO.ADMIN,  // Business Manager
    RAA: RUOLO_UTENTE_GDO.ADMIN,  // Responsabile Acquisto e Assortimento
    RAP: RUOLO_UTENTE_GDO.ADMIN, // RESPONSABILE ACQUISTI E ASSORTIMENTI xxxxx FORMATI DI PROSSIMITA'
    CRR: RUOLO_UTENTE_GDO.ADMIN, // CATEGORY MANAGER xxxxxx FORMATI DI RIFERIMENT0
    CRP: RUOLO_UTENTE_GDO.ADMIN, //CATEGORY MANAGER xxxxx FORMATI DI PROSSIMITA'
    RAR: RUOLO_UTENTE_GDO.ADMIN, //RESPONSABILE ACQUISTI E ASSORTIMENTI xxxxx FORMATI DI RIFERIMENTO
    // --- Livello IMPIEGATO (operativo, specialista, supporto) ---
    RIO: RUOLO_UTENTE_GDO.IMPIEGATO,  // RIORDINATORE xxxxxxx
    IMP: RUOLO_UTENTE_GDO.IMPIEGATO,  // Impiegato
    SPC: RUOLO_UTENTE_GDO.IMPIEGATO,  // Specialista
    ASS: RUOLO_UTENTE_GDO.IMPIEGATO,  // Assistente
    ASD: RUOLO_UTENTE_GDO.IMPIEGATO,  // Assistente Direzione (Sede)
    ASR: RUOLO_UTENTE_GDO.IMPIEGATO,  // Assistente Responsabile
    SGD: RUOLO_UTENTE_GDO.IMPIEGATO,  // Segretaria Direzione
    SGF: RUOLO_UTENTE_GDO.IMPIEGATO,  // Segretaria
    DST: RUOLO_UTENTE_GDO.IMPIEGATO,  // Distaccato
};
const DEFAULT_TOKEN_TTL_SECONDS = 3600;
const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 30_000;
const LINE_CHART_PALETTE = [
    "#0EA5E9",
    "#22C55E",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#14B8A6",
    "#EC4899",
    "#84CC16",
    "#6366F1",
    "#F97316",
    "#06B6D4",
    "#A855F7",
];

type CoopfiPriceDiffExtraFields = TracciatoWidgetPriceDiffExtraFields & {
    descrizione: string;
    tema: string;
};

type TracciatoWidgetPriceDiffRowCoopfi = TracciatoWidgetPriceDiffRow<CoopfiPriceDiffExtraFields>;

const clampPercent = (value: number): number =>
    Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
const normalizeFieldValue = (value: unknown): string => String(value ?? "").trim();

type CoopfiUtenteCensito = {
    nome: string;
    cognome: string;
    mail: string;
    user: string;
    azure_id?: string;
    codicePosizione: string;
    descrizionePosizione: string;
    gruppi: string[];
};

type CoopfiAuthTokenResponse = {
    token_type?: string;
    expires_in?: number;
    ext_expires_in?: number;
    access_token?: string;
};

type CoopfiTokenCache = {
    accessToken: string;
    expiresAt: number;
};


/**
 * Implementazione default di AgenziaLib.
 * Cerca l'utente per email, risolve tipo e id_gdo.
 */
export class CoopfiAgenziaLib implements IAgenziaLib {
    private authTokenCache: CoopfiTokenCache | null = null;
    private authTokenRequestPromise: Promise<string> | null = null;
    private graphTokenCache: CoopfiTokenCache | null = null;

    private INDICE_PRIMO_CONFRONTO: number = 0;
    private INDICE_SECONDO_CONFRONTO: number = 1;
    private INDICE_TERZO_CONFRONTO: number = 2;
    private INDICE_QUARTO_CONFRONTO: number = 3;

    public CHIAVE_CAMPO_MENABO = "tema";
    private CHIAVI_SOTTOGRUPPI_MENABO_DEFAULT = [{
        nome_campo: "reparto",
        label: "Reparto"
    }];
    private CHIAVI_SOTTOGRUPPI_MENABO_FORMAT_PLUS = [{
        nome_campo: "tema",
        label: "Tema"
    }];
    private TEMI_ESCLUSI_DA_FORMAT_PLUS = ["PIU VALORE", "SPENDI PUNTI"];
    public CHIAVE_DEDUP_MENABO = "Scatto.CodiceGruppo";

    /**
     * Temi che, su richiesta di Calonaci (Coopfi), NON devono comparire nel report PDF:
     * né tra le referenze Entranti, né tra le Uscenti, né nelle Variazioni.
     * Restano invece visibili nella vista a schermo su FP (il filtro è applicato solo
     * alla variante `widgetsPdf` del report). Match case-insensitive, di tipo "contiene".
     */
    private TEMI_ESCLUSI_DA_PDF = ["FUORI DEPLIANT", "EX TRIPLA"];

    constructor(private userService: IUserService) {
        console.log(Colorize.bgRed("Caricato Coopfi Agenzia lib"))

    }

    private getMenaboSubgroupKeys(nomeCampo: string, valoreCampo: string) {
        if (nomeCampo === "format1" && valoreCampo === "FORMAT+") {
            return this.CHIAVI_SOTTOGRUPPI_MENABO_FORMAT_PLUS;
        }
        return this.CHIAVI_SOTTOGRUPPI_MENABO_DEFAULT;
    }

    private normalizeMenaboGroupValue(value: unknown): string {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    private isTemaExcludedFromFormatPlusSubgroups(tema: unknown): boolean {
        const normalizedValue = this.normalizeMenaboGroupValue(tema);
        return this.TEMI_ESCLUSI_DA_FORMAT_PLUS.some((excludedValue) =>
            normalizedValue.includes(this.normalizeMenaboGroupValue(excludedValue))
        );
    }


    async getDatoPerMenabo(
        risultati: AnalisiMomentoTracciato[],
        params: MenaboDivisioneParams
    ): Promise<MenaboRisultato> {
        const { tipoDivisione } = params;

        type SezioneRecord = { guidCanale: string; payload: DataFields };
        type Sezione = { guidCanale: string; guidArea?: string; records: SezioneRecord[] };
        const sezioni = new Map<string, Sezione>();

        for (const risultato of risultati) {
            const guidCanale = String(risultato.guidCanale ?? "").trim();
            const guidArea = String(risultato.guidArea ?? "").trim();


            let sectionKey: string;
            let sezione: Sezione;

            switch (tipoDivisione) {
                case 'area':
                    sectionKey = guidArea.toLowerCase();
                    sezione = sezioni.get(sectionKey) ?? { guidCanale: "", guidArea, records: [] };
                    break;
                case 'area_e_canale':
                    sectionKey = `${guidCanale.toLowerCase()}:${guidArea.toLowerCase()}`;
                    sezione = sezioni.get(sectionKey) ?? { guidCanale, guidArea, records: [] };
                    break;
                default: // 'canale'
                    sectionKey = guidCanale.toLowerCase();
                    sezione = sezioni.get(sectionKey) ?? { guidCanale, records: [] };
                    break;
            }

            sezione.records.push(...risultato.records.map((record) => ({
                guidCanale,
                payload: record,
            })));
            sezioni.set(sectionKey, sezione);
        }

        const risultatiPerCanale: MenaboRisultato['risultati'] = [];

        for (const [sectionId, sezione] of sezioni.entries()) {
            const recordKeys = new Set<string>();
            const recordsUnici: Array<{ guidCanale: string; record: Record<string, string> }> = [];

            for (const recordSezione of sezione.records) {
                const record = recordSezione.payload;
                const menaboRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(record)) {
                    const fieldName = key.trim();
                    if (!fieldName || Object.prototype.hasOwnProperty.call(menaboRecord, fieldName)) continue;
                    menaboRecord[fieldName] = value == null ? "" : String(value);
                }
                const codiceGruppo = String(menaboRecord[this.CHIAVE_DEDUP_MENABO] ?? "").trim().toLowerCase();
                const recordKey = codiceGruppo
                    ? `${this.CHIAVE_DEDUP_MENABO}:${codiceGruppo}`
                    : JSON.stringify(Object.entries(menaboRecord).sort(([a], [b]) => a.localeCompare(b)));
                if (recordKeys.has(recordKey)) continue;
                recordKeys.add(recordKey);
                recordsUnici.push({
                    guidCanale: recordSezione.guidCanale,
                    record: menaboRecord,
                });
            }

            const campiFiltro: MenaboRisultato['risultati'][number]['campi_filtro'] = [];
            const campiFiltroVisti = new Set<string>();
            for (const recordEntry of recordsUnici) {
                const record = recordEntry.record;
                for (const key of Object.keys(record)) {
                    const nomeCampo = key.trim();
                    const dedupKey = String(nomeCampo ?? "").trim().toLowerCase();
                    if (!nomeCampo || campiFiltroVisti.has(dedupKey)) continue;
                    campiFiltroVisti.add(dedupKey);
                    campiFiltro.push({ nome_campo: nomeCampo });
                }
            }

            const groups = new Map<string, {
                nome_campo: string;
                valore_campo: string;
                records: Record<string, string>[];
            }>();
            const recordsGiaRaggruppati = new WeakSet<Record<string, string>>();

            const addGroupRecord = (nomeCampo: string, valoreCampo: string, record: Record<string, string>) => {
                const normalizedNomeCampo = String(nomeCampo ?? "").trim();
                const normalizedValoreCampo = String(valoreCampo ?? "").trim();
                if (!normalizedNomeCampo || !normalizedValoreCampo) return;
                if (recordsGiaRaggruppati.has(record)) return;
                const groupKey = `${normalizedNomeCampo.toLowerCase()}:${normalizedValoreCampo.toLowerCase()}`;
                const group = groups.get(groupKey) ?? {
                    nome_campo: normalizedNomeCampo,
                    valore_campo: normalizedValoreCampo,
                    records: [],
                };
                if (!group.valore_campo && normalizedValoreCampo) {
                    group.valore_campo = normalizedValoreCampo;
                }
                group.records.push(record);
                recordsGiaRaggruppati.add(record);
                groups.set(groupKey, group);
            };

            const CHIAVI_FORMAT1 = ["format1", "format_1"] as const;
            for (const recordEntry of recordsUnici) {
                const record = recordEntry.record;
                const format1Value = CHIAVI_FORMAT1
                    .map((fieldName) => String(record[fieldName] ?? "").trim())
                    .find((value) => value.length > 0);
                if (!format1Value || !format1Value.includes("+")) continue;

                const valoreTema = String(record[this.CHIAVE_CAMPO_MENABO] ?? "").trim();
                if (!this.isTemaExcludedFromFormatPlusSubgroups(valoreTema)) continue;

                addGroupRecord("format1", "FORMAT+", record);
            }
            for (const recordEntry of recordsUnici) {
                const record = recordEntry.record;
                const valoreCampo = String(record[this.CHIAVE_CAMPO_MENABO] ?? "").trim();
                if (!valoreCampo) continue;
                //ES: FUORI DEPLIANT FOOD (OS9B) 42UFI+17TDM+A => non vogliamo che diventi un gruppo a parte, ma lo escludiamo del tutto dal raggruppamento (resta comunque nei campi filtro)
                if (valoreCampo.toLowerCase().includes("fuori depliant")) continue;

                addGroupRecord(this.CHIAVE_CAMPO_MENABO, valoreCampo, record);
            }



            const raggruppamento: MenaboRisultato['risultati'][number]['raggruppamento'] = Array.from(groups.values()).map(group => ({
                nome_campo: group.nome_campo,
                valore_campo: group.valore_campo,
                conteggio: group.records.length,
                records: group.records,
                records_preview: group.records.map(r => ({
                    descrizione: (
                        (r['Descrizioni.Descrizione1'] ?? '') +
                        (r['Descrizioni.Descrizione2'] ?? '') +
                        (r['Descrizioni.Descrizione3'] ?? '')
                    ).trim() || "—",
                    codice: String(r[this.CHIAVE_DEDUP_MENABO] ?? "").trim() || String(r['Referenza.Codice'] ?? "").trim() || "—",
                    reparto: String(r['reparto'] ?? "").trim() || "—",
                    foto_url: String(r['Foto.OriginUri'] ?? "").trim() || undefined,
                })), // Per ora non abbiamo dati specifici da mostrare nella preview, ma lasciamo la struttura pronta per eventuali implementazioni future
                chiavi_sottogruppi: this.getMenaboSubgroupKeys(group.nome_campo, group.valore_campo)
            }));

            // Generazione label dinamica in base al tipo di divisione
            let label: string;
            switch (tipoDivisione) {
                case "canale":
                    label = sezione.guidCanale || "—";
                    break;
                case "area":
                    label = sezione.guidArea || "—";
                    break;
                case "area_e_canale":
                    label = [sezione.guidCanale, sezione.guidArea].filter(Boolean).join(" / ") || "—";
                    break;
                default:
                    label = sezione.guidCanale || "—";
            }

            risultatiPerCanale.push({
                id: sectionId,
                label,
                campi_filtro: campiFiltro,
                raggruppamento,
            });
        }

        return { tipoDivisione, risultati: risultatiPerCanale };
    }
    calcolaIntensitaTerremoto(cella: CellaConfronto, storia: CellaConfronto[]): number {
        // if (cella.stato === 'non_esistente' || cella.stato === 'inalterata') return 0;

        // const isUltimoConfronto = storia.length > 0 && cella.confrontoIndex === storia[storia.length - 1].confrontoIndex;
        // const isOrtofrutta = cella.outerKey == "58-01";
        // const isSituazioneAParte = (
        //     storia[this.INDICE_PRIMO_CONFRONTO].stato == "entrata" &&
        //     storia[this.INDICE_SECONDO_CONFRONTO].stato == "modifica" &&
        //     storia[this.INDICE_TERZO_CONFRONTO].stato == "uscita" &&
        //     storia[this.INDICE_QUARTO_CONFRONTO].stato == "entrata"
        // );

        // let raw: number;
        // if (isUltimoConfronto && isSituazioneAParte) {
        //     raw = 10_000;
        // } else if (isUltimoConfronto) {
        //     raw = 100;
        // } else if (isOrtofrutta) {
        //     raw = 0;
        // } else {
        //     raw = 0;
        // }

        // return Math.min(100, raw);
        return 0;
    }

    async calcolaTerremotoPerMatriceDiValori(matrice: MatricePromo): Promise<MatricePromo> {
        // Costruiamo la mappa bidimensionale: chiave = "scattoCodice::canaleArea"
        // → array di CellaConfronto ordinate per confrontoIndex (storia lineare della referenza)
        const storiaPerReferenza = new Map<string, CellaConfronto[]>();
        for (const riga of matrice) {
            for (const cella of riga.celle) {
                const chiave = `${cella.scattoCodice}::${cella.canaleArea}`;
                if (!storiaPerReferenza.has(chiave)) storiaPerReferenza.set(chiave, []);
                storiaPerReferenza.get(chiave)!.push(cella);
            }
        }
        // Ogni array è già ordinato per confrontoIndex poiché iteriamo matrice in ordine

        const sottraiPi = (pi: number, perc: number): number => {
            if (pi <= 0 || perc <= 0) return Math.max(0, pi);
            return Math.max(0, pi - (perc / 100) * pi);
        };

        for (const storia of storiaPerReferenza.values()) {
            let indiceTerremotoPiuRecente = -1;
            for (let k = storia.length - 1; k >= 0; k--) {
                if (!storia[k].hasTerremoto) continue;
                indiceTerremotoPiuRecente = k;
                break;
            }

            if (indiceTerremotoPiuRecente <= 0) continue;

            const cellaTerremoto = storia[indiceTerremotoPiuRecente];
            const degradoMassimo = matrice[cellaTerremoto.confrontoIndex]?.terremotoDegradoMassimo ?? 0;
            if (degradoMassimo <= 0) continue;

            const intensita = clampPercent(this.calcolaIntensitaTerremoto(cellaTerremoto, storia)); // 0-100
            // Il terremoto piu recente domina: tutti i confronti precedenti passano
            // dal calcolo di intensita, anche se non avevano hasTerremoto.
            for (let j = indiceTerremotoPiuRecente - 1; j >= 0; j--) {
                const cellaAnteriore = storia[j];
                if (intensita <= 0) continue;

                const degradoEffettivo = (intensita / 100) * degradoMassimo; // % da sottrarre
                cellaAnteriore.piDopoEvento = sottraiPi(cellaAnteriore.piDopoEvento, degradoEffettivo);
                cellaAnteriore.contributo += degradoEffettivo;
                cellaAnteriore.hasTerremoto = true;
            }
        }

        return matrice;
    }




    // ── Helper privato: costruisce i widget per un set di record ─────────────
    private buildWidgets(
        primarioRecords: DataFields[],
        secondarioRecords: DataFields[],
        labelPrimario: string,
        labelSecondario: string,
    ): import('../../../../lib/types').TracciatoReportWidget[] {
        // Campi tracciati: origKey = chiave ISTANTA (usata in TracciatoFieldChange.campo e nelle regole score)


        // La chiave effettiva nel record normalizzato dipende dalla config Mongo (data_fields_refs ha
        // priorità sulla mappa Coopfi): con mappature identità (es. prezzo_promo_kgl → prezzo_promo_kgl)
        // il campo atteso (prezzoPromoKgl) non esiste mai e la variazione non verrebbe rilevata.
        // Si legge quindi con fallback: campo atteso → chiave originale ISTANTA → output mappa Coopfi.
        const readTrackedField = (r: DataFields, f: (typeof TRACKED_FIELDS)[number]): unknown =>
            r[f.field] ?? r[f.origKey] ?? r[COOPFI_TRACKED_FIELD_MAP[f.origKey]];

        const hasTrackedFieldChanges = (a: DataFields, b: DataFields): boolean =>
            TRACKED_FIELDS.some(f => readTrackedField(a, f) !== readTrackedField(b, f));

        const normalizeCode = (value: unknown): string =>
            typeof value === "string" ? value.trim() : "";

        const normalizeScattoKey = (value: unknown): string => {
            const code = normalizeCode(value);
            if (!code.includes(",")) return code;
            return [...new Set(code.split(",").map(item => item.trim()).filter(Boolean))].join(",");
        };

        const getComparisonKey = (r: DataFields): string => {
            const codiceReferenza = normalizeCode(r.codice_referenza);
            if (!codiceReferenza || codiceReferenza === "—") return "";

            const scattoCodice = normalizeScattoKey(r.scatto_codice);
            return scattoCodice && scattoCodice !== codiceReferenza
                ? scattoCodice
                : codiceReferenza;
        };

        const buildComparisonMap = (records: DataFields[]): Map<string, DataFields> => {
            const map = new Map<string, DataFields>();
            for (const r of records) {
                const key = getComparisonKey(r);
                if (!key || map.has(key)) continue;
                map.set(key, r);
            }
            return map;
        };

        const groupedCodes = new Set<string>();
        for (const rec of [...primarioRecords, ...secondarioRecords]) {
            for (const codice of resolveGroupMembersFromScattoCodice(rec.scatto_codice, rec.codice_referenza)) {
                groupedCodes.add(codice);
            }
        }

        const buildComparisonMaps = (
            primaryRecords: DataFields[],
            secondaryRecords: DataFields[],
        ): { primMap: Map<string, DataFields>; secMap: Map<string, DataFields> } => {
            const primMap = buildComparisonMap(primaryRecords);
            const secMap = buildComparisonMap(secondaryRecords);
            removeSinglesIncludedInGroups(primMap, secMap, groupedCodes);
            return { primMap, secMap };
        };

        const groupByReparto = (records: DataFields[]): Map<string, DataFields[]> => {
            const map = new Map<string, DataFields[]>();
            for (const r of records) {
                const repartoKey = String(r["reparto"]);
                const arr = map.get(repartoKey) ?? [];
                arr.push(r);
                map.set(repartoKey, arr);
            }
            return map;
        };

        const primByReparto = groupByReparto(primarioRecords);
        const secByReparto = groupByReparto(secondarioRecords);
        const allReparti = Array.from(new Set([...primByReparto.keys(), ...secByReparto.keys()])).sort();

        // ── Mappe globali codice → record normalizzato ────────────────────────
        const primByCodice = new Map<string, DataFields>();
        for (const r of primarioRecords) { if (r.codice_referenza !== '—') primByCodice.set(r.codice_referenza, r); }
        const secByCodice = new Map<string, DataFields>();
        for (const r of secondarioRecords) { if (r.codice_referenza !== '—') secByCodice.set(r.codice_referenza, r); }

        const parseNumeric = (v: unknown): number | null => {
            if (v == null || v === '') return null;
            if (typeof v === 'number') return isNaN(v) ? null : v;
            const n = parseFloat(String(v).replace(',', '.'));
            return isNaN(n) ? null : n;
        };

        const roundToThreeDecimals = (value: number): number =>
            Math.round((value + Number.EPSILON) * 1000) / 1000;

        const formatRoundedTrackedNumber = (value: number): string => {
            const roundedValue = roundToThreeDecimals(value);
            return roundedValue.toLocaleString("it-IT", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 3,
            });
        };

        const toDisplayTrackedValue = (value: unknown): string => {
            const normalizedValue = String(value ?? '').trim();
            return normalizedValue && normalizedValue !== '—' ? normalizedValue : '—';
        };

        const isTrackedFieldNumeric = (f: (typeof TRACKED_FIELDS)[number]): boolean =>
            f.isNumeric || NUMERIC_STRING_TRACKED_ORIG_KEYS.has(f.origKey);

        const parseTrackedNumericValue = (value: unknown, f: (typeof TRACKED_FIELDS)[number]): number | null => {
            if (!isTrackedFieldNumeric(f)) {
                return null;
            }

            return parseNumeric(value);
        };

        const toDisplayTrackedComparisonValue = (value: unknown, f: (typeof TRACKED_FIELDS)[number]): string => {
            const numericValue = parseTrackedNumericValue(value, f);
            if (numericValue === null) {
                return toDisplayTrackedValue(value);
            }

            return formatRoundedTrackedNumber(numericValue);
        };

        const hasMeaningfulTrackedChange = (a: DataFields, b: DataFields, f: (typeof TRACKED_FIELDS)[number]): boolean => {
            const rawValoreA = readTrackedField(a, f);
            const rawValoreB = readTrackedField(b, f);
            const numA = parseTrackedNumericValue(rawValoreA, f);
            const numB = parseTrackedNumericValue(rawValoreB, f);

            if (numA !== null && numB !== null) {
                return roundToThreeDecimals(numA) !== roundToThreeDecimals(numB);
            }

            const valoreA = toDisplayTrackedValue(rawValoreA);
            const valoreB = toDisplayTrackedValue(rawValoreB);
            return !(valoreA === '—' && valoreB === '—') && valoreA !== valoreB;
        };

        const hasDisplayableTrackedValues = (a: DataFields, b: DataFields, f: (typeof TRACKED_FIELDS)[number]): boolean => {
            const valoreA = toDisplayTrackedValue(readTrackedField(a, f));
            const valoreB = toDisplayTrackedValue(readTrackedField(b, f));
            return valoreA !== '—' && valoreB !== '—';
        };

        const priceDiffRows: TracciatoWidgetPriceDiffRowCoopfi[] = [];
        let totalFieldChanges = 0;
        for (const r of primarioRecords) {
            if (r.codice_referenza === '—') continue;
            const sec = secByCodice.get(r.codice_referenza);
            if (!sec) continue;

            const makeChange = (f: (typeof TRACKED_FIELDS)[number]): TracciatoFieldChange => {
                const valoreA = readTrackedField(r, f);
                const valoreB = readTrackedField(sec, f);
                const displayValoreA = toDisplayTrackedComparisonValue(valoreA, f);
                const displayValoreB = toDisplayTrackedComparisonValue(valoreB, f);
                const numericField = isTrackedFieldNumeric(f);
                let delta: number | null = null;
                let deltaPercent: string | null = null;
                if (numericField) {
                    const numA = parseTrackedNumericValue(valoreA, f);
                    const numB = parseTrackedNumericValue(valoreB, f);
                    if (numA !== null && numB !== null) {
                        const rawDelta = numB - numA;
                        delta = roundToThreeDecimals(rawDelta);
                        deltaPercent = numA !== 0
                            ? `${rawDelta >= 0 ? '+' : ''}${Math.round((rawDelta / numA) * 100)}%`
                            : null;
                    }
                }
                return { campo: f.origKey, label: f.label, valoreA: displayValoreA, valoreB: displayValoreB, isNumeric: numericField, delta, deltaPercent };
            };

            const changedFields = TRACKED_FIELDS.filter(f => hasMeaningfulTrackedChange(r, sec, f));
            if (changedFields.length === 0) continue;

            // Se cambia uno dei campi prezzo collegati, mostrarli sempre tutti e quattro
            // (gli invariati compaiono con prima = dopo), ma solo se hanno valori reali su entrambi i lati.
            // Il conteggio resta sulle variazioni reali.
            const includeLinked = changedFields.some(f => PRICE_LINKED_ORIG_KEYS.has(f.origKey));
            const fieldsToShow = includeLinked
                ? TRACKED_FIELDS.filter(f =>
                    (changedFields.includes(f) || PRICE_LINKED_ORIG_KEYS.has(f.origKey))
                    && hasDisplayableTrackedValues(r, sec, f)
                )
                : changedFields;

            totalFieldChanges += changedFields.length;
            priceDiffRows.push({
                codice: String(r.codice_referenza),
                reparto: String(r.reparto),
                descrizione: `${r.descrizione_uno} ${r.descrizione_due}`,
                tipo: r.tipo === "gruppo" ? "gruppo" : "singolo",
                extraFields: {
                    descrizione: `${r.descrizione_uno} ${r.descrizione_due}`.trim() || "—",
                    tema: String(r.tema ?? "—"),
                },
                changes: fieldsToShow.map(makeChange)
            });
        }

        type RepartoStats = {
            reparto: string;
            uscenti: number;
            entranti: number;
            modificati: number;
            inalterati: number;
            inPrimario: number;
            inSecondario: number;
        };

        const repartoStats: RepartoStats[] = allReparti.map((reparto) => {
            const primarioRecords = primByReparto.get(reparto) ?? [];
            const secondarioRecords = secByReparto.get(reparto) ?? [];
            const { primMap, secMap } = buildComparisonMaps(primarioRecords, secondarioRecords);

            let uscenti = 0, entranti = 0, modificati = 0, inalterati = 0;
            for (const [codice, primRec] of primMap) {
                if (!secMap.has(codice)) uscenti++;
                else if (hasTrackedFieldChanges(primRec, secMap.get(codice)!)) modificati++;
                else inalterati++;
            }
            for (const codice of secMap.keys()) {
                if (!primMap.has(codice)) entranti++;
            }
            return { reparto, uscenti, entranti, modificati, inalterati, inPrimario: primMap.size, inSecondario: secMap.size };
        });

        const repartoTotals = repartoStats.reduce(
            (acc, r) => ({
                uscenti: acc.uscenti + r.uscenti,
                entranti: acc.entranti + r.entranti,
                modificati: acc.modificati + r.modificati,
                inalterati: acc.inalterati + r.inalterati,
            }),
            { uscenti: 0, entranti: 0, modificati: 0, inalterati: 0 }
        );
        const totaleProdotti = repartoTotals.uscenti + repartoTotals.entranti + repartoTotals.modificati + repartoTotals.inalterati;
        const totaleIngressiUscite = repartoTotals.uscenti + repartoTotals.entranti;

        const referenzeConCampiSensibiliModificati = priceDiffRows.length;

        const kpiItems: KpiCardItem[] = [
            { label: 'Uscenti', value: repartoTotals.uscenti, color: 'red', icon: 'TrendingDown' },
            { label: 'Entranti', value: repartoTotals.entranti, color: 'green', icon: 'TrendingUp' },
            { label: 'Variazioni', value: referenzeConCampiSensibiliModificati, color: 'amber', icon: 'Pencil' },
            { label: 'Inalterati', value: repartoTotals.inalterati, color: 'slate', icon: 'Minus' },
        ];

        const stabilitaPercent = totaleProdotti > 0
            ? Math.round((repartoTotals.inalterati / totaleProdotti) * 100) : 0;

        const calloutSeverity: 'success' | 'info' | 'warning' | 'error' =
            stabilitaPercent >= 80 ? 'success' : stabilitaPercent >= 60 ? 'info' :
                stabilitaPercent >= 40 ? 'warning' : 'error';

        const calloutTitle =
            calloutSeverity === 'success' ? 'Confronto stabile' :
                calloutSeverity === 'info' ? 'Variazioni moderate rilevate' :
                    calloutSeverity === 'warning' ? 'Variazioni significative rilevate' :
                        'Variazioni critiche rilevate';

        const saldo = repartoTotals.entranti - repartoTotals.uscenti;
        const calloutParts: string[] = [
            `Il ${stabilitaPercent}% delle referenze è rimasto inalterato su ${totaleProdotti.toLocaleString('it-IT')} referenze totali analizzate.`,
        ];
        if (saldo > 0) calloutParts.push(`Saldo positivo di ${saldo.toLocaleString('it-IT')} referenze: il catalogo è cresciuto.`);
        else if (saldo < 0) calloutParts.push(`Saldo negativo di ${Math.abs(saldo).toLocaleString('it-IT')} referenze: il catalogo si è ridotto.`);
        else if (repartoTotals.uscenti > 0) calloutParts.push('Saldo neutro: le referenze entranti pareggiano le uscenti.');

        const repartoTopMovimenti = [...repartoStats]
            .sort((a, b) => (b.uscenti + b.entranti + b.modificati) - (a.uscenti + a.entranti + a.modificati))[0] ?? null;
        if (repartoTopMovimenti && (repartoTopMovimenti.uscenti + repartoTopMovimenti.entranti + repartoTopMovimenti.modificati) > 0) {
            calloutParts.push(`Reparto con maggiore impatto: "${repartoTopMovimenti.reparto}" (${(repartoTopMovimenti.uscenti + repartoTopMovimenti.entranti + repartoTopMovimenti.modificati).toLocaleString('it-IT')} movimenti).`);
        }

        // ── Tabelle referenze entranti / uscenti (grouped by reparto) ─────────
        type SubCodiceItem = NonNullable<TracciatoWidgetGroupedTableRow['subCodici']>[number];

        const getDescrizione = (r?: DataFields): string => {
            if (!r) return "—";
            const descrizioneUno = typeof r.descrizione_uno === "string" ? r.descrizione_uno.trim() : "";
            const descrizioneDue = typeof r.descrizione_due === "string" ? r.descrizione_due.trim() : "";
            return [descrizioneUno, descrizioneDue].filter(Boolean).join(" ").trim() || "—";
        };

        const normalizeSubCodici = (value: unknown): SubCodiceItem[] | undefined => {
            if (!Array.isArray(value)) return undefined;
            const parsed: SubCodiceItem[] = [];

            for (const item of value) {
                if (typeof item === "string") {
                    const codice = item.trim();
                    if (codice) parsed.push({ codice, descrizione: "" });
                    continue;
                }

                if (!item || typeof item !== "object") continue;
                const maybeCodice = (item as { codice?: unknown }).codice;
                const maybeDescrizione = (item as { descrizione?: unknown }).descrizione;
                if (typeof maybeCodice !== "string") continue;

                const codice = maybeCodice.trim();
                if (!codice) continue;

                parsed.push({
                    codice,
                    descrizione: typeof maybeDescrizione === "string" ? maybeDescrizione.trim() : "",
                });
            }

            return parsed.length > 0 ? parsed : undefined;
        };

        const makeGroupedRow = (r: DataFields): TracciatoWidgetGroupedTableRow => ({
            codice: r.tipo === "gruppo" ? r["Scatto.CodiceGruppo"] as string : r.codice_referenza,
            descrizione: getDescrizione(r),
            tema: r["tema"] as string,
            tipo: r.tipo === "gruppo" ? "gruppo" : "singolo",
            tipo_evento: typeof r["tipoEvento"] === "string" ? r["tipoEvento"] : (r["tipoEvento"] !== undefined && r["tipoEvento"] !== null ? String(r["tipoEvento"]) : "—"),
            prestazione: typeof r["prestazione"] === "string" ? r["prestazione"] : (r["prestazione"] !== undefined && r["prestazione"] !== null ? String(r["prestazione"]) : "—"),
            prezzo_continuo: typeof r["prezzoContinuo"] === "string" ? r["prezzoContinuo"] : (r["prezzoContinuo"] !== undefined && r["prezzoContinuo"] !== null ? String(r["prezzoContinuo"]) : "—"),
            prezzo: typeof r["prezzo"] === "string" ? r["prezzo"] : (r["prezzo"] !== undefined && r["prezzo"] !== null ? String(r["prezzo"]) : "—"),
            txt_sconto: typeof r["sconto"] === "string" ? r["sconto"] : (r["sconto"] !== undefined && r["sconto"] !== null ? String(r["sconto"]) : "—"),
            subCodici: normalizeSubCodici(r["subCodici"])?.map((sub) => {
                if (sub.descrizione) return sub;
                const ref = secByCodice.get(sub.codice) ?? primByCodice.get(sub.codice);
                return { codice: sub.codice, descrizione: getDescrizione(ref) };
            }),
        });

        const buildGroupedTable = (records: DataFields[]): TracciatoWidgetGroupedTableGroup[] => {
            const groupMap = new Map<string, TracciatoWidgetGroupedTableRow[]>();
            for (const r of records) {
                const repartoKey = String(r.reparto);
                const rows = groupMap.get(repartoKey) ?? [];
                rows.push(makeGroupedRow(r));
                groupMap.set(repartoKey, rows);
            }
            return Array.from(groupMap.entries())
                .map(([reparto, rows]) => ({ reparto, rows }))
                .sort((a, b) => a.reparto.localeCompare(b.reparto));
        };

        const { primMap: primarioComparisonMap, secMap: secondarioComparisonMap } = buildComparisonMaps(primarioRecords, secondarioRecords);
        const entrantiRecords = Array.from(secondarioComparisonMap.entries())
            .filter(([codice]) => !primarioComparisonMap.has(codice))
            .map(([, record]) => record);

        const uscentiRecords = Array.from(primarioComparisonMap.entries())
            .filter(([codice]) => !secondarioComparisonMap.has(codice))
            .map(([, record]) => record);

        const entrantiGroups = buildGroupedTable(entrantiRecords);
        const uscentiGroups = buildGroupedTable(uscentiRecords);

        const tableRows = repartoStats.map(r => ({
            reparto: r.reparto, inPrimario: r.inPrimario, inSecondario: r.inSecondario,
            uscenti: r.uscenti, entranti: r.entranti, modificati: r.modificati,
            inalterati: r.inalterati, totaleMovimenti: r.uscenti + r.entranti + r.modificati,
        }));

        return [
            { id: 'kpi-reparto-summary', type: 'kpi_grid', title: 'Riepilogo variazioni per referenza', description: `${allReparti.length} reparti · ${totaleIngressiUscite.toLocaleString('it-IT')} ingressi/uscite · ${referenzeConCampiSensibiliModificati.toLocaleString('it-IT')} referenze con campi sensibili modificati su ${totaleProdotti.toLocaleString('it-IT')} referenze totali`, badge: 'Globale', gridSpan: 4, items: kpiItems },
            //{ id: 'callout-reparto', type: 'callout', title: calloutTitle, message: calloutParts.join(' '), severity: calloutSeverity, badge: `Stabilità ${stabilitaPercent}%` },
            { id: 'table-referenze-entranti', type: 'grouped_table' as const, title: `Referenze Entranti (${labelSecondario})`, description: `${entrantiRecords.length} referenze presenti in ${labelSecondario} ma assenti in ${labelPrimario}`, badge: `${entrantiRecords.length} entranti`, gridSpan: 4, groups: entrantiGroups, totalCount: entrantiRecords.length },
            { id: 'table-referenze-uscenti', type: 'grouped_table' as const, title: `Referenze Uscenti (${labelPrimario})`, description: `${uscentiRecords.length} referenze presenti in ${labelPrimario} ma assenti in ${labelSecondario}`, badge: `${uscentiRecords.length} uscenti`, gridSpan: 4, groups: uscentiGroups, totalCount: uscentiRecords.length },
            ...(priceDiffRows.length > 0 ? [{ id: 'price-diff', type: 'price_diff' as const, title: 'Variazioni per referenza', description: `${priceDiffRows.length} referenze con campi sensibili modificati tra ${labelPrimario} e ${labelSecondario}`, badge: `${priceDiffRows.length} referenze`, gridSpan: 4 as const, labelA: labelPrimario, labelB: labelSecondario, extraColumns: [{ key: 'descrizione', label: 'Descrizione' }, { key: 'tema', label: 'Tema' }], rows: priceDiffRows }] : []),
            { id: 'table-reparto', type: 'table', title: 'Dettaglio per reparto', description: 'Uscenti/entranti/modificati calcolati tramite Referenza.Codice per ogni codice reparto', badge: 'Reparti', gridSpan: 4, columns: [{ key: 'reparto', label: 'Reparto' }, { key: 'inPrimario', label: 'Ref. Primario' }, { key: 'inSecondario', label: 'Ref. Secondario' }, { key: 'entranti', label: 'Entranti' }, { key: 'uscenti', label: 'Uscenti' }, { key: 'modificati', label: 'Modificati' }, { key: 'inalterati', label: 'Inalterati' }, { key: 'totaleMovimenti', label: 'Tot. Movimenti' }], rows: tableRows },
            // { id: 'referenze-split-table', type: 'referenze_split_table' as const, title: 'Referenze per tipo', description: `Classificazione basata su Scatto.CodiceGruppo vs Referenza.Codice — ${singoli.length} singoli, ${gruppi.length} gruppi`, badge: `${primarioRecords.length} ref.`, gridSpan: 4, columns: referenzeColumns, singoli, gruppi },
        ];
    }

    async elaboraDatoPerAgenzia(data: RisultatoConfrontoMomento): Promise<TracciatoReport> {
        const lookupRecords = [...data.primario.tracciati, ...data.secondario.tracciati]
            .flatMap((t) => t.records);
        const normalize = await createCoopfiNormalizer({ lookupRecords });

        // ── Viste per canale/area (unico livello di aggregazione) ────────────
        const allKeys = new Set<string>();
        for (const t of [...data.primario.tracciati, ...data.secondario.tracciati]) {
            allKeys.add(`${t.guidCanale}::${t.guidArea}`);
        }

        const rawViews: TracciatoReportCanaleAreaView[] = await Promise.all(Array.from(allKeys).map(async key => {
            const sepIdx = key.indexOf('::');
            const guidCanale = key.slice(0, sepIdx);
            const guidArea = key.slice(sepIdx + 2);
            const primarioRecords = data.primario.tracciati
                .filter(t => t.guidCanale === guidCanale && t.guidArea === guidArea)
                .flatMap(t => t.records)
                .map(r => normalize(r));
            const secondarioRecords = data.secondario.tracciati
                .filter(t => t.guidCanale === guidCanale && t.guidArea === guidArea)
                .flatMap(t => t.records)
                .map(r => normalize(r));
            const widgets = this.buildWidgets(primarioRecords, secondarioRecords, data.primario.nomeMomento, data.secondario.nomeMomento);
            // Variante PDF: i temi esclusi vengono tolti dai record, non dai widget, così anche
            // KPI e dettaglio per reparto sono coerenti con le liste mostrate.
            const primarioRecordsPdf = this.filtraRecordPerPdf(primarioRecords);
            const secondarioRecordsPdf = this.filtraRecordPerPdf(secondarioRecords);
            const modificato = primarioRecordsPdf !== primarioRecords || secondarioRecordsPdf !== secondarioRecords;
            const widgetsPdf = modificato
                ? this.buildWidgets(primarioRecordsPdf, secondarioRecordsPdf, data.primario.nomeMomento, data.secondario.nomeMomento)
                : widgets;
            return {
                guidCanale,
                guidArea,
                nomeCanale: '',   // risolto in TracciatoService via DB
                nomeArea: '',
                label: '',
                widgets,
                // Presente solo quando la regola coopfi ha effettivamente escluso qualcosa,
                // per non duplicare inutilmente i widget nel report persistito.
                ...(modificato ? { widgetsPdf } : {}),
            };
        }));

        // ── Subtitle ─────────────────────────────────────────────────────────
        const totalPrimario = data.primario.tracciati.reduce((s, t) => s + t.records.length, 0);
        const totalSecondario = data.secondario.tracciati.reduce((s, t) => s + t.records.length, 0);
        const subtitleParts: string[] = [`${rawViews.length} combinazioni canale/area`];
        if (totalPrimario > 0) subtitleParts.push(`${totalPrimario.toLocaleString('it-IT')} ref. primario`);
        if (totalSecondario > 0) subtitleParts.push(`${totalSecondario.toLocaleString('it-IT')} ref. secondario`);

        // ── widgets = prima vista (retrocompat PDF) ───────────────────────────
        const firstWidgets = rawViews[0]?.widgets ?? [];
        const firstWidgetsPdf = rawViews[0]?.widgetsPdf;

        return {
            title: `Report Confronto Tracciati tra ${data.primario.nomeMomento} & ${data.secondario.nomeMomento} — CoopFi`,
            subtitle: subtitleParts.join(' · '),
            generatedAt: new Date().toISOString(),
            widgets: firstWidgets,
            ...(firstWidgetsPdf ? { widgetsPdf: firstWidgetsPdf } : {}),
            viewsPerCanaleArea: rawViews,
        };
    }

    /** Match "contiene", case-insensitive, sulle diciture di {@link TEMI_ESCLUSI_DA_PDF}. */
    private temaEsclusoDaPdf(tema: unknown): boolean {
        const normalizzato = String(tema ?? "").toUpperCase();
        return this.TEMI_ESCLUSI_DA_PDF.some((dicitura) => normalizzato.includes(dicitura));
    }

    /**
     * Applica le regole di esclusione Coopfi per il PDF: scarta i record il cui `tema` contiene
     * una delle diciture in {@link TEMI_ESCLUSI_DA_PDF}.
     *
     * Il filtro agisce sui record PRIMA del calcolo dei widget (e non sulle sole liste già
     * costruite) perché altrimenti KPI, dettaglio per reparto e sottotitoli continuerebbero a
     * conteggiare referenze che nel PDF non compaiono, gonfiando i totali.
     *
     * Restituisce lo STESSO array quando non c'è nulla da escludere, così il chiamante può
     * evitare di ricalcolare i widget.
     */
    filtraRecordPerPdf(records: DataFields[]): DataFields[] {
        const filtrati = records.filter((record) => !this.temaEsclusoDaPdf(record.tema));
        return filtrati.length === records.length ? records : filtrati;
    }
    async normalizzaDatoConfrontoPerScore(confrontiData: PromoScoreboardInput): Promise<PromoScoreboardInput> {
        const allRecords = confrontiData
            .flatMap(({ risultato }) => [...risultato.primario.tracciati, ...risultato.secondario.tracciati])
            .flatMap(t => t.records);
        const normalize = await createCoopfiNormalizer({ lookupRecords: allRecords });
        for (const { risultato } of confrontiData)
            for (const t of [...risultato.primario.tracciati, ...risultato.secondario.tracciati])
                t.records = t.records.map(normalize);
        return confrontiData;
    }

    /**
     * Calcola il contributo secondo le regole definite in coopfi-score-rules.json.
     * Struttura JSON:
     * {
     *   version: string,
     *   defaultRules: { ... },
     *   groupRules: { [reparto]: { ... } }
     * }
     * Ogni blocco contiene pesi, combinazioni e override per reparto.
     */
    computeContributo(
        tipo: 'uscita' | 'entrata' | 'modifica',
        repartoNome: string,
        campiModificatiCumulativi: string[],
        opts?: { prevEvent?: 'uscita' | 'entrata' | 'modifica' },
    ): { contributoRaw: number; hasTerremoto: boolean } {
        // Determina se esistono regole specifiche per il reparto
        const group: AzioniRule = scoreRules.groupRules?.[repartoNome] ?? {};
        const defaultRules = scoreRules.defaultRules;

        let contributoRaw: number;

        if (tipo === 'uscita') {
            contributoRaw = group.uscita ?? defaultRules.uscita ?? 0;
        } else if (tipo === 'entrata') {
            contributoRaw = group.entrata ?? defaultRules.entrata ?? 0;
        } else {
            // --- MODIFICA ---
            // Merge pesi e combinazioni: group > default
            const modGroup: Partial<ModificaRule> = group.modifica ?? {};
            const modDefault: Required<ModificaRule> = defaultRules.modifica;
            const peso = modGroup.peso ?? modDefault.peso ?? 0;
            const pesiCampi = { ...(modDefault.campi || {}), ...(modGroup.campi || {}) };
            const combinazioni = [
                ...((modDefault.combinazioni || []).map((c: any) => ({ ...c, _from: 'default' }))),
                ...((modGroup.combinazioni || []).map((c: any) => ({ ...c, _from: 'group' })))
            ].sort((a, b) => (b.priority || 0) - (a.priority || 0));

            const campiCoperti = new Set<string>();
            let pesoTotale = 0;
            for (const combinazione of combinazioni) {
                const operator = combinazione.operator === 'all' ? 'every' : 'some';
                const matches = combinazione.if[operator]((campo: string) => campiModificatiCumulativi.includes(campo));
                if (!matches) continue;
                pesoTotale += combinazione.valore;
                for (const campo of combinazione.if) campiCoperti.add(campo);
                break;
            }
            for (const campo of campiModificatiCumulativi) {
                if (!campiCoperti.has(campo)) pesoTotale += Number(pesiCampi[campo]) || 0;
            }
            const pesoMassimo = Object.values(pesiCampi).reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : Number(value) || 0), 0);
            contributoRaw = pesoMassimo > 0 ? (pesoTotale / pesoMassimo) * peso : 0;
        }

        // Cascata extra applicata a tutti i tipi di evento (non solo modifica)
        if (opts?.prevEvent) {
            const cascataExtra = { uscita: 15, entrata: 8, modifica: 5 }[opts.prevEvent] ?? 0;
            contributoRaw += cascataExtra;
        }

        // uscita/entrata avviano sempre il terremoto; modifica solo se ha prodotto contributo
        const hasTerremoto = tipo === 'uscita' || tipo === 'entrata' || contributoRaw > 0;
        return { contributoRaw, hasTerremoto };
    }

    getChangedFields(a: DataFields, b: DataFields): FieldChange[] {
        return Object.entries(COOPFI_TRACKED_FIELD_MAP)
            .filter(([, k]) => a[k] !== b[k])
            .map(([orig, k]) => ({ campo: orig, valoreA: a[k], valoreB: b[k] }));
    }


    async buildScoreboardReport(matrice: MatricePromo, confrontiData: PromoScoreboardInput): Promise<TracciatoReport> {
        const buildAuditByOuterKey = (celle: CellaConfronto[]): Map<string, import('../../../../lib/types').TracciatoWidgetScoreAudit[]> => {
            const auditByOuterKey = new Map<string, import('../../../../lib/types').TracciatoWidgetScoreAudit[]>();
            const pushAudit = (outerKey: string, item: import('../../../../lib/types').TracciatoWidgetScoreAudit) => {
                const items = auditByOuterKey.get(outerKey) ?? [];
                items.push(item);
                auditByOuterKey.set(outerKey, items);
            };

            for (const cella of celle) {
                if (cella.stato !== 'modifica') continue;
                const codice = String(cella.codiceReferenza ?? cella.outerKey);
                if (cella.campiModificatiCumulativi.includes("prezzo_promo")) {
                    pushAudit(cella.outerKey, {
                        type: "danger",
                        message: `Prezzo promozionale modificato — cod. ${codice}`,
                        params: undefined,
                    });
                } else if (cella.campiModificatiCumulativi.includes("prezzo_promo_kgl")) {
                    pushAudit(cella.outerKey, {
                        type: "warn",
                        message: `Prezzo al kg modificato — cod. ${codice}`,
                        params: undefined,
                    });
                }

                for (const campo of cella.campiModificatiCumulativi) {
                    const storia = cella.campiStoria[campo];
                    if (!storia || storia.variazioni.length < 2) continue;
                    const lastEntry = storia.variazioni[storia.variazioni.length - 1];
                    if (lastEntry.confrontoIndex !== cella.confrontoIndex) continue;
                    if (storia.valoreIniziale !== null && storia.valoreIniziale !== undefined && storia.valoreIniziale === storia.valoreFinale) {
                        pushAudit(cella.outerKey, {
                            type: "danger",
                            message: `Valore oscillante su ${codice} — "${TRACKED_FIELDS.find(tf => tf.origKey == campo)?.label ?? campo}": ${storia.valoreIniziale} → ${storia.variazioni[0].valoreB} (confronto ${storia.variazioni[0].confrontoIndex + 1}), poi tornato a ${storia.valoreFinale} (confronto ${lastEntry.confrontoIndex + 1})`,
                            params: undefined,
                        });
                    }
                }
            }
            return auditByOuterKey;
        };

        const buildRowsForCells = (celle: CellaConfronto[]): TracciatoWidgetScoreboardRow[] =>
            TracciatoService.buildRows(celle, buildAuditByOuterKey(celle));

        const groupCellsByCanaleArea = (celle: CellaConfronto[]): Map<string, CellaConfronto[]> => {
            const map = new Map<string, CellaConfronto[]>();
            for (const cella of celle) {
                const items = map.get(cella.canaleArea) ?? [];
                items.push(cella);
                map.set(cella.canaleArea, items);
            }
            return map;
        };

        const timelineSnapshots = matrice.map((riga) => {
            const perCanaleArea = groupCellsByCanaleArea(riga.celle);
            return {
                globalRows: buildRowsForCells(riga.celle),
                canaleAreaRows: new Map(
                    [...perCanaleArea.entries()].map(([key, celle]) => [key, buildRowsForCells(celle)]),
                ),
            };
        });

        const buildAverageRowsFromTimeline = (timelineRows: TracciatoWidgetScoreboardRow[][]): TracciatoWidgetScoreboardRow[] => {
            const steps = timelineRows.length;
            if (steps === 0) return [];

            const reparti = [...new Set(
                timelineRows.flatMap(rows => rows.map(row => row.reparto)),
            )];

            return reparti.map((reparto) => {
                const rowsForReparto = timelineRows.map(rows => rows.find(row => row.reparto === reparto));
                const latestRow = [...rowsForReparto].reverse().find((row): row is TracciatoWidgetScoreboardRow => Boolean(row));
                const scoreMedio = Math.round(
                    rowsForReparto.reduce((sum, row) => sum + (row ? clampPercent(row.score) : 0), 0) / steps,
                );
                const codici = [...new Set(
                    rowsForReparto.flatMap(row => row?.codici?.map(codice => codice.codice) ?? []),
                )];
                const codiciMedi: TracciatoWidgetScoreboardCodiceRow[] = codici.map((codice) => {
                    const codiciForReparto = rowsForReparto.map(row => row?.codici?.find(item => item.codice === codice));
                    const latestCodice = [...codiciForReparto].reverse().find((item): item is TracciatoWidgetScoreboardCodiceRow => Boolean(item));
                    const scoreMedioCodice = Math.round(
                        codiciForReparto.reduce((sum, item) => sum + (item ? clampPercent(item.score) : 0), 0) / steps,
                    );

                    return {
                        ...(latestCodice ?? {
                            codice,
                            inalterati: 0,
                            uscenti: 0,
                            entranti: 0,
                            modificati: 0,
                            totale: 0,
                        }),
                        codice,
                        percentualeIntegra: scoreMedioCodice,
                        score: scoreMedioCodice,
                    };
                }).sort((a, b) => a.codice.localeCompare(b.codice));

                return {
                    ...(latestRow ?? {
                        reparto,
                        inalterati: 0,
                        uscenti: 0,
                        entranti: 0,
                        modificati: 0,
                        totale: 0,
                    }),
                    reparto,
                    percentualeIntegra: scoreMedio,
                    score: scoreMedio,
                    codici: codiciMedi.length > 1 ? codiciMedi : undefined,
                };
            }).sort((a, b) => b.score - a.score);
        };

        const globalRows = buildAverageRowsFromTimeline(timelineSnapshots.map(snapshot => snapshot.globalRows));
        const canaleAreaKeysFromTimeline = new Set<string>();
        for (const snapshot of timelineSnapshots) {
            for (const key of snapshot.canaleAreaRows.keys()) {
                canaleAreaKeysFromTimeline.add(key);
            }
        }
        const canaleAreaRows = new Map(
            [...canaleAreaKeysFromTimeline].map((key) => [
                key,
                buildAverageRowsFromTimeline(timelineSnapshots.map(snapshot => snapshot.canaleAreaRows.get(key) ?? [])),
            ]),
        );

        const calculateAverageRepartoScore = (rows: TracciatoWidgetScoreboardRow[]): number =>
            rows.length > 0
                ? Math.round(rows.reduce((sum, row) => sum + clampPercent(row.score), 0) / rows.length)
                : 0;

        const buildScoreboardWidget = (rows: TracciatoWidgetScoreboardRow[], id: string, nConfront: number): TracciatoWidgetScoreboard => {
            const totalScore = calculateAverageRepartoScore(rows);
            return {
                id,
                type: 'scoreboard',
                title: 'Stabilita per reparto',
                description: `Score calcolato su ${nConfront} confronti - piu referenze cambiano, entrano o escono -> punteggio piu basso`,
                badge: `Score ${totalScore}/100`,
                gridSpan: 4,
                rows,
                totalScore,
            };
        };

        const buildLineChartWidgetFromTimeline = (
            id: string,
            labels: string[],
            timelineRows: TracciatoWidgetScoreboardRow[][],
        ): TracciatoWidgetLineChart | null => {
            if (labels.length === 0 || timelineRows.length === 0) return null;

            const reparti = [...new Set(
                timelineRows.flatMap(rows => rows.map(row => row.reparto)),
            )].sort((a, b) => a.localeCompare(b));
            if (reparti.length === 0) return null;

            const rowsByStep = timelineRows.map((rows) =>
                new Map(rows.map((row) => [row.reparto, clampPercent(row.percentualeIntegra)])),
            );

            const datasets = reparti.map((reparto, index) => {
                let lastValue = 100;
                const data = rowsByStep.map((rowsMap) => {
                    const stepValue = rowsMap.get(reparto);
                    if (typeof stepValue === 'number') {
                        lastValue = stepValue;
                    }
                    return clampPercent(lastValue);
                });
                const color = LINE_CHART_PALETTE[index % LINE_CHART_PALETTE.length];
                return {
                    label: reparto,
                    data,
                    borderColor: color,
                    backgroundColor: color,
                };
            });

            return {
                id,
                type: 'line_chart',
                title: 'Andamento score per reparto',
                description: 'Asse X: confronti ordinati - Asse Y: punteggio finale (%)',
                badge: `${reparti.length} reparti - ${labels.length} confronti`,
                gridSpan: 4,
                labels,
                datasets,
            };
        };

        const confrontoLabels = confrontiData.map(
            ({ primarioNome, secondarioNome }, index) =>
                `${index + 1}. ${primarioNome} -> ${secondarioNome}`,
        );

        const globalWidget = buildScoreboardWidget(globalRows, 'promo-scoreboard', confrontiData.length);
        const totalReferenze = globalRows.reduce((s, r) => s + r.totale, 0);
        const scoreLabel = globalWidget.totalScore >= 80 ? 'ottimo' : globalWidget.totalScore >= 60 ? 'buono' : globalWidget.totalScore >= 40 ? 'moderato' : 'critico';
        const globalLineWidget = buildLineChartWidgetFromTimeline(
            'promo-scoreboard-trend',
            confrontoLabels,
            timelineSnapshots.map(snapshot => snapshot.globalRows),
        );

        const canaleAreaKeys = [...canaleAreaRows.keys()].sort();
        const viewsPerCanaleArea = canaleAreaKeys.length > 1
            ? canaleAreaKeys.map(key => {
                const sepIdx = key.indexOf('::');
                const guidCanale = key.slice(0, sepIdx);
                const guidArea = key.slice(sepIdx + 2);
                const rows = canaleAreaRows.get(key) ?? [];
                const widgets: TracciatoReportWidget[] = [
                    buildScoreboardWidget(rows, `promo-scoreboard-${key}`, confrontiData.length),
                ];
                const lineWidget = buildLineChartWidgetFromTimeline(
                    `promo-scoreboard-trend-${key}`,
                    confrontoLabels,
                    timelineSnapshots.map((snapshot) => snapshot.canaleAreaRows.get(key) ?? []),
                );
                if (lineWidget) {
                    widgets.push(lineWidget);
                }
                return {
                    guidCanale,
                    guidArea,
                    nomeCanale: '',
                    nomeArea: '',
                    label: '',
                    widgets,
                };
            })
            : undefined;

        const globalWidgets: TracciatoReportWidget[] = [];
        if (!viewsPerCanaleArea && globalLineWidget && globalLineWidget.datasets.length > 0) {
            globalWidgets.push(globalLineWidget);
            globalWidgets.push(globalWidget);
        }

        return {
            title: 'Analisi Totale Promo - CoopFi',
            subtitle: `${globalRows.length} reparti - ${totalReferenze.toLocaleString('it-IT')} referenze totali - Score complessivo ${globalWidget.totalScore}/100 (${scoreLabel})`,
            generatedAt: new Date().toISOString(),
            widgets: globalWidgets,
            viewsPerCanaleArea,
        };
    }
    async parseUtenteOIDC(
        email: string,
        claims: OidcUserClaims
    ): Promise<ParsedOIDCUtente> {
        void TIPI_CON_GDO;
        void this.userService;

        const userExist = await this.userService.getUserByEmail(email.toLowerCase());
        const utenteCoopfiCensito = await this.fetchUtenteCoopfiCensito(claims.oid, email);

        if (!ServerUtils.checkIfValueIsValid(utenteCoopfiCensito)) {
            throw new NotFoundError({
                message: "Utente non censi",
                entityType: "GDO"
            });
        }
        const tenantId = claims.tid ?? process.env.AD_TENANT_ID;
        const photo = (claims.oid && tenantId)
            ? await this.fetchUserPhotoFromGraph(claims.oid, tenantId)
            : null;

        if (!ServerUtils.checkIfValueIsValid(userExist)) {
            const gdoCoopFi = await GDO.findOne();
            if (!ServerUtils.checkIfValueIsValid(gdoCoopFi)) {
                throw new NotFoundError({
                    message: "GDO non presente nel database",
                    entityType: "GDO"
                });
            }
            const ruoloParsed = await this.parseGruppiPerRuolo(utenteCoopfiCensito.gruppi)
            //const filtriPerGruppo = await this.getFiltriFromUtenteCoop(utenteCoopfiCensito.codicePosizione)

            const isBusinessCategory = ruoloParsed === "BUSINESS_CATEGORY";

            if (isBusinessCategory) {
                // BUSINESS_CATEGORY: tipo CATEGORY, ruolo derivato dal prefisso del codicePosizione
                const ruoloCategoryFromCodice = this.parseRuoloDaCodicePosizione(utenteCoopfiCensito.codicePosizione);
                const ruoloCategoryRecord = ruoloCategoryFromCodice
                    ? await this.findOrCreateRuolo(ruoloCategoryFromCodice)
                    : null;

                const utente = await this.userService.registerUserWithTransaction({
                    email: utenteCoopfiCensito.mail != "" ? utenteCoopfiCensito.mail : email,
                    nome: utenteCoopfiCensito.nome != "" ? utenteCoopfiCensito.nome : claims.name,
                    cognome: utenteCoopfiCensito.cognome != "" ? utenteCoopfiCensito.cognome : "test",
                    tipo: TIPO_UTENTI.CATEGORY,
                    stato: STATO_UTENTI.ATTIVO,
                    residenza: "Non specificata",
                    dataDiNascita: DEFAULT_BIRTH_DATE,
                    gdoScelta: gdoCoopFi.id_gdo,
                    ...(ruoloCategoryRecord ? { id_ruolo_utente_gdo: ruoloCategoryRecord.id_ruolo_utente_gdo } : {}),
                    meta: {
                        gruppi_ad: utenteCoopfiCensito.gruppi,
                        //filtri_utente: filtriPerGruppo,
                        codice_posizione: utenteCoopfiCensito.codicePosizione,
                        ...(photo ? { photo } : {})
                    }
                }, "System")

                const privateKey = await this.initOlympusPassport(utente.id_utenti);

                return {
                    id: utente.id_utenti,
                    email: email,
                    tipo_utente: TIPO_UTENTI.CATEGORY,
                    private_key: privateKey,
                    codice_posizione: utenteCoopfiCensito.codicePosizione
                };
            }

            // Deriva tipo e ruolo dal codicePosizione (area → tipo, prefisso → ruolo)
            const tipoRuoloParsed = this.parseTipoRuoloDaCodicePosizione(utenteCoopfiCensito.codicePosizione);
            if (tipoRuoloParsed) {
                const ruoloRecord = await this.findOrCreateRuolo(tipoRuoloParsed.ruolo);
                const utente = await this.userService.registerUserWithTransaction({
                    email: utenteCoopfiCensito.mail != "" ? utenteCoopfiCensito.mail : email,
                    nome: utenteCoopfiCensito.nome != "" ? utenteCoopfiCensito.nome : claims.name,
                    cognome: utenteCoopfiCensito.cognome != "" ? utenteCoopfiCensito.cognome : "test",
                    tipo: tipoRuoloParsed.tipo,
                    stato: STATO_UTENTI.ATTIVO,
                    residenza: "Non specificata",
                    dataDiNascita: DEFAULT_BIRTH_DATE,
                    gdoScelta: gdoCoopFi.id_gdo,
                    id_ruolo_utente_gdo: ruoloRecord.id_ruolo_utente_gdo,
                    meta: {
                        gruppi_ad: utenteCoopfiCensito.gruppi,
                        //filtri_utente: filtriPerGruppo,
                        codice_posizione: utenteCoopfiCensito.codicePosizione,
                        ...(photo ? { photo } : {})
                    }
                }, "System")

                const privateKey = await this.initOlympusPassport(utente.id_utenti);

                return {
                    id: utente.id_utenti,
                    email: email,
                    tipo_utente: tipoRuoloParsed.tipo,
                    private_key: privateKey,
                    codice_posizione: utenteCoopfiCensito.codicePosizione
                };
            }

            // Flusso standard: tipo GDO con ruolo
            const ruoloByCodice = await this.findOrCreateRuolo(ruoloParsed);
            const utente = await this.userService.registerUserWithTransaction({
                email: utenteCoopfiCensito.mail != "" ? utenteCoopfiCensito.mail : email,
                nome: utenteCoopfiCensito.nome != "" ? utenteCoopfiCensito.nome : claims.name,
                cognome: utenteCoopfiCensito.cognome != "" ? utenteCoopfiCensito.cognome : "test",
                tipo: TIPO_UTENTI.GDO,
                stato: STATO_UTENTI.ATTIVO,
                residenza: "Non specificata",
                dataDiNascita: DEFAULT_BIRTH_DATE,
                gdoScelta: gdoCoopFi.id_gdo,
                id_ruolo_utente_gdo: ruoloByCodice.id_ruolo_utente_gdo,
                meta: {
                    gruppi_ad: utenteCoopfiCensito.gruppi,
                    //filtri_utente: filtriPerGruppo,
                    codice_posizione: utenteCoopfiCensito.codicePosizione,
                    ...(photo ? { photo } : {})
                }
            }, null)

            const privateKey = await this.initOlympusPassport(utente.id_utenti);

            return {
                id: utente.id_utenti,
                email: email,
                tipo_utente: TIPO_UTENTI.GDO,
                private_key: privateKey,
                codice_posizione: utenteCoopfiCensito.codicePosizione
            };
        } else {
            const gruppiAdSalvati = Array.isArray(userExist.meta?.gruppi_ad)
                ? userExist.meta.gruppi_ad
                : [];
            const gruppiAdDaApi = Array.isArray(utenteCoopfiCensito.gruppi)
                ? utenteCoopfiCensito.gruppi
                : [];
            const codicePosizioneSalvato = userExist.meta?.codice_posizione as string | undefined;
            const needsMeta = !this.areStringArraysEqual(gruppiAdSalvati, gruppiAdDaApi)
                || codicePosizioneSalvato !== utenteCoopfiCensito.codicePosizione
                || (photo !== null && photo !== userExist.meta?.photo);
            if (needsMeta) {
                await this.userService.updateProfile(userExist.id, {
                    meta: {
                        ...userExist.meta,
                        gruppi_ad: gruppiAdDaApi,
                        codice_posizione: utenteCoopfiCensito.codicePosizione,
                        ...(photo ? { photo } : {})
                    }
                });
            }
            await this.initOlympusPassport(userExist.id);

            return {
                id: userExist.id,
                private_key: userExist.private_key,
                id_gdo: userExist.id_gdo,
                email: userExist.email,
                tipo_utente: userExist.tipo,
                codice_posizione: utenteCoopfiCensito.codicePosizione
            };
        }


    }
    //#region FUNZIONI PARSE UTENTE OIDC
    /**
     * Chiama Olympus /auth/getPassport per il nuovo utente appena registrato,
     * salvando la private_key ottenuta direttamente nel record Utente.
     * Ritorna la private_key se l'operazione riesce, undefined in caso di errore.
     */
    private async initOlympusPassport(userId: string): Promise<string | undefined> {
        try {
            const utente = await Utente.findByPk(userId);
            if (!utente) return undefined;

            const gruppiAd = Array.isArray(utente.meta_utenti?.gruppi_ad)
                ? utente.meta_utenti.gruppi_ad
                : [];
            const haGruppoCheDeveVedereTutto = gruppiAd.some(
                (gad) => gad === "GA1040_Marketing" || gad === "GA1040_Admin"
            );
            // Il nuovo utente non ha ancora una private_key: usiamo fico-secret
            const response = await fetch(config.OLYMPUS_IP_ADDRESS + "/auth/getPassport", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "fico-secret": config.FICO_SECRET as string
                },
                body: JSON.stringify({
                    username: utente.email_utenti,
                    tipoUtente: utente.tipo_utenti,
                    origin: "FP",
                    campi_aggiuntivi: {
                        nome: utente.nome_utenti,
                        cognome: utente.cognome_utenti,
                        email: utente.email_utenti,
                        stato: utente.stato_utenti,
                        residenza: utente.residenza_utenti,
                        dataDiNascita: utente.datadinascita_utenti,
                        tipo: utente.tipo_utenti
                    },
                    gruppi: gruppiAd,
                    codice_posizione: utente.meta_utenti?.codice_posizione ?? null,
                    ruoli: haGruppoCheDeveVedereTutto ? [] : this.getRuoliPolicyFromUtenteCoop(
                        utente.meta_utenti?.codice_posizione as string | undefined
                    )
                })
            });

            if (!response.ok) return undefined;

            const content = await response.json() as {
                esito: boolean;
                privateKey?: string;
            };

            if (content.esito && content.privateKey) {
                utente.privatekey_utenti = content.privateKey;
                await utente.save();
                return content.privateKey;
            }

            return undefined;
        } catch (error) {
            log.warn("[CoopfiAgenziaLib] Errore inizializzazione passport Olympus per nuovo utente:", error);
            return undefined;
        }
    }

    private async findOrCreateRuolo(ruolo: string): Promise<InstanceType<typeof RuoloUtenteGDO>> {
        const [record] = await RuoloUtenteGDO.findOrCreate({
            where: { ruolo_ruolo_utente_gdo: ruolo },
            defaults: { ruolo_ruolo_utente_gdo: ruolo }
        });
        return record;
    }

    private async getGraphAccessToken(tenantId: string): Promise<string | null> {
        if (this.graphTokenCache && this.graphTokenCache.expiresAt > (Date.now() + TOKEN_EXPIRY_SAFETY_WINDOW_MS)) {
            return this.graphTokenCache.accessToken;
        }

        try {
            const body = new URLSearchParams({
                client_id: process.env.AD_CLIENT_ID ?? "",
                client_secret: process.env.AD_CLIENT_SECRET ?? "",
                scope: "https://graph.microsoft.com/.default",
                grant_type: "client_credentials"
            });

            const response = await fetch(
                `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
                { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }
            );

            if (!response.ok) return null;

            const tokenData = await response.json() as CoopfiAuthTokenResponse;
            if (!tokenData.access_token) return null;

            this.graphTokenCache = {
                accessToken: tokenData.access_token,
                expiresAt: this.getExpiresAtFromTokenPayload(tokenData)
            };

            return this.graphTokenCache.accessToken;
        } catch {
            return null;
        }
    }

    private async fetchUserPhotoFromGraph(oid: string, tenantId: string): Promise<string | null> {
        try {
            const token = await this.getGraphAccessToken(tenantId);
            if (!token) return null;

            const response = await fetch(`https://graph.microsoft.com/v1.0/users/${oid}/photo/$value`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) return null;

            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get("content-type") ?? "image/jpeg";
            return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
        } catch {
            return null;
        }
    }

    //#region UTILITY
    private parseTipoRuoloDaCodicePosizione(
        codicePosizione: string
    ): { tipo: TIPO_UTENTI; ruolo: RUOLO_UTENTE_GDO } | null {
        const underscoreIdx = codicePosizione.indexOf("_");
        if (underscoreIdx === -1) return null;

        const prefix = codicePosizione.substring(0, underscoreIdx);
        const area = codicePosizione.substring(underscoreIdx + 1);

        const areaToTipo: Record<string, TIPO_UTENTI> = {
            // --- IT: Software Applicativo ---
            APCV: TIPO_UTENTI.IT,  // Area Applicativa Commerciale - Vendite
            SWAMFS: TIPO_UTENTI.IT,  // SW Applicativo Area Merci PDV & Funz. Supporto
            SWSDBI: TIPO_UTENTI.IT,  // SW Applicativo Area Sistemi Dir. e B.I.
            SWMTG: TIPO_UTENTI.IT,  // SW Applicativo Area Marketing
            SWDI: TIPO_UTENTI.IT,  // Software Applicativo Distrettuale/Iper
            SWSC: TIPO_UTENTI.IT,  // SW Applicativo Area Supply Chain
            SWSP: TIPO_UTENTI.IT,  // Software Sistemi POS
            SWA: TIPO_UTENTI.IT,  // Software Applicativo
            // --- IT: Infrastrutture, Sistemi e Sicurezza ---
            ICTO: TIPO_UTENTI.IT,  // Infrastrutture ICT e Operating
            SIS: TIPO_UTENTI.IT,  // Sistemista
            NET: TIPO_UTENTI.IT,  // Networking & TLC
            SAI: TIPO_UTENTI.IT,  // Sicurezza & Auditing IT
            INF: TIPO_UTENTI.IT,  // Informatica
            GSP: TIPO_UTENTI.IT,  // Gestione Sistemi POS
            POS: TIPO_UTENTI.IT,  // Sistemi POS
            COIT: TIPO_UTENTI.IT,  // Coordinatore IT
            WDC: TIPO_UTENTI.IT,  // Webdoc
            IT: TIPO_UTENTI.IT,  // IT
            // --- IT: Analisi e PMO ---
            BI: TIPO_UTENTI.IT,  // Business Intelligence
            AB: TIPO_UTENTI.IT,  // Analista di Business
            ANLORG: TIPO_UTENTI.IT,  // Analista Organizzazione Project Management
            AMMOS: TIPO_UTENTI.IT,  // Servizi Amministrativi Org. e Sistemi
            // --- MARKETING: Comunicazione Commerciale ---
            COMKTG: TIPO_UTENTI.MARKETING,  // Comunicazione Commerciale
            // --- MARKETING: Marketing e Promozione ---
            MKTGANAP: TIPO_UTENTI.MARKETING,  // Marketing Analitico, Assortimenti e Posizionamento
            DIGMKTG: TIPO_UTENTI.MARKETING,  // Digital Marketing
            MKTOP: TIPO_UTENTI.MARKETING,  // Marketing Operativo
            PRFICOM: TIPO_UTENTI.MARKETING,  // Promo, Fidelizzazione e Comunicazione Commerciale
            PRFI: TIPO_UTENTI.MARKETING,  // Promo e Fidelizzazione
            PUB: TIPO_UTENTI.MARKETING,  // Pubblicità
            VMRC: TIPO_UTENTI.MARKETING,  // Visual Merchandising
            PPCMZCC: TIPO_UTENTI.MARKETING,  // Prog. Posiz. e Commercializzazione C.C.
            // --- MARKETING: Analisi e Ricerche ---
            ANME: TIPO_UTENTI.MARKETING,  // Analisi di Mercato
            ANST: TIPO_UTENTI.MARKETING,  // Analisi Strategica
            MRSC: TIPO_UTENTI.MARKETING,  // Monitoraggi e Ricerche Soci e Consumatori
            // --- MARKETING: Comunicazione Interna e Istituzionale ---
            CMZ: TIPO_UTENTI.MARKETING,  // Comunicazioni
            CIRU: TIPO_UTENTI.MARKETING,  // Comunicazione Interna e Relazioni RU
            COIS: TIPO_UTENTI.MARKETING,  // Comunicazione Istituzionale
            CPDV: TIPO_UTENTI.MARKETING,  // Eventi Comunicazione PDV
        };

        const tipo = areaToTipo[area];
        const ruolo = PREFIX_TO_RUOLO[prefix];

        if (!tipo || !ruolo) return null;

        return { tipo, ruolo };
    }

    /**
     * Deriva solo il ruolo dal prefisso del codicePosizione (es. "RAA_OF" → ADMIN).
     * Non richiede che l'area sia riconosciuta: utile per utenti CATEGORY
     * di cui conosciamo già il tipo.
     */
    private parseRuoloDaCodicePosizione(codicePosizione: string): RUOLO_UTENTE_GDO | null {
        const underscoreIdx = codicePosizione.indexOf("_");
        if (underscoreIdx === -1) return null;

        const prefix = codicePosizione.substring(0, underscoreIdx);
        return PREFIX_TO_RUOLO[prefix] ?? null;
    }

    private extractApiErrorMessage(payload: unknown): string | null {
        if (typeof payload === "string") {
            const message = payload.trim();
            return message.length > 0 ? message : null;
        }

        if (!payload || typeof payload !== "object") {
            return null;
        }

        const body = payload as Record<string, unknown>;
        const possibleMessages = [
            body.message,
            body.error_description,
            body.error,
            body.detail
        ];

        for (const item of possibleMessages) {
            if (typeof item === "string" && item.trim().length > 0) {
                return item.trim();
            }
        }

        return null;
    }

    private async throwMappedCoopfiApiError(
        response: Response,
        endpoint: string
    ): Promise<never> {
        let rawBody = "";
        try {
            rawBody = await response.text();
        } catch {
            rawBody = "";
        }

        let parsedBody: unknown = undefined;
        if (rawBody) {
            try {
                parsedBody = JSON.parse(rawBody);
            } catch {
                parsedBody = rawBody;
            }
        }

        const apiMessage = this.extractApiErrorMessage(parsedBody)
            || response.statusText
            || `HTTP ${response.status}`;

        const retryAfterRaw = response.headers.get("retry-after");
        const retryAfterNumber = retryAfterRaw ? Number(retryAfterRaw) : undefined;
        const retryAfter = typeof retryAfterNumber === "number" && Number.isFinite(retryAfterNumber)
            ? retryAfterNumber
            : undefined;

        const details: Record<string, unknown> = {
            endpoint,
            statusCode: response.status,
            statusText: response.statusText
        };

        if (parsedBody !== undefined) {
            details.responseBody = parsedBody;
        } else if (rawBody) {
            details.responseBody = rawBody;
        }

        switch (response.status) {
            case 400:
            case 422:
                throw new BadRequestError({
                    message: `Richiesta non valida verso Coopfi API: ${apiMessage}`,
                    details
                });
            case 401:
                throw new UnauthorizedError({
                    message: `Autenticazione non valida verso Coopfi API: ${apiMessage}`,
                    details
                });
            case 403:
                throw new ForbiddenError({
                    message: `Accesso negato dalla Coopfi API: ${apiMessage}`,
                    details
                });
            case 404:
                throw new NotFoundError({
                    message: `Endpoint Coopfi API non trovato: ${endpoint}`,
                    entityType: "Endpoint API",
                    entityId: endpoint,
                    details
                });
            case 429:
                throw new RateLimitError({
                    message: `Rate limit Coopfi API superato: ${apiMessage}`,
                    limitType: "api",
                    retryAfter,
                    details
                });
            case 503:
            case 504:
                AuditLogService.getInstance().systemError(undefined, 'COOPFI_SERVICE_DOWN', {
                    endpoint,
                    statusCode: response.status,
                    statusText: response.statusText,
                    reason: `Coopfi API temporaneamente non disponibile: ${apiMessage}`,
                    retryAfter
                });
                throw new ServiceUnavailableError({
                    message: `Coopfi API temporaneamente non disponibile: ${apiMessage}`,
                    service: "Coopfi API",
                    retryAfter,
                    details
                });
            case 500:
            case 502:
            default:
                AuditLogService.getInstance().systemError(undefined, 'COOPFI_SERVICE_DOWN', {
                    endpoint,
                    statusCode: response.status,
                    statusText: response.statusText,
                    reason: `Il servizio Coop è momentaneamente offline (HTTP ${response.status}).`,
                    retryAfter
                });
                throw new ServiceUnavailableError({
                    message: `Il servizio Coop è momentaneamente offline. Si prega di riprovare più tardi.`,
                    service: "Coopfi API",
                    retryAfter,
                    details
                });
        }
    }
    private async parseGruppiPerRuolo(gruppi: string[]): Promise<string> {
        // Estrae il ruolo rimuovendo eventuale prefisso tipo "GA1040_"
        if (!Array.isArray(gruppi) || gruppi.length === 0) return "";

        // Cerca il primo gruppo valido che contiene un underscore
        const gruppo = gruppi.find(g => typeof g === "string" && g.includes("_"));
        if (!gruppo) return "";

        // Rimuove il prefisso fino al primo underscore
        const ruolo = gruppo.substring(gruppo.indexOf("_") + 1);

        switch (ruolo) {
            case "BUSINESS_CATEGORY":
                return ruolo;
            case "Admin":
            case "Marketing":
                return ruolo.toUpperCase();
        }
        return "";
    }
    private getRuoliPolicyFromUtenteCoop(codicePosizione: string | null | undefined) {
        if (!codicePosizione) {
            return [];
        }

        const result = buildCoopfiPolicyFromCodeV2(codicePosizione);
        if (!result.ok) {
            log.warn("[CoopfiAgenziaLib] Impossibile derivare ruoli policy da codice posizione", {
                codicePosizione,
                error: result.error,
            });
            return [];
        }
        return result.tree;
    }
    // private getFiltriFromUtenteCoop(codicePosizione: string): Array<FilterCondition[]> {
    //     const result = buildCoopfiPolicyFromCodeV2(codicePosizione);

    //     if (!result.ok) {
    //         log.warn("[CoopfiAgenziaLib] Impossibile derivare filtri da codice posizione", {
    //             codicePosizione,
    //             error: result.error
    //         });
    //         return [];
    //     }

    //     if (result.finalSettori.length === 0) {
    //         return [];
    //     }

    //     return result.finalSettori.map(settore => ([{
    //         field: "reparto",
    //         operator: "equals" as const,
    //         value: settore
    //     }]));
    // }

    private areStringArraysEqual(left: string[], right: string[]): boolean {
        if (left.length !== right.length) {
            return false;
        }

        const normalizedLeft = [...left].sort((a, b) => a.localeCompare(b));
        const normalizedRight = [...right].sort((a, b) => a.localeCompare(b));

        for (let index = 0; index < normalizedLeft.length; index++) {
            if (normalizedLeft[index] !== normalizedRight[index]) {
                return false;
            }
        }

        return true;
    }

    private hasValidCachedToken(): boolean {
        if (!this.authTokenCache) {
            return false;
        }

        return this.authTokenCache.expiresAt > (Date.now() + TOKEN_EXPIRY_SAFETY_WINDOW_MS);
    }

    private getCachedAccessToken(): string | null {
        if (!this.hasValidCachedToken()) {
            return null;
        }

        return this.authTokenCache!.accessToken;
    }

    private invalidateCachedAccessToken(): void {
        this.authTokenCache = null;
    }

    private getExpiresAtFromTokenPayload(tokenData: CoopfiAuthTokenResponse): number {
        const expiresInSeconds = typeof tokenData.expires_in === "number"
            && Number.isFinite(tokenData.expires_in)
            && tokenData.expires_in > 0
            ? tokenData.expires_in
            : DEFAULT_TOKEN_TTL_SECONDS;

        return Date.now() + (expiresInSeconds * 1000);
    }

    private async getCoopfiAccessToken(apiUrlPerRicevereIlDato: string): Promise<string> {
        const cachedToken = this.getCachedAccessToken();
        if (cachedToken) {
            return cachedToken;
        }

        if (this.authTokenRequestPromise) {
            return this.authTokenRequestPromise;
        }

        const urlCompletaAutenticazione = `${apiUrlPerRicevereIlDato}/oauth/azure-ad/token`;
        this.authTokenRequestPromise = (async () => {
            const body = new URLSearchParams({
                client_id: process.env.AD_CLIENT_ID ?? "",
                scope: process.env.AD_CLIENT_SCOPE ?? "",
                grant_type: "client_credentials",
                client_secret: process.env.AD_CLIENT_SECRET ?? ""
            });

            const response = await fetch(urlCompletaAutenticazione, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "client-key": process.env.AD_CLIENT_KEY
                },
                body
            });

            if (!response.ok) {
                await this.throwMappedCoopfiApiError(response, urlCompletaAutenticazione);
            }

            const tokenData = await response.json() as CoopfiAuthTokenResponse;
            if (!ServerUtils.checkIfValueIsValid(tokenData.access_token)) {
                throw new UnauthorizedError({
                    message: "Token Coopfi API non valido o mancante",
                    details: {
                        endpoint: urlCompletaAutenticazione,
                        responseBody: tokenData
                    }
                });
            }

            this.authTokenCache = {
                accessToken: tokenData.access_token!,
                expiresAt: this.getExpiresAtFromTokenPayload(tokenData)
            };

            return this.authTokenCache.accessToken;
        })();

        try {
            return await this.authTokenRequestPromise;
        } finally {
            this.authTokenRequestPromise = null;
        }
    }

    /**
     * Recupera i dati dell'utente censito in Coopfi.
     *
     * Strategia di ricerca:
     * 1. Se `oid` (Azure Object ID) è disponibile: ricerca esatta per `azure_id` — match preciso e immutabile
     * 2. Fallback su email (regex) se `oid` non è presente nei claims
     */
    private async fetchUtenteCoopfiCensito(oid: string | undefined, email: string): Promise<CoopfiUtenteCensito> {
        if (!config.CLIENT_API_URL) {
            throw new NotFoundError({
                message: "Api URL Coopfi non inserita",
                entityType: "Api URL"
            })
        }

        const apiUrlPerRicevereIlDato = config.CLIENT_API_URL;
        // Projection con filtraggio dei gruppi come richiesto
        const projection = JSON.stringify({
            nome: 1,
            cognome: 1,
            user: 1,
            mail: 1,
            azure_id: 1,
            codicePosizione: 1,
            descrizionePosizione: 1,
            gruppi: {
                $filter: {
                    input: "$gruppi",
                    as: "fgruppi",
                    cond: {
                        $in: [
                            "$$fgruppi",
                            [
                                "GA1040_Marketing",
                                "GA1040_BUSINESS_CATEGORY",
                                "GA1040_Admin"
                            ]
                        ]
                    }
                }
            }
        });

        const gruppiFilter = `"gruppi":{"$in":["GA1040_Marketing","GA1040_BUSINESS_CATEGORY","GA1040_Admin"]}`;
        const query = oid
            ? `{"azure_id":"${oid}",${gruppiFilter}}`
            : `{"mail":{"$regex":"${email}","$options":"i"},${gruppiFilter}}`;

        const apiPerGruppiUtente = `${apiUrlPerRicevereIlDato}/commons/utenti-AD/?_l=1&_sk=0&_q=${query}&_rawp=${projection}`;

        const responseUtente = await this.fetchWithFibRetry(apiPerGruppiUtente, apiUrlPerRicevereIlDato);

        const payload = await responseUtente.json() as CoopfiUtenteCensito | CoopfiUtenteCensito[];
        const utente = Array.isArray(payload) ? payload[0] : payload;

        if (!ServerUtils.checkIfValueIsValid(utente)) {
            // Utente non trovato con il filtro gruppi — verifica se esiste senza restrizioni
            const querySenzaGruppi = oid
                ? `{"azure_id":"${oid}"}`
                : `{"mail":{"$regex":"${email}","$options":"i"}}`;
            const apiSenzaGruppi = `${apiUrlPerRicevereIlDato}/commons/utenti-AD/?_l=1&_sk=0&_q=${querySenzaGruppi}&_rawp=${projection}`;

            let responseFallback: Response | null = null;
            try {
                responseFallback = await this.fetchWithFibRetry(apiSenzaGruppi, apiUrlPerRicevereIlDato);
            } catch {
                // best-effort: se il fallback fallisce, defaultiamo a NotFoundError
            }

            if (responseFallback?.ok) {
                const fallbackPayload = await responseFallback.json() as CoopfiUtenteCensito | CoopfiUtenteCensito[];
                const fallbackUtente = Array.isArray(fallbackPayload) ? fallbackPayload[0] : fallbackPayload;

                if (ServerUtils.checkIfValueIsValid(fallbackUtente)) {
                    throw new ForbiddenError({
                        message: `L'utente non appartiene a nessun gruppo autorizzato`,
                        details: {
                            searchedBy: oid ? "azure_id" : "email"
                        }
                    });
                }
            }

            const identifier = oid ? `azure_id=${oid}` : `email=${email}`;
            throw new NotFoundError({
                message: `Utente Coopfi non trovato (${identifier})`,
                entityType: "Utente Coopfi",
                details: {
                    endpoint: apiPerGruppiUtente,
                    searchedBy: oid ? "azure_id" : "email"
                }
            });
        }

        return utente;
    }
    //#endregion

    private async fetchWithFibRetry(
        fullUrl: string,
        apiBaseUrl: string,
        maxTransientAttempts = 4
    ): Promise<Response> {
        const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
        const fib = [1, 1]; // seed Fibonacci: 1, 1, 2, 3, 5, 8...

        for (let attempt = 0; attempt <= maxTransientAttempts; attempt++) {
            // Estende la sequenza Fibonacci se necessario
            while (fib.length <= attempt) {
                fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
            }

            const token = await this.getCoopfiAccessToken(apiBaseUrl);
            const headers: Record<string, string> = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${token}`,
                "client-key": process.env.AD_CLIENT_KEY ?? ""
            };

            let response: Response;
            try {
                response = await fetch(fullUrl, { method: "GET", headers });
            } catch (networkError) {
                // Errore di rete (TypeError, ECONNREFUSED, ecc.) — retry con backoff Fibonacci
                if (attempt === maxTransientAttempts) {
                    throw new ServiceUnavailableError({
                        message: "Coopfi API non raggiungibile dopo multipli tentativi",
                        service: "Coopfi API",
                        details: { url: fullUrl, attempts: attempt + 1, error: String(networkError) }
                    });
                }
                log.warn(`[CoopfiAgenziaLib] Errore di rete (tentativo ${attempt + 1}/${maxTransientAttempts + 1}), retry tra ${fib[attempt]}s`, { url: fullUrl });
                await new Promise(resolve => setTimeout(resolve, fib[attempt] * 1000));
                continue;
            }

            // 401: token scaduto → refresh immediato, non conta come tentativo Fibonacci
            if (response.status === 401) {
                this.invalidateCachedAccessToken();
                const refreshedToken = await this.getCoopfiAccessToken(apiBaseUrl);
                response = await fetch(fullUrl, {
                    method: "GET",
                    headers: { ...headers, "Authorization": `Bearer ${refreshedToken}` }
                });
                // Se ancora 401 dopo il refresh → errore definitivo, non si può fare altro
                if (response.status === 401) {
                    await this.throwMappedCoopfiApiError(response, fullUrl);
                }
            }

            // Risposta ok → ritorna
            if (response.ok) return response;

            // 4xx non transitorie (400, 403, 404, 429) → errore definitivo, inutile riprovare
            if (!TRANSIENT_STATUSES.has(response.status)) {
                await this.throwMappedCoopfiApiError(response, fullUrl);
            }

            // 5xx transitoria: se abbiamo esaurito i tentativi → lancia l'errore mappato
            if (attempt === maxTransientAttempts) {
                await this.throwMappedCoopfiApiError(response, fullUrl);
            }

            // Altrimenti aspetta il delay Fibonacci e riprova
            log.warn(`[CoopfiAgenziaLib] Errore transitorio HTTP ${response.status} (tentativo ${attempt + 1}/${maxTransientAttempts + 1}), retry tra ${fib[attempt]}s`, { url: fullUrl });
            await new Promise(resolve => setTimeout(resolve, fib[attempt] * 1000));
        }

        // Guardia TypeScript — non raggiungibile
        throw new ServiceUnavailableError({ message: "Coopfi API non disponibile", service: "Coopfi API" });
    }
    //#endregion
    async exportMenaboExcel(layout: MenaboLayoutDivisioneSalvata): Promise<Buffer> {
        const chiaveCampo = this.CHIAVE_CAMPO_MENABO;

        const labelCampo = chiaveCampo.includes('.') ? chiaveCampo.split('.').pop()! : chiaveCampo;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Menabo');

        const BLUE = '1E40AF';
        const WHITE = 'FFFFFFFF';

        sheet.columns = [
            { header: 'Pagina', key: 'pagina', width: 10 },
            { header: 'Note', key: 'note', width: 28 },
            { header: labelCampo.toTitleCase(), key: 'campo', width: 58 },
            { header: 'Conteggio referenze', key: 'refGruppo', width: 18 },
            { header: 'Totale referenze in pagina', key: 'refPagina', width: 20 },
        ];

        // Stile intestazione
        const headerRow = sheet.getRow(1);
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BLUE}` } };
            cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
        });
        headerRow.height = 22;

        let colorToggle = false;

        for (const page of layout.pages) {
            const nota = page.label?.text ?? '';
            const totaleReferenzePagina = page.groups.reduce((s, g) => s + g.records.length, 0);

            const temiPerPagina = page.groups.flatMap(g => g.records.map(r => r[this.CHIAVE_CAMPO_MENABO] ?? '').filter(Boolean));
            const temiUnici = [...new Set(temiPerPagina.map(t => t.trim()))].join(', ');
            const row = sheet.addRow({
                pagina: page.pageNumber,
                note: nota,
                campo: temiUnici,
                refGruppo: totaleReferenzePagina, // Conteggio totale referenze in pagina a livello di pagina
                refPagina: totaleReferenzePagina,
            });
            colorToggle = !colorToggle;
            const bgArgb = colorToggle ? 'FFF8FAFC' : 'FFFFFFFF';
            row.height = 60;
            row.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
                cell.font = { size: 9 };
            });
        }

        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    buildIndesignPluginJson(layout: MenaboLayoutDivisioneSalvata): IndesignPluginExport {
        const primaryField = this.CHIAVE_CAMPO_MENABO;
        const fallbackSecondaryField = this.CHIAVI_SOTTOGRUPPI_MENABO_DEFAULT[0]?.nome_campo ?? "";

        const resolveSecondaryField = (sourceKey: string): { field: string; esplicito: boolean } => {
            const raw = String(sourceKey ?? "").trim();
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed[1] === "sub" && typeof parsed[2] === "string") {
                        return { field: parsed[2].trim(), esplicito: true };
                    }
                } catch {
                    // sourceKey non in formato JSON: si ricade sul campo di fallback
                }
            }
            return { field: fallbackSecondaryField, esplicito: false };
        };

        return {
            source: layout.pages.map(page => {
                const filtri: IndesignPluginFiltro[] = [];

                for (const group of page.groups) {
                    const { field: secondaryFieldRaw, esplicito: repartoEsplicito } = resolveSecondaryField(group.sourceKey);
                    // Il criterio secondario (es. reparto) va aggiunto SOLO quando il sottogruppo è
                    // stato trascinato esplicitamente. I gruppi/tema normali restano un unico filtro
                    // per tema, senza suddivisione per reparto: il tetto è il limite di pagina.
                    const secondaryField = repartoEsplicito && secondaryFieldRaw && secondaryFieldRaw !== primaryField
                        ? secondaryFieldRaw
                        : "";
                    const seen = new Set<string>();
                    for (const record of group.records) {
                        const primary = normalizeFieldValue(record[primaryField]);
                        if (!primary) continue;
                        // Forzatura Coopfi: i temi che contengono "jolly" vanno esportati come `tema in JOLLY`;
                        // il criterio reparto resta solo se il sottogruppo è stato trascinato esplicitamente.
                        const isJolly = primary.toLowerCase().includes("jolly");
                        const criterioTema = isJolly
                            ? { chiave: primaryField, operatore: "in" as const, valore: "JOLLY" }
                            : { chiave: primaryField, operatore: "=" as const, valore: primary };
                        const secondary = secondaryField
                            ? normalizeFieldValue(record[secondaryField])
                            : "";
                        const pairKey = `${criterioTema.valore}\0${secondary}`;
                        if (seen.has(pairKey)) continue;
                        seen.add(pairKey);

                        filtri.push({
                            // Il limite per-filtro serve solo ai sottogruppi trascinati esplicitamente
                            // (es. FORMAT+ suddiviso per tema). Per i gruppi/tema normali il tetto è
                            // dato dal limite di pagina (referenzePerPagina), quindi i singoli filtri
                            // per reparto NON devono ereditare il conteggio della pagina.
                            limite: repartoEsplicito ? group.recordCount : 0,
                            ordine: filtri.length + 1,
                            criteri: [
                                criterioTema,
                                ...(secondary ? [{ chiave: secondaryField, operatore: "=" as const, valore: secondary }] : []),
                            ],
                        });
                    }
                }

                return {
                    pagina: String(page.pageNumber),
                    filtri,
                    active: false,
                    blocco: filtri.length === 0,
                    limite: typeof page.referenzePerPagina === "number" ? page.referenzePerPagina : 0,
                };
            }),
        };
    }

    //#region Plugin builder privati per getReportOptions

    private _buildAverageScoreboardRows(matrice: MatricePromo): TracciatoWidgetScoreboardRow[] {
        const timelineRows = matrice.map(riga => TracciatoService.buildRows(riga.celle));
        const steps = timelineRows.length;
        if (steps === 0) return [];
        const reparti = [...new Set(timelineRows.flatMap(rows => rows.map(r => r.reparto)))];
        return reparti.map(reparto => {
            const rowsForReparto = timelineRows.map(rows => rows.find(r => r.reparto === reparto));
            const latestRow = [...rowsForReparto].reverse().find((r): r is TracciatoWidgetScoreboardRow => Boolean(r));
            const scoreMedio = Math.round(
                rowsForReparto.reduce((s, r) => s + clampPercent(r?.score ?? 0), 0) / steps,
            );
            return {
                ...(latestRow ?? { reparto, inalterati: 0, uscenti: 0, entranti: 0, modificati: 0, totale: 0 }),
                reparto,
                percentualeIntegra: scoreMedio,
                score: scoreMedio,
            };
        }).sort((a, b) => b.score - a.score);
    }

    private async _buildPluginScoreboard(matrice: MatricePromo, confrontiData: PromoScoreboardInput): Promise<TracciatoReportWidget> {
        const rows = this._buildAverageScoreboardRows(matrice);
        const totalScore = rows.length > 0
            ? Math.round(rows.reduce((s, r) => s + clampPercent(r.score), 0) / rows.length)
            : 0;
        return {
            id: 'plugin-scoreboard',
            type: 'scoreboard',
            title: 'Stabilità per reparto',
            description: `Score calcolato su ${confrontiData.length} confronti`,
            badge: `Score ${totalScore}/100`,
            gridSpan: 4,
            rows,
            totalScore,
        } satisfies TracciatoWidgetScoreboard;
    }

    private async _buildPluginLineChart(matrice: MatricePromo, confrontiData: PromoScoreboardInput): Promise<TracciatoReportWidget> {
        const labels = confrontiData.map(({ primarioNome, secondarioNome }, i) =>
            `${i + 1}. ${primarioNome} → ${secondarioNome}`,
        );
        const timelineRows = matrice.map(riga => TracciatoService.buildRows(riga.celle));
        const reparti = [...new Set(timelineRows.flatMap(rows => rows.map(r => r.reparto)))].sort();
        const rowsByStep = timelineRows.map(rows => new Map(rows.map(r => [r.reparto, clampPercent(r.percentualeIntegra)])));
        const datasets = reparti.map((reparto, i) => {
            let lastValue = 100;
            const data = rowsByStep.map(rowsMap => {
                const v = rowsMap.get(reparto);
                if (typeof v === 'number') lastValue = v;
                return clampPercent(lastValue);
            });
            const color = LINE_CHART_PALETTE[i % LINE_CHART_PALETTE.length];
            return { label: reparto, data, borderColor: color, backgroundColor: color };
        });
        return {
            id: 'plugin-line-chart',
            type: 'line_chart',
            title: 'Andamento score per reparto',
            description: 'Asse X: confronti · Asse Y: score (%)',
            badge: `${reparti.length} reparti · ${labels.length} confronti`,
            gridSpan: 4,
            labels,
            datasets,
        } satisfies TracciatoWidgetLineChart;
    }

    private async _buildPluginKpiGrid(_matrice: MatricePromo, confrontiData: PromoScoreboardInput): Promise<TracciatoReportWidget> {
        let uscenti = 0, entranti = 0, modificati = 0, inalterati = 0;
        for (const c of confrontiData) {
            for (const t of [...c.risultato.primario.tracciati, ...c.risultato.secondario.tracciati]) {
                uscenti += t.uscenti ?? 0;
                entranti += t.entranti ?? 0;
                modificati += t.alterati ?? 0;
                inalterati += t.inalterati ?? 0;
            }
        }
        const items: KpiCardItem[] = [
            { label: 'Uscenti', value: uscenti, color: 'red', icon: 'TrendingDown' },
            { label: 'Entranti', value: entranti, color: 'green', icon: 'TrendingUp' },
            { label: 'Modificati', value: modificati, color: 'amber', icon: 'Pencil' },
            { label: 'Inalterati', value: inalterati, color: 'slate', icon: 'Minus' },
        ];
        return {
            id: 'plugin-kpi',
            type: 'kpi_grid',
            title: 'Riepilogo variazioni',
            description: `${(uscenti + entranti + modificati).toLocaleString('it-IT')} movimenti totali`,
            badge: 'Globale',
            gridSpan: 4,
            items,
        };
    }

    //#endregion

    getReportOptions(): import('../types.js').ReportOption[] {
        return [
            {
                id: 'coopfi_scoreboard_completo',
                titolo: 'Scoreboard completo',
                descrizione: 'Score di stabilità per reparto con andamento temporale su tutti i confronti disponibili.',
                icona: 'ChartBar',
                query: { promoFilter: { type: 'all' }, momentoSelector: { type: 'all_confronti' }, aggregazione: 'merged' },
                plugins: [
                    { id: 'scoreboard', titolo: 'Stabilità per reparto', builder: this._buildPluginScoreboard.bind(this) },
                    { id: 'line_chart', titolo: 'Andamento score nel tempo', builder: this._buildPluginLineChart.bind(this) },
                ],
            },
            {
                id: 'coopfi_analisi_trend',
                titolo: 'Analisi trend annuale',
                descrizione: 'Score e variazioni sulle promo degli ultimi 12 mesi, ordinate cronologicamente.',
                icona: 'TrendingUp',
                query: {
                    promoFilter: {
                        type: 'date_range',
                        from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
                        to: new Date().toISOString(),
                    },
                    momentoSelector: { type: 'all_confronti' },
                    aggregazione: 'trend',
                },
                plugins: [
                    { id: 'kpi', titolo: 'Riepilogo variazioni', builder: this._buildPluginKpiGrid.bind(this) },
                    { id: 'scoreboard', titolo: 'Stabilità per reparto', builder: this._buildPluginScoreboard.bind(this) },
                ],
            },
        ];
    }

    getGlobalFiltersForUser(utente: { tipo: TIPO_UTENTI; meta?: UtentiMeta }): GlobalUserFilter {
        if (utente.tipo !== TIPO_UTENTI.CATEGORY) {
            return { isRestricted: false, settoriFinali: [], settori: [], settoriNomi: [], aree: [], ruolo: null };
        }
        const result = buildCoopfiPolicyFromCodeV2(utente.meta?.codice_posizione);
        if (!result.ok) {
            log.warn('CoopFI global filter policy build failed for CATEGORY user; applying fail-closed restrictions', {
                codice_posizione: utente.meta?.codice_posizione ?? null,
            });
            return { isRestricted: true, settoriFinali: [], settori: [], settoriNomi: [], aree: [], ruolo: null };
        }
        return {
            isRestricted: true,
            settoriFinali: result.finalSettori,
            settori: result.repartoCodes,
            settoriNomi: resolveRepartoNamesForSettoriFinali(result.finalSettori),
            aree: result.areaCode ? [result.areaCode] : [],
            ruolo: result.roleCode,
        };
    }
}
