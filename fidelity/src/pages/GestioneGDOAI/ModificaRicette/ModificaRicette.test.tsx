// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("@/components/Base/Tippy", () => ({
  default: ({ as: Componente = "span", content: _contenuto, children, ...props }: any) => <Componente {...props}>{children}</Componente>,
}));

import ModificaRicette from ".";

const ricetta = {
  guid_id: "r1",
  titolo: "Risotto ai funghi",
  stato: "DA_REVISIONARE",
  tipo: "LUNGA",
  procedimento: "Tostare il riso",
  ingredienti: [],
  tempo_in_secondi: "1800",
  costo_in_euro: "12",
  abbinamento_vino: null,
  foto_ricetta: [{ id: "f1", url: "https://example.com/foto.jpg", main: true }],
};

const caricatore = vi.fn();

const apri = () => {
  const router = createMemoryRouter(
    [{ path: "/gestione-ricette/modifica", element: <ModificaRicette />, loader: caricatore }],
    { initialEntries: ["/gestione-ricette/modifica?id=r1"] }
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

describe("Modifica ricetta", () => {
  beforeEach(() => {
    caricatore.mockReset().mockResolvedValue({ ricetta, referenze: [] });
  });

  it("se la ricetta non arriva mostra l'errore nella pagina e Riprova la ricarica", async () => {
    caricatore.mockReset().mockResolvedValue({ ricetta: null, referenze: null });
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Ricetta non caricata");

    const chiamate = caricatore.mock.calls.length;
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    await waitFor(() => expect(caricatore.mock.calls.length).toBeGreaterThan(chiamate));
  });

  it("l'intestazione mostra la ricetta e riporta all'elenco", async () => {
    apri();

    expect(await screen.findByRole("heading", { level: 1, name: "Risotto ai funghi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna alle ricette" })).toHaveAttribute("href", "/gestione-ricette");
  });

  it("nel dialogo di generazione foto Annulla viene prima della conferma", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Rigenera foto principale" }));
    const dialogo = await screen.findByRole("dialog", { name: "Generazione foto" });
    expect(within(dialogo).getAllByRole("button").map((pulsante) => pulsante.textContent)).toEqual(["Annulla", "Genera foto"]);
  });

  it("modificando il procedimento Annulla viene prima di Salva", async () => {
    apri();

    const sezione = await screen.findByRole("region", { name: "Procedimento" });
    await userEvent.click(within(sezione).getByRole("button", { name: "Modifica" }));
    const pulsanti = within(sezione).getAllByRole("button").map((pulsante) => pulsante.textContent);
    expect(pulsanti.indexOf("Annulla")).toBeLessThan(pulsanti.indexOf("Salva"));
  });
});
