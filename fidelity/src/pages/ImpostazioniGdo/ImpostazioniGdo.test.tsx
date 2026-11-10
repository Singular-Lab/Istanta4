// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EsitoVerificaConfigurazione, ImpostazioniGdo as Impostazioni } from "../../../lib/impostazioniGdo/tipi";

const finti = vi.hoisted(() => ({
  servizio: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  notifica: vi.fn(),
  permessi: null as Set<string> | null,
  /** Le impostazioni come le ha il server: la DELETE le cambia, la GET successiva le rilegge. */
  stato: null as unknown,
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { ...finti.servizio, getUrl: () => "/api" } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.notifica }) }));
vi.mock("@/context/PermissionContext", () => ({
  usePermissionContext: () => ({
    hasPermission: (codice: string) => finti.permessi === null || finti.permessi.has(codice),
    loading: false,
  }),
}));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: ComponentType) => Componente }));
// Il tooltip dei comandi disattivati non serve al comportamento verificato
vi.mock("@/components/Base/Tippy", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
// Monaco non gira in jsdom: un'area di testo con lo stesso nome e lo stesso contratto
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options?: { ariaLabel?: string } }) => (
    <textarea aria-label={options?.ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import ImpostazioniGdo from ".";

const IMPOSTAZIONI: Impostazioni = {
  gdo: { id: "gdo-1", nome: "Conad Nord Ovest", haIcona: false },
  identita: { colore: "#c62828" },
  reparti: [
    { codice: "01", nomeDati: "DROGHERIA ALIMENTARE", nomeMarketing: "Dispensa", colore: "#2563eb", referenze: 84, daNominare: false, suggerimento: null },
    { codice: "12", nomeDati: "NON FOOD", nomeMarketing: null, colore: null, referenze: 12, daNominare: true, suggerimento: "Casa e cura" },
  ],
  lineeDistributore: {
    linee: [{ sigla: "conad_vn", nome: "Verso Natura", colore: "#2e7d32", logo: null }],
    bolli: [{ sigla: "dop", nome: "DOP", logo: null }],
  },
  campiReferenze: [
    { expected_input: "REPARTO", expected_output: "reparto", core: true },
    { expected_input: "promo_db1", expected_output: "codice_promo", core: false },
  ],
  sitoWeb: { css_text: "body{color:red}", icona_pagina: "", logo_header: [], stili: [], meta_volantino: { title: "", description: "" } },
  insightVolantino: {
    configurazione: { reparti: { colorStrategy: { type: "auto" } } },
    origine: "gdo",
    aggiornatoIl: "2026-11-09T16:42:00",
    aggiornatoDa: "Mario Rossi",
  },
};

const VALIDA: EsitoVerificaConfigurazione = { valida: true, errori: [], sezioni: ["reparti"] };

const apri = (indirizzo = "/impostazioni-gdo") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[indirizzo]}>
        <ImpostazioniGdo />
      </MemoryRouter>
    </QueryClientProvider>
  );

const sezione = async (titolo: string) => screen.findByRole("region", { name: titolo });
const chiamatePut = () => finti.servizio.put.mock.calls.map(([url]) => url);

