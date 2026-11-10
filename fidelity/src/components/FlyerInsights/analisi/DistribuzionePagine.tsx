import { CLASSI_ASSI, CLASSI_TESTO, Legenda, SERIE_PRINCIPALE, TabellaDati, taccheTonde, useLarghezza, useTooltip, type Tinta, type VoceLegenda } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import type { FlyerInsightsConfig } from "@/types/flyerInsights";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo, type KeyboardEvent } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { coloriReparti, gruppoBox, type GruppoBox } from "../volantino/colori";
import { pagineDaSfogliare } from "../volantino/geometria";

/**
 * "Distribuzione nelle pagine", come il riepilogo delle pagine di prima: una colonna per pagina alta
 * quante sono le sue referenze, divisa per reparto con gli stessi colori del volantino sfogliabile,
 * e la linea dell'ingombro (la parte della pagina coperta dai box) su un asse a parte. Sotto, un
 * riquadro per pagina con referenze e ingombro. Colonne e riquadri portano il volantino alla pagina.
 * Niente calore, visibilità o vendite (spec insight-volantino).
 */

export interface ParteColonna extends GruppoBox {
  box: number;
  /** Referenze dei box del reparto nella pagina (le referenze del box, pilota compreso). */
  referenze: number;
  /** Spazio della pagina occupato dai box del reparto, in %. */
  spazio: number;
}

export interface ColonnaPagina {
  pagina: number;
  /** Box della pagina, anche quelli senza posizione. */
  box: number;
  /** Referenze della pagina, come nei numeri del volantino. */
  referenze: number;
  /** Spazio della pagina coperto dai box, in % (al più 100 anche se i riquadri si sovrappongono). */
  occupato: number;
  /** Dal basso: nello stesso ordine in tutte le pagine, dal reparto con più referenze nel volantino. */
  parti: ParteColonna[];
}

const spazioDi = (box: Pick<BoxInsight, "spazio">): number => (Number.isFinite(box.spazio) && box.spazio > 0 ? box.spazio : 0);

/** Le referenze di un box: quelle che conta la sintesi del volantino. */
const referenzeDi = (box: Pick<BoxInsight, "idReferenze">): number => box.idReferenze?.length ?? 0;

/**
 * Le colonne delle pagine da 1 a `totale`: box, referenze e spazio per reparto (o per il gruppo dato).
 * I reparti stanno nello stesso ordine in ogni colonna, dal più grande nel volantino (per referenze,
 * poi per spazio); i box senza reparto in cima.
 */
