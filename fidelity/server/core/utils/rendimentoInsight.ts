import {
  type RendimentoBox,
  type RendimentoVolantino,
  SOGLIA_INDICE_SPAZIO,
} from '../../../lib/insightVolantino/rendimento';
import type { BoxInsight } from '../../../lib/insightVolantino/tipi';
import { normalizzaCodiceProdotto } from '../../../lib/vendite/tipi';
import type { BoxKit } from './analisiKit';

/**
 * Rendimento dei box del volantino dalle vendite importate (contratto in
 * lib/insightVolantino/rendimento.ts, spec vendite-volantino). Funzioni pure: le vendite arrivano
 * gia' sommate per codice prodotto (InsightVenditeRepository), i box dagli insight (boxInsight).
 *
 * Regole:
 * - i codici dei prodotti di un box sono quelli della lettura generica delle referenze
 *   (referenzaStampata: codice DB1 o Istanta), nella forma di normalizzaCodiceProdotto, la stessa
 *   delle vendite importate;
 * - contano solo i box con geometria: sono quelli che hanno uno spazio con cui confrontare le vendite;
 * - un codice presente in piu' box divide le sue vendite fra quei box in parti uguali, cosi' il
 *   totale del volantino non conta due volte lo stesso prodotto;
 * - la misura principale e' il valore in euro solo se tutte le righe sommate lo portano,
 *   altrimenti i pezzi.
 */

/** Le vendite di un codice prodotto nel periodo, gia' sommate sui punti vendita. */
export interface VenditeCodice {
  pezzi: number;
  /** Euro; null se almeno una riga del codice non porta il valore. */
  valore: number | null;
}

/** Le vendite dei prodotti di un volantino nel periodo di validita' della sua promo. */
export interface VenditeDelPeriodo {
  /** YYYY-MM-DD inclusi. */
  periodo: { dal: string; al: string };
  /** Punti vendita della stessa area e canale con almeno una vendita dei prodotti cercati. */
  puntiVendita: number;
  /** Per codice prodotto normalizzato; mancano i codici senza nessuna riga. */
  perCodice: ReadonlyMap<string, VenditeCodice>;
  /** Tutte le righe sommate portano il valore in euro. */
  conValore: boolean;
}

/** Le vendite di un box: la sua parte delle vendite dei suoi codici. */
export interface VenditeBox {
  pezzi: number;
  /** null quando le vendite non portano il valore in euro (VenditeDelPeriodo.conValore). */
  valore: number | null;
  /** Prodotti del box, pilota compreso. */
  prodotti: number;
  /** Prodotti senza codice o senza nessuna riga di vendita nel periodo. */
  prodottiSenzaVendite: number;
}

/** I codici dei prodotti di ogni box del volantino: uno per prodotto, null per chi non ha codice. */
export type CodiciDeiBox = ReadonlyMap<string, ReadonlyArray<string | null>>;

const arrotonda = (valore: number, cifre = 1): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

/** Il codice di un prodotto come lo scrivono le vendite; null senza codice. */
const codiceDelProdotto = (codice: string | null): string | null => {
  const normalizzato = codice ? normalizzaCodiceProdotto(codice) : '';
  return normalizzato === '' ? null : normalizzato;
};

/**
 * I codici dei prodotti di ogni box, per id del box (l'id della pilota, come BoxInsight.id), dalla
 * lettura generica delle referenze che fa anche gli insight: stessi box, stessi prodotti.
 */
export function codiciDeiBox(box: readonly BoxKit[]): Map<string, Array<string | null>> {
  return new Map(box.map(singolo => [singolo.id, singolo.prodotti.map(prodotto => codiceDelProdotto(prodotto.codice))] as const));
}

/** I box che hanno uno spazio nel volantino: con pagina e geometria. */
export const boxConGeometria = (box: readonly BoxInsight[]): BoxInsight[] =>
  box.filter(singolo => singolo.geometria !== null && singolo.pagina !== null);

/** I codici da cercare nelle vendite: quelli dei box con geometria, senza doppioni. */
export function codiciDaCercare(box: readonly BoxInsight[], codici: CodiciDeiBox): string[] {
  const trovati = new Set<string>();
  for (const singolo of boxConGeometria(box)) {
    for (const codice of codici.get(singolo.id) ?? []) if (codice) trovati.add(codice);
  }
  return [...trovati].sort();
}

/**
 * Le vendite di ogni box con geometria, per id. Un codice in piu' box si divide in parti uguali
 * fra quei box; i prodotti senza codice o senza righe sono "senza vendite".
 */
export function venditeDeiBox(box: readonly BoxInsight[], codici: CodiciDeiBox, vendite: VenditeDelPeriodo): Map<string, VenditeBox> {
  const conGeometria = boxConGeometria(box);
  const codiciDi = (singolo: BoxInsight): ReadonlyArray<string | null> => codici.get(singolo.id) ?? [];

  // In quanti box compare ogni codice
  const condivisione = new Map<string, number>();
  for (const singolo of conGeometria) {
    for (const codice of new Set(codiciDi(singolo))) {
      if (codice) condivisione.set(codice, (condivisione.get(codice) ?? 0) + 1);
    }
  }

  const risultato = new Map<string, VenditeBox>();
  for (const singolo of conGeometria) {
    const prodotti = codiciDi(singolo);
    let pezzi = 0;
    let valore = 0;
    let senzaVendite = 0;
    const sommati = new Set<string>();
    for (const codice of prodotti) {
      const venduto = codice ? vendite.perCodice.get(codice) : undefined;
      if (!codice || !venduto) {
        senzaVendite++;
        continue;
      }
      // Lo stesso codice due volte nello stesso box (non dovrebbe: boxDelKit toglie i doppioni) si somma una volta
      if (sommati.has(codice)) continue;
      sommati.add(codice);
      const parte = 1 / (condivisione.get(codice) ?? 1);
      pezzi += venduto.pezzi * parte;
      valore += (venduto.valore ?? 0) * parte;
    }
    risultato.set(singolo.id, {
      pezzi,
      valore: vendite.conValore ? valore : null,
      prodotti: prodotti.length,
      prodottiSenzaVendite: senzaVendite,
    });
  }
  return risultato;
}

