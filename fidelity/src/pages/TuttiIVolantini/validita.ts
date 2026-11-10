import type { TonoStato } from "@/constants/stati";
import { GIORNI_SCADENZA_VICINA, giorniAllaScadenza, giorniAllInizio, testoInizio, testoScadenza } from "@/pages/VolantiniKit/scadenza";

/** La pastiglia dello stato del volantino nell'intestazione: attivo, in arrivo o concluso. */
export interface StatoValidita {
  testo: string;
  tono: TonoStato;
  icona: string;
}

/**
 * Lo stato del volantino rispetto a oggi, dalle date della promo (giorni del calendario italiano):
 * "Inizia tra 5 giorni", "Attivo · scade tra 3 giorni" (in evidenza dagli ultimi giorni), "Concluso".
 * Null senza date valide: la pastiglia non c'è.
 */
export const statoValidita = (validitaDal: string | null | undefined, validitaAl: string | null | undefined, adesso: Date = new Date()): StatoValidita | null => {
  const allInizio = giorniAllInizio(validitaDal, adesso);
  const allaFine = giorniAllaScadenza(validitaAl, adesso);
  if (allInizio !== null && allInizio > 0) return { testo: testoInizio(allInizio), tono: "info", icona: "CalendarClock" };
  if (allaFine !== null && allaFine < 0) return { testo: "Concluso", tono: "neutral", icona: "CalendarX" };
  if (allaFine !== null) {
    return {
      testo: `Attivo · ${testoScadenza(allaFine).toLocaleLowerCase("it")}`,
      tono: allaFine <= GIORNI_SCADENZA_VICINA ? "warning" : "success",
      icona: "CalendarCheck",
    };
  }
  return allInizio !== null ? { testo: "Attivo", tono: "success", icona: "CalendarCheck" } : null;
};
