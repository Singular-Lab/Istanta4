import { normalizzaCodiceProdotto, type RigaVendita } from '../../../lib/vendite/tipi';
import { normalizePuntoVenditaText } from '../utils/puntoVenditaNormalization';

/**
 * Lettura dei valori del file delle vendite, uguale per il tracciato generico e per quelli delle
 * librerie agenzia (che possono importarla da tracciatoGenerico.ts).
 *
 * Il file arriva con i valori grezzi (leggiFileVendite): numeri come numeri, date di Excel come
 * numero seriale, testo come testo; un CSV arriva tutto come testo.
 */

/** Riga del foglio: intestazione della colonna -> valore. */
export type RigaFileVendite = Record<string, unknown>;

/** Anni accettati in una data di vendita: fuori c'e' quasi sempre una colonna sbagliata. */
export const ANNO_MINIMO_VENDITE = 1990;
export const ANNO_MASSIMO_VENDITE = 2100;

/** Limiti delle colonne numeric(14,3) e numeric(14,2) di vendite_prodotti. */
export const MASSIMO_PEZZI = 1e11;
export const MASSIMO_VALORE = 1e12;

/** Lunghezza della colonna codice_prodotto. */
export const LUNGHEZZA_MASSIMA_CODICE = 100;

const GIORNO_MS = 86_400_000;
// Giorno zero dei numeri seriali di Excel (sistema 1900, che conta anche il 29/02/1900 inesistente)
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

/** Intestazione confrontabile: senza maiuscole, accenti, spazi e punteggiatura ("Punto vendita" = "punto_vendita"). */
export const normalizzaIntestazione = (intestazione: unknown): string => normalizePuntoVenditaText(intestazione).replace(/ /g, '');

/** Nome della colonna della riga con una delle intestazioni; undefined se il file non ha la colonna. */
export function colonnaVendite(riga: RigaFileVendite, ...intestazioni: string[]): string | undefined {
  const cercate = intestazioni.map(normalizzaIntestazione);
  return Object.keys(riga).find(chiave => cercate.includes(normalizzaIntestazione(chiave)));
}

/** Valore della colonna con una delle intestazioni; undefined se il file non ha la colonna. */
export function cellaVendite(riga: RigaFileVendite, ...intestazioni: string[]): unknown {
  const colonna = colonnaVendite(riga, ...intestazioni);
  return colonna === undefined ? undefined : riga[colonna];
}

/** Cella senza valore: assente, null o testo vuoto. */
export const cellaVuota = (valore: unknown): boolean =>
  valore === undefined || valore === null || (typeof valore === 'string' && valore.trim() === '');

/** Testo della cella, senza spazi ai lati; i numeri interi senza decimali ("1234", non "1234.0"). */
export function testoCella(valore: unknown): string {
  if (cellaVuota(valore)) return '';
  if (typeof valore === 'number' && Number.isFinite(valore)) return String(valore);
  if (valore instanceof Date) return Number.isNaN(valore.getTime()) ? '' : valore.toISOString();
  return String(valore).trim();
}

/** Il valore come appare nel motivo di uno scarto: corto e leggibile. */
export function mostraValore(valore: unknown): string {
  const testo = valore instanceof Date && !Number.isNaN(valore.getTime()) ? valore.toISOString().slice(0, 10) : testoCella(valore);
  return testo.length > 40 ? `${testo.slice(0, 40)}...` : testo;
}

const dueCifre = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD di un giorno che esiste davvero (niente 31/02) e in un anno plausibile; altrimenti null. */
function giornoIso(anno: number, mese: number, giorno: number): string | null {
  if (anno < ANNO_MINIMO_VENDITE || anno > ANNO_MASSIMO_VENDITE) return null;
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  if (data.getUTCFullYear() !== anno || data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) return null;
  return `${anno}-${dueCifre(mese)}-${dueCifre(giorno)}`;
}

const ISO = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/;
const ITALIANA = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:\s.*)?$/;
const COMPATTA = /^(\d{4})(\d{2})(\d{2})$/;

/**
 * Data di una vendita come YYYY-MM-DD, o null se non e' una data valida. Accetta:
 * - il numero seriale di Excel (la cella data letta grezza), o un numero AAAAMMGG (20260115);
 * - un Date: a mezzanotte UTC vale il giorno UTC, altrimenti quello locale (mezzanotte del fuso del
 *   server, o una data con l'ora);
 * - il testo "YYYY-MM-DD" (anche con l'ora dopo), "DD/MM/YYYY" o "DD/MM/YY" (anche con - o .),
 *   "AAAAMMGG". Le date col giorno dopo il mese (formato americano) non si riconoscono.
 */
