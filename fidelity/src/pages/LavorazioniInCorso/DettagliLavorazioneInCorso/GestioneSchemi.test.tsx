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
const permessi = vi.hoisted(() => ({ concessi: new Set<string>(["promo.gestisci_schemi"]) }));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: finti }));
vi.mock("@/context/PermissionContext", () => ({
  usePermissionContext: () => ({ hasPermission: (codice: string) => permessi.concessi.has(codice), loading: false }),
}));
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
    permessi.concessi = new Set(["promo.gestisci_schemi"]);
  });

  it("senza promo.gestisci_schemi i comandi per creare ed eliminare gli schemi sono disattivati", async () => {
    permessi.concessi = new Set();
    finti.get.mockResolvedValue([{ id: "s1", nome: "Schema A", tipo: ["BUSINESS"], items: [], confronti: [] }]);
    apri();

    const elimina = await screen.findByRole("button", { name: "Elimina lo schema Schema A" });
    expect(elimina.closest("[aria-disabled='true']")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Nuovo schema/ }).closest("[aria-disabled='true']")).not.toBeNull();
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
