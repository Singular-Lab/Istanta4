import type {
  ConfrontoEdizione,
  ProdottoConfronto,
  QuotaSpazio,
  SintesiVolantino,
  Variazione,
} from '../../../lib/insightVolantino/tipi';
import type { BoxKit } from './analisiKit';
import type { ProdottoStampato } from './referenzaStampata';

/**
 * Un volantino e l'edizione precedente della stessa area e canale (contratto in
 * lib/insightVolantino/tipi.ts), per il report PDF: numeri chiave, spazio per reparto, prodotti
 * entrati e usciti. La pagina degli insight non confronta piu' il volantino con altri.
 *
 * I prodotti si riconoscono dalla chiave (referenzaStampata.chiaveProdotto), la stessa per lo stesso
 * prodotto in ogni volantino, Istanta o storico. Contano tutti i prodotti dei box, non solo i piloti:
 * un prodotto puo' essere pilota in un volantino ed elemento del gruppo nell'altro.
 *
 * Funzioni pure.
 */

interface Presenza {
  prodotto: ProdottoStampato;
  box: BoxKit;
}

/** Ogni prodotto del volantino, alla sua prima presenza nell'ordine dei box (pagina, alto, sinistra). */
function prodottiPerChiave(box: readonly BoxKit[]): Map<string, Presenza> {
  const perChiave = new Map<string, Presenza>();
  for (const singolo of box) {
    for (const prodotto of singolo.prodotti) {
      if (!perChiave.has(prodotto.chiave)) perChiave.set(prodotto.chiave, { prodotto, box: singolo });
    }
  }
  return perChiave;
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
