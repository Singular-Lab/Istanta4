// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { post: finti.post } }));
vi.mock("@/query/query", () => ({ useFetchConfig: () => ({ data: {} }) }));
vi.mock("../WebPliant/BoxRef", () => ({ default: () => null }));
vi.mock("@/hooks/useWebpliantParamsManager", () => ({
  useWebpliantParamsManager: () => ({ idArea: "a", idCanale: "c", idGDO: "g", idPV: undefined, idWorkspace: "w" }),
}));

import WebpliantRicerca from ".";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WebpliantRicerca />
    </QueryClientProvider>
  );

describe("WebpliantRicerca", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    finti.post.mockReset();
  });

  it("ha un campo di ricerca con nome e senza risultati mostra lo stato vuoto pubblico", async () => {
    window.history.replaceState({}, "", "/webpliant/ricerca?query=latte");
    finti.post.mockResolvedValue([]);
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Ricerca dei prodotti" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Cerca prodotti" })).toHaveValue("latte");
    expect(await screen.findByText('Nessun risultato per "latte"')).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("se la ricerca fallisce lo dice e permette di riprovare", async () => {
    window.history.replaceState({}, "", "/webpliant/ricerca?query=latte");
    finti.post.mockRejectedValue(new Error("Servizio non disponibile"));
    apri();

    const errore = await screen.findByRole("alert");
    expect(errore).toHaveTextContent("Ricerca non riuscita");
    expect(errore).toHaveTextContent("Servizio non disponibile");
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });
});
