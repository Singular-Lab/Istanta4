import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { KeyboardEvent } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, SERIE_PRINCIPALE, type Tinta } from "./colori";
import { larghezzaTesto, percorsoBarraOrizzontale, scalaLineare } from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type RigaTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

export interface VoceBarra {
  id: string;
  etichetta: string;
  valore: number;
  /** Righe in più nel tooltip. */
  dettagli?: RigaTooltip[];
  /** Colore dell'entità (per esempio l'insegna); senza, il colore della serie principale. */
  tinta?: Tinta;
}

export interface BarreOrizzontaliProps {
  voci: VoceBarra[];
  /** Nome del grafico per le tecnologie assistive e didascalia della tabella dei dati. */
  titolo: string;
  /** Che cosa misura il valore, nel tooltip e nella tabella ("Quota delle referenze"). */
  descrizioneValore: string;
  /** Testo del valore; predefinito il numero all'italiana. */
  formatta?: (valore: number) => string;
  /** Fondo scala; predefinito il valore più alto. */
  massimo?: number;
  /** Voce in evidenza: le altre si attenuano. */
  evidenziata?: string | null;
  /** Rende le barre cliccabili (e raggiungibili con Tab). */
  onSeleziona?: (id: string) => void;
  /** Testo al posto del grafico senza voci. */
  vuoto?: string;
  className?: string;
}

const SPESSORE = 20;
const SPAZIO = 8;

/**
 * Barre orizzontali di una serie sola, dalla più alta: etichetta a sinistra, valore in fondo alla
 * barra, tooltip su tutta la riga. Per confronti fra voci senza ordine naturale (marche, meccaniche).
 */
export function BarreOrizzontali({
  voci,
  titolo,
  descrizioneValore,
  formatta = v => formatNumero(v),
  massimo,
  evidenziata = null,
  onSeleziona,
  vuoto = "Nessun dato da mostrare.",
  className,
}: BarreOrizzontaliProps) {
  const [contenitore, larghezza] = useLarghezza(480);
  const { conTooltip, tooltip } = useTooltip();

  if (voci.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const fondoScala = Math.max(massimo ?? 0, ...voci.map(v => v.valore), 0) || 1;
  const colonnaEtichette = Math.min(larghezza * 0.4, Math.max(...voci.map(v => larghezzaTesto(v.etichetta, 12))) + 12);
  const spazioValore = Math.max(...voci.map(v => larghezzaTesto(formatta(v.valore)))) + 10;
  const x0 = colonnaEtichette;
  const lunghezza = scalaLineare([0, fondoScala], [0, Math.max(40, larghezza - x0 - spazioValore)]);
  const altezza = voci.length * (SPESSORE + SPAZIO) - SPAZIO;

  const tasto = (evento: KeyboardEvent, id: string) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      onSeleziona?.(id);
    }
  };

  return (
    <figure ref={contenitore} className={twMerge("m-0 min-w-0", className)}>
      <svg
        role="img"
        aria-label={titolo}
        width={larghezza}
        height={altezza}
        viewBox={`0 0 ${larghezza} ${altezza}`}
        className="block h-auto max-w-full overflow-visible"
      >
        {voci.map((voce, i) => {
          const y = i * (SPESSORE + SPAZIO);
          const l = lunghezza(voce.valore);
          const attenuata = evidenziata !== null && evidenziata !== voce.id;
          const etichettaTroncata =
            larghezzaTesto(voce.etichetta, 12) > colonnaEtichette - 10
              ? `${voce.etichetta.slice(0, Math.max(3, Math.floor((colonnaEtichette - 10) / 7) - 1))}…`
              : voce.etichetta;
          return (
            <g
              key={voce.id}
              {...conTooltip({
                titolo: voce.etichetta,
                righe: [{ etichetta: descrizioneValore, valore: formatta(voce.valore) }, ...(voce.dettagli ?? [])],
              })}
              role={onSeleziona ? "button" : undefined}
              tabIndex={onSeleziona ? 0 : undefined}
              aria-label={onSeleziona ? `${voce.etichetta}: ${formatta(voce.valore)}` : undefined}
              onClick={onSeleziona ? () => onSeleziona(voce.id) : undefined}
              onKeyDown={onSeleziona ? evento => tasto(evento, voce.id) : undefined}
              className={twMerge("outline-none", onSeleziona && "cursor-pointer")}
            >
              {/* Area attiva: tutta la riga, più grande della barra */}
              <rect x={0} y={y - SPAZIO / 2} width={larghezza} height={SPESSORE + SPAZIO} fill="transparent" />
              <text x={x0 - 10} y={y + SPESSORE / 2} dominantBaseline="central" textAnchor="end" className={twMerge("text-xs font-medium", CLASSI_TESTO.primario)}>
                {etichettaTroncata}
              </text>
              <path
                d={percorsoBarraOrizzontale(x0, y, l, SPESSORE)}
                fill={voce.tinta?.colore}
                className={twMerge(voce.tinta ? voce.tinta.classe : SERIE_PRINCIPALE.fill, "transition-opacity", attenuata && "opacity-40")}
              />
              <text x={x0 + l + 6} y={y + SPESSORE / 2} dominantBaseline="central" className={twMerge("text-2xs font-semibold tabular-nums", CLASSI_TESTO.secondario)}>
                {formatta(voce.valore)}
              </text>
            </g>
          );
        })}
        <line x1={x0} x2={x0} y1={-2} y2={altezza + 2} className={CLASSI_ASSI.base} />
      </svg>
      <TabellaDati titolo={titolo} colonne={["Voce", descrizioneValore]} righe={voci.map(v => [v.etichetta, formatta(v.valore)])} />
      {tooltip}
    </figure>
  );
}

export default BarreOrizzontali;
