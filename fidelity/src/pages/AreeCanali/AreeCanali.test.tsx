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

  it("lo stato della combinazione è un interruttore con un nome e le azioni hanno un nome", () => {
    apri();

    expect(screen.getByRole("checkbox", { name: "Attiva N-S" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Modifica area Nord" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina combinazione N-S" })).toBeInTheDocument();
  });

  it("titolo e descrizione compaiono una volta sola, nell'intestazione della pagina", () => {
    apri();

    expect(screen.getAllByRole("heading", { name: "Aree e Canali" })).toHaveLength(1);
    expect(screen.getAllByText("Le aree e i canali dei punti vendita e le loro combinazioni")).toHaveLength(1);
    expect(screen.queryByText("Aree, canali e combinazioni")).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Elimina combinazione N-SUP" })).toBeInTheDocument();
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

// Canali e aree proxy (lib/areeCanali/proxy.ts) e combinazioni leggibili
describe("Aree e canali: proxy, codici doppi e combinazioni", () => {
  const conProxy = {
    aree: [
      { id: "to", nome: "Toscana", codice: "TO", membri: [] },
      { id: "la", nome: "Lazio", codice: "LA", membri: [] },
      { id: "lo1", nome: "Lombardia", codice: "LO", membri: [] },
      { id: "lo2", nome: "Lombardia ovest", codice: "lo", membri: [] },
    ],
    canali: [
      { id: "ss", nome: "Superstore", codice: "SS", membri: [] },
      { id: "cn", nome: "Conad", codice: "CN", membri: [] },
      { id: "cy", nome: "City", codice: "CY", membri: [] },
      { id: "sscncy", nome: "Superstore + Conad + City", codice: "SSCNCY", membri: ["ss", "cn", "cy"] },
    ],
    combinazioni: [
      { id: "k1", id_canale: "ss", id_area: "to", sigla: "SS_TO", stato: "ATTIVO", canale_nome: "Superstore", canale_codice: "SS", area_nome: "Toscana", area_codice: "TO", proxy: false },
      { id: "k2", id_canale: "ss", id_area: "la", sigla: "SS_LA", stato: "DISATTIVO", canale_nome: "Superstore", canale_codice: "SS", area_nome: "Lazio", area_codice: "LA", proxy: false },
      { id: "k3", id_canale: "sscncy", id_area: "la", sigla: "SSCNCY_LA", stato: "ATTIVO", canale_nome: "Superstore + Conad + City", canale_codice: "SSCNCY", area_nome: "Lazio", area_codice: "LA", proxy: true },
      { id: "k4", id_canale: "cn", id_area: "la", sigla: "CN_LA", stato: "ATTIVO", canale_nome: "Conad", canale_codice: "CN", area_nome: "Lazio", area_codice: "LA", proxy: false },
    ],
  };

  const apriCon = (client = new QueryClient()) =>
    render(
      <QueryClientProvider client={client}>
        <AreeCanali />
      </QueryClientProvider>
    );

  beforeEach(() => {
    vi.mocked(ServerCall.put).mockReset();
    vi.mocked(ServerCall.put).mockResolvedValue({ esito: true });
    finti.query = { data: conProxy, isLoading: false, isError: false, refetch: finti.refetch };
  });

  it("un canale proxy si riconosce e dice quali canali raccoglie e come lo vede Istanta", () => {
    apriCon();

    const riga = screen.getByRole("button", { name: "Modifica canale Superstore + Conad + City" }).closest("tr")!;
    expect(within(riga).getByTitle("Proxy")).toBeInTheDocument();
    expect(riga).toHaveTextContent("Raccoglie Superstore, Conad, City. Per Istanta ogni kit si divide in un kit per membro.");
    const normale = screen.getByRole("button", { name: "Modifica canale Conad" }).closest("tr")!;
    expect(within(normale).queryByTitle("Proxy")).not.toBeInTheDocument();
  });

  it("i codici usati due volte nella GDO hanno l'avviso, senza distinguere le maiuscole", () => {
    apriCon();

    const doppia = screen.getByRole("button", { name: "Modifica area Lombardia ovest" }).closest("tr")!;
    expect(within(doppia).getByTitle("Codice doppio")).toBeInTheDocument();
    const toscana = screen.getByRole("button", { name: "Modifica area Toscana" }).closest("tr")!;
    expect(within(toscana).queryByTitle("Codice doppio")).not.toBeInTheDocument();
  });

  it("le combinazioni sono una tabella con canale, area, sigla e stato; quelle proxy dicono in cosa si dividono per Istanta", () => {
    apriCon();

    const normali = screen.getByRole("table", { name: "Combinazioni" });
    const toscana = within(normali).getByRole("checkbox", { name: "Attiva SS_TO" }).closest("tr")!;
    expect(within(toscana).getAllByRole("cell").map((cella) => cella.textContent)).toEqual(
      expect.arrayContaining(["Superstore", "Toscana", "SS_TO"])
    );
    expect(within(normali).getByRole("checkbox", { name: "Attiva SS_TO" })).toBeChecked();
    expect(within(normali).getByRole("checkbox", { name: "Attiva SS_LA" })).not.toBeChecked();
    expect(within(normali).queryByText("SSCNCY_LA")).not.toBeInTheDocument();

    const proxy = screen.getByRole("table", { name: "Combinazioni proxy" });
    expect(within(proxy).getByText("SSCNCY_LA")).toBeInTheDocument();
    // SS_LA e' disattiva e CY_LA non esiste: per Istanta resta solo CN_LA
    expect(proxy).toHaveTextContent("Per Istanta diventa: CN_LA");
    expect(proxy).toHaveTextContent("SS_LA disattiva: nessun pezzo. CY_LA non esiste: nessun pezzo.");
    // Di una combinazione esistente si cambia solo lo stato: niente dialogo di modifica
    expect(screen.queryByRole("button", { name: /Modifica combinazione/ })).not.toBeInTheDocument();
  });

  it("creare un canale proxy manda i membri scelti", async () => {
    apriCon();

    await userEvent.click(screen.getByRole("button", { name: "Crea" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Crea Canale" }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.type(within(dialogo).getByLabelText(/Nome/), "Superstore + Conad");
    await userEvent.type(within(dialogo).getByLabelText(/Sigla/), "SSCN");
    await userEvent.click(within(dialogo).getByLabelText("Canale proxy"));
    // Un proxy non puo' contenere un altro proxy
    expect(within(dialogo).queryByLabelText(/Superstore \+ Conad \+ City/)).not.toBeInTheDocument();
    expect(within(dialogo).queryByLabelText("Canale delle liste")).not.toBeInTheDocument();
    const crea = within(dialogo).getByRole("button", { name: "Crea" });
    await userEvent.click(within(dialogo).getByLabelText(/^Superstore/));
    expect(crea).toBeDisabled();
    await userEvent.click(within(dialogo).getByLabelText(/^Conad/));
    await userEvent.click(crea);

    await waitFor(() => expect(ServerCall.put).toHaveBeenCalledWith("/ACPV/salvaCanale", {
      id: undefined, nome: "Superstore + Conad", sigla: "SSCN", membri: ["ss", "cn"],
    }));
  });

  it("l'interruttore salva subito lo stato della combinazione, con il suo canale e la sua area, e la pagina si rilegge", async () => {
    const client = new QueryClient();
    const rileggi = vi.spyOn(client, "invalidateQueries");
    apriCon(client);

    await userEvent.click(screen.getByRole("checkbox", { name: "Attiva SS_LA" }));

    await waitFor(() => expect(ServerCall.put).toHaveBeenCalledWith("/ACPV/setCombinazione", {
      guidID: "k2", guidIDCanale: "ss", guidIDArea: "la", enabled: true,
    }));
    await waitFor(() => expect(rileggi).toHaveBeenCalledWith({ queryKey: ["fetchAreeCanaliECombinazioni"] }));
  });

  it("se lo stato non si salva l'interruttore torna com'era", async () => {
    vi.mocked(ServerCall.put).mockRejectedValue(new Error("Istanta non raggiungibile"));
    apriCon();

    const interruttore = screen.getByRole("checkbox", { name: "Attiva SS_TO" });
    await userEvent.click(interruttore);

    await waitFor(() => expect(ServerCall.put).toHaveBeenCalledOnce());
    await waitFor(() => expect(interruttore).toBeChecked());
    expect(interruttore).not.toBeDisabled();
  });

  it("un errore del server nel salvataggio resta visibile e il dialogo non si chiude", async () => {
    vi.mocked(ServerCall.put).mockRejectedValue(new Error("Il codice SS è già usato dal canale Superstore."));
    apriCon();

    await userEvent.click(screen.getByRole("button", { name: "Modifica canale Conad" }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.clear(within(dialogo).getByLabelText(/Sigla/));
    await userEvent.type(within(dialogo).getByLabelText(/Sigla/), "SS");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Modifica" }));

    await waitFor(() => expect(ServerCall.put).toHaveBeenCalledOnce());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Il tipo di una voce esistente non cambia
    expect(within(dialogo).getByLabelText("Canale proxy")).toBeDisabled();
  });
});
