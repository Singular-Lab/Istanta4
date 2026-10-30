// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  dispositivi: {} as Record<string, unknown>,
  contesti: {} as Record<string, unknown>,
  puntoVendita: null as Record<string, unknown> | null,
  put: vi.fn(),
  delete: vi.fn(),
  notifica: vi.fn(),
  combinazioni: {
    data: [{ id: "comb1", sigla_combinazione: "SN", stato_combinazione: "attiva", id_canale: "c1", id_area: "a1", nome_canale: "Super", nome_area: "Nord" }],
  },
}));

vi.mock("react-router-dom", async (originale) => ({
  ...(await originale<typeof import("react-router-dom")>()),
  useLoaderData: () => ({ puntoVendita: finti.puntoVendita }),
}));
vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => ({ default: { divIcon: () => ({}) } }));
vi.mock("react-leaflet", () => ({ Marker: () => null, TileLayer: () => null }));
vi.mock("react-leaflet/MapContainer", () => ({ MapContainer: () => null }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: finti.put, delete: finti.delete } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.notifica }) }));
vi.mock("../../hooks/usePVDeviceStatus", () => ({
  usePVDeviceStatus: () => ({ deviceStatuses: {}, getDeviceStatus: () => undefined }),
}));
vi.mock("../../query/query", () => ({
  useFetchDispositiviPuntoVendita: () => finti.dispositivi,
  useFetchDisplayContextsByPuntoVendita: () => finti.contesti,
  useFetchFilesFieldValues: () => ({ data: [], isLoading: false }),
  useFetchFilesMetadataFields: () => ({ data: [] }),
  useFetchPuntoVenditaGestione: () => ({ data: finti.puntoVendita }),
  useFetchStoriaPuntoVendita: () => ({ data: undefined }),
  useFetchAllCombinazioneForGDO: () => finti.combinazioni,
  useFetchReteInsegne: () => ({ data: undefined }),
}));

import GestionePuntoVendita from ".";

const PUNTO_VENDITA = {
  id: "pv1",
  nome: "Conad Firenze",
  nome_display: null,
  indirizzo: "Via Roma 1",
  cap: "50100",
  citta: "Firenze",
  provincia: "FI",
  regione: "Toscana",
  ragionesociale: "Conad Srl",
  telefono: null,
  has_coordinate: false,
  coordinate: null,
  numero_utenti_collegati: 3,
  meta: {},
  id_combinazione_canale_area: "comb1",
  nome_canale: "Super",
  nome_area: "Nord",
};

const dispositivo = (dati: Record<string, unknown>) => ({
  descrizione: null,
  display_url: null,
  displayContext: null,
  last_seen_at: null,
  is_online: false,
  ...dati,
});

/** L'indirizzo corrente, per vedere la scheda scelta nella query string. */
function Indirizzo() {
  const { pathname, search } = useLocation();
  return <div data-testid="indirizzo">{`${pathname}${search}`}</div>;
}

