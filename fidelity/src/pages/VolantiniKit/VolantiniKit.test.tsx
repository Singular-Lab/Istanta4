// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FileConsultazione,
  MotivoVetrina,
  PaginaPromozioniVolantiniConsultazione,
  PromozioneVolantiniConsultazione,
  VarianteConsultazione,
  VetrinaVolantiniConsultazione,
} from "../../../lib/consultazione/tipi";

const finti = vi.hoisted(() => ({
  /** Le promozioni con i loro kit pubblicati. */
  risultato: {} as Record<string, unknown>,
  filtri: [] as unknown[],
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { getUrl: () => "" } }));
vi.mock("@/query/consultazione", () => ({
  usePromozioniVolantiniConsultazione: (filtri: unknown) => {
    finti.filtri.push(filtri);
    return finti.risultato;
  },
}));

import VolantiniKit from ".";

const SUPERSTORE = { id: "c1", nome: "Superstore" };
const IPER = { id: "c2", nome: "Iper" };
const MARKET = { id: "c3", nome: "Market" };
const TOSCANA = { id: "a1", nome: "Toscana" };
const LAZIO = { id: "a2", nome: "Lazio" };
const LIGURIA = { id: "a3", nome: "Liguria" };

const promo: PromozioneVolantiniConsultazione["promo"] = {
  id: "p1",
  nome: "Speciale Colazione",
  validitaDal: "2026-10-16",
  validitaAl: "2026-10-29",
};

const anteprima = (idKit: string) => `/olimpo/materiali/getThumbnailMaterialePdfs?id=${idKit}`;

const copertina = (idKit: string): FileConsultazione => ({
  id: `f-${idKit}`,
  nome: "pagina-1.pdf",
  tipoExport: "VOL",
  mime: "application/pdf",
  pagine: 16,
  anteprima: anteprima(idKit),
});

const variante = (id: string, modifiche: Partial<VarianteConsultazione> = {}): VarianteConsultazione => ({
  id,
  titolo: `SS ${id} VOL`,
  area: TOSCANA,
  canale: SUPERSTORE,
  numeroFile: 3,
  copertina: copertina(id),
  numeroPuntiVendita: 24,
  ...modifiche,
});

const promozione = (modifiche: Partial<PromozioneVolantiniConsultazione> = {}): PromozioneVolantiniConsultazione => ({
  promo,
  copertina: copertina("k1"),
  numeroKit: 2,
  kit: [variante("k1"), variante("k2", { area: LAZIO, canale: IPER, numeroFile: 0, numeroPuntiVendita: 0 })],
  numeroPuntiVendita: 24,
  ...modifiche,
});

/** Nove volantini, tre insegne per tre aree, 24 punti vendita ciascuno. */
const noveKit = [SUPERSTORE, IPER, MARKET].flatMap((canale) =>
  [TOSCANA, LAZIO, LIGURIA].map((area) => variante(`v-${canale.id}-${area.id}`, { canale, area }))
);

const vetrina = (
  motivo: MotivoVetrina = "piu_punti_vendita",
  modifiche: Partial<PromozioneVolantiniConsultazione["promo"]> = {}
): VetrinaVolantiniConsultazione => ({
  motivo,
  promozione: promozione({
    promo: { id: "pv", nome: "Grande Volantino", validitaDal: "2026-11-05", validitaAl: "2026-11-18", ...modifiche },
    copertina: copertina("v-c1-a1"),
    numeroKit: noveKit.length,
    kit: noveKit,
    numeroPuntiVendita: 216,
  }),
});

