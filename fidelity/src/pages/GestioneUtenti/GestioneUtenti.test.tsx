// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
