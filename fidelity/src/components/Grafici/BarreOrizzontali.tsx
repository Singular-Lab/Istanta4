import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { KeyboardEvent } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, SERIE_PRINCIPALE, type Tinta } from "./colori";
import { Legenda } from "./Legenda";
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
  /** Valore di confronto (per esempio quello del periodo prima): una tacca sulla riga, a quel valore. */
  riferimento?: number | null;
  /** Testo breve e tenue dopo il valore ("+4,1 punti", "in 18 volantini"). */
  nota?: string;
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
  /**
   * Che cosa è il valore di riferimento delle voci ("nel 2024"): nel tooltip, nella legenda sotto
   * il grafico ("valore nel 2024") e nella tabella dei dati.
   */
  nomeRiferimento?: string;
  /** Testo al posto del grafico senza voci. */
  vuoto?: string;
  className?: string;
}

const SPESSORE = 20;
const SPAZIO = 8;
/** La tacca del riferimento sporge di qualche pixel sopra e sotto la barra. */
const SPORGENZA_TACCA = 3;
/** Le etichette prendono al massimo questa parte della larghezza. */
const QUOTA_ETICHETTE = 0.45;
/** Le classi della tacca, del colore dei testi secondari, e della legenda. */
const CLASSE_TACCA = "stroke-slate-600 dark:stroke-slate-300";

const conRiferimento = (voce: VoceBarra): voce is VoceBarra & { riferimento: number } =>
  voce.riferimento !== null && voce.riferimento !== undefined && Number.isFinite(voce.riferimento);

const maiuscola = (testo: string) => testo.charAt(0).toUpperCase() + testo.slice(1);

/**
 * Barre orizzontali di una serie sola, dalla più alta: etichetta a sinistra, valore in fondo alla
 * barra, tooltip su tutta la riga. Per confronti fra voci senza ordine naturale (marche, meccaniche).
 * Un valore di riferimento (il periodo prima) è una tacca sulla riga, una nota breve segue il valore;
 * le etichette lunghe si tagliano con "…" ma restano intere nel tooltip e nella tabella dei dati.
 */
export function BarreOrizzontali({
  voci,
  titolo,
  descrizioneValore,
  formatta = v => formatNumero(v),
  massimo,
  evidenziata = null,
  onSeleziona,
  nomeRiferimento = "di riferimento",
  vuoto = "Nessun dato da mostrare.",
  className,
}: BarreOrizzontaliProps) {
  const [contenitore, larghezza] = useLarghezza(480);
  const { conTooltip, tooltip } = useTooltip();

  if (voci.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const riferimenti = voci.filter(conRiferimento).map(v => v.riferimento);
  const conRiferimenti = riferimenti.length > 0;
  const conNote = voci.some(v => v.nota);
  const fondoScala = Math.max(massimo ?? 0, ...voci.map(v => v.valore), ...riferimenti, 0) || 1;
  const colonnaEtichette = Math.min(larghezza * QUOTA_ETICHETTE, Math.max(...voci.map(v => larghezzaTesto(v.etichetta, 12))) + 12);
  // Dopo la barra il valore e la nota, se c'è
  const testoDopo = (voce: VoceBarra) => larghezzaTesto(formatta(voce.valore)) + (voce.nota ? larghezzaTesto(voce.nota) + 6 : 0);
  const spazioValore = Math.max(...voci.map(testoDopo)) + 10;
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
          const lRiferimento = conRiferimento(voce) ? lunghezza(voce.riferimento) : null;
          // Il valore dopo la barra e, se va oltre, dopo la tacca
          const xValore = x0 + Math.max(l, lRiferimento === null ? 0 : lRiferimento + 2) + 6;
          const valore = formatta(voce.valore);
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
                righe: [
                  { etichetta: descrizioneValore, valore },
                  ...(conRiferimento(voce) ? [{ etichetta: maiuscola(nomeRiferimento), valore: formatta(voce.riferimento) }] : []),
                  ...(voce.dettagli ?? []),
                ],
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
              {/* Riferimento: una tacca di 2 px con un bordo del colore della superficie, visibile sulla barra e fuori */}
              {lRiferimento !== null && (
                <g data-riferimento={voce.id} className="pointer-events-none">
                  <line x1={x0 + lRiferimento} x2={x0 + lRiferimento} y1={y - SPORGENZA_TACCA} y2={y + SPESSORE + SPORGENZA_TACCA} strokeWidth={4} className={CLASSI_ASSI.anello} />
                  <line x1={x0 + lRiferimento} x2={x0 + lRiferimento} y1={y - SPORGENZA_TACCA} y2={y + SPESSORE + SPORGENZA_TACCA} strokeWidth={2} className={CLASSE_TACCA} />
                </g>
              )}
              <text x={xValore} y={y + SPESSORE / 2} dominantBaseline="central" className={twMerge("text-2xs font-semibold tabular-nums", CLASSI_TESTO.secondario)}>
                {valore}
              </text>
              {voce.nota && (
                <text x={xValore + larghezzaTesto(valore) + 6} y={y + SPESSORE / 2} dominantBaseline="central" className={twMerge("text-2xs tabular-nums", CLASSI_TESTO.tenue)}>
                  {voce.nota}
                </text>
              )}
            </g>
          );
        })}
        <line x1={x0} x2={x0} y1={-2} y2={altezza + 2} className={CLASSI_ASSI.base} />
      </svg>
      {conRiferimenti && (
        <Legenda voci={[{ id: "riferimento", etichetta: `valore ${nomeRiferimento}`, forma: "tacca", classeTratto: CLASSE_TACCA }]} className="mt-2" />
      )}
      <TabellaDati
        titolo={titolo}
        colonne={["Voce", descrizioneValore, ...(conRiferimenti ? [maiuscola(nomeRiferimento)] : []), ...(conNote ? ["Nota"] : [])]}
        righe={voci.map(v => [
          v.etichetta,
          formatta(v.valore),
          ...(conRiferimenti ? [conRiferimento(v) ? formatta(v.riferimento) : "—"] : []),
          ...(conNote ? [v.nota ?? ""] : []),
        ])}
      />
      {tooltip}
    </figure>
  );
}

export default BarreOrizzontali;
