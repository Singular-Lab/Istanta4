import type { MeccanicaReferenza } from '../../../lib/puntiVendita/analisi';
import { MECCANICHE } from '../../../lib/puntiVendita/analisi';
import type { GeometriaReferenza, ProdottoStampato, ReferenzaStampata } from './referenzaStampata';

/**
 * I box di un volantino e il riepilogo di un kit per le pagine dei punti vendita.
 *
 * Un box è un gruppo di referenze con lo stesso codice box, la stessa pagina e la stessa posizione:
 * la prima è la pilota. Le referenze compilate a mano su un box dello storico portano la posizione
 * solo sulla prima: le altre, senza geometria, vanno nel box con lo stesso codice nella stessa pagina.
 * Una referenza senza posizione che non ha un box così resta un box a sé.
 * Istanta usa lo stesso codice ("BOX1") per box diversi: per questo conta anche la posizione.
 *
 * Il riepilogo è ciò che le pagine del punto vendita leggono di ogni kit: si salva in analisi_kit e
 * si ricalcola quando cambiano le referenze del kit o la formula (VERSIONE_ANALISI_KIT). Sta in due
 * colonne, perché la scheda di un PV con centinaia di volantini non deve muovere i prodotti di tutti:
 * - dati (DatiAnalisiKit): gli aggregati, che la scheda legge, e le marche e i prodotti in forma
 *   compatta (tuple, senza testi oltre alla chiave), che si aggregano in SQL;
 * - descrizioni (DescrizioniKit): nome, marca, formato e foto di ogni prodotto, letti solo per
 *   i pochi prodotti da mostrare.
 * Funzioni pure.
 */

/** Da aumentare a ogni cambio della lettura delle referenze o del riepilogo: i riepiloghi salvati si ricalcolano. */
export const VERSIONE_ANALISI_KIT = 2;

export interface BoxKit {
  /** L'id della referenza pilota. */
  id: string;
  codiceBox: string;
  pagina: number | null;
  geometria: GeometriaReferenza | null;
  meccanica: MeccanicaReferenza | null;
  reparto: string | null;
  sconto: number | null;
  /** Le referenze (righe) del box: la prima è la pilota. */
  referenze: ReferenzaStampata[];
  /** I prodotti del box senza doppioni, pilota per primo. */
  prodotti: ProdottoStampato[];
}

/**
 * Un prodotto del kit, una volta sola anche se compare in più box, in forma compatta:
 * [chiave, prezzo, barrato, sottocosto (0/1), meccanica (indice in MECCANICHE, o null), pagina,
 * spazio del box (0–100), con foto (0/1)]. Le posizioni sono quelle lette dall'SQL di analisi_kit.
 */
export type ProdottoCompatto = [string, number | null, number | null, 0 | 1, number | null, number | null, number | null, 0 | 1];

/** Una marca del kit: [chiave normalizzata, nome come stampato, referenze]. */
export type MarcaCompatta = [string, string, number];

/** La descrizione di un prodotto: [nome, marca, formato, guid Olimpo della prima foto]. */
export type DescrizioneCompatta = [string, string | null, string | null, string | null];

/** Gli aggregati del kit: quello che la scheda del PV legge di ogni volantino. */
export interface AggregatiKit {
  /** Referenze (righe) del kit. */
  referenze: number;
  /** La pagina più alta con una referenza. */
  pagine: number;
  /** Somma e numero degli sconti delle referenze che ne hanno uno. */
  sconto: { somma: number; referenze: number };
  fidelity: number;
  /** Per meccanica: referenze, e spazio dei box (somma delle percentuali di pagina). */
  meccaniche: Array<{ meccanica: MeccanicaReferenza; referenze: number; spazio: number }>;
  /** Per reparto: spazio dei box (somma delle percentuali di pagina). */
  reparti: Array<{ reparto: string; spazio: number }>;
  /** Quante referenze hanno codice, reparto, prezzo e marca. */
  copertura: { conCodice: number; conReparto: number; conPrezzo: number; conMarca: number };
}

/** La colonna dati di analisi_kit. */
export interface DatiAnalisiKit extends AggregatiKit {
  marche: MarcaCompatta[];
  prodotti: ProdottoCompatto[];
}

/** La colonna descrizioni di analisi_kit: per chiave del prodotto. */
export type DescrizioniKit = Record<string, DescrizioneCompatta>;

export interface RiepilogoKit {
  dati: DatiAnalisiKit;
  descrizioni: DescrizioniKit;
}

/** Un prodotto del kit letto dalla forma compatta. */
export interface ProdottoNelKit {
  chiave: string;
  prezzo: number | null;
  barrato: number | null;
  sottocosto: boolean;
  meccanica: MeccanicaReferenza | null;
  pagina: number | null;
  /** Spazio del box nella pagina, 0–100. */
  spazio: number | null;
  conFoto: boolean;
}

