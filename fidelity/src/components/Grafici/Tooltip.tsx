import { twMerge } from "@/utils/twMerge";
import { useCallback, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

/** Una riga del tooltip: il valore in evidenza, l'etichetta più tenue. */
export interface RigaTooltip {
  etichetta: string;
  valore: string;
  /** Segno della serie accanto all'etichetta: un colore CSS o classi bg-*. */
  chiave?: { colore?: string; classe?: string };
}

export interface ContenutoTooltip {
  titolo: string;
  sottotitolo?: string;
  /** Una frase sotto il titolo, per esempio la descrizione di un evento. */
  testo?: string;
  righe?: RigaTooltip[];
}

interface StatoTooltip {
  contenuto: ContenutoTooltip;
  x: number;
  y: number;
}

const DISTANZA = 14;
const MARGINE = 8;

/** Il riquadro del tooltip, fisso sopra la pagina: si sposta dall'altra parte se esce dallo schermo. */
function RiquadroTooltip({ contenuto, x, y }: StatoTooltip) {
  const riferimento = useRef<HTMLDivElement>(null);
  const [posizione, setPosizione] = useState({ left: x + DISTANZA, top: y + DISTANZA });

  useLayoutEffect(() => {
    const riquadro = riferimento.current?.getBoundingClientRect();
    const larghezza = riquadro?.width ?? 0;
    const altezza = riquadro?.height ?? 0;
    const left = x + DISTANZA + larghezza > window.innerWidth - MARGINE ? Math.max(MARGINE, x - DISTANZA - larghezza) : x + DISTANZA;
    const top = y + DISTANZA + altezza > window.innerHeight - MARGINE ? Math.max(MARGINE, y - DISTANZA - altezza) : y + DISTANZA;
    setPosizione({ left, top });
  }, [x, y, contenuto]);

  return createPortal(
    <div
      ref={riferimento}
      role="tooltip"
      style={posizione}
      className="pointer-events-none fixed z-50 max-w-xs rounded-control border border-slate-200 bg-white px-3 py-2 text-xs shadow-overlay dark:border-darkmode-400 dark:bg-darkmode-600"
    >
      <div className="font-semibold text-slate-800 dark:text-slate-100">{contenuto.titolo}</div>
      {contenuto.sottotitolo && <div className="text-slate-500 dark:text-slate-400">{contenuto.sottotitolo}</div>}
      {contenuto.testo && <p className="mt-1 text-slate-600 dark:text-slate-300">{contenuto.testo}</p>}
      {contenuto.righe && contenuto.righe.length > 0 && (
        <dl className="mt-1 flex flex-col gap-0.5">
          {contenuto.righe.map(riga => (
            <div key={riga.etichetta} className="flex items-baseline justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {riga.chiave && (
                  <span
                    aria-hidden="true"
                    className={twMerge("inline-block h-0.5 w-3 flex-none rounded-full", riga.chiave.classe)}
                    style={riga.chiave.colore ? { backgroundColor: riga.chiave.colore } : undefined}
                  />
                )}
                {riga.etichetta}
              </dt>
              <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{riga.valore}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>,
    document.body
  );
}

/**
 * Tooltip dei grafici: `conTooltip(contenuto)` restituisce i gestori da mettere sul segno (o sulla
 * sua area attiva, più grande del segno), `tooltip` va reso una volta nel grafico. Si apre al
 * passaggio del mouse e al focus da tastiera, con gli stessi dati.
 */
export function useTooltip() {
  const [stato, setStato] = useState<StatoTooltip | null>(null);
  const nascondi = useCallback(() => setStato(null), []);

  const conTooltip = useCallback(
    (contenuto: ContenutoTooltip) => ({
      onMouseMove: (evento: MouseEvent<Element>) => setStato({ contenuto, x: evento.clientX, y: evento.clientY }),
      onMouseLeave: nascondi,
      onFocus: (evento: FocusEvent<Element>) => {
        const riquadro = evento.currentTarget.getBoundingClientRect();
        setStato({ contenuto, x: riquadro.left + riquadro.width / 2, y: riquadro.top });
      },
      onBlur: nascondi,
    }),
    [nascondi]
  );

  return { conTooltip, nascondi, tooltip: stato ? <RiquadroTooltip {...stato} /> : null };
}
