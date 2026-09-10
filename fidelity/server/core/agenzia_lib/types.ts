import type { TIPO_UTENTI } from "../../../lib/enums.js";
import type { AnalisiMomentoTracciato, DataFields, GlobalUserFilter, IndesignPluginExport, MenaboDivisioneParams, MenaboLayoutDivisioneSalvata, MenaboRisultato, RisultatoConfrontoMomento, TracciatoQueryRequest, TracciatoReport, TracciatoReportWidget, UtentiMeta } from "../../../lib/types.js";
import type { OidcUserClaims } from "../interfaces/IOidcService.js";

// ── Tipi di base ──────────────────────────────────────────────────────────────

export type FieldChange = {
  campo: string;
  valoreA: unknown;
  valoreB: unknown;
};

// ── MatricePromo — struttura dati principale passata ad AgenziaLib ────────────

/**
 * Storia accumulata di un singolo campo attraverso i confronti.
 * Ogni variazione registra i valori prima/dopo per un confronto specifico.
 */
export type VariazioneCampo = {
  confrontoIndex: number;
  valoreA: unknown;
  valoreB: unknown;
};

export type StoriaDelCampo = {
  variazioni: VariazioneCampo[];
  valoreIniziale: unknown;  // valoreA del primo confronto in cui il campo è cambiato
  valoreFinale: unknown;    // valoreB dell'ultima variazione registrata
};

/**
 * Singola cella della matrice: stato di un outerKey in un confronto, per una combinazione canale/area.
 *
 * La matrice è RETTANGOLARE: ogni (outerKey, canaleArea) che appare in almeno un confronto
 * ha una cella in TUTTE le righe — anche dove non esiste (stato = 'non_esistente').
 */
export type CellaConfronto = {
  // ── Identificatori ──
  outerKey: string;    // codiceKey dal modello (chiave di raggruppamento scoreboard)
  canaleArea: string;  // "guidCanale::guidArea"
  repartoNome: string;

  // ── Labels del confronto ──
  confrontoIndex: number;
  labelPrimario: string;
  labelSecondario: string;

  // ── Stato del codice in questo confronto ──
  // 'non_esistente': il codice non era presente né in primario né in secondario
  stato: 'entrata' | 'uscita' | 'modifica' | 'inalterata' | 'non_esistente';

  /** Campi che hanno avuto almeno una variazione fino a e incluso questo confronto (cumulativo). Vuoto per non_esistente. */
  campiModificatiCumulativi: string[];

  /** Variazioni di campo specifiche di QUESTO confronto (valoreA → valoreB). Vuoto per non_esistente. */
  campiDettaglio: Record<string, { valoreA: unknown; valoreB: unknown }>;

  /** Storia accumulata per ogni campo fino a questo confronto. Consente ad AgenziaLib di rilevare "ritorni al valore", trend, ecc. */
  campiStoria: Record<string, StoriaDelCampo>;

  // ── PI pre-computato ──
  // Per 'non_esistente': contributo=0, piDopoEvento=piPrimaDellEvento (PI invariato)
  piPrimaDellEvento: number;
  contributo: number;    // percentuale PI sottratta per questo evento
  piDopoEvento: number;  // PI residuo dopo questo evento
  hasTerremoto: boolean; // true se il terremoto è attivo e continuerà nel confronto successivo

  // ── Contesto gruppo ──
  totaleReferenzeNelGruppo: number;
  scattoCodice: string;
  codiceReferenza: string;
};

/** Una riga della matrice: tutti i codici (uno per outerKey+canaleArea) in un confronto. */
export type RigaConfronto = {
  confrontoIndex: number;
  labelPrimario: string;
  labelSecondario: string;
  /** Esattamente allCodici.size celle — matrice rettangolare garantita. */
  celle: CellaConfronto[];
  /** Degrado massimo retroattivo (%) applicabile dai terremoti di questo confronto. Dal DB (tracciati_momento_confronti.terremoto_degrado_massimo). */
  terremotoDegradoMassimo?: number;
};

/** Matrice orientata per confronto (riga = confronto, colonna = codice). */
export type MatricePromo = RigaConfronto[];

// ── Input scoreboard ──────────────────────────────────────────────────────────

export type PromoScoreboardInput = Array<{
  primarioNome: string;
  secondarioNome: string;
  risultato: RisultatoConfrontoMomento;
  /** Degrado massimo retroattivo (%) per i terremoti di questo confronto. Popolato dal momento secondario nel DB. */
  terremotoDegradoMassimo?: number;
}>;

// ── Tipi di configurazione scoreboard (mantenuti per backward compat) ─────────

export interface CampiModificaRule {
  [fieldKey: string]: number;
}

export type CombinazionRule = {
  if: string[];
  operator: 'all' | 'any';
  valore: number;
  priority: number;
};

export interface ModificaRule {
  peso: number;
  campi: CampiModificaRule;
  combinazioni?: CombinazionRule[];
}

export type TerremotoRule = {
  uscita: number;
  entrata: number;
  modifica: number;
};

