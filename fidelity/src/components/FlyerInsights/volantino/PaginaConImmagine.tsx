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
  /** Solo la pagina stampata, senza i box: niente veli, tooltip né clic (lettura "Solo il volantino"). */
  senzaRiquadri?: boolean;
  /**
   * Caricata l'immagine della pagina: l'altezza della pagina rifilata in pixel dell'immagine, per
   * sapere fin dove si può ingrandire senza sgranare.
   */
  onRisoluzione?: (pixelPagina: number) => void;
}

/** Larghezza della pagina nelle coordinate del disegno: l'altezza segue la proporzione. */
const LARGHEZZA = 1000;

const arrotonda = (valore: number): number => Number(valore.toFixed(2));

type EsitoImmagine = { url: string; pagina: PaginaNellImmagine | null };

interface StatoRiquadro {
  /** Una ricerca è in corso e il box non è fra i trovati. */
  fuoriRicerca: boolean;
  trovato: boolean;
  /** Il box è scelto o in rilievo. */
  inEvidenza: boolean;
}

/**
 * Il velo colorato del box, mai un bordo, e il box sempre nascosto: la pagina resta come stampata.
 * Il velo compare leggero al passaggio del puntatore o del fuoco e sui box trovati, più forte sul box
 * scelto o in rilievo.
 *
 * Il passaggio è quello sul box stesso (gruppo "box"): il layout dell'app ha contenitori con la
 * classe group, e un group-hover senza nome si accenderebbe con il mouse in un punto qualsiasi.
 */
function classeVelo({ fuoriRicerca, trovato, inEvidenza }: StatoRiquadro): string {
  if (inEvidenza) return "opacity-60";
  if (fuoriRicerca) return "opacity-0";
  return twMerge("group-hover/box:opacity-25 group-focus-visible/box:opacity-60", trovato ? "opacity-30" : "opacity-0");
}

/** Il fuoco è arrivato da tastiera: solo allora il riquadrino si apre al fuoco, non quando torna dopo un clic. */
const fuocoDaTastiera = (elemento: Element): boolean => {
  try {
    return elemento.matches(":focus-visible");
  } catch {
    return true;
  }
};

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
  senzaRiquadri = false,
  onRisoluzione,
}: PaginaConImmagineProps) {
  const { conTooltip, nascondi, tooltip } = useTooltip();
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
    const pagina = paginaNellImmagine(naturalWidth, naturalHeight, proporzione);
    setEsito({ url: immagine, pagina });
    if (pagina) onRisoluzione?.(naturalHeight * pagina.h);
  };
  const nonCaricata = () => {
    if (immagine) setEsito({ url: immagine, pagina: null });
  };

  // Aprendo la scheda il riquadrino si chiude: la scheda dice già tutto, e al ritorno non resta appeso
  const apri = (voce: BoxInsight) => {
    nascondi();
    onSeleziona(voce);
  };
  const tasto = (evento: KeyboardEvent, voce: BoxInsight) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      apri(voce);
    }
  };

  // Il box scelto e quello in rilievo si disegnano per ultimi, perché il loro velo resti sopra i vicini
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
        {!senzaRiquadri && ordinati.map(voce => {
          const riquadro = riquadroBox(voce.geometria);
          if (!riquadro) return null;
          const x = arrotonda(riquadro.x * LARGHEZZA);
          const y = arrotonda(riquadro.y * altezza);
          const w = arrotonda(riquadro.w * LARGHEZZA);
          const h = arrotonda(riquadro.h * altezza);
          const { tinta } = stile(voce);
          const scelto = voce.id === selezionato;
          const inRilievo = voce.id === rilievo;
          const trovato = trovati?.has(voce.id) ?? false;
          // Con una ricerca in corso i box non trovati passano in secondo piano
          const fuoriRicerca = trovati !== null && !trovato && !scelto;
          const inEvidenza = scelto || inRilievo;
          const { onFocus, ...gestoriTooltip } = conTooltip(tooltipBox(voce));
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
              onClick={() => apri(voce)}
              onKeyDown={evento => tasto(evento, voce)}
              className="group/box cursor-pointer outline-none"
              {...gestoriTooltip}
              onFocus={evento => {
                // Chiusa la scheda il fuoco torna sul box: senza tastiera il riquadrino non si riapre
                if (fuocoDaTastiera(evento.currentTarget)) onFocus(evento);
              }}
            >
              {/* Il velo del colore del box, senza bordi: trasparente si clicca ancora, perché
                  l'opacità non toglie il clic */}
              <rect
                data-riquadro=""
                x={x}
                y={y}
                width={w}
                height={h}
                fill={tinta.colore}
                className={twMerge(tinta.classe, "transition-opacity", classeVelo({ fuoriRicerca, trovato, inEvidenza }))}
              />
            </g>
          );
        })}
        {!senzaRiquadri && box.length === 0 && statoImmagine !== "pronta" && (
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
