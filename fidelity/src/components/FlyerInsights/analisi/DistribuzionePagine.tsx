import { CLASSI_ASSI, CLASSI_TESTO, Legenda, SERIE_PRINCIPALE, TabellaDati, useLarghezza, useTooltip, type Tinta } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo, type KeyboardEvent } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { coloriReparti, gruppoBox, type GruppoBox } from "../volantino/colori";
import { pagineDaSfogliare } from "../volantino/geometria";

/**
 * "Distribuzione nelle pagine": una colonna per pagina, alta quanto lo spazio della pagina coperto
 * dai box e divisa per reparto, con gli stessi colori del volantino sfogliabile. Scegliendo una
 * colonna il volantino va a quella pagina. Niente calore, visibilità o vendite (spec insight-volantino).
 */

export interface ParteColonna extends GruppoBox {
  box: number;
  /** Spazio della pagina occupato dai box del reparto, in %. */
  spazio: number;
}

export interface ColonnaPagina {
  pagina: number;
  /** Box della pagina, anche quelli senza posizione. */
  box: number;
  /** Spazio della pagina coperto dai box, in % (al più 100 anche se i riquadri si sovrappongono). */
  occupato: number;
  /** Dal basso: nello stesso ordine in tutte le pagine, dal reparto con più spazio nel volantino. */
  parti: ParteColonna[];
}

const spazioDi = (box: Pick<BoxInsight, "spazio">): number => (Number.isFinite(box.spazio) && box.spazio > 0 ? box.spazio : 0);

/**
 * Le colonne delle pagine da 1 a `totale`: box e spazio per reparto (o per il gruppo dato). I reparti
 * stanno nello stesso ordine in ogni colonna, dal più grande nel volantino; i box senza reparto in cima.
 */
export const distribuzionePagine = <T extends Pick<BoxInsight, "pagina" | "spazio">>(
  box: readonly T[],
  totale: number,
  gruppo: (box: T) => GruppoBox
): ColonnaPagina[] => {
  const totaliGruppo = new Map<string, number>();
  const perPagina = new Map<number, Map<string, ParteColonna>>();
  const contiPagina = new Map<number, number>();
  for (const voce of box) {
    if (voce.pagina === null || voce.pagina < 1) continue;
    contiPagina.set(voce.pagina, (contiPagina.get(voce.pagina) ?? 0) + 1);
    const suo = gruppo(voce);
    const spazio = spazioDi(voce);
    totaliGruppo.set(suo.id, (totaliGruppo.get(suo.id) ?? 0) + spazio);
    const parti = perPagina.get(voce.pagina) ?? new Map<string, ParteColonna>();
    const parte = parti.get(suo.id);
    if (parte) {
      parte.box += 1;
      parte.spazio += spazio;
    } else {
      parti.set(suo.id, { ...suo, box: 1, spazio });
    }
    perPagina.set(voce.pagina, parti);
  }
  const ordine = (a: ParteColonna, b: ParteColonna): number =>
    Number(a.id === "senza") - Number(b.id === "senza") ||
    (totaliGruppo.get(b.id) ?? 0) - (totaliGruppo.get(a.id) ?? 0) ||
    a.etichetta.localeCompare(b.etichetta, "it");

  return Array.from({ length: Math.max(0, Math.floor(totale)) }, (_, posto) => {
    const pagina = posto + 1;
    const parti = [...(perPagina.get(pagina)?.values() ?? [])].sort(ordine);
    const somma = parti.reduce((totaleParti, parte) => totaleParti + parte.spazio, 0);
    return { pagina, box: contiPagina.get(pagina) ?? 0, occupato: Math.min(100, somma), parti };
  });
};

export interface DistribuzionePagineProps {
  box: readonly BoxInsight[];
  /** Le pagine del volantino: le stesse del volantino sfogliabile. */
  totalePagine: number;
  /** La config dell'installazione, per gli stessi colori dei reparti del volantino. */
  configurazione?: FlyerInsightsConfig;
  /** La pagina guardata nel volantino, in evidenza. */
  paginaCorrente?: number;
  /** Rende le colonne pulsanti che portano il volantino alla pagina. */
  onVaiAllaPagina?: (pagina: number) => void;
  className?: string;
}

