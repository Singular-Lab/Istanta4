import { formatNumero } from "@/utils/format";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Le date delle promo sono giorni del calendario italiano, qualunque sia il fuso del browser. */
const FUSO_PROMO = "Europe/Rome";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Giorni di calendario da oggi, in Italia, all'ultimo giorno di validità della promo (data ISO
 * del contratto): 0 se scade oggi, negativo se è già passato; null senza una data valida.
 */
export const giorniAllaScadenza = (validitaAl: string | null | undefined, adesso: Date = new Date()): number | null => {
  if (!validitaAl || !DATA_ISO.test(validitaAl)) return null;
  const fine = dayjs.utc(validitaAl);
  // dayjs fa scorrere i giorni fuori mese ("2026-02-30" diventa il 2 marzo): la data deve restare quella scritta
  if (!fine.isValid() || fine.format("YYYY-MM-DD") !== validitaAl) return null;
  const oggi = dayjs.utc(dayjs(adesso).tz(FUSO_PROMO).format("YYYY-MM-DD"));
  // Due mezzanotti UTC: la differenza conta i giorni del calendario, senza l'ora legale di mezzo
  return fine.diff(oggi, "day");
};

/** "Scade oggi", "Scade domani", "Scade tra 5 giorni"; "Scaduta" per una data già passata. */
export const testoScadenza = (giorni: number): string => {
  if (giorni < 0) return "Scaduta";
  if (giorni === 0) return "Scade oggi";
  if (giorni === 1) return "Scade domani";
  return `Scade tra ${formatNumero(giorni)} giorni`;
};

/** Da questi giorni in giù la scadenza si mette in evidenza. */
export const GIORNI_SCADENZA_VICINA = 3;
