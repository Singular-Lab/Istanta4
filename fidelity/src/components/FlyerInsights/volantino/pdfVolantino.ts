import { useEffect, useState, type RefObject } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

/**
 * Le pagine del volantino disegnate direttamente dal PDF (spec insight-volantino, "Pagine vere del
 * volantino con le referenze"), nitide a ogni ingrandimento.
 *
 * pdf.js si carica solo quando serve e solo nel browser: non entra nel bundle delle altre pagine
 * né nel rendering lato server. Il PDF di un volantino pesa decine di MB: Olimpo e il proxy /olimpo
 * rispondono alle richieste Range, quindi pdf.js ne scarica solo i pezzi che servono alle pagine
 * mostrate (disableAutoFetch e disableStream), non il file intero.
 */

type Pdfjs = typeof import("pdfjs-dist");

/** Pezzi richiesti a Olimpo: abbastanza grandi da non moltiplicare le richieste, piccoli rispetto al file. */
export const PEZZO_PDF = 512 * 1024;

/** Tetto ai pixel del disegno di una pagina: a zoom alto il canvas non esaurisce la memoria. */
export const PIXEL_MASSIMI_PAGINA = 16_000_000;

/** Densità dello schermo considerata al più: oltre 2 la differenza non si vede e costa memoria. */
export const DENSITA_MASSIMA = 2;

let caricamento: Promise<Pdfjs> | null = null;

/** pdf.js e il suo worker, caricati una volta sola alla prima pagina disegnata. */
export function caricaPdfjs(): Promise<Pdfjs> {
  caricamento ??= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")])
    .then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })
    .catch(errore => {
      // Un caricamento fallito (rete) si riprova alla prossima apertura
      caricamento = null;
      throw errore;
    });
  return caricamento;
}

/**
 * Scala del disegno di una pagina di `larghezzaPunti`×`altezzaPunti` punti tipografici, mostrata
 * larga `larghezzaCss` pixel CSS: tanti pixel quanti ne servono allo schermo (densità fino a
 * DENSITA_MASSIMA), senza superare PIXEL_MASSIMI_PAGINA. 0 se le misure non valgono.
 */
export function scalaDisegno(larghezzaPunti: number, altezzaPunti: number, larghezzaCss: number, densita: number): number {
  if (!(larghezzaPunti > 0 && altezzaPunti > 0 && larghezzaCss > 0) || ![larghezzaPunti, altezzaPunti, larghezzaCss].every(Number.isFinite)) {
    return 0;
  }
  const pixelPerCss = Math.min(DENSITA_MASSIMA, Math.max(1, Number.isFinite(densita) ? densita : 1));
  const voluta = (larghezzaCss * pixelPerCss) / larghezzaPunti;
  const massima = Math.sqrt(PIXEL_MASSIMI_PAGINA / (larghezzaPunti * altezzaPunti));
  return Math.min(voluta, massima);
}

export type StatoDocumentoPdf =
  | { stato: "assente" }
  | { stato: "caricamento" }
  | { stato: "pronto"; documento: PDFDocumentProxy }
  /** Il PDF non si è aperto (rete, file, worker) o ci ha messo troppo: si può riprovare. */
  | { stato: "errore" }
  /** Il browser non ha ciò che serve a pdf.js: inutile riprovare. */
  | { stato: "nonSupportato" };

/** Oltre questo tempo un PDF che non si apre (worker bloccato, rete ferma) lascia il posto alle immagini. */
export const TEMPO_MASSIMO_APERTURA_MS = 20_000;

/**
 * Il browser può far girare pdf.js: worker, canvas, stream e le funzioni recenti che pdf.js 6 usa
 * (Promise.withResolvers). Altrimenti non si scarica nemmeno la libreria: le pagine sono subito le
 * immagini di Olimpo.
 */
