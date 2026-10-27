// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: finti }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

import GestioneSchemi from "./GestioneSchemi";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <GestioneSchemi />
    </QueryClientProvider>
  );

describe("Gestione schemi", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.delete.mockReset().mockResolvedValue(undefined);
  });

  it("l'eliminazione di uno schema chiede conferma prima di chiamare il servizio", async () => {
    finti.get.mockResolvedValue([{ id: "s1", nome: "Schema A", tipo: ["BUSINESS"], items: [], confronti: [] }]);
    apri();

    fireEvent.click(await screen.findByRole("button", { name: "Elimina lo schema Schema A" }));
    const finestra = await screen.findByRole("dialog");
    expect(finti.delete).not.toHaveBeenCalled();

    fireEvent.click(within(finestra).getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(finti.delete).toHaveBeenCalledWith("/tracciati/schemi/s1"));
  });

  it("senza schemi mostra lo stato vuoto", async () => {
    finti.get.mockResolvedValue([]);
    apri();

    expect(await screen.findByText("Nessuno schema disponibile")).toBeInTheDocument();
  });

  it("se il caricamento fallisce mostra l'errore invece dello stato vuoto", async () => {
    finti.get.mockRejectedValue(new Error("Servizio schemi non raggiungibile"));
    apri();

    expect(await screen.findByRole("alert")).toHaveTextContent("Servizio schemi non raggiungibile");
    expect(screen.queryByText("Nessuno schema disponibile")).not.toBeInTheDocument();
  });
});
