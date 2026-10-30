import { twMerge } from "@/utils/twMerge";
import type { KeyboardEvent } from "react";
import { TINTA_NEUTRA, TINTA_PRINCIPALE, type Tinta } from "./colori";
import { useTooltip, type ContenutoTooltip } from "./Tooltip";

/** Un box nella pagina, con la geometria relativa alla pagina (da 0 a 1). */
export interface BoxPagina {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tinta: Tinta;
  /** Testo breve dentro il box, se c'è spazio (per esempio "−43%"). */
  etichetta?: string;
  /** Nome del box per le tecnologie assistive ("Mozzarella Granarolo, sconto 43%"). */
  descrizione: string;
  tooltip: ContenutoTooltip;
  /** Box senza una destinazione: non si clicca. */
  disattivato?: boolean;
}

export interface PaginaVolantinoProps {
  /** Rapporto larghezza/altezza della pagina. */
  proporzione: number;
  boxes: BoxPagina[];
  selezionato?: string | null;
  /** Clic (o Invio) su un box. */
  onSeleziona?: (id: string) => void;
  /** Nome della pagina per le tecnologie assistive ("Pagina 2 del volantino"). */
  titolo: string;
  /** Testo al centro di una pagina senza box. */
  vuota?: string;
  className?: string;
}

/** Larghezza del foglio nelle coordinate del disegno: l'altezza segue la proporzione. */
const LARGHEZZA_FOGLIO = 1000;
/** Metà dello stacco di superficie fra due box vicini. */
const STACCO = 3;

/** Altezza del foglio nelle coordinate del disegno, con una proporzione ragionevole. */
export const altezzaFoglio = (proporzione: number): number =>
  LARGHEZZA_FOGLIO / (Number.isFinite(proporzione) && proporzione > 0.2 && proporzione < 5 ? proporzione : 210 / 297);

/**
 * Una pagina del volantino con i box al loro posto, colorati dal chiamante (sconto, meccanica,
 * reparto): tooltip su ogni box, quello scelto contornato, clic per aprirlo.
 */
export function PaginaVolantino({ proporzione, boxes, selezionato = null, onSeleziona, titolo, vuota = "Nessun box in questa pagina", className }: PaginaVolantinoProps) {
  const { conTooltip, tooltip } = useTooltip();
  const altezza = altezzaFoglio(proporzione);

  const tasto = (evento: KeyboardEvent, id: string) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onSeleziona?.(id);
    }
  };

  // Il box scelto si disegna per ultimo, perché il contorno resti sopra i vicini
  const ordinati = [...boxes].sort((a, b) => Number(a.id === selezionato) - Number(b.id === selezionato));

  return (
    <div className={twMerge("overflow-hidden rounded-control border border-slate-200 bg-white shadow-card dark:border-darkmode-400 dark:bg-darkmode-700", className)}>
      <svg role="group" aria-label={titolo} viewBox={`0 0 ${LARGHEZZA_FOGLIO} ${altezza}`} className="block h-auto w-full">
        {boxes.length === 0 && (
          <text x={LARGHEZZA_FOGLIO / 2} y={altezza / 2} textAnchor="middle" fontSize={34} className="fill-slate-400">
            {vuota}
          </text>
        )}
        {ordinati.map(box => {
          const x = box.x * LARGHEZZA_FOGLIO + STACCO;
          const y = box.y * altezza + STACCO;
          const w = Math.max(4, box.w * LARGHEZZA_FOGLIO - 2 * STACCO);
          const h = Math.max(4, box.h * altezza - 2 * STACCO);
          const scelto = box.id === selezionato;
          const attivo = Boolean(onSeleziona) && !box.disattivato;
          const dimensioneTesto = Math.min(30, Math.max(18, w / 7));
          return (
            <g
              key={box.id}
              role={attivo ? "button" : "img"}
              aria-label={box.descrizione}
              aria-pressed={attivo ? scelto : undefined}
              tabIndex={attivo ? 0 : undefined}
              onClick={attivo ? () => onSeleziona?.(box.id) : undefined}
              onKeyDown={attivo ? evento => tasto(evento, box.id) : undefined}
              className={twMerge("group outline-none", attivo && "cursor-pointer")}
              {...conTooltip(box.tooltip)}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={6}
                fill={box.tinta.colore}
                className={twMerge(box.tinta.classe ?? TINTA_NEUTRA.classe, "transition-opacity group-hover:opacity-85 group-focus-visible:opacity-85")}
              />
              {(scelto || attivo) && (
                <rect
                  x={x + 3}
                  y={y + 3}
                  width={Math.max(0, w - 6)}
                  height={Math.max(0, h - 6)}
                  rx={4}
                  fill="none"
                  strokeWidth={6}
                  className={twMerge(
                    "stroke-slate-900 dark:stroke-white",
                    scelto ? "opacity-100" : "opacity-0 group-focus-visible:opacity-60"
                  )}
                />
              )}
              {box.etichetta && w > dimensioneTesto * 3.2 && h > dimensioneTesto * 1.6 && (
                <text x={x + 10} y={y + 10 + dimensioneTesto} fontSize={dimensioneTesto} className={twMerge("pointer-events-none font-bold tabular-nums", box.tinta.classeTesto)}>
                  {box.etichetta}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip}
    </div>
  );
}

export interface MiniaturaPaginaProps {
  proporzione: number;
  /** Box della pagina (geometria da 0 a 1); quello evidenziato prende il colore della serie. */
  boxes: Array<{ x: number; y: number; w: number; h: number; tinta?: Tinta; evidenziato?: boolean }>;
  /** Nome per le tecnologie assistive; senza, la miniatura è decorativa. */
  titolo?: string;
  className?: string;
}

/** Miniatura di una pagina: i box come rettangoli pieni, senza interazione. */
export function MiniaturaPagina({ proporzione, boxes, titolo, className }: MiniaturaPaginaProps) {
  const altezza = altezzaFoglio(proporzione);
  return (
    <svg
      role={titolo ? "img" : undefined}
      aria-label={titolo}
      aria-hidden={titolo ? undefined : true}
      viewBox={`0 0 ${LARGHEZZA_FOGLIO} ${altezza}`}
      className={twMerge("block h-auto w-full rounded-sm border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-700", className)}
    >
      {boxes.map((box, i) => {
        const tinta = box.evidenziato ? TINTA_PRINCIPALE : (box.tinta ?? TINTA_NEUTRA);
        return (
          <rect
            key={i}
            data-evidenziato={box.evidenziato || undefined}
            x={box.x * LARGHEZZA_FOGLIO + 8}
            y={box.y * altezza + 8}
            width={Math.max(4, box.w * LARGHEZZA_FOGLIO - 16)}
            height={Math.max(4, box.h * altezza - 16)}
            rx={12}
            fill={tinta.colore}
            className={tinta.classe}
          />
        );
      })}
    </svg>
  );
}

export default PaginaVolantino;
