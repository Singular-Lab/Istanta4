import { urlPaginaMateriale } from "@/utils/materiali";
import type { ReportVolantino } from "../../../../lib/insightVolantino/report";
import { paginaNellImmagine } from "../volantino/geometria";
import { proporzioneCopertina } from "./impaginazione";
import type { ImmaginiReport } from "./tipiReport";

/**
 * L'unica immagine del report PDF, la miniatura della prima pagina in copertina, preparata nel
 * browser: @react-pdf legge solo JPEG e PNG, Olimpo da' le pagine in WebP. La pagina si scarica, si
 * rifila (via l'abbondanza), si riduce e si ridisegna su un canvas come JPEG. Se non arriva o Olimpo
 * risponde con il segnaposto, la copertina mostra la pagina bianca con i soli riquadri: il report si
 * fa lo stesso. Le altre pagine del volantino non entrano nel report.
 */

/** Lato lungo massimo dell'immagine della pagina, in pixel: piu' che abbastanza per la miniatura. */
export const LATO_MASSIMO = 1400;
/** Oltre questo tempo la pagina si considera non disponibile. */
export const ATTESA_MASSIMA_MS = 20_000;
export const QUALITA_JPEG = 0.86;

/** Il minimo del canvas che serve qui: quello del browser, o uno finto nei test. */
export interface ContestoReport {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(sorgente: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
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

/**
 * Le immagini del report: solo la prima pagina, per la copertina. Senza PDF in Olimpo non si scarica
 * niente; se la pagina non arriva la copertina resta con la pagina bianca.
 */
export async function preparaImmagini(report: ReportVolantino, ambiente: AmbienteImmagini = ambienteBrowser()): Promise<ImmaginiReport> {
  const pdf = report.pdf;
  if (!pdf?.idOlimpoCloud) return { copertina: null };
  try {
    const immagine = await ambiente.caricaImmagine(urlPaginaMateriale(pdf.idOlimpoCloud, 1));
    return { copertina: disegnaPagina(immagine, proporzioneCopertina(report), ambiente) };
  } catch {
    // Pagina non disponibile: la copertina mostra la pagina bianca con i riquadri
    return { copertina: null };
  }
}
