import type { MeccanicaReferenza } from '../puntiVendita/analisi';

/**
 * Contratto degli insight del volantino (spec insight-volantino), condiviso fra server e client.
 *
 * - GET /api/flyer-insights/:idKit                       "materiali.visualizza" -> FlyerInsights (campi di sempre + EstensioneInsight)
 * - GET /api/flyer-insights/:idKit/prodotti/:chiave      "materiali.visualizza" -> ViaggioProdotto
 *
 * Nella pagina nessun confronto con altri volantini (decisione dell'utente): il confronto con
 * l'edizione precedente resta solo nel report PDF (ConfrontoEdizione, lib/insightVolantino/report.ts).
 *
 * Tutte limitate alla GDO della sessione (superadmin e agenzia: tutte, o quella in ?gdo=): un kit di
 * un'altra GDO risponde 404 come un kit inesistente. Valgono per ogni GDO e per i kit di Istanta e
 * dello storico: prezzi, sconti, marca e meccanica vengono dalla lettura generica delle referenze
 * (server/core/utils/referenzaStampata.ts), non dalla configurazione del cliente.
 *
 * Per decisione della direzione gli insight non contengono mappe di calore, zone calde, indici di
 * visibilita' stimata ne' dati di vendita (spec insight-volantino).
 */

// ─── Percorsi ───────────────────────────────────────────────────────

const base = (idKit: string): string => `/flyer-insights/${encodeURIComponent(idKit)}`;

export const percorsoInsight = (idKit: string): string => base(idKit);
export const percorsoViaggio = (idKit: string, chiave: string): string =>
  `${base(idKit)}/prodotti/${encodeURIComponent(chiave)}`;

// ─── Costanti ───────────────────────────────────────────────────────

/** Limiti inferiori delle fasce di sconto in %: [0,10) [10,20) ... [50, oltre). */
export const FASCE_SCONTO: readonly number[] = [0, 10, 20, 30, 40, 50];

/** Tappe massime del viaggio di un prodotto. */
export const MAX_TAPPE_VIAGGIO = 60;

// ─── Volantino ──────────────────────────────────────────────────────

