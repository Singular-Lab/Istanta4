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
 * Giorni di calendario da oggi, in Italia, a una data ISO del contratto: 0 se è oggi, negativo se
 * è già passata; null senza una data valida.
 */
const giorniAllaData = (data: string | null | undefined, adesso: Date): number | null => {
  if (!data || !DATA_ISO.test(data)) return null;
  const giorno = dayjs.utc(data);
  // dayjs fa scorrere i giorni fuori mese ("2026-02-30" diventa il 2 marzo): la data deve restare quella scritta
  if (!giorno.isValid() || giorno.format("YYYY-MM-DD") !== data) return null;
  const oggi = dayjs.utc(dayjs(adesso).tz(FUSO_PROMO).format("YYYY-MM-DD"));
  // Due mezzanotti UTC: la differenza conta i giorni del calendario, senza l'ora legale di mezzo
  return giorno.diff(oggi, "day");
};

/** Giorni all'ultimo giorno di validità della promo: 0 se scade oggi, negativo se è già passato. */
export const giorniAllaScadenza = (validitaAl: string | null | undefined, adesso: Date = new Date()): number | null =>
  giorniAllaData(validitaAl, adesso);

/** Giorni al primo giorno di validità della promo: 0 se comincia oggi, negativo se è già passato. */
export const giorniAllInizio = (validitaDal: string | null | undefined, adesso: Date = new Date()): number | null =>
  giorniAllaData(validitaDal, adesso);

/** "Scade oggi", "Scade domani", "Scade tra 5 giorni"; "Scaduta" per una data già passata. */
export const testoScadenza = (giorni: number): string => {
  if (giorni < 0) return "Scaduta";
  if (giorni === 0) return "Scade oggi";
  if (giorni === 1) return "Scade domani";
  return `Scade tra ${formatNumero(giorni)} giorni`;
};

/** Da questi giorni in giù la scadenza si mette in evidenza. */
export const GIORNI_SCADENZA_VICINA = 3;

/** "Inizia oggi", "Inizia domani", "Inizia tra 5 giorni"; "Già iniziata" per una data passata. */
export const testoInizio = (giorni: number): string => {
  if (giorni < 0) return "Già iniziata";
  if (giorni === 0) return "Inizia oggi";
  if (giorni === 1) return "Inizia domani";
  return `Inizia tra ${formatNumero(giorni)} giorni`;
};
