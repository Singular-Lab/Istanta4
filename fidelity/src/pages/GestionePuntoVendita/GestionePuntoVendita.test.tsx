// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  dispositivi: {} as Record<string, unknown>,
  contesti: {} as Record<string, unknown>,
  puntoVendita: {
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
    nome_canale: "Super",
    nome_area: "Nord",
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
vi.mock("@/assets/images/users/user_icon_profile.png", () => ({ default: "" }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("../../hooks/usePVDeviceStatus", () => ({
  usePVDeviceStatus: () => ({ deviceStatuses: {}, getDeviceStatus: () => undefined }),
}));
vi.mock("../../query/query", () => ({
  useFetchDispositiviPuntoVendita: () => finti.dispositivi,
  useFetchDisplayContextsByPuntoVendita: () => finti.contesti,
  useFetchFilesFieldValues: () => ({ data: [], isLoading: false }),
  useFetchFilesMetadataFields: () => ({ data: [] }),
  useFetchVolantiniAttiviPuntoVendita: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

import GestionePuntoVendita from ".";

const dispositivo = (dati: Record<string, unknown>) => ({
  descrizione: null,
  display_url: null,
  displayContext: null,
  last_seen_at: null,
  is_online: false,
  ...dati,
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <GestionePuntoVendita />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Gestione punto vendita", () => {
  beforeEach(() => {
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

  it("il riepilogo dei dispositivi usa le StatCard e il filtro per stato è un gruppo a scelta singola", async () => {
    apri();

    const etichette = ["Online", "Warning", "Offline"].map((etichetta) => screen.getByText(etichetta, { selector: "dt" }));
    expect(etichette.map((dt) => dt.nextElementSibling?.textContent)).toEqual(["1", "0", "1"]);

    const stato = screen.getByRole("radiogroup", { name: "Stato" });
    await userEvent.click(within(stato).getByRole("radio", { name: /^Offline/ }));
    expect(screen.getByRole("heading", { name: "TV casse" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "TV ingresso" })).not.toBeInTheDocument();
  });

  it("se i dispositivi non arrivano mostra l'errore con Riprova, non l'elenco vuoto", async () => {
    const refetch = vi.fn();
    finti.dispositivi = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch };
    apri();

    const avviso = screen.getAllByRole("alert").find((elemento) => elemento.textContent?.includes("Dispositivi non caricati"));
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText("Nessun dispositivo registrato")).not.toBeInTheDocument();
    await userEvent.click(within(avviso!).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("se i contesti non arrivano mostra l'errore invece di \"Nessun display context\"", () => {
    finti.contesti = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch: vi.fn() };
    apri();

    expect(screen.getAllByRole("alert").some((elemento) => elemento.textContent?.includes("Contesti non caricati"))).toBe(true);
    expect(screen.queryByText("Nessun display context")).not.toBeInTheDocument();
  });
});
