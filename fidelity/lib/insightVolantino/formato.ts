/**
 * Unita' e formato dei valori mostrati nei grafici del report del volantino, all'italiana.
 * Condiviso fra server (testi delle sezioni) e client (PDF).
 */

export type UnitaMisura = 'percentuale' | 'euro' | 'pezzi' | 'indice';

/** Separatore delle migliaia sempre presente: "1.234", non "1234" come farebbe it-IT da solo. */
const formatoNumero = (decimali: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: decimali, useGrouping: true });

/** Valore scritto nell'unita' indicata, all'italiana. */
export function formattaValore(valore: number, unita: UnitaMisura): string {
  if (unita === 'percentuale') return `${formatoNumero(valore < 10 ? 1 : 0).format(valore)}%`;
  if (unita === 'euro') return `${formatoNumero(valore < 100 ? 2 : 0).format(valore)} €`;
  if (unita === 'pezzi') return formatoNumero(0).format(Math.round(valore));
  return formatoNumero(valore < 10 ? 2 : 1).format(valore);
}
