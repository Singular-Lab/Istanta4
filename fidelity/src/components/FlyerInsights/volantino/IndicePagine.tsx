import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useDisegnoPdf } from "./pdfVolantino";

/** Larghezza in pixel CSS della miniatura di una pagina nell'indice. */
const LARGHEZZA_MINIATURA = 72;

export interface VoceIndice {
  numero: number;
  /** Larghezza/altezza della pagina rifilata. */
  proporzione: number;
  box: number;
  /** Il PDF da cui disegnare la miniatura; null: si usa `immagine`, o resta il foglio bianco. */
  pdf: PDFDocumentProxy | null;
  /** Immagine di Olimpo, di riserva quando il PDF non si legge. */
  immagine: string | null;
}

export interface IndicePagineProps {
  voci: readonly VoceIndice[];
  corrente: number;
  onVai: (numero: number) => void;
}

/** Visibile nel suo elenco: la miniatura si disegna solo quando la si vede. Senza IntersectionObserver, subito. */
function useVisibile(elemento: RefObject<HTMLElement | null>): boolean {
  const [visibile, setVisibile] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const nodo = elemento.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;
    const osservatore = new IntersectionObserver(voci => {
      if (voci.some(voce => voce.isIntersecting)) {
        setVisibile(true);
        osservatore.disconnect();
      }
    }, { rootMargin: "200px 0px" });
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [elemento]);
  return visibile;
}

function Miniatura({ voce }: { voce: VoceIndice }) {
  const contenitore = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const visibile = useVisibile(contenitore);
  const disegno = useDisegnoPdf(visibile ? voce.pdf : null, voce.numero, canvas, LARGHEZZA_MINIATURA);
  const conPdf = voce.pdf !== null && disegno.stato !== "errore";

  return (
    <span
      ref={contenitore}
      aria-hidden="true"
      className="relative block w-full overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-darkmode-400"
      style={{ aspectRatio: String(voce.proporzione) }}
    >
      {visibile && conPdf && (
        <canvas ref={canvas} className={twMerge("absolute inset-0 h-full w-full object-cover", disegno.stato !== "pronta" && "invisible")} />
      )}
      {visibile && !conPdf && voce.immagine && (
        <img src={voce.immagine} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}

/**
 * L'indice delle pagine del lettore: una miniatura per pagina, disegnata dal PDF quando entra in
 * vista, con il numero della pagina e quanti box ha. La pagina che si sta guardando è evidenziata
 * e resta visibile nell'indice; un clic porta alla pagina.
 */
export function IndicePagine({ voci, corrente, onVai }: IndicePagineProps) {
  const correnteRef = useRef<HTMLLIElement>(null);

  // L'indice segue lo scorrimento: la pagina corrente non esce dalla sua colonna
  useEffect(() => {
    const nodo = correnteRef.current;
    if (nodo && typeof nodo.scrollIntoView === "function") nodo.scrollIntoView({ block: "nearest" });
  }, [corrente]);

  return (
    <nav aria-label="Indice delle pagine" className="h-full overflow-y-auto overscroll-contain pr-1">
      <ol className="flex flex-col gap-2 p-1">
        {voci.map(voce => {
          const attuale = voce.numero === corrente;
          return (
            <li key={voce.numero} ref={attuale ? correnteRef : undefined}>
              <button
                type="button"
                aria-label={`Pagina ${voce.numero}, ${voce.box === 1 ? "1 box" : `${formatNumero(voce.box)} box`}`}
                aria-current={attuale ? "page" : undefined}
                onClick={() => onVai(voce.numero)}
                className={twMerge(
                  "group flex w-full flex-col gap-1 rounded-control p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  attuale ? "bg-primary/10 ring-1 ring-primary/40 dark:bg-indigo-300/15" : "hover:bg-slate-100 dark:hover:bg-darkmode-600"
                )}
              >
                <Miniatura voce={voce} />
                <span className="flex items-baseline justify-between gap-1 text-3xs tabular-nums">
                  <span className={twMerge("font-semibold", attuale ? "text-primary dark:text-indigo-200" : "text-slate-700 dark:text-slate-200")}>
                    {formatNumero(voce.numero)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{formatNumero(voce.box)} box</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default IndicePagine;
