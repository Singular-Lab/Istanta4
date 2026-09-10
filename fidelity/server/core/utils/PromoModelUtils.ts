import dayjs from 'dayjs';
import { PromoAttributes } from '../models/promo';

/**
 * Shared utility functions extracted from PromoService.
 * These are used across multiple services (PromoService, WebPliantService,
 * ReferenzeService, VolantinoService) and need to live in a shared location.
 */

/**
 * Normalizes a Sequelize Promo model instance to plain PromoAttributes.
 * Handles both raw objects and Sequelize instances with dataValues.
 */
export function normalizePromoModel(promo: { dataValues?: PromoAttributes } | PromoAttributes): PromoAttributes {
  return ((promo as any)?.dataValues ?? promo) as PromoAttributes;
}

/**
 * Transforms promotion dates into Italian human-readable validity strings.
 * Used for WebPliant carousel display and promo presentation.
 */
export function trasformaData(
  dataDiInizio: string,
  dataDiFine: string,
  validaDal: boolean,
  validaAl: boolean,
  auto?: boolean,
  dataDalUguale?: boolean,
  dataAlUguale?: boolean
): string {
  try {
    const dataInizio = dayjs(dataDiInizio).locale("it-IT");
    const dataFine = dayjs(dataDiFine).locale("it-IT");
    const oggi = dayjs().locale("it-IT");

    if (!dataInizio.isValid() || !dataFine.isValid()) return "";

    const formatDate = (date: dayjs.Dayjs) => `${date.date()} ${date.format("MMMM")[0].toUpperCase() + date.format("MMMM").slice(1)}`;

    if (auto) {
      if (dataDalUguale && dataAlUguale) {
        return dataInizio.isAfter(oggi, "day") ? `Offerte valide dal ${formatDate(dataInizio)} al ${formatDate(dataFine)}` : `Offerte valide fino al ${formatDate(dataFine)}`;
      }
      if (dataDalUguale) {
        return dataInizio.isAfter(oggi, "day") ? `Offerte valide a partire dal ${formatDate(dataInizio)}` : `Offerte valide fino al ${formatDate(dataFine)}`;
      }
      if (dataAlUguale) {
        return dataFine.isAfter(oggi, "day") ? `Offerte valide fino al ${formatDate(dataFine)}` : `Offerte valide a partire dal ${formatDate(dataInizio)}`;
      }
      return "";
    }

    if (validaDal && validaAl) {
      if (dataInizio.isSame(dataFine, 'month')) {
        if (dataInizio.date() === 1 && dataFine.date() === dataInizio.daysInMonth()) {
          return dataInizio.year() !== dataFine.year() ? `Offerte valide dal ${formatDate(dataInizio)} ${dataInizio.year()} al ${formatDate(dataFine)} ${dataFine.year()}` : `Offerte valide per tutto il mese di ${dataFine.format("MMMM")[0].toUpperCase() + dataFine.format("MMMM").slice(1)}`;
        }
        return dataInizio.date() === 1 ? `Offerte valide dal primo al ${dataFine.date()} di ${dataFine.format("MMMM")[0].toUpperCase() + dataFine.format("MMMM").slice(1)}` : `Offerte valide dal ${dataInizio.date()} al ${dataFine.date()} di ${dataFine.format("MMMM")}`;
      }
      return dataInizio.isSame(dataFine, 'year') ? `Offerte valide dal ${dataInizio.date()} ${dataInizio.format("MMMM")} al ${dataFine.date()} ${dataFine.format("MMMM")}` : `Offerte valide dal ${formatDate(dataInizio)} ${dataInizio.year()} al ${formatDate(dataFine)} ${dataFine.year()}`;
    }

    if (!validaDal && validaAl) {
      return dataFine.isAfter(oggi) ? `Offerte valide fino al ${formatDate(dataFine)} ${dataFine.year() !== oggi.year() ? dataFine.year() : ""}` : "";
    }

    if (validaDal && !validaAl) {
      return dataInizio.isAfter(oggi) ? `Offerte valide a partire dal ${formatDate(dataInizio)}` : "";
    }

    return "";
  } catch (error) {
    console.error('Errore durante la trasformazione della data:', error);
    return "";
  }
}
