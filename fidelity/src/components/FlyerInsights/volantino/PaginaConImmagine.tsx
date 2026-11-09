import { altezzaFoglio, CLASSI_TESTO, useTooltip } from "@/components/Grafici";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject, type SyntheticEvent } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { descrizioneBox, tooltipBox } from "./box";
import type { StileRiquadro } from "./colori";
import { paginaNellImmagine, riquadroBox, stileImmagine, type PaginaNellImmagine } from "./geometria";
import { useDisegnoPdf } from "./pdfVolantino";

export interface PaginaConImmagineProps {
  numero: number;
  /** Dove sta il numero della pagina e quali angoli sono arrotondati; nel lettore le pagine sono singole. */
  lato?: "sinistra" | "destra" | "singola";
  /**
   * La pagina è vicina alla parte visibile del lettore: solo allora si disegna. Lontana, resta la
   * pagina con i riquadri, e il suo disegno si libera (lo si rifà quando torna vicina).
   */
  attiva?: boolean;
  /** Larghezza/altezza della pagina rifilata. */
  proporzione: number;
  /** Il PDF del volantino, già aperto: la pagina si disegna da qui. null: nessun PDF da disegnare. */
  pdf?: PDFDocumentProxy | null;
  /** Il PDF si sta ancora aprendo: la pagina aspetta, con i riquadri già al loro posto. */
  inAttesa?: boolean;
  /** Immagine della pagina da Olimpo, di riserva quando il PDF o la pagina non si leggono; null: pagina bianca. */
  immagine: string | null;
  /** I box della pagina, con la geometria relativa alla pagina. */
  box: readonly BoxInsight[];
  stile: (box: BoxInsight) => StileRiquadro;
  selezionato: string | null;
  onSeleziona: (box: BoxInsight) => void;
}

/** Larghezza della pagina nelle coordinate del disegno: l'altezza segue la proporzione. */
const LARGHEZZA = 1000;
/** Spessore della cornice colorata dei riquadri. */
const CORNICE = 6;
/**
 * Il disegno del PDF comprende l'abbondanza, che resta fuori dalla pagina rifilata: si disegna un
 * po' più largo della pagina mostrata, perché la parte visibile abbia tutti i pixel che servono.
 */
const MARGINE_ABBONDANZA = 1.1;

const arrotonda = (valore: number): number => Number(valore.toFixed(2));

/** Cornice del riquadro: il rettangolo meno quello interno (evenodd), riempita con la tinta del box. */
const percorsoCornice = (x: number, y: number, w: number, h: number, spessore: number): string => {
  const s = Math.min(spessore, w / 2, h / 2);
  return `M${x} ${y}h${w}v${h}h${-w}Z M${x + s} ${y + s}v${h - 2 * s}h${w - 2 * s}v${-(h - 2 * s)}Z`;
};

type EsitoImmagine = { url: string; pagina: PaginaNellImmagine | null };

