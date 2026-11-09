import { altezzaFoglio, CLASSI_TESTO, useTooltip } from "@/components/Grafici";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useState, type KeyboardEvent, type SyntheticEvent } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { descrizioneBox, tooltipBox } from "./box";
import { TINTA_CALORE, type StileRiquadro } from "./colori";
import { paginaNellImmagine, riquadroBox, stileImmagine, type PaginaNellImmagine } from "./geometria";

export interface PaginaConImmagineProps {
  numero: number;
  /** Dove sta nella doppia pagina: decide il lato del numero e degli angoli arrotondati. */
  lato: "sinistra" | "destra" | "singola";
  /** Larghezza/altezza della pagina rifilata. */
  proporzione: number;
  /** Immagine della pagina da Olimpo; null: pagina bianca. */
  immagine: string | null;
  /** I box della pagina, con la geometria relativa alla pagina. */
  box: readonly BoxInsight[];
  stile: (box: BoxInsight) => StileRiquadro;
  selezionato: string | null;
  onSeleziona: (box: BoxInsight) => void;
  /** Mappa di calore della pagina (righe × colonne, valori 0-1), sotto i riquadri. */
  calore?: readonly (readonly number[])[] | null;
}

/** Larghezza della pagina nelle coordinate del disegno: l'altezza segue la proporzione. */
const LARGHEZZA = 1000;
/** Spessore della cornice colorata dei riquadri. */
const CORNICE = 6;

const arrotonda = (valore: number): number => Number(valore.toFixed(2));

/** Cornice del riquadro: il rettangolo meno quello interno (evenodd), riempita con la tinta del box. */
const percorsoCornice = (x: number, y: number, w: number, h: number, spessore: number): string => {
  const s = Math.min(spessore, w / 2, h / 2);
  return `M${x} ${y}h${w}v${h}h${-w}Z M${x + s} ${y + s}v${h - 2 * s}h${w - 2 * s}v${-(h - 2 * s)}Z`;
};

type EsitoImmagine = { url: string; pagina: PaginaNellImmagine | null };

/**
 * Una pagina del volantino: l'immagine vera da Olimpo, allineata alla pagina rifilata
 * (compensando l'abbondanza), con sopra i riquadri dei box. Senza immagine, o se Olimpo risponde
 * con il segnaposto, la pagina resta bianca con le sue proporzioni e i riquadri al loro posto.
 */
