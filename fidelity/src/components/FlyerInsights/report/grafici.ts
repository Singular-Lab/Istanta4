import type { PaletteReport, VoceGrafico } from "../../../../lib/insightVolantino/report";

/**
 * Calcoli dei grafici del report PDF: scala degli assi, righe che entrano nello spazio, fette della
 * ciambella e loro tracciato. Funzioni pure.
 */

export interface ScalaAsse {
  /** Fine dell'asse: un valore "tondo" >= del massimo dei dati. */
  massimo: number;
  /** Tacche da 0 a massimo, a passo costante. */
  tacche: number[];
}

/**
 * Scala di un asse da 0 con passi "tondi" (1, 2, 2,5, 5 per una potenza di 10), circa `passi`
 * intervalli. Senza valori positivi l'asse va da 0 a 1.
 */
export function scalaAsse(valoreMassimo: number, passi = 4): ScalaAsse {
  if (!(valoreMassimo > 0) || !Number.isFinite(valoreMassimo)) return { massimo: 1, tacche: [0, 1] };
  const grezzo = valoreMassimo / Math.max(1, passi);
  const potenza = 10 ** Math.floor(Math.log10(grezzo));
  const frazione = grezzo / potenza;
  const passo = (frazione <= 1 ? 1 : frazione <= 2 ? 2 : frazione <= 2.5 ? 2.5 : frazione <= 5 ? 5 : 10) * potenza;
  const intervalli = Math.max(1, Math.ceil(valoreMassimo / passo - 1e-9));
  const tacche = Array.from({ length: intervalli + 1 }, (_, indice) => Number((indice * passo).toPrecision(12)));
  return { massimo: tacche[tacche.length - 1], tacche };
}

/** Lunghezza di una barra in punti: 0 per valori negativi o non numerici, mai oltre la traccia. */
export function lunghezzaBarra(valore: number, massimoScala: number, traccia: number): number {
  if (!(valore > 0) || !(massimoScala > 0)) return 0;
  return Math.min(traccia, (valore / massimoScala) * traccia);
}

export interface RigheGrafico<T> {
  visibili: T[];
  /** Voci che non entrano: il grafico lo dichiara in nota. */
  nascoste: number;
  /** Altezza di ogni riga, in pt. */
  altezzaRiga: number;
}

/**
 * Quante righe entrano nello spazio del grafico e con che altezza: fra `minima` e `massima` pt per
 * riga; quelle che non entrano restano fuori (nell'ordine ricevuto, le ultime).
 */
export function righeNelloSpazio<T>(voci: readonly T[], altezzaDisponibile: number, minima = 12, massima = 20): RigheGrafico<T> {
  const capienza = Math.max(1, Math.floor(altezzaDisponibile / minima));
  const visibili = voci.slice(0, capienza);
  const altezzaRiga = visibili.length > 0 ? Math.min(massima, Math.max(minima, altezzaDisponibile / visibili.length)) : massima;
  return { visibili, nascoste: voci.length - visibili.length, altezzaRiga };
}

// ─── Ciambella ──────────────────────────────────────────────────────

export interface FettaCiambella {
  etichetta: string;
  valore: number;
  /** Valore come lo scrive il server; vuoto per la fetta che raggruppa le altre. */
  testo: string;
  colore: string;
  /** 0-1 sul totale. */
  quota: number;
  /** Angoli in gradi, 0 = ore 12, in senso orario. */
  inizio: number;
  fine: number;
  altre: boolean;
}

/** Colore di una categoria: quelli della palette in ordine, poi di nuovo dal primo. */
export const coloreCategoria = (palette: PaletteReport, indice: number): string =>
  palette.categorie.length > 0 ? palette.categorie[indice % palette.categorie.length] : palette.primario;

/**
 * Fette della ciambella: al massimo `massimo` voci (le piu' grandi restano nell'ordine ricevuto),
 * le altre in un'unica fetta "Altre N voci" del colore tenue. Valori negativi contano zero.
 */
