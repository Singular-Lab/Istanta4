import { isHubServiceAbsoluteUrl, normalizeHubServiceRedirectPage } from "../../../lib/hubServiceRedirect";
import type { HubServiceDTO } from "../../../lib/types";

/** Il messaggio quando Fidelity non risponde come previsto: il server, se puo', ne manda uno suo. */
export const MESSAGGIO_ACCESSO_FICO_NON_RIUSCITO =
  "Accesso automatico al servizio non riuscito. Riprova o avvisa l'amministratore.";

export type IndirizzoServizioFico = { url: string } | { errore: string };

interface RispostaContestoFico {
  context?: unknown;
  base_url?: string | null;
  message?: string;
}

/**
 * L'indirizzo con cui aprire un servizio Esterno FICO: chiede a Fidelity il context cifrato e lo
 * aggiunge all'indirizzo del servizio (o a FICO_BASE_URL, se l'indirizzo del servizio e' relativo).
 * Senza un context valido restituisce l'errore e il servizio non si apre: aperto senza context,
 * l'applicazione risponderebbe con un errore che non dice dove sta il guasto.
 *
 * `baseApi` puo' essere relativo (in produzione VITE_API_URL vale "/api"): l'indirizzo del context
 * si risolve allora sull'origine della pagina, altrimenti `new URL` lancerebbe e il servizio non si
 * aprirebbe mai.
 */
export async function indirizzoServizioFico(
  service: Pick<HubServiceDTO, "url" | "redirect_page">,
  baseApi: string,
  chiedi: typeof fetch = fetch,
): Promise<IndirizzoServizioFico> {
  let context: string;
  let baseUrl: string | null = null;
  try {
    const endpoint = new URL(`${baseApi}/hub-services/fico-context`, globalThis.location?.href);
    const route = normalizeHubServiceRedirectPage(service.redirect_page);
    if (route) endpoint.searchParams.set("route", route);

    const res = await chiedi(endpoint.toString(), { credentials: "include" });
    const corpo = (await res.json().catch(() => null)) as RispostaContestoFico | null;
    if (!res.ok || typeof corpo?.context !== "string" || corpo.context === "") {
      return { errore: corpo?.message || MESSAGGIO_ACCESSO_FICO_NON_RIUSCITO };
    }
    context = corpo.context;
    baseUrl = corpo.base_url ?? null;
  } catch {
    return { errore: MESSAGGIO_ACCESSO_FICO_NON_RIUSCITO };
  }

  const destinazione = isHubServiceAbsoluteUrl(service.url) ? service.url : (baseUrl ?? service.url);
  if (!isHubServiceAbsoluteUrl(destinazione)) {
    return { errore: "Indirizzo del servizio non valido: va configurato nella gestione dell'hub." };
  }
  const url = new URL(destinazione);
  url.searchParams.set("context", context);
  return { url: url.toString() };
}
