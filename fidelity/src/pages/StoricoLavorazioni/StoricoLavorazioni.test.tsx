// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({
  query: { data: [] as unknown[], isLoading: false, isError: false, error: null as Error | null, refetch: vi.fn() },
  superadmin: false,
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/query/query", () => ({ useFetchStoricoLavorazioni: () => finti.query }));
vi.mock("@/context/PermissionContext", () => ({ usePermissionContext: () => ({ superadmin: finti.superadmin }) }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { delete: vi.fn() } }));

import { ServerCall } from "../../../lib/server_call";
import StoricoLavorazioni from ".";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const promo = (id: string, nome: string, stato: string) => ({
  id: `${id}-0000-0000`,
  nome,
  stato,
  data_scadenza: "2026-09-01",
  validita_dal: "2026-09-05",
  validita_al: "2026-09-20",
  offset_visibilita: 3,
  is_deletable: false,
  numero_kit_collegati: 0,
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StoricoLavorazioni />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Storico promozioni", () => {
  beforeEach(() => {
    finti.query = { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() };
    finti.superadmin = false;
    vi.mocked(ServerCall.delete).mockReset();
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
    // 11 promo con 10 righe per pagina: due pagine
    finti.query.data = Array.from({ length: 11 }, (_, i) => promo(`f${i}`, `Promo pagina ${i}`, "ARCHIVIATA"));
    apri();

    for (const nome of ["Prima pagina", "Pagina precedente", "Pagina successiva", "Ultima pagina"]) {
      expect(screen.getByLabelText(nome)).toBeInTheDocument();
    }
    expect(screen.getByText("Mostrati 1–10 di 11")).toBeInTheDocument();
  });

  it("senza risultati per la ricerca lo dice e permette di azzerarla", () => {
    finti.query.data = [promo("g", "Volantino estate", "ARCHIVIATA")];
    apri();

    fireEvent.change(screen.getByRole("searchbox", { name: "Cerca nello storico" }), { target: { value: "inverno" } });
    expect(screen.getByText("Nessun risultato")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Azzera ricerca" }));
    expect(screen.getAllByText("Volantino estate").length).toBeGreaterThan(0);
  });

  it("se il caricamento fallisce mostra il motivo e Riprova ricarica", () => {
    const refetch = vi.fn();
    finti.query = { data: [], isLoading: false, isError: true, error: new Error("Servizio promo non raggiungibile"), refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio promo non raggiungibile");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("il Superadmin elimina una promo archiviata dopo la conferma, in modo non definitivo", async () => {
    finti.superadmin = true;
    vi.mocked(ServerCall.delete).mockResolvedValue(true);
    finti.query.data = [promo("h", "Promo archiviata", "ARCHIVIATA")];
    apri();

    fireEvent.click(screen.getByRole("button", { name: "Elimina Promo archiviata" }));
    const finestra = await screen.findByRole("dialog");
    expect(within(finestra).getByText("Elimina lavorazione")).toBeInTheDocument();
    expect(ServerCall.delete).not.toHaveBeenCalled();

    fireEvent.click(within(finestra).getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(ServerCall.delete).toHaveBeenCalledWith("/promo/h-0000-0000/stato/ARCHIVIATA"));
    await waitFor(() => expect(finti.query.refetch).toHaveBeenCalled());
  });

  it("chi non è Superadmin non trova il comando di eliminazione", () => {
    finti.query.data = [promo("i", "Promo archiviata", "ARCHIVIATA")];
    apri();

    expect(screen.queryByRole("button", { name: "Elimina Promo archiviata" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina" })).not.toBeInTheDocument();
  });
});
