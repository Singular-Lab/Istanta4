import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { CLASSI_ASSI, SERIE_PRINCIPALE } from "./colori";
import { percorsoColonna, scalaLineare } from "./scale";
import { useTooltip } from "./Tooltip";

export interface MiniBarreProps {
  /** Le barre in ordine (per esempio anno per anno). */
  valori: Array<{ etichetta: string; valore: number }>;
  /** Fondo scala comune a più righe di una tabella, perché si confrontino; predefinito il valore più alto. */
  massimo?: number;
  /** Che cosa misura il valore, nel nome accessibile e nel tooltip ("Volantini"). */
  descrizioneValore: string;
  formatta?: (valore: number) => string;
  /** Ultima barra piena, le altre attenuate (l'ultimo periodo). */
  evidenziaUltima?: boolean;
  larghezza?: number;
  altezza?: number;
  className?: string;
}

/**
 * Barre minime dentro una riga di tabella (sparkbar): l'andamento a colpo d'occhio, senza assi.
 * Il nome accessibile elenca tutti i valori; ogni barra ha il suo tooltip.
 */
export function MiniBarre({
  valori,
  massimo,
  descrizioneValore,
  formatta = v => formatNumero(v),
  evidenziaUltima = true,
  larghezza = 132,
  altezza = 26,
  className,
}: MiniBarreProps) {
  const { conTooltip, tooltip } = useTooltip();
  const fondoScala = Math.max(massimo ?? 0, ...valori.map(v => v.valore), 0) || 1;
  const base = altezza - 2.5;
  const h = scalaLineare([0, fondoScala], [0, base - 2]);
  const fascia = valori.length > 0 ? larghezza / valori.length : larghezza;
  const larghezzaBarra = Math.max(2, Math.min(14, fascia - 4));
  const nome = `${descrizioneValore}: ${valori.map(v => `${v.etichetta} ${formatta(v.valore)}`).join(", ")}`;

  return (
    <span className={twMerge("inline-block align-middle", className)}>
      <svg role="img" aria-label={nome} width={larghezza} height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} className="block">
        {valori.map((voce, i) => {
          const x = i * fascia + (fascia - larghezzaBarra) / 2;
          const attenuata = evidenziaUltima && i < valori.length - 1;
          return (
            <g key={voce.etichetta} {...conTooltip({ titolo: voce.etichetta, righe: [{ etichetta: descrizioneValore, valore: formatta(voce.valore) }] })}>
              <rect x={i * fascia} y={0} width={fascia} height={altezza} fill="transparent" />
              <path d={percorsoColonna(x, base, h(voce.valore), larghezzaBarra, 2)} className={twMerge(SERIE_PRINCIPALE.fill, attenuata && "opacity-60")} />
            </g>
          );
        })}
        <line x1={0} x2={larghezza} y1={base + 0.5} y2={base + 0.5} className={CLASSI_ASSI.base} />
      </svg>
      {tooltip}
    </span>
  );
}

export default MiniBarre;
