import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, STATO_PROMO, TIPO_KIT_DESIGN } from '../enums';
import { PeriodoMateriali } from './periodi';

/**
 * Contratto fra il server (/api/materiali) e le viste Volantini e POP.
 *
 * Endpoint, tutti con il permesso "materiali.visualizza":
 * - GET  /api/materiali/volantini                        FiltriKitVolantini     -> PaginaKitVolantini
 *                                                         (un kit per scheda: la vista In corso)
 * - GET  /api/materiali/volantini/promozioni             FiltriPromozioniVolantini -> PaginaPromozioniVolantini
 *                                                         (Attivi e Storico: una scheda per promozione con i suoi kit
 *                                                         come varianti; periodo in-corso -> 400)
 * - GET  /api/materiali/pop/promozioni?periodo=          -> ElencoPromozioniPop
 * - GET  /api/materiali/pop/promozioni/:idPromo/formati?periodo=  -> RiepilogoPop
 * - GET  /api/materiali/pop/promozioni/:idPromo/file     FiltriFilePop          -> PaginaFilePop
 * - GET  /api/materiali/pop/promozioni/:idPromo/file/opzioni?periodo=&idFormato=  -> OpzioniFilePop
 *                                                         (valori delle tendine dei file, a parte: non cambiano con la pagina)
 * - POST /api/materiali/pop/promozioni/:idPromo/zip/verifica  RichiestaZipPop -> VerificaZipPop
 *                                                         (prima del download: errori in JSON, senza costruire l'archivio)
 * - GET  /api/materiali/pop/promozioni/:idPromo/zip      periodo, idFormato e i filtri di FiltriFilePop in query
 *                                                         -> application/zip di tutti i file del formato che corrispondono
 *                                                            ai filtri, in streaming: il browser lo scarica senza tenerlo in memoria
 * - POST /api/materiali/pop/promozioni/:idPromo/zip      RichiestaZipPop con idFile -> application/zip dei file selezionati,
 *                                                         in streaming. Il corpo è JSON, oppure un form con il token CSRF
 *                                                         in `_csrf` e la RichiestaZipPop come testo JSON in `richiesta`
 * La verifica e i due download richiedono anche "file.download".
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

/* ---------- Volantini per promozione (Attivi e Storico) ---------- */

/**
 * Filtri delle promozioni con volantini pubblicati. Una promo compare se almeno un suo kit
 * pubblicato corrisponde ai filtri, e nella sua scheda restano solo quei kit.
 */
export interface FiltriPromozioniVolantini {
  /** Attivi o Storico: In corso i volantini restano per kit (GET /api/materiali/volantini). */
  periodo: PeriodoMateriali;
  /** Nome della promo (tutti i suoi kit) o titolo del kit. */
  cerca?: string;
  idPromo?: string;
  idArea?: string;
  idCanale?: string;
  /** Anno dell'inizio di validità della promo, nel calendario italiano. */
  anno?: number;
  /** Da 1. */
  pagina?: number;
  /** 12, 24 o 48 promozioni; ogni altro valore vale 12. */
  dimensione?: number;
}

export const DIMENSIONI_PAGINA_PROMOZIONI_VOLANTINI: readonly number[] = [12, 24, 48];

/** Un kit pubblicato della promo: una variante del volantino per canale e area. */
export interface VarianteVolantino {
  /** Id del runtime. */
  id: string;
  titolo: string;
  area: Riferimento;
  canale: Riferimento;
  /** File del kit, esclusi quelli dell'export CORREGGO. */
  numeroFile: number;
  /** Primo PDF dell'export volantino, se c'è. */
  copertina: CopertinaKit | null;
  /** Punti vendita stampati nella lista del volantino; 0 se la lista non è arrivata. */
  numeroPuntiVendita: number;
}

export interface PromozioneVolantini {
  promo: PromoMateriali;
  /** Copertina di uno dei kit mostrati (il primo che ne ha una), altrimenti di un altro kit della promo. */
  copertina: CopertinaKit | null;
  /** Kit pubblicati della promo nel periodo, senza filtri. */
  numeroKit: number;
  /** I kit che corrispondono ai filtri, per canale, area e titolo. */
  kit: VarianteVolantino[];
}

export interface OpzioniFiltroPromozioniVolantini {
  /**
   * Promozioni del periodo con volantini pubblicati, dalla più recente: solo in Attivi. Nello
   * Storico sono centinaia e si trovano cercando per nome e anno: l'elenco è vuoto.
   */
  promozioni: Riferimento[];
  /** In Storico anche le aree e i canali delle combinazioni della GDO, comprese quelle disattivate. */
  aree: Riferimento[];
  canali: Riferimento[];
  /** Anni di inizio validità delle promozioni del periodo, dal più recente. */
  anni: number[];
}

export interface PaginaPromozioniVolantini {
  promozioni: PromozioneVolantini[];
  /** Promozioni che corrispondono ai filtri (tutte le pagine). */
  totale: number;
  /** Kit che corrispondono ai filtri (tutte le pagine). */
  totaleKit: number;
  /** Promozioni del periodo senza filtri: distingue "nessun volantino" da "nessun risultato con i filtri". */
  totaleSenzaFiltri: number;
  pagina: number;
  dimensione: number;
  /** Valori dei filtri, calcolati sul periodo senza filtri. */
  opzioni: OpzioniFiltroPromozioniVolantini;
}

/* ---------- POP ---------- */

/**
 * Promo con almeno un kit POP nel periodo: In corso anche solo non avviato. File e formati si
 * contano come nel RiepilogoPop della promo, così elenco e dettaglio dicono gli stessi numeri.
 */
export interface PromoPop extends PromoMateriali {
  numeroFile: number;
  numeroFormati: number;
}

export interface ElencoPromozioniPop {
  promozioni: PromoPop[];
  /** In corso: promo di cui Istanta non ha dato i kit non avviati (possono mancare dall'elenco). */
  avvisi: AvvisoNonAvviati[];
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

/**
 * Stati dell'ultimo log che un file POP può avere. Quelli di Correggo riguardano solo i file
 * dell'export CORREGGO, che le viste non mostrano.
 */
export const STATI_FILE_POP: readonly STATO_LOG_FILE[] = [
  STATO_LOG_FILE.IN_ATTESA,
  STATO_LOG_FILE.IN_REVISIONE,
  STATO_LOG_FILE.ACCETTATO,
  STATO_LOG_FILE.ERRORE,
  STATO_LOG_FILE.PUBBLICATO,
];

export interface FilePop {
  id: string;
  nome: string;
  idOlimpoCloud: string | null;
  mime: string | null;
  /** Pagine del PDF, per l'anteprima; null se non note. */
  pagine: number | null;
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
}

/** Valori delle tendine dei file di un formato, calcolati su tutti i suoi file senza filtri. */
export interface OpzioniFilePop {
  aree: Riferimento[];
  canali: Riferimento[];
  reparti: string[];
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

/**
 * Esito della verifica di un download POP: c'è almeno un file. Se non c'è niente da scaricare,
 * la promo è fuori dal periodo o manca un permesso, la verifica risponde con l'errore in JSON.
 */
export interface VerificaZipPop {
  /** File che andranno nell'archivio. */
  file: number;
  nomeFile: string;
}
