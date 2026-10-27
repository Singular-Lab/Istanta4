// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("i pulsanti con sola icona hanno un nome accessibile", async () => {
    apri();

    expect(await screen.findByRole("button", { name: "Test Webhook Ordini" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Statistiche Ordini" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifica Ordini" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina Ordini" })).toBeInTheDocument();
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
});
