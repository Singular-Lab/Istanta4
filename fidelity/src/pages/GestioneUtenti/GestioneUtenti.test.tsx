// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ utenti: {} as Record<string, unknown>, refetch: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@tippyjs/react", () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock("../../context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("../../context/UserContext", () => ({ useUser: () => ({ user: { id: "admin", tipo: "Superadmin" } }) }));
vi.mock("@/query/query", () => ({
  useFetchPuntiVenditaFromIdGDO: () => ({ data: { data: [] } }),
  useFetchAllRuoliGDO: () => ({ data: [] }),
  useFetchAllGDO: () => ({ data: [] }),
  useFetchAllUtentiPaginated: () => finti.utenti,
}));

import GestioneUtenti from ".";

const utente = {
  id: "u1",
  nome: "Anna",
  cognome: "Rossi",
  nome_completo: "Anna Rossi",
  email: "anna.rossi@example.com",
  stato: "DISATTIVO",
  tipo: "Agenzia",
  createdat: "2026-10-01T10:00:00Z",
  canali_interazione: [],
  ruolo_gdo: null,
  punto_vendita_collegato: null,
};

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GestioneUtenti />
    </QueryClientProvider>
  );

describe("Gestione utenti", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    finti.refetch.mockReset();
    vi.mocked(ServerCall.delete).mockReset().mockResolvedValue(undefined);
    vi.mocked(ServerCall.post).mockReset();
    finti.utenti = {
      data: { utenti: [utente], total: 1, total_pages: 1 },
      isLoading: false,
      isError: false,
      refetch: finti.refetch,
    };
  });

  it("lo stato dell'utente usa il catalogo: Disattivo è neutro, non un errore", () => {
    apri();

    // Tabella e schede mobile sono entrambe nel DOM
    const badge = screen.getAllByTitle("Disattivo");
    expect(badge.length).toBeGreaterThan(0);
    for (const b of badge) {
      expect(b).toHaveAttribute("data-tono", "neutral");
    }
  });

  it("il menu delle azioni ha un nome accessibile", () => {
    apri();

    expect(screen.getAllByRole("button", { name: "Azioni utente Anna Rossi" }).length).toBeGreaterThan(0);
  });

  it("se l'elenco non arriva mostra l'errore e Riprova ricarica", async () => {
    finti.utenti = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch: finti.refetch };
    apri();

    const avvisi = screen.getAllByRole("alert");
    expect(avvisi[0]).toHaveTextContent("Utenti non caricati");
    await userEvent.click(screen.getAllByRole("button", { name: "Riprova" })[0]);
    expect(finti.refetch).toHaveBeenCalledTimes(1);
  });

  it("lo stato vuoto della tabella occupa tutte le colonne dell'intestazione", () => {
    finti.utenti = { data: { utenti: [], total: 0, total_pages: 1 }, isLoading: false, isError: false, refetch: finti.refetch };
    apri();

    const cella = screen.getAllByText("Nessun utente trovato").map((testo) => testo.closest("td")).find(Boolean);
    const colonne = cella?.closest("table")?.querySelectorAll("thead th").length;
    expect(colonne).toBe(9);
    expect(cella).toHaveAttribute("colspan", String(colonne));
  });

  it("anche l'errore nella tabella occupa tutte le colonne", () => {
    finti.utenti = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch: finti.refetch };
    apri();

    const cella = screen.getAllByRole("alert").map((avviso) => avviso.closest("td")).find(Boolean);
    expect(cella).toHaveAttribute("colspan", "9");
  });

  it("con un filtro attivo e nessun risultato propone di azzerare i filtri", async () => {
    finti.utenti = { data: { utenti: [], total: 0, total_pages: 1 }, isLoading: false, isError: false, refetch: finti.refetch };
    apri();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Stato" }), "ATTIVO");
    expect(screen.getAllByText("Nessun risultato").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nessun utente trovato")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Azzera filtri" })[0]);
    expect(screen.getByRole("combobox", { name: "Stato" })).toHaveValue("");
  });

  it("le azioni di riga stanno in un menu: Elimina chiede conferma prima di eliminare", async () => {
    apri();

    await userEvent.click(screen.getAllByRole("button", { name: "Azioni utente Anna Rossi" })[0]);
    expect(await screen.findByRole("menuitem", { name: "Modifica" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Elimina" }));

    const dialogo = await screen.findByRole("dialog", { name: "Elimina utente" });
    expect(within(dialogo).getByText("Anna Rossi")).toBeInTheDocument();
    expect(ServerCall.delete).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(ServerCall.delete).toHaveBeenCalledWith("/deleteUser?id=u1"));
  });

  it("la paginazione mostra l'intervallo di righe e il totale", () => {
    finti.utenti = { data: { utenti: [utente], total: 25, total_pages: 3 }, isLoading: false, isError: false, refetch: finti.refetch };
    apri();

    expect(screen.getByText("Mostrati 1–10 di 25")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginazione" })).toBeInTheDocument();
  });

  it("il limite di richieste non mostra un'attesa inventata", async () => {
    vi.mocked(ServerCall.post).mockRejectedValue({ error: "REGISTRATION_RATE_LIMIT_EXCEEDED" });
    apri();

    await userEvent.click(screen.getByRole("button", { name: /Aggiungi un nuovo utente/ }));
    const creazione = await screen.findByRole("dialog", { name: "Crea nuovo utente" });
    await userEvent.type(within(creazione).getByLabelText(/^Nome/), "Anna");
    await userEvent.type(within(creazione).getByLabelText(/^Cognome/), "Rossi");
    await userEvent.type(within(creazione).getByLabelText(/^Email/), "anna.rossi@example.com");
    await userEvent.type(within(creazione).getByLabelText(/^Password/), "Segreta1!");
    fireEvent.change(within(creazione).getByLabelText(/^Data di Nascita/), { target: { value: "1990-01-01" } });
    await userEvent.type(within(creazione).getByLabelText(/^Residenza/), "Roma");
    await userEvent.selectOptions(within(creazione).getByLabelText(/^Tipo Utente/), "Superadmin");
    await userEvent.type(within(creazione).getByLabelText(/^Telefono/), "3331234567");
    await userEvent.click(within(creazione).getByRole("button", { name: "Crea" }));

    const avviso = await screen.findByRole("dialog", { name: "Limite di richieste superato" });
    expect(avviso).toHaveTextContent("Attendi qualche minuto prima di riprovare");
    expect(avviso).not.toHaveTextContent("00:00:36");
    expect(avviso).not.toHaveTextContent("Riprova tra");
    expect(within(avviso).getAllByRole("button").map((pulsante) => pulsante.textContent)).toEqual(["Ho capito"]);
  });
});
