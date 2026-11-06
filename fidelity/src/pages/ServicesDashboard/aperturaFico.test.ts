import { describe, expect, it, vi } from "vitest";
import { indirizzoServizioFico, MESSAGGIO_ACCESSO_FICO_NON_RIUSCITO } from "./aperturaFico";

const API = "https://fidelity.esempio.it/api";

/** Una risposta di fetch con lo stato e il corpo JSON indicati. */
const risposta = (status: number, corpo: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } }));

describe("indirizzoServizioFico", () => {
  it("aggiunge il context all indirizzo assoluto del servizio e passa la pagina di arrivo", async () => {
    const chiedi = risposta(200, { context: "abc+/=", base_url: "https://fico.esempio.it" });

    const esito = await indirizzoServizioFico(
      { url: "https://correggo.esempio.it/OAuthLanded.ashx", redirect_page: "/promo" },
      API,
      chiedi,
    );

    expect(esito).toEqual({ url: "https://correggo.esempio.it/OAuthLanded.ashx?context=abc%2B%2F%3D" });
    const chiamata = new URL(chiedi.mock.calls[0][0]);
    expect(chiamata.pathname).toBe("/api/hub-services/fico-context");
    expect(chiamata.searchParams.get("route")).toBe("/promo");
    expect(chiedi.mock.calls[0][1]).toEqual({ credentials: "include" });
  });

  it("con un indirizzo relativo usa FICO_BASE_URL restituito da Fidelity", async () => {
    const esito = await indirizzoServizioFico(
      { url: "/LoginController/oauth/landed" },
      API,
      risposta(200, { context: "ctx", base_url: "https://fico.esempio.it/ingresso" }),
    );

    expect(esito).toEqual({ url: "https://fico.esempio.it/ingresso?context=ctx" });
  });

  it("se Fidelity non prepara il context restituisce il suo messaggio e nessun indirizzo", async () => {
    const esito = await indirizzoServizioFico(
      { url: "https://correggo.esempio.it/OAuthLanded.ashx" },
      API,
      risposta(502, { message: "Accesso automatico al servizio non riuscito: passaporto mancante." }),
    );

    expect(esito).toEqual({ errore: "Accesso automatico al servizio non riuscito: passaporto mancante." });
  });

  it("una risposta riuscita senza context non apre il servizio", async () => {
    const esito = await indirizzoServizioFico(
      { url: "https://correggo.esempio.it/OAuthLanded.ashx" },
      API,
      risposta(200, { base_url: null }),
    );

    expect(esito).toEqual({ errore: MESSAGGIO_ACCESSO_FICO_NON_RIUSCITO });
  });

  it("se Fidelity non risponde restituisce il messaggio predefinito", async () => {
    const esito = await indirizzoServizioFico(
      { url: "https://correggo.esempio.it/OAuthLanded.ashx" },
      API,
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    expect(esito).toEqual({ errore: MESSAGGIO_ACCESSO_FICO_NON_RIUSCITO });
  });

  it("un indirizzo relativo senza FICO_BASE_URL e un errore, non un indirizzo da aprire", async () => {
    const esito = await indirizzoServizioFico({ url: "/OAuthLanded.ashx" }, API, risposta(200, { context: "ctx", base_url: null }));

    expect(esito).toHaveProperty("errore");
  });
});