const pagina = (modifiche: Partial<PaginaPromozioniVolantiniConsultazione> = {}): PaginaPromozioniVolantiniConsultazione => ({
  promozioni: [promozione()],
  totale: 1,
  totaleKit: 2,
  totaleSenzaFiltri: 1,
  pagina: 1,
  dimensione: 12,
  vetrina: null,
  riepilogo: { promozioni: 1, kit: 2, puntiVendita: 24 },
  opzioni: {
    promozioni: [{ id: "p1", nome: "Speciale Colazione" }],
    aree: [TOSCANA],
    canali: [SUPERSTORE],
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

/** La scheda di Speciale Colazione: tutta un collegamento, col nome per intero. */
const scheda = () => screen.getByRole("link", { name: /^Speciale Colazione,/ });

/** Gli id dei kit delle copertine nel collage, nell'ordine in cui sono disegnate. */
const copertineDi = (elemento: HTMLElement) =>
  Array.from(elemento.querySelectorAll("img")).map((immagine) => new URL(immagine.src).searchParams.get("id"));

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
    "in %s solo promozioni pubblicate: niente stati di lavorazione, niente produzione, si apre il dettaglio di consultazione",
    async (periodo) => {
      finti.risultato = caricato(pagina({ vetrina: vetrina(), totaleSenzaFiltri: 2 }));
      await apri(`/volantini/${periodo}`);

      expect(screen.queryByLabelText("Stato")).not.toBeInTheDocument();
      expect(screen.queryByText(/In lavorazione|Non avviato|In revisione/)).not.toBeInTheDocument();
      expect(scheda()).toHaveAttribute("href", "/volantini/promozioni/p1");
      expect(screen.getByRole("link", { name: "Apri la promozione Grande Volantino" })).toHaveAttribute(
        "href",
        "/volantini/promozioni/pv"
      );
      // Né il dettaglio della produzione, né gli insight delle singole varianti
      for (const link of screen.getAllByRole("link")) {
        expect(link.getAttribute("href"), link.textContent ?? "").not.toMatch(
          /^\/promozioni|^\/avanzamento-produzione|tutti_i_volantini/
        );
      }
    }
  );

  it("la descrizione dice che si apre la promozione, non le varianti", async () => {
    await apri("/volantini/attivi");

    expect(screen.getByText(/Apri una promozione per vedere i suoi volantini/)).toBeInTheDocument();
    expect(screen.queryByText(/\bvariant[ei]\b/i)).not.toBeInTheDocument();
  });

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

describe("Schede delle promozioni", () => {
  it("una scheda per promozione: periodo in grande, nome sopra, quanto manca e i numeri, senza le varianti", async () => {
    oggiE("2026-10-27T10:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getAllByRole("link", { name: /^Speciale Colazione,/ })).toHaveLength(1);
    // Il nome del collegamento dice tutto, con l'anno, anche fuori dalla pagina
    expect(scheda()).toHaveAccessibleName(
      "Speciale Colazione, 16 – 29 ottobre 2026, scade tra 2 giorni, 2 volantini, 24 punti vendita, 2 insegne"
    );
    expect(within(scheda()).getByRole("heading", { level: 3 })).toHaveTextContent("16 – 29 ottobre");
    expect(within(scheda()).getByText("Speciale Colazione")).toBeInTheDocument();
    // Da GIORNI_SCADENZA_VICINA (3) in giù la scadenza è in evidenza
    expect(within(scheda()).getByTitle("Scade tra 2 giorni")).toHaveAttribute("data-tono", "warning");
    expect(within(scheda()).getByText("2 volantini")).toBeInTheDocument();
    // I punti vendita diversi dei kit mostrati, contati dal server
    expect(within(scheda()).getByText("24 punti vendita")).toBeInTheDocument();
    expect(within(scheda()).getByText("2 insegne")).toBeInTheDocument();

    // Le varianti non si elencano e non si aprono da qui
    expect(screen.queryByRole("list", { name: /Varianti/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/SS k1 VOL|SS k2 VOL/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostra tutte/ })).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "Promozioni" })).toBeInTheDocument();
    expect(screen.getByText("1 promozione")).toBeInTheDocument();
  });

  it("il collage mostra al massimo cinque copertine, un'insegna alla volta, e +N per gli altri volantini", async () => {
    const kit = [
      variante("s1"),
      variante("s2"),
      variante("s3"),
      variante("s4"),
      variante("i1", { canale: IPER }),
      variante("i2", { canale: IPER }),
      variante("m1", { canale: MARKET }),
      variante("m2", { canale: MARKET }),
    ];
    finti.risultato = caricato(pagina({ promozioni: [promozione({ kit, numeroKit: 8 })] }));
    await apri("/volantini/attivi");

    expect(copertineDi(scheda())).toEqual(["s1", "i1", "m1", "s2", "i2"]);
    expect(within(scheda()).getByText("+3")).toBeInTheDocument();
    expect(within(scheda()).getByText("8 volantini")).toBeInTheDocument();
    expect(within(scheda()).getByText("3 insegne")).toBeInTheDocument();
    // Copertine decorative, caricate quando servono
    for (const immagine of scheda().querySelectorAll("img")) {
      expect(immagine).toHaveAttribute("alt", "");
      expect(immagine).toHaveAttribute("loading", "lazy");
      expect(immagine).toHaveAttribute("decoding", "async");
    }
  });

  it("con cinque volantini o meno il collage li mostra tutti, senza +N", async () => {
    await apri("/volantini/attivi");

    expect(copertineDi(scheda())).toEqual(["k1", "k2"]);
    expect(within(scheda()).queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it("senza copertina il collage mostra un foglio segnaposto con canale e area", async () => {
    finti.risultato = caricato(
      pagina({ promozioni: [promozione({ copertina: null, numeroKit: 1, kit: [variante("k1", { copertina: null })] })] })
    );
    await apri("/volantini/attivi");

    expect(scheda().querySelector("img")).toBeNull();
    expect(within(scheda()).getByText("Superstore · Toscana")).toBeInTheDocument();
    expect(within(scheda()).getByText("1 volantino")).toBeInTheDocument();
    expect(within(scheda()).getByText("1 insegna")).toBeInTheDocument();
  });

  it("una copertina che non arriva diventa il segnaposto", async () => {
    await apri("/volantini/attivi");

    const [prima] = Array.from(scheda().querySelectorAll("img"));
    fireEvent.error(prima);

    await waitFor(() => expect(copertineDi(scheda())).toEqual(["k2"]));
    expect(within(scheda()).getByText("Superstore · Toscana")).toBeInTheDocument();
  });

  it("i punti vendita della scheda sono quelli diversi contati dal server, non la somma dei kit", async () => {
    // A2623: due volantini da 38 punti vendita che sono gli stessi 38
    finti.risultato = caricato(
      pagina({
        promozioni: [promozione({
          kit: [variante("k1", { numeroPuntiVendita: 38 }), variante("k2", { area: LAZIO, numeroPuntiVendita: 38 })],
          numeroPuntiVendita: 38,
        })],
      })
    );
    await apri("/volantini/attivi");

    expect(within(scheda()).getByText("38 punti vendita")).toBeInTheDocument();
    expect(within(scheda()).queryByText("76 punti vendita")).not.toBeInTheDocument();
  });

  it("senza le liste dei punti vendita la scheda non mostra il numero", async () => {
    finti.risultato = caricato(
      pagina({
        promozioni: [promozione({
          kit: [variante("k1", { numeroPuntiVendita: 0 }), variante("k2", { numeroPuntiVendita: 0 })],
          numeroPuntiVendita: 0,
        })],
      })
    );
    await apri("/volantini/attivi");

    expect(scheda()).not.toHaveTextContent(/punti? vendita/);
    expect(scheda()).not.toHaveAccessibleName(/punti? vendita/);
  });

  it("con i filtri la scheda dice quanti dei volantini della promozione mostra", async () => {
    finti.risultato = caricato(pagina({ promozioni: [promozione({ numeroKit: 5 })] }));
    await apri("/volantini/attivi?area=a1");

    expect(within(scheda()).getByText("2 di 5 volantini")).toBeInTheDocument();
    expect(scheda()).toHaveAccessibleName(/, 2 di 5 volantini,/);
  });

  it("negli Attivi la scadenza vicina è in evidenza, l'ultimo giorno dice Scade oggi", async () => {
    oggiE("2026-10-20T10:00:00+02:00");
    await apri("/volantini/attivi");

    expect(screen.getByTitle("Scade tra 9 giorni")).toHaveAttribute("data-tono", "neutral");
    cleanup();

    oggiE("2026-10-26T10:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getByTitle("Scade tra 3 giorni")).toHaveAttribute("data-tono", "warning");
    cleanup();

    oggiE("2026-10-29T20:00:00+01:00");
    await apri("/volantini/attivi");

    expect(screen.getByTitle("Scade oggi")).toHaveAttribute("data-tono", "warning");
  });

  it("nei Prossimi la scheda dice quanto manca all'inizio della validità, non alla scadenza", async () => {
    oggiE("2026-10-06T10:00:00+02:00");
    await apri("/volantini/prossimi");

    expect(within(scheda()).getByTitle("Inizia tra 10 giorni")).toHaveAttribute("data-tono", "info");
    expect(within(scheda()).queryByText(/Scade/)).not.toBeInTheDocument();
  });

  it("nei Prossimi una promo con l'inizio già passato non mostra il conteggio", async () => {
    oggiE("2026-10-20T10:00:00+02:00");
    await apri("/volantini/prossimi");

    expect(screen.queryByText(/Inizia|Già iniziata/)).not.toBeInTheDocument();
  });

  it("nello Storico la scheda dice quando la promozione si è conclusa", async () => {
    oggiE("2026-11-09T10:00:00+01:00");
    await apri("/volantini/storico");

    expect(within(scheda()).getByTitle("Conclusa il 29 ottobre")).toHaveAttribute("data-tono", "neutral");
    expect(screen.queryByText(/Scade|Inizia/)).not.toBeInTheDocument();
  });
});

describe("Promozione in vetrina", () => {
  it("senza filtri sta in testa, con nome, periodo, cartellino, numeri, perché e il collegamento al dettaglio", async () => {
    oggiE("2026-11-09T10:00:00+01:00");
    finti.risultato = caricato(pagina({ vetrina: vetrina(), totaleSenzaFiltri: 2 }));
    await apri("/volantini/attivi");

    const banda = screen.getByRole("region", { name: "Promozione in vetrina" });
    expect(within(banda).getByText("In vetrina · Grande Volantino")).toBeInTheDocument();
    expect(within(banda).getByRole("heading", { level: 2 })).toHaveTextContent("5 – 18 novembre");
    expect(within(banda).getByText("Scade tra 9 giorni")).toBeInTheDocument();
    const numeri = Array.from(banda.querySelectorAll("dl > div")).map(
      (voce) => `${voce.querySelector("dd")?.textContent} ${voce.querySelector("dt")?.textContent}`
    );
    expect(numeri).toEqual(["9 volantini", "3 insegne", "3 aree", "216 punti vendita"]);
    expect(within(banda).getByRole("link", { name: "Apri la promozione Grande Volantino" })).toHaveAttribute(
      "href",
      "/volantini/promozioni/pv"
    );
    expect(within(banda).getByText("In vetrina perché raggiunge più punti vendita")).toBeInTheDocument();
    // Un ventaglio più grande: fino a sette copertine, sempre un'insegna alla volta
    expect(copertineDi(banda)).toEqual(["v-c1-a1", "v-c2-a1", "v-c3-a1", "v-c1-a2", "v-c2-a2", "v-c3-a2", "v-c1-a3"]);

    // Sotto, le altre: la promo in vetrina non si ripete
    expect(screen.getByRole("heading", { level: 2, name: "Le altre promozioni" })).toBeInTheDocument();
    expect(screen.getByText("1 promozione")).toBeInTheDocument();
    expect(scheda()).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Grande Volantino/ })).toHaveLength(1);
  });

  const casiMotivo: [string, MotivoVetrina, string, string, string][] = [
    ["prossimi", "prima_a_partire", "2026-11-01T10:00:00+01:00", "Inizia tra 4 giorni", "In vetrina perché è la prima che parte"],
    ["storico", "ultima_conclusa", "2026-11-20T10:00:00+01:00", "Conclusa il 18 novembre", "In vetrina perché è l'ultima conclusa"],
  ];

  it.each(casiMotivo)("nei %s la vetrina dice il suo perché", async (periodo, motivo, oggi, cartellino, didascalia) => {
    oggiE(oggi);
    finti.risultato = caricato(pagina({ vetrina: vetrina(motivo), totaleSenzaFiltri: 2 }));
    await apri(`/volantini/${periodo}`);

    const banda = screen.getByRole("region", { name: "Promozione in vetrina" });
    expect(within(banda).getByText(cartellino)).toBeInTheDocument();
    expect(within(banda).getByText(didascalia)).toBeInTheDocument();
  });

  it("con un filtro la vetrina non c'è e l'elenco si chiama Promozioni", async () => {
    finti.risultato = caricato(pagina({ vetrina: vetrina(), totaleSenzaFiltri: 2 }));
    await apri("/volantini/attivi?canale=c1");

    expect(screen.queryByRole("region", { name: "Promozione in vetrina" })).not.toBeInTheDocument();
    expect(screen.queryByText(/In vetrina/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Promozioni" })).toBeInTheDocument();
    expect(screen.getByText("1 promozione con i filtri attivi")).toBeInTheDocument();
  });

  it("se c'è solo la promozione in vetrina, sotto non resta una sezione vuota", async () => {
    finti.risultato = caricato(
      pagina({ promozioni: [], totale: 0, totaleKit: 0, totaleSenzaFiltri: 1, vetrina: vetrina() })
    );
    await apri("/volantini/attivi");

    expect(screen.getByRole("region", { name: "Promozione in vetrina" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Le altre promozioni|^Promozioni$/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Nessuna promozione corrisponde ai filtri")).not.toBeInTheDocument();
    expect(screen.queryByText("Nessun volantino pubblicato nelle promozioni valide")).not.toBeInTheDocument();
    expect(screen.queryByText(/^0 promozioni/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrati/)).not.toBeInTheDocument();
  });
});

describe("Riepilogo del periodo", () => {
  const numeriDelPeriodo = () =>
    within(screen.getByRole("list", { name: "Il periodo in numeri" }))
      .getAllByRole("listitem")
      .map((voce) => voce.textContent);

  it("sotto il titolo dice promozioni, volantini e punti vendita del periodo, anche con i filtri", async () => {
    finti.risultato = caricato(pagina({ riepilogo: { promozioni: 12, kit: 48, puntiVendita: 1234 } }));
    await apri("/volantini/attivi?area=a1");

    expect(numeriDelPeriodo()).toEqual(["12 promozioni", "48 volantini", "1.234 punti vendita"]);
  });

  it("al singolare, e senza i punti vendita quando le liste non sono arrivate", async () => {
    finti.risultato = caricato(pagina({ riepilogo: { promozioni: 1, kit: 1, puntiVendita: 0 } }));
    await apri("/volantini/prossimi");

    expect(numeriDelPeriodo()).toEqual(["1 promozione", "1 volantino"]);
  });
});

describe("Storico per mese", () => {
  it("le schede della pagina sono raggruppate per mese di inizio della validità", async () => {
    oggiE("2026-11-09T10:00:00+01:00");
    const conclusa = (id: string, nome: string, validitaDal: string, validitaAl: string) =>
      promozione({ promo: { id, nome, validitaDal, validitaAl } });
    finti.risultato = caricato(
      pagina({
        promozioni: [
          conclusa("pa", "Volantino fine ottobre", "2026-10-22", "2026-11-04"),
          conclusa("pb", "Sottocosto", "2026-10-16", "2026-10-22"),
          conclusa("pc", "Volantino settembre", "2026-09-24", "2026-10-07"),
          conclusa("pd", "Natale", "2025-12-18", "2025-12-31"),
        ],
        totale: 4,
        totaleSenzaFiltri: 4,
      })
    );
    await apri("/volantini/storico");

    expect(screen.getAllByRole("heading", { level: 3 }).map((titolo) => titolo.textContent)).toEqual([
      "ottobre 2026",
      "settembre 2026",
      "dicembre 2025",
    ]);
    const ottobre = screen.getByRole("list", { name: "ottobre 2026" });
    expect(within(ottobre).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/volantini/promozioni/pa",
      "/volantini/promozioni/pb",
    ]);
    // Sotto il mese le schede hanno un titolo di livello 4; fuori dall'anno in corso il periodo ha l'anno
    const natale = screen.getByRole("link", { name: /^Natale,/ });
    expect(within(natale).getByRole("heading", { level: 4 })).toHaveTextContent("18 – 31 dicembre 2025");
    expect(within(natale).getByTitle("Conclusa il 31 dicembre 2025")).toBeInTheDocument();
  });

  it("negli Attivi le schede non sono raggruppate", async () => {
    await apri("/volantini/attivi");

    expect(screen.queryAllByRole("heading", { level: 3 }).map((titolo) => titolo.textContent)).toEqual([
      expect.stringContaining("ottobre"),
    ]);
    expect(screen.getByRole("list", { name: "Promozioni con volantini" })).toBeInTheDocument();
  });
});

describe("Filtri", () => {
  it.each(["attivi", "prossimi", "storico"])("in %s niente tendina delle promozioni: ricerca, area e canale", async (periodo) => {
    await apri(`/volantini/${periodo}`);

    expect(screen.queryByRole("combobox", { name: "Promozione" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Cerca" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Area" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Canale" })).toBeInTheDocument();
    if (periodo === "storico") {
      expect(within(screen.getByRole("combobox", { name: "Anno" })).getAllByRole("option").map((opzione) => opzione.textContent)).toEqual([
        "Tutti gli anni", "2026", "2025", "2024",
      ]);
    } else {
      expect(screen.queryByRole("combobox", { name: "Anno" })).not.toBeInTheDocument();
    }
  });

  it.each(["attivi", "prossimi", "storico"])(
    "in %s la promozione arrivata dall'indirizzo si vede come filtro e si toglie",
    async (periodo) => {
      const router = await apri(`/volantini/${periodo}?promo=p1&area=a1`);

      expect(screen.getByText("Promozione: Speciale Colazione")).toBeInTheDocument();
      expect(finti.filtri.at(-1)).toMatchObject({ idPromo: "p1", idArea: "a1" });

      fireEvent.click(screen.getByRole("button", { name: "Togli il filtro sulla promozione" }));

      await waitFor(() => expect(router.state.location.search).toBe("?area=a1"));
      await waitFor(() => expect(screen.queryByText(/^Promozione:/)).not.toBeInTheDocument());
      expect(finti.filtri.at(-1)).toMatchObject({ idPromo: undefined, idArea: "a1", pagina: 1 });
    }
  );

  it("una promozione dell'indirizzo che non è fra le opzioni ha un nome generico", async () => {
    await apri("/volantini/attivi?promo=p9");

    expect(screen.getByText("Promozione: Promozione selezionata")).toBeInTheDocument();
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

  it("una pagina oltre l'ultima torna alla prima", async () => {
    finti.risultato = caricato(pagina({ promozioni: [], totale: 30, totaleSenzaFiltri: 30 }));
    const router = await apri("/volantini/attivi?pagina=9");

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });
});

describe("Stati della pagina", () => {
  it.each([
    ["attivi", "Nessun volantino pubblicato nelle promozioni valide"],
    ["prossimi", "Nessun volantino pubblicato nelle prossime promozioni"],
    ["storico", "Nessun volantino nelle promozioni concluse"],
  ])("senza volantini in %s mostra lo stato vuoto del periodo, senza rimandi alla produzione", async (periodo, titolo) => {
    finti.risultato = caricato(
      pagina({ promozioni: [], totale: 0, totaleKit: 0, totaleSenzaFiltri: 0, riepilogo: { promozioni: 0, kit: 0, puntiVendita: 0 } })
    );
    await apri(`/volantini/${periodo}`);

    expect(screen.getByRole("heading", { name: titolo })).toBeInTheDocument();
    expect(screen.queryByText("Nessuna promozione corrisponde ai filtri")).not.toBeInTheDocument();
    expect(screen.queryByText(/Puoi crearli|dettaglio della promozione/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vai a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Promozione in vetrina" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Il periodo in numeri" })).not.toBeInTheDocument();
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

  it("durante il primo caricamento mostra le schede segnaposto a forma di collage", async () => {
    finti.risultato = { data: undefined, isError: false, error: null, isPlaceholderData: false, refetch: vi.fn() };
    await apri("/volantini/storico");

    const segnaposto = screen.getByRole("list", { name: "Caricamento delle promozioni" });
    expect(segnaposto).toHaveAttribute("aria-busy", "true");
    expect(within(segnaposto).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("Caricamento delle promozioni…")).toBeInTheDocument();
  });

  it("mentre arrivano le promozioni di un altro filtro restano quelle di prima, attenuate", async () => {
    finti.risultato = { ...caricato(pagina()), isPlaceholderData: true };
    await apri("/volantini/attivi");

    expect(screen.getByRole("list", { name: "Promozioni con volantini" })).toHaveAttribute("aria-busy", "true");
  });
});
