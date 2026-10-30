import { paletteColore } from "@/utils/chartTheme";

/**
 * Colori dei grafici SVG, dal sistema di Fidelity (chartTheme e token di Tailwind):
 * - una serie sola: il colore del tema (SERIE_PRINCIPALE), più chiaro nel tema scuro;
 * - categorie (insegne, meccaniche, reparti): la palette di chartTheme in ordine fisso, assegnata
 *   all'entità e mai alla sua posizione in classifica (indiciPerNome);
 * - grandezze (sconto, quote): una tinta sola dal chiaro allo scuro (PASSI_SEQUENZIALI).
 * Il testo non prende mai il colore della serie: usa CLASSI_TESTO.
 */

/** Come si colora un segno: un colore CSS da mettere in fill, oppure classi Tailwind che seguono il tema scuro. */
export interface Tinta {
  /** Colore CSS (palette categorica di chartTheme), per l'attributo fill o stroke. */
  colore?: string;
  /** Classi fill-* di Tailwind, con le varianti dark:. */
  classe?: string;
  /** Classi del testo scritto dentro la tinta: chiaro o scuro secondo la luminosità del fondo. */
  classeTesto: string;
}

/** Testi dei grafici: valori ed etichette usano sempre questi, mai il colore della serie. */
export const CLASSI_TESTO = {
  primario: "fill-slate-800 dark:fill-slate-100",
  secondario: "fill-slate-600 dark:fill-slate-300",
  tenue: "fill-slate-500 dark:fill-slate-400",
} as const;

/** Griglia e assi: linee sottili, un tono sopra la superficie. */
export const CLASSI_ASSI = {
  griglia: "stroke-slate-200 dark:stroke-darkmode-400",
  base: "stroke-slate-300 dark:stroke-darkmode-300",
  /** Anello del colore della superficie attorno a punti e marcatori. */
  anello: "stroke-white dark:stroke-darkmode-600",
  superficie: "fill-white dark:fill-darkmode-600",
} as const;

/** La serie di un grafico a una serie sola, e il dato in evidenza. */
export const SERIE_PRINCIPALE = {
  fill: "fill-theme-1 dark:fill-indigo-300",
  stroke: "stroke-theme-1 dark:stroke-indigo-300",
  /** Velo sotto la linea, al 10%. */
  velo: "fill-theme-1/10 dark:fill-indigo-300/15",
  sfondo: "bg-theme-1 dark:bg-indigo-300",
} as const;

/** Una seconda serie di confronto, in grigio, che resta un passo indietro (per esempio il prezzo barrato). */
export const SERIE_SECONDARIA = {
  fill: "fill-slate-400 dark:fill-slate-500",
  stroke: "stroke-slate-400 dark:stroke-slate-500",
  sfondo: "bg-slate-400 dark:bg-slate-500",
} as const;

/** Segni neutri: box senza dato, categoria "Altri", pagine vuote. */
export const TINTA_NEUTRA: Tinta = {
  classe: "fill-slate-200 dark:fill-darkmode-400",
  classeTesto: "fill-slate-700 dark:fill-slate-200",
};

/** Il segno in evidenza (per esempio il box della referenza nella pagina). */
export const TINTA_PRINCIPALE: Tinta = {
  classe: SERIE_PRINCIPALE.fill,
  classeTesto: "fill-white dark:fill-slate-900",
};

/**
 * Categorie distinte prima di raggruppare le altre in "Altri": oltre, i colori non si
 * distinguono più (e un colore generato confonderebbe).
 */
export const MASSIMO_CATEGORIE = 8;

