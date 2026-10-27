// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  opzioni: {} as Record<string, unknown>,
  calcolo: {} as Record<string, unknown>,
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/query/query", () => ({
  useFetchReportOptions: () => finti.opzioni,
  useCalcolaQueryDaOpzione: () => finti.calcolo,
}));

import ReportTracciati from ".";

const opzione = (id: string, titolo: string) => ({ id, titolo, descrizione: `Descrizione ${titolo}`, icona: null, plugins: [] });

const apri = () =>
  render(
    <MemoryRouter>
      <ReportTracciati />
    </MemoryRouter>
  );

describe("Report tracciati", () => {
  beforeEach(() => {
    finti.opzioni = { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() };
    finti.calcolo = { mutate: vi.fn(), isPending: false, isError: false };
  });

  it("se le opzioni non arrivano mostra il motivo e Riprova ricarica", () => {
    const refetch = vi.fn();
    finti.opzioni = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio report non raggiungibile"), refetch };
    apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Impossibile caricare le opzioni");
    expect(avviso).toHaveTextContent("Servizio report non raggiungibile");

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("l'opzione scelta risulta premuta e Esegui analisi la calcola", () => {
    const mutate = vi.fn();
    finti.opzioni = { ...finti.opzioni, data: [opzione("o1", "Variazioni prezzi"), opzione("o2", "Copertura referenze")] };
    finti.calcolo = { ...finti.calcolo, mutate };
    apri();

    const prezzi = screen.getByRole("button", { name: /Variazioni prezzi/ });
    expect(prezzi).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Esegui analisi" })).toBeDisabled();

    fireEvent.click(prezzi);

    expect(screen.getByRole("button", { name: /Variazioni prezzi/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Copertura referenze/ })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Esegui analisi" }));
    expect(mutate).toHaveBeenCalledWith("o1", expect.any(Object));
  });

  it("durante il calcolo Esegui analisi mantiene l'etichetta ed è occupato", () => {
    finti.opzioni = { ...finti.opzioni, data: [opzione("o1", "Variazioni prezzi")] };
    finti.calcolo = { ...finti.calcolo, isPending: true };
    apri();

    const esegui = screen.getByRole("button", { name: "Esegui analisi" });
    expect(esegui).toBeDisabled();
    expect(esegui).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Calcolo in corso…")).not.toBeInTheDocument();
  });
});
