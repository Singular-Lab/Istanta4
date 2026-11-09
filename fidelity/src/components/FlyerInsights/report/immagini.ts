import { urlPaginaMateriale } from "@/utils/materiali";
import {
  coloraDensita,
  densitaVolantino,
  elementiPerPagina,
  valoriPerBox,
  type DensitaPagina,
} from "../../../../lib/insightVolantino/calore";
import type { ReportVolantino } from "../../../../lib/insightVolantino/report";
import { paginaNellImmagine, proporzioneDelVolantino } from "../volantino/geometria";
import { datiMisure, pagineDaCaricare, proporzioniPagine } from "./pagineVolantino";
import type { AlAvanzamento, ImmaginiReport } from "./tipiReport";

/**
 * Immagini del report PDF, preparate nel browser: @react-pdf legge solo JPEG e PNG, Olimpo da' le
 * pagine in WebP. Ogni pagina si scarica, si rifila (via l'abbondanza), si riduce e si ridisegna su un
 * canvas come JPEG; la mappa di calore si colora con calore.ts e diventa un PNG trasparente da
 * sovrapporre. Se una pagina non arriva o Olimpo risponde con il segnaposto, la pagina resta bianca
 * con i soli riquadri: il report si fa lo stesso.
 */

/** Lato lungo massimo dell'immagine di una pagina, in pixel (circa 300 dpi sulla pagina del report). */
export const LATO_MASSIMO = 1400;
/** Pagine scaricate insieme da Olimpo. */
export const CONCORRENZA = 3;
/** Oltre questo tempo una pagina si considera non disponibile. */
export const ATTESA_MASSIMA_MS = 20_000;
export const QUALITA_JPEG = 0.86;
/** Colonne della griglia della mappa di calore e larghezza del PNG che la contiene. */
export const COLONNE_CALORE = 96;
export const LARGHEZZA_CALORE = 400;

/** Il minimo del canvas che serve qui: quello del browser, o uno finto nei test. */
export interface ContestoReport {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(sorgente: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  createImageData(larghezza: number, altezza: number): ImageData;
  putImageData(dati: ImageData, x: number, y: number): void;
}

export interface CanvasReport {
  width: number;
  height: number;
  getContext(tipo: "2d"): ContestoReport | null;
  toDataURL(tipo: string, qualita?: number): string;
}

export interface ImmagineCaricata {
  larghezza: number;
  altezza: number;
  sorgente: CanvasImageSource;
}

export interface AmbienteImmagini {
  caricaImmagine(url: string): Promise<ImmagineCaricata>;
  creaCanvas(): CanvasReport;
}

/** Ambiente del browser: <img> dallo stesso proxy di Olimpo della pagina (stessa origine, canvas leggibile). */
export function ambienteBrowser(): AmbienteImmagini {
  return {
    caricaImmagine: (url) =>
      new Promise<ImmagineCaricata>((risolvi, rifiuta) => {
        const immagine = new Image();
        immagine.decoding = "async";
        const timer = window.setTimeout(() => {
          immagine.src = "";
          rifiuta(new Error(`Pagina non arrivata in tempo: ${url}`));
        }, ATTESA_MASSIMA_MS);
        immagine.onload = () => {
          window.clearTimeout(timer);
          risolvi({ larghezza: immagine.naturalWidth, altezza: immagine.naturalHeight, sorgente: immagine });
        };
        immagine.onerror = () => {
          window.clearTimeout(timer);
          rifiuta(new Error(`Pagina non caricata: ${url}`));
        };
        immagine.src = url;
      }),
    creaCanvas: () => document.createElement("canvas") as unknown as CanvasReport,
  };
}

/** Misura ridotta perche' il lato lungo non superi `lato`; mai ingrandita. */
export function misuraRidotta(larghezza: number, altezza: number, lato: number = LATO_MASSIMO): { larghezza: number; altezza: number } {
  const fattore = Math.min(1, lato / Math.max(larghezza, altezza, 1));
  return { larghezza: Math.max(1, Math.round(larghezza * fattore)), altezza: Math.max(1, Math.round(altezza * fattore)) };
}

/** Esegue i compiti con al massimo `limite` in corso insieme; i risultati restano nell'ordine delle voci. */
export async function eseguiConLimite<T, R>(voci: readonly T[], limite: number, compito: (voce: T, indice: number) => Promise<R>): Promise<R[]> {
  const risultati = new Array<R>(voci.length);
  let prossimo = 0;
  const lavoratore = async () => {
    while (prossimo < voci.length) {
      const indice = prossimo++;
      risultati[indice] = await compito(voci[indice], indice);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, voci.length)) }, lavoratore));
  return risultati;
}

function contesto(canvas: CanvasReport): ContestoReport {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Il browser non permette di disegnare le pagine del report");
  return ctx;
}

