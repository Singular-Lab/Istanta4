import { altezzaFoglio, CLASSI_TESTO, useTooltip } from "@/components/Grafici";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { memo, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { descrizioneBox, tooltipBox } from "./box";
import type { StileRiquadro } from "./colori";
import { paginaNellImmagine, riquadroBox, stileImmagine, type PaginaNellImmagine } from "./geometria";

export interface PaginaConImmagineProps {
  numero: number;
  /** Dove sta il numero della pagina e quali angoli sono arrotondati; nel lettore le pagine sono singole. */
  lato?: "sinistra" | "destra" | "singola";
  /**
   * La pagina è vicina alla parte visibile del lettore: solo allora chiede la sua immagine. Lontana,
   * resta la pagina con i riquadri.
   */
  attiva?: boolean;
  /** Larghezza/altezza della pagina rifilata. */
  proporzione: number;
  /** Immagine della pagina da Olimpo; null: pagina bianca. */
  immagine: string | null;
  /** I box della pagina, con la geometria relativa alla pagina. */
  box: readonly BoxInsight[];
  stile: (box: BoxInsight) => StileRiquadro;
  selezionato: string | null;
  onSeleziona: (box: BoxInsight) => void;
  /** I box trovati dalla ricerca: gli altri si attenuano. null: nessuna ricerca, tutti come sempre. */
  trovati?: ReadonlySet<string> | null;
  /** Il box messo in rilievo (dall'elenco della pagina o dal risultato della ricerca), se è di questa pagina. */
  rilievo?: string | null;
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
 * Una pagina del volantino: l'immagine della pagina data da Olimpo, allineata alla pagina rifilata
 * (compensando l'abbondanza), con sopra i riquadri dei box. Senza immagine, o se Olimpo risponde con
 * il segnaposto, la pagina resta bianca con le sue proporzioni e i riquadri al loro posto.
 */
function PaginaConImmagineBase({
  numero,
  lato = "singola",
  attiva = true,
  proporzione,
  immagine: immagineDisponibile,
  box,
  stile,
  selezionato,
  onSeleziona,
  trovati = null,
  rilievo = null,
}: PaginaConImmagineProps) {
  const { conTooltip, tooltip } = useTooltip();
  // Lontana dalla vista la pagina non chiede la sua immagine: aspetta di tornare vicina
  const immagine = attiva ? immagineDisponibile : null;
  const [esito, setEsito] = useState<EsitoImmagine | null>(null);
  const altezza = altezzaFoglio(proporzione);

  // L'esito vale solo per l'immagine che lo ha prodotto: cambiando pagina si riparte dal bianco
  const allineamento = esito && esito.url === immagine ? esito.pagina : null;
  const statoImmagine = immagine
    ? !esito || esito.url !== immagine
      ? "caricamento"
      : allineamento
        ? "pronta"
        : "bianca"
    : immagineDisponibile
      ? "caricamento"
      : "assente";

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

  // Il box scelto e quello in rilievo si disegnano per ultimi, perché il contorno resti sopra i vicini
  const peso = (voce: BoxInsight) => Number(voce.id === selezionato) + Number(voce.id === rilievo);
  const ordinati = [...box].sort((a, b) => peso(a) - peso(b));
  const posizione = allineamento ? stileImmagine(allineamento) : { left: 0, top: 0, width: "100%", height: "100%" };

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
      {/* Mentre la pagina arriva il fondo pulsa piano: i riquadri sono già al loro posto */}
      {statoImmagine === "caricamento" && (
        <span aria-hidden="true" className="absolute inset-0 bg-slate-100 motion-safe:animate-pulse dark:bg-darkmode-600" />
      )}
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
          style={posizione}
        />
      )}
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
          const inRilievo = voce.id === rilievo;
          const trovato = trovati?.has(voce.id) ?? false;
          // Con una ricerca in corso i box non trovati passano in secondo piano
          const fuoriRicerca = trovati !== null && !trovato && !scelto;
          return (
            <g
              key={voce.id}
              role="button"
              tabIndex={0}
              aria-label={descrizioneBox(voce)}
              aria-pressed={scelto}
              data-testid={`box-${voce.id}`}
              data-trovato={trovato ? "" : undefined}
              data-attenuato={fuoriRicerca ? "" : undefined}
              data-rilievo={inRilievo ? "" : undefined}
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
                  fuoriRicerca ? "opacity-0" : attenuato ? "opacity-10" : "opacity-35"
                )}
              />
              <path
                d={percorsoCornice(x, y, w, h, scelto || inRilievo ? CORNICE * 2 : CORNICE)}
                fillRule="evenodd"
                fill={tinta.colore}
                className={twMerge(tinta.classe, "transition-opacity", fuoriRicerca ? "opacity-15" : attenuato && !scelto && !inRilievo && "opacity-50")}
              />
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                strokeWidth={scelto || inRilievo ? 5 : 3}
                className={twMerge(
                  "stroke-slate-900 transition-opacity dark:stroke-white",
                  scelto || inRilievo ? "opacity-100" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-100"
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

/**
 * La pagina si ridisegna solo quando cambia qualcosa di suo: passando sull'elenco dei box non si
 * ridisegnano tutte le pagine del volantino.
 */
export const PaginaConImmagine = memo(PaginaConImmagineBase);

export default PaginaConImmagine;
