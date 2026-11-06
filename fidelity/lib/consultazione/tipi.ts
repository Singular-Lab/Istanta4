import type { Riferimento } from '../materiali/tipi';
import type { PeriodoConsultazione } from './periodi';

/**
 * Contratto delle API di consultazione (/api/consultazione), usate dalle pagine di Visualizzazione.
 *
 * Solo materiali pubblicati della GDO della sessione (Superadmin e Agenzia senza GDO: tutte), di
 * promo non eliminate. Nessun dato di lavorazione: niente stato dei kit, log e versioni dei file,
 * direttive, stato della promo. Nessuna chiamata a Istanta: tutto viene dal database di Fidelity.
 * I file si scaricano da /api/consultazione/file/:id con "materiali.scarica".
 */

export type { Riferimento };

/** Promozione di un materiale pubblicato. Le date sono giorni del calendario italiano (YYYY-MM-DD). */
export interface PromoConsultazione {
  id: string;
  nome: string;
  validitaDal: string | null;
  validitaAl: string | null;
}

/** File pubblicato di un kit. */
export interface FileConsultazione {
  /** Id del file (files_runtime): si scarica da percorsoFileConsultazione(id). */
  id: string;
  nome: string;
  /** Codice del tipo di export (VOL, WEB...), se noto. */
  tipoExport: string | null;
  mime: string | null;
  pagine: number | null;
  /** Miniatura servita dal proxy di Olimpo, se il file sta su Olimpo. */
  anteprima: string | null;
}

/* ---------- Volantini ---------- */

/** Kit volantino pubblicato, con la copertina (il PDF del volantino, se c'e'). */
export interface VolantinoConsultazione {
  id: string;
  titolo: string;
  promo: PromoConsultazione;
  area: Riferimento;
  canale: Riferimento;
  /** File del kit, senza quelli dell'export Correggo. */
  numeroFile: number;
  copertina: FileConsultazione | null;
}

export interface FiltriVolantiniConsultazione {
  periodo: PeriodoConsultazione;
  /** Nel titolo del kit o nel nome della promozione. */
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
  pagina?: number;
  dimensione?: number;
}

