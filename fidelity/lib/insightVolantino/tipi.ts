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
  /**
   * true quando il box non stampa il prezzo e prezzo e' calcolato dal barrato e dallo sconto
   * stampati (i sottocosto dello storico): si mostra come calcolato. Assente altrimenti.
   */
  prezzoCalcolato?: boolean;
  /**
   * true quando il prezzo e' stampato nel riquadro del prezzo all'etto (prezzo_offerta_etto...): si
   * scrive "€ 0,99 all'etto" (lib/insightVolantino/unita.ts). Assente altrimenti.
   */
  prezzoAllEtto?: boolean;
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
  /**
   * I prodotti del box (pilota per primo) con i dati anagrafici, per la scheda e per l'interrogazione
   * del volantino. Assente nelle risposte dei server non aggiornati.
   */
  dettaglioProdotti?: ProdottoInsight[];
  /**
   * La descrizione completa del box per la scheda, come la compone la libreria agenzia del cliente
   * (di serie nome, marca in evidenza, formato e varianti: descrizione.ts). Assente nelle risposte
   * dei server non aggiornati: il client la compone allo stesso modo.
   */
  descrizione?: ParteDescrizione[];
}

/** Un pezzo della descrizione completa del box: un testo stampato, eventualmente in evidenza (la marca). */
export interface ParteDescrizione {
  testo: string;
  evidenza?: boolean;
}

/** I testi stampati con cui la libreria agenzia compone la descrizione completa del box. */
export interface TestiDescrizioneBox {
  /** Nome del prodotto pilota (la Descrizione1 di Istanta); null se la fonte non lo dice. */
  nome: string | null;
  /** Marca (la Descrizione2). */
  marca: string | null;
  /** Formato (la Descrizione4). */
  formato: string | null;
  /** Varianti diverse dei prodotti del box (la Descrizione3), nell'ordine dei prodotti. */
  varianti: string[];
}

/** Un prodotto del box con i dati che la fonte fornisce (DB1 o Istanta): null quando non li fornisce. */
export interface ProdottoInsight {
  chiave: string;
  nome: string;
  marca: string | null;
  formato: string | null;
  /** Gusto o variante (descrizione 3). */
  gusto: string | null;
  /** Codice referenza. */
  codice: string | null;
  /** Gli EAN della referenza: la fonte ne unisce a volte più d'uno ("8033281161575_8033281162091"). */
  ean: string[];
  prezzo: number | null;
  settore: string | null;
  segmento: string | null;
  /** Il tema gia' leggibile, con le etichette dichiarate dalla libreria agenzia (etichettaRuolo di lib/insightVolantino/ruolo.ts); null se non c'e'. */
  tema: string | null;
  /** Il tema come lo scrive la fonte ("tantealtreoff"), per il suggerimento; assente nei server non aggiornati. */
  temaOriginale?: string | null;
  ruolo: string | null;
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

/** La sezione di una pagina del menabò (per Conad CNO la mastro), dalle referenze della pagina. */
export interface PaginaMenabo {
  pagina: number;
  /** Il valore come lo scrive la fonte (es. "N1-NUMERI1"): distingue le sezioni e va nel suggerimento. */
  sezione: string;
  /**
   * Il nome leggibile dichiarato dalla libreria agenzia (es. "Numeri 1"): sezioni con lo stesso nome
   * ("DIS-DISPENSA_doppia" e "DIS-DISPENSA_singola" sono "Dispensa") hanno lo stesso colore.
   */
  nome: string;
}

/** Il menabò del volantino: solo le pagine con una sezione, in ordine di pagina. */
export interface MenaboVolantino {
  pagine: PaginaMenabo[];
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
  /**
   * Il menabò del volantino (spec insight-volantino, "Menabò del volantino"); null quando la libreria
   * agenzia del cliente non lo dichiara o nessuna referenza ha la sezione. Assente nei server non aggiornati.
   */
  menabo?: MenaboVolantino | null;
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
