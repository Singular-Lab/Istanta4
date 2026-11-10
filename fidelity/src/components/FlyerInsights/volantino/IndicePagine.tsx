import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, useState, type RefObject } from "react";
import { PROPORZIONE_PREDEFINITA } from "./geometria";

/** Larghezza in pixel CSS della miniatura di una pagina nell'indice. */
const LARGHEZZA_MINIATURA = 72;

/**
 * Misura in pixel in cui chiedere a Olimpo la miniatura di una pagina di proporzione `proporzione`:
 * il doppio di quella mostrata, per gli schermi ad alta densità. Pochi KB invece dell'immagine intera.
 */
export const misuraMiniatura = (proporzione: number): { larghezza: number; altezza: number } => {
  const larghezza = LARGHEZZA_MINIATURA * 2;
  const valida = Number.isFinite(proporzione) && proporzione > 0 ? proporzione : PROPORZIONE_PREDEFINITA;
  return { larghezza, altezza: Math.round(larghezza / valida) };
};

export interface VoceIndice {
  numero: number;
  /** Larghezza/altezza della pagina rifilata. */
  proporzione: number;
  box: number;
  /** Miniatura della pagina da Olimpo, già ridotta; null: resta il foglio bianco. */
  immagine: string | null;
  /** Box della pagina trovati dalla ricerca; null o assente: nessuna ricerca in corso. */
  trovati?: number | null;
}

export interface IndicePagineProps {
  voci: readonly VoceIndice[];
  corrente: number;
  onVai: (numero: number) => void;
}

/** Visibile nel suo elenco: la miniatura si chiede solo quando la si vede. Senza IntersectionObserver, subito. */
function useVisibile(elemento: RefObject<HTMLElement | null>): boolean {
  const [visibile, setVisibile] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const nodo = elemento.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return;
    const osservatore = new IntersectionObserver(
      voci => {
        if (voci.some(voce => voce.isIntersecting)) {
          setVisibile(true);
          osservatore.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [elemento]);
  return visibile;
}

function Miniatura({ voce }: { voce: VoceIndice }) {
  const contenitore = useRef<HTMLSpanElement>(null);
  const visibile = useVisibile(contenitore);
  const [rotta, setRotta] = useState<string | null>(null);
  const trovati = voce.trovati ?? null;

  return (
    <span
      ref={contenitore}
      aria-hidden="true"
      className="relative block w-full overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-darkmode-400"
      style={{ aspectRatio: String(voce.proporzione) }}
    >
      {visibile && voce.immagine && rotta !== voce.immagine && (
        <img
          src={voce.immagine}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setRotta(voce.immagine)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {trovati !== null && trovati > 0 && (
        <span
          data-testid={`trovati-pagina-${voce.numero}`}
          className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-3xs font-semibold tabular-nums text-white shadow-sm dark:bg-indigo-400 dark:text-darkmode-800"
        >
          {formatNumero(trovati)}
        </span>
      )}
    </span>
  );
}

/**
 * L'indice delle pagine del lettore: una miniatura per pagina, chiesta a Olimpo già ridotta quando
 * entra in vista, con il numero della pagina e quanti box ha. La pagina che si sta guardando è
 * evidenziata e resta visibile nell'indice; un clic porta alla pagina. Con una ricerca in corso le
 * pagine con box trovati ne mostrano il numero e le altre si attenuano.
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
          const trovati = voce.trovati ?? null;
          const etichetta = [
            `Pagina ${voce.numero}`,
            voce.box === 1 ? "1 box" : `${formatNumero(voce.box)} box`,
            trovati !== null && trovati > 0 ? `${formatNumero(trovati)} ${trovati === 1 ? "trovato" : "trovati"}` : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={voce.numero} ref={attuale ? correnteRef : undefined}>
              <button
                type="button"
                aria-label={etichetta}
                aria-current={attuale ? "page" : undefined}
                onClick={() => onVai(voce.numero)}
                className={twMerge(
                  "group flex w-full flex-col gap-1 rounded-control p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  attuale ? "bg-primary/10 ring-1 ring-primary/40 dark:bg-indigo-300/15" : "hover:bg-slate-100 dark:hover:bg-darkmode-600",
                  trovati === 0 && !attuale && "opacity-40 hover:opacity-100"
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
