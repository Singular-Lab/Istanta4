// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PaginaPromozioniVolantiniConsultazione,
  PromozioneVolantiniConsultazione,
  VarianteConsultazione,
} from "../../../lib/consultazione/tipi";

const finti = vi.hoisted(() => ({
  /** Le promozioni con i loro kit pubblicati. */
  risultato: {} as Record<string, unknown>,
  filtri: [] as unknown[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));
vi.mock("@/query/consultazione", () => ({
  usePromozioniVolantiniConsultazione: (filtri: unknown) => {
    finti.filtri.push(filtri);
    return finti.risultato;
  },
}));

import VolantiniKit from ".";

const promo: PromozioneVolantiniConsultazione["promo"] = {
  id: "p1",
  nome: "Speciale Colazione",
  validitaDal: "2026-10-16",
  validitaAl: "2026-10-29",
};

const variante = (id: string, modifiche: Partial<VarianteConsultazione> = {}): VarianteConsultazione => ({
  id,
  titolo: `SS ${id} VOL`,
  area: { id: "a1", nome: "Toscana" },
  canale: { id: "c1", nome: "Superstore" },
  numeroFile: 3,
  copertina: null,
  numeroPuntiVendita: 24,
  ...modifiche,
});

const promozione = (modifiche: Partial<PromozioneVolantiniConsultazione> = {}): PromozioneVolantiniConsultazione => ({
  promo,
  copertina: {
    id: "f1",
    nome: "pagina-1.pdf",
    tipoExport: "VOL",
    mime: "application/pdf",
    pagine: 16,
    anteprima: "/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-1",
  },
  numeroKit: 2,
  kit: [
    variante("k1"),
    variante("k2", { area: { id: "a2", nome: "Lazio" }, canale: { id: "c2", nome: "Iper" }, numeroFile: 0, numeroPuntiVendita: 0 }),
  ],
  ...modifiche,
});

const pagina = (modifiche: Partial<PaginaPromozioniVolantiniConsultazione> = {}): PaginaPromozioniVolantiniConsultazione => ({
  promozioni: [promozione()],
  totale: 1,
  totaleKit: 2,
  totaleSenzaFiltri: 1,
  pagina: 1,
  dimensione: 12,
  opzioni: {
    promozioni: [{ id: "p1", nome: "Speciale Colazione" }],
    aree: [{ id: "a1", nome: "Toscana" }],
    canali: [{ id: "c1", nome: "Superstore" }],
    anni: [2026, 2025, 2024],
  },
  ...modifiche,
});

const caricato = <T,>(dati: T) => ({
  data: dati,
  isError: false,
  error: null,
  isPlaceholderData: false,
  refetch: vi.fn(),
});

const apri = async (indirizzo = "/volantini/attivi") => {
  const periodo = new URL(indirizzo, "http://localhost").pathname.split("/")[2];
  const router = createMemoryRouter(
    [{ path: "/volantini/:periodo", loader: () => ({ periodo }), element: <VolantiniKit /> }],
    { initialEntries: [indirizzo] }
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
};

/** Solo l'orologio è finto: router e testing-library continuano a usare i timer veri. */
const oggiE = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

beforeEach(() => {
  finti.risultato = caricato(pagina());
  finti.filtri = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Volantini per periodo", () => {
  it.each([
    ["attivi", "Attivi"],
    ["prossimi", "Prossimi"],
    ["storico", "Storico"],
  ])("la pagina %s mostra il periodo nel titolo, chiede quel periodo e non porta a POP", async (periodo, etichetta) => {
    await apri(`/volantini/${periodo}?promo=p1`);

    const titolo = screen.getByRole("heading", { level: 1 });
    expect(titolo).toHaveTextContent(`Volantini ${etichetta}`);
    expect(titolo).not.toHaveTextContent("·");
    expect(finti.filtri.at(-1)).toMatchObject({ periodo, pagina: 1, idPromo: "p1" });
    // POP è una vista a parte, con le sue voci di menu: da qui non ci si arriva
    expect(screen.queryByRole("link", { name: /POP/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Periodo" })).not.toBeInTheDocument();
  });

  it.each(["attivi", "prossimi", "storico"])(
    "in %s solo materiali pubblicati: niente stati di lavorazione, niente collegamenti alla produzione",
    async (periodo) => {
      await apri(`/volantini/${periodo}`);

      expect(screen.queryByLabelText("Stato")).not.toBeInTheDocument();
      expect(screen.queryByText(/In lavorazione|Non avviato|In revisione/)).not.toBeInTheDocument();
      const scheda = screen.getByRole("article", { name: "Speciale Colazione" });
      // Il nome della promo è testo: il suo dettaglio è della produzione
      expect(within(scheda).queryByRole("link", { name: "Speciale Colazione" })).not.toBeInTheDocument();
      for (const link of screen.getAllByRole("link")) {
        expect(link.getAttribute("href"), link.textContent ?? "").not.toMatch(/^\/promozioni|^\/avanzamento-produzione/);
      }
    }
  );

  it("un periodo sconosciuto nel loader apre Attivi", async () => {
    const router = createMemoryRouter(
      [{ path: "/volantini/:periodo", loader: () => ({ periodo: "in-corso" }), element: <VolantiniKit /> }],
      { initialEntries: ["/volantini/in-corso"] }
    );
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Volantini Attivi");
    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "attivi" });
  });
});

describe("Volantini per promozione", () => {
  it("una card per promozione: copertina, validità, scadenza e le varianti che aprono gli insight", async () => {
    oggiE("2026-10-27T10:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getAllByRole("article")).toHaveLength(1);
    const scheda = screen.getByRole("article", { name: "Speciale Colazione" });
    expect(within(scheda).getByRole("button", { name: "Anteprima del volantino di Speciale Colazione" })).toBeInTheDocument();
    // L'anteprima arriva già pronta dalle API di consultazione
    expect(scheda.querySelector("img")).toHaveAttribute("src", "/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-1");
    expect(within(scheda).getByText("16/10 – 29/10/2026")).toBeInTheDocument();
    expect(within(scheda).getByTitle("Scade tra 2 giorni")).toBeInTheDocument();
    expect(within(scheda).getByText("2 kit")).toBeInTheDocument();

    const varianti = within(scheda).getAllByRole("listitem");
    expect(varianti).toHaveLength(2);
    expect(within(varianti[0]).getByRole("link", { name: "Superstore · Toscana – SS k1 VOL, 3 file, 24 punti vendita" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k1"
    );
    expect(varianti[0]).toHaveTextContent("24 PV");
    // Senza la lista dei punti vendita il numero non si mostra; senza file lo dice
    expect(within(varianti[1]).getByRole("link", { name: "Iper · Lazio – SS k2 VOL, Nessun file" })).toBeInTheDocument();
    expect(varianti[1]).not.toHaveTextContent("PV");

    expect(screen.getByText("1 promozione · 2 kit")).toBeInTheDocument();
  });

  it("senza copertina la card mostra il segnaposto, senza anteprima", async () => {
    finti.risultato = caricato(pagina({ promozioni: [promozione({ copertina: null })] }));
    await apri("/volantini/attivi");

    expect(screen.queryByRole("button", { name: /Anteprima del volantino/ })).not.toBeInTheDocument();
  });

  it("l'ultimo giorno di validità la card dice Scade oggi; nello Storico la scadenza non c'è", async () => {
    oggiE("2026-10-29T20:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getByTitle("Scade oggi")).toBeInTheDocument();
    cleanup();

    await apri("/volantini/storico");

    expect(screen.queryByText(/Scade|Inizia/)).not.toBeInTheDocument();
  });

  it("in Prossimi la card dice quanto manca all'inizio della validità, non alla scadenza", async () => {
    oggiE("2026-10-06T10:00:00+02:00");
    await apri("/volantini/prossimi");

    const scheda = screen.getByRole("article", { name: "Speciale Colazione" });
    expect(within(scheda).getByTitle("Inizia tra 10 giorni")).toBeInTheDocument();
    expect(within(scheda).queryByText(/Scade/)).not.toBeInTheDocument();
    // Le varianti pubblicate aprono gli insight anche prima della validità
    expect(within(scheda).getByRole("link", { name: /Superstore · Toscana/ })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k1"
    );
  });

  it("in Prossimi una promo con l'inizio già passato non mostra il conteggio", async () => {
    oggiE("2026-10-20T10:00:00+02:00");
    await apri("/volantini/prossimi");

    expect(screen.queryByText(/Inizia|Già iniziata/)).not.toBeInTheDocument();
  });

  it("con i filtri la card dice quanti dei kit della promozione mostra", async () => {
    finti.risultato = caricato(pagina({ promozioni: [promozione({ numeroKit: 5 })] }));
    await apri("/volantini/attivi?area=a1");

    expect(screen.getByText("2 di 5 kit")).toBeInTheDocument();
  });

  it("oltre sei varianti le altre si aprono con Mostra tutte", async () => {
    const otto = Array.from({ length: 8 }, (_, indice) => variante(`k${indice + 1}`));
    finti.risultato = caricato(pagina({ promozioni: [promozione({ kit: otto, numeroKit: 8 })] }));
    await apri("/volantini/storico");

    const elenco = screen.getByRole("list", { name: "Varianti di Speciale Colazione" });
    expect(within(elenco).getAllByRole("listitem")).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte le 8 varianti" }));

    expect(within(elenco).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Mostra meno" })).toHaveAttribute("aria-expanded", "true");
  });

  it.each(["attivi", "prossimi"])("in %s si sceglie la promozione dalla tendina, senza anno", async (periodo) => {
    await apri(`/volantini/${periodo}?promo=p1`);

    expect(screen.getByLabelText("Promozione")).toHaveValue("p1");
    expect(screen.queryByLabelText("Anno")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Area")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Canale")).toBeInstanceOf(HTMLSelectElement);
  });

  it("nello Storico si filtra per anno, senza la tendina delle promozioni", async () => {
    await apri("/volantini/storico");

    expect(screen.queryByLabelText("Promozione")).not.toBeInTheDocument();
    const anno = screen.getByLabelText("Anno");
    expect(within(anno).getAllByRole("option").map((opzione) => opzione.textContent)).toEqual([
      "Tutti gli anni", "2026", "2025", "2024",
    ]);
  });

  it("scegliere un filtro aggiorna l'indirizzo e riparte dalla prima pagina", async () => {
    const router = await apri("/volantini/prossimi?pagina=3");

    fireEvent.change(screen.getByLabelText("Area"), { target: { value: "a1" } });

    await waitFor(() => expect(router.state.location.search).toBe("?area=a1"));
    await waitFor(() => expect(screen.getByLabelText("Area")).toHaveValue("a1"));
    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "prossimi", idArea: "a1", pagina: 1 });
  });

  it("nello Storico scegliere un anno aggiorna l'indirizzo, riparte dalla prima pagina e arriva alla richiesta", async () => {
    const router = await apri("/volantini/storico?pagina=2");
    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "storico", pagina: 2 });

    fireEvent.change(screen.getByLabelText("Anno"), { target: { value: "2025" } });

    await waitFor(() => expect(router.state.location.search).toBe("?anno=2025"));
    await waitFor(() => expect(screen.getByLabelText("Anno")).toHaveValue("2025"));
    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "storico", anno: 2025, pagina: 1 });
  });

  it("un anno nell'indirizzo non filtra le promozioni attive o prossime", async () => {
    await apri("/volantini/attivi?anno=2024");
    expect((finti.filtri.at(-1) as { anno?: number }).anno).toBeUndefined();
    cleanup();

    await apri("/volantini/prossimi?anno=2024");
    expect((finti.filtri.at(-1) as { anno?: number }).anno).toBeUndefined();
  });

  it("nello Storico la promozione arrivata dal suo dettaglio si vede come filtro e si toglie", async () => {
    const router = await apri("/volantini/storico?promo=p1");

    expect(screen.getByText("Promozione: Speciale Colazione")).toBeInTheDocument();
    expect(finti.filtri.at(-1)).toMatchObject({ idPromo: "p1" });

    fireEvent.click(screen.getByRole("button", { name: "Togli il filtro sulla promozione" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it.each([
    ["attivi", "Nessun volantino pubblicato nelle promozioni valide"],
    ["prossimi", "Nessun volantino pubblicato nelle prossime promozioni"],
    ["storico", "Nessun volantino nelle promozioni concluse"],
  ])("senza volantini in %s mostra lo stato vuoto del periodo, senza rimandi alla produzione", async (periodo, titolo) => {
    finti.risultato = caricato(pagina({ promozioni: [], totale: 0, totaleKit: 0, totaleSenzaFiltri: 0 }));
    await apri(`/volantini/${periodo}`);

    expect(screen.getByRole("heading", { name: titolo })).toBeInTheDocument();
    expect(screen.queryByText("Nessuna promozione corrisponde ai filtri")).not.toBeInTheDocument();
    expect(screen.queryByText(/Puoi crearli|dettaglio della promozione/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vai a/ })).not.toBeInTheDocument();
    expect(screen.getByText("0 promozioni")).toBeInTheDocument();
  });

  it("con i filtri senza risultati propone Azzera filtri, che toglie anche l'anno", async () => {
    finti.risultato = caricato(pagina({ promozioni: [], totale: 0, totaleKit: 0, totaleSenzaFiltri: 40 }));
    const router = await apri("/volantini/storico?cerca=natale&anno=2024");

    expect(screen.getByRole("heading", { name: "Nessuna promozione corrisponde ai filtri" })).toBeInTheDocument();
    expect(screen.queryByText("Nessun volantino nelle promozioni concluse")).not.toBeInTheDocument();
    expect(screen.getByText("0 promozioni con i filtri attivi")).toBeInTheDocument();

    const azzera = screen.getAllByRole("button", { name: "Azzera filtri" });
    fireEvent.click(azzera[azzera.length - 1]);

    await waitFor(() => expect(router.state.location.search).toBe(""));
    await waitFor(() => expect(screen.getByLabelText("Anno")).toHaveValue(""));
    expect(screen.getByRole("searchbox", { name: "Cerca" })).toHaveValue("");
  });

  it("se le promozioni non arrivano mostra il motivo e Riprova, mai lo stato vuoto", async () => {
    const refetch = vi.fn();
    finti.risultato = {
      data: undefined,
      isError: true,
      error: new Error("Servizio di consultazione non raggiungibile"),
      isPlaceholderData: false,
      refetch,
    };
    await apri("/volantini/prossimi");

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Volantini non caricati");
    expect(avviso).toHaveTextContent("Servizio di consultazione non raggiungibile");
    expect(screen.queryByText("Nessuna promozione corrisponde ai filtri")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("durante il primo caricamento mostra le schede segnaposto", async () => {
    finti.risultato = { data: undefined, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() };
    await apri("/volantini/storico");

    expect(screen.getByRole("list", { name: "Caricamento delle promozioni" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Caricamento delle promozioni…")).toBeInTheDocument();
  });
});
