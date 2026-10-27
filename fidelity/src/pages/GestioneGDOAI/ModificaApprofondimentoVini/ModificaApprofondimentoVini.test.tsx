// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../../lib/server_call";

const finti = vi.hoisted(() => ({ showNotification: vi.fn() }));

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));

import ModificaApprofondimentoVini from ".";

const referenza = {
  dataFields: { codice_referenza: "C1", descrizione_uno: "Chianti", descrizione_due: "Cantina Rossi", descrizione_tre: "Classico" },
  foto: [],
};

const approfondimento = { id: 1, codice: "C1", anno: 2022, nome: "Chianti Classico", cantina: "Cantina Rossi", colore: "Rosso rubino" };

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/gestione-approfondimento-vini/modifica?codice=C1"]}>
        <ModificaApprofondimentoVini />
      </MemoryRouter>
    </QueryClientProvider>
  );

const rispondi = (approfondimentoRisposta: () => Promise<unknown>) =>
  vi.mocked(ServerCall.get).mockImplementation((url: string) =>
    url.startsWith("/get_approfondimento_vino") ? approfondimentoRisposta() : Promise.resolve(referenza)
  ) as any;

describe("Modifica approfondimento vino", () => {
  beforeEach(() => {
    finti.showNotification.mockReset();
    vi.mocked(ServerCall.get).mockReset();
  });

  it("se l'approfondimento non arriva mostra l'errore nella pagina e Riprova ricarica", async () => {
    rispondi(() => Promise.reject(new Error("Servizio non raggiungibile")));
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    // Il form non viene mostrato come se il vino fosse nuovo
    expect(screen.queryByRole("button", { name: /Genera/ })).not.toBeInTheDocument();

    const chiamate = vi.mocked(ServerCall.get).mock.calls.length;
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    expect(vi.mocked(ServerCall.get).mock.calls.length).toBeGreaterThan(chiamate);
  });

  it("l'intestazione riporta all'elenco degli approfondimenti", async () => {
    rispondi(() => Promise.resolve(approfondimento));
    apri();

    expect(await screen.findByRole("heading", { level: 1, name: "Chianti Classico" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna alla lista" })).toHaveAttribute("href", "/gestione-approfondimento-vini");
    expect(screen.getByTitle("Generato")).toHaveAttribute("data-tono", "success");
    // Niente più il doppione "Torna alla Lista" in fondo al form
    expect(screen.queryByRole("button", { name: "Torna alla Lista" })).not.toBeInTheDocument();
  });
});