/** Prodotti diversi del volantino e quanti senza vendite: per codice, e ogni prodotto senza codice a se'. */
function prodottiDelVolantino(box: readonly BoxInsight[], codici: CodiciDeiBox, vendite: VenditeDelPeriodo) {
  const conCodice = new Set<string>();
  let senzaCodice = 0;
  for (const singolo of boxConGeometria(box)) {
    for (const codice of codici.get(singolo.id) ?? []) {
      if (codice) conCodice.add(codice);
      else senzaCodice++;
    }
  }
  const senzaVendite = [...conCodice].filter(codice => !vendite.perCodice.has(codice)).length;
  return { prodotti: conCodice.size + senzaCodice, prodottiSenzaVendite: senzaVendite + senzaCodice };
}

/**
 * Il rendimento dei box con geometria: pezzi, valore, quota sul totale (sulla misura principale)
 * accanto alla quota di spazio, e l'indice di spazio (quota / quota di spazio: 1 = il box rende
 * quanto lo spazio che occupa).
 *
 * sopraSpazio: indice >= SOGLIA_INDICE_SPAZIO, dal migliore. sottoSpazio: indice <= 1/SOGLIA, dal
 * peggiore, ma solo fra i box con almeno un prodotto venduto: un box senza nessuna riga puo' essere
 * un codice che il file non riporta, e lo dice gia' prodottiSenzaVendite.
 */
export function rendimentoVolantino(box: readonly BoxInsight[], codici: CodiciDeiBox, vendite: VenditeDelPeriodo): RendimentoVolantino {
  const conGeometria = boxConGeometria(box);
  const perBoxVendite = venditeDeiBox(conGeometria, codici, vendite);
  const misura: RendimentoVolantino['misura'] = vendite.conValore ? 'valore' : 'pezzi';
  const misuraDi = (voce: VenditeBox): number => (misura === 'valore' ? voce.valore ?? 0 : voce.pezzi);

  const voci = conGeometria.map(singolo => ({
    singolo,
    vendite: perBoxVendite.get(singolo.id) ?? { pezzi: 0, valore: misura === 'valore' ? 0 : null, prodotti: 0, prodottiSenzaVendite: 0 },
  }));
  const totaleMisura = voci.reduce((totale, voce) => totale + misuraDi(voce.vendite), 0);
  const totalePezzi = voci.reduce((totale, voce) => totale + voce.vendite.pezzi, 0);
  const totaleValore = voci.reduce((totale, voce) => totale + (voce.vendite.valore ?? 0), 0);
  const totaleSpazio = voci.reduce((totale, voce) => totale + voce.singolo.spazio, 0);

  const calcolati = voci.map(({ singolo, vendite: venduto }) => {
    const quota = totaleMisura > 0 ? (misuraDi(venduto) / totaleMisura) * 100 : 0;
    const quotaSpazio = totaleSpazio > 0 ? (singolo.spazio / totaleSpazio) * 100 : 0;
    const indiceSpazio = quotaSpazio > 0 ? quota / quotaSpazio : null;
    const voce: RendimentoBox = {
      idBox: singolo.id,
      pezzi: arrotonda(venduto.pezzi),
      valore: venduto.valore === null ? null : arrotonda(venduto.valore, 2),
      quota: arrotonda(quota),
      quotaSpazio: arrotonda(quotaSpazio),
      indiceSpazio: indiceSpazio === null ? null : arrotonda(indiceSpazio, 2),
      prodotti: venduto.prodotti,
      prodottiSenzaVendite: venduto.prodottiSenzaVendite,
    };
    return { voce, indiceSpazio, conVendite: venduto.prodottiSenzaVendite < venduto.prodotti };
  });

  // Ordinamento stabile: a parita' d'indice resta l'ordine del volantino
  const sopraSpazio = calcolati
    .filter(voce => voce.indiceSpazio !== null && voce.indiceSpazio >= SOGLIA_INDICE_SPAZIO)
    .sort((a, b) => (b.indiceSpazio ?? 0) - (a.indiceSpazio ?? 0))
    .map(voce => voce.voce.idBox);
  const sottoSpazio = calcolati
    .filter(voce => voce.conVendite && voce.indiceSpazio !== null && voce.indiceSpazio <= 1 / SOGLIA_INDICE_SPAZIO)
    .sort((a, b) => (a.indiceSpazio ?? 0) - (b.indiceSpazio ?? 0))
    .map(voce => voce.voce.idBox);

  return {
    periodo: { ...vendite.periodo },
    puntiVendita: vendite.puntiVendita,
    misura,
    totalePezzi: arrotonda(totalePezzi),
    totaleValore: misura === 'valore' ? arrotonda(totaleValore, 2) : null,
    perBox: calcolati.map(voce => voce.voce),
    ...prodottiDelVolantino(conGeometria, codici, vendite),
    sopraSpazio,
    sottoSpazio,
  };
}
