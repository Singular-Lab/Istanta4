import { twMerge } from "@/utils/twMerge";
import { SERIE_PRINCIPALE, TINTA_NEUTRA } from "./colori";
import { useTooltip } from "./Tooltip";

export interface StrisciaPresenzeProps {
  /** I volantini, nell'ordine in cui disegnarli (di solito dal più vecchio). */
  volantini: ReadonlyArray<{ id: string; etichetta: string }>;
  /** Gli id dei volantini in cui il soggetto (per esempio la referenza) c'è. */
  presenti: ReadonlySet<string>;
  /** Che cosa compare, nel nome accessibile ("Presenze della referenza"). */
  titolo: string;
  className?: string;
}

const LARGHEZZA_MASSIMA = 220;
const LARGHEZZA_TACCA = 10;
const ALTEZZA = 18;

/**
 * Striscia delle presenze: una tacca per volantino, piena dove il soggetto c'è e neutra dove manca,
 * per vedere a colpo d'occhio con che regolarità compare. Larga al massimo 220 px: con molti
 * volantini le tacche si stringono e perdono lo stacco. Il nome accessibile dice quante volte c'è,
 * il tooltip di ogni tacca il volantino.
 */
export function StrisciaPresenze({ volantini, presenti, titolo, className }: StrisciaPresenzeProps) {
  const { conTooltip, tooltip } = useTooltip();
  if (volantini.length === 0) return null;

  const totale = volantini.length;
  const quanti = volantini.filter(v => presenti.has(v.id)).length;
  const larghezzaTacca = Math.min(LARGHEZZA_TACCA, LARGHEZZA_MASSIMA / totale);
  // 1 px di superficie fra le tacche, finché resta qualcosa da vedere
  const stacco = larghezzaTacca >= 3 ? 1 : 0;
  const larghezza = larghezzaTacca * totale;
  const nome = `${titolo}: presente in ${quanti} su ${totale} ${totale === 1 ? "volantino" : "volantini"}`;

  return (
    <span className={twMerge("inline-block align-middle", className)}>
      <svg role="img" aria-label={nome} width={larghezza} height={ALTEZZA} viewBox={`0 0 ${larghezza} ${ALTEZZA}`} className="block">
        {volantini.map((volantino, i) => {
          const presente = presenti.has(volantino.id);
          const x = i * larghezzaTacca;
          return (
            <g key={volantino.id} data-presente={presente} {...conTooltip({ titolo: volantino.etichetta, sottotitolo: presente ? "presente" : "assente" })}>
              <rect x={x} y={0} width={larghezzaTacca} height={ALTEZZA} fill="transparent" />
              <rect
                x={x}
                y={0}
                width={Math.max(0, larghezzaTacca - stacco)}
                height={ALTEZZA}
                rx={Math.min(1.5, larghezzaTacca / 4)}
                className={presente ? SERIE_PRINCIPALE.fill : TINTA_NEUTRA.classe}
              />
            </g>
          );
        })}
      </svg>
      {tooltip}
    </span>
  );
}

export default StrisciaPresenze;
