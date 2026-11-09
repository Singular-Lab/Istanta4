/**
 * Testi e formati del report PDF del volantino. Funzioni pure.
 */

const DATA_ESTESA = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

/** "9 novembre 2026" da una data ISO; stringa vuota se la data non e' valida. */
export function dataEstesa(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : DATA_ESTESA.format(data);
}

/** Numero della sezione a due cifre: "01", "02"... */
export const numeroSezione = (indice: number): string => String(indice + 1).padStart(2, "0");

/** Un pezzo di frase: i numeri vanno in grassetto. */
export interface SegmentoFrase {
  testo: string;
  grassetto: boolean;
}

/**
 * Numero con il suo segno e l'unita' attaccata: "42%", "1.250", "-3,5%", "12,90 €", "€ 4". Il gruppo
 * 1 e' il carattere che lo precede, che non deve essere una lettera o una cifra (Edro21 resta testo).
 */
const NUMERO = /(^|[^A-Za-zÀ-ÖØ-öø-ÿ0-9])((?:€\s?)?[+\-−]?\d+(?:[.,]\d+)*(?:\s?[%€])?)/g;

/** Unisce i pezzi vicini con lo stesso peso e toglie quelli vuoti. */
function compatta(segmenti: SegmentoFrase[]): SegmentoFrase[] {
  const risultato: SegmentoFrase[] = [];
  for (const segmento of segmenti) {
    if (!segmento.testo) continue;
    const ultimo = risultato[risultato.length - 1];
    if (ultimo && ultimo.grassetto === segmento.grassetto) ultimo.testo += segmento.testo;
    else risultato.push({ ...segmento });
  }
  return risultato;
}

/**
 * Pezzi di una frase chiave della sintesi. Se la frase marca le parti in evidenza con **...**,
 * valgono quelle; altrimenti vanno in grassetto i numeri, con il segno e l'unita'.
 */
export function segmentiFrase(frase: string): SegmentoFrase[] {
  if (frase.includes("**")) {
    return compatta(frase.split("**").map((testo, indice) => ({ testo, grassetto: indice % 2 === 1 })));
  }
  const segmenti: SegmentoFrase[] = [];
  let posizione = 0;
  NUMERO.lastIndex = 0;
  for (let trovato = NUMERO.exec(frase); trovato; trovato = NUMERO.exec(frase)) {
    const inizio = trovato.index + trovato[1].length;
    segmenti.push({ testo: frase.slice(posizione, inizio), grassetto: false });
    segmenti.push({ testo: trovato[2], grassetto: true });
    posizione = inizio + trovato[2].length;
  }
  segmenti.push({ testo: frase.slice(posizione), grassetto: false });
  return compatta(segmenti);
}

const QUOTA = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** Quota in % di un valore sul totale, all'italiana: "12,5%"; "—" senza totale. */
export function testoQuota(valore: number, totale: number): string {
  if (!(totale > 0)) return "—";
  return `${QUOTA.format((Math.max(0, valore) / totale) * 100)}%`;
}
