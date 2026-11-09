import type {
  BoxInsight,
  ConfrontoEdizione,
  DifferenzaProdotto,
  DifferenzeVarianti,
  PresenzaInVariante,
  ProdottoConfronto,
  QuotaSpazio,
  SintesiVolantino,
  StatoDifferenza,
  Variazione,
} from '../../../lib/insightVolantino/tipi';
import type { BoxKit } from './analisiKit';
import type { ProdottoStampato } from './referenzaStampata';

/**
 * Due volantini a confronto (contratto in lib/insightVolantino/tipi.ts):
 * - due varianti area/canale della stessa promo, prodotto per prodotto e box per box;
 * - un volantino e l'edizione precedente della stessa area e canale: numeri chiave, spazio per
 *   reparto, prodotti entrati e usciti.
 *
 * I prodotti si riconoscono dalla chiave (referenzaStampata.chiaveProdotto), la stessa per lo stesso
 * prodotto in ogni volantino, Istanta o storico. Contano tutti i prodotti dei box, non solo i piloti:
 * un prodotto puo' essere pilota in una variante ed elemento del gruppo nell'altra.
 *
 * Funzioni pure.
 */

/** Sotto mezzo centesimo due prezzi sono uguali: arrotondamenti della fonte, non scelte diverse. */
export const TOLLERANZA_PREZZO = 0.005;
/** Sotto mezzo punto due sconti sono uguali: lo sconto calcolato dai prezzi ha decimali. */
export const TOLLERANZA_SCONTO = 0.5;

/** Ordine delle differenze nell'elenco e priorita' dello stato di un box con piu' prodotti. */
const ORDINE_STATO: readonly StatoDifferenza[] = ['solo-qui', 'solo-altra', 'prezzo-diverso', 'uguale'];

/** La parte di DifferenzeVarianti che dipende solo dai box delle due varianti. */
export type EsitoDifferenze = Pick<DifferenzeVarianti, 'statoBoxQui' | 'statoBoxAltra' | 'differenze' | 'conteggi'>;

interface Presenza {
  prodotto: ProdottoStampato;
  box: BoxKit;
}

/** Ogni prodotto della variante, alla sua prima presenza nell'ordine dei box (pagina, alto, sinistra). */
function prodottiPerChiave(box: readonly BoxKit[]): Map<string, Presenza> {
  const perChiave = new Map<string, Presenza>();
  for (const singolo of box) {
    for (const prodotto of singolo.prodotti) {
      if (!perChiave.has(prodotto.chiave)) perChiave.set(prodotto.chiave, { prodotto, box: singolo });
    }
  }
  return perChiave;
}

/** Due valori diversi oltre la tolleranza; un valore che c'e' in una sola variante e' una differenza. */
function diversi(a: number | null, b: number | null, tolleranza: number): boolean {
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) > tolleranza;
}

function presenzaInVariante(presenza: Presenza, insight: ReadonlyMap<string, BoxInsight>): PresenzaInVariante {
  return {
    idBox: presenza.box.id,
    pagina: presenza.box.pagina,
    prezzo: presenza.prodotto.prezzo,
    sconto: presenza.prodotto.sconto,
    // Lo spazio come lo mostra il box negli insight; senza, dalla geometria letta
    spazio: insight.get(presenza.box.id)?.spazio ?? presenza.box.geometria?.spazio ?? 0,
  };
}

const piuRilevante = (a: StatoDifferenza, b: StatoDifferenza): StatoDifferenza =>
  (ORDINE_STATO.indexOf(a) <= ORDINE_STATO.indexOf(b) ? a : b);

/** Lo stato di ogni box: quello piu' rilevante fra i suoi prodotti. */
function statoDeiBox(box: readonly BoxKit[], statoProdotto: ReadonlyMap<string, StatoDifferenza>): Record<string, StatoDifferenza> {
  const stati: Record<string, StatoDifferenza> = {};
  for (const singolo of box) {
    let stato: StatoDifferenza = 'uguale';
    for (const prodotto of singolo.prodotti) {
      stato = piuRilevante(stato, statoProdotto.get(prodotto.chiave) ?? 'uguale');
    }
    stati[singolo.id] = stato;
  }
  return stati;
}

const paginaPerOrdine = (differenza: DifferenzaProdotto): number =>
  differenza.qui?.pagina ?? differenza.altra?.pagina ?? Number.MAX_SAFE_INTEGER;

/**
 * Le differenze fra due varianti della stessa promo. Un prodotto e' "solo qui" o "solo nell'altra"
 * se manca da una delle due, "prezzo-diverso" se prezzo o sconto cambiano oltre la tolleranza,
 * altrimenti "uguale". Un box prende lo stato piu' rilevante dei suoi prodotti. L'elenco non ha gli
 * uguali ed e' ordinato per stato, poi per pagina.
 */