/** Larghezza in pixel CSS dell'elemento, aggiornata quando cambia (ingrandimento, finestra). */
function useLarghezza(elemento: RefObject<HTMLElement | null>): number {
  const [larghezza, setLarghezza] = useState(0);
  useEffect(() => {
    const nodo = elemento.current;
    if (!nodo) return;
    const misura = () => setLarghezza(nodo.getBoundingClientRect().width);
    misura();
    if (typeof ResizeObserver === "undefined") return;
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [elemento]);
  return larghezza;
}

/**
 * Una pagina del volantino, disegnata dal PDF e allineata alla pagina rifilata (compensando
 * l'abbondanza), con sopra i riquadri dei box. Il disegno segue la grandezza in cui la pagina si vede,
 * quindi resta nitido quando si ingrandisce. Se il PDF non si legge si usa l'immagine di Olimpo; senza
 * nessuna delle due, o se Olimpo risponde con il segnaposto, la pagina resta bianca con le sue
 * proporzioni e i riquadri al loro posto.
 */
export function PaginaConImmagine({
  numero,
  lato = "singola",
  attiva = true,
  proporzione,
  pdf: pdfDisponibile = null,
  inAttesa: inAttesaDelPdf = false,
  immagine: immagineDisponibile,
  box,
  stile,
  selezionato,
  onSeleziona,
}: PaginaConImmagineProps) {
  const { conTooltip, tooltip } = useTooltip();
  // Lontana dalla vista la pagina non disegna e non chiede nulla: aspetta di tornare vicina
  const pdf = attiva ? pdfDisponibile : null;
  const immagine = attiva ? immagineDisponibile : null;
  const inAttesa = inAttesaDelPdf || (!attiva && Boolean(pdfDisponibile || immagineDisponibile));
  const contenitore = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [esito, setEsito] = useState<EsitoImmagine | null>(null);
  const altezza = altezzaFoglio(proporzione);

  // Il PDF, disegnato alla grandezza in cui la pagina si vede: ingrandendo si ridisegna
  const larghezzaPagina = useLarghezza(contenitore);
  const disegno = useDisegnoPdf(pdf, numero, canvas, larghezzaPagina * MARGINE_ABBONDANZA);
  const larghezzaPdf = disegno.stato === "pronta" ? disegno.misure.larghezza : 0;
  const altezzaPdf = disegno.stato === "pronta" ? disegno.misure.altezza : 0;
  const allineamentoPdf = useMemo(
    () => (larghezzaPdf > 0 ? paginaNellImmagine(larghezzaPdf, altezzaPdf, proporzione) : null),
    [larghezzaPdf, altezzaPdf, proporzione]
  );

  // Il PDF che non si disegna lascia il posto all'immagine di Olimpo; mentre il PDF si apre non si
  // chiede nessuna immagine, la pagina aspetta
  const riserva = immagine ? "immagine" : "nessuna";
  const sorgente = pdf ? (disegno.stato !== "errore" ? "pdf" : riserva) : inAttesa ? "nessuna" : riserva;

  // L'esito vale solo per l'immagine che lo ha prodotto: cambiando pagina si riparte dal bianco
  const allineamentoImmagine = esito && esito.url === immagine ? esito.pagina : null;
  const allineamento = sorgente === "pdf" ? allineamentoPdf : allineamentoImmagine;
  const statoImmagine =
    sorgente === "pdf"
      ? disegno.stato === "caricamento"
        ? "caricamento"
        : allineamentoPdf
          ? "pronta"
          : "bianca"
      : sorgente === "immagine"
        ? !esito || esito.url !== immagine
          ? "caricamento"
          : allineamentoImmagine
            ? "pronta"
            : "bianca"
        : inAttesa
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

  // Il box scelto si disegna per ultimo, perché il contorno resti sopra i vicini
  const ordinati = [...box].sort((a, b) => Number(a.id === selezionato) - Number(b.id === selezionato));
  const posizione = allineamento ? stileImmagine(allineamento) : { left: 0, top: 0, width: "100%", height: "100%" };

  return (
    <div
      ref={contenitore}
      role="group"
      aria-label={`Pagina ${numero}`}
      data-testid={`pagina-${numero}`}
      data-immagine={statoImmagine}
      data-sorgente={sorgente}
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
      {sorgente === "pdf" && (
        <canvas
          ref={canvas}
          role={allineamentoPdf ? "img" : undefined}
          aria-label={allineamentoPdf ? `Pagina ${numero} del volantino` : undefined}
          aria-hidden={allineamentoPdf ? undefined : true}
          className={twMerge("pointer-events-none absolute max-w-none select-none", !allineamentoPdf && "invisible")}
          style={posizione}
        />
      )}
      {sorgente === "immagine" && immagine && (
        <img
          key={immagine}
          src={immagine}
          alt={allineamentoImmagine ? `Pagina ${numero} del volantino` : ""}
          aria-hidden={allineamentoImmagine ? undefined : true}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={caricata}
          onError={nonCaricata}
          className={twMerge("pointer-events-none absolute max-w-none select-none", !allineamentoImmagine && "invisible")}
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
