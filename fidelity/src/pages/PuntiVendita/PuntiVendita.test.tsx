// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ puntiVendita: {} as Record<string, unknown> }));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
// La mappa vera non serve: Leaflet in jsdom non disegna nulla
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="mappa" />,
  TileLayer: () => null,
  CircleMarker: () => null,
  Popup: () => null,
  Tooltip: () => null,
  useMap: () => ({ fitBounds: vi.fn() }),
}));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/query/query", () => ({
  useFetchAllCombinazioneForGDO: () => ({ data: [] }),
  useFetchPuntiVenditaFromIdGDO: () => finti.puntiVendita,
}));
vi.mock("./useImportPuntiVendita", () => ({
  useImportPuntiVendita: () => ({
    stato: null,
    inCorso: false,
    avvioInCorso: false,
    annullamentoInCorso: false,
    avvia: vi.fn(),
    annulla: vi.fn(),
    decidi: vi.fn(),
    azzera: vi.fn(),
  }),
}));

import PuntiVendita from ".";

const puntoVendita = (indice: number) => ({
  id: `pv${indice}`,
  nome: `Punto vendita ${indice}`,
  indirizzo: `Via Roma ${indice}`,
  cap: "50100",
  citta: "Firenze",
  provincia: "FI",
  id_canale: "c1",
  nome_canale: "Super",
  id_area: "a1",
  nome_area: "Nord",
  has_coordinate: false,
  coordinate: null,
  meta: {},
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PuntiVendita />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Punti vendita", () => {
  beforeEach(() => {
    finti.puntiVendita = {
      data: Array.from({ length: 12 }, (_, indice) => puntoVendita(indice + 1)),
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  it("la paginazione mostra l'intervallo di righe e il totale", () => {
    apri();

    expect(screen.getByText("Mostrati 1–10 di 12")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginazione" })).toBeInTheDocument();
    expect(screen.getByLabelText("Righe per pagina")).toBeInTheDocument();
  });

  it("le azioni di riga stanno in un menu", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Azioni punto vendita Punto vendita 1" }));
    expect(await screen.findByRole("menuitem", { name: "Dettagli" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Modifica" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Elimina" })).toBeInTheDocument();
  });

  it("senza punti vendita la tabella mostra lo stato vuoto su tutte le colonne", () => {
    finti.puntiVendita = { ...finti.puntiVendita, data: [] };
    apri();

    const cella = screen.getByText("Nessun punto vendita disponibile").closest("td");
    const colonne = cella?.closest("table")?.querySelectorAll("thead th").length;
    expect(colonne).toBe(6);
    expect(cella).toHaveAttribute("colspan", String(colonne));
  });

  it("creare un punto vendita è l'azione primaria della pagina", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Punti Vendita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuovo punto vendita/ })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: /Importa Excel/ })).not.toHaveClass("bg-primary");
  });
});
