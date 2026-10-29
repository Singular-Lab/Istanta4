import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Le date delle promo si valutano sul giorno di calendario di Roma, come gli stati (spec stati-promo). */
export const FUSO_WEBPLIANT = 'Europe/Rome';

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Giorno di calendario di Roma (AAAA-MM-GG) di una data; una data senza ora e' gia' quel giorno. */
export function giornoDiRoma(data: Date | string): string {
  if (typeof data === 'string' && SOLO_DATA.test(data)) return data;
  return dayjs(data).tz(FUSO_WEBPLIANT).format('YYYY-MM-DD');
}

export interface FinestraVisibilita {
  validitaDal: Date | string;
  validitaAl: Date | string;
  /** Giorni di anticipo della visibilita (offset_visibilita della promo). */
  offsetGiorni?: number;
}

/**
 * Spec referenze-webpliant, Visibilita temporale: visibile dal giorno di inizio validita anticipato
 * di offset_visibilita fino al giorno di fine validita incluso, valutati al giorno della
 * consultazione. Si confrontano giorni e non istanti: una validita_al alle 00:00 vale per tutto
 * il suo ultimo giorno.
 */
export function visibileNelGiorno(finestra: FinestraVisibilita, giornoConsultazione: string): boolean {
  const inizio = dayjs(giornoDiRoma(finestra.validitaDal))
    .subtract(finestra.offsetGiorni ?? 0, 'day')
    .format('YYYY-MM-DD');
  const fine = giornoDiRoma(finestra.validitaAl);
  return inizio <= giornoConsultazione && giornoConsultazione <= fine;
}
