import type { BoxInsight, GeometriaPagina } from "../../../../lib/insightVolantino/tipi";

/**
 * Geometria del lettore del volantino: pagine aperte come nel volantino stampato, proporzioni delle
 * pagine, riquadri dei box e allineamento dell'immagine della pagina. Funzioni pure.
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

/* ---------- Pagine aperte, come nel volantino stampato ---------- */

/**
 * Le pagine aperte davanti all'utente: a doppia pagina la sinistra (pari) e la destra (dispari),
 * come nel volantino stampato; la copertina sta da sola a destra, l'ultima pagina pari senza
 * compagna da sola a sinistra. A pagina singola (schermi stretti) una pagina sola, al centro.
 */
export interface Apertura {
  /** Identifica l'apertura: la prima pagina che contiene. */
  chiave: number;
  sinistra: number | null;
  destra: number | null;
  /** Le pagine dell'apertura, in ordine. */
  pagine: number[];
}

const apertura = (sinistra: number | null, destra: number | null): Apertura => {
  const pagine = [sinistra, destra].filter((numero): numero is number => numero !== null);
  return { chiave: pagine[0], sinistra, destra, pagine };
};

const limitata = (pagina: number, totale: number): number => Math.min(Math.max(1, totale), Math.max(1, Math.floor(pagina) || 1));

/**
 * L'apertura che contiene la pagina. A doppia pagina: la copertina da sola, poi 2-3, 4-5...;
 * l'ultima pagina, se è pari, da sola. A pagina singola: la pagina stessa.
 */
export function aperturaDi(pagina: number, totale: number, doppia: boolean): Apertura {
  const numero = limitata(pagina, totale);
  if (!doppia) return { chiave: numero, sinistra: null, destra: null, pagine: [numero] };
  if (numero === 1) return apertura(null, 1);
  const sinistra = numero % 2 === 0 ? numero : numero - 1;
  return apertura(sinistra, sinistra + 1 <= totale ? sinistra + 1 : null);
}

/** Tutte le aperture del volantino, dalla copertina all'ultima. */
export function aperture(totale: number, doppia: boolean): Apertura[] {
  const elenco: Apertura[] = [];
  let pagina = 1;
  const ultima = Math.max(1, Math.floor(totale) || 1);
  while (pagina <= ultima) {
    const corrente = aperturaDi(pagina, ultima, doppia);
    elenco.push(corrente);
    pagina = corrente.pagine[corrente.pagine.length - 1] + 1;
  }
  return elenco;
}

/** L'apertura prima (passo -1) o dopo (passo 1) di quella della pagina; null oltre la copertina o l'ultima. */
export function aperturaVicina(pagina: number, totale: number, doppia: boolean, passo: 1 | -1): Apertura | null {
  const attuale = aperturaDi(pagina, totale, doppia);
  const confine = passo === 1 ? attuale.pagine[attuale.pagine.length - 1] + 1 : attuale.pagine[0] - 1;
  if (confine < 1 || confine > Math.max(1, Math.floor(totale) || 1)) return null;
  return aperturaDi(confine, totale, doppia);
}

/**
 * Le pagine di cui scaricare l'immagine prima che servano: quelle delle aperture subito prima e
 * subito dopo, perché girando pagina siano già pronte. Le pagine aperte non ci sono: si scaricano
 * già.
 */
export function pagineDaPreparare(pagina: number, totale: number, doppia: boolean): number[] {
  return [aperturaVicina(pagina, totale, doppia, -1), aperturaVicina(pagina, totale, doppia, 1)].flatMap(vicina => vicina?.pagine ?? []);
}

/** "Pagina 1", "Pagine 4-5": le pagine aperte, per l'indicatore e per le tecnologie assistive. */
export const testoApertura = (pagine: readonly number[]): string =>
  pagine.length === 1 ? `Pagina ${pagine[0]}` : `Pagine ${pagine[0]}-${pagine[pagine.length - 1]}`;

/**
 * Larghezza/altezza dell'apertura e dove sta la sua parte sinistra: la somma delle due pagine,
 * anche quando una manca (copertina, ultima pagina pari): il posto resta, come nel volantino aperto.
 * A pagina singola, la pagina sola.
 */