const ALTEZZA = 180;
const MARGINE_ALTO = 8;
const MARGINE_SINISTRO = 40;
/** Sotto le colonne: il numero della pagina e i box. */
const MARGINE_BASSO = 36;
/** Sotto questa larghezza per pagina il grafico scorre in orizzontale invece di stringersi. */
const FASCIA_MINIMA = 44;
const LARGHEZZA_MASSIMA_COLONNA = 56;
const TACCHE = [0, 25, 50, 75, 100];

const contaBox = (numero: number): string => (numero === 1 ? "1 box" : `${formatNumero(numero)} box`);

/** Il segno della serie nel tooltip: il colore della tinta, o un grigio per le tinte a classi. */
const chiaveTooltip = (tinta: Tinta) => (tinta.colore ? { colore: tinta.colore } : { classe: "bg-slate-300 dark:bg-darkmode-300" });

const descrizioneColonna = (colonna: ColonnaPagina): string =>
  [
    `Pagina ${colonna.pagina}: ${contaBox(colonna.box)}, ${formatPercentuale(colonna.occupato, 0)} della pagina coperto`,
    ...colonna.parti.map(parte => `${parte.etichetta} ${formatPercentuale(parte.spazio, 0)}`),
  ].join("; ");

export function DistribuzionePagine({ box, totalePagine, configurazione, paginaCorrente, onVaiAllaPagina, className }: DistribuzionePagineProps) {
  const [contenitore, larghezzaDisponibile] = useLarghezza<HTMLElement>(640);
  const { conTooltip, tooltip } = useTooltip();
  const reparti = useMemo(() => coloriReparti(box, configurazione), [box, configurazione]);
  const totale = pagineDaSfogliare(totalePagine, box);
  const colonne = useMemo(() => distribuzionePagine(box, totale, voce => gruppoBox(voce, "reparto", reparti)), [box, totale, reparti]);

  const titolo = "Spazio delle pagine per reparto";
  const larghezza = Math.max(larghezzaDisponibile, MARGINE_SINISTRO + colonne.length * FASCIA_MINIMA);
  const fascia = (larghezza - MARGINE_SINISTRO) / Math.max(1, colonne.length);
  const larghezzaColonna = Math.max(8, Math.min(LARGHEZZA_MASSIMA_COLONNA, fascia - 12));
  const base = MARGINE_ALTO + ALTEZZA;
  const y = (percentuale: number) => base - (Math.max(0, Math.min(100, percentuale)) / 100) * ALTEZZA;

  const tasto = (evento: KeyboardEvent, pagina: number) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onVaiAllaPagina?.(pagina);
    }
  };

  return (
    <figure ref={contenitore} className={twMerge("m-0 min-w-0 space-y-3", className)}>
      {/* Con molte pagine il grafico non si stringe: scorre in orizzontale */}
      <div className="overflow-x-auto overscroll-x-contain pb-1" data-testid="scorrimento-distribuzione">
        <svg
          role="group"
          aria-label={titolo}
          width={larghezza}
          height={base + MARGINE_BASSO}
          viewBox={`0 0 ${larghezza} ${base + MARGINE_BASSO}`}
          className="block overflow-visible"
        >
          {TACCHE.map(tacca => (
            <g key={tacca} aria-hidden="true">
              <line x1={MARGINE_SINISTRO - 4} x2={larghezza} y1={y(tacca) + 0.5} y2={y(tacca) + 0.5} className={tacca === 0 ? CLASSI_ASSI.base : CLASSI_ASSI.griglia} />
              <text x={MARGINE_SINISTRO - 8} y={y(tacca)} dominantBaseline="central" textAnchor="end" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
                {tacca}%
              </text>
            </g>
          ))}
          {colonne.map((colonna, i) => {
            const xFascia = MARGINE_SINISTRO + i * fascia;
            const x = xFascia + (fascia - larghezzaColonna) / 2;
            const corrente = colonna.pagina === paginaCorrente;
            // Riquadri che si sovrappongono possono sommare oltre la pagina: le parti si riportano al 100%
            const somma = colonna.parti.reduce((totaleParti, parte) => totaleParti + parte.spazio, 0);
            const fattore = somma > 100 ? 100 / somma : 1;
            let cima = 0;
            return (
              <g
                key={colonna.pagina}
                data-pagina={colonna.pagina}
                data-corrente={corrente || undefined}
                {...conTooltip({
                  titolo: `Pagina ${colonna.pagina}`,
                  sottotitolo: `${contaBox(colonna.box)} · ${formatPercentuale(colonna.occupato, 0)} della pagina coperto`,
                  righe: colonna.parti.map(parte => ({ etichetta: parte.etichetta, valore: formatPercentuale(parte.spazio, 0), chiave: chiaveTooltip(parte.tinta) })),
                })}
                role={onVaiAllaPagina ? "button" : undefined}
                tabIndex={onVaiAllaPagina ? 0 : undefined}
                aria-label={onVaiAllaPagina ? descrizioneColonna(colonna) : undefined}
                aria-current={onVaiAllaPagina && corrente ? "page" : undefined}
                onClick={onVaiAllaPagina ? () => onVaiAllaPagina(colonna.pagina) : undefined}
                onKeyDown={onVaiAllaPagina ? evento => tasto(evento, colonna.pagina) : undefined}
                className={twMerge("group outline-none", onVaiAllaPagina && "cursor-pointer")}
              >
                {/* Area attiva: tutta la fascia, etichette comprese */}
                <rect x={xFascia} y={0} width={fascia} height={base + MARGINE_BASSO} fill="transparent" />
                {/* La pagina intera: la parte grigia è lo spazio che i box non coprono */}
                <rect
                  x={x}
                  y={y(100)}
                  width={larghezzaColonna}
                  height={ALTEZZA}
                  rx={3}
                  className="fill-slate-100 transition-colors group-hover:fill-slate-200 dark:fill-darkmode-500 dark:group-hover:fill-darkmode-400"
                />
                {colonna.parti.map(parte => {
                  const altezza = (parte.spazio * fattore * ALTEZZA) / 100;
                  if (altezza <= 0) return null;
                  const yParte = base - ((cima + parte.spazio * fattore) * ALTEZZA) / 100;
                  cima += parte.spazio * fattore;
                  return (
                    <rect
                      key={parte.id}
                      data-reparto={parte.id}
                      x={x}
                      y={yParte}
                      width={larghezzaColonna}
                      height={altezza}
                      fill={parte.tinta.colore}
                      strokeWidth={1}
                      className={twMerge(parte.tinta.classe, CLASSI_ASSI.anello)}
                    />
                  );
                })}
                {/* La pagina guardata nel volantino, e il fuoco da tastiera */}
                <rect
                  x={x - 3}
                  y={y(100) - 3}
                  width={larghezzaColonna + 6}
                  height={ALTEZZA + 6}
                  rx={5}
                  fill="none"
                  strokeWidth={2}
                  className={twMerge(SERIE_PRINCIPALE.stroke, corrente ? "opacity-100" : "opacity-0 group-focus-visible:opacity-60")}
                />
                <text
                  x={xFascia + fascia / 2}
                  y={base + 15}
                  textAnchor="middle"
                  className={twMerge("text-xs font-semibold tabular-nums", corrente ? "fill-theme-1 dark:fill-indigo-300" : CLASSI_TESTO.primario)}
                >
                  {colonna.pagina}
                </text>
                <text x={xFascia + fascia / 2} y={base + 29} textAnchor="middle" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
                  {contaBox(colonna.box)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legenda voci={reparti.voci} titolo="Reparto" />
      <TabellaDati
        titolo={titolo}
        colonne={["Pagina", "Box", "Pagina coperta dai box", "Reparti"]}
        righe={colonne.map(colonna => [
          colonna.pagina,
          formatNumero(colonna.box),
          formatPercentuale(colonna.occupato, 0),
          colonna.parti.map(parte => `${parte.etichetta} ${formatPercentuale(parte.spazio, 0)}`).join(", ") || "—",
        ])}
      />
      {tooltip}
    </figure>
  );
}

export default DistribuzionePagine;
