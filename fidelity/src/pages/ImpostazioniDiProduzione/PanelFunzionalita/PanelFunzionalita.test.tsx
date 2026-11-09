// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Vendite e previsioni fra le funzionalita' da attivare per GDO (spec funzionalita-per-installazione)

const finti = vi.hoisted(() => ({
  funzionalita: {} as Record<string, unknown>,
  salva: vi.fn(),
  puoModificare: true,
}));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/context/PermissionContext", () => ({ usePermissionContext: () => ({ hasPermission: () => finti.puoModificare }) }));
vi.mock("@/query/query", () => ({
  useFetchFunzionalita: () => finti.funzionalita,
  useSaveFunzionalita: () => ({ mutate: finti.salva, isPending: false }),
}));

import PanelFunzionalita from ".";

const caricate = (data: Record<string, unknown>) => ({ data, isLoading: false, isError: false, error: null, refetch: vi.fn() });

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PanelFunzionalita />
    </QueryClientProvider>
  );

describe("Funzionalità della GDO: vendite e previsioni", () => {
  beforeEach(() => {
    finti.salva.mockReset();
    finti.puoModificare = true;
  });

  it("una configurazione salvata prima, senza il campo, mostra vendite e previsioni spente", () => {
    finti.funzionalita = caricate({ momenti: true, menabo: false });
    apri();

    expect(screen.getByRole("checkbox", { name: "Gestione momenti" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Vendite e previsioni" })).not.toBeChecked();
    expect(screen.getByText(/rendimento dei box dalle vendite, la mappa di calore prevista, la previsione e la simulazione/)).toBeInTheDocument();
  });

  it("attivandole salva anche le altre funzioni com'erano", async () => {
    finti.funzionalita = caricate({ momenti: true, menabo: false, vendite: false });
    apri();

    await userEvent.click(screen.getByRole("checkbox", { name: "Vendite e previsioni" }));
    await userEvent.click(screen.getByRole("button", { name: "Salva" }));

    expect(finti.salva).toHaveBeenCalledWith({ momenti: true, menabo: false, vendite: true }, expect.anything());
  });

  it("senza il permesso di modificare le impostazioni l'interruttore non si usa", () => {
    finti.puoModificare = false;
    finti.funzionalita = caricate({ momenti: false, menabo: false, vendite: true });
    apri();

    const interruttore = screen.getByRole("checkbox", { name: "Vendite e previsioni" });
    expect(interruttore).toBeChecked();
    expect(interruttore).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salva" })).not.toBeInTheDocument();
  });
});