/** Kit dalla promo con la validita' piu' recente, poi per nome della promo e titolo. */
export interface PaginaVolantiniConsultazione {
  kit: VolantinoConsultazione[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export const DIMENSIONE_PAGINA_VOLANTINI_CONSULTAZIONE = 24;
export const DIMENSIONE_MASSIMA_VOLANTINI_CONSULTAZIONE = 200;

/** Variante del volantino di una promozione: un kit pubblicato per canale e area. */
export interface VarianteConsultazione {
  id: string;
  titolo: string;
  area: Riferimento;
  canale: Riferimento;
  numeroFile: number;
  /** Righe della lista dei punti vendita stampata nel volantino. */
  numeroPuntiVendita: number;
  copertina: FileConsultazione | null;
}

export interface PromozioneVolantiniConsultazione {
  promo: PromoConsultazione;
  /** Copertina di un kit mostrato, altrimenti di un altro kit della promo. */
  copertina: FileConsultazione | null;
  /** Kit pubblicati della promo, anche quelli esclusi dai filtri. */
  numeroKit: number;
  /** Solo i kit che corrispondono ai filtri. */
  kit: VarianteConsultazione[];
}

export interface FiltriPromozioniVolantiniConsultazione {
  periodo: PeriodoConsultazione;
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
  /** Anno dell'inizio di validita' della promo. */
  anno?: number;
  pagina?: number;
  /** 12, 24 o 48 promozioni. */
  dimensione?: number;
}

export interface PaginaPromozioniVolantiniConsultazione {
  promozioni: PromozioneVolantiniConsultazione[];
  totale: number;
  totaleKit: number;
  totaleSenzaFiltri: number;
  pagina: number;
  dimensione: number;
  opzioni: {
    promozioni: Riferimento[];
    aree: Riferimento[];
    canali: Riferimento[];
    anni: number[];
  };
}

/** Dettaglio di un kit pubblicato, con i suoi file (senza quelli dell'export Correggo). */
export interface DettaglioVolantinoConsultazione {
  id: string;
  titolo: string;
  promo: PromoConsultazione;
  area: Riferimento;
  canale: Riferimento;
  file: FileConsultazione[];
}

/* ---------- POP ---------- */

export interface PromoPopConsultazione extends PromoConsultazione {
  numeroFile: number;
  numeroFormati: number;
}

export interface ElencoPromozioniPopConsultazione {
  promozioni: PromoPopConsultazione[];
}

export interface KitPopConsultazione {
  id: string;
  titolo: string;
  area: Riferimento;
  canale: Riferimento;
  numeroFile: number;
}

export interface FormatoPopConsultazione {
  id: string;
  nome: string;
  numeroFile: number;
  kit: KitPopConsultazione[];
}

export interface RiepilogoPopConsultazione {
  promo: PromoConsultazione;
  totali: { file: number; formati: number };
  formati: FormatoPopConsultazione[];
}

export interface FilePopConsultazione extends FileConsultazione {
  kit: { id: string; titolo: string };
  area: Riferimento;
  canale: Riferimento;
  referenza: { codice: string | null; descrizione: string | null } | null;
  reparto: string | null;
}

/** Filtri dei file di un formato: senza stato, che e' un dato della lavorazione. */
export interface FiltriFilePopConsultazione {
  periodo: PeriodoConsultazione;
  idFormato: string;
  /** Nel nome del file, nel codice o nella descrizione della referenza. */
  cerca?: string;
  idArea?: string;
  idCanale?: string;
  reparto?: string;
  pagina?: number;
  /** 100, 250 o 500 righe. */
  dimensione?: number;
}

export interface PaginaFilePopConsultazione {
  file: FilePopConsultazione[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export interface OpzioniFilePopConsultazione {
  aree: Riferimento[];
  canali: Riferimento[];
  reparti: string[];
}

export type FiltriZipPopConsultazione = Pick<FiltriFilePopConsultazione, 'cerca' | 'idArea' | 'idCanale' | 'reparto'>;

/** I file scelti (idFile) oppure tutti i file del formato che corrispondono ai filtri. */
export interface RichiestaZipPopConsultazione {
  periodo: PeriodoConsultazione;
  idFormato: string;
  idFile?: string[];
  filtri?: FiltriZipPopConsultazione;
}

export interface VerificaZipPopConsultazione {
  file: number;
  nomeFile: string;
}

/* ---------- Contenuti digitali ---------- */

/** File di un kit manuale pubblicato. */
export interface ContenutoDigitale extends FileConsultazione {
  kit: { id: string; titolo: string };
  promo: PromoConsultazione;
  area: Riferimento;
  canale: Riferimento;
  formato: Riferimento;
}

export interface FiltriContenutiDigitali {
  /** Nel nome del file, nel titolo del kit o nei campi dei file configurati per la ricerca. */
  cerca?: string;
  idPromo?: string;
  /** Id del tipo di export. */
  idTipoExport?: string;
  idFormato?: string;
  idArea?: string;
  idCanale?: string;
  pagina?: number;
  dimensione?: number;
}

/** File dalla promo con la validita' piu' recente, poi per kit e nome. */
export interface PaginaContenutiDigitali {
  file: ContenutoDigitale[];
  totale: number;
  pagina: number;
  dimensione: number;
}

export const DIMENSIONE_PAGINA_CONTENUTI_DIGITALI = 10;
export const DIMENSIONE_MASSIMA_CONTENUTI_DIGITALI = 100;

/** Valori dei filtri: solo quelli dei contenuti consultabili, per nome (le promo dalla piu' recente). */
export interface OpzioniContenutiDigitali {
  promozioni: Riferimento[];
  tipiExport: Riferimento[];
  formati: Riferimento[];
  aree: Riferimento[];
  canali: Riferimento[];
}