const apri = (percorso = "/gestione-interna/punti-vendita/pv1") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[percorso]}>
        <Routes>
          <Route
            path="/gestione-interna/punti-vendita/:id"
            element={
              <>
                <GestionePuntoVendita />
                <Indirizzo />
              </>
            }
          />
          <Route path="/gestione-interna/punti-vendita" element={<div>Elenco dei punti vendita</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Gestione punto vendita", () => {
  beforeEach(() => {
    finti.puntoVendita = { ...PUNTO_VENDITA };
    finti.put.mockReset();
    finti.delete.mockReset();
    finti.notifica.mockReset();
    finti.dispositivi = {
      data: [
        dispositivo({ id: "d1-aaaaaaaa", nome: "TV ingresso", is_active: true, is_online: true }),
        dispositivo({ id: "d2-bbbbbbbb", nome: "TV casse", is_active: false }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    finti.contesti = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
  });

  it("il nome del punto vendita compare una volta sola, nell'intestazione con il ritorno all'elenco", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Conad Firenze" })).toBeInTheDocument();
    expect(screen.getAllByText("Conad Firenze", { selector: "h1, div, span" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Torna ai punti vendita" })).toHaveAttribute("href", "/gestione-interna/punti-vendita");
  });

  it("i volantini attivi non sono più qui: \"Apri scheda\" porta alla scheda di consultazione", () => {
    apri();

    expect(screen.queryByRole("heading", { name: "Volantini attivi" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Apri scheda/ })).toHaveAttribute("href", "/punti-vendita/pv1");
  });

  it("l'intestazione è compatta: insegna, area e stato dei dati, senza fascia colorata né avatar", () => {
    apri();

    const intestazione = screen.getByRole("heading", { level: 1, name: "Conad Firenze" }).parentElement!;
    expect(intestazione).toHaveTextContent("Super");
    expect(intestazione).toHaveTextContent("Nord");
    expect(intestazione).toHaveTextContent("Senza coordinate");
    expect(screen.queryByRole("img", { name: "Conad Firenze" })).not.toBeInTheDocument();
    // Elimina non è un pulsante rosso sulla fascia: sta nel menu "⋯"
    expect(screen.queryByRole("button", { name: /Elimina/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Altre azioni sul punto vendita" })).toBeInTheDocument();
  });

  it("l'insegna nell'intestazione è una pastiglia piena e chiara, leggibile sulla fascia scura", () => {
    apri();

    const intestazione = screen.getByRole("heading", { level: 1, name: "Conad Firenze" }).parentElement!;
    const insegna = within(intestazione).getByText("Super").parentElement!;
    expect(insegna).toHaveClass("bg-slate-100", "text-slate-700");
    expect(insegna).not.toHaveClass("border");
  });

  it("Canale e area mostra insegna e area per nome, non la sigla", () => {
    apri();

    expect(screen.getByLabelText("Canale e area")).toHaveDisplayValue("Super · Nord");
    expect(screen.queryByRole("option", { name: /\(SN\)/ })).not.toBeInTheDocument();
  });

  it("le schede stanno nell'URL: si apre su quella indicata e cambiandola cambia l'indirizzo", async () => {
    apri("/gestione-interna/punti-vendita/pv1?scheda=dispositivi");

    const schede = screen.getByRole("radiogroup", { name: "Aree di gestione" });
    expect(within(schede).getByRole("radio", { name: "Dispositivi 2" })).toHaveAttribute("aria-checked", "true");
    expect(within(schede).getByRole("radio", { name: "Display context 0" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /TV ingresso/ })).toBeInTheDocument();

    await userEvent.click(within(schede).getByRole("radio", { name: /^Display context/ }));
    expect(screen.getByTestId("indirizzo")).toHaveTextContent("?scheda=display");
    expect(screen.getByText("Nessun display context")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: /TV ingresso/ })).not.toBeInTheDocument();

    // L'anagrafica è la scheda predefinita: non serve nell'indirizzo
    await userEvent.click(within(schede).getByRole("radio", { name: "Anagrafica" }));
    expect(screen.getByTestId("indirizzo")).toHaveTextContent(/^\/gestione-interna\/punti-vendita\/pv1$/);
    expect(screen.getByLabelText("Nome")).toHaveValue("Conad Firenze");
  });

  it("i dispositivi si filtrano per stato, con i conteggi, e mostrano l'ultimo segnale", async () => {
    apri("/gestione-interna/punti-vendita/pv1?scheda=dispositivi");

    const stato = screen.getByRole("radiogroup", { name: "Stato" });
    expect(within(stato).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Tutti 2", "Online 1", "In ritardo 0", "Offline 1"]);

    await userEvent.click(within(stato).getByRole("radio", { name: /^Offline/ }));

    const righe = screen.getAllByRole("row").slice(1);
    expect(righe).toHaveLength(1);
    expect(righe[0]).toHaveTextContent("TV casse");
    expect(righe[0]).toHaveTextContent("Disattivato");
    expect(righe[0]).toHaveTextContent("Mai connesso");
    expect(within(righe[0]).getByRole("button", { name: "Assegna contesto a TV casse" })).toBeInTheDocument();
  });

  it("se i dispositivi non arrivano mostra l'errore con Riprova, non l'elenco vuoto", async () => {
    const refetch = vi.fn();
    finti.dispositivi = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch };
    apri("/gestione-interna/punti-vendita/pv1?scheda=dispositivi");

    const avviso = screen.getAllByRole("alert").find((elemento) => elemento.textContent?.includes("Dispositivi non caricati"));
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText("Nessun dispositivo registrato")).not.toBeInTheDocument();
    await userEvent.click(within(avviso!).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("se i contesti non arrivano mostra l'errore invece di \"Nessun display context\"", () => {
    finti.contesti = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch: vi.fn() };
    apri("/gestione-interna/punti-vendita/pv1?scheda=display");

    expect(screen.getAllByRole("alert").some((elemento) => elemento.textContent?.includes("Contesti non caricati"))).toBe(true);
    expect(screen.queryByText("Nessun display context")).not.toBeInTheDocument();
  });

  it("l'anagrafica si modifica nella pagina e si salva con modificaPV, che scrive prima su Istanta", async () => {
    finti.put.mockResolvedValue({ esito: true, error: "", isUpdate: true, data: { id: "pv1" } });
    apri();

    const salva = screen.getByRole("button", { name: "Salva modifiche" });
    expect(salva).toBeDisabled();
    expect(screen.getByLabelText("Nome")).toHaveValue("Conad Firenze");
    await userEvent.type(screen.getByLabelText("Telefono"), "055 123456");
    expect(salva).toBeEnabled();
    await userEvent.click(salva);

    await waitFor(() => expect(finti.put).toHaveBeenCalled());
    expect(finti.put).toHaveBeenCalledTimes(1);
    const [url, corpo] = finti.put.mock.calls[0];
    expect(url).toBe("/ACPV/modificaPV");
    expect(corpo).toMatchObject({ guidID: "pv1", nome: "Conad Firenze", telefono: "055 123456", guidIDCombinazione: "comb1", lat: null, lon: null });
    expect(finti.notifica).toHaveBeenCalledWith("Punto vendita aggiornato con successo", { variant: "success" });
    // Salvato, non ci sono più modifiche in sospeso
    await waitFor(() => expect(salva).toBeDisabled());
  });

  it("l'anagrafica ha la stessa validazione del modale: senza nome o con un CAP sbagliato non salva", async () => {
    apri();

    await userEvent.clear(screen.getByLabelText("Nome"));
    await userEvent.clear(screen.getByLabelText("Cap"));
    await userEvent.type(screen.getByLabelText("Cap"), "123");
    await userEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(await screen.findByText("Il nome è obbligatorio")).toBeInTheDocument();
    expect(screen.getByText("Il CAP deve essere di 5 cifre")).toBeInTheDocument();
    expect(finti.put).not.toHaveBeenCalled();
  });

  it("Correggi apre latitudine e longitudine accanto alla posizione; si salvano con l'anagrafica", async () => {
    finti.put.mockResolvedValue({ esito: true, error: "", isUpdate: true, data: { id: "pv1" } });
    apri();

    expect(screen.getByText("Coordinate non disponibili")).toBeInTheDocument();
    expect(screen.queryByLabelText("Latitudine")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Correggi/ }));
    fireEvent.change(screen.getByLabelText("Latitudine"), { target: { value: "43.7696" } });
    fireEvent.change(screen.getByLabelText("Longitudine"), { target: { value: "11.2558" } });
    // La posizione si aggiorna mentre si scrive
    expect(screen.getByText("43.76960, 11.25580")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => expect(finti.put).toHaveBeenCalled());
    expect(finti.put.mock.calls[0][1]).toMatchObject({ lat: 43.7696, lon: 11.2558 });
  });

  it("i codici della GDO si leggono ma non si modificano; i dati di sistema mostrano anche l'insegna dei meta", () => {
    finti.puntoVendita = { ...PUNTO_VENDITA, meta: { id_anacan: "004512", insegna: "Conad City" } };
    apri();

    expect(screen.getByText("ID ANACAN")).toBeInTheDocument();
    expect(screen.getByText("004512")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("004512")).not.toBeInTheDocument();
    expect(screen.getByText("INSEGNA")).toBeInTheDocument();
    expect(screen.getByText("Conad City")).toBeInTheDocument();
  });

  it("Elimina chiede conferma, elimina il punto vendita e torna all'elenco", async () => {
    finti.delete.mockResolvedValue({});
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Altre azioni sul punto vendita" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Elimina" }));
    const conferma = await screen.findByRole("dialog", { name: "Eliminare il punto vendita?" });
    await userEvent.click(within(conferma).getByRole("button", { name: "Elimina" }));

    await waitFor(() => expect(finti.delete).toHaveBeenCalledWith("/ACPV/eliminaPV/pv1"));
    expect(await screen.findByText("Elenco dei punti vendita")).toBeInTheDocument();
  });

  it("se il loader non trova il punto vendita lo dice, con il ritorno all'elenco", () => {
    finti.puntoVendita = null;
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Punto vendita non trovato");
    expect(screen.getByRole("link", { name: "Torna ai punti vendita" })).toHaveAttribute("href", "/gestione-interna/punti-vendita");
  });
});
