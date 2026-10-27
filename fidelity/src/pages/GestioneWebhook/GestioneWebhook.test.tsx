// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({
  ServerCall: { get: finti.get, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));

import GestioneWebhook from ".";

const webhook = {
  id_webhook: "w1",
  nome_webhook: "Ordini",
  descrizione_webhook: "Notifica gli ordini",
  url_webhook: "https://example.com/hook",
  eventi_webhook: ["PROMO_CREATA"],
  stato_webhook: "SOSPESO",
  timeout_webhook: 30,
  retry_count_webhook: 3,
  updatedat_webhook: "2026-10-01T10:00:00Z",
};

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <GestioneWebhook />
    </QueryClientProvider>
  );

describe("Gestione webhook", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    finti.get.mockReset().mockResolvedValue({ success: true, data: [webhook], count: 1 });
  });

  it("uno stato SOSPESO si legge Sospeso, con il tono di avviso", async () => {
    apri();

    const badge = await screen.findByTitle("Sospeso");
    expect(badge).toHaveAttribute("data-tono", "warning");
  });

  it("le azioni della riga stanno in un menu con un nome accessibile", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Azioni webhook Ordini" }));
    expect(await screen.findByRole("menuitem", { name: "Test webhook" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Statistiche" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Modifica" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Elimina" })).toBeInTheDocument();
  });

  it("il conteggio dei risultati usa il singolare con un solo webhook", async () => {
    apri();

    expect(await screen.findByText("1 webhook trovato")).toBeInTheDocument();
  });

  it("il conteggio dei risultati usa il plurale con più webhook", async () => {
    finti.get.mockReset().mockResolvedValue({
      success: true,
      data: [webhook, { ...webhook, id_webhook: "w2", nome_webhook: "Promo", descrizione_webhook: "Notifica le promo" }],
      count: 2,
    });
    apri();

    expect(await screen.findByText("2 webhook trovati")).toBeInTheDocument();
  });

  it("se l'elenco non arriva mostra l'errore con Riprova", async () => {
    finti.get.mockReset().mockRejectedValue(new Error("Servizio non raggiungibile"));
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(within(avviso).getByRole("button", { name: "Riprova" })).toBeInTheDocument();
  });

  it("l'errore di un campo obbligatorio è collegato al campo", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Nuovo Webhook" }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crea Webhook" }));
    await within(dialogo).findByText("Nome richiesto");

    const nome = within(dialogo).getByRole("textbox", { name: "Nome (obbligatorio)" });
    expect(nome).toHaveAttribute("aria-invalid", "true");
    expect(nome).toHaveAccessibleDescription("Nome richiesto");
    expect(within(dialogo).getByRole("checkbox", { name: "PROMO CREATA" })).toHaveAttribute("id", "evento-PROMO_CREATA");
  });

  it("nel dialogo di creazione Annulla e Crea Webhook stanno nel piè del dialogo, in quest'ordine", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Nuovo Webhook" }));
    const dialogo = await screen.findByRole("dialog");
    const annulla = within(dialogo).getByRole("button", { name: "Annulla" });
    const crea = within(dialogo).getByRole("button", { name: "Crea Webhook" });

    // Stesso contenitore (il piè), Annulla prima della conferma
    expect(annulla.parentElement).toBe(crea.parentElement);
    expect(annulla.compareDocumentPosition(crea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
