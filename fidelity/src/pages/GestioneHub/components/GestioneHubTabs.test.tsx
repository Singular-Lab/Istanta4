// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  servizi: {} as Record<string, unknown>,
  news: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
// L'editor rich text non serve a questi test e non gira in jsdom
vi.mock("@/components/Base/Ckeditor", () => ({ ClassicEditor: () => null }));
vi.mock("@/query/query", () => ({
  HUB_QUERY_KEYS: { servicesAdmin: ["a"], services: ["b"], newsAdmin: ["c"], news: ["d"] },
  useFetchAllRuoliGDO: () => ({ data: [] }),
  useFetchHubServicesAdmin: () => finti.servizi,
  useFetchHubNewsAdmin: () => finti.news,
}));

import NewsTab from "./NewsTab";
import ServicesTab from "./ServicesTab";

const apri = (contenuto: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{contenuto}</QueryClientProvider>);

const servizio = (override: Record<string, unknown> = {}) => ({
  id: "s1",
  codice: "ISTANTA",
  nome: "Istanta",
  descrizione: "Produzione volantini",
  icona: "Box",
  colore: "primary",
  tipo_utente: "GDO",
  ruolo_gdo: null,
  tipo_url: "ESTERNO",
  url: "https://esempio.local",
  ordine: 1,
  attivo: true,
  in_manutenzione: false,
  in_evidenza: false,
  gestito: null,
  url_non_configurato: false,
  documents: [],
  videos: [],
  ...override,
});

describe("Gestione Hub", () => {
  beforeEach(() => {
    finti.refetch.mockReset();
    finti.servizi = { data: {}, isLoading: false, isError: false, refetch: finti.refetch };
    finti.news = { data: [], isLoading: false, isError: false, error: null, refetch: finti.refetch };
  });

  it("se i servizi non arrivano mostra l'errore, non \"nessun servizio\", e Riprova li ricarica", async () => {
    finti.servizi = { data: undefined, isLoading: false, isError: true, refetch: finti.refetch };
    apri(<ServicesTab />);

    expect(screen.getByRole("alert")).toHaveTextContent("Servizi non caricati");
    expect(screen.queryByText("Nessun servizio configurato")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.refetch).toHaveBeenCalled();
  });

  it("se le news non arrivano mostra l'errore, non l'archivio vuoto", () => {
    finti.news = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio news non raggiungibile"), refetch: finti.refetch };
    apri(<NewsTab />);

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio news non raggiungibile");
    expect(screen.queryByText("Nessuna news presente")).not.toBeInTheDocument();
  });

  it("i servizi si filtrano per stato con i conteggi e le azioni secondarie stanno in un menu", async () => {
    finti.servizi = {
      data: { ISTANTA: [servizio()], DOCS: [servizio({ id: "s2", codice: "DOCS", nome: "Documenti", attivo: false })] },
      isLoading: false,
      isError: false,
      refetch: finti.refetch,
    };
    apri(<ServicesTab />);

    const stati = screen.getByRole("radiogroup", { name: "Stato dei servizi" });
    expect(within(stati).getByRole("radio", { name: /Tutti/ })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(within(stati).getByRole("radio", { name: /Inattivi/ }));
    expect(screen.getByRole("heading", { name: "Documenti" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Istanta" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Altre azioni per Documenti" }));
    expect(await screen.findByRole("menuitem", { name: "Elimina servizio" })).toBeInTheDocument();
  });
});
