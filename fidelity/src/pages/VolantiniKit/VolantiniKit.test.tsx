// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PaginaKitVolantini,
  PaginaPromozioniVolantini,
  PromozioneVolantini,
  SchedaKitVolantino,
  VarianteVolantino,
} from "../../../lib/materiali/tipi";

const finti = vi.hoisted(() => ({
  /** In corso: i kit, uno per scheda. */
  risultato: {} as Record<string, unknown>,
  /** Attivi e Storico: le promozioni con i loro kit. */
  risultatoPromozioni: {} as Record<string, unknown>,
  filtri: [] as unknown[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/components/PreviewImmaginePdf", () => ({ PreviewImmaginePdf: () => null }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: () => true }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));
vi.mock("@/query/query", () => ({
  useFetchKitVolantini: (filtri: unknown) => {
    finti.filtri.push(filtri);
    return finti.risultato;
  },
  useFetchPromozioniVolantini: (filtri: unknown) => {
    finti.filtri.push(filtri);
    return finti.risultatoPromozioni;
  },
}));

import VolantiniKit from ".";

const promo = {
  id: "p1",
  nome: "Speciale Colazione",
  stato: "IN_LAVORAZIONE",
  validitaDal: "2026-10-16",
  validitaAl: "2026-10-29",
} as SchedaKitVolantino["promo"];

const kit = (modifiche: Partial<SchedaKitVolantino> = {}): SchedaKitVolantino => ({
  id: "k1",
  idDesign: "d1",
  titolo: "Volantino 16 pagine",
  stato: "IN_LAVORAZIONE" as SchedaKitVolantino["stato"],
  tipo: null,
  promo,
  area: { id: "a1", nome: "Centro" },
  canale: { id: "c1", nome: "Supermercati" },
  formato: null,
  numeroFile: 3,
  copertina: null,
  ...modifiche,
});

const pagina = (modifiche: Partial<PaginaKitVolantini> = {}): PaginaKitVolantini => ({
  kit: [kit()],
  totale: 1,
  totaleSenzaFiltri: 1,
  pagina: 1,
  dimensione: 24,
  opzioni: {
    promozioni: [{ id: "p1", nome: "Speciale Colazione" }],
    aree: [{ id: "a1", nome: "Centro" }],
    canali: [{ id: "c1", nome: "Supermercati" }],
  },
  avvisi: [],
  ...modifiche,
});

const variante = (id: string, modifiche: Partial<VarianteVolantino> = {}): VarianteVolantino => ({
  id,
  titolo: `SS ${id} VOL`,
  area: { id: "a1", nome: "Toscana" },
  canale: { id: "c1", nome: "Superstore" },
  numeroFile: 3,
  copertina: null,
  numeroPuntiVendita: 24,
  ...modifiche,
});

const promozione = (modifiche: Partial<PromozioneVolantini> = {}): PromozioneVolantini => ({
  promo: { ...promo, stato: "VALIDA" } as PromozioneVolantini["promo"],
  copertina: { idOlimpoCloud: "olimpo-1", nome: "pagina-1.pdf", mime: "application/pdf", pagine: 16 },
  numeroKit: 2,
  kit: [
    variante("k1"),
    variante("k2", { area: { id: "a2", nome: "Lazio" }, canale: { id: "c2", nome: "Iper" }, numeroFile: 0, numeroPuntiVendita: 0 }),
  ],
  ...modifiche,
});

const paginaPromozioni = (modifiche: Partial<PaginaPromozioniVolantini> = {}): PaginaPromozioniVolantini => ({
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

const apri = async (indirizzo = "/volantini/in-corso") => {
  const periodo = new URL(indirizzo, "http://localhost").pathname.split("/")[2];
  const router = createMemoryRouter(
    [{ path: "/volantini/:periodo", loader: () => ({ periodo }), element: <VolantiniKit /> }],
    { initialEntries: [indirizzo] }
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return router;
};

describe("Volantini per periodo", () => {
  beforeEach(() => {
    finti.risultato = caricato(pagina());
    finti.risultatoPromozioni = caricato(paginaPromozioni());
    finti.filtri = [];
  });

  it("titolo e descrizione dicono il periodo; la card mostra promo, area, canale e numero di file", async () => {
    await apri();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Volantini · In corso");
    expect(screen.getByText(/Kit volantino in lavorazione nelle promozioni in corso/)).toBeInTheDocument();
    const scheda = screen.getByRole("article");
    expect(within(scheda).getByRole("link", { name: "Volantino 16 pagine" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits/k1"
    );
    expect(within(scheda).getByRole("link", { name: "Promo: Speciale Colazione" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1"
    );
    expect(within(scheda).getByText("Centro")).toBeInTheDocument();
    expect(within(scheda).getByText("Supermercati")).toBeInTheDocument();
    expect(within(scheda).getByText("3 file")).toBeInTheDocument();
    expect(within(scheda).getByTitle("In lavorazione")).toBeInTheDocument();
    expect(screen.getByText("1 kit · 1 promozione")).toBeInTheDocument();
  });

  it.each(["in-corso", "attivi", "storico"])("il periodo %s arriva alla richiesta e la pagina non porta a POP", async (periodo) => {
    await apri(`/volantini/${periodo}?promo=p1`);

    expect(finti.filtri.at(-1)).toMatchObject({ periodo, pagina: 1, idPromo: "p1" });
    // POP è una vista a parte, con le sue voci di menu: da qui non ci si arriva
    expect(screen.queryByRole("link", { name: /POP/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Vai a POP/)).not.toBeInTheDocument();
  });

  it("le schede del periodo dicono dove si è e portano agli altri periodi dei volantini", async () => {
    const router = await apri("/volantini/attivi?area=a1");

    const schede = screen.getByRole("radiogroup", { name: "Periodo" });
    expect(within(schede).getAllByRole("radio").map((scheda) => scheda.textContent)).toEqual(["In corso", "Attivi", "Storico"]);
    expect(within(schede).getByRole("radio", { name: "Attivi" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(schede).getByRole("radio", { name: "Storico" }));

    // I filtri non passano da un periodo all'altro
    await waitFor(() => expect(router.state.location.pathname).toBe("/volantini/storico"));
    expect(router.state.location.search).toBe("");
  });

  it("il filtro per stato c'è solo In corso, con Non avviato fra le scelte", async () => {
    await apri("/volantini/in-corso");
    const stato = screen.getByLabelText("Stato");
    expect(within(stato).getByRole("option", { name: "Non avviato" })).toBeInTheDocument();
  });

  it("in Attivi si sceglie la promozione dalla tendina; nello Storico si filtra per anno", async () => {
    await apri("/volantini/attivi");

    expect(screen.queryByLabelText("Stato")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Anno")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Promozione")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Area")).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText("Canale")).toBeInstanceOf(HTMLSelectElement);
    cleanup();

    await apri("/volantini/storico");

    expect(screen.queryByLabelText("Stato")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Promozione")).not.toBeInTheDocument();
    const anno = screen.getByLabelText("Anno");
    expect(within(anno).getAllByRole("option").map((opzione) => opzione.textContent)).toEqual([
      "Tutti gli anni", "2026", "2025", "2024",
    ]);
  });

  it("uno stato nell'indirizzo fuori dal periodo In corso non filtra", async () => {
    await apri("/volantini/storico?stato=IN_REVISIONE");

    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "storico" });
    expect((finti.filtri.at(-1) as { stato?: string }).stato).toBeUndefined();
  });

  it("?promo= preseleziona la promozione e filtra", async () => {
    await apri("/volantini/in-corso?promo=p1");

    expect(screen.getByLabelText("Promozione")).toHaveValue("p1");
    expect(finti.filtri.at(-1)).toMatchObject({ idPromo: "p1" });
  });

  it("scegliere un filtro aggiorna l'indirizzo e riparte dalla prima pagina", async () => {
    const router = await apri("/volantini/in-corso?pagina=3");

    fireEvent.change(screen.getByLabelText("Area"), { target: { value: "a1" } });

    await waitFor(() => expect(router.state.location.search).toBe("?area=a1"));
    await waitFor(() => expect(screen.getByLabelText("Area")).toHaveValue("a1"));
    expect(finti.filtri.at(-1)).toMatchObject({ idArea: "a1", pagina: 1 });
  });

  it("un kit non avviato porta ai kit della promo e dice che non ha file", async () => {
    finti.risultato = caricato(pagina({ kit: [kit({ id: null, stato: "NON_AVVIATO", numeroFile: 0 })] }));
    await apri();

    const scheda = screen.getByRole("article");
    expect(within(scheda).getByRole("link", { name: "Volantino 16 pagine" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits"
    );
    expect(within(scheda).getByTitle("Non avviato")).toBeInTheDocument();
    expect(within(scheda).getByText("Nessun file")).toBeInTheDocument();
  });

  it("i kit di una promo archiviata portano al suo dettaglio nello storico", async () => {
    finti.risultatoPromozioni = caricato(
      paginaPromozioni({ promozioni: [promozione({ promo: { ...promo, stato: "ARCHIVIATA" } as PromozioneVolantini["promo"] })] })
    );
    await apri("/volantini/storico");

    const scheda = screen.getByRole("article", { name: "Speciale Colazione" });
    expect(within(scheda).getByRole("link", { name: "Speciale Colazione" })).toHaveAttribute("href", "/promozioni/storico/dettagli/p1");
    expect(within(scheda).getByRole("link", { name: /Superstore · Toscana/ })).toHaveAttribute(
      "href",
      "/promozioni/storico/dettagli/p1/kits/k1"
    );
  });

  it("segnala la promo di cui non si sono potuti leggere i kit non avviati", async () => {
    finti.risultato = caricato(
      pagina({ avvisi: [{ promo: { id: "p1", nome: "Speciale Colazione" }, motivo: "Istanta non risponde" }] })
    );
    await apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Elenco incompleto");
    expect(avviso).toHaveTextContent("Speciale Colazione");
    expect(avviso).toHaveTextContent("Istanta non risponde");
  });

  it("senza kit nel periodo mostra lo stato vuoto del periodo, non quello dei filtri", async () => {
    finti.risultato = caricato(pagina({ kit: [], totale: 0, totaleSenzaFiltri: 0 }));
    await apri();

    expect(screen.getByRole("heading", { name: "Nessun kit volantino in lavorazione" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vai alle promozioni in corso" })).toBeInTheDocument();
    expect(screen.queryByText("Nessun kit corrisponde ai filtri")).not.toBeInTheDocument();
    expect(screen.getByText("0 kit")).toBeInTheDocument();
  });

  it("con i filtri senza risultati propone Azzera filtri, che toglie i filtri dall'indirizzo", async () => {
    finti.risultato = caricato(pagina({ kit: [], totale: 0, totaleSenzaFiltri: 6 }));
    const router = await apri("/volantini/in-corso?cerca=locandina&area=a1");

    expect(screen.getByRole("heading", { name: "Nessun kit corrisponde ai filtri" })).toBeInTheDocument();
    expect(screen.queryByText("Nessun kit volantino in lavorazione")).not.toBeInTheDocument();
    expect(screen.getByText("0 kit con i filtri attivi")).toBeInTheDocument();

    const azzera = screen.getAllByRole("button", { name: "Azzera filtri" });
    fireEvent.click(azzera[azzera.length - 1]);

    await waitFor(() => expect(router.state.location.search).toBe(""));
    await waitFor(() => expect(screen.getByLabelText("Area")).toHaveValue(""));
    expect(screen.getByRole("searchbox", { name: "Cerca" })).toHaveValue("");
  });

  it("se i kit non arrivano mostra il motivo e Riprova, mai lo stato vuoto", async () => {
    const refetch = vi.fn();
    finti.risultato = {
      data: undefined,
      isError: true,
      error: new Error("Servizio materiali non raggiungibile"),
      isPlaceholderData: false,
      refetch,
    };
    await apri();

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Kit non caricati");
    expect(avviso).toHaveTextContent("Servizio materiali non raggiungibile");
    expect(screen.queryByText("Nessun kit volantino in lavorazione")).not.toBeInTheDocument();
    expect(screen.queryByText("Nessun kit corrisponde ai filtri")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("durante il primo caricamento mostra le schede segnaposto", async () => {
    finti.risultato = { data: undefined, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() };
    await apri();

    expect(screen.getByRole("list", { name: "Caricamento dei kit" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Caricamento dei kit…")).toBeInTheDocument();
  });
});

describe("Volantini Attivi e Storico per promozione", () => {
  beforeEach(() => {
    finti.risultatoPromozioni = caricato(paginaPromozioni());
    finti.filtri = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Solo l'orologio è finto: router e testing-library continuano a usare i timer veri. */
  const oggiE = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };

  it("una card per promozione: copertina, validità, scadenza e le varianti che aprono il loro kit", async () => {
    oggiE("2026-10-27T10:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Volantini · Attivi");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    const scheda = screen.getByRole("article", { name: "Speciale Colazione" });
    expect(within(scheda).getByRole("link", { name: "Speciale Colazione" })).toHaveAttribute("href", "/promozioni/in-corso/dettagli/p1");
    expect(within(scheda).getByRole("button", { name: "Anteprima del volantino di Speciale Colazione" })).toBeInTheDocument();
    expect(within(scheda).getByText("16/10 – 29/10/2026")).toBeInTheDocument();
    expect(within(scheda).getByTitle("Scade tra 2 giorni")).toBeInTheDocument();
    expect(within(scheda).getByText("2 kit")).toBeInTheDocument();

    const varianti = within(scheda).getAllByRole("listitem");
    expect(varianti).toHaveLength(2);
    expect(within(varianti[0]).getByRole("link", { name: "Superstore · Toscana – SS k1 VOL, 3 file, 24 punti vendita" })).toHaveAttribute(
      "href",
      "/promozioni/in-corso/dettagli/p1/kits/k1"
    );
    expect(varianti[0]).toHaveTextContent("24 PV");
    // Senza la lista dei punti vendita il numero non si mostra; senza file lo dice
    expect(within(varianti[1]).getByRole("link", { name: "Iper · Lazio – SS k2 VOL, Nessun file" })).toBeInTheDocument();
    expect(varianti[1]).not.toHaveTextContent("PV");

    expect(screen.getByText("1 promozione · 2 kit")).toBeInTheDocument();
  });

  it("l'ultimo giorno di validità la card dice Scade oggi; nello Storico la scadenza non c'è", async () => {
    oggiE("2026-10-29T20:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getByTitle("Scade oggi")).toBeInTheDocument();
    cleanup();

    await apri("/volantini/storico");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Volantini · Storico");
    expect(screen.queryByText(/Scade/)).not.toBeInTheDocument();
  });

  it("con i filtri la card dice quanti dei kit della promozione mostra", async () => {
    finti.risultatoPromozioni = caricato(paginaPromozioni({ promozioni: [promozione({ numeroKit: 5 })] }));
    await apri("/volantini/attivi?area=a1");

    expect(screen.getByText("2 di 5 kit")).toBeInTheDocument();
  });

  it("oltre sei varianti le altre si aprono con Mostra tutte", async () => {
    const otto = Array.from({ length: 8 }, (_, indice) => variante(`k${indice + 1}`));
    finti.risultatoPromozioni = caricato(paginaPromozioni({ promozioni: [promozione({ kit: otto, numeroKit: 8 })] }));
    await apri("/volantini/storico");

    const elenco = screen.getByRole("list", { name: "Varianti di Speciale Colazione" });
    expect(within(elenco).getAllByRole("listitem")).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "Mostra tutte le 8 varianti" }));

    expect(within(elenco).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Mostra meno" })).toHaveAttribute("aria-expanded", "true");
  });

  it("nello Storico scegliere un anno aggiorna l'indirizzo, riparte dalla prima pagina e arriva alla richiesta", async () => {
    const router = await apri("/volantini/storico?pagina=2");
    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "storico", pagina: 2 });

    fireEvent.change(screen.getByLabelText("Anno"), { target: { value: "2025" } });

    await waitFor(() => expect(router.state.location.search).toBe("?anno=2025"));
    await waitFor(() => expect(screen.getByLabelText("Anno")).toHaveValue("2025"));
    expect(finti.filtri.at(-1)).toMatchObject({ periodo: "storico", anno: 2025, pagina: 1 });
  });

  it("un anno nell'indirizzo non filtra le promozioni attive", async () => {
    await apri("/volantini/attivi?anno=2024");

    expect((finti.filtri.at(-1) as { anno?: number }).anno).toBeUndefined();
  });

  it("nello Storico la promozione arrivata dal suo dettaglio si vede come filtro e si toglie", async () => {
    const router = await apri("/volantini/storico?promo=p1");

    expect(screen.getByText("Promozione: Speciale Colazione")).toBeInTheDocument();
    expect(finti.filtri.at(-1)).toMatchObject({ idPromo: "p1" });

    fireEvent.click(screen.getByRole("button", { name: "Togli il filtro sulla promozione" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("senza volantini nel periodo mostra lo stato vuoto del periodo, non quello dei filtri", async () => {
    finti.risultatoPromozioni = caricato(paginaPromozioni({ promozioni: [], totale: 0, totaleKit: 0, totaleSenzaFiltri: 0 }));
    await apri("/volantini/storico");

    expect(screen.getByRole("heading", { name: "Nessun volantino nelle promozioni concluse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vai allo storico promozioni" })).toBeInTheDocument();
    expect(screen.queryByText("Nessuna promozione corrisponde ai filtri")).not.toBeInTheDocument();
    expect(screen.getByText("0 promozioni")).toBeInTheDocument();
  });

  it("con i filtri senza risultati propone Azzera filtri, che toglie anche l'anno", async () => {
    finti.risultatoPromozioni = caricato(paginaPromozioni({ promozioni: [], totale: 0, totaleKit: 0, totaleSenzaFiltri: 40 }));
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
    finti.risultatoPromozioni = {
      data: undefined,
      isError: true,
      error: new Error("Servizio materiali non raggiungibile"),
      isPlaceholderData: false,
      refetch,
    };
    await apri("/volantini/attivi");

    const avviso = screen.getByRole("alert");
    expect(avviso).toHaveTextContent("Volantini non caricati");
    expect(avviso).toHaveTextContent("Servizio materiali non raggiungibile");
    expect(screen.queryByText("Nessuna promozione corrisponde ai filtri")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("durante il primo caricamento mostra le schede segnaposto", async () => {
    finti.risultatoPromozioni = { data: undefined, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() };
    await apri("/volantini/storico");

    expect(screen.getByRole("list", { name: "Caricamento delle promozioni" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Caricamento delle promozioni…")).toBeInTheDocument();
  });
});
