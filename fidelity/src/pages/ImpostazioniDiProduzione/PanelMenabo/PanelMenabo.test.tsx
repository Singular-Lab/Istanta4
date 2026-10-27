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
  elimina: vi.fn(),
  salva: vi.fn(),
  regole: {} as Record<string, unknown>,
  entita: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/query/query", () => ({
  useFetchRegoleMenabo: () => finti.regole,
  useFetchAreeCanaliECombinazioni: () => finti.entita,
  useSaveRegoleMenabo: () => ({ mutate: finti.salva, isPending: false }),
  useDeleteRegoleMenabo: () => ({ mutate: finti.elimina, isPending: false }),
}));

import PanelMenabo from ".";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PanelMenabo />
    </QueryClientProvider>
  );

describe("Regole del menabò", () => {
  beforeEach(() => {
    finti.elimina.mockReset();
    finti.salva.mockReset();
    finti.refetch.mockReset();
    finti.regole = { data: { tipoDivisione: "canale", divisioni: [] }, isLoading: false, isError: false, refetch: finti.refetch };
    finti.entita = {
      data: { canali: [{ id: "C1", nome: "Super" }], aree: [], combinazioni: [] },
      isLoading: false,
      isError: false,
      refetch: finti.refetch,
    };
  });

  it("Ripristina default chiede conferma prima di cancellare le regole", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Ripristina default" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Ripristinare le regole predefinite?")).toBeInTheDocument();
    expect(finti.elimina).not.toHaveBeenCalled();
  });

  it("con Annulla le regole non vengono cancellate", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Ripristina default" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annulla" }));

    expect(finti.elimina).not.toHaveBeenCalled();
  });

  it("confermando, le regole vengono cancellate", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Ripristina default" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ripristina default" }));

    expect(finti.elimina).toHaveBeenCalledTimes(1);
  });

  it("se le regole non arrivano mostra il motivo e Riprova ricarica", async () => {
    finti.regole = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch: finti.refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByRole("button", { name: "Ripristina default" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.refetch).toHaveBeenCalledTimes(1);
  });
});
