import { twMerge } from "@/utils/twMerge";
import { CLASSI_ASSI, CLASSI_TESTO } from "./colori";
import { Legenda, type VoceLegenda } from "./Legenda";
import { annoDi, dataBreve, inizioAnno, larghezzaTesto, msData, scalaLineare, taccheTempo } from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type RigaTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

/** Tono di un tratto: neutro, in evidenza (per esempio il valore attuale) o da guardare (diverso dall'attuale). */
export type TonoFascia = "neutro" | "evidenza" | "attenzione";

export interface FasciaTempo {
  id: string;
  dal: string;
  al: string;
  etichetta: string;
  tono?: TonoFascia;
  dettagli?: RigaTooltip[];
}

export interface RigaFasce {
  id: string;
  etichetta: string;
  fasce: FasciaTempo[];
}

export interface FasceNelTempoProps {
  righe: RigaFasce[];
  /** Nome del grafico per le tecnologie assistive e didascalia della tabella dei dati. */
  titolo: string;
  /** Periodo mostrato; predefinito dagli anni dei dati. */
  intervallo?: { dal: string; al: string };
  /** Nomi dei toni usati, per la legenda. */
  nomiToni?: Partial<Record<TonoFascia, string>>;
  vuoto?: string;
  className?: string;
}

const CLASSI_TONO: Record<TonoFascia, string> = {
  neutro: "fill-slate-100 dark:fill-darkmode-400",
  evidenza: "fill-theme-1/10 dark:fill-indigo-300/20",
  attenzione: "fill-amber-50 stroke-amber-500 dark:fill-amber-500/15 dark:stroke-amber-400",
};

const ALTEZZA_FASCIA = 26;
const SPAZIO = 8;
const GIORNO = 86_400_000;

/**
 * Righe di tratti sull'asse del tempo (per esempio l'indirizzo e il telefono stampati): ogni tratto
 * dice com'era in quel periodo, con il testo dentro se ci sta e il tooltip con le date.
 */
export function FasceNelTempo({ righe, titolo, intervallo, nomiToni = {}, vuoto = "Nessun dato da mostrare.", className }: FasceNelTempoProps) {
  const [contenitore, misurata] = useLarghezza(520);
  const { conTooltip, tooltip } = useTooltip();
  const tutte = righe.flatMap(r => r.fasce);

  if (tutte.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const larghezza = Math.max(360, misurata);
  const date = tutte.flatMap(f => [msData(f.dal), msData(f.al)]);
  const [t0, t1] = intervallo
    ? [msData(intervallo.dal), msData(intervallo.al) + GIORNO]
    : [inizioAnno(annoDi(Math.min(...date))), inizioAnno(annoDi(Math.max(...date)) + 1)];
  const colonnaEtichette = Math.max(...righe.map(r => larghezzaTesto(r.etichetta, 11))) + 12;
  const sx = scalaLineare([t0, t1], [colonnaEtichette, larghezza - 4]);
  const yAsse = righe.length * (ALTEZZA_FASCIA + SPAZIO) + 12;
  const toniPresenti = [...new Set(tutte.map(f => f.tono ?? "neutro"))];
  const vociLegenda: VoceLegenda[] = toniPresenti
    .filter(tono => nomiToni[tono])
    .map(tono => ({ id: tono, etichetta: nomiToni[tono]!, forma: "quadrato", tinta: { classe: CLASSI_TONO[tono], classeTesto: "" } }));

  return (
    <figure className={twMerge("m-0 min-w-0", className)}>
      <div ref={contenitore} className="overflow-x-auto">
        <svg role="img" aria-label={titolo} width={larghezza} height={yAsse + 6} viewBox={`0 0 ${larghezza} ${yAsse + 6}`} className="block">
          {taccheTempo(t0, t1).map(tacca => (
            <g key={tacca.ms}>
              <line x1={sx(tacca.ms)} x2={sx(tacca.ms)} y1={0} y2={yAsse - 12} className={CLASSI_ASSI.griglia} />
              <text x={sx(tacca.centro)} y={yAsse} textAnchor="middle" className={twMerge("text-2xs tabular-nums", CLASSI_TESTO.tenue)}>
                {tacca.etichetta}
              </text>
            </g>
          ))}
          {righe.map((riga, i) => {
            const y = i * (ALTEZZA_FASCIA + SPAZIO);
            return (
              <g key={riga.id}>
                <text x={0} y={y + ALTEZZA_FASCIA / 2} dominantBaseline="central" className={twMerge("text-2xs font-medium", CLASSI_TESTO.secondario)}>
                  {riga.etichetta}
                </text>
                {riga.fasce.map(fascia => {
                  const inizio = sx(Math.max(t0, msData(fascia.dal)));
                  const w = Math.max(3, sx(Math.min(t1, msData(fascia.al) + GIORNO)) - inizio - 2);
                  const periodo = `${dataBreve(msData(fascia.dal))} – ${dataBreve(msData(fascia.al))}`;
                  return (
                    <g key={fascia.id} {...conTooltip({ titolo: fascia.etichetta, sottotitolo: periodo, righe: fascia.dettagli })}>
                      <rect
                        x={inizio + 1}
                        y={y}
                        width={w}
                        height={ALTEZZA_FASCIA}
                        rx={4}
                        strokeWidth={fascia.tono === "attenzione" ? 1.5 : 0}
                        className={CLASSI_TONO[fascia.tono ?? "neutro"]}
                      />
                      {w >= larghezzaTesto(fascia.etichetta, 11) + 14 && (
                        <text x={inizio + 8} y={y + ALTEZZA_FASCIA / 2} dominantBaseline="central" className={twMerge("pointer-events-none text-2xs font-semibold", CLASSI_TESTO.primario)}>
                          {fascia.etichetta}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <Legenda voci={vociLegenda} className="mt-2" />
      <TabellaDati
        titolo={titolo}
        colonne={["Riga", "Dal", "Al", "Valore"]}
        righe={righe.flatMap(r => r.fasce.map(f => [r.etichetta, dataBreve(msData(f.dal)), dataBreve(msData(f.al)), f.etichetta]))}
      />
      {tooltip}
    </figure>
  );
}

export default FasceNelTempo;
