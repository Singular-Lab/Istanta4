// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServerCall } from "../../../lib/server_call";

const finti = vi.hoisted(() => ({ showNotification: vi.fn(), permessiNegati: new Set<string>(), scarica: vi.fn() }));

vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), getUrl: vi.fn(() => "") } }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: finti.showNotification }) }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => !finti.permessiNegati.has(codice) }));
vi.mock("@/utils/scaricaFileConsultazione", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/scaricaFileConsultazione")>()),
  useScaricaFileConsultazione: () => ({ inCorso: null, scarica: finti.scarica }),
}));
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

// Le sezioni leggono le API di consultazione: solo volantini pubblicati della GDO
const URL_ATTIVI = "/consultazione/volantini?periodo=attivi&dimensione=200";
const URL_STORICO = "/consultazione/volantini?periodo=storico&dimensione=10";
const paginaVuota = () => ({ kit: [], totale: 0, pagina: 1, dimensione: 200 });

const datiLoader = (inCorso: Promise<any>): Dashboard3LoaderData => ({
  volantiniAttiviPromise: inCorso,
  volantiniProssimiPromise: Promise.resolve(paginaVuota()),
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

// Il servizio finto: aree e canali sono elenchi, i volantini una pagina con totale e kit
const rispostaPer = async (url: string) => {
  if (url === "/allAreeForGDO" || url === "/allCanaliForGDO") return [];
  return paginaVuota();
};

const chiamateA = (prefisso: string) =>
  vi.mocked(ServerCall.get).mock.calls.filter(([url]) => String(url).startsWith(prefisso)).length;

describe("Dashboard GDO", () => {
  beforeEach(() => {
    finti.permessiNegati = new Set();
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
    const prossimi = screen.getByRole("region", { name: "Prossimi volantini" });
    expect(within(prossimi).getByText("Nessun volantino in attesa")).toBeInTheDocument();

    vi.mocked(ServerCall.get).mockResolvedValueOnce(paginaVuota());
    await userEvent.click(within(card).getByRole("button", { name: "Riprova" }));

    expect(ServerCall.get).toHaveBeenCalledWith(URL_ATTIVI);
    expect(await within(card).findByText("Nessun volantino attivo")).toBeInTheDocument();
    expect(within(card).queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("collegamenti dei volantini", () => {
    const kitInValidita = {
      id: "k1",
      titolo: "Volantino ottobre",
      promo: { id: "p1", nome: "Promo ottobre", validitaDal: "2026-10-16", validitaAl: "2026-10-29" },
      area: { id: "a1", nome: "Toscana" },
      canale: { id: "c1", nome: "Superstore" },
      numeroFile: 1,
      copertina: {
        id: "f1", nome: "volantino.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 12,
        anteprima: "/olimpo/materiali/getThumbnailMaterialePdfs?id=o1",
      },
    };
    const conKit = () => datiLoader(Promise.resolve({ totale: 1, pagina: 1, dimensione: 200, kit: [kitInValidita] }));

    beforeEach(() => {
      vi.stubGlobal("IntersectionObserver", class {
        observe() {}
        disconnect() {}
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("il titolo del kit apre la consultazione del volantino, non la lavorazione", async () => {
      apri(conKit());

      const card = await screen.findByRole("region", { name: "Volantini in validità" });
      const titolo = await within(card).findByRole("link", { name: "Volantino ottobre" });
      expect(titolo).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k1");
    });

    it("senza materiali.visualizza il titolo resta testo semplice", async () => {
      finti.permessiNegati = new Set(["materiali.visualizza"]);
      apri(conKit());

      const card = await screen.findByRole("region", { name: "Volantini in validità" });
      expect(await within(card).findByRole("heading", { name: "Volantino ottobre" })).toBeInTheDocument();
      expect(within(card).queryByRole("link", { name: "Volantino ottobre" })).not.toBeInTheDocument();
    });

    it("la scheda non mostra lo stato del kit e Scarica prende il PDF dalla consultazione", async () => {
      apri(conKit());

      const card = await screen.findByRole("region", { name: "Volantini in validità" });
      await within(card).findByRole("link", { name: "Volantino ottobre" });
      expect(within(card).queryByText("Pubblicato")).not.toBeInTheDocument();

      await userEvent.click(within(card).getByRole("button", { name: "Scarica" }));
      expect(finti.scarica).toHaveBeenCalledWith("f1", "volantino.pdf");
    });

    it("senza materiali.scarica il comando Scarica è disattivato e dice perché", async () => {
      finti.permessiNegati = new Set(["materiali.scarica"]);
      apri(conKit());

      const card = await screen.findByRole("region", { name: "Volantini in validità" });
      await within(card).findByRole("link", { name: "Volantino ottobre" });
      const scarica = within(card).getByRole("button", { name: "Scarica" });
      expect(scarica).toBeDisabled();
      expect(scarica).toHaveAttribute("title", "Manca il permesso di scaricare volantini e POP");
    });
  });

  it("incorporata nella dashboard Superadmin non ha un'intestazione di pagina, da sola sì", async () => {
    const dati = datiLoader(Promise.resolve(paginaVuota()));
    const { unmount } = apri(dati);
    await screen.findByRole("region", { name: "Volantini in validità" });
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    unmount();

    apri(dati, false);
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it("i filtri rapidi sono un gruppo a scelta singola con i conteggi", async () => {
    apri(datiLoader(Promise.resolve(paginaVuota())));

    const card = await screen.findByRole("region", { name: "Volantini in validità" });
    const gruppo = within(card).getByRole("radiogroup", { name: "Filtri rapidi" });
    expect(within(gruppo).getByRole("radio", { name: /Tutti/ })).toHaveAttribute("aria-checked", "true");
    expect(within(gruppo).getAllByRole("radio")).toHaveLength(2);
  });

  it("non mostra lo stato delle lavorazioni e non chiede i kit in lavorazione: si seguono in Avanzamento produzione", async () => {
    apri(null);

    await screen.findByRole("region", { name: "Storico volantini" });

    const titoli = screen.getAllByRole("region").map((sezione) => within(sezione).getByRole("heading", { level: 2 }).textContent);
    expect(titoli).toEqual(["Volantini in validità", "Prossimi volantini", "Storico volantini"]);
    expect(chiamateA("/dashboard/volantini-in-lavorazione")).toBe(0);
  });

  it("con le promesse del loader non ripete le sue richieste: dalla pagina parte solo lo storico", async () => {
    apri(datiLoader(Promise.resolve(paginaVuota())));

    await screen.findByRole("region", { name: "Storico volantini" });

    expect(ServerCall.get).toHaveBeenCalledTimes(1);
    expect(ServerCall.get).toHaveBeenCalledWith(URL_STORICO);
  });

  it("se il loader avvia anche lo storico, la pagina non chiede nulla", async () => {
    apri({ ...datiLoader(Promise.resolve(paginaVuota())), storicoPromise: Promise.resolve(paginaVuota()) });

    await screen.findByRole("region", { name: "Storico volantini" });

    expect(ServerCall.get).not.toHaveBeenCalled();
  });

  it("tornando sulla dashboard subito dopo non rifà le chiamate e mostra i dati senza scheletro", async () => {
    const client = nuovoClient();
    const { unmount } = apri(null, true, client);
    await screen.findByRole("region", { name: "Storico volantini" });
    // Senza loader le 5 chiamate le fa la pagina
    expect(ServerCall.get).toHaveBeenCalledTimes(5);
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
      if (url === "/consultazione/volantini?periodo=attivi&idArea=a1&dimensione=200") throw new Error("Servizio non raggiungibile");
      return rispostaPer(url);
    });
    apri(null);
    const card = await screen.findByRole("region", { name: "Volantini in validità" });
    await within(card).findByRole("option", { name: "Nord" });

    await userEvent.selectOptions(within(card).getByRole("combobox", { name: "Area" }), "a1");

    expect(await within(card).findByRole("alert")).toHaveTextContent("Volantini non caricati");
    vi.mocked(ServerCall.get).mockClear();
    vi.mocked(ServerCall.get).mockResolvedValueOnce(paginaVuota());
    await userEvent.click(within(card).getByRole("button", { name: "Riprova" }));

    expect(ServerCall.get).toHaveBeenCalledWith("/consultazione/volantini?periodo=attivi&idArea=a1&dimensione=200");
    expect(await within(card).findByText("Nessun volantino per questi filtri")).toBeInTheDocument();
  });
});
