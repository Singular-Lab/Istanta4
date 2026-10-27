// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  query: { data: [] as unknown[], isLoading: false, isError: false, error: null as Error | null, refetch: vi.fn() },
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/query/query", () => ({ useFetchLavorazioniInCorso: () => finti.query }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { delete: vi.fn() } }));

import LavorazioniInCorso from ".";

const promo = (id: string, nome: string, stato: string) => ({
  id: `${id}-0000-0000`,
  nome,
  stato,
  data_scadenza: "2026-10-01",
  validita_dal: "2026-10-05",
  validita_al: "2026-10-20",
  offset_visibilita: 3,
  is_deletable: false,
  numero_kit_collegati: 0,
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LavorazioniInCorso />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Promozioni in corso", () => {
  beforeEach(() => {
    finti.query = { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });

  it("una promo VALIDA si legge Valida, mai Attiva né In lavorazione", () => {
    finti.query.data = [promo("a", "Volantino ottobre", "VALIDA")];
    apri();

    const riga = screen.getAllByRole("row").find((r) => within(r).queryByText("Volantino ottobre"))!;
    expect(within(riga).getByText("Valida")).toBeInTheDocument();
    expect(screen.queryByText("Attiva")).not.toBeInTheDocument();
    expect(screen.queryByText("In lavorazione")).not.toBeInTheDocument();
  });

  it("uno stato che il catalogo non conosce si legge Stato sconosciuto", () => {
    finti.query.data = [promo("b", "Promo misteriosa", "STATO_NUOVO")];
    apri();

    expect(screen.getAllByText("Stato sconosciuto").length).toBeGreaterThan(0);
    expect(screen.queryByText("In lavorazione")).not.toBeInTheDocument();
  });

  it("le date sono nel formato DD/MM/YYYY", () => {
    finti.query.data = [promo("c", "Promo date", "PIANIFICATA")];
    apri();

    expect(screen.getAllByText("01/10/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20/10/2026").length).toBeGreaterThan(0);
  });

  it("l'intestazione ordinabile è un pulsante e il th espone aria-sort", () => {
    finti.query.data = [promo("d", "Promo uno", "PIANIFICATA"), promo("e", "Promo due", "VALIDA")];
    apri();

    const nome = screen.getByRole("button", { name: /Nome Lavorazione/ });
    expect(nome.closest("th")).not.toHaveAttribute("aria-sort");
    expect(screen.getByRole("button", { name: /Scadenza/ }).closest("th")).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(nome);
    expect(screen.getByRole("button", { name: /Nome Lavorazione/ }).closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("i comandi di paginazione con sola icona hanno un nome", () => {
    finti.query.data = [promo("f", "Promo pagina", "PIANIFICATA")];
    apri();

    for (const nome of ["Prima pagina", "Pagina precedente", "Pagina successiva", "Ultima pagina"]) {
      expect(screen.getByLabelText(nome)).toBeInTheDocument();
    }
  });

  it("se il caricamento fallisce mostra il motivo e Riprova ricarica", () => {
    const refetch = vi.fn();
    finti.query = { data: [], isLoading: false, isError: true, error: new Error("Servizio promo non raggiungibile"), refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio promo non raggiungibile");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