export const distribuzionePagine = <T extends Pick<BoxInsight, "pagina" | "spazio" | "idReferenze">>(
  box: readonly T[],
  totale: number,
  gruppo: (box: T) => GruppoBox
): ColonnaPagina[] => {
  const totaliGruppo = new Map<string, { referenze: number; spazio: number }>();
  const perPagina = new Map<number, Map<string, ParteColonna>>();
  const contiPagina = new Map<number, number>();
  for (const voce of box) {
    if (voce.pagina === null || voce.pagina < 1) continue;
    contiPagina.set(voce.pagina, (contiPagina.get(voce.pagina) ?? 0) + 1);
    const suo = gruppo(voce);
    const spazio = spazioDi(voce);
    const referenze = referenzeDi(voce);
    const totaleGruppo = totaliGruppo.get(suo.id) ?? { referenze: 0, spazio: 0 };
    totaliGruppo.set(suo.id, { referenze: totaleGruppo.referenze + referenze, spazio: totaleGruppo.spazio + spazio });
    const parti = perPagina.get(voce.pagina) ?? new Map<string, ParteColonna>();
    const parte = parti.get(suo.id);
    if (parte) {
      parte.box += 1;
      parte.referenze += referenze;
      parte.spazio += spazio;
    } else {
      parti.set(suo.id, { ...suo, box: 1, referenze, spazio });
    }
    perPagina.set(voce.pagina, parti);
  }
  const totaleDi = (id: string) => totaliGruppo.get(id) ?? { referenze: 0, spazio: 0 };
  const ordine = (a: ParteColonna, b: ParteColonna): number =>
    Number(a.id === "senza") - Number(b.id === "senza") ||
    totaleDi(b.id).referenze - totaleDi(a.id).referenze ||
    totaleDi(b.id).spazio - totaleDi(a.id).spazio ||
    a.etichetta.localeCompare(b.etichetta, "it");

  return Array.from({ length: Math.max(0, Math.floor(totale)) }, (_, posto) => {
    const pagina = posto + 1;
    const parti = [...(perPagina.get(pagina)?.values() ?? [])].sort(ordine);
    const spazio = parti.reduce((somma, parte) => somma + parte.spazio, 0);
    const referenze = parti.reduce((somma, parte) => somma + parte.referenze, 0);
    return { pagina, box: contiPagina.get(pagina) ?? 0, referenze, occupato: Math.min(100, spazio), parti };
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
  /** Rende colonne e riquadri pulsanti che portano il volantino alla pagina. */
  onVaiAllaPagina?: (pagina: number) => void;
  className?: string;
}

export const TITOLO_DISTRIBUZIONE = "Referenze delle pagine per reparto";

const ALTEZZA = 200;
const MARGINE_ALTO = 10;
/** A sinistra le referenze, a destra l'ingombro in %. */
const MARGINE_SINISTRO = 40;
const MARGINE_DESTRO = 40;
/** Sotto le colonne: il numero della pagina. */
const MARGINE_BASSO = 24;
/** Sotto questa larghezza per pagina il grafico scorre in orizzontale invece di stringersi. */
const FASCIA_MINIMA = 40;
const LARGHEZZA_MASSIMA_COLONNA = 44;
const TACCHE_INGOMBRO = [0, 25, 50, 75, 100];

/** La linea dell'ingombro: ambra come nel grafico di prima, distinta dai colori dei reparti. */
const TRATTO_INGOMBRO = "stroke-amber-500 dark:stroke-amber-300";
const PUNTO_INGOMBRO = "fill-white stroke-amber-500 dark:fill-darkmode-600 dark:stroke-amber-300";

const VOCE_INGOMBRO: VoceLegenda = { id: "ingombro", etichetta: "Ingombro della pagina", forma: "linea", classeTratto: TRATTO_INGOMBRO };

const contaReferenze = (numero: number): string => (numero === 1 ? "1 referenza" : `${formatNumero(numero)} referenze`);
const contaBox = (numero: number): string => (numero === 1 ? "1 box" : `${formatNumero(numero)} box`);

/** Il segno della serie nel tooltip: il colore della tinta, o un grigio per le tinte a classi. */
const chiaveTooltip = (tinta: Tinta) => (tinta.colore ? { colore: tinta.colore } : { classe: "bg-slate-300 dark:bg-darkmode-300" });

const descrizioneColonna = (colonna: ColonnaPagina): string =>
  [
    `Pagina ${colonna.pagina}: ${contaReferenze(colonna.referenze)}, ${contaBox(colonna.box)}, ${formatPercentuale(colonna.occupato, 0)} della pagina coperto`,
    ...colonna.parti.map(parte => `${parte.etichetta} ${contaReferenze(parte.referenze)}`),
  ].join("; ");

export function DistribuzionePagine({ box, totalePagine, configurazione, paginaCorrente, onVaiAllaPagina, className }: DistribuzionePagineProps) {
  const [contenitore, larghezzaDisponibile] = useLarghezza<HTMLElement>(640);
  const { conTooltip, tooltip } = useTooltip();
  const reparti = useMemo(() => coloriReparti(box, configurazione), [box, configurazione]);
  const totale = pagineDaSfogliare(totalePagine, box);
  const colonne = useMemo(() => distribuzionePagine(box, totale, voce => gruppoBox(voce, "reparto", reparti)), [box, totale, reparti]);

  const tacche = useMemo(() => taccheTonde(0, Math.max(1, ...colonne.map(colonna => colonna.referenze))), [colonne]);
  const massimo = tacche[tacche.length - 1] || 1;
  const larghezza = Math.max(larghezzaDisponibile, MARGINE_SINISTRO + MARGINE_DESTRO + colonne.length * FASCIA_MINIMA);
  const fascia = (larghezza - MARGINE_SINISTRO - MARGINE_DESTRO) / Math.max(1, colonne.length);
  const larghezzaColonna = Math.max(8, Math.min(LARGHEZZA_MASSIMA_COLONNA, fascia - 12));
  const base = MARGINE_ALTO + ALTEZZA;
  const yReferenze = (valore: number) => base - (Math.max(0, Math.min(massimo, valore)) / massimo) * ALTEZZA;
  const yIngombro = (percentuale: number) => base - (Math.max(0, Math.min(100, percentuale)) / 100) * ALTEZZA;
  const centro = (indice: number) => MARGINE_SINISTRO + indice * fascia + fascia / 2;
  const linea = colonne.map((colonna, i) => `${centro(i)},${yIngombro(colonna.occupato)}`).join(" ");

  const tasto = (evento: KeyboardEvent, pagina: number) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onVaiAllaPagina?.(pagina);
    }
  };

  return (
    <figure ref={contenitore} className={twMerge("m-0 min-w-0 space-y-4", className)}>
      {/* Con molte pagine il grafico non si stringe: scorre in orizzontale */}
      <div className="overflow-x-auto overscroll-x-contain pb-1" data-testid="scorrimento-distribuzione">
        <svg
          role="group"
          aria-label={TITOLO_DISTRIBUZIONE}
          width={larghezza}
          height={base + MARGINE_BASSO}
          viewBox={`0 0 ${larghezza} ${base + MARGINE_BASSO}`}
          className="block overflow-visible"
        >
          {/* Asse delle referenze a sinistra, con la griglia */}
          {tacche.map(tacca => (
            <g key={`r${tacca}`} aria-hidden="true">
              <line
                x1={MARGINE_SINISTRO - 4}
                x2={larghezza - MARGINE_DESTRO + 4}
                y1={yReferenze(tacca) + 0.5}
                y2={yReferenze(tacca) + 0.5}
                className={tacca === 0 ? CLASSI_ASSI.base : CLASSI_ASSI.griglia}
              />
              <text x={MARGINE_SINISTRO - 8} y={yReferenze(tacca)} dominantBaseline="central" textAnchor="end" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
                {formatNumero(tacca)}
              </text>
            </g>
          ))}
          {/* Asse dell'ingombro a destra, senza griglia: le righe sono quelle delle referenze */}
          {TACCHE_INGOMBRO.map(tacca => (
            <text
              key={`i${tacca}`}
              aria-hidden="true"
              x={larghezza - MARGINE_DESTRO + 8}
              y={yIngombro(tacca)}
              dominantBaseline="central"
              className="fill-amber-600 text-3xs tabular-nums dark:fill-amber-300"
            >
              {tacca}%
            </text>
          ))}
          {colonne.map((colonna, i) => {
            const xFascia = MARGINE_SINISTRO + i * fascia;
            const x = xFascia + (fascia - larghezzaColonna) / 2;
            const corrente = colonna.pagina === paginaCorrente;
            let cima = 0;
            return (
              <g
                key={colonna.pagina}
                data-pagina={colonna.pagina}
                data-corrente={corrente || undefined}
                {...conTooltip({
                  titolo: `Pagina ${colonna.pagina}`,
                  sottotitolo: `${contaReferenze(colonna.referenze)} · ${contaBox(colonna.box)} · ${formatPercentuale(colonna.occupato, 0)} di ingombro`,
                  righe: colonna.parti.map(parte => ({ etichetta: parte.etichetta, valore: contaReferenze(parte.referenze), chiave: chiaveTooltip(parte.tinta) })),
                })}
                role={onVaiAllaPagina ? "button" : undefined}
                tabIndex={onVaiAllaPagina ? 0 : undefined}
                aria-label={onVaiAllaPagina ? descrizioneColonna(colonna) : undefined}
                aria-current={onVaiAllaPagina && corrente ? "page" : undefined}
                onClick={onVaiAllaPagina ? () => onVaiAllaPagina(colonna.pagina) : undefined}
                onKeyDown={onVaiAllaPagina ? evento => tasto(evento, colonna.pagina) : undefined}
                className={twMerge("group outline-none", onVaiAllaPagina && "cursor-pointer")}
              >
                {/* Area attiva: tutta la fascia, che si accende al passaggio */}
                <rect
                  x={xFascia}
                  y={0}
                  width={fascia}
                  height={base + MARGINE_BASSO}
                  className="fill-slate-100 opacity-0 transition-opacity group-hover:opacity-100 dark:fill-darkmode-500"
                />
                {colonna.parti.map(parte => {
                  if (parte.referenze <= 0) return null;
                  const yParte = yReferenze(cima + parte.referenze);
                  const altezza = yReferenze(cima) - yParte;
                  cima += parte.referenze;
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
                  x={x - 4}
                  y={MARGINE_ALTO - 4}
                  width={larghezzaColonna + 8}
                  height={ALTEZZA + 8}
                  rx={5}
                  fill="none"
                  strokeWidth={2}
                  className={twMerge(SERIE_PRINCIPALE.stroke, corrente ? "opacity-100" : "opacity-0 group-focus-visible:opacity-60")}
                />
                <text
                  x={xFascia + fascia / 2}
                  y={base + 16}
                  textAnchor="middle"
                  className={twMerge("text-xs font-semibold tabular-nums", corrente ? "fill-theme-1 dark:fill-indigo-300" : CLASSI_TESTO.primario)}
                >
                  {colonna.pagina}
                </text>
              </g>
            );
          })}
          {/* L'ingombro sopra le colonne: non prende i clic, che restano alle pagine */}
          {colonne.length > 0 && (
            <g aria-hidden="true" data-testid="linea-ingombro" className="pointer-events-none">
              <polyline points={linea} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={TRATTO_INGOMBRO} />
              {colonne.map((colonna, i) => (
                <circle key={colonna.pagina} data-ingombro={colonna.pagina} cx={centro(i)} cy={yIngombro(colonna.occupato)} r={3.5} strokeWidth={2} className={PUNTO_INGOMBRO} />
              ))}
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Legenda voci={reparti.voci} titolo="Reparto" />
        <Legenda voci={[VOCE_INGOMBRO]} />
      </div>

      {/* Un riquadro per pagina, come nel riepilogo di prima: referenze e ingombro a colpo d'occhio */}
      <ul aria-label="Pagine del volantino" className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
        {colonne.map(colonna => {
          const corrente = colonna.pagina === paginaCorrente;
          const contenuto = (
            <>
              <span
                className={twMerge(
                  "flex h-8 w-8 flex-none items-center justify-center rounded-control text-xs font-bold tabular-nums",
                  corrente ? "bg-theme-1 text-white dark:bg-indigo-300 dark:text-slate-900" : "bg-slate-100 text-slate-700 dark:bg-darkmode-400 dark:text-slate-200"
                )}
              >
                {colonna.pagina}
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span className="block text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatNumero(colonna.referenze)} ref.</span>
                <span className="block text-3xs tabular-nums text-slate-500 dark:text-slate-400">{formatPercentuale(colonna.occupato, 0)} ing.</span>
              </span>
            </>
          );
          const classi = twMerge(
            "flex w-full items-center gap-2 rounded-control border p-2",
            corrente
              ? "border-theme-1 bg-theme-1/5 dark:border-indigo-300 dark:bg-indigo-300/10"
              : "border-slate-200 dark:border-darkmode-400"
          );
          return (
            <li key={colonna.pagina} data-riquadro={colonna.pagina}>
              {onVaiAllaPagina ? (
                <button
                  type="button"
                  aria-label={`Pagina ${colonna.pagina}: ${contaReferenze(colonna.referenze)}, ${formatPercentuale(colonna.occupato, 0)} di ingombro`}
                  aria-current={corrente ? "page" : undefined}
                  onClick={() => onVaiAllaPagina(colonna.pagina)}
                  className={twMerge(
                    classi,
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
                    !corrente && "hover:border-slate-300 hover:bg-slate-50 dark:hover:border-darkmode-300 dark:hover:bg-darkmode-500"
                  )}
                >
                  {contenuto}
                </button>
              ) : (
                <div className={classi}>{contenuto}</div>
              )}
            </li>
          );
        })}
      </ul>

      <TabellaDati
        titolo={TITOLO_DISTRIBUZIONE}
        colonne={["Pagina", "Referenze", "Box", "Pagina coperta dai box", "Reparti"]}
        righe={colonne.map(colonna => [
          colonna.pagina,
          formatNumero(colonna.referenze),
          formatNumero(colonna.box),
          formatPercentuale(colonna.occupato, 0),
          colonna.parti.map(parte => `${parte.etichetta} ${contaReferenze(parte.referenze)}`).join(", ") || "—",
        ])}
      />
      {tooltip}
    </figure>
  );
}

export default DistribuzionePagine;