export function fetteCiambella(voci: readonly VoceGrafico[], palette: PaletteReport, massimo = 7): FettaCiambella[] {
  const positive = voci.map((voce, indice) => ({ voce, indice, valore: Math.max(0, voce.valore) }));
  const totale = positive.reduce((somma, voce) => somma + voce.valore, 0);
  if (!(totale > 0)) return [];

  let tenute = positive;
  let altre = 0;
  let quanteAltre = 0;
  if (positive.length > massimo) {
    const maggiori = new Set(
      [...positive]
        .sort((a, b) => b.valore - a.valore || a.indice - b.indice)
        .slice(0, massimo - 1)
        .map((voce) => voce.indice)
    );
    tenute = positive.filter((voce) => maggiori.has(voce.indice));
    for (const voce of positive) {
      if (maggiori.has(voce.indice)) continue;
      altre += voce.valore;
      quanteAltre += 1;
    }
  }

  const fette: FettaCiambella[] = [];
  let angolo = 0;
  const aggiungi = (etichetta: string, valore: number, testo: string, colore: string, raggruppa: boolean) => {
    const quota = valore / totale;
    const fine = angolo + quota * 360;
    fette.push({ etichetta, valore, testo, colore, quota, inizio: angolo, fine, altre: raggruppa });
    angolo = fine;
  };
  tenute.forEach(({ voce, valore }, posizione) =>
    aggiungi(voce.etichetta, valore, voce.testo, voce.colore ?? coloreCategoria(palette, posizione), false)
  );
  if (quanteAltre > 0) aggiungi(`Altre ${quanteAltre} voci`, altre, "", palette.linee, true);
  return fette;
}

const punto = (cx: number, cy: number, raggio: number, gradi: number) => {
  const radianti = ((gradi - 90) * Math.PI) / 180;
  return { x: cx + raggio * Math.cos(radianti), y: cy + raggio * Math.sin(radianti) };
};

const cifre = (valore: number): string => String(Number(valore.toFixed(3)));

/**
 * Tracciato SVG di un settore di corona circolare fra due angoli (gradi, 0 = ore 12, orario).
 * Un settore di 360 gradi si disegna in due meta', perche' un arco con estremi uguali non si vede.
 */
export function settoreAnulare(cx: number, cy: number, esterno: number, interno: number, inizio: number, fine: number): string {
  const ampiezza = Math.max(0, fine - inizio);
  if (ampiezza <= 0) return "";
  if (ampiezza >= 359.999) {
    const meta = inizio + 180;
    return `${settoreAnulare(cx, cy, esterno, interno, inizio, meta)} ${settoreAnulare(cx, cy, esterno, interno, meta, inizio + 360)}`;
  }
  const grande = ampiezza > 180 ? 1 : 0;
  const a = punto(cx, cy, esterno, inizio);
  const b = punto(cx, cy, esterno, fine);
  const c = punto(cx, cy, interno, fine);
  const d = punto(cx, cy, interno, inizio);
  return [
    `M${cifre(a.x)} ${cifre(a.y)}`,
    `A${cifre(esterno)} ${cifre(esterno)} 0 ${grande} 1 ${cifre(b.x)} ${cifre(b.y)}`,
    `L${cifre(c.x)} ${cifre(c.y)}`,
    `A${cifre(interno)} ${cifre(interno)} 0 ${grande} 0 ${cifre(d.x)} ${cifre(d.y)}`,
    "Z",
  ].join(" ");
}

/** Colori delle due serie del confronto: il primario e una categoria chiara ben distinta. */
export function coloriConfronto(palette: PaletteReport): [string, string] {
  const secondo = palette.categorie.find((colore, indice) => indice >= 2 && colore !== palette.primario)
    ?? palette.categorie.find((colore) => colore !== palette.primario)
    ?? palette.inchiostroTenue;
  return [palette.primario, secondo];
}
