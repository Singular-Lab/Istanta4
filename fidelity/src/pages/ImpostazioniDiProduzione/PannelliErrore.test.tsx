// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  funzionalita: {} as Record<string, unknown>,
  tipiExport: {} as Record<string, unknown>,
  formati: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/context/PermissionContext", () => ({ usePermissionContext: () => ({ hasPermission: () => true }) }));
vi.mock("@/query/query", () => ({
  useFetchFunzionalita: () => finti.funzionalita,
  useSaveFunzionalita: () => ({ mutate: vi.fn(), isPending: false }),
  useFetchTipiExport: () => finti.tipiExport,
  useFetchFormati: () => finti.formati,
}));

import PanelFormati from "./PanelFormati";
import PanelFunzionalita from "./PanelFunzionalita";
import PanelTipiExport from "./PanelTipiExport";

const errore = () => ({ data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch: finti.refetch });

const conQuery = (figlio: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{figlio}</QueryClientProvider>);

describe("Impostazioni di produzione: pannelli non caricati", () => {
  beforeEach(() => {
    finti.refetch.mockReset();
    finti.funzionalita = errore();
    finti.tipiExport = errore();
    finti.formati = errore();
  });

  it.each([
    ["funzionalità", () => conQuery(<PanelFunzionalita />)],
    ["tipi di export", () => conQuery(<PanelTipiExport />)],
    ["formati", () => conQuery(<PanelFormati />)],
  ])("il pannello %s mostra il motivo e Riprova ricarica", async (_nome, apri) => {
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.refetch).toHaveBeenCalledTimes(1);
  });

  it("mentre carica le funzionalità mostra lo spinner, non il pannello", () => {
    finti.funzionalita = { data: undefined, isLoading: true, isError: false, refetch: finti.refetch };
    conQuery(<PanelFunzionalita />);

    expect(screen.getByRole("status")).toHaveTextContent("Caricamento funzionalità…");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
