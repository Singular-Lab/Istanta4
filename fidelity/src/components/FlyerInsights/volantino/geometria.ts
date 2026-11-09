import type { BoxInsight, GeometriaPagina } from "../../../../lib/insightVolantino/tipi";

/**
 * Geometria del visualizzatore del volantino: doppie pagine, proporzioni delle pagine, riquadri dei
 * box e allineamento dell'immagine della pagina. Funzioni pure.
 *
 * La geometria dei box arriva dal server già relativa alla pagina (da 0 a 1, origine in alto a
 * sinistra) sia per i kit di Istanta sia per quelli dello storico: qui non si fanno più calcoli
 * sulla doppia pagina.
 */

/** Pagina A4 verticale: vale quando nessun box dice la proporzione della pagina. */
export const PROPORZIONE_PREDEFINITA = 210 / 297;

/**
 * Oltre questo scarto relativo fra la proporzione dell'immagine e quella della pagina, l'immagine
 * non è la pagina: è il segnaposto quadrato di Olimpo (quando non ha il PDF) o un file diverso.
 * L'abbondanza e i crocini di taglio spostano la proporzione di pochi punti percentuali; il
 * segnaposto 1:1 contro una pagina A4 di oltre il 40%.
 */
export const SCARTO_SEGNAPOSTO = 0.15;

/** Sotto questo scarto immagine e pagina hanno la stessa proporzione: nessuna abbondanza. */
const SCARTO_TRASCURABILE = 0.002;

const proporzioneValida = (valore: number | null | undefined): valore is number =>
  typeof valore === "number" && Number.isFinite(valore) && valore > 0.2 && valore < 5;

/* ---------- Doppie pagine ---------- */

/**
 * Una doppia pagina del volantino sfogliato: la copertina da sola (indice 0, solo a destra), poi
 * 2-3, 4-5... L'ultima resta da sola quando le pagine sono pari.
 */
export interface DoppiaPagina {
  indice: number;
  sinistra: number | null;
  destra: number | null;
}

/** Indice della doppia pagina che contiene la pagina (contata da 1). */
export const doppiaDellaPagina = (pagina: number): number => (pagina <= 1 ? 0 : Math.floor(pagina / 2));

/** Quante doppie pagine ha un volantino: la copertina, poi una ogni due pagine. */
export const totaleDoppie = (totalePagine: number): number => (totalePagine <= 1 ? 1 : Math.floor(totalePagine / 2) + 1);

export const pagineDellaDoppia = (indice: number, totalePagine: number): DoppiaPagina => {
  if (indice <= 0) return { indice: 0, sinistra: null, destra: 1 };
  const sinistra = indice * 2;
  const destra = sinistra + 1;
  return {
    indice,
    sinistra: sinistra <= totalePagine ? sinistra : null,
    destra: destra <= totalePagine ? destra : null,
  };
};

/** Le pagine della doppia, nell'ordine in cui si vedono. */
export const pagineVisibili = (doppia: DoppiaPagina): number[] =>
  [doppia.sinistra, doppia.destra].filter((pagina): pagina is number => pagina !== null);

/** "1", "2-3", "8": il nome breve della doppia pagina, per la mini navigazione. */
export const numeriDoppia = (doppia: DoppiaPagina): string => pagineVisibili(doppia).join("-");

/** "Copertina", "Pagine 2-3", "Pagina 8". */
export const etichettaDoppia = (doppia: DoppiaPagina): string => {
  if (doppia.indice === 0) return "Copertina";
  const pagine = pagineVisibili(doppia);
  return pagine.length > 1 ? `Pagine ${pagine.join("-")}` : `Pagina ${pagine[0] ?? ""}`;
};

/** Nome del pulsante che porta alla doppia pagina, per le tecnologie assistive. */
export const destinazioneDoppia = (doppia: DoppiaPagina): string => {
  if (doppia.indice === 0) return "Vai alla copertina";
  const pagine = pagineVisibili(doppia);
  return pagine.length > 1 ? `Vai alle pagine ${pagine.join("-")}` : `Vai alla pagina ${pagine[0] ?? ""}`;
};

/**
 * Pagine del volantino da sfogliare: quelle dichiarate, o di più se un box sta oltre (dati
 * incompleti). Il PDF non allunga il volantino: se ha più pagine, le altre non hanno box.
 */
export const pagineDaSfogliare = (totalePagine: number, box: readonly Pick<BoxInsight, "pagina">[]): number => {
  let massimo = Number.isFinite(totalePagine) ? Math.floor(totalePagine) : 0;
  for (const voce of box) if (voce.pagina !== null && voce.pagina > massimo) massimo = voce.pagina;
  return Math.max(1, massimo);
};

/* ---------- Proporzioni e riquadri ---------- */

