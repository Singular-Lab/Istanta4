// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/query/query", () => ({ useFetchKitRuntimeFilesPaginated: () => finti.query }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), getUrl: () => "" } }));

import DettagliKitOrdiniDiStampa from ".";

const file = (id: string, nome: string, stato?: string) => ({
  id,
  nome,
  id_runtime: "kit-1",
  url: `https://anteprime.test/${id}.png`,
  pages: 1,
  tipo_export_codice: "PDF_STAMPA",
  meta_olimpo_cloud: {},
  log: stato ? { stato, data_registrazione: "2026-09-03T10:30:00" } : undefined,
});

const datiPagina = (files: unknown[], totalPages = 1) => ({
  files,
  totalItems: totalPages * 24,
  totalPages,
  currentPage: 1,
  pageSize: 24,
  stats: { totalFiles: totalPages * 24, inRevisionCount: 0, filesWithMetaCount: 0, duplicateCount: 0 },
});

const apri = async () => {
  const router = createMemoryRouter(
    [
      {
        path: "/ods-in-corso/kit-dettagli",
        loader: () => ({
          kit: { guidId: "kit-1", titolo: "Kit volantino" },
          proprieta: { data: [], success: true, timestamp: new Date() },
          idKit: "kit-1",
        }),
        element: <DettagliKitOrdiniDiStampa />,
      },
    ],
    { initialEntries: ["/ods-in-corso/kit-dettagli?id=kit-1"] }
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  await screen.findByRole("heading", { name: "Kit volantino" });
};

describe("Dettagli kit dell'ordine di stampa", () => {
  beforeEach(() => {
    finti.query = { data: datiPagina([]), isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn() };
  });

  it("se i file non arrivano mostra il motivo al posto di Nessun file trovato e Riprova ricarica", async () => {
    const refetch = vi.fn();
    finti.query = {
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Servizio file non raggiungibile"),
      refetch,
    };
    await apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Impossibile caricare i file del kit");
    expect(avviso).toHaveTextContent("Servizio file non raggiungibile");
    expect(screen.queryByText("Nessun file trovato")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("i comandi con sola icona hanno un nome: paginazione e cambio vista", async () => {
    finti.query = { ...finti.query, data: datiPagina([file("f1", "volantino.pdf", "ACCETTATO")], 3) };
    await apri();

    expect(screen.getByLabelText("Pagina precedente")).toBeInTheDocument();
    expect(screen.getByLabelText("Pagina successiva")).toBeInTheDocument();

    const griglia = screen.getByRole("button", { name: "Vista griglia" });
    const elenco = screen.getByRole("button", { name: "Vista elenco" });
    expect(griglia).toHaveAttribute("aria-pressed", "true");
    expect(elenco).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(elenco);
    expect(screen.getByRole("button", { name: "Vista elenco" })).toHaveAttribute("aria-pressed", "true");
  });

  it("l'anteprima del file è un pulsante con nome e lo stato del file è leggibile", async () => {
    finti.query = {
      ...finti.query,
      data: datiPagina([file("f1", "volantino.pdf", "ACCETTATO"), file("f2", "locandina.pdf", "IN_REVISIONE")]),
    };
    await apri();

    expect(screen.getByRole("button", { name: "Anteprima volantino.pdf" })).toBeEnabled();
    // Il badge espone l'etichetta anche come title; "In revisione" è pure il nome di una statistica
    expect(screen.getByTitle("Accettato")).toBeInTheDocument();
    expect(screen.getByTitle("In revisione")).toBeInTheDocument();
    expect(screen.queryByText("IN REVISIONE")).not.toBeInTheDocument();
  });

  it("l'indietro della pagina ha un nome", async () => {
    await apri();

    expect(screen.getByRole("button", { name: "Indietro" })).toBeInTheDocument();
  });
});