export interface AzioniRule {
  uscita?: number;
  entrata?: number;
  modifica?: Partial<ModificaRule>;
  terremoto?: TerremotoRule;
}

export interface AgenziaLibScoreRules {
  version: string;
  defaultRules: {
    uscita: number;
    entrata: number;
    modifica: Required<ModificaRule>;
  };
  groupRules: Record<string, AzioniRule>;
  terremoto?: TerremotoRule;
}

/** @deprecated Usare computeContributo/getChangedFields su IAgenziaLib */
export type ScoreboardConfig = {
  scoreRules: AgenziaLibScoreRules;
  getChangedFields: (a: DataFields, b: DataFields) => FieldChange[];
};

// ── Risultato parsing OIDC ────────────────────────────────────────────────────

export interface ParsedOIDCUtente {
  id: string;
  private_key?: string;
  id_gdo?: string;
  email: string;
  tipo_utente: TIPO_UTENTI;
  codice_posizione?: string;
}

// ── Opzioni report per cliente ────────────────────────────────────────────────

export interface ReportOptionPlugin {
  id: string;
  titolo: string;
  builder: (matrice: MatricePromo, confrontiData: PromoScoreboardInput) => Promise<TracciatoReportWidget>;
}

export interface ReportOption {
  id: string;
  titolo: string;
  descrizione: string;
  icona?: string;
  query: TracciatoQueryRequest;
  plugins: ReportOptionPlugin[];
}

// ── Interfaccia AgenziaLib ────────────────────────────────────────────────────

export interface IAgenziaLib {
  parseUtenteOIDC(
    email: string,
    claims: OidcUserClaims
  ): Promise<ParsedOIDCUtente>;

  CHIAVE_CAMPO_MENABO: string;
  CHIAVE_DEDUP_MENABO: string;
  elaboraDatoPerAgenzia(data: RisultatoConfrontoMomento): Promise<TracciatoReport>;

  normalizzaDatoConfrontoPerScore(confrontiData: PromoScoreboardInput): Promise<PromoScoreboardInput>;

  /**
   * Regole di scoring in codice (no JSON).
   * Restituisce il contributo grezzo [0-100] per l'evento.
   *
   * Meccanismo terremoto (cascata):
   * - Se hasTerremoto=true, il matrix builder memorizza l'evento corrente come `prevEvent`
   *   per il confronto successivo di questo innerCode.
   * - Nei confronti successivi, computeContributo riceve `prevEvent` e può applicare
   *   degradazione aggiuntiva, restituendo hasTerremoto=true per prolungare la cascata.
   * - La cascata termina quando computeContributo restituisce hasTerremoto=false.
   */
  computeContributo(
    tipo: 'uscita' | 'entrata' | 'modifica',
    repartoNome: string,
    campiModificatiCumulativi: string[],
    opts?: {
      /** Evento del confronto precedente — fornito solo se hasTerremoto era true nell'iterazione precedente. */
      prevEvent?: 'uscita' | 'entrata' | 'modifica';
      /** Storia accumulata dei campi fino al confronto corrente — per rilevare pattern complessi. */
      campiStoria?: Record<string, StoriaDelCampo>;
    }
  ): { contributoRaw: number; hasTerremoto: boolean };

  /**
   * Determina quali campi sono cambiati tra due record.
   * Sostituisce la funzione getChangedFields che era in ScoreboardConfig.
   */
  getChangedFields(a: DataFields, b: DataFields): FieldChange[];

  /**
   * Costruisce il report scoreboard a partire dalla MatricePromo pre-computata.
   * La matrice contiene già tutti i dati PI (piPrimaDellEvento, contributo, piDopoEvento)
   * e la storia accumulata dei campi — AgenziaLib si occupa solo di aggregare e costruire i widget.
   */
  buildScoreboardReport(
    matrice: MatricePromo,
    confrontiData: PromoScoreboardInput
  ): Promise<TracciatoReport>;

  /**
   * Calcola l'intensità del terremoto per una cella [0-100].
   * Riceve la cella completa (stato, campiStoria, campiDettaglio) e l'intera storia
   * ordinata della referenza (tutte le celle di quella referenza, ordinate per confrontoIndex)
   * per permettere pattern-matching sulla sequenza di stati.
   */
  calcolaIntensitaTerremoto(cella: CellaConfronto, storia: CellaConfronto[]): number;

  calcolaTerremotoPerMatriceDiValori(
    matrice: MatricePromo,
  ): Promise<MatricePromo>;



  getDatoPerMenabo(risultati: AnalisiMomentoTracciato[], params: MenaboDivisioneParams): Promise<MenaboRisultato>;
  exportMenaboExcel(layout: MenaboLayoutDivisioneSalvata): Promise<Buffer>;
  buildIndesignPluginJson(layout: MenaboLayoutDivisioneSalvata): IndesignPluginExport;

  getReportOptions(): ReportOption[];

  getGlobalFiltersForUser(utente: { tipo: TIPO_UTENTI; meta?: UtentiMeta }): GlobalUserFilter;
}
