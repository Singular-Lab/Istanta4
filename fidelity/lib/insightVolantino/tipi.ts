import type { MeccanicaReferenza } from '../puntiVendita/analisi';

/**
 * Contratto degli insight del volantino (spec insight-volantino), condiviso fra server e client.
 *
 * - GET /api/flyer-insights/:idKit                       "materiali.visualizza" -> FlyerInsights (campi di sempre + EstensioneInsight)
 * - GET /api/flyer-insights/:idKit/confronti             "materiali.visualizza" -> ConfrontiVolantino
 * - GET /api/flyer-insights/:idKit/varianti/:idAltra     "materiali.visualizza" -> DifferenzeVarianti (400 se idAltra non e' della stessa promo)
 * - GET /api/flyer-insights/:idKit/prodotti/:chiave      "materiali.visualizza" -> ViaggioProdotto
 *
 * Tutte limitate alla GDO della sessione (superadmin e agenzia: tutte, o quella in ?gdo=): un kit di
 * un'altra GDO risponde 404 come un kit inesistente. Valgono per ogni GDO e per i kit di Istanta e
 * dello storico: prezzi, sconti, marca e meccanica vengono dalla lettura generica delle referenze
 * (server/core/utils/referenzaStampata.ts), non dalla configurazione del cliente.
 */

// ─── Percorsi ───────────────────────────────────────────────────────

const base = (idKit: string): string => `/flyer-insights/${encodeURIComponent(idKit)}`;

export const percorsoInsight = (idKit: string): string => base(idKit);
export const percorsoConfronti = (idKit: string): string => `${base(idKit)}/confronti`;
export const percorsoVarianti = (idKit: string, idAltra: string): string =>
  `${base(idKit)}/varianti/${encodeURIComponent(idAltra)}`;
export const percorsoViaggio = (idKit: string, chiave: string): string =>
  `${base(idKit)}/prodotti/${encodeURIComponent(chiave)}`;

// ─── Costanti ───────────────────────────────────────────────────────

/**
 * Pesi della visibilita' stimata di un box: spazio × peso della pagina × peso della posizione.
 * La libreria agenzia del cliente puo' dichiararne di propri (insightVolantino.pesiVisibilita);
 * senza, valgono questi. La pagina li dichiara all'utente.
 */
export interface PesiVisibilita {
  copertina: number;
  ultima: number;
  primaDoppia: number;
  altre: number;
  alto: number;
  basso: number;
}

export const PESI_VISIBILITA: PesiVisibilita = {
  /** Pagina 1 */
  copertina: 1,
  /** Ultima pagina, se diversa dalla copertina */
  ultima: 0.8,
  /** Pagine 2 e 3, la prima doppia pagina */
  primaDoppia: 0.7,
  /** Tutte le altre */
  altre: 0.5,
  /** Peso della posizione con il centro del box in cima alla pagina... */
  alto: 1,
  /** ...e in fondo: in mezzo varia in modo lineare */
  basso: 0.6,
};

/** Griglia della mappa di calore di ogni pagina. */
export const GRIGLIA_CALORE = { righe: 6, colonne: 4 } as const;

/** Limiti inferiori delle fasce di sconto in %: [0,10) [10,20) ... [50, oltre). */
export const FASCE_SCONTO: readonly number[] = [0, 10, 20, 30, 40, 50];

/** Tappe massime del viaggio di un prodotto. */
export const MAX_TAPPE_VIAGGIO = 60;

/** Peso della pagina nella visibilita' (pagine contate da 1). */
export function pesoPagina(pagina: number, totalePagine: number, pesi: PesiVisibilita = PESI_VISIBILITA): number {
  if (pagina === 1) return pesi.copertina;
  if (totalePagine > 1 && pagina === totalePagine) return pesi.ultima;
  if (pagina === 2 || pagina === 3) return pesi.primaDoppia;
  return pesi.altre;
}

/** Peso della posizione dal centro verticale del box, 0 = in cima, 1 = in fondo alla pagina. */
export function pesoPosizione(centroY: number, pesi: PesiVisibilita = PESI_VISIBILITA): number {
  const y = Math.min(1, Math.max(0, centroY));
  return pesi.alto + (pesi.basso - pesi.alto) * y;
}

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
  codice: string;
  descrizione: string;
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
  /** Visibilita' stimata 0-100: 100 = il box piu' visibile di questo volantino. */
  visibilita: number;
  /** Solo nei kit dello storico. */
  origine?: 'listino' | 'fuori_listino';
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

export interface QuotaVisibilita {
  chiave: string;
  etichetta: string;
  quotaVisibilita: number;
  quotaSpazio: number;
}

export interface CalorePagina {
  pagina: number;
  /** GRIGLIA_CALORE.righe × GRIGLIA_CALORE.colonne, valori 0-1 (1 = cella piu' calda del volantino). */
  celle: number[][];
}

export interface ZoneCalde {
  /** Id dei box piu' visibili, al massimo 10, dal piu' visibile. */
  boxPiuVisibili: string[];
  perReparto: QuotaVisibilita[];
  perMarca: QuotaVisibilita[];
  calore: CalorePagina[];
  /** I pesi usati: quelli della libreria agenzia del cliente o PESI_VISIBILITA. */
  pesi: PesiVisibilita;
}

/** Le sezioni nuove di GET /api/flyer-insights/:idKit, accanto ai campi di sempre. */
export interface EstensioneInsight {
  pdf: PdfVolantino | null;
  box: BoxInsight[];
  sintesi: SintesiVolantino;
  prezziSconti: PrezziSconti;
  spazio: UsoSpazio;
  marche: MarcheVolantino;
  zoneCalde: ZoneCalde;
}

// ─── Confronti ──────────────────────────────────────────────────────

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

export interface ConfrontiVolantino {
  /** null per la prima edizione di un'area e di un canale. */
  edizionePrecedente: ConfrontoEdizione | null;
  /** Le altre varianti area/canale della stessa promo (senza questo volantino). */
  varianti: VolantinoDiRiferimento[];
}

export type StatoDifferenza = 'solo-qui' | 'solo-altra' | 'prezzo-diverso' | 'uguale';

export interface PresenzaInVariante {
  idBox: string;
  pagina: number | null;
  prezzo: number | null;
  sconto: number | null;
  spazio: number;
}

export interface DifferenzaProdotto {
  chiave: string;
  nome: string;
  marca: string | null;
  stato: StatoDifferenza;
  qui: PresenzaInVariante | null;
  altra: PresenzaInVariante | null;
}

export interface DifferenzeVarianti {
  qui: VolantinoDiRiferimento;
  altra: VolantinoDiRiferimento;
  pdfAltra: PdfVolantino | null;
  /** I box dell'altra variante, come EstensioneInsight.box. */
  boxAltra: BoxInsight[];
  /** Stato di ogni box per id: un box con piu' prodotti prende lo stato piu' rilevante. */
  statoBoxQui: Record<string, StatoDifferenza>;
  statoBoxAltra: Record<string, StatoDifferenza>;
  /** Senza gli "uguale": solo qui, solo nell'altra, prezzo o sconto diverso. */
  differenze: DifferenzaProdotto[];
  conteggi: Record<StatoDifferenza, number>;
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
