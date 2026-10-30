import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { KeyboardEvent } from "react";
import { CLASSI_ASSI, CLASSI_TESTO, SERIE_PRINCIPALE } from "./colori";
import { larghezzaTesto, percorsoColonna, scalaLineare } from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip, type RigaTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

export interface VoceColonna {
  id: string;
  /** Etichetta sull'asse orizzontale (per esempio il numero di pagina). */
  etichetta: string;
  valore: number;
  /** Titolo del tooltip; predefinita l'etichetta. */
  titolo?: string;
  dettagli?: RigaTooltip[];
}

export interface ColonneProps {
  voci: VoceColonna[];
  /** Nome del grafico per le tecnologie assistive e didascalia della tabella dei dati. */
  titolo: string;
  /** Che cosa misura il valore ("Referenze"). */
  descrizioneValore: string;
  /** Intestazione della prima colonna della tabella dei dati ("Pagina"). */
  descrizioneVoce?: string;
  formatta?: (valore: number) => string;
  massimo?: number;
  /** Colonna in evidenza (piena), le altre attenuate. */
  evidenziata?: string | null;
  /** Rende le colonne cliccabili. */
  onSeleziona?: (id: string) => void;
  /** Altezza dell'area delle colonne, in pixel. */
  altezza?: number;
  vuoto?: string;
  className?: string;
}

const MARGINE_BASSO = 20;
const MARGINE_ALTO = 14;

/**
 * Colonne di una serie sola su categorie ordinate (pagine, mesi): base squadrata, cima arrotondata,
 * colonne al massimo di 24 px, valore della colonna in evidenza sulla cima, tooltip su ogni colonna.
 */
export function Colonne({
  voci,
  titolo,
  descrizioneValore,
  descrizioneVoce = "Voce",
  formatta = v => formatNumero(v),
  massimo,
  evidenziata = null,
  onSeleziona,
  altezza = 120,
  vuoto = "Nessun dato da mostrare.",
  className,
}: ColonneProps) {
  const [contenitore, larghezza] = useLarghezza(320);
  const { conTooltip, tooltip } = useTooltip();

  if (voci.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const fondoScala = Math.max(massimo ?? 0, ...voci.map(v => v.valore), 0) || 1;
  const base = MARGINE_ALTO + altezza;
  const h = scalaLineare([0, fondoScala], [0, altezza]);
  const fascia = larghezza / voci.length;
  const larghezzaColonna = Math.max(2, Math.min(24, fascia - 2));
  // Etichette dell'asse diradate perché non si tocchino
  const larghezzaEtichetta = Math.max(...voci.map(v => larghezzaTesto(v.etichetta, 10))) + 6;
  const ogni = Math.max(1, Math.ceil(larghezzaEtichetta / fascia));
  // L'ultima voce ha sempre l'etichetta; se toccherebbe quella diradata prima, cede quella
  const ultimoIndice = voci.length - 1;
  const ultimoDiradato = Math.floor(ultimoIndice / ogni) * ogni;
  const ultimoDiradatoCede = ultimoDiradato !== ultimoIndice && (ultimoIndice - ultimoDiradato) * fascia < larghezzaEtichetta;
  const conEtichetta = (i: number) => i === ultimoIndice || (i % ogni === 0 && !(i === ultimoDiradato && ultimoDiradatoCede));

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
        height={base + MARGINE_BASSO}
        viewBox={`0 0 ${larghezza} ${base + MARGINE_BASSO}`}
        className="block h-auto max-w-full overflow-visible"
      >
        {voci.map((voce, i) => {
          const x = i * fascia + (fascia - larghezzaColonna) / 2;
          const altezzaColonna = h(voce.valore);
          const inEvidenza = evidenziata === voce.id;
          const attenuata = evidenziata !== null && !inEvidenza;
          return (
            <g
              key={voce.id}
              {...conTooltip({
                titolo: voce.titolo ?? voce.etichetta,
                righe: [{ etichetta: descrizioneValore, valore: formatta(voce.valore) }, ...(voce.dettagli ?? [])],
              })}
              role={onSeleziona ? "button" : undefined}
              tabIndex={onSeleziona ? 0 : undefined}
              aria-label={onSeleziona ? `${voce.titolo ?? voce.etichetta}: ${formatta(voce.valore)}` : undefined}
              aria-pressed={onSeleziona ? inEvidenza : undefined}
              onClick={onSeleziona ? () => onSeleziona(voce.id) : undefined}
              onKeyDown={onSeleziona ? evento => tasto(evento, voce.id) : undefined}
              className={twMerge("outline-none", onSeleziona && "cursor-pointer")}
            >
              <rect x={i * fascia} y={0} width={fascia} height={base} fill="transparent" />
              <path
                d={percorsoColonna(x, base, altezzaColonna, larghezzaColonna, Math.min(4, larghezzaColonna / 2))}
                className={twMerge(SERIE_PRINCIPALE.fill, attenuata && "opacity-50")}
              />
              {inEvidenza && (
                <text x={x + larghezzaColonna / 2} y={base - altezzaColonna - 4} textAnchor="middle" className={twMerge("text-2xs font-semibold tabular-nums", CLASSI_TESTO.primario)}>
                  {formatta(voce.valore)}
                </text>
              )}
              {conEtichetta(i) && (
                <text x={i * fascia + fascia / 2} y={base + 14} textAnchor="middle" className={twMerge("text-3xs tabular-nums", CLASSI_TESTO.tenue)}>
                  {voce.etichetta}
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={larghezza} y1={base + 0.5} y2={base + 0.5} className={CLASSI_ASSI.base} />
      </svg>
      <TabellaDati titolo={titolo} colonne={[descrizioneVoce, descrizioneValore]} righe={voci.map(v => [v.titolo ?? v.etichetta, formatta(v.valore)])} />
      {tooltip}
    </figure>
  );
}

export default Colonne;
