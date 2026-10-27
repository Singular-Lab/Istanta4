// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Popover
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/query/query", () => ({ useFetchAreeCanaliECombinazioni: () => finti.query }));

import AreeCanali from ".";

const dati = {
  aree: [{ id: "a1", nome: "Nord", codice: "N" }],
  canali: [{ id: "c1", nome: "Super", codice: "S" }],
  combinazioni: [{ id: "x1", sigla: "N-S", stato: "ATTIVO" }],
};

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AreeCanali />
    </QueryClientProvider>
  );

describe("Aree e canali", () => {
  beforeEach(() => {
    finti.refetch.mockReset();
    finti.query = { data: dati, isLoading: false, isError: false, refetch: finti.refetch };
  });

  it("nel dialogo della combinazione l'etichetta Stato indica la sua select, con id unici", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await userEvent.click(await screen.findByRole("button", { name: "Crea Combinazione" }));
    const dialogo = await screen.findByRole("dialog");

    const stato = within(dialogo).getByLabelText("Stato");
    expect(stato.tagName).toBe("SELECT");
    expect(within(stato).getByRole("option", { name: "Disattivo" })).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Area").tagName).toBe("SELECT");
    expect(within(dialogo).getByLabelText("Canale").tagName).toBe("SELECT");

    const id = Array.from(document.body.querySelectorAll("[id]")).map((elemento) => elemento.id);
    expect(new Set(id).size).toBe(id.length);
  });

  it("lo stato della combinazione è un badge leggibile e le azioni hanno un nome", () => {
    apri();

    expect(screen.getByTitle("Attivo")).toHaveAttribute("data-tono", "success");
    expect(screen.getByRole("button", { name: "Modifica area Nord" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina combinazione N-S" })).toBeInTheDocument();
  });

  it("se il caricamento fallisce mostra l'errore e Riprova ricarica", async () => {
    finti.query = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch: finti.refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.refetch).toHaveBeenCalledTimes(1);
  });
});
