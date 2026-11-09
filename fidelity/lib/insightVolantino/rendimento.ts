/**
 * Rendimento dalle vendite, previsione e simulazione degli insight del volantino
 * (spec vendite-volantino e insight-volantino), condivisi fra server e client.
 *
 * - GET /api/flyer-insights/:idKit/vendite      "materiali.visualizza" -> RendimentoVolantino | null
 * - GET /api/flyer-insights/:idKit/previsione   "materiali.visualizza" -> PrevisioneVolantino | null
 * - GET /api/flyer-insights/:idKit/simulazione  "materiali.visualizza" -> SimulazioneProdotto
 *   (?chiave=&pagina=&x=&y=&spazio=&sconto=, 400 con parametri non validi)
 *
 * Stesso ambito GDO di GET /api/flyer-insights/:idKit: un kit di un'altra GDO risponde 404.
 * Le vendite sono quelle importate (lib/vendite/tipi.ts) nei punti vendita della stessa area e dello
 * stesso canale del volantino, nel periodo di validita' della sua promo.
 */

const base = (idKit: string): string => `/flyer-insights/${encodeURIComponent(idKit)}`;

export const percorsoRendimento = (idKit: string): string => `${base(idKit)}/vendite`;
export const percorsoPrevisione = (idKit: string): string => `${base(idKit)}/previsione`;
export const percorsoSimulazione = (idKit: string, richiesta: RichiestaSimulazione): string => {
  const parametri = new URLSearchParams({
    chiave: richiesta.chiave,
    pagina: String(richiesta.pagina),
    x: String(richiesta.x),
    y: String(richiesta.y),
    spazio: String(richiesta.spazio),
  });
  if (richiesta.sconto !== null) parametri.set('sconto', String(richiesta.sconto));
  return `${base(idKit)}/simulazione?${parametri.toString()}`;
};

// ─── Rendimento dalle vendite ───────────────────────────────────────

/** Indice di spazio oltre il quale un box "rende piu' dello spazio che occupa" (e sotto 1/x meno). */
export const SOGLIA_INDICE_SPAZIO = 1.5;

export interface RendimentoBox {
  idBox: string;
  pezzi: number;
  /** Valore in euro; null se il file delle vendite non lo porta. */
  valore: number | null;
  /** Quota sul totale del volantino, in % (0-100), sulla misura principale. */
  quota: number;
  /** Quota dello spazio del volantino occupato dal box, in % (0-100). */
  quotaSpazio: number;
  /** quota / quotaSpazio: 1 = rende quanto lo spazio che occupa; null senza spazio. */
  indiceSpazio: number | null;
  /** Prodotti del box (pilota compreso) e quanti di loro non hanno vendite. */
  prodotti: number;
  prodottiSenzaVendite: number;
}

export interface RendimentoVolantino {
  /** Periodo di validita' della promo su cui si sommano le vendite (YYYY-MM-DD inclusi). */
  periodo: { dal: string; al: string };
  /** Punti vendita della stessa area e canale con almeno una vendita nel periodo. */
  puntiVendita: number;
  /** 'valore' quando tutte le righe hanno il valore in euro, altrimenti 'pezzi'. */
  misura: 'valore' | 'pezzi';
  totalePezzi: number;
  totaleValore: number | null;
  /** Un elemento per ogni box con geometria, anche a zero. */
  perBox: RendimentoBox[];
  prodotti: number;
  prodottiSenzaVendite: number;
  /** Id dei box con indiceSpazio >= SOGLIA_INDICE_SPAZIO, dal migliore. */
  sopraSpazio: string[];
  /** Id dei box con indiceSpazio <= 1 / SOGLIA_INDICE_SPAZIO, dal peggiore. */
  sottoSpazio: string[];
}

// ─── Previsione ─────────────────────────────────────────────────────