export function proporzioneApertura(
  aperta: Apertura,
  proporzione: (pagina: number) => number
): { totale: number; sinistra: number } {
  if (aperta.sinistra === null && aperta.destra === null) {
    const sola = proporzione(aperta.pagine[0]);
    return { totale: sola, sinistra: 0 };
  }
  const sinistra = proporzione(aperta.sinistra ?? aperta.destra ?? 1);
  const destra = proporzione(aperta.destra ?? aperta.sinistra ?? 1);
  return { totale: sinistra + destra, sinistra };
}

/** Il numero di pagina scritto dall'utente, dentro il volantino; null se non è un numero. */
export const paginaRichiesta = (testo: string, totalePagine: number): number | null => {
  const numero = Number.parseInt(testo.trim(), 10);
  if (!Number.isFinite(numero)) return null;
  return Math.min(Math.max(1, totalePagine), Math.max(1, numero));
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

/** Posizione e misure in percentuale del contenitore, per lo stile di un elemento. */
export interface StilePosizione {
  left: string;
  top: string;
  width: string;
  height: string;
}

/**
 * Posizione dell'immagine dentro il riquadro della pagina rifilata: più grande della pagina e
 * spostata, così l'abbondanza resta fuori (il riquadro taglia ciò che sborda).
 */
export const stileImmagine = (pagina: PaginaNellImmagine): StilePosizione => ({
  left: percento((-pagina.x / pagina.w) * 100),
  top: percento((-pagina.y / pagina.h) * 100),
  width: percento(100 / pagina.w),
  height: percento(100 / pagina.h),
});

/* ---------- Il box com'è stampato ---------- */

/**
 * Larghezza/altezza del box com'è stampato: il riquadro (in frazioni della pagina) per la
 * proporzione della pagina. Null senza un riquadro utilizzabile.
 */
export const proporzioneRitaglio = (geometria: GeometriaPagina | null, proporzionePagina: number): number | null => {
  const riquadro = riquadroBox(geometria);
  if (!riquadro || !proporzioneValida(proporzionePagina)) return null;
  return (riquadro.w * proporzionePagina) / riquadro.h;
};

/**
 * Posizione della pagina rifilata dentro il ritaglio di un box: la pagina è più grande del
 * ritaglio e spostata, così nel ritaglio resta solo il box (il contenitore taglia il resto). È lo
 * stesso principio di stileImmagine, con il box al posto della pagina.
 */
export const stileRitaglio = (riquadro: GeometriaPagina): StilePosizione => stileImmagine(riquadro);

/* ---------- Zoom ---------- */

/** Ingrandimenti dei passi di Riduci e Ingrandisci, rispetto alle pagine adattate al palco (1). */
export const LIVELLI_ZOOM: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
/** Le pagine adattate allo spazio del palco. */
export const ZOOM_ADATTA = 1;
export const ZOOM_MINIMO = LIVELLI_ZOOM[0];
/**
 * Lo zoom arriva almeno al 200% anche quando la risoluzione dell'immagine non si conosce ancora
 * (immagine non caricata, pagina bianca) o è più bassa.
 */
export const ZOOM_MASSIMO_MINIMO = 2;
/** Mai oltre l'800%, anche con immagini molto grandi su schermi piccoli. */
export const ZOOM_LIMITE = LIVELLI_ZOOM[LIVELLI_ZOOM.length - 1];
/** Margini del palco intorno alle pagine adattate, in rem: gli stessi del calcolo CSS della larghezza. */
export const MARGINE_ORIZZONTALE_PALCO = 6;
export const MARGINE_VERTICALE_PALCO = 1.5;

const ZOOM_TOLLERANZA = 0.001;

/** Lo zoom arrotondato al centesimo: le percentuali si leggono e si confrontano senza sorprese. */
export const zoomArrotondato = (valore: number): number => Math.round(valore * 100) / 100;

/** Lo zoom dentro i limiti: dal 50% al massimo dato. */
export const zoomLimitato = (valore: number, massimo: number): number =>
  Number.isFinite(valore) ? zoomArrotondato(Math.min(Math.max(ZOOM_MINIMO, massimo), Math.max(ZOOM_MINIMO, valore))) : ZOOM_ADATTA;

/**
 * Altezza in px CSS di una pagina adattata al palco (zoom 100%): il libro aperto è largo quanto il
 * palco meno i margini, oppure alto quanto il palco meno i margini, il più piccolo dei due. 0
 * quando il palco non ha ancora misure.
 */
export function altezzaAdattata(larghezzaPalco: number, altezzaPalco: number, proporzioneLibro: number, rem = 16): number {
  if (!(larghezzaPalco > 0 && altezzaPalco > 0 && proporzioneLibro > 0)) return 0;
  const larghezza = Math.min(larghezzaPalco - MARGINE_ORIZZONTALE_PALCO * rem, (altezzaPalco - MARGINE_VERTICALE_PALCO * rem) * proporzioneLibro);
  return larghezza > 0 ? larghezza / proporzioneLibro : 0;
}

/**
 * Lo zoom massimo: quello a cui un pixel dell'immagine della pagina diventa un pixel dello schermo
 * (risoluzione reale), mai sotto il 200% né oltre l'800%.
 *
 * @param pixelPagina altezza della pagina rifilata nell'immagine, in pixel dell'immagine
 * @param altezzaPagina altezza della pagina adattata al palco, in px CSS
 * @param densita pixel dello schermo per px CSS (devicePixelRatio)
 */
export function zoomMassimo(pixelPagina: number | null, altezzaPagina: number, densita: number): number {
  if (!(pixelPagina && pixelPagina > 0 && altezzaPagina > 0)) return ZOOM_MASSIMO_MINIMO;
  const reale = pixelPagina / (altezzaPagina * (densita > 0 ? densita : 1));
  // Per difetto: oltre la risoluzione reale l'immagine sgranerebbe
  return Math.min(ZOOM_LIMITE, Math.max(ZOOM_MASSIMO_MINIMO, Math.floor(reale * 100) / 100));
}

/**
 * Lo zoom del passo successivo (verso 1) o precedente (verso -1) per Ingrandisci e Riduci: il
 * livello vicino dentro i limiti; l'ultimo passo verso l'alto è il massimo stesso, anche fra due
 * livelli.
 */
export function zoomVicino(attuale: number, verso: 1 | -1, massimo: number): number {
  const tetto = Math.max(ZOOM_MINIMO, massimo);
  if (verso === 1) {
    const prossimo = LIVELLI_ZOOM.find(livello => livello > attuale + ZOOM_TOLLERANZA && livello <= tetto + ZOOM_TOLLERANZA);
    return zoomArrotondato(prossimo ?? Math.max(attuale, tetto));
  }
  const precedenti = LIVELLI_ZOOM.filter(livello => livello < attuale - ZOOM_TOLLERANZA && livello <= tetto + ZOOM_TOLLERANZA);
  return zoomArrotondato(precedenti.length > 0 ? precedenti[precedenti.length - 1] : ZOOM_MINIMO);
}

/** Lo zoom dopo un giro di rotella con Ctrl, o un pizzico sul touchpad: continuo, più rotella più zoom. */
export function zoomDallaRotella(attuale: number, deltaY: number, deltaMode: number, massimo: number): number {
  // Le righe (Firefox) valgono circa 16 px, le pagine un palco
  const pixel = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const passo = Math.max(-200, Math.min(200, pixel));
  return zoomLimitato(attuale * Math.exp(-passo * 0.002), massimo);
}

/** Un rettangolo sullo schermo, come lo dà getBoundingClientRect. */
export interface Rettangolo {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Un punto del libro, in frazioni della sua larghezza e altezza. */
export interface PuntoNelLibro {
  rx: number;
  ry: number;
}

/** Il punto del libro sotto un punto dello schermo. */
export const puntoNelLibro = (libro: Rettangolo, x: number, y: number): PuntoNelLibro => ({
  rx: libro.width > 0 ? (x - libro.left) / libro.width : 0.5,
  ry: libro.height > 0 ? (y - libro.top) / libro.height : 0.5,
});

/**
 * Di quanto scorrere il palco perché il punto del libro torni sotto lo stesso punto dello schermo
 * dopo lo zoom: lo zoom tiene fermo il punto sotto il cursore (o il centro del palco).
 */
export const scorrimentoPerPunto = (libro: Rettangolo, punto: PuntoNelLibro, x: number, y: number): { dx: number; dy: number } => ({
  dx: libro.left + punto.rx * libro.width - x,
  dy: libro.top + punto.ry * libro.height - y,
});