export interface DescrizioneProdotto {
  nome: string;
  marca: string | null;
  formato: string | null;
  foto: string | null;
}

export const prodottoDaCompatto = (tupla: ProdottoCompatto): ProdottoNelKit => ({
  chiave: tupla[0],
  prezzo: tupla[1] ?? null,
  barrato: tupla[2] ?? null,
  sottocosto: tupla[3] === 1,
  meccanica: tupla[4] === null || tupla[4] === undefined ? null : MECCANICHE[tupla[4]] ?? null,
  pagina: tupla[5] ?? null,
  spazio: tupla[6] ?? null,
  conFoto: tupla[7] === 1,
});

export const descrizioneDaCompatta = (descrizione: DescrizioneCompatta): DescrizioneProdotto => ({
  nome: descrizione[0],
  marca: descrizione[1] ?? null,
  formato: descrizione[2] ?? null,
  foto: descrizione[3] ?? null,
});

/** Gli aggregati, senza marche e prodotti. */
export function aggregatiDi(dati: AggregatiKit): AggregatiKit {
  const { referenze, pagine, sconto, fidelity, meccaniche, reparti, copertura } = dati;
  return { referenze, pagine, sconto, fidelity, meccaniche, reparti, copertura };
}

const arrotonda = (valore: number, cifre = 2): number => {
  const fattore = 10 ** cifre;
  return Math.round(valore * fattore) / fattore;
};

const chiaveMarca = (marca: string): string =>
  marca.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const chiaveGeometria = (geometria: GeometriaReferenza): string =>
  [geometria.x, geometria.y, geometria.w, geometria.h].map(valore => valore.toFixed(4)).join('|');

/** In ordine di pagina, dall'alto e da sinistra; i box senza posizione in fondo alla loro pagina. */
const ordineBox = (a: BoxKit, b: BoxKit): number =>
  (a.pagina ?? Number.MAX_SAFE_INTEGER) - (b.pagina ?? Number.MAX_SAFE_INTEGER)
  || (a.geometria ? 0 : 1) - (b.geometria ? 0 : 1)
  || (a.geometria?.y ?? 0) - (b.geometria?.y ?? 0)
  || (a.geometria?.x ?? 0) - (b.geometria?.x ?? 0);

/** I box del kit dalle sue referenze, nell'ordine in cui arrivano (la prima di un box è la pilota). */
export function boxDelKit(referenze: readonly ReferenzaStampata[]): BoxKit[] {
  const perPosizione = new Map<string, ReferenzaStampata[]>();
  const conPosizionePerCodice = new Map<string, string>();
  const senzaPosizione: Array<{ referenza: ReferenzaStampata; base: string }> = [];
  const ordine = new Map(referenze.map((referenza, indice) => [referenza, indice] as const));

  for (const referenza of referenze) {
    const base = `${referenza.codiceBox}|${referenza.pagina ?? ''}`;
    if (!referenza.geometria) {
      senzaPosizione.push({ referenza, base });
      continue;
    }
    const chiave = `${base}|${chiaveGeometria(referenza.geometria)}`;
    perPosizione.set(chiave, [...(perPosizione.get(chiave) ?? []), referenza]);
    if (!conPosizionePerCodice.has(base)) conPosizionePerCodice.set(base, chiave);
  }
  // Senza posizione: nel box con lo stesso codice nella stessa pagina, se c'è; altrimenti un box a sé
  // (Istanta usa lo stesso codice per box diversi: senza posizione non si può dire quali stanno insieme)
  for (const { referenza, base } of senzaPosizione) {
    const chiave = conPosizionePerCodice.get(base) ?? `${base}|#${referenza.id}`;
    perPosizione.set(chiave, [...(perPosizione.get(chiave) ?? []), referenza]);
  }

  return [...perPosizione.values()].map((righe) => {
    const ordinate = [...righe].sort((a, b) => (ordine.get(a) ?? 0) - (ordine.get(b) ?? 0));
    const pilota = ordinate[0];
    const prodotti: ProdottoStampato[] = [];
    for (const referenza of ordinate) {
      for (const prodotto of referenza.prodotti) {
        if (!prodotti.some(presente => presente.chiave === prodotto.chiave)) prodotti.push(prodotto);
      }
    }
    return {
      id: pilota.id,
      codiceBox: pilota.codiceBox,
      pagina: pilota.pagina,
      geometria: ordinate.find(referenza => referenza.geometria)?.geometria ?? null,
      meccanica: ordinate.find(referenza => referenza.meccanica)?.meccanica ?? null,
      reparto: ordinate.find(referenza => referenza.reparto)?.reparto ?? null,
      sconto: pilota.sconto ?? ordinate.find(referenza => referenza.sconto !== null)?.sconto ?? null,
      referenze: ordinate,
      prodotti,
    };
  }).sort(ordineBox);
}

