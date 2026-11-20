import type { HubServiceDTO } from "../../../lib/types";

/**
 * Ingresso diretto dall'hub (spec hub-servizi, "Ingresso diretto con un solo servizio"): arrivando
 * all'hub dopo l'accesso, un utente con un solo servizio che puo' aprire ci entra subito. Una volta
 * sola per accesso: la pagina di accesso lascia un segno nella sessione del browser, l'hub lo legge
 * e lo toglie. Chi torna all'hub piu' tardi (dal menu, con il tasto indietro) vede l'hub.
 *
 * Il segno sta in sessionStorage e non in uno stato della navigazione perche' gli accessi OIDC e
 * SAML tornano all'hub passando dal fornitore esterno, con una pagina caricata da capo.
 */

const CHIAVE = "fidelity:hub:dopo-accesso";

/** Da chiamare appena prima di andare all'hub dopo l'accesso, o al fornitore esterno. */
export function segnaAccessoAppenaFatto(): void {
  try {
    sessionStorage.setItem(CHIAVE, "1");
  } catch {
    // Senza sessionStorage (navigazione privata bloccata) l'hub resta visibile: va bene lo stesso
  }
}

/** Se l'hub si apre subito dopo un accesso. Non toglie il segno: lo fa dimenticaAccessoAppenaFatto. */
export function leggiAccessoAppenaFatto(): boolean {
  try {
    return sessionStorage.getItem(CHIAVE) === "1";
  } catch {
    return false;
  }
}

export function dimenticaAccessoAppenaFatto(): void {
  try {
    sessionStorage.removeItem(CHIAVE);
  } catch {
    // niente da togliere
  }
}

/** L'unico servizio che l'utente puo' aprire (attivo e non in manutenzione); null con nessuno o piu' d'uno. */
export function servizioDaAprireSubito(servizi: readonly HubServiceDTO[]): HubServiceDTO | null {
  const apribili = servizi.filter(servizio => servizio.attivo && !servizio.in_manutenzione);
  return apribili.length === 1 ? apribili[0] : null;
}
