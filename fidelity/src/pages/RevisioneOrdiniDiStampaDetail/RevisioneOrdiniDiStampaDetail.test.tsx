// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATO_ORDINI_STAMPA } from "../../../lib/enums";

vi.mock("socket.io-client", () => ({
  default: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
// Nessuna chiamata deve partire senza l'id dell'ordine nell'indirizzo: le richieste restano in sospeso
vi.mock("../../../lib/server_call", () => ({
  ServerCall: {
    get: vi.fn(() => new Promise(() => {})),
    post: vi.fn(() => new Promise(() => {})),
    put: vi.fn(() => new Promise(() => {})),
  },
}));

import RevisioneOrdiniDiStampa from ".";

const apri = async (stato: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/ods-in-corso/revisione",
        loader: () => ({
          dettagli: [],
          ordine: { id_ordinistampa: "o1", stato_ordinistampa: stato },
          promo: { id: "p1", nome: "Volantino ottobre" },
          ordiniInvii: [],
        }),
        element: <RevisioneOrdiniDiStampa />,
      },
    ],
    { initialEntries: ["/ods-in-corso/revisione"] }
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  await screen.findByRole("heading", { level: 1 });
};

describe("Revisione ordine di stampa", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_WS_URL", "http://localhost/api");
  });

  it("senza kit mostra lo stato vuoto dentro la sezione dei kit, con la ricerca", async () => {
    await apri(STATO_ORDINI_STAMPA.IN_REVISIONE);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Revisione ordine di stampa");
    expect(screen.getByRole("link", { name: /Torna agli ordini/ })).toHaveAttribute("href", "/ods-in-corso");

    const sezione = screen.getByRole("region", { name: "Kit dell'ordine" });
    expect(within(sezione).getByRole("searchbox", { name: "Cerca per titolo, area, canale" })).toBeInTheDocument();
    expect(within(sezione).getByRole("heading", { name: "Nessun kit da revisionare" })).toBeInTheDocument();
    // Senza kit disponibili non c'è niente da inviare
    expect(screen.queryByRole("button", { name: /Manda file alla tipografia/ })).not.toBeInTheDocument();
  });

  it("un ordine completato si apre in sola lettura con gli invii e la loro ricerca", async () => {
    await apri(STATO_ORDINI_STAMPA.FINITO);

    expect(await screen.findByRole("heading", { level: 1, name: "Dettaglio ordine completato" })).toBeInTheDocument();

    const invii = screen.getByRole("region", { name: "Invii effettuati (0)" });
    expect(within(invii).getByRole("searchbox", { name: "Cerca nei kit inviati" })).toBeInTheDocument();
    expect(within(invii).getByRole("heading", { name: "Nessun invio trovato" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Kit dell'ordine" })).not.toBeInTheDocument();
  });
});