export function PaginaConImmagine({ numero, lato, proporzione, immagine, box, stile, selezionato, onSeleziona, calore }: PaginaConImmagineProps) {
  const { conTooltip, tooltip } = useTooltip();
  const [esito, setEsito] = useState<EsitoImmagine | null>(null);
  const altezza = altezzaFoglio(proporzione);

  // L'esito vale solo per l'immagine che lo ha prodotto: cambiando pagina si riparte dal bianco
  const allineamento = esito && esito.url === immagine ? esito.pagina : null;
  const statoImmagine = !immagine ? "assente" : !esito || esito.url !== immagine ? "caricamento" : allineamento ? "pronta" : "bianca";

  const caricata = (evento: SyntheticEvent<HTMLImageElement>) => {
    if (!immagine) return;
    const { naturalWidth, naturalHeight } = evento.currentTarget;
    setEsito({ url: immagine, pagina: paginaNellImmagine(naturalWidth, naturalHeight, proporzione) });
  };
  const nonCaricata = () => {
    if (immagine) setEsito({ url: immagine, pagina: null });
  };

  const tasto = (evento: KeyboardEvent, voce: BoxInsight) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onSeleziona(voce);
    }
  };

  // Il box scelto si disegna per ultimo, perché il contorno resti sopra i vicini
  const ordinati = [...box].sort((a, b) => Number(a.id === selezionato) - Number(b.id === selezionato));
  const righeCalore = calore?.length ?? 0;

  return (
    <div
      role="group"
      aria-label={`Pagina ${numero}`}
      data-testid={`pagina-${numero}`}
      data-immagine={statoImmagine}
      className={twMerge(
        "relative min-w-0 overflow-hidden border border-slate-200 bg-white shadow-card dark:border-darkmode-400 dark:bg-darkmode-700",
        lato === "sinistra" && "rounded-l-control border-r-0",
        lato === "destra" && "rounded-r-control",
        lato === "singola" && "rounded-control"
      )}
      style={{ aspectRatio: String(proporzione), flex: `${proporzione} 1 0%` }}
    >
      {immagine && (
        <img
          key={immagine}
          src={immagine}
          alt={allineamento ? `Pagina ${numero} del volantino` : ""}
          aria-hidden={allineamento ? undefined : true}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={caricata}
          onError={nonCaricata}
          className={twMerge("pointer-events-none absolute max-w-none select-none", !allineamento && "invisible")}
          style={allineamento ? stileImmagine(allineamento) : { left: 0, top: 0, width: "100%", height: "100%" }}
        />
      )}
      <svg viewBox={`0 0 ${LARGHEZZA} ${altezza}`} preserveAspectRatio="none" focusable="false" className="absolute inset-0 block h-full w-full">
        {righeCalore > 0 && (
          <g data-testid={`calore-${numero}`} aria-hidden="true" className="pointer-events-none">
            {calore!.map((riga, r) =>
              riga.map((valore, c) => {
                const colonne = riga.length || 1;
                return (
                  <rect
                    key={`${r}-${c}`}
                    x={arrotonda((c * LARGHEZZA) / colonne)}
                    y={arrotonda((r * altezza) / righeCalore)}
                    width={arrotonda(LARGHEZZA / colonne)}
                    height={arrotonda(altezza / righeCalore)}
                    fillOpacity={Math.max(0, Math.min(1, valore)) * 0.55}
                    className={TINTA_CALORE.classe}
                  />
                );
              })
            )}
          </g>
        )}
        {ordinati.map(voce => {
          const riquadro = riquadroBox(voce.geometria);
          if (!riquadro) return null;
          const x = arrotonda(riquadro.x * LARGHEZZA);
          const y = arrotonda(riquadro.y * altezza);
          const w = arrotonda(riquadro.w * LARGHEZZA);
          const h = arrotonda(riquadro.h * altezza);
          const { tinta, attenuato } = stile(voce);
          const scelto = voce.id === selezionato;
          return (
            <g
              key={voce.id}
              role="button"
              tabIndex={0}
              aria-label={descrizioneBox(voce)}
              aria-pressed={scelto}
              data-testid={`box-${voce.id}`}
              onClick={() => onSeleziona(voce)}
              onKeyDown={evento => tasto(evento, voce)}
              className="group cursor-pointer outline-none"
              {...conTooltip(tooltipBox(voce))}
            >
              {/* Velo leggero sopra il prodotto: si schiarisce al passaggio, per vedere cosa c'è sotto */}
              <rect
                data-riquadro=""
                x={x}
                y={y}
                width={w}
                height={h}
                fill={tinta.colore}
                className={twMerge(
                  tinta.classe,
                  "transition-opacity group-hover:opacity-10 group-focus-visible:opacity-10",
                  attenuato ? "opacity-10" : "opacity-35"
                )}
              />
              <path
                d={percorsoCornice(x, y, w, h, scelto ? CORNICE * 2 : CORNICE)}
                fillRule="evenodd"
                fill={tinta.colore}
                className={twMerge(tinta.classe, attenuato && !scelto && "opacity-50")}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                strokeWidth={scelto ? 5 : 3}
                className={twMerge(
                  "stroke-slate-900 dark:stroke-white",
                  scelto ? "opacity-100" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-100"
                )}
              />
            </g>
          );
        })}
        {box.length === 0 && statoImmagine !== "pronta" && (
          <text x={LARGHEZZA / 2} y={altezza / 2} textAnchor="middle" fontSize={30} className={CLASSI_TESTO.tenue}>
            Nessun box in questa pagina
          </text>
        )}
      </svg>
      <span
        aria-hidden="true"
        className={twMerge(
          "pointer-events-none absolute bottom-1 rounded-control bg-white/90 px-1.5 py-0.5 text-3xs font-semibold tabular-nums text-slate-600 shadow-sm dark:bg-darkmode-600/90 dark:text-slate-300",
          lato === "sinistra" ? "left-1" : "right-1"
        )}
      >
        {formatNumero(numero)}
      </span>
      {tooltip}
    </div>
  );
}

export default PaginaConImmagine;
