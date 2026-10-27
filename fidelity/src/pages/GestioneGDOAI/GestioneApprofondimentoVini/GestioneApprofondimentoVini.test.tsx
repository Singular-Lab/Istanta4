// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../../lib/server_call";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

import GestioneApprofondimentoVini from ".";

const vino = {
  dataFields: { codice_referenza: "C1", descrizione_uno: "Chianti", descrizione_due: "Cantina Rossi", descrizione_tre: "2022" },
  foto: [],
  createdAt: "2026-10-01T10:00:00Z",
  approfondimento: { colore: "Rosso rubino" },
};

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <GestioneApprofondimentoVini />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Gestione approfondimenti vini", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.put).mockReset().mockResolvedValue([vino]);
    vi.mocked(ServerCall.delete).mockReset().mockResolvedValue(undefined);
  });

  it("se l'elenco non arriva mostra l'errore, non lo stato vuoto, e Riprova ricarica", async () => {
    vi.mocked(ServerCall.put).mockReset().mockRejectedValue(new Error("Servizio non raggiungibile"));
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText("Nessun vino trovato")).not.toBeInTheDocument();
    expect(avviso.closest("td")).toHaveAttribute("colspan", "7");

    const chiamate = vi.mocked(ServerCall.put).mock.calls.length;
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    expect(vi.mocked(ServerCall.put).mock.calls.length).toBeGreaterThan(chiamate);
  });

  it("senza vini lo stato vuoto occupa tutte le colonne dell'intestazione", async () => {
    vi.mocked(ServerCall.put).mockReset().mockResolvedValue([]);
    apri();

    const cella = (await screen.findByText("Nessun vino trovato")).closest("td");
    const colonne = cella?.closest("table")?.querySelectorAll("thead th").length;
    expect(colonne).toBe(7);
    expect(cella).toHaveAttribute("colspan", String(colonne));
  });

  it("tipo e approfondimento sono badge di stato leggibili", async () => {
    apri();

    expect(await screen.findByTitle("Rosso")).toHaveAttribute("data-tono", "danger");
    expect(screen.getByTitle("Completato")).toHaveAttribute("data-tono", "success");
  });

  it("l'azione della riga porta alla modifica dell'approfondimento", async () => {
    apri();

    expect(await screen.findByRole("button", { name: "Modifica approfondimento Chianti" })).toBeInTheDocument();
  });

  it("l'eliminazione massiva chiede conferma e chiama il servizio solo dopo Elimina", async () => {
    apri();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Seleziona Chianti" }));
    await userEvent.click(screen.getByRole("button", { name: "Elimina 1" }));
    const dialogo = await screen.findByRole("dialog", { name: "Conferma eliminazione" });
    expect(ServerCall.delete).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(ServerCall.delete).toHaveBeenCalledWith("/delete_approfondimento_vino/C1"));
  });
});