describe("Impostazioni GDO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finti.permessi = null;
    finti.stato = structuredClone(IMPOSTAZIONI);
    finti.servizio.get.mockImplementation(async (url: string) => {
      if (url === "/impostazioni-gdo") return structuredClone(finti.stato);
      if (url === "/referenze/campi-non-tradotti") return [{ campo: "promo_db1", tradotto: "codice_promo", referenze: 120 }];
      return [];
    });
    finti.servizio.put.mockImplementation(async () => structuredClone(IMPOSTAZIONI));
    finti.servizio.delete.mockImplementation(async () => {
      finti.stato = {
        ...structuredClone(IMPOSTAZIONI),
        insightVolantino: { configurazione: null, origine: "assente", aggiornatoIl: null, aggiornatoDa: null },
      };
      return structuredClone(finti.stato);
    });
    finti.servizio.post.mockImplementation(async (url: string, corpo: { configurazione?: Record<string, unknown>; campo?: string }) => {
      if (url === "/referenze/campi-non-tradotti/sync") return { campo: corpo.campo, tradotto: "codice_promo", referenze: 120, kit: 3 };
      if (url === "/impostazioni-gdo/insight-volantino/verifica") {
        return corpo.configurazione && "errato" in corpo.configurazione
          ? { valida: false, errori: [{ percorso: "reparti.colorStrategy.type", messaggio: "Valore non ammesso" }], sezioni: [] }
          : VALIDA;
      }
      return {};
    });
  });

  it("mostra le sezioni con i dati della GDO e nell'indice i reparti da nominare e i mapping da sincronizzare", async () => {
    apri();

    expect(await screen.findByRole("heading", { level: 1, name: "Impostazioni GDO" })).toBeInTheDocument();
    // Il titolo c'è già mentre le impostazioni si caricano: le sezioni arrivano con i dati
    expect(await screen.findByRole("region", { name: "Identità della GDO" })).toBeInTheDocument();
    for (const titolo of [
      "Identità della GDO",
      "Loghi delle insegne",
      "Reparti",
      "Marchi del distributore",
      "Campi delle referenze",
      "Insight del volantino",
      "Aspetto del sito web",
    ]) {
      expect(screen.getByRole("region", { name: titolo })).toBeInTheDocument();
    }
    const indice = screen.getByRole("navigation", { name: "Sezioni delle impostazioni" });
    expect(within(indice).getByRole("link", { name: /Reparti/ })).toHaveTextContent("1 da nominare");
    expect(await within(indice).findByText("1 da sincronizzare")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Conad Nord Ovest");
    expect(within(screen.getByRole("list", { name: "Linee del distributore" })).getByText("Verso Natura")).toBeInTheDocument();
    expect(screen.getByText(/Salvata per la GDO il 09\/11\/2026 alle 16:42 da Mario Rossi/)).toBeInTheDocument();
  });

  it("senza dati mostra il motivo e Riprova li richiede di nuovo", async () => {
    finti.servizio.get.mockImplementation(async (url: string) => {
      if (url === "/impostazioni-gdo") throw new Error("Servizio non raggiungibile");
      return [];
    });
    apri();

    expect(await screen.findByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    await waitFor(() =>
      expect(finti.servizio.get.mock.calls.filter(([url]) => url === "/impostazioni-gdo")).toHaveLength(2)
    );
  });

  it("l'identità salva solo il colore, con la sua PUT", async () => {
    const utente = userEvent.setup();
    apri();
    const identita = await sezione("Identità della GDO");
    const salva = within(identita).getByRole("button", { name: "Salva identità" });
    expect(salva).toBeDisabled();

    const colore = within(identita).getByRole("textbox", { name: "Colore della GDO" });
    await utente.clear(colore);
    await utente.type(colore, "#12345");
    expect(within(identita).getByText(/Scrivi il colore come #rrggbb/)).toBeInTheDocument();
    await utente.type(colore, "6");
    await utente.click(salva);

    await waitFor(() => expect(finti.servizio.put).toHaveBeenCalledWith("/impostazioni-gdo/identita", { colore: "#123456" }));
    expect(chiamatePut()).toEqual(["/impostazioni-gdo/identita"]);
    expect(within(screen.getByRole("region", { name: "Loghi delle insegne" })).getByRole("button", { name: "Salva loghi" })).toBeDisabled();
  });

  it("i reparti propongono il suggerimento, filtrano quelli da nominare e salvano solo i reparti", async () => {
    const utente = userEvent.setup();
    apri();
    const reparti = await sezione("Reparti");

    await utente.click(within(reparti).getByRole("radio", { name: /Solo da nominare/ }));
    expect(within(reparti).queryByRole("textbox", { name: "Nome per il marketing del reparto 01" })).not.toBeInTheDocument();
    expect(within(reparti).getByText("da nominare")).toBeInTheDocument();

    await utente.click(within(reparti).getByRole("button", { name: "Usa «Casa e cura»" }));
    expect(within(reparti).getByRole("textbox", { name: "Nome per il marketing del reparto 12" })).toHaveValue("Casa e cura");
    await utente.click(within(reparti).getByRole("button", { name: "Salva reparti" }));

    await waitFor(() =>
      expect(finti.servizio.put).toHaveBeenCalledWith("/impostazioni-gdo/reparti", {
        reparti: [
          { codice: "01", nomeDati: "DROGHERIA ALIMENTARE", nomeMarketing: "Dispensa", colore: "#2563eb" },
          { codice: "12", nomeDati: "NON FOOD", nomeMarketing: "Casa e cura", colore: null },
        ],
      })
    );
    expect(chiamatePut()).toEqual(["/impostazioni-gdo/reparti"]);
  });

  it("i campi delle referenze si salvano con la loro PUT e il Sync chiede conferma", async () => {
    const utente = userEvent.setup();
    apri();
    const campi = await sezione("Campi delle referenze");

    await utente.type(within(campi).getByRole("textbox", { name: "Campo originale (input)" }), "DESCRIZIONE_REPARTO");
    await utente.type(within(campi).getByRole("textbox", { name: "Campo tradotto (output)" }), "descrizione_reparto");
    await utente.click(within(campi).getByRole("button", { name: "Aggiungi mapping di traduzione" }));
    await utente.click(within(campi).getByRole("button", { name: "Salva campi" }));

    await waitFor(() =>
      expect(finti.servizio.put).toHaveBeenCalledWith("/impostazioni-gdo/campi-referenze", {
        campiReferenze: [
          ...IMPOSTAZIONI.campiReferenze,
          { expected_input: "DESCRIZIONE_REPARTO", expected_output: "descrizione_reparto", core: false },
        ],
      })
    );
    expect(chiamatePut()).toEqual(["/impostazioni-gdo/campi-referenze"]);

    await utente.click(await within(campi).findByRole("button", { name: "Sincronizza il mapping promo_db1" }));
    const conferma = within(campi).getByRole("alertdialog", { name: "Conferma il Sync di promo_db1" });
    await utente.click(within(conferma).getByRole("button", { name: "Conferma Sync" }));
    await waitFor(() =>
      expect(finti.servizio.post).toHaveBeenCalledWith("/referenze/campi-non-tradotti/sync", { campo: "promo_db1" })
    );
  });

  it("gli insight verificano da soli la configurazione salvata", async () => {
    apri();
    const insight = await sezione("Insight del volantino");

    expect(await within(insight).findByText("Configurazione valida", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(within(within(insight).getByRole("list", { name: "Sezioni riconosciute" })).getByText("reparti")).toBeInTheDocument();
    expect(finti.servizio.post).toHaveBeenCalledWith("/impostazioni-gdo/insight-volantino/verifica", {
      configurazione: IMPOSTAZIONI.insightVolantino.configurazione,
    });
  });

  it("un JSON caricato va nell'editor, si verifica subito e gli errori compaiono con il loro percorso", async () => {
    const utente = userEvent.setup();
    apri();
    const insight = await sezione("Insight del volantino");
    const configurazione = { errato: true, reparti: {} };

    await utente.upload(
      within(insight).getByLabelText("File JSON della configurazione degli insight"),
      new File([JSON.stringify(configurazione)], "flyerInsightsConfig.json", { type: "application/json" })
    );

    expect(await within(insight).findByRole("textbox", { name: "Configurazione degli insight (JSON)" })).toHaveValue(
      JSON.stringify(configurazione, null, 2)
    );
    await waitFor(() =>
      expect(finti.servizio.post).toHaveBeenCalledWith("/impostazioni-gdo/insight-volantino/verifica", { configurazione })
    );
    const errori = await within(insight).findByRole("list", { name: "Errori della configurazione" });
    expect(errori).toHaveTextContent("reparti.colorStrategy.type");
    expect(errori).toHaveTextContent("Valore non ammesso");
    expect(finti.servizio.put).not.toHaveBeenCalled();
  });

  it("un salvataggio degli insight rifiutato dal server mostra gli errori della risposta 400", async () => {
    const utente = userEvent.setup();
    finti.servizio.put.mockImplementation(async (url: string) => {
      if (url === "/impostazioni-gdo/insight-volantino") {
        throw Object.assign(new Error("Configurazione non valida"), {
          httpStatus: 400,
          details: { valida: false, errori: [{ percorso: "pagine.enabled", messaggio: "Manca il campo enabled" }], sezioni: [] },
        });
      }
      return structuredClone(IMPOSTAZIONI);
    });
    apri();
    const insight = await sezione("Insight del volantino");

    fireEvent.change(await within(insight).findByRole("textbox", { name: "Configurazione degli insight (JSON)" }), {
      target: { value: '{"pagine": {}}' },
    });
    await utente.click(within(insight).getByRole("button", { name: "Salva configurazione" }));

    await waitFor(() =>
      expect(finti.servizio.put).toHaveBeenCalledWith("/impostazioni-gdo/insight-volantino", { configurazione: { pagine: {} } })
    );
    expect(await within(insight).findByText("Manca il campo enabled")).toBeInTheDocument();
    expect(within(insight).getByText("pagine.enabled")).toBeInTheDocument();
  });

  it("un 400 senza gli errori nel corpo li chiede alla verifica e li mostra", async () => {
    const utente = userEvent.setup();
    finti.servizio.put.mockImplementation(async (url: string) => {
      if (url === "/impostazioni-gdo/insight-volantino") {
        throw Object.assign(new Error("Errore generico del server"), { httpStatus: 400, details: {} });
      }
      return structuredClone(IMPOSTAZIONI);
    });
    apri();
    const insight = await sezione("Insight del volantino");

    fireEvent.change(await within(insight).findByRole("textbox", { name: "Configurazione degli insight (JSON)" }), {
      target: { value: '{"errato": 1}' },
    });
    await utente.click(within(insight).getByRole("button", { name: "Salva configurazione" }));

    await waitFor(() =>
      expect(finti.servizio.post).toHaveBeenCalledWith("/impostazioni-gdo/insight-volantino/verifica", { configurazione: { errato: 1 } })
    );
    expect(await within(insight).findByRole("list", { name: "Errori della configurazione" })).toHaveTextContent("Valore non ammesso");
    expect(finti.notifica).toHaveBeenCalledWith(expect.stringContaining("gli errori sono nella verifica"), { variant: "error" });
  });

  it("un JSON non valido nell'editor blocca il salvataggio degli insight", async () => {
    apri();
    const insight = await sezione("Insight del volantino");

    fireEvent.change(await within(insight).findByRole("textbox", { name: "Configurazione degli insight (JSON)" }), {
      target: { value: '{"pagine": ' },
    });

    expect(within(insight).getByText("JSON non valido")).toBeInTheDocument();
    expect(within(insight).getByRole("button", { name: "Salva configurazione" })).toBeDisabled();
  });

  it("tornare al file dell'installazione chiede conferma e toglie la configurazione della GDO", async () => {
    const utente = userEvent.setup();
    apri();
    const insight = await sezione("Insight del volantino");

    await utente.click(within(insight).getByRole("button", { name: "Torna al file dell'installazione" }));
    await utente.click(await screen.findByRole("button", { name: "Torna al file" }));

    await waitFor(() => expect(finti.servizio.delete).toHaveBeenCalledWith("/impostazioni-gdo/insight-volantino"));
    expect(await within(insight).findByText("Nessuna configurazione")).toBeInTheDocument();
  });

  it("l'aspetto del sito web salva gli stili dell'editor visuale, e solo i campi cambiati", async () => {
    const utente = userEvent.setup();
    apri();
    const aspetto = await sezione("Aspetto del sito web");

    await utente.click(within(aspetto).getByRole("button", { name: "Nuovo stile" }));
    await utente.click(within(aspetto).getByRole("button", { name: "Salva aspetto" }));

    await waitFor(() => expect(finti.servizio.put).toHaveBeenCalledTimes(1));
    const [url, corpo] = finti.servizio.put.mock.calls[0];
    expect(url).toBe("/impostazioni-gdo/sito-web");
    expect(Object.keys(corpo)).toEqual(["stili"]);
    expect(corpo.stili).toEqual([expect.objectContaining({ nome_stile: "Stile 1" })]);
  });

  it("gli stili in JSON modificano gli stessi stili dell'editor visuale", async () => {
    const utente = userEvent.setup();
    apri();
    const aspetto = await sezione("Aspetto del sito web");

    await utente.click(within(aspetto).getByRole("radio", { name: "Stili in JSON" }));
    fireEvent.change(await within(aspetto).findByRole("textbox", { name: "Stili dei box (JSON)" }), {
      target: { value: '[{"nome_stile": "Promo", "condizioni": [], "struttura": {"tag": "div"}}]' },
    });
    await utente.click(within(aspetto).getByRole("radio", { name: "Stili dei box" }));

    expect(within(aspetto).getByRole("option", { name: "Promo" })).toBeInTheDocument();
    await utente.click(within(aspetto).getByRole("button", { name: "Salva aspetto" }));
    await waitFor(() =>
      expect(finti.servizio.put).toHaveBeenCalledWith("/impostazioni-gdo/sito-web", {
        stili: [{ nome_stile: "Promo", condizioni: [], struttura: { tag: "div" } }],
      })
    );
  });

  it("senza il permesso di caricare l'icona della GDO il pulsante è disattivato", async () => {
    finti.permessi = new Set(["impostazioni.visualizza", "impostazioni.modifica_generali"]);
    apri();
    const identita = await sezione("Identità della GDO");

    expect(within(identita).getByText("Carica SVG").closest("[aria-disabled='true']")).not.toBeNull();
    expect(within(identita).getByRole("button", { name: "Salva identità" }).closest("[aria-disabled='true']")).toBeNull();
  });

  it("con ?sezione= l'indice segna la sezione scelta", async () => {
    apri("/impostazioni-gdo?sezione=aspetto-sito-web");

    const indice = await screen.findByRole("navigation", { name: "Sezioni delle impostazioni" });
    expect(within(indice).getByRole("link", { name: "Aspetto del sito web" })).toHaveAttribute("aria-current", "location");
    expect(within(indice).getByRole("link", { name: "Identità della GDO" })).not.toHaveAttribute("aria-current");
  });
});