export function browserSupportaPdfjs(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    return (
      typeof Worker === "function" &&
      typeof ReadableStream === "function" &&
      typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === "function" &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof HTMLCanvasElement.prototype.getContext === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Il PDF del volantino all'indirizzo `url` (null: nessun PDF), aperto una volta per il
 * visualizzatore e chiuso quando cambia o si lascia la pagina. "nonSupportato" se il browser non può
 * far girare pdf.js, "errore" se pdf.js non si carica, il PDF non si legge o non si apre entro
 * TEMPO_MASSIMO_APERTURA_MS: in entrambi i casi chi lo usa ripiega sulle immagini delle pagine di
 * Olimpo. Cambiando `tentativo` il PDF si riapre da capo (Riprova).
 */
export function useDocumentoPdf(url: string | null, tentativo = 0): StatoDocumentoPdf {
  const [esito, setEsito] = useState<{ chiave: string; stato: StatoDocumentoPdf } | null>(null);
  const chiave = `${tentativo}:${url ?? ""}`;

  useEffect(() => {
    if (!url) return;
    if (!browserSupportaPdfjs()) {
      setEsito({ chiave, stato: { stato: "nonSupportato" } });
      return;
    }
    let attivo = true;
    let distruggi: (() => void) | null = null;
    // Un'apertura che non finisce mai (worker bloccato) non lascia la pagina in attesa per sempre
    const scadenza = setTimeout(() => {
      if (!attivo) return;
      attivo = false;
      distruggi?.();
      setEsito({ chiave, stato: { stato: "errore" } });
    }, TEMPO_MASSIMO_APERTURA_MS);
    caricaPdfjs()
      .then(pdfjs => {
        if (!attivo) return null;
        const apertura = pdfjs.getDocument({
          url,
          disableAutoFetch: true,
          disableStream: true,
          rangeChunkSize: PEZZO_PDF,
        });
        distruggi = () => void apertura.destroy();
        return apertura.promise;
      })
      .then(documento => {
        if (!attivo || !documento) return;
        clearTimeout(scadenza);
        setEsito({ chiave, stato: { stato: "pronto", documento } });
      })
      .catch(() => {
        if (!attivo) return;
        clearTimeout(scadenza);
        setEsito({ chiave, stato: { stato: "errore" } });
      });
    return () => {
      attivo = false;
      clearTimeout(scadenza);
      distruggi?.();
    };
  }, [url, chiave]);

  if (!url) return { stato: "assente" };
  return esito && esito.chiave === chiave ? esito.stato : { stato: "caricamento" };
}

/** Misure della pagina del PDF in punti tipografici, abbondanza compresa (il riquadro di ritaglio). */
export interface MisurePaginaPdf {
  larghezza: number;
  altezza: number;
}

export type StatoDisegnoPdf =
  | { stato: "caricamento" }
  | { stato: "pronta"; misure: MisurePaginaPdf }
  | { stato: "errore" };

/** La larghezza mostrata cambia di continuo mentre si ridimensiona: si ridisegna a scatti di questo passo. */
const PASSO_LARGHEZZA = 64;

const larghezzaArrotondata = (larghezza: number): number => Math.max(PASSO_LARGHEZZA, Math.ceil(larghezza / PASSO_LARGHEZZA) * PASSO_LARGHEZZA);

/**
 * Disegna la pagina `numero` del documento nel canvas, alla larghezza CSS in cui il canvas si vede.
 * Si disegna su un canvas fuori schermo e si copia a disegno finito: cambiando ingrandimento la pagina
 * precedente resta visibile finché la nuova non è pronta. Un disegno superato o smontato si annulla.
 */
export function useDisegnoPdf(
  documento: PDFDocumentProxy | null,
  numero: number,
  canvas: RefObject<HTMLCanvasElement | null>,
  larghezzaCss: number
): StatoDisegnoPdf {
  const [esito, setEsito] = useState<{ chiave: string; stato: StatoDisegnoPdf } | null>(null);
  const larghezza = larghezzaCss > 0 ? larghezzaArrotondata(larghezzaCss) : 0;
  const chiave = documento ? `${documento.fingerprints?.[0] ?? ""}:${numero}` : "";

  useEffect(() => {
    if (!documento || larghezza <= 0) return;
    let attivo = true;
    let disegno: RenderTask | null = null;
    (async () => {
      const pagina = await documento.getPage(numero);
      const naturale = pagina.getViewport({ scale: 1 });
      const misure = { larghezza: naturale.width, altezza: naturale.height };
      const densita = typeof window === "undefined" ? 1 : window.devicePixelRatio;
      const scala = scalaDisegno(misure.larghezza, misure.altezza, larghezza, densita);
      if (!attivo || scala <= 0) return;
      const vista = pagina.getViewport({ scale: scala });
      const fuoriSchermo = document.createElement("canvas");
      fuoriSchermo.width = Math.ceil(vista.width);
      fuoriSchermo.height = Math.ceil(vista.height);
      const contesto = fuoriSchermo.getContext("2d");
      if (!contesto) throw new Error("Canvas non disponibile");
      disegno = pagina.render({ canvas: fuoriSchermo, canvasContext: contesto, viewport: vista });
      await disegno.promise;
      const visibile = canvas.current;
      if (!attivo || !visibile) return;
      visibile.width = fuoriSchermo.width;
      visibile.height = fuoriSchermo.height;
      visibile.getContext("2d")?.drawImage(fuoriSchermo, 0, 0);
      setEsito({ chiave, stato: { stato: "pronta", misure } });
    })().catch(() => {
      // Un disegno annullato perché superato non è un errore della pagina
      if (attivo) setEsito({ chiave, stato: { stato: "errore" } });
    });
    return () => {
      attivo = false;
      disegno?.cancel();
    };
  }, [documento, numero, canvas, larghezza, chiave]);

  // Una pagina già disegnata resta "pronta" mentre si ridisegna a un'altra grandezza
  return esito && esito.chiave === chiave ? esito.stato : { stato: "caricamento" };
}
