import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, useState, type RefObject } from "react";
import { PROPORZIONE_PREDEFINITA, testoApertura, type Apertura } from "./geometria";

/** Larghezza in pixel CSS della miniatura di una pagina nell'indice: bassa, per non allungare il lettore. */
const LARGHEZZA_MINIATURA = 52;

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
  /** Una voce per pagina, in ordine. */
  voci: readonly VoceIndice[];
  /** Le pagine come si aprono: l'indice le raggruppa così. */
  aperture: readonly Apertura[];
  /** L'apertura davanti all'utente: le sue pagine sono evidenziate. */
  aperta: Apertura;
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
      className="relative block overflow-hidden border border-slate-200 bg-white dark:border-darkmode-400"
      style={{ aspectRatio: String(voce.proporzione), width: LARGHEZZA_MINIATURA }}
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
 * L'indice delle pagine del lettore, sotto il volantino: le miniature raggruppate come si aprono
 * (la copertina da sola, poi le pagine affiancate), chieste a Olimpo già ridotte quando entrano in
 * vista, con il numero della pagina e quanti box ha. Le pagine aperte sono evidenziate e restano
 * visibili nell'indice; un clic apre la pagina. Con una ricerca o un'interrogazione in corso le
 * pagine con box trovati ne mostrano il numero e le altre si attenuano.
 */
export function IndicePagine({ voci, aperture, aperta, onVai }: IndicePagineProps) {
  const apertaRef = useRef<HTMLLIElement>(null);
  const perNumero = new Map(voci.map(voce => [voce.numero, voce]));

  // L'indice segue il volantino: le pagine aperte non escono dalla striscia
  useEffect(() => {
    const nodo = apertaRef.current;
    if (nodo && typeof nodo.scrollIntoView === "function") nodo.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [aperta.chiave]);

  return (
    <nav aria-label="Indice delle pagine" className="overflow-x-auto overscroll-contain pb-1">
      <ol className="flex w-max items-end gap-3 px-1 py-1">
        {aperture.map(gruppo => {
          const attuale = gruppo.chiave === aperta.chiave;
          return (
            <li
              key={gruppo.chiave}
              ref={attuale ? apertaRef : undefined}
              aria-label={testoApertura(gruppo.pagine)}
              className={twMerge(
                "flex flex-col gap-1 rounded-control p-1 transition",
                attuale ? "bg-primary/10 ring-1 ring-primary/40 dark:bg-indigo-300/15" : "hover:bg-slate-100 dark:hover:bg-darkmode-600"
              )}
            >
              <div className="flex">
                {gruppo.pagine.map(numero => {
                  const voce = perNumero.get(numero);
                  if (!voce) return null;
                  const trovati = voce.trovati ?? null;
                  const etichetta = [
                    `Pagina ${voce.numero}`,
                    voce.box === 1 ? "1 box" : `${formatNumero(voce.box)} box`,
                    trovati !== null && trovati > 0 ? `${formatNumero(trovati)} ${trovati === 1 ? "trovato" : "trovati"}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      key={numero}
                      type="button"
                      aria-label={etichetta}
                      aria-current={attuale ? "page" : undefined}
                      onClick={() => onVai(voce.numero)}
                      className={twMerge(
                        "group flex flex-col gap-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        trovati === 0 && !attuale && "opacity-40 hover:opacity-100"
                      )}
                    >
                      <Miniatura voce={voce} />
                      <span className="flex items-baseline justify-between gap-1 px-0.5 text-3xs tabular-nums">
                        <span className={twMerge("font-semibold", attuale ? "text-primary dark:text-indigo-200" : "text-slate-700 dark:text-slate-200")}>
                          {formatNumero(voce.numero)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">{formatNumero(voce.box)} box</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default IndicePagine;