/** Riquadro in coordinate della pagina: da 0 a 1, origine in alto a sinistra (anche per Istanta). */
export interface GeometriaPagina {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Il PDF del volantino in Olimpo: le immagini delle pagine si chiedono a getThumbnailMaterialePdfs. */
export interface PdfVolantino {
  idOlimpoCloud: string;
  pagine: number;
}

export interface RepartoInsight {
  /**
   * Codice del reparto. Con un nome per il marketing condiviso da piu' codici (Impostazioni GDO),
   * e' il codice piu' basso del gruppo: lo stesso per tutti i box del gruppo.
   */
  codice: string;
  /** Nome per il marketing della GDO se impostato, altrimenti la descrizione dell'anagrafica o dei dati. */
  descrizione: string;
  /** Colore impostato per la GDO (#rrggbb); assente o null: quello della configurazione o automatico. */
  colore?: string | null;
  /** true quando descrizione e' il nome per il marketing della GDO: si mostra come e' scritto. */
  marketing?: boolean;
}

/** Un box del volantino: il primo prodotto (pilota) e quanti altri ne contiene. */
export interface BoxInsight {
  id: string;
  codiceBox: string;
  pagina: number | null;
  geometria: GeometriaPagina | null;
  /** Spazio occupato in % della pagina (0-100); 0 senza geometria. */
  spazio: number;
  /** Larghezza/altezza della pagina (w_page/h_page) per allineare i riquadri all'immagine. */
  proporzionePagina: number | null;
  /** Chiave del prodotto pilota (chiaveProdotto): stessa per lo stesso prodotto in ogni volantino. */
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  prezzo: number | null;
  barrato: number | null;
  /** Sconto in % (0-100). */
  sconto: number | null;
  prezzoAlKg: string | null;
  punti: string | null;
  sottocosto: boolean;
  meccanica: MeccanicaReferenza | null;
  /** Meccanica come la scrive la fonte (es. "TP_FID_KgL"), dal campo meccanica della config. */
  meccanicaOriginale: string | null;
  /** Reparto dall'anagrafica della config, o dalla lettura generica; null se non si sa. */
  reparto: RepartoInsight | null;
  /** URL delle foto, gia' pronti per <img>. */
  foto: string[];
  /** Prodotti nel box (pilota compreso). */
  prodotti: number;
  idReferenze: string[];
  /** Solo nei kit dello storico. */
  origine?: 'listino' | 'fuori_listino';
  /**
   * Linea di marca del distributore della referenza pilota (es. Sapori & Dintorni): quella assegnata
   * da Istanta, o ricavata dalle regole della libreria agenzia dai testi stampati; null se non e' del
   * distributore o il cliente non dichiara linee. Assente nelle risposte dei server non aggiornati.
   */
  linea?: LineaBox | null;
  /** Sigle dei bolli della referenza pilota (DOP, Filiera controllata...), solo quelli dichiarati. */
  bolli?: string[];
}

export interface LineaBox {
  sigla: string;
  nome: string;
}

/** Percentuali 0-100 di box che hanno il dato. */
export interface CoperturaDati {
  prezzo: number;
  marca: number;
  reparto: number;
  geometria: number;
}

export interface SintesiVolantino {
  referenze: number;
  box: number;
  pagine: number;
  /** Media degli sconti dei box che ne hanno uno, in %. */
  scontoMedio: number | null;
  boxConSconto: number;
  /** % dei box con meccanica fidelity. */
  quotaFidelity: number;
  sottocosto: number;
  marche: number;
  copertura: CoperturaDati;
}

export interface FasciaSconto {
  /** Limite inferiore incluso, in %. */
  da: number;
  /** Limite superiore escluso; null per l'ultima fascia. */
  a: number | null;
  box: number;
}

export interface ScontoPerGruppo {
  chiave: string;
  etichetta: string;
  box: number;
  scontoMedio: number | null;
}

export interface PrezziSconti {
  fasce: FasciaSconto[];
  perReparto: ScontoPerGruppo[];
  perMeccanica: ScontoPerGruppo[];
  /** Id dei box in sottocosto. */
  sottocosto: string[];
  /** Box con il prezzo al kg/l stampato o nei dati. */
  conPrezzoAlKg: number;
}

/** Quota di referenze accanto a quota di spazio (percentuali 0-100 sul volantino). */
export interface QuotaSpazio {
  chiave: string;
  etichetta: string;
  referenze: number;
  /** Spazio in % di pagina sommato sui box. */
  spazio: number;
  quotaReferenze: number;
  quotaSpazio: number;
}

export interface DensitaPagina {
  pagina: number;
  box: number;
  /** % della pagina coperta dai box. */
  spazioOccupato: number;
}

export interface UsoSpazio {
  perReparto: QuotaSpazio[];
  perMeccanica: QuotaSpazio[];
  perMarca: QuotaSpazio[];
  perPagina: DensitaPagina[];
}

export interface MarcaInsight {
  /** Nome normalizzato (maiuscole, spazi singoli). */
  chiave: string;
  nome: string;
  box: number;
  referenze: number;
  quotaSpazio: number;
  scontoMedio: number | null;
  /** Marca del distributore secondo la config (marche.distributore). */
  distributore: boolean;
}

export interface MarcheVolantino {
  /** Ordinate per spazio, poi per box. */
  elenco: MarcaInsight[];
  /** null quando la config non indica marche del distributore. */
  quotaDistributore: { quotaSpazio: number; quotaBox: number } | null;
}

/** Una linea del distributore nel volantino (spec insight-volantino, "Linee del distributore con loghi e bolli"). */
export interface LineaInsight {
  sigla: string;
  nome: string;
  colore: string | null;
  /** URL dell'immagine del logo (proxy pubblico /olimpo); null se il catalogo di Istanta non ce l'ha. */
  logo: string | null;
  box: number;
  referenze: number;
  /** % dello spazio dei box del volantino (0-100). */
  quotaSpazio: number;
  scontoMedio: number | null;
}

export interface BolloInsight {
  sigla: string;
  nome: string;
  logo: string | null;
  box: number;
}

export interface LineeDistributore {
  /** Tutte le linee insieme: % dello spazio e dei box del volantino. */
  quotaSpazio: number;
  quotaBox: number;
  box: number;
  /** Nell'ordine dichiarato dalla libreria agenzia, solo quelle presenti. */
  linee: LineaInsight[];
  /** Per numero di box, solo quelli presenti. */
  bolli: BolloInsight[];
}

/** Le sezioni nuove di GET /api/flyer-insights/:idKit, accanto ai campi di sempre. */
export interface EstensioneInsight {
  pdf: PdfVolantino | null;
  box: BoxInsight[];
  sintesi: SintesiVolantino;
  prezziSconti: PrezziSconti;
  spazio: UsoSpazio;
  marche: MarcheVolantino;
  /**
   * Linee del distributore con loghi e bolli; null quando la libreria agenzia del cliente non dichiara
   * linee. Assente nelle risposte dei server non aggiornati.
   */
  lineeDistributore?: LineeDistributore | null;
}

// ─── Confronto con l'edizione precedente (solo report PDF) ───────────

export interface VolantinoDiRiferimento {
  idKit: string;
  titolo: string;
  idPromo: string;
  nomePromo: string | null;
  area: string;
  canale: string;
  /** Date ISO YYYY-MM-DD. */
  validitaDal: string | null;
  validitaAl: string | null;
  storico: boolean;
}

export interface Variazione {
  attuale: number | null;
  precedente: number | null;
  /** attuale - precedente; null se manca uno dei due. */
  differenza: number | null;
}

export interface ProdottoConfronto {
  chiave: string;
  nome: string;
  marca: string | null;
  prezzo: number | null;
  sconto: number | null;
}

export interface ConfrontoEdizione {
  edizione: VolantinoDiRiferimento;
  sintesi: {
    referenze: Variazione;
    box: Variazione;
    pagine: Variazione;
    scontoMedio: Variazione;
    quotaFidelity: Variazione;
    sottocosto: Variazione;
    marche: Variazione;
  };
  /** Quota di spazio per reparto nei due volantini, in %. */
  spazioPerReparto: Array<{ chiave: string; etichetta: string; attuale: number; precedente: number }>;
  prodottiEntrati: ProdottoConfronto[];
  prodottiUsciti: ProdottoConfronto[];
}

// ─── Viaggio del prodotto ───────────────────────────────────────────

export interface TappaProdotto {
  idKit: string;
  titolo: string;
  /** Data dell'edizione ISO YYYY-MM-DD (inizio validita' della promo). */
  data: string;
  area: string;
  canale: string;
  prezzo: number | null;
  barrato: number | null;
  sconto: number | null;
  sottocosto: boolean;
  meccanica: MeccanicaReferenza | null;
  pagina: number | null;
  spazio: number | null;
  /** La tappa e' il volantino da cui si e' aperto il viaggio. */
  questoVolantino: boolean;
}

export interface ViaggioProdotto {
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  foto: string[];
  /** Dalla piu' recente, al massimo MAX_TAPPE_VIAGGIO. */
  tappe: TappaProdotto[];
}