/** Il riepilogo del kit dalle sue referenze (e dai suoi box, se già calcolati). */
export function riassumiKit(referenze: readonly ReferenzaStampata[], box: readonly BoxKit[] = boxDelKit(referenze)): RiepilogoKit {
  const meccaniche = new Map<MeccanicaReferenza, { referenze: number; spazio: number }>();
  const marche = new Map<string, { marca: string; referenze: number }>();
  const reparti = new Map<string, number>();
  const prodotti = new Map<string, ProdottoCompatto>();
  const descrizioni: DescrizioniKit = {};
  const sconto = { somma: 0, referenze: 0 };
  const copertura = { conCodice: 0, conReparto: 0, conPrezzo: 0, conMarca: 0 };
  let fidelity = 0;
  let pagine = 0;

  const perMeccanica = (meccanica: MeccanicaReferenza) => {
    const voce = meccaniche.get(meccanica) ?? { referenze: 0, spazio: 0 };
    meccaniche.set(meccanica, voce);
    return voce;
  };

  for (const referenza of referenze) {
    pagine = Math.max(pagine, referenza.pagina ?? 0);
    if (referenza.sconto !== null) {
      sconto.somma += referenza.sconto;
      sconto.referenze += 1;
    }
    if (referenza.meccanica) perMeccanica(referenza.meccanica).referenze += 1;
    if (referenza.meccanica === 'fidelity') fidelity += 1;
    if (referenza.marca) {
      const chiave = chiaveMarca(referenza.marca);
      const voce = marche.get(chiave) ?? { marca: referenza.marca, referenze: 0 };
      voce.referenze += 1;
      marche.set(chiave, voce);
    }
    if (referenza.codice) copertura.conCodice += 1;
    if (referenza.reparto) copertura.conReparto += 1;
    if (referenza.prezzo !== null) copertura.conPrezzo += 1;
    if (referenza.marca) copertura.conMarca += 1;
  }

  for (const singolo of box) {
    const spazio = singolo.geometria?.spazio ?? null;
    if (spazio !== null && singolo.meccanica) perMeccanica(singolo.meccanica).spazio += spazio;
    if (spazio !== null && singolo.reparto) reparti.set(singolo.reparto, (reparti.get(singolo.reparto) ?? 0) + spazio);
    for (const prodotto of singolo.prodotti) {
      if (prodotti.has(prodotto.chiave)) continue;
      const meccanica = prodotto.meccanica ?? singolo.meccanica;
      const foto = prodotto.foto[0] ?? null;
      prodotti.set(prodotto.chiave, [
        prodotto.chiave,
        prodotto.prezzo,
        prodotto.barrato,
        prodotto.sottocosto ? 1 : 0,
        meccanica ? MECCANICHE.indexOf(meccanica) : null,
        singolo.pagina,
        spazio,
        foto ? 1 : 0,
      ]);
      descrizioni[prodotto.chiave] = [prodotto.nome, prodotto.marca, prodotto.formato, foto];
    }
  }

  return {
    dati: {
      referenze: referenze.length,
      pagine,
      sconto: { somma: arrotonda(sconto.somma), referenze: sconto.referenze },
      fidelity,
      meccaniche: MECCANICHE
        .filter(meccanica => meccaniche.has(meccanica))
        .map(meccanica => {
          const voce = meccaniche.get(meccanica) as { referenze: number; spazio: number };
          return { meccanica, referenze: voce.referenze, spazio: arrotonda(voce.spazio) };
        }),
      reparti: [...reparti.entries()]
        .map(([reparto, spazio]) => ({ reparto, spazio: arrotonda(spazio) }))
        .sort((a, b) => b.spazio - a.spazio || a.reparto.localeCompare(b.reparto)),
      copertura,
      marche: [...marche.entries()]
        .map(([chiave, voce]): MarcaCompatta => [chiave, voce.marca, voce.referenze])
        .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0])),
      prodotti: [...prodotti.values()],
    },
    descrizioni,
  };
}

/** Gli aggregati di un kit senza referenze. */
export const AGGREGATI_VUOTI: AggregatiKit = Object.freeze({
  referenze: 0,
  pagine: 0,
  sconto: { somma: 0, referenze: 0 },
  fidelity: 0,
  meccaniche: [],
  reparti: [],
  copertura: { conCodice: 0, conReparto: 0, conPrezzo: 0, conMarca: 0 },
}) as AggregatiKit;
