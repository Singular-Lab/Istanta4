import { formatNumero } from "@/utils/format";
import { useRef, type KeyboardEvent } from "react";
import { twMerge } from "@/utils/twMerge";

type Valore = string | number;

export interface OpzioneSegmento<T extends Valore = string> {
  valore: T;
  etichetta: string;
  /** Numero di elementi con questo valore, mostrato in grigio accanto all'etichetta. */
  conteggio?: number;
}

export interface SegmentiProps<T extends Valore = string> {
  opzioni: OpzioneSegmento<T>[];
  valore: T;
  onChange: (valore: T) => void;
  /** Nome del gruppo per le tecnologie assistive, per esempio "Stato". */
  etichetta: string;
  className?: string;
}

const TASTI_PRECEDENTE = ["ArrowLeft", "ArrowUp"];
const TASTI_SUCCESSIVO = ["ArrowRight", "ArrowDown"];

/**
 * Scelta singola fra poche opzioni sempre visibili, per esempio un filtro per stato con i conteggi.
 * Si comporta come un gruppo di radio: Tab entra sull'opzione scelta, le frecce la cambiano.
 */
function Segmenti<T extends Valore = string>({ opzioni, valore, onChange, etichetta, className }: SegmentiProps<T>) {
  const pulsanti = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceScelto = opzioni.findIndex((opzione) => opzione.valore === valore);
  // Se nessuna opzione corrisponde, la prima resta raggiungibile con Tab
  const indiceFocus = indiceScelto === -1 ? 0 : indiceScelto;

  const scegli = (indice: number) => {
    const opzione = opzioni[indice];
    if (!opzione) return;
    pulsanti.current[indice]?.focus();
    if (opzione.valore !== valore) onChange(opzione.valore);
  };

  const gestisciTasto = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const ultimo = opzioni.length - 1;
    let destinazione: number | null = null;
    if (TASTI_PRECEDENTE.includes(evento.key)) destinazione = indice === 0 ? ultimo : indice - 1;
    else if (TASTI_SUCCESSIVO.includes(evento.key)) destinazione = indice === ultimo ? 0 : indice + 1;
    else if (evento.key === "Home") destinazione = 0;
    else if (evento.key === "End") destinazione = ultimo;
    if (destinazione === null) return;
    evento.preventDefault();
    scegli(destinazione);
  };

  return (
    <div
      role="radiogroup"
      aria-label={etichetta}
      className={twMerge(
        "inline-flex max-w-full overflow-x-auto rounded-control border border-slate-200 bg-slate-50 p-0.5 text-sm",
        className
      )}
    >
      {opzioni.map((opzione, indice) => {
        const scelta = indice === indiceScelto;
        return (
          <button
            key={String(opzione.valore)}
            ref={(elemento) => {
              pulsanti.current[indice] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={scelta}
            tabIndex={indice === indiceFocus ? 0 : -1}
            onClick={() => scegli(indice)}
            onKeyDown={(evento) => gestisciTasto(evento, indice)}
            className={twMerge(
              "flex-none whitespace-nowrap rounded-md px-3 py-1.5 text-slate-600 transition-colors",
              "hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
              scelta && "bg-white font-medium text-slate-800 shadow-sm ring-1 ring-slate-200"
            )}
          >
            {opzione.etichetta}
            {opzione.conteggio !== undefined && (
              <>
                {" "}
                <span className="tabular-nums text-slate-400">{formatNumero(opzione.conteggio)}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Segmenti;
