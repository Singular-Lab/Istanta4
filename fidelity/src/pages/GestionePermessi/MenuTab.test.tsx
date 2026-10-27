// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura dei Dialog
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

import MenuTab from "./MenuTab";

const voce = { id_menu_item: "m1", tipo_utente: "Superadmin", titolo: "Promozioni", tipo: "item", icona: "Tag", pathname: null, ordinamento: 0 };

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MenuTab />
    </QueryClientProvider>
  );

describe("Gestione accessi: menu", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.get).mockReset().mockImplementation(((url: string) =>
      url.startsWith("/menu/") ? Promise.resolve([voce]) : Promise.resolve([])) as any);
    vi.mocked(ServerCall.post).mockReset().mockResolvedValue({});
  });

  it("il tipo di utente si sceglie da un gruppo a scelta singola", async () => {
    apri();

    const gruppo = screen.getByRole("radiogroup", { name: "Tipo Utente" });
    expect(within(gruppo).getByRole("radio", { name: "Superadmin" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(within(gruppo).getByRole("radio", { name: "Agenzia" }));
    expect(within(gruppo).getByRole("radio", { name: "Agenzia" })).toHaveAttribute("aria-checked", "true");
    expect(ServerCall.get).toHaveBeenCalledWith("/menu/Agenzia");
  });

  it("il ripristino dei menu predefiniti chiede conferma con Annulla prima di Ripristina", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: /Ripristina menu predefiniti/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Ripristina menu predefiniti" });
    expect(within(dialogo).getAllByRole("button").map((pulsante) => pulsante.textContent)).toEqual(["Annulla", "Ripristina"]);
    expect(ServerCall.post).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Ripristina" }));
    await waitFor(() => expect(ServerCall.post).toHaveBeenCalledWith("/menu/ripristina-predefiniti", {}));
  });

  it("se il menu non arriva mostra l'errore con Riprova, non un menu vuoto", async () => {
    vi.mocked(ServerCall.get).mockReset().mockRejectedValue(new Error("Servizio non raggiungibile"));
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText("Nessuna voce di menu")).not.toBeInTheDocument();
    expect(within(avviso).getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });
});
