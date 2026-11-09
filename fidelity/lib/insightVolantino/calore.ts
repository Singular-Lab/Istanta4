import type { PrevisioneVolantino, RendimentoVolantino } from './rendimento';
import type { BoxInsight, GeometriaPagina } from './tipi';

/**
 * Mappa di calore continua sulle pagine del volantino (spec insight-volantino), a schermo e nel
 * report PDF. Funzioni pure, senza DOM: il client mette il risultato di coloraDensita in un
 * ImageData e lo disegna, scalato e sfumato, sopra l'immagine della pagina.
 *
 * Ogni box dipinge la sua area reale con il valore della misura; una sfocatura gaussiana rende la
 * mappa continua; i valori si normalizzano sul massimo di tutto il volantino, cosi' le pagine
 * restano confrontabili fra loro.
 */

export type MisuraCalore =
  | 'investimento'
  | 'sconto'
  | 'spazio'
  | 'visibilita'
  | 'vendite'
  | 'venditePerSpazio'
  | 'previsione';

export type UnitaMisura = 'percentuale' | 'euro' | 'pezzi' | 'indice';

export interface DescrizioneMisura {
  etichetta: string;
  unita: UnitaMisura;
  descrizione: string;
}

export const MISURE_CALORE: Record<MisuraCalore, DescrizioneMisura> = {
  investimento: {
    etichetta: 'Investimento promozionale',
    unita: 'indice',
    descrizione: 'Spazio del box per profondità dello sconto: dove il volantino concentra la spinta promozionale.',
  },
  sconto: { etichetta: 'Sconto', unita: 'percentuale', descrizione: 'Sconto del box rispetto al prezzo pieno.' },
  spazio: { etichetta: 'Spazio', unita: 'percentuale', descrizione: 'Spazio occupato dal box in percentuale della pagina.' },
  visibilita: {
    etichetta: 'Visibilità',
    unita: 'indice',
    descrizione: 'Visibilità stimata da spazio, pagina e posizione, con i pesi del cliente.',
  },
  vendite: { etichetta: 'Vendite', unita: 'euro', descrizione: 'Vendite dei prodotti del box nel periodo della promo.' },
  venditePerSpazio: {
    etichetta: 'Vendite per spazio',
    unita: 'indice',
    descrizione: 'Quota delle vendite divisa per quota dello spazio: sopra 1 il box rende più dello spazio che occupa.',
  },
  previsione: { etichetta: 'Previsione', unita: 'pezzi', descrizione: 'Valore previsto dallo storico della stessa area e canale.' },
};

/** Ordine in cui proporre le misure. */
export const ORDINE_MISURE: readonly MisuraCalore[] = [
  'investimento',
  'sconto',
  'spazio',
  'visibilita',
  'vendite',
  'venditePerSpazio',
  'previsione',
];

export interface DatiMisure {
  rendimento?: RendimentoVolantino | null;
  previsione?: PrevisioneVolantino | null;
}

/** Unita' effettiva: vendite in pezzi quando il file non porta il valore, previsione teorica in indice. */
export function unitaMisura(misura: MisuraCalore, dati: DatiMisure = {}): UnitaMisura {
  if (misura === 'vendite') return dati.rendimento?.misura === 'pezzi' ? 'pezzi' : 'euro';
  if (misura === 'previsione') return dati.previsione?.unita === 'indice' ? 'indice' : 'pezzi';
  return MISURE_CALORE[misura].unita;
}

/** Valore di ogni box con geometria per la misura, nell'unita' della misura; i box senza dato mancano. */
export function valoriPerBox(misura: MisuraCalore, box: readonly BoxInsight[], dati: DatiMisure = {}): Map<string, number> {
  const valori = new Map<string, number>();
  const conGeometria = box.filter((voce) => voce.geometria && voce.pagina !== null);
  if (misura === 'vendite' || misura === 'venditePerSpazio') {
    const perBox = new Map((dati.rendimento?.perBox ?? []).map((voce) => [voce.idBox, voce]));
    for (const voce of conGeometria) {
      const rendimento = perBox.get(voce.id);
      if (!rendimento) continue;
      if (misura === 'vendite') {
        const valore = dati.rendimento?.misura === 'pezzi' ? rendimento.pezzi : rendimento.valore;
        if (valore !== null) valori.set(voce.id, valore);
      } else if (rendimento.indiceSpazio !== null) {
        valori.set(voce.id, rendimento.indiceSpazio);
      }
    }
    return valori;
  }
  if (misura === 'previsione') {
    const perBox = new Map((dati.previsione?.perBox ?? []).map((voce) => [voce.idBox, voce.valore]));
    for (const voce of conGeometria) {
      const valore = perBox.get(voce.id);
      if (valore !== undefined) valori.set(voce.id, valore);
    }
    return valori;
  }
  for (const voce of conGeometria) {
    const sconto = voce.sconto ?? 0;
    if (misura === 'sconto') valori.set(voce.id, sconto);
    else if (misura === 'spazio') valori.set(voce.id, voce.spazio);
    else if (misura === 'visibilita') valori.set(voce.id, voce.visibilita);
    else valori.set(voce.id, (voce.spazio * sconto) / 100);
  }
  return valori;
}