/** Proporzione (larghezza/altezza) delle pagine del volantino: quella del primo box che la dice. */
export const proporzioneDelVolantino = (box: readonly Pick<BoxInsight, "proporzionePagina">[]): number =>
  box.find(voce => proporzioneValida(voce.proporzionePagina))?.proporzionePagina ?? PROPORZIONE_PREDEFINITA;

/** Proporzione di una pagina: quella dei suoi box, altrimenti quella del volantino. */
export const proporzioneDellaPagina = (
  box: readonly Pick<BoxInsight, "pagina" | "proporzionePagina">[],
  pagina: number,
  predefinita: number
): number => box.find(voce => voce.pagina === pagina && proporzioneValida(voce.proporzionePagina))?.proporzionePagina ?? predefinita;

/**
 * Il riquadro del box da disegnare, dentro la pagina: un box che sborda (abbondanza) si taglia al
 * bordo; null senza una geometria utilizzabile.
 */
export const riquadroBox = (geometria: GeometriaPagina | null): GeometriaPagina | null => {
  if (!geometria) return null;
  const { x, y, w, h } = geometria;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(1, x + w);
  const y1 = Math.min(1, y + h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** I box disegnabili, raggruppati per pagina. */
export const boxPerPagina = <T extends Pick<BoxInsight, "pagina" | "geometria">>(box: readonly T[]): Map<number, T[]> => {
  const pagine = new Map<number, T[]>();
  for (const voce of box) {
    if (voce.pagina === null || !riquadroBox(voce.geometria)) continue;
    const elenco = pagine.get(voce.pagina);
    if (elenco) elenco.push(voce);
    else pagine.set(voce.pagina, [voce]);
  }
  return pagine;
};

/* ---------- Immagine della pagina ---------- */

/** Dove sta la pagina rifilata nell'immagine, in frazioni della larghezza e dell'altezza dell'immagine. */
export interface PaginaNellImmagine {
  x: number;
  y: number;
  w: number;
  h: number;
}

const paginaIntera: PaginaNellImmagine = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Compensazione dell'abbondanza: dove sta la pagina rifilata (di proporzione `proporzionePagina`)
 * dentro l'immagine di Olimpo, che spesso comprende l'abbondanza del PDF.
 *
 * L'abbondanza si assume simmetrica: InDesign la esporta uguale sui quattro lati, e allora
 * (L - 2a) / (A - 2a) = proporzione della pagina dà a. Se quel modello non torna (abbondanza solo
 * su due lati, pagina quadrata), i margini stanno solo sui lati in eccesso: laterali se l'immagine
 * è più larga in proporzione, sopra e sotto se è più alta. Proporzioni uguali: nessun margine.
 *
 * Null quando l'immagine non è la pagina (segnaposto quadrato di Olimpo, misure assenti): si
 * mostra la pagina bianca.
 */
export function paginaNellImmagine(larghezza: number, altezza: number, proporzionePagina: number): PaginaNellImmagine | null {
  if (!(larghezza > 0 && altezza > 0) || !Number.isFinite(larghezza) || !Number.isFinite(altezza) || !proporzioneValida(proporzionePagina)) {
    return null;
  }
  const proporzioneImmagine = larghezza / altezza;
  const scarto = Math.abs(proporzioneImmagine / proporzionePagina - 1);
  if (scarto > SCARTO_SEGNAPOSTO) return null;
  if (scarto < SCARTO_TRASCURABILE) return paginaIntera;

  // Abbondanza uguale sui quattro lati; con una pagina quasi quadrata il modello non distingue
  if (Math.abs(1 - proporzionePagina) > 0.05) {
    const abbondanza = (larghezza - proporzionePagina * altezza) / (2 * (1 - proporzionePagina));
    if (abbondanza > 0 && 2 * abbondanza < larghezza && 2 * abbondanza < altezza) {
      return {
        x: abbondanza / larghezza,
        y: abbondanza / altezza,
        w: 1 - (2 * abbondanza) / larghezza,
        h: 1 - (2 * abbondanza) / altezza,
      };
    }
  }

  if (proporzioneImmagine > proporzionePagina) {
    const w = proporzionePagina / proporzioneImmagine;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = proporzioneImmagine / proporzionePagina;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

const percento = (valore: number): string => `${Number(valore.toFixed(4))}%`;

/**
 * Posizione dell'immagine dentro il riquadro della pagina rifilata: più grande della pagina e
 * spostata, così l'abbondanza resta fuori (il riquadro taglia ciò che sborda).
 */
export const stileImmagine = (pagina: PaginaNellImmagine): { left: string; top: string; width: string; height: string } => ({
  left: percento((-pagina.x / pagina.w) * 100),
  top: percento((-pagina.y / pagina.h) * 100),
  width: percento(100 / pagina.w),
  height: percento(100 / pagina.h),
});
