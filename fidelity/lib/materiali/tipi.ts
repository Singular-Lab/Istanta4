import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, STATO_PROMO, TIPO_KIT_DESIGN } from '../enums';
import { PeriodoMateriali } from './periodi';

/**
 * Contratto fra il server (/api/materiali) e le viste Volantini e POP.
 *
 * Endpoint, tutti con il permesso "materiali.visualizza":
 * - GET  /api/materiali/volantini                        FiltriKitVolantini     -> PaginaKitVolantini
 * - GET  /api/materiali/pop/promozioni?periodo=          -> ElencoPromozioniPop
 * - GET  /api/materiali/pop/promozioni/:idPromo/formati?periodo=  -> RiepilogoPop
 * - GET  /api/materiali/pop/promozioni/:idPromo/file     FiltriFilePop          -> PaginaFilePop
 * - GET  /api/materiali/pop/promozioni/:idPromo/zip      periodo, idFormato e i filtri di FiltriFilePop in query
 *                                                         -> application/zip di tutti i file del formato che corrispondono
 *                                                            ai filtri, in streaming: il browser lo scarica senza tenerlo in memoria
 * - POST /api/materiali/pop/promozioni/:idPromo/zip      RichiestaZipPop con idFile -> application/zip dei file selezionati
 * I due download richiedono anche "file.download".
 */

/** Stato di un kit nelle viste: quello del runtime, o NON_AVVIATO per un kit previsto ma senza runtime. */
export type StatoKitMateriali = Exclude<STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO> | 'NON_AVVIATO';

export const STATI_KIT_MATERIALI: readonly StatoKitMateriali[] = [
  'NON_AVVIATO',
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI,
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
  STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
];

export interface Riferimento {
  id: string;
  nome: string;
}

export interface PromoMateriali {
  id: string;
  nome: string;
  stato: STATO_PROMO;
  /** Date ISO (YYYY-MM-DD). */
  validitaDal: string | null;
  validitaAl: string | null;
}

/**
 * Avviso di dati parziali: i kit non avviati di una promo in corso non si sono potuti recuperare
 * (Istanta non risponde). I kit avviati della promo sono comunque nell'elenco.
 */
export interface AvvisoNonAvviati {
  promo: Riferimento;
  motivo: string;
}

/* ---------- Volantini ---------- */

export interface FiltriKitVolantini {
  periodo: PeriodoMateriali;
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
  /** Solo nel periodo In corso. */
  stato?: StatoKitMateriali;
  /** Da 1. */
  pagina?: number;
  dimensione?: number;
}

export interface CopertinaKit {
  idOlimpoCloud: string;
  nome: string;
  mime: string | null;
  pagine: number | null;
}

export interface SchedaKitVolantino {
  /** Id del runtime; null per un kit non avviato. */
  id: string | null;
  /** Id del kit design da cui nasce, quando noto. */
  idDesign: string | null;
  titolo: string;
  stato: StatoKitMateriali;
  tipo: TIPO_KIT_DESIGN | null;
  promo: PromoMateriali;
  area: Riferimento;
  canale: Riferimento;
  formato: Riferimento | null;
  /** File del kit, esclusi quelli dell'export CORREGGO. */
  numeroFile: number;
  /** Primo PDF dell'export volantino, se c'è. */
  copertina: CopertinaKit | null;
}

export interface OpzioniFiltroKit {
  promozioni: Riferimento[];
  aree: Riferimento[];
  canali: Riferimento[];
}

export interface PaginaKitVolantini {
  kit: SchedaKitVolantino[];
  /** Kit che corrispondono ai filtri (tutte le pagine). */
  totale: number;
  /** Kit del periodo senza filtri: distingue "nessun kit" da "nessun risultato con i filtri". */
  totaleSenzaFiltri: number;
  pagina: number;
  dimensione: number;
  /** Valori per le tendine, calcolati sul periodo senza filtri. */
  opzioni: OpzioniFiltroKit;
  avvisi: AvvisoNonAvviati[];
}

/* ---------- POP ---------- */

export interface PromoPop extends PromoMateriali {
  numeroFile: number;
  numeroFormati: number;
}

export interface ElencoPromozioniPop {
  promozioni: PromoPop[];
}

export interface KitPop {
  /** Id del runtime; null per un kit non avviato. */
  id: string | null;
  idDesign: string | null;
  titolo: string;
  stato: StatoKitMateriali;
  area: Riferimento;
  canale: Riferimento;
  numeroFile: number;
}

export interface FormatoPop {
  /** Id del formato. */
  id: string;
  nome: string;
  numeroFile: number;
  /** File del formato per stato del kit che li contiene (gli stati senza file valgono 0). */
  filePerStatoKit: Record<StatoKitMateriali, number>;
  kit: KitPop[];
}

export interface TotaliPop {
  file: number;
  formati: number;
  /** File nei kit pubblicati, in revisione, in lavorazione con errori. */
  pubblicati: number;
  inRevisione: number;
  conErrori: number;
}

export interface RiepilogoPop {
  promo: PromoMateriali;
  totali: TotaliPop;
  formati: FormatoPop[];
  avvisi: AvvisoNonAvviati[];
}

export interface FiltriFilePop {
  periodo: PeriodoMateriali;
  idFormato: string;
  /** Nome del file, codice o descrizione della referenza. */
  cerca?: string;
  stato?: STATO_LOG_FILE;
  idArea?: string;
  idCanale?: string;
  reparto?: string;
  /** Da 1. */
  pagina?: number;
  /** 100, 250 o 500. */
  dimensione?: number;
}

export const DIMENSIONI_PAGINA_POP: readonly number[] = [100, 250, 500];

export interface FilePop {
  id: string;
  nome: string;
  idOlimpoCloud: string | null;
  mime: string | null;
  kit: { id: string; titolo: string; stato: StatoKitMateriali };
  area: Riferimento;
  canale: Riferimento;
  /** Dai metadati del file (meta_olimpo_cloud). */
  referenza: { codice: string | null; descrizione: string | null } | null;
  reparto: string | null;
  /** Ultimo log del file; null se il file non ne ha. */
  stato: STATO_LOG_FILE | null;
  versione: number | null;
}

export interface PaginaFilePop {
  file: FilePop[];
  totale: number;
  pagina: number;
  dimensione: number;
  opzioni: {
    aree: Riferimento[];
    canali: Riferimento[];
    reparti: string[];
  };
}

/**
 * Download POP. Con idFile: solo quei file, e solo se appartengono alla promo e al formato
 * indicati. Senza idFile: tutti i file del formato che corrispondono ai filtri (nessun filtro =
 * tutto il formato).
 */
export interface RichiestaZipPop {
  periodo: PeriodoMateriali;
  idFormato: string;
  idFile?: string[];
  filtri?: Omit<FiltriFilePop, 'periodo' | 'idFormato' | 'pagina' | 'dimensione'>;
}
