// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/query/query", () => ({ useFetchAreeCanaliECombinazioni: () => finti.query }));

import AreeCanali from ".";

const dati = {
  aree: [{ id: "a1", nome: "Nord", codice: "N" }],
  canali: [{ id: "c1", nome: "Super", codice: "S" }],
  combinazioni: [{ id: "x1", sigla: "N-S", stato: "ATTIVO" }],
};

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AreeCanali />
    </QueryClientProvider>
  );

describe("Aree e canali", () => {
  beforeEach(() => {
    finti.refetch.mockReset();
    vi.mocked(ServerCall.delete).mockReset();
    vi.mocked(ServerCall.delete).mockResolvedValue(undefined);
    finti.query = { data: dati, isLoading: false, isError: false, refetch: finti.refetch };
  });

  it("nel dialogo della combinazione l'etichetta Stato indica la sua select, con id unici", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Crea Combinazione" }));
    const dialogo = await screen.findByRole("dialog");

    const stato = within(dialogo).getByLabelText("Stato");
    expect(stato.tagName).toBe("SELECT");
    expect(within(stato).getByRole("option", { name: "Disattivo" })).toBeInTheDocument();
    expect(within(dialogo).getByLabelText("Area").tagName).toBe("SELECT");
    expect(within(dialogo).getByLabelText("Canale").tagName).toBe("SELECT");

    const id = Array.from(document.body.querySelectorAll("[id]")).map((elemento) => elemento.id);
    expect(new Set(id).size).toBe(id.length);
  });

  it("lo stato della combinazione è un badge leggibile e le azioni hanno un nome", () => {
    apri();

    expect(screen.getByTitle("Attivo")).toHaveAttribute("data-tono", "success");
    expect(screen.getByRole("button", { name: "Modifica area Nord" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina combinazione N-S" })).toBeInTheDocument();
  });

  it("se il caricamento fallisce mostra l'errore e Riprova ricarica", async () => {
    finti.query = { data: undefined, isLoading: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch: finti.refetch };
    apri();

    expect(screen.getByRole("alert")).toHaveTextContent("Servizio non raggiungibile");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(finti.refetch).toHaveBeenCalledTimes(1);
  });

  it("il menu Crea è il comando primario della pagina e offre le tre creazioni", async () => {
    apri();

    const crea = screen.getByRole("button", { name: "Crea" });
    expect(crea).toHaveClass("bg-primary");
    await userEvent.click(crea);
    expect(await screen.findByRole("menuitem", { name: "Crea Area" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Crea Canale" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Crea Combinazione" })).toBeInTheDocument();
  });

  it("la ricerca filtra le tre tabelle senza distinguere maiuscole e minuscole", async () => {
    finti.query = {
      ...finti.query,
      data: {
        aree: [
          { id: "a1", nome: "Nord", codice: "N" },
          { id: "a2", nome: "Sud", codice: "S" },
        ],
        canali: [{ id: "c1", nome: "Super", codice: "SUP" }],
        combinazioni: [{ id: "x1", sigla: "N-SUP", stato: "ATTIVO" }],
      },
    };
    apri();

    const ricerca = screen.getByRole("searchbox", { name: "Cerca aree, canali e combinazioni" });
    expect(ricerca).toHaveAttribute("placeholder", "Cerca per nome, codice o sigla");

    await userEvent.type(ricerca, "NORD");
    expect(screen.getByRole("button", { name: "Modifica area Nord" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Modifica area Sud" })).not.toBeInTheDocument();
    // Il canale non corrisponde: la sua tabella dice che la ricerca non ha risultati, non che è vuota
    expect(screen.queryByRole("button", { name: "Modifica canale Super" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Nessun risultato").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nessun canale disponibile")).not.toBeInTheDocument();

    await userEvent.clear(ricerca);
    await userEvent.type(ricerca, "n-sup");
    expect(screen.getByRole("button", { name: "Modifica combinazione N-SUP" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Modifica area Nord" })).not.toBeInTheDocument();
  });

  it("senza dati la tabella mostra lo stato vuoto su tutte le colonne", () => {
    finti.query = { ...finti.query, data: { aree: [], canali: [], combinazioni: [] } };
    apri();

    const vuoto = screen.getByText("Nessuna area disponibile").closest("td");
    expect(vuoto).toHaveAttribute("colspan", "4");
    expect(vuoto?.closest("table")?.querySelectorAll("thead th")).toHaveLength(4);
  });

  it("eliminare un'area chiede conferma e chiama il servizio solo dopo Elimina", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Elimina area Nord" }));
    const dialogo = await screen.findByRole("dialog", { name: "Elimina area" });
    expect(ServerCall.delete).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Elimina" }));
    await waitFor(() => expect(ServerCall.delete).toHaveBeenCalledWith("/ACPV/eliminaArea/a1"));
  });

  it("Annulla chiude la conferma senza eliminare", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Elimina combinazione N-S" }));
    const dialogo = await screen.findByRole("dialog", { name: "Elimina combinazione" });
    await userEvent.click(within(dialogo).getByRole("button", { name: "Annulla" }));

    expect(ServerCall.delete).not.toHaveBeenCalled();
  });
});