/** 'vendite': dallo storico delle vendite; 'teorica': solo posizione, spazio e sconto (nessuna vendita). */
export type TipoPrevisione = 'vendite' | 'teorica';
export type Affidabilita = 'alta' | 'media' | 'bassa';

/** Regole della previsione: la libreria agenzia del cliente puo' cambiarle (insightVolantino.previsione). */
export interface RegolePrevisione {
  /** Quante edizioni precedenti della stessa GDO, area e canale guardare. */
  edizioniStoriche: number;
  /** Sotto questi casi storici l'affidabilita' e' bassa; dal triplo e' alta. */
  casiMinimi: number;
  /** 0-1: quanto conta lo storico del prodotto rispetto a quello del suo reparto. */
  pesoProdotto: number;
  /** Rendimenti decrescenti dello spazio: vendite ∝ spazio^elasticita' (0.5: 4 volte lo spazio, il doppio). */
  elasticitaSpazio: number;
  /** Effetto dichiarato di ogni fascia di FASCE_SCONTO quando lo storico non basta (1 = nessun effetto). */
  effettoSconto: number[];
}

export const REGOLE_PREVISIONE_STANDARD: RegolePrevisione = {
  edizioniStoriche: 26,
  casiMinimi: 3,
  pesoProdotto: 0.7,
  elasticitaSpazio: 0.5,
  effettoSconto: [1, 1.15, 1.3, 1.5, 1.75, 2],
};

export interface PrevisioneBox {
  idBox: string;
  /** Pezzi previsti (tipo 'vendite') o indice 0-100 (tipo 'teorica'). */
  valore: number;
  casiStorici: number;
  affidabilita: Affidabilita;
  /** Il dato reale nella stessa unita', quando il volantino ha gia' le vendite. */
  reale: number | null;
}

export interface PrevisioneVolantino {
  tipo: TipoPrevisione;
  unita: 'pezzi' | 'indice';
  /** La promo e' gia' iniziata: la previsione serve al confronto con il reale. */
  promoValida: boolean;
  /** Edizioni precedenti usate. */
  edizioniStoriche: number;
  perBox: PrevisioneBox[];
  /** Scarto medio assoluto in % fra previsto e reale; null senza vendite reali. */
  scartoMedio: number | null;
  /** Frase per l'utente su come e' stata fatta (es. "Stima teorica: nessuna vendita importata"). */
  nota: string;
}

// ─── Simulazione ────────────────────────────────────────────────────

export interface RichiestaSimulazione {
  /** Chiave del prodotto (chiaveProdotto), come BoxInsight.chiave. */
  chiave: string;
  pagina: number;
  /** Centro del box simulato, 0-1 dall'alto a sinistra. */
  x: number;
  y: number;
  /** Spazio in % della pagina. */
  spazio: number;
  /** Sconto in %, null senza sconto. */
  sconto: number | null;
}

export interface CasoSimile {
  idKit: string;
  titolo: string;
  /** Inizio validita' della promo, YYYY-MM-DD. */
  data: string;
  pagina: number | null;
  sconto: number | null;
  spazio: number | null;
  /** Pezzi venduti (tipo 'vendite') o visibilita' 0-100 (tipo 'teorica'). */
  valore: number | null;
}

export interface SimulazioneProdotto {
  tipo: TipoPrevisione;
  unita: 'pezzi' | 'indice';
  valore: number;
  /** Indice della posizione scelta: 1 = media delle posizioni del volantino. */
  indicePosizione: number;
  casiStorici: number;
  affidabilita: Affidabilita;
  /** Al massimo 5, dal piu' simile. */
  casiSimili: CasoSimile[];
  nota: string;
}

export function affidabilitaDaCasi(casi: number, regole: RegolePrevisione = REGOLE_PREVISIONE_STANDARD): Affidabilita {
  if (casi <= 0) return 'bassa';
  if (casi >= regole.casiMinimi * 3) return 'alta';
  if (casi >= regole.casiMinimi) return 'media';
  return 'bassa';
}