/** Le misure con almeno un valore maggiore di zero per questo volantino, nell'ordine di ORDINE_MISURE. */
export function misureDisponibili(box: readonly BoxInsight[], dati: DatiMisure = {}): MisuraCalore[] {
  return ORDINE_MISURE.filter((misura) => {
    for (const valore of valoriPerBox(misura, box, dati).values()) if (valore > 0) return true;
    return false;
  });
}

// ─── Densita' ───────────────────────────────────────────────────────

export interface ElementoCalore {
  geometria: GeometriaPagina;
  valore: number;
}

export interface OpzioniDensita {
  /** Colonne della griglia; le righe si ricavano dalla proporzione per avere celle quadrate. */
  colonne: number;
  /** Larghezza/altezza della pagina. */
  proporzione: number;
  /** Raggio della sfocatura in frazione della larghezza della pagina (default 0.035). */
  sigma?: number;
}

export interface DensitaPagina {
  colonne: number;
  righe: number;
  /** righe × colonne, per righe, valori 0-1 rispetto al massimo del volantino. */
  valori: Float32Array;
}

export const righePerProporzione = (colonne: number, proporzione: number): number =>
  Math.max(1, Math.round(colonne / (proporzione > 0 ? proporzione : 0.7)));

function dipingi(elementi: readonly ElementoCalore[], colonne: number, righe: number): Float32Array {
  const griglia = new Float32Array(colonne * righe);
  for (const { geometria, valore } of elementi) {
    if (!(valore > 0)) continue;
    const c0 = Math.max(0, Math.floor(geometria.x * colonne));
    const c1 = Math.min(colonne - 1, Math.ceil((geometria.x + geometria.w) * colonne) - 1);
    const r0 = Math.max(0, Math.floor(geometria.y * righe));
    const r1 = Math.min(righe - 1, Math.ceil((geometria.y + geometria.h) * righe) - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const indice = r * colonne + c;
        if (valore > griglia[indice]) griglia[indice] = valore;
      }
    }
  }
  return griglia;
}

function nucleoGaussiano(sigmaCelle: number): Float32Array {
  const raggio = Math.max(1, Math.ceil(sigmaCelle * 3));
  const nucleo = new Float32Array(raggio * 2 + 1);
  let somma = 0;
  for (let i = -raggio; i <= raggio; i++) {
    const peso = Math.exp(-(i * i) / (2 * sigmaCelle * sigmaCelle));
    nucleo[i + raggio] = peso;
    somma += peso;
  }
  for (let i = 0; i < nucleo.length; i++) nucleo[i] /= somma;
  return nucleo;
}

function sfoca(griglia: Float32Array, colonne: number, righe: number, sigmaCelle: number): Float32Array {
  if (sigmaCelle <= 0) return griglia;
  const nucleo = nucleoGaussiano(sigmaCelle);
  const raggio = (nucleo.length - 1) / 2;
  const orizzontale = new Float32Array(griglia.length);
  for (let r = 0; r < righe; r++) {
    for (let c = 0; c < colonne; c++) {
      let somma = 0;
      for (let k = -raggio; k <= raggio; k++) {
        const cc = Math.min(colonne - 1, Math.max(0, c + k));
        somma += griglia[r * colonne + cc] * nucleo[k + raggio];
      }
      orizzontale[r * colonne + c] = somma;
    }
  }
  const risultato = new Float32Array(griglia.length);
  for (let r = 0; r < righe; r++) {
    for (let c = 0; c < colonne; c++) {
      let somma = 0;
      for (let k = -raggio; k <= raggio; k++) {
        const rr = Math.min(righe - 1, Math.max(0, r + k));
        somma += orizzontale[rr * colonne + c] * nucleo[k + raggio];
      }
      risultato[r * colonne + c] = somma;
    }
  }
  return risultato;
}

/**
 * Densita' di tutte le pagine del volantino, normalizzate sul valore piu' alto dopo la sfocatura:
 * 1 = il punto piu' caldo del volantino. Le pagine senza elementi mancano dalla mappa.
 */
export function densitaVolantino(
  pagine: ReadonlyMap<number, readonly ElementoCalore[]>,
  opzioni: OpzioniDensita
): Map<number, DensitaPagina> {
  const colonne = Math.max(1, Math.round(opzioni.colonne));
  const righe = righePerProporzione(colonne, opzioni.proporzione);
  const sigmaCelle = (opzioni.sigma ?? 0.035) * colonne;
  const grezze = new Map<number, Float32Array>();
  let massimo = 0;
  for (const [pagina, elementi] of pagine) {
    if (elementi.length === 0) continue;
    const valori = sfoca(dipingi(elementi, colonne, righe), colonne, righe, sigmaCelle);
    for (const valore of valori) if (valore > massimo) massimo = valore;
    grezze.set(pagina, valori);
  }
  const risultato = new Map<number, DensitaPagina>();
  for (const [pagina, valori] of grezze) {
    if (massimo > 0) for (let i = 0; i < valori.length; i++) valori[i] = Math.min(1, valori[i] / massimo);
    risultato.set(pagina, { colonne, righe, valori });
  }
  return risultato;
}