export function leggiDataVendita(valore: unknown): string | null {
  if (valore instanceof Date) {
    if (Number.isNaN(valore.getTime())) return null;
    const mezzanotteUtc = valore.getUTCHours() === 0 && valore.getUTCMinutes() === 0 && valore.getUTCSeconds() === 0;
    return mezzanotteUtc
      ? giornoIso(valore.getUTCFullYear(), valore.getUTCMonth() + 1, valore.getUTCDate())
      : giornoIso(valore.getFullYear(), valore.getMonth() + 1, valore.getDate());
  }
  if (typeof valore === 'number') {
    if (!Number.isFinite(valore) || valore <= 0) return null;
    if (Number.isInteger(valore) && valore >= 10_000_000) return leggiDataVendita(String(valore));
    const data = new Date(EPOCA_EXCEL + Math.floor(valore) * GIORNO_MS);
    return giornoIso(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate());
  }
  if (typeof valore !== 'string') return null;
  const testo = valore.trim();
  let parti = ISO.exec(testo);
  if (parti) return giornoIso(Number(parti[1]), Number(parti[2]), Number(parti[3]));
  parti = ITALIANA.exec(testo);
  if (parti) {
    const anno = parti[3].length === 2 ? 2000 + Number(parti[3]) : Number(parti[3]);
    return giornoIso(anno, Number(parti[2]), Number(parti[1]));
  }
  parti = COMPATTA.exec(testo);
  if (parti) return giornoIso(Number(parti[1]), Number(parti[2]), Number(parti[3]));
  return null;
}

const NUMERO = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Numero della cella: null se la cella e' vuota, NaN se non e' un numero. Il testo puo' avere la
 * virgola decimale italiana ("12,5"), i separatori delle migliaia ("1.234,50", "1,234.50"), spazi e
 * il simbolo dell'euro. Con un solo separatore, la virgola o il punto e' quello decimale ("1.234" e'
 * 1,234), salvo che si ripeta ("1.234.567" sono le migliaia).
 */
export function numeroVendita(valore: unknown): number | null {
  if (cellaVuota(valore)) return null;
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : Number.NaN;
  if (typeof valore !== 'string') return Number.NaN;
  // \s comprende anche gli spazi non divisibili che Excel mette fra le migliaia
  let testo = valore.replace(/[\s€]/g, '');
  if (testo === '') return null;
  const virgole = (testo.match(/,/g) ?? []).length;
  const punti = (testo.match(/\./g) ?? []).length;
  if (virgole > 0 && punti > 0) {
    // L'ultimo dei due e' il decimale, l'altro separa le migliaia
    testo = testo.lastIndexOf(',') > testo.lastIndexOf('.') ? testo.replace(/\./g, '').replace(',', '.') : testo.replace(/,/g, '');
  } else if (virgole > 1) {
    testo = testo.replace(/,/g, '');
  } else if (virgole === 1) {
    testo = testo.replace(',', '.');
  } else if (punti > 1) {
    testo = testo.replace(/\./g, '');
  }
  return NUMERO.test(testo) ? Number(testo) : Number.NaN;
}

/**
 * Controlli di FP su una vendita letta da un tracciato qualsiasi (generico o della libreria agenzia):
 * la vendita normalizzata, o il motivo dello scarto. Il codice prodotto prende la forma di
 * normalizzaCodiceProdotto, come le referenze del volantino.
 */
export function validaRigaVendita(vendita: RigaVendita): RigaVendita | string {
  const codiceProdotto = normalizzaCodiceProdotto(vendita.codiceProdotto);
  if (!codiceProdotto) return 'Codice prodotto mancante';
  if (codiceProdotto.length > LUNGHEZZA_MASSIMA_CODICE) {
    return `Codice prodotto troppo lungo (oltre ${LUNGHEZZA_MASSIMA_CODICE} caratteri): ${mostraValore(codiceProdotto)}`;
  }
  const puntoVendita = testoCella(vendita.puntoVendita);
  if (!puntoVendita) return 'Punto vendita mancante';
  const dal = leggiDataVendita(vendita.dal);
  if (!dal) return `Periodo non valido: data di inizio "${mostraValore(vendita.dal)}" non riconosciuta`;
  const al = leggiDataVendita(vendita.al);
  if (!al) return `Periodo non valido: data di fine "${mostraValore(vendita.al)}" non riconosciuta`;
  if (dal > al) return `Periodo non valido: l'inizio (${dal}) e' dopo la fine (${al})`;
  if (typeof vendita.pezzi !== 'number' || !Number.isFinite(vendita.pezzi)) return `Pezzi non numerici: ${mostraValore(vendita.pezzi)}`;
  if (vendita.pezzi < 0) return `Pezzi negativi: ${vendita.pezzi}`;
  if (vendita.pezzi >= MASSIMO_PEZZI) return `Pezzi fuori scala: ${vendita.pezzi}`;
  const valore = vendita.valore ?? null;
  if (valore !== null) {
    if (typeof valore !== 'number' || !Number.isFinite(valore)) return `Valore non numerico: ${mostraValore(valore)}`;
    if (valore < 0) return `Valore negativo: ${valore}`;
    if (valore >= MASSIMO_VALORE) return `Valore fuori scala: ${valore}`;
  }
  return { codiceProdotto, puntoVendita, dal, al, pezzi: vendita.pezzi, valore };
}
