// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  query: { data: [] as unknown[], isLoading: false, isError: false, error: null as Error | null, refetch: vi.fn() },
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/query/query", () => ({ useFetchStoricoLavorazioni: () => finti.query }));

import StoricoLavorazioni from ".";

const promo = (id: string, nome: string, stato: string) => ({
  id: `${id}-0000-0000`,
  nome,
  stato,
  data_scadenza: "2026-09-01",
  validita_dal: "2026-09-05",
  validita_al: "2026-09-20",
  offset_visibilita: 3,
});

const apri = () =>
  render(
    <MemoryRouter>
      <StoricoLavorazioni />
    </MemoryRouter>
  );

describe("Storico promozioni", () => {
  beforeEach(() => {
    finti.query = { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() };
  });

  it("una promo VALIDA si legge Valida, non In validità", () => {
    finti.query.data = [promo("a", "Volantino settembre", "VALIDA")];
    apri();

    const riga = screen.getAllByRole("row").find((r) => within(r).queryByText("Volantino settembre"))!;
    expect(within(riga).getByText("Valida")).toBeInTheDocument();
    expect(screen.queryByText("In validità")).not.toBeInTheDocument();
    expect(screen.queryByText("Attiva")).not.toBeInTheDocument();
  });

  it("uno stato che il catalogo non conosce si legge Stato sconosciuto", () => {
    finti.query.data = [promo("b", "Promo misteriosa", "STATO_NUOVO")];
    apri();

    expect(screen.getAllByText("Stato sconosciuto").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sconosciuta")).not.toBeInTheDocument();
  });

  it("le date sono nel formato DD/MM/YYYY", () => {
    finti.query.data = [promo("c", "Promo date", "ARCHIVIATA")];
    apri();

    expect(screen.getAllByText("01/09/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20/09/2026").length).toBeGreaterThan(0);
  });

  it("l'intestazione ordinabile è un pulsante e il th espone aria-sort", () => {
    finti.query.data = [promo("d", "Promo uno", "ARCHIVIATA"), promo("e", "Promo due", "VALIDA")];
    apri();

    const stato = screen.getByRole("button", { name: /^Stato$/ });
    expect(stato.closest("th")).not.toHaveAttribute("aria-sort");

    fireEvent.click(stato);
    fireEvent.click(screen.getByRole("button", { name: /^Stato$/ }));
    expect(screen.getByRole("button", { name: /^Stato$/ }).closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  it("i comandi di paginazione con sola icona hanno un nome", () => {
    finti.query.data = [promo("f", "Promo pagina", "ARCHIVIATA")];
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