const luminanza = (colore: string): number | null => {
  const parti = /(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/.exec(colore);
  if (!parti) return null;
  const [r, g, b] = parti.slice(1, 4).map(c => {
    const v = Number(c) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Testo chiaro o scuro sopra un colore pieno, uguale nei due temi: scuro dove il fondo è chiaro. */
export const classeTestoSu = (colore: string): string => {
  const l = luminanza(colore);
  return l !== null && l > 0.36 ? "fill-slate-900" : "fill-white";
};

/**
 * Tinta della categoria `indice` (0 = la prima). Si salta il primo colore del tema, il navy, troppo
 * scuro per i segni e invisibile nel tema scuro; oltre MASSIMO_CATEGORIE la tinta è neutra.
 */
export const tintaCategoria = (indice: number): Tinta => {
  if (!Number.isInteger(indice) || indice < 0 || indice >= MASSIMO_CATEGORIE) return TINTA_NEUTRA;
  const colore = paletteColore(indice + 1);
  return { colore, classeTesto: classeTestoSu(colore) };
};

/**
 * Indice di colore stabile per entità: le entità si ordinano per nome (come i filtri dell'elenco
 * dei punti vendita) e prendono gli indici in quell'ordine. Così il colore segue l'insegna,
 * non quante volte compare né la sua posizione in classifica. A parità di nome decide l'id.
 */
export const indiciPerNome = (voci: ReadonlyArray<{ id: string; nome: string }>): Map<string, number> => {
  const uniche = new Map<string, string>();
  for (const voce of voci) if (!uniche.has(voce.id)) uniche.set(voce.id, voce.nome);
  const ordinate = [...uniche].sort(([idA, a], [idB, b]) => a.localeCompare(b, "it") || idA.localeCompare(idB));
  return new Map(ordinate.map(([id], indice) => [id, indice]));
};

/** Passi della scala sequenziale: dal chiaro allo scuro della tinta del tema; nel tema scuro dal fondo al chiaro. */
export const PASSI_SEQUENZIALI: readonly Tinta[] = [
  { classe: "fill-theme-1/10 dark:fill-indigo-300/10", classeTesto: "fill-slate-700 dark:fill-slate-100" },
  { classe: "fill-theme-1/20 dark:fill-indigo-300/20", classeTesto: "fill-slate-700 dark:fill-slate-100" },
  { classe: "fill-theme-1/35 dark:fill-indigo-300/30", classeTesto: "fill-slate-800 dark:fill-slate-100" },
  { classe: "fill-theme-1/50 dark:fill-indigo-300/45", classeTesto: "fill-white dark:fill-slate-100" },
  { classe: "fill-theme-1/65 dark:fill-indigo-300/60", classeTesto: "fill-white dark:fill-slate-900" },
  { classe: "fill-theme-1/80 dark:fill-indigo-300/80", classeTesto: "fill-white dark:fill-slate-900" },
  { classe: "fill-theme-1 dark:fill-indigo-300", classeTesto: "fill-white dark:fill-slate-900" },
];

/**
 * Passo della scala sequenziale per un valore: classi larghe `ampiezza` a partire da zero,
 * l'ultima aperta in alto. -1 per un valore mancante.
 */
export const passoSequenziale = (valore: number | null | undefined, ampiezza: number, passi = PASSI_SEQUENZIALI.length): number => {
  if (valore === null || valore === undefined || !Number.isFinite(valore)) return -1;
  if (!(ampiezza > 0)) return 0;
  return Math.max(0, Math.min(passi - 1, Math.floor(valore / ampiezza)));
};

/** Tinta di un passo della scala sequenziale; neutra per un valore mancante (passo -1). */
export const tintaSequenziale = (passo: number): Tinta => PASSI_SEQUENZIALI[passo] ?? TINTA_NEUTRA;

/**
 * Ampiezza delle classi della scala sequenziale perché `massimo` cada nell'ultima: un intero
 * (da 1 in su), oppure una cifra sola per i valori piccoli.
 */
export const ampiezzaClassi = (massimo: number, passi = PASSI_SEQUENZIALI.length): number => {
  if (!(massimo > 0)) return 1;
  const grezza = massimo / passi;
  if (grezza >= 1) return Math.ceil(grezza);
  const potenza = 10 ** Math.floor(Math.log10(grezza));
  return Number((Math.ceil(grezza / potenza) * potenza).toFixed(10));
};