export function differenzeFraVarianti(
  boxQui: readonly BoxKit[],
  boxAltra: readonly BoxKit[],
  insQui: readonly BoxInsight[],
  insAltra: readonly BoxInsight[],
): EsitoDifferenze {
  const qui = prodottiPerChiave(boxQui);
  const altra = prodottiPerChiave(boxAltra);
  const insightQui = new Map(insQui.map(box => [box.id, box] as const));
  const insightAltra = new Map(insAltra.map(box => [box.id, box] as const));

  const statoProdotto = new Map<string, StatoDifferenza>();
  const conteggi: Record<StatoDifferenza, number> = { 'solo-qui': 0, 'solo-altra': 0, 'prezzo-diverso': 0, uguale: 0 };
  const differenze: DifferenzaProdotto[] = [];

  for (const chiave of new Set([...qui.keys(), ...altra.keys()])) {
    const presenzaQui = qui.get(chiave) ?? null;
    const presenzaAltra = altra.get(chiave) ?? null;
    const descritto = presenzaQui ?? presenzaAltra;
    if (!descritto) continue;
    let stato: StatoDifferenza;
    if (!presenzaAltra) stato = 'solo-qui';
    else if (!presenzaQui) stato = 'solo-altra';
    else if (
      diversi(presenzaQui.prodotto.prezzo, presenzaAltra.prodotto.prezzo, TOLLERANZA_PREZZO)
      || diversi(presenzaQui.prodotto.sconto, presenzaAltra.prodotto.sconto, TOLLERANZA_SCONTO)
    ) stato = 'prezzo-diverso';
    else stato = 'uguale';

    statoProdotto.set(chiave, stato);
    conteggi[stato] += 1;
    if (stato === 'uguale') continue;
    differenze.push({
      chiave,
      nome: descritto.prodotto.nome,
      marca: descritto.prodotto.marca,
      stato,
      qui: presenzaQui ? presenzaInVariante(presenzaQui, insightQui) : null,
      altra: presenzaAltra ? presenzaInVariante(presenzaAltra, insightAltra) : null,
    });
  }

  differenze.sort((a, b) =>
    ORDINE_STATO.indexOf(a.stato) - ORDINE_STATO.indexOf(b.stato)
    || paginaPerOrdine(a) - paginaPerOrdine(b)
    || a.nome.localeCompare(b.nome, 'it')
    || (a.chiave < b.chiave ? -1 : a.chiave > b.chiave ? 1 : 0));

  return {
    statoBoxQui: statoDeiBox(boxQui, statoProdotto),
    statoBoxAltra: statoDeiBox(boxAltra, statoProdotto),
    differenze,
    conteggi,
  };
}

// ─── Edizione precedente ────────────────────────────────────────────

const arrotonda = (valore: number): number => Math.round(valore * 100) / 100;

/** Il valore attuale e il precedente; la differenza solo se ci sono tutti e due. */
export function variazione(attuale: number | null, precedente: number | null): Variazione {
  return {
    attuale,
    precedente,
    differenza: attuale === null || precedente === null ? null : arrotonda(attuale - precedente),
  };
}

/** I numeri chiave del volantino accanto a quelli dell'edizione precedente. */
export function confrontoSintesi(attuale: SintesiVolantino, precedente: SintesiVolantino): ConfrontoEdizione['sintesi'] {
  return {
    referenze: variazione(attuale.referenze, precedente.referenze),
    box: variazione(attuale.box, precedente.box),
    pagine: variazione(attuale.pagine, precedente.pagine),
    scontoMedio: variazione(attuale.scontoMedio, precedente.scontoMedio),
    quotaFidelity: variazione(attuale.quotaFidelity, precedente.quotaFidelity),
    sottocosto: variazione(attuale.sottocosto, precedente.sottocosto),
    marche: variazione(attuale.marche, precedente.marche),
  };
}

/**
 * La quota di spazio di ogni reparto nei due volantini: un reparto che manca in uno dei due vale 0
 * li'. Dal reparto con piu' spazio oggi.
 */
export function confrontoSpazioPerReparto(
  attuale: readonly QuotaSpazio[],
  precedente: readonly QuotaSpazio[],
): ConfrontoEdizione['spazioPerReparto'] {
  const perChiave = new Map<string, { chiave: string; etichetta: string; attuale: number; precedente: number }>();
  for (const voce of attuale) {
    perChiave.set(voce.chiave, { chiave: voce.chiave, etichetta: voce.etichetta, attuale: voce.quotaSpazio, precedente: 0 });
  }
  for (const voce of precedente) {
    const presente = perChiave.get(voce.chiave);
    if (presente) presente.precedente = voce.quotaSpazio;
    else perChiave.set(voce.chiave, { chiave: voce.chiave, etichetta: voce.etichetta, attuale: 0, precedente: voce.quotaSpazio });
  }
  return [...perChiave.values()].sort((a, b) =>
    b.attuale - a.attuale || b.precedente - a.precedente || a.etichetta.localeCompare(b.etichetta, 'it'));
}

/**
 * I prodotti di un volantino che nell'altro non ci sono, nell'ordine in cui compaiono (pagina, dall'alto):
 * con (attuale, precedente) gli entrati, con (precedente, attuale) gli usciti.
 */
export function prodottiAssenti(da: readonly BoxKit[], confronto: readonly BoxKit[]): ProdottoConfronto[] {
  const presenti = prodottiPerChiave(confronto);
  return [...prodottiPerChiave(da).values()]
    .filter(({ prodotto }) => !presenti.has(prodotto.chiave))
    .map(({ prodotto }) => ({
      chiave: prodotto.chiave,
      nome: prodotto.nome,
      marca: prodotto.marca,
      prezzo: prodotto.prezzo,
      sconto: prodotto.sconto,
    }));
}