/** Elementi per pagina dai box e dai valori di valoriPerBox. */
export function elementiPerPagina(box: readonly BoxInsight[], valori: ReadonlyMap<string, number>): Map<number, ElementoCalore[]> {
  const pagine = new Map<number, ElementoCalore[]>();
  for (const voce of box) {
    const valore = valori.get(voce.id);
    if (valore === undefined || !voce.geometria || voce.pagina === null) continue;
    const elenco = pagine.get(voce.pagina) ?? [];
    elenco.push({ geometria: voce.geometria, valore });
    pagine.set(voce.pagina, elenco);
  }
  return pagine;
}

// ─── Colori ─────────────────────────────────────────────────────────

/** Scala sequenziale standard, dal freddo al caldo (gialli e arancioni fino al rosso scuro). */
export const SCALA_CALORE_STANDARD: readonly string[] = ['#fff3b0', '#fdc94f', '#f98b2c', '#d9481f', '#8f1d14'];

/** Sotto questa intensita' la cella resta trasparente: la pagina si legge dove non c'e' calore. */
export const SOGLIA_TRASPARENZA = 0.04;

function rgbDaEsadecimale(colore: string): [number, number, number] {
  const pulito = colore.replace('#', '');
  const pieno = pulito.length === 3 ? pulito.split('').map((c) => c + c).join('') : pulito;
  const numero = Number.parseInt(pieno.slice(0, 6), 16);
  return [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255];
}

/** Colore della scala per t in 0-1, interpolato fra le tappe. */
export function coloreInScala(t: number, tappe: readonly string[] = SCALA_CALORE_STANDARD): [number, number, number] {
  if (tappe.length === 0) return [0, 0, 0];
  const limitato = Math.min(1, Math.max(0, t));
  if (tappe.length === 1) return rgbDaEsadecimale(tappe[0]);
  const posizione = limitato * (tappe.length - 1);
  const indice = Math.min(tappe.length - 2, Math.floor(posizione));
  const frazione = posizione - indice;
  const a = rgbDaEsadecimale(tappe[indice]);
  const b = rgbDaEsadecimale(tappe[indice + 1]);
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * frazione)) as [number, number, number];
}

export const esadecimaleDaRgb = ([r, g, b]: readonly [number, number, number]): string =>
  `#${[r, g, b].map((valore) => valore.toString(16).padStart(2, '0')).join('')}`;

/**
 * Pixel RGBA (colonne × righe × 4) della densita': trasparente sotto SOGLIA_TRASPARENZA, poi
 * opacita' crescente fino a `opacitaMassima` (0-1, default 0.72) sul punto piu' caldo.
 */
export function coloraDensita(
  densita: DensitaPagina,
  tappe: readonly string[] = SCALA_CALORE_STANDARD,
  opacitaMassima = 0.72
): Uint8ClampedArray {
  const pixel = new Uint8ClampedArray(densita.colonne * densita.righe * 4);
  for (let i = 0; i < densita.valori.length; i++) {
    const t = densita.valori[i];
    if (t < SOGLIA_TRASPARENZA) continue;
    const [r, g, b] = coloreInScala(t, tappe);
    const opacita = 0.18 + (opacitaMassima - 0.18) * t;
    pixel[i * 4] = r;
    pixel[i * 4 + 1] = g;
    pixel[i * 4 + 2] = b;
    pixel[i * 4 + 3] = Math.round(opacita * 255);
  }
  return pixel;
}

// ─── Legenda ────────────────────────────────────────────────────────

/** Separatore delle migliaia sempre presente: "1.234", non "1234" come farebbe it-IT da solo. */
const formatoNumero = (decimali: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: decimali, useGrouping: true });

/** Valore scritto nell'unita' della misura, all'italiana. */
export function formattaValore(valore: number, unita: UnitaMisura): string {
  if (unita === 'percentuale') return `${formatoNumero(valore < 10 ? 1 : 0).format(valore)}%`;
  if (unita === 'euro') return `${formatoNumero(valore < 100 ? 2 : 0).format(valore)} €`;
  if (unita === 'pezzi') return formatoNumero(0).format(Math.round(valore));
  return formatoNumero(valore < 10 ? 2 : 1).format(valore);
}

export interface VoceLegenda {
  /** Posizione sulla scala, 0-1. */
  t: number;
  valore: number;
  testo: string;
  colore: string;
}

/** Tappe della legenda da 0 al valore massimo, con il colore della scala e il testo nell'unita'. */
export function legendaCalore(
  massimo: number,
  unita: UnitaMisura,
  tappe: readonly string[] = SCALA_CALORE_STANDARD,
  passi = 5
): VoceLegenda[] {
  if (!(massimo > 0)) return [];
  const voci: VoceLegenda[] = [];
  for (let i = 0; i < passi; i++) {
    const t = passi === 1 ? 1 : i / (passi - 1);
    const valore = massimo * t;
    voci.push({ t, valore, testo: formattaValore(valore, unita), colore: esadecimaleDaRgb(coloreInScala(t, tappe)) });
  }
  return voci;
}
