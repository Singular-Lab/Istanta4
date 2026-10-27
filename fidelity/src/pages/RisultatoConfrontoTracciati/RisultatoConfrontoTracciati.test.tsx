// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: finti.get } }));

import RisultatoConfrontoTracciati from ".";

const PERCORSO_CONFRONTO = "/promozioni/in-corso/dettagli/p1/report/c1";

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[PERCORSO_CONFRONTO]}>
        <Routes>
          <Route path="/promozioni/in-corso/dettagli/:idPromo/report/:guidIdConfronto" element={<RisultatoConfrontoTracciati />} />
          <Route path="/promozioni/in-corso/dettagli/:idPromo" element={<p>Dettaglio della promo</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Risultato del confronto tracciati", () => {
  beforeEach(() => {
    finti.get.mockReset();
  });

  it("se il confronto non arriva mostra il motivo invece di tornare alla promo", async () => {
    finti.get.mockImplementation((url: string) =>
      url.startsWith("/tracciati/momenti/confronti/")
        ? Promise.reject(new Error("Servizio confronti non raggiungibile"))
        : Promise.resolve({ nomePromo: "Volantino ottobre" })
    );
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Impossibile caricare il confronto");
    expect(avviso).toHaveTextContent("Servizio confronti non raggiungibile");
    expect(screen.queryByText("Dettaglio della promo")).not.toBeInTheDocument();
  });

  it("Riprova richiede di nuovo il confronto", async () => {
    finti.get.mockImplementation((url: string) =>
      url.startsWith("/tracciati/momenti/confronti/")
        ? Promise.reject(new Error("Servizio confronti non raggiungibile"))
        : Promise.resolve({ nomePromo: "Volantino ottobre" })
    );
    apri();

    await screen.findByRole("alert");
    const richiesteConfronto = () =>
      finti.get.mock.calls.filter(([url]) => String(url).startsWith("/tracciati/momenti/confronti/c1")).length;
    expect(richiesteConfronto()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    await waitFor(() => expect(richiesteConfronto()).toBe(2));
  });
});
