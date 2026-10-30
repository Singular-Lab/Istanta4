import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { STATO_PROMO } from '../../../lib/enums';
dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

// Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso del server
export const FUSO_PROMO = 'Europe/Rome';

/** Campi della promo da cui dipende lo stato automatico. */
export interface DateStatoPromo {
  stato: STATO_PROMO;
  validita_dal?: Date | string | null;
  validita_al?: Date | string | null;
  data_scadenza?: Date | string | null;
}

/** Data sul giorno di Roma; null se manca o non è valida. */
function giornoRoma(data: Date | string | null | undefined): dayjs.Dayjs | null {
  const giorno = data ? dayjs(data) : null;
  return giorno?.isValid() ? giorno.tz(FUSO_PROMO) : null;
}

/**
 * Stato che le date impongono alla promo in questo momento (può coincidere con quello
 * attuale), o null quando le date non dicono nulla e lo stato resta com'è.
 * Usato dal cron degli stati promo e alla creazione, così una promo storica nasce già ARCHIVIATA.
 * Una VALIDA_CON_ERRORI nel periodo di validità resta tale; un'ARCHIVIATA con le date
 * spostate in avanti torna VALIDA.
 */
export function statoAutomaticoPromo(promo: DateStatoPromo, adesso: Date = new Date()): STATO_PROMO | null {
  // Confronti sul giorno di Roma: alle 23:30 UTC in Italia è già il giorno dopo
  const now = dayjs(adesso).tz(FUSO_PROMO);
  const validitaDal = giornoRoma(promo.validita_dal);
  const validitaAl = giornoRoma(promo.validita_al);
  const dataScadenza = giornoRoma(promo.data_scadenza);

  if (validitaAl && now.isAfter(validitaAl, 'day')) {
    return STATO_PROMO.ARCHIVIATA;
  }

  if (validitaDal && validitaAl && now.isBetween(validitaDal, validitaAl, 'day', '[]')) {
    return promo.stato === STATO_PROMO.VALIDA_CON_ERRORI ? null : STATO_PROMO.VALIDA;
  }

  if (dataScadenza && now.isAfter(dataScadenza, 'day')) {
    return STATO_PROMO.IN_RITARDO;
  }

  if (dataScadenza) {
    const daysUntilExpiry = dataScadenza.diff(now, 'day');
    if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
      return STATO_PROMO.IN_SCADENZA;
    }
  }

  return null;
}
