import { altezzaFoglio, CLASSI_TESTO, useTooltip, type ContenutoTooltip } from "@/components/Grafici";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useState, type KeyboardEvent, type SyntheticEvent } from "react";
import type { DensitaPagina } from "../../../../lib/insightVolantino/calore";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { descrizioneBox, tooltipBox } from "./box";
import type { StileRiquadro } from "./colori";
import { paginaNellImmagine, riquadroBox, stileImmagine, type PaginaNellImmagine } from "./geometria";
import { LivelloCalore } from "./LivelloCalore";

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
  /** Densità della mappa di calore della pagina, disegnata in un canvas sotto i riquadri. */
  densita?: DensitaPagina | null;
  /** Riquadri come contorni sottili, senza colore: si legge il calore sotto (vista "Mappa di calore"). */
  soloContorni?: boolean;
  /** Contenuto del tooltip di un box; predefinito tooltipBox. */
  tooltip?: (box: BoxInsight) => ContenutoTooltip;
}

/** Larghezza della pagina nelle coordinate del disegno: l'altezza segue la proporzione. */
const LARGHEZZA = 1000;
/** Spessore della cornice colorata dei riquadri. */
const CORNICE = 6;
/** Contorni sopra la mappa di calore, in pixel dello schermo (non-scaling-stroke): alone scuro e filo chiaro. */
const CONTORNO = { alone: 3, filo: 1.25, aloneScelto: 6, filoScelto: 2.5 } as const;

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
 *
 * Con la mappa di calore il canvas sta fra immagine e riquadri, nelle stesse coordinate dei
 * riquadri (la pagina rifilata), e i riquadri diventano contorni sottili: restano cliccabili.
 */
export function PaginaConImmagine({
  numero,
  lato,
  proporzione,
  immagine,
  box,
  stile,
  selezionato,
  onSeleziona,
  densita,
  soloContorni = false,
  tooltip: contenutoTooltip = tooltipBox,
}: PaginaConImmagineProps) {
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
      {densita && <LivelloCalore numero={numero} densita={densita} />}
      <svg viewBox={`0 0 ${LARGHEZZA} ${altezza}`} preserveAspectRatio="none" focusable="false" className="absolute inset-0 block h-full w-full">
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
              {...conTooltip(contenutoTooltip(voce))}
            >
              {soloContorni ? (
                <>
                  {/* Area attiva trasparente: il calore sotto resta visibile */}
                  <rect data-riquadro="" x={x} y={y} width={w} height={h} fill="transparent" />
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={scelto ? CONTORNO.aloneScelto : CONTORNO.alone}
                    className="stroke-slate-900/45 dark:stroke-slate-950/60"
                  />
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={scelto ? CONTORNO.filoScelto : CONTORNO.filo}
                    className={twMerge(
                      "stroke-white transition-opacity",
                      scelto ? "opacity-100" : "opacity-80 group-hover:opacity-100 group-focus-visible:opacity-100"
                    )}
                  />
                </>
              ) : (
                <>
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
                </>
              )}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                strokeWidth={scelto ? 5 : 3}
                className={twMerge(
                  "stroke-slate-900 dark:stroke-white",
                  scelto && !soloContorni ? "opacity-100" : "opacity-0",
                  !scelto && !soloContorni && "group-hover:opacity-60",
                  "group-focus-visible:opacity-100"
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
