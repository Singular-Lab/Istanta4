// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

const finti = vi.hoisted(() => ({ showNotification: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), getUrl: vi.fn(() => "") } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: () => true }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLoaderData: () => null,
}));

import Dashboard3, { type Dashboard3LoaderData } from ".";

// Il rifiuto ha già un gestore: allSettled lo legge comunque come "rejected"
const rifiutata = () => {
  const promessa = Promise.reject(new Error("Servizio non raggiungibile"));
  promessa.catch(() => undefined);
  return promessa;
};

const datiLoader = (inCorso: Promise<any>): Dashboard3LoaderData => ({
  volantiniInCorsoPromise: inCorso,
  volantiniInLavorazionePromise: Promise.resolve({ totale: 0, inAttesa: 0, kit: [] }),
  volantiniPubblicatiInLavorazionePromise: Promise.resolve({ totale: 0, kit: [] }),
  areePromise: Promise.resolve([]),
  canaliPromise: Promise.resolve([]),
});

// Stessa staleTime dell'app; un client nuovo per ogni test, salvo quando si torna sulla dashboard
const nuovoClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } });

const apri = (loader: Dashboard3LoaderData | null, embedded = true, client = nuovoClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard3 embedded={embedded} loaderDataOverride={loader} />
      </MemoryRouter>
    </QueryClientProvider>
  );

// Il servizio finto: aree e canali sono elenchi, i volantini hanno totale e kit
const rispostaPer = async (url: string) => {
  if (url === "/allAreeForGDO" || url === "/allCanaliForGDO") return [];
  return { totale: 0, inScadenza: 0, inAttesa: 0, kit: [] };
};

const chiamateA = (prefisso: string) =>
  vi.mocked(ServerCall.get).mock.calls.filter(([url]) => String(url).startsWith(prefisso)).length;

describe("Dashboard GDO", () => {
  beforeEach(() => {
    vi.mocked(ServerCall.get).mockReset();
    // Storico all'avvio, e quel che la pagina chiede da sé
    vi.mocked(ServerCall.get).mockImplementation(rispostaPer);
  });

  it("se i volantini in validità non arrivano mostra l'errore nella card, non un elenco vuoto, e Riprova li ricarica", async () => {
    apri(datiLoader(rifiutata()));

    const card = await screen.findByRole("region", { name: "Volantini in validità" });
    expect(await within(card).findByRole("alert")).toHaveTextContent("Volantini non caricati");
    expect(within(card).queryByText("Nessun volantino attivo")).not.toBeInTheDocument();

    // Le altre card restano utilizzabili
    const lavorazione = screen.getByRole("region", { name: "Volantini in lavorazione" });
    expect(within(lavorazione).getByText("Nessun volantino in lavorazione")).toBeInTheDocument();

    vi.mocked(ServerCall.get).mockResolvedValueOnce({ totale: 0, inScadenza: 0, kit: [] });
    await userEvent.click(within(card).getByRole("button", { name: "Riprova" }));

    expect(ServerCall.get).toHaveBeenCalledWith("/dashboard/volantini-in-corso");
    expect(await within(card).findByText("Nessun volantino attivo")).toBeInTheDocument();
    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("incorporata nella dashboard Superadmin non ha un'intestazione di pagina, da sola sì", async () => {
    const dati = datiLoader(Promise.resolve({ totale: 0, inScadenza: 0, kit: [] }));
    const { unmount } = apri(dati);
    await screen.findByRole("region", { name: "Volantini in validità" });
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    unmount();

    apri(dati, false);
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("i filtri rapidi sono un gruppo a scelta singola con i conteggi", async () => {
    apri(datiLoader(Promise.resolve({ totale: 0, inScadenza: 0, kit: [] })));

    const card = await screen.findByRole("region", { name: "Volantini in lavorazione" });
    const gruppo = within(card).getByRole("radiogroup", { name: "Stato processo" });
    expect(within(gruppo).getByRole("radio", { name: /Tutti/ })).toHaveAttribute("aria-checked", "true");
    expect(within(gruppo).getAllByRole("radio")).toHaveLength(3);
  });

  it("con le promesse del loader non ripete le sue richieste: dalla pagina parte solo lo storico", async () => {
    apri(datiLoader(Promise.resolve({ totale: 0, inScadenza: 0, kit: [] })));

    await screen.findByRole("region", { name: "Storico volantini" });

    expect(ServerCall.get).toHaveBeenCalledTimes(1);
    expect(ServerCall.get).toHaveBeenCalledWith("/dashboard/storico-volantini?limit=10");
  });

  it("se il loader avvia anche lo storico, la pagina non chiede nulla", async () => {
    apri({ ...datiLoader(Promise.resolve({ totale: 0, inScadenza: 0, kit: [] })), storicoPromise: Promise.resolve({ totale: 0, kit: [] }) });

    await screen.findByRole("region", { name: "Storico volantini" });

    expect(ServerCall.get).not.toHaveBeenCalled();
  });

  it("tornando sulla dashboard subito dopo non rifà le chiamate e mostra i dati senza scheletro", async () => {
    const client = nuovoClient();
    const { unmount } = apri(null, true, client);
    await screen.findByRole("region", { name: "Storico volantini" });
    // Senza loader le 6 chiamate le fa la pagina
    expect(ServerCall.get).toHaveBeenCalledTimes(6);
    unmount();
    vi.mocked(ServerCall.get).mockClear();

    apri(null, true, client);

    expect(screen.getByRole("region", { name: "Volantini in validità" })).toBeInTheDocument();
    expect(ServerCall.get).not.toHaveBeenCalled();
  });

  it("aree e canali sono chiesti una volta sola anche con più dashboard che li usano", async () => {
    const client = nuovoClient();
    apri(null, true, client);
    apri(null, true, client);

    await waitFor(() => expect(screen.getAllByRole("region", { name: "Storico volantini" })).toHaveLength(2));

    expect(chiamateA("/allAreeForGDO")).toBe(1);
    expect(chiamateA("/allCanaliForGDO")).toBe(1);
  });

  it("cambiando filtro chiede la card con il filtro e, se fallisce, Riprova rifà quella richiesta", async () => {
    vi.mocked(ServerCall.get).mockImplementation(async (url: string) => {
      if (url === "/allAreeForGDO") return [{ id: "a1", nome: "Nord" }];
      if (url === "/dashboard/volantini-in-corso?id_area=a1") throw new Error("Servizio non raggiungibile");
      return rispostaPer(url);
    });
    apri(null);
    const card = await screen.findByRole("region", { name: "Volantini in validità" });
    await within(card).findByRole("option", { name: "Nord" });

    await userEvent.selectOptions(within(card).getByRole("combobox", { name: "Area" }), "a1");

    expect(await within(card).findByRole("alert")).toHaveTextContent("Volantini non caricati");
    vi.mocked(ServerCall.get).mockClear();
    vi.mocked(ServerCall.get).mockResolvedValueOnce({ totale: 0, inScadenza: 0, kit: [] });
    await userEvent.click(within(card).getByRole("button", { name: "Riprova" }));

    expect(ServerCall.get).toHaveBeenCalledWith("/dashboard/volantini-in-corso?id_area=a1");
    expect(await within(card).findByText("Nessun volantino per questi filtri")).toBeInTheDocument();
  });
});
