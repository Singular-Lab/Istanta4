import { SCALA_CALORE_STANDARD, type MisuraCalore, type UnitaMisura } from './calore';
import type { PrevisioneVolantino, RendimentoVolantino } from './rendimento';
import type { BoxInsight, ConfrontoEdizione, EstensioneInsight, PdfVolantino } from './tipi';

/**
 * Report PDF di un volantino (spec insight-volantino, "Report PDF del volantino").
 *
 * - GET /api/flyer-insights/:idKit/report   "materiali.visualizza" -> ReportVolantino
 *
 * Il server raccoglie i dati e chiede le sezioni alla libreria agenzia del cliente
 * (insightVolantino.sezioniReport, che riceve anche le sezioni standard); il browser disegna il PDF
 * con @react-pdf: copertina, testata e piè di pagina sono sempre presenti, le sezioni seguono
 * l'ordine ricevuto. Una sezione senza dati non arriva: il server non la mette.
 */

export const percorsoReport = (idKit: string): string => `/flyer-insights/${encodeURIComponent(idKit)}/report`;

/** Nome del file: «Report volantino - <titolo> - <YYYY-MM-DD>.pdf». */
export function nomeFileReport(titolo: string, generatoIl: string): string {
  const pulito = titolo.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'volantino';
  return `Report volantino - ${pulito} - ${generatoIl.slice(0, 10)}.pdf`;
}

export interface PaletteReport {
  /** Testo principale e titoli. */
  inchiostro: string;
  /** Testo secondario, note, assi. */
  inchiostroTenue: string;
  /** Fondo della pagina. */
  carta: string;
  /** Fondo di riquadri e righe alterne. */
  superficie: string;
  /** Filetti e griglie. */
  linee: string;
  /** Colore dell'identità: testata, copertina, serie principale. */
  primario: string;
  /** Un solo accento per evidenziare (il dato chiave, il box migliore). */
  accento: string;
  positivo: string;
  negativo: string;
  /** Colori per categorie (reparti, meccaniche, marche), distinguibili anche da chi non vede i colori. */
  categorie: string[];
  /** Scala della mappa di calore, dal freddo al caldo. */
  calore: string[];
}

export const PALETTE_REPORT_STANDARD: PaletteReport = {
  inchiostro: '#1b2433',
  inchiostroTenue: '#5a6577',
  carta: '#ffffff',
  superficie: '#f2f4f7',
  linee: '#d6dbe3',
  primario: '#1f3b5c',
  accento: '#c4561c',
  positivo: '#1d7a4c',
  negativo: '#b42d22',
  categorie: ['#1f3b5c', '#3f7cac', '#7fb3d5', '#c4561c', '#e3a33b', '#5b8c5a', '#8e6c8a', '#9aa5b1'],
  calore: [...SCALA_CALORE_STANDARD],
};

export interface IntestazioneReport {
  /** Nome del cliente in testata e in copertina (di default il nome della GDO). */
  cliente: string;
  sottotitolo: string | null;
  /** Logo come data URI PNG o JPEG; null: solo il nome. */
  logo: string | null;
  /** Dicitura del piè di pagina, es. "Riservato - uso interno". */
  riservatezza: string;
}

export interface IndicatoreReport {
  etichetta: string;
  /** Gia' formattato, es. "18,4%". */
  valore: string;
  dettaglio: string | null;
  /** Variazione sull'edizione precedente; positiva: true verde, false rosso, null neutra. */
  variazione: { testo: string; verso: 'su' | 'giu' | 'pari'; positiva: boolean | null } | null;
}

export interface VoceGrafico {
  etichetta: string;
  valore: number;
  /** Valore gia' formattato per l'etichetta della barra. */
  testo: string;
  /** null: colore della serie dalla palette. */
  colore: string | null;
}

export type GraficoReport =
  /** Barre orizzontali ordinate come arrivano. */
  | { forma: 'barre'; voci: VoceGrafico[]; unita: UnitaMisura }
  /** Ciambella con il totale (o un dato chiave) al centro. */
  | { forma: 'ciambella'; voci: VoceGrafico[]; centro: { valore: string; etichetta: string } | null }
  /** Due barre per voce, es. quota referenze contro quota spazio. */
  | {
      forma: 'confronto';
      serie: [string, string];
      voci: Array<{ etichetta: string; valori: [number, number]; testi: [string, string] }>;
      unita: UnitaMisura;
    };

export interface GraficoSezione {
  titolo: string;
  nota: string | null;
  grafico: GraficoReport;
}

/**
 * Ogni sezione puo' avere una chiave stabile (es. 'sintesi', 'mappa', 'rendimento'): la libreria
 * agenzia la usa per riconoscere e riordinare le sezioni standard senza dipendere dai titoli.
 */
export type SezioneReport = { chiave?: string } & (
  | { tipo: 'sintesi'; titolo: string; indicatori: IndicatoreReport[]; frasi: string[] }
  /** Uno o due grafici per pagina. */
  | { tipo: 'grafici'; titolo: string; introduzione: string | null; grafici: GraficoSezione[] }
  /** Una pagina del PDF per ogni pagina del volantino, con la mappa della misura e i box in evidenza. */
  | { tipo: 'pagine'; titolo: string; misura: MisuraCalore; introduzione: string | null; boxInEvidenza: number }
  | {
      tipo: 'tabella';
      titolo: string;
      introduzione: string | null;
      colonne: Array<{ titolo: string; allinea: 'sinistra' | 'destra' }>;
      righe: string[][];
      nota: string | null;
    }
  | { tipo: 'metodo'; titolo: string; paragrafi: string[] }
);

export interface ReportVolantino {
  /** ISO 8601. */
  generatoIl: string;
  idKit: string;
  titolo: string;
  /** Es. "Toscana · Conad City · dal 3 al 16 novembre 2026". */
  sottotitolo: string;
  intestazione: IntestazioneReport;
  palette: PaletteReport;
  pdf: PdfVolantino | null;
  box: BoxInsight[];
  totalePagine: number;
  rendimento: RendimentoVolantino | null;
  previsione: PrevisioneVolantino | null;
  sezioni: SezioneReport[];
}

/** Quello che il server passa alla libreria agenzia per comporre le sezioni del report. */
export interface DatiReportVolantino {
  contesto: {
    idKit: string;
    titolo: string;
    nomeGdo: string;
    area: string | null;
    canale: string | null;
    /** YYYY-MM-DD. */
    validitaDal: string | null;
    validitaAl: string | null;
  };
  insight: EstensioneInsight & { totalePagine: number; totaleReferenze: number };
  confronto: ConfrontoEdizione | null;
  rendimento: RendimentoVolantino | null;
  previsione: PrevisioneVolantino | null;
  palette: PaletteReport;
}
