// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn(), showNotification: vi.fn() }));

vi.mock("../../../../lib/server_call", () => ({
  ServerCall: { get: finti.get, getUrl: () => "", post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("../../../components/SessionChecker", () => ({ withSessionCheckOptimized: <T,>(Componente: T) => Componente }));
vi.mock("../../../context/PermissionContext", () => ({
  usePermissionContext: () => ({ hasPermission: () => false }),
  usePermission: () => false,
}));
vi.mock("../../../components/PermissionGate", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../../../context/UserContext", () => ({ useUser: () => ({ user: null, setUser: vi.fn() }) }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("../../../components/Lazy/LazyChart", () => ({ default: () => null }));
vi.mock("./GestioneMomenti", () => ({ default: () => null }));
vi.mock("./CollegamentiMateriali", () => ({ default: () => null }));
vi.mock("./TracciatoCard", () => ({ default: ({ tracciato }: { tracciato: { nome: string } }) => <p>Tracciato: {tracciato.nome}</p> }));

import DettagliLavorazioneInCorso from ".";

const PROMO = "11111111-2222-4333-8444-555555555555";
const TRACCIATI = `/tracciati/promo/${PROMO}?page=1&pageSize=20`;

const tracciato = (nome: string) => ({ id: nome, nome, filename: `${nome}.xlsx`, createdat: "2026-10-01T10:00:00Z", id_promo: PROMO });

const rispostaPer = async (url: string) => {
  if (url === `/promo/${PROMO}`) {
    return { id: PROMO, nome: "Promo di Natale", stato: "IN_LAVORAZIONE", data_registrazione: "2026-10-01", validita_dal: "2026-12-01", validita_al: "2026-12-31", context: [] };
  }
  if (url === TRACCIATI) return [tracciato("dal servizio")];
  if (url === "/funzionalita") return {};
  return [];
};

// Stessa forma del loader della rotta (funzioneDettagliLavorazioniInCorso)
const loader = (tracciati: Promise<unknown>) => () => ({
  lavorazioni: Promise.resolve([]),
  volantini: Promise.resolve([]),
  datiTracciatiCaricati: tracciati,
  datoGraficoPaginaLavorazioni: Promise.resolve({ datasets: [], labels: [] }),
});

const apri = (tracciatiDelLoader: Promise<unknown>) => {
  const router = createMemoryRouter(
    [{ path: "/promozioni/in-corso/dettagli/:idPromo", Component: DettagliLavorazioneInCorso, loader: loader(tracciatiDelLoader) }],
    { initialEntries: [`/promozioni/in-corso/dettagli/${PROMO}`] }
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

const chiamateA = (url: string) => finti.get.mock.calls.filter(([chiamato]) => chiamato === url).length;

describe("dettaglio della promo: richieste al caricamento", () => {
  beforeEach(() => {
    finti.get.mockReset();
    finti.get.mockImplementation(rispostaPer);
  });

  it("mostra i tracciati letti dal loader senza chiederli una seconda volta", async () => {
    apri(Promise.resolve([tracciato("dal loader")]));

    expect(await screen.findByText("Tracciato: dal loader")).toBeInTheDocument();
    expect(chiamateA(TRACCIATI)).toBe(0);
  });

  it("chiede la promo una volta sola e il contesto d'importazione insieme a lei, senza attese artificiali", async () => {
    apri(Promise.resolve([]));

    await waitFor(() => expect(chiamateA(`/promo/${PROMO}`)).toBe(1));
    // Prima c'erano 300 ms di attesa prima di questa richiesta
    expect(chiamateA(`/promo/contesto-importazione?guidId=${PROMO}`)).toBe(1);
    expect((await screen.findAllByText(/Promo di Natale/)).length).toBeGreaterThan(0);
    expect(chiamateA(`/promo/${PROMO}`)).toBe(1);
  });

  it("se i tracciati del loader non arrivano mostra l'errore e Riprova li chiede al servizio", async () => {
    const rifiutata = Promise.reject(new Error("Servizio non raggiungibile"));
    rifiutata.catch(() => undefined);

    apri(rifiutata);

    expect(await screen.findByText("Tracciati non caricati")).toBeInTheDocument();
    expect(chiamateA(TRACCIATI)).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));

    expect(await screen.findByText("Tracciato: dal servizio")).toBeInTheDocument();
    expect(chiamateA(TRACCIATI)).toBeGreaterThanOrEqual(1);
  });
});
