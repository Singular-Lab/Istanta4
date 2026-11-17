import { twMerge } from "@/utils/twMerge";
import { CLASSI_ASSI, SERIE_PRINCIPALE, SERIE_SECONDARIA } from "./colori";
import { scalaLineare } from "./scale";

export interface ForbicePrezzoProps {
  /** Il prezzo più basso del periodo. */
  minimo: number | null;
  /** Il prezzo più alto del periodo. */
  massimo: number | null;
  /** Il prezzo dell'ultimo volantino: il punto sulla forbice. */
  ultimo: number | null;
  formatta: (valore: number) => string;
  className?: string;
}

const LARGHEZZA = 120;
const ALTEZZA = 14;
/** Raggio del punto: 8 px di colore pieno dentro l'anello della superficie. */
const RAGGIO = 5;
const MARGINE = RAGGIO + 1;

const numero = (valore: number | null): valore is number => valore !== null && Number.isFinite(valore);

/**
 * Forbice di un prezzo in una riga di tabella: un segmento neutro dal minimo al massimo del periodo
 * e il punto dell'ultimo volantino. Senza forbice (minimo uguale al massimo) il punto sta al centro;
 * senza né forbice né ultimo prezzo non disegna niente (null). Il nome accessibile dice i prezzi.
 */
export function ForbicePrezzo({ minimo, massimo, ultimo, formatta, className }: ForbicePrezzoProps) {
  // Un estremo solo vale per entrambi
  const basso = numero(minimo) ? minimo : numero(massimo) ? massimo : null;
  const alto = numero(massimo) ? massimo : basso;
  const conUltimo = numero(ultimo);
  const conForbice = basso !== null && alto !== null && basso !== alto;
  if (!conForbice && !conUltimo) return null;

  // Il dominio comprende anche l'ultimo, se cade fuori dalla forbice
  const valori = [...(basso !== null && alto !== null ? [basso, alto] : []), ...(conUltimo ? [ultimo] : [])];
  const d0 = Math.min(...valori);
  const d1 = Math.max(...valori);
  const sx = scalaLineare([d0, d1], [MARGINE, LARGHEZZA - MARGINE]);
  const cy = ALTEZZA / 2;

  const forbice = basso === null || alto === null ? null : basso === alto ? `sempre ${formatta(basso)}` : `da ${formatta(Math.min(basso, alto))} a ${formatta(Math.max(basso, alto))}`;
  const nome = [forbice, conUltimo ? `nell'ultimo volantino ${formatta(ultimo)}` : null].filter(Boolean).join(", ");

  return (
    <svg
      role="img"
      aria-label={nome}
      width={LARGHEZZA}
      height={ALTEZZA}
      viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
      className={twMerge("inline-block overflow-visible align-middle", className)}
    >
      {conForbice && basso !== null && alto !== null && (
        <rect
          data-forbice=""
          x={sx(Math.min(basso, alto))}
          y={cy - 2}
          width={Math.abs(sx(alto) - sx(basso))}
          height={4}
          rx={2}
          className={SERIE_SECONDARIA.fill}
        />
      )}
      {conUltimo && <circle data-ultimo="" cx={sx(ultimo)} cy={cy} r={RAGGIO} strokeWidth={2} className={twMerge(SERIE_PRINCIPALE.fill, CLASSI_ASSI.anello)} />}
    </svg>
  );
}

export default ForbicePrezzo;
