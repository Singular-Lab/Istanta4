// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../../lib/server_call";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("../../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/components/Base/Tippy", () => ({ default: ({ children }: any) => <>{children}</> }));

import GestioneRicette from ".";

const ricetta = {
  guid_id: "r1",
  titolo: "Risotto ai funghi",
  stato: "DA_REVISIONARE",
  tipo: "CORTA",
  procedimento: null,
  ingredienti: [],
  tempo_in_secondi: null,
  costo_in_euro: null,
  abbinamento_vino: null,
  foto_ricetta: [],
  createdAt: "2026-10-01T10:00:00Z",
};

const risposta = (dati: unknown[], totale = dati.length) => ({
  data: dati,
  pagination: { total: totale, page: 1, pageSize: 10, totalPages: Math.max(1, Math.ceil(totale / 10)) },
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <GestioneRicette />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Gestione ricette", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.put).mockReset().mockResolvedValue(risposta([ricetta]));
    vi.mocked(ServerCall.delete).mockReset().mockResolvedValue(undefined);
  });

  it("se l'elenco non arriva mostra l'errore, non lo stato vuoto, e Riprova ricarica", async () => {
    vi.mocked(ServerCall.put).mockReset().mockRejectedValue(new Error("Servizio non raggiungibile"));
    apri();

    const avviso = await screen.findByRole("alert");
    expect(avviso).toHaveTextContent("Servizio non raggiungibile");
    expect(screen.queryByText("Nessuna ricetta")).not.toBeInTheDocument();
    expect(avviso.closest("td")).toHaveAttribute("colspan", "10");

    const chiamate = vi.mocked(ServerCall.put).mock.calls.length;
    await userEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    expect(vi.mocked(ServerCall.put).mock.calls.length).toBeGreaterThan(chiamate);
  });

  it("senza ricette lo stato vuoto occupa tutte le colonne dell'intestazione", async () => {
    vi.mocked(ServerCall.put).mockReset().mockResolvedValue(risposta([]));
    apri();

    const cella = (await screen.findByText("Nessuna ricetta")).closest("td");
    const colonne = cella?.closest("table")?.querySelectorAll("thead th").length;
    expect(colonne).toBe(10);
    expect(cella).toHaveAttribute("colspan", String(colonne));
  });

  it("le azioni di riga stanno in un menu", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Azioni ricetta Risotto ai funghi" }));
    expect(await screen.findByRole("menuitem", { name: "Modifica" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Pubblica" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Elimina" })).toBeInTheDocument();
  });

  it("eliminare una ricetta chiede conferma con un pulsante di pericolo", async () => {
    apri();

    await userEvent.click(await screen.findByRole("button", { name: "Azioni ricetta Risotto ai funghi" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Elimina" }));
    const dialogo = await screen.findByRole("dialog", { name: "Elimina ricetta" });
    expect(ServerCall.delete).not.toHaveBeenCalled();

    const pulsanti = within(dialogo).getAllByRole("button");
    expect(pulsanti.map((pulsante) => pulsante.textContent)).toEqual(["Annulla", "Elimina"]);
    expect(pulsanti[1]).toHaveClass("bg-danger");

    await userEvent.click(pulsanti[1]);
    await waitFor(() => expect(ServerCall.delete).toHaveBeenCalledWith("/delete_ricetta?id=r1"));
  });

  it("la paginazione mostra l'intervallo di righe e il totale", async () => {
    vi.mocked(ServerCall.put).mockReset().mockResolvedValue(risposta([ricetta], 25));
    apri();

    expect(await screen.findByText("Mostrati 1–10 di 25")).toBeInTheDocument();
  });

  it("lo stato della ricetta è un badge leggibile", async () => {
    apri();

    expect(await screen.findByTitle("Da revisionare")).toHaveAttribute("data-tono", "warning");
  });
});