/**
 * JPEG (data URI) della pagina rifilata, o null se l'immagine e' il segnaposto di Olimpo (proporzioni
 * troppo diverse dalla pagina) o non ha misure.
 */
export function disegnaPagina(immagine: ImmagineCaricata, proporzione: number, ambiente: AmbienteImmagini): string | null {
  const pagina = paginaNellImmagine(immagine.larghezza, immagine.altezza, proporzione);
  if (!pagina) return null;
  const taglio = {
    x: pagina.x * immagine.larghezza,
    y: pagina.y * immagine.altezza,
    w: pagina.w * immagine.larghezza,
    h: pagina.h * immagine.altezza,
  };
  const misura = misuraRidotta(taglio.w, taglio.h);
  const canvas = ambiente.creaCanvas();
  canvas.width = misura.larghezza;
  canvas.height = misura.altezza;
  const ctx = contesto(canvas);
  // Fondo bianco: il JPEG non ha trasparenza
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, misura.larghezza, misura.altezza);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(immagine.sorgente, taglio.x, taglio.y, taglio.w, taglio.h, 0, 0, misura.larghezza, misura.altezza);
  return canvas.toDataURL("image/jpeg", QUALITA_JPEG);
}

/** PNG trasparente della mappa di calore di una pagina, ingrandita e sfumata dal canvas. */
export function disegnaCalore(densita: DensitaPagina, tappe: readonly string[], proporzione: number, ambiente: AmbienteImmagini): string {
  const piccolo = ambiente.creaCanvas();
  piccolo.width = densita.colonne;
  piccolo.height = densita.righe;
  const ctxPiccolo = contesto(piccolo);
  const pixel = ctxPiccolo.createImageData(densita.colonne, densita.righe);
  pixel.data.set(coloraDensita(densita, tappe));
  ctxPiccolo.putImageData(pixel, 0, 0);

  const grande = ambiente.creaCanvas();
  grande.width = LARGHEZZA_CALORE;
  grande.height = Math.max(1, Math.round(LARGHEZZA_CALORE / (proporzione > 0 ? proporzione : 210 / 297)));
  const ctxGrande = contesto(grande);
  ctxGrande.imageSmoothingEnabled = true;
  ctxGrande.imageSmoothingQuality = "high";
  ctxGrande.drawImage(piccolo as unknown as CanvasImageSource, 0, 0, densita.colonne, densita.righe, 0, 0, grande.width, grande.height);
  return grande.toDataURL("image/png");
}

/** Mappe di calore di ogni sezione 'pagine', per indice della sezione e pagina. */
export function mappeDiCalore(report: ReportVolantino, ambiente: AmbienteImmagini): Map<number, Map<number, string>> {
  const proporzione = proporzioneDelVolantino(report.box);
  const mappe = new Map<number, Map<number, string>>();
  report.sezioni.forEach((sezione, indice) => {
    if (sezione.tipo !== "pagine") return;
    // Solo i valori positivi: una pagina che non ne ha resta senza mappa (niente PNG vuoti)
    const valori = new Map([...valoriPerBox(sezione.misura, report.box, datiMisure(report))].filter(([, valore]) => valore > 0));
    const densita = densitaVolantino(elementiPerPagina(report.box, valori), { colonne: COLONNE_CALORE, proporzione });
    const perPagina = new Map<number, string>();
    for (const [pagina, densitaPagina] of densita) {
      perPagina.set(pagina, disegnaCalore(densitaPagina, report.palette.calore, proporzione, ambiente));
    }
    mappe.set(indice, perPagina);
  });
  return mappe;
}

/**
 * Tutte le immagini del report: le pagine (al massimo CONCORRENZA scaricate insieme, ognuna con il suo
 * esito) e le mappe di calore. `alAvanzamento` riceve le pagine pronte sul totale.
 */
export async function preparaImmagini(
  report: ReportVolantino,
  alAvanzamento?: AlAvanzamento,
  ambiente: AmbienteImmagini = ambienteBrowser()
): Promise<ImmaginiReport> {
  const pdf = report.pdf;
  const daCaricare = pagineDaCaricare(report);
  const proporzione = proporzioniPagine(report.box);
  let fatte = 0;
  alAvanzamento?.({ fatte, totale: daCaricare.length });

  const esiti = await eseguiConLimite(daCaricare, CONCORRENZA, async (pagina) => {
    let risultato: string | null = null;
    try {
      const immagine = await ambiente.caricaImmagine(urlPaginaMateriale(pdf!.idOlimpoCloud, pagina));
      risultato = disegnaPagina(immagine, proporzione(pagina), ambiente);
    } catch {
      // Pagina non disponibile: resta bianca con i riquadri (il report lo dice sotto la pagina)
    }
    fatte += 1;
    alAvanzamento?.({ fatte, totale: daCaricare.length });
    return [pagina, risultato] as const;
  });

  return { pagine: new Map(esiti), calore: mappeDiCalore(report, ambiente) };
}
