// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type {
  DettaglioPromozioneVolantiniConsultazione,
  KitPromozioneConsultazione,
  PresenzaReferenzaPromozione,
  ReferenzaPromozione,
} from "../../../lib/consultazione/tipi";

// Consultazione di una promozione (/volantini/promozioni/:idPromo): banda con le insegne, filtri per
// insegna e area con l'indice della pagina, griglia delle miniature, assortimento a confronto (base
// comune, % a marchio con la base scritta, % Fidelity) con in primo piano i prodotti in comune, con
// ruolo e filtri, come schede o elenco, e l'elenco di tutti i prodotti in un riquadro che scorre da sé,
// riordinabile dalle intestazioni; sotto, in pannelli chiusi, grafici e confronto fra i kit, senza la
// sezione "Dove arriva". Ogni kit apre i suoi insight; nessun collegamento alla produzione.

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura del pannello di un prodotto
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  risultato: {} as Record<string, unknown>,
  richieste: [] as unknown[],
  filtri: [] as unknown[],
  permessi: new Set<string>(),
}));

vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.has(codice) }));
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: () => Promise.resolve(undefined), getUrl: () => "" } }));
vi.mock("@/query/consultazione", () => ({
  useDettaglioPromozioneVolantini: (idPromo: string, filtri: unknown) => {
    finti.richieste.push(idPromo);
    finti.filtri.push(filtri);
    return finti.risultato;
  },
}));

import PromozioneVolantini from ".";

// UUID come quelli veri: i filtri dell'indirizzo accettano solo UUID
const CITY = { id: "c1c1c1c1-0000-4000-8000-000000000001", nome: "City" };
const SUPERSTORE = { id: "c2c2c2c2-0000-4000-8000-000000000002", nome: "Superstore" };
const TOSCANA = { id: "a1a1a1a1-0000-4000-8000-000000000001", nome: "Toscana" };
const LAZIO = { id: "a2a2a2a2-0000-4000-8000-000000000002", nome: "Lazio" };
const LOGO_CITY = "https://olimpo.esempio.it/olimpo/foto/getThumbNailOnDemand?guidId=logo-city";
const ANTEPRIMA = "/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-k1";

const kit = (id: string, campi: Partial<KitPromozioneConsultazione> = {}): KitPromozioneConsultazione => ({
  id,
  titolo: `VOL_${id}`,
  canale: CITY,
  area: TOSCANA,
  numeroFile: 3,
  numeroPuntiVendita: 1,
  copertina: null,
  referenze: 100,
  box: 90,
  pagine: 16,
  scontoMedio: 25,
  quotaFidelity: 12,
  sottocosto: 3,
  ...campi,
});

const KIT: KitPromozioneConsultazione[] = [
  kit("k1", {
    numeroPuntiVendita: 3,
    referenze: 109,
    scontoMedio: 31,
    copertina: { id: "f1", nome: "volantino.pdf", tipoExport: "VOL", mime: "application/pdf", pagine: 12, anteprima: ANTEPRIMA },
  }),
  kit("k3", { area: LAZIO, numeroPuntiVendita: 1, referenze: 120, scontoMedio: 22 }),
  kit("k2", { canale: SUPERSTORE, numeroPuntiVendita: 2, referenze: 266, scontoMedio: null }),
];

const LATTICINI = { codice: "LAT", descrizione: "Latticini", colore: "#0ea5e9" };
const DROGHERIA = { codice: "DRO", descrizione: "Drogheria" };

const presenza = (idKit: string, campi: Partial<PresenzaReferenzaPromozione> = {}): PresenzaReferenzaPromozione => ({
  idKit,
  pagina: 3,
  prezzo: 1,
  sconto: null,
  barrato: null,
  idReferenza: `r-${idKit}`,
  ...campi,
});

const prodotto = (chiave: string, nome: string, presenze: PresenzaReferenzaPromozione[], campi: Partial<ReferenzaPromozione> = {}): ReferenzaPromozione => ({
  chiave,
  nome,
  marca: null,
  formato: null,
  reparto: DROGHERIA,
  foto: null,
  codice: null,
  ean: null,
  meccaniche: [],
  prezzoAlKg: null,
  linea: null,
  sottocosto: false,
  presenze,
  ...campi,
});

// Come li manda il server: dal più condiviso al più locale, poi per nome. I kit: k1 City · Toscana, k3 City · Lazio,
// k2 Superstore · Toscana (Superstore non ha un volantino nel Lazio)
const REFERENZE: ReferenzaPromozione[] = [
  prodotto("pasta", "Pasta di semola", [
    presenza("k1", { prezzo: 0.89, sconto: 20, ruolo: "Star" }),
    presenza("k3", { prezzo: 0.89, sconto: 20, ruolo: "Base" }),
    presenza("k2", { prezzo: 0.99, sconto: null, pagina: 5, ruolo: "Base" }),
  ], { marca: "Barilla", formato: "500 g", ruoli: ["Base", "Star"], meccaniche: ["sconto", "fidelity"] }),
  prodotto("olio", "Olio extravergine", [presenza("k1", { prezzo: 5.99, sconto: 30, ruolo: "Vedette" }), presenza("k3", { prezzo: 5.99, sconto: 30, ruolo: "Vedette" })], {
    marca: "Monini",
    linea: "Conad",
    ruoli: ["Vedette"],
  }),
  prodotto("biscotti", "Biscotti frollini", [presenza("k2", { prezzo: 1.49, pagina: 7 })], { foto: null }),
  prodotto("latte", "Latte intero", [presenza("k1", { prezzo: 1.19, sconto: 20, barrato: 1.49, pagina: 4, idReferenza: "r-latte" })], {
    marca: "Granarolo",
    formato: "1 l",
    reparto: LATTICINI,
    foto: "/foto/latte.jpg",
    codice: "0014823",
    meccaniche: ["fidelity"],
    prezzoAlKg: "al l € 1,19",
    linea: "Sapori & Dintorni",
    sottocosto: true,
  }),
  prodotto("yogurt", "Yogurt bianco", [presenza("k2", { prezzo: 0.79, pagina: 2 })], { marca: "Müller", reparto: LATTICINI }),
];

const dettaglio = (campi: Partial<DettaglioPromozioneVolantiniConsultazione> = {}): DettaglioPromozioneVolantiniConsultazione => ({
  promo: { id: "p1", nome: "Volantino novembre", validitaDal: "2026-11-05", validitaAl: "2026-11-18" },
  periodo: "attivi",
  kit: KIT,
  numeroKitTotale: 3,
  insegne: [CITY, SUPERSTORE],
  opzioni: { insegne: [CITY, SUPERSTORE], aree: [LAZIO, TOSCANA] },
  loghiInsegne: {},
  numeri: {
    kit: 3,
    pagine: 48,
    puntiVendita: 6,
    localita: 4,
    regioni: 2,
    prodotti: 320,
    referenze: 495,
    scontoMedio: 27.6,
    sottocosto: 9,
  },
  assortimento: {
    prodotti: { inTutti: 40, inAlcuni: 120, inUnoSolo: 160 },
    fasceSconto: [
      { da: 0, a: 10, box: 5 },
      { da: 10, a: 20, box: 30 },
      { da: 20, a: 30, box: 60 },
      { da: 30, a: 40, box: 40 },
      { da: 40, a: 50, box: 10 },
      { da: 50, a: null, box: 3 },
    ],
    reparti: [
      { chiave: "DROGHERIA", etichetta: "Drogheria alimentare", referenze: 120, spazio: 30, quotaReferenze: 24, quotaSpazio: 30 },
      { chiave: "LATTICINI", etichetta: "Latticini e freschi", referenze: 60, spazio: 12, quotaReferenze: 13, quotaSpazio: 12 },
    ],
    meccanichePerCanale: [
      { canale: CITY, box: 100, quote: [{ meccanica: "sconto", etichetta: "Sconto in %", box: 100, quota: 100 }] },
      {
        canale: SUPERSTORE,
        box: 50,
        quote: [
          { meccanica: "sconto", etichetta: "Sconto in %", box: 30, quota: 60 },
          { meccanica: "sottocosto", etichetta: "Sottocosto", box: 20, quota: 40 },
        ],
      },
    ],
    marche: [{ nome: "Borgo Antico", box: 12, quotaSpazio: 6.2, scontoMedio: 24 }],
    referenze: REFERENZE,
  },
  ...campi,
});

const caricato = (dati: DettaglioPromozioneVolantiniConsultazione) => ({
  data: dati,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

const apri = async (indirizzo = "/volantini/promozioni/p1") => {
  const router = createMemoryRouter(
    [
      { path: "/volantini/promozioni/:idPromo", element: <PromozioneVolantini /> },
      { path: "*", element: <p>Altra pagina</p> },
    ],
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

const tabellaConfronto = () => screen.getByRole("table", { name: "I volantini della promozione a confronto" });
/** Il pannello del confronto fra i volantini aperto dall'indirizzo, come tornando dagli insight di un kit. */
const CON_CONFRONTO = "/volantini/promozioni/p1?analisi=volantini";
const righeDi = (tabella: HTMLElement) => within(tabella).getAllByRole("row").slice(1);
const percorso = (link: HTMLElement) => link.getAttribute("href");

beforeEach(() => {
  finti.risultato = caricato(dettaglio());
  finti.richieste = [];
  finti.filtri = [];
  finti.permessi = new Set();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Consultazione di una promozione", () => {
  it("chiede la promozione dell'indirizzo e la mostra nella banda, con il ritorno alla vista del suo periodo", async () => {
    oggiE("2026-11-09T10:00:00+01:00");
    await apri();

    expect(finti.richieste).toContain("p1");
    expect(screen.getByRole("heading", { level: 1, name: "Volantino novembre" })).toBeInTheDocument();
    const banda = screen.getByRole("region", { name: "La promozione" });
    expect(within(banda).getByText("Volantini Attivi · Volantino novembre")).toBeInTheDocument();
    expect(within(banda).getByText("5 – 18 novembre 2026")).toBeInTheDocument();
    expect(within(banda).getByText("Scade tra 9 giorni")).toBeInTheDocument();
    expect(within(banda).getByText(/3 volantini per 2 insegne in 2 aree/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna a Volantini Attivi" })).toHaveAttribute("href", "/volantini/attivi");
  });

  it.each<{ periodo: PeriodoConsultazione; dal: string; al: string; cartellino: string; vista: string; indirizzo: string }>([
    { periodo: "prossimi", dal: "2026-11-19", al: "2026-12-02", cartellino: "Inizia tra 10 giorni", vista: "Volantini Prossimi", indirizzo: "/volantini/prossimi" },
    { periodo: "storico", dal: "2026-10-22", al: "2026-11-04", cartellino: "Conclusa il 4 novembre", vista: "Volantini Storico", indirizzo: "/volantini/storico" },
  ])("nel periodo $periodo il cartellino dice $cartellino", async ({ periodo, dal, al, cartellino, vista, indirizzo }) => {
    oggiE("2026-11-09T10:00:00+01:00");
    finti.risultato = caricato(dettaglio({ periodo, promo: { id: "p1", nome: "Volantino novembre", validitaDal: dal, validitaAl: al } }));
    await apri();

    const banda = screen.getByRole("region", { name: "La promozione" });
    expect(within(banda).getByText(cartellino)).toBeInTheDocument();
    expect(within(banda).getByText(`${vista} · Volantino novembre`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Torna a ${vista}` })).toHaveAttribute("href", indirizzo);
  });

  it("la striscia dei numeri della promozione non c'è: dopo le schede dei volantini viene l'assortimento", async () => {
    await apri();

    expect(screen.queryByLabelText("La promozione in numeri")).not.toBeInTheDocument();
    expect(screen.queryByText("48 pagine in tutto")).not.toBeInTheDocument();
    expect(screen.queryByText("495 referenze stampate")).not.toBeInTheDocument();
    // Le sezioni nell'ordine della pagina: subito dopo "I volantini" c'è l'assortimento
    const titoli = screen.getAllByRole("heading", { level: 2 }).map(titolo => titolo.textContent);
    expect(titoli.indexOf("I volantini")).toBeGreaterThanOrEqual(0);
    expect(titoli[titoli.indexOf("I volantini") + 1]).toBe("Assortimento a confronto");
  });

  it("le miniature dicono insegna e area e aprono gli insight del loro kit; senza miniatura c'è il foglio segnaposto", async () => {
    await apri();

    const griglia = screen.getByRole("list", { name: "Copertine dei volantini" });
    const miniature = within(griglia).getAllByRole("listitem");
    expect(miniature).toHaveLength(3);
    // Sotto ogni miniatura l'insegna e l'area, nell'ordine del dettaglio
    expect(miniature.map(voce => voce.textContent)).toEqual([
      expect.stringContaining("CityToscana"),
      expect.stringContaining("CityLazio"),
      expect.stringContaining("SuperstoreToscana"),
    ]);
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k1"
    );
    expect(within(griglia).getByRole("link", { name: "Insight del volantino Superstore · Toscana" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k2"
    );
    expect(griglia.querySelector(`img[src="${ANTEPRIMA}"]`)).not.toBeNull();
    expect(within(griglia).getByRole("link", { name: "Insight del volantino Superstore · Toscana" }).querySelector("img")).toBeNull();
    // La banda non ha più il muro di copertine
    expect(within(screen.getByRole("region", { name: "La promozione" })).queryByRole("link")).not.toBeInTheDocument();
  });

  it("con due volantini della stessa insegna e area la miniatura dice quale volantino è, mai il titolo tecnico", async () => {
    finti.risultato = caricato(dettaglio({ kit: [kit("k1"), kit("k4", { titolo: "VOL_bis" })], numeroKitTotale: 2 }));
    await apri();

    const griglia = screen.getByRole("list", { name: "Copertine dei volantini" });
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana – volantino 2 di 2" })).toBeInTheDocument();
    expect(within(griglia).getByText("Volantino 1 di 2")).toBeInTheDocument();
    expect(within(griglia).queryByText("VOL_bis")).not.toBeInTheDocument();
  });

  it("accanto alle insegne c'è il loro logo in un riquadro fisso; senza logo, o se non si carica, le iniziali sul colore dell'insegna", async () => {
    finti.risultato = caricato(dettaglio({ loghiInsegne: { [CITY.id]: LOGO_CITY } }));
    await apri(CON_CONFRONTO);

    const loghiCity = () => Array.from(document.querySelectorAll(`img[src="${LOGO_CITY}"]`));
    const griglia = screen.getByRole("list", { name: "Copertine dei volantini" });
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana" }).querySelector(`img[src="${LOGO_CITY}"]`)).not.toBeNull();
    // Superstore non ha logo: le sue iniziali, nessuna immagine rotta
    const superstore = within(griglia).getByRole("link", { name: "Insight del volantino Superstore · Toscana" });
    expect(superstore.querySelectorAll("img")).toHaveLength(0);
    expect(superstore.querySelector('[data-logo-insegna="iniziali"] [data-iniziali]')).toHaveAttribute("data-iniziali", "SU");
    // Il logo anche nella banda, nel confronto e nell'elenco dei punti vendita
    expect(loghiCity().length).toBeGreaterThanOrEqual(5);
    expect(within(screen.getByRole("region", { name: "La promozione" })).getByRole("button", { name: "Solo i volantini dell'insegna City" }).querySelector("img")).not.toBeNull();

    // Un logo che non si carica diventa le iniziali
    for (const logo of loghiCity()) fireEvent.error(logo);
    expect(loghiCity()).toHaveLength(0);
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana" }).querySelector('[data-logo-insegna="iniziali"] [data-iniziali]')).toHaveAttribute("data-iniziali", "CI");
  });

  it("la tabella insegne × aree non c'è più: le miniature bastano", async () => {
    await apri();

    expect(screen.queryByRole("heading", { name: "I volantini della promozione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Volantini per insegna e area/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "I volantini" })).toBeInTheDocument();
  });

  it("la sezione Dove arriva non c'è: niente regioni, insegne, località, elenco né mappa dei punti vendita", async () => {
    finti.permessi = new Set(["gdo.visualizza"]);
    await apri(CON_CONFRONTO);

    expect(screen.queryByRole("heading", { name: /Dove arriva/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Punti vendita per regione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Toscana: \d+ punt/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Punti vendita per insegna" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Località con più punti vendita/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Elenco dei punti vendita" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Punti vendita stampati nei volantini della promozione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Cerca nei punti vendita per località o indirizzo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Conad Lucca")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Scheda del punto vendita/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/non sono sulla mappa/)).not.toBeInTheDocument();

    // I punti vendita di ciascun volantino restano nel confronto
    const puntiVenditaDi = (riga: HTMLElement) => within(riga).getAllByRole("cell")[1]?.textContent;
    expect(righeDi(tabellaConfronto()).map(puntiVenditaDi)).toEqual(["3", "2", "1"]);
  });

  it("un punto vendita stampato da due volantini conta nel confronto per ciascuno dei due", async () => {
    // A2623: Emilia e Liguria stampano gli stessi punti vendita toscani
    const EMILIA = { id: "a-em", nome: "Emilia" };
    const LIGURIA = { id: "a-li", nome: "Liguria" };
    finti.risultato = caricato(dettaglio({
      kit: [kit("em", { area: EMILIA, numeroPuntiVendita: 2 }), kit("li", { area: LIGURIA, numeroPuntiVendita: 2 })],
      numeri: { ...dettaglio().numeri, kit: 2, puntiVendita: 2, localita: 2, regioni: 1 },
    }));
    await apri(CON_CONFRONTO);

    // Nel confronto ogni volantino ha i suoi 2 punti vendita
    // La seconda colonna del confronto sono i punti vendita del volantino
    const puntiVenditaDi = (riga: HTMLElement) => within(riga).getAllByRole("cell")[1]?.textContent;
    expect(righeDi(tabellaConfronto()).map(puntiVenditaDi)).toEqual(["2", "2"]);
  });

  it("le analisi dopo l'elenco sono in due pannelli chiusi, che si aprono uno per uno e restano nell'indirizzo", async () => {
    const router = await apri();

    const assortimento = screen.getByRole("button", { name: /Sconti, reparti, meccaniche e marche/ });
    const confronto = within(screen.getByRole("region", { name: "Confronto fra i volantini" })).getByRole("button", { name: /Confronto fra i volantini/ });
    expect(assortimento).toHaveAttribute("aria-expanded", "false");
    expect(confronto).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("img", { name: /^Box per fascia di sconto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "I volantini della promozione a confronto" })).not.toBeInTheDocument();
    // I pannelli vengono dopo l'elenco di tutti i prodotti
    expect(screen.getByRole("table", { name: "Tutti i prodotti" }).compareDocumentPosition(assortimento) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(assortimento);
    expect(assortimento).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("img", { name: /^Box per fascia di sconto/ })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "I volantini della promozione a confronto" })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe("?analisi=assortimento");

    fireEvent.click(confronto);
    expect(tabellaConfronto()).toBeInTheDocument();
    expect(router.state.location.search).toBe("?analisi=assortimento%2Cvolantini");

    fireEvent.click(assortimento);
    expect(screen.queryByRole("img", { name: /^Box per fascia di sconto/ })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe("?analisi=volantini");
  });

  it("mostra l'assortimento: fasce di sconto, reparti, meccaniche e marche; la barra comune o locale non c'è più", async () => {
    await apri("/volantini/promozioni/p1?analisi=assortimento");

    expect(screen.queryByRole("heading", { name: "Comune o locale" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /prodotti in tutti i volantini/ })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Box per fascia di sconto: 0–10%: 5 box, 10–20%: 30 box/ })).toBeInTheDocument();
    expect(screen.getAllByText("Drogheria alimentare").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Meccaniche per insegna" })).toBeInTheDocument();
    const marche = screen.getByRole("table", { name: "Marche con più spazio" });
    expect(within(marche).getByText("Borgo Antico")).toBeInTheDocument();
    expect(within(marche).getByText("24%")).toBeInTheDocument();
  });

  it("una marca senza sconti stampati lo dice, invece di N/D", async () => {
    finti.risultato = caricato(
      dettaglio({ assortimento: { ...dettaglio().assortimento, marche: [{ nome: "Sapori&Dintorni CONAD", box: 20, quotaSpazio: 8.4, scontoMedio: null }] } })
    );
    await apri("/volantini/promozioni/p1?analisi=assortimento");

    const marche = screen.getByRole("table", { name: "Marche con più spazio" });
    expect(within(marche).getByText("nessuno sconto")).toBeInTheDocument();
    expect(within(marche).queryByText("N/D")).not.toBeInTheDocument();
  });

  it("sotto i filtri l'indice della pagina: il collegamento di un pannello lo apre e lo porta in vista", async () => {
    const scorri = vi.fn();
    const originale = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scorri;
    try {
      const router = await apri();

      const indice = screen.getByRole("navigation", { name: "In questa pagina" });
      expect(within(indice).getAllByRole("button").map(voce => voce.textContent)).toEqual([
        "Prodotti in comune",
        "Tutti i prodotti",
        "Sconti e reparti",
        "Confronto fra i volantini",
      ]);

      fireEvent.click(within(indice).getByRole("button", { name: "Confronto fra i volantini" }));
      await waitFor(() => expect(tabellaConfronto()).toBeInTheDocument());
      expect(router.state.location.search).toBe("?analisi=volantini");
      await waitFor(() => expect(scorri.mock.contexts.some(elemento => (elemento as HTMLElement).id === "pannello-volantini")).toBe(true));
      // L'altro pannello resta chiuso
      expect(screen.getByRole("button", { name: /Sconti, reparti, meccaniche e marche/ })).toHaveAttribute("aria-expanded", "false");
      // Le destinazioni si fermano sotto la barra dei filtri
      expect(document.getElementById("pannello-volantini")?.className).toMatch(/scroll-mt-/);

      fireEvent.click(within(indice).getByRole("button", { name: "Prodotti in comune" }));
      expect(scorri.mock.contexts.at(-1)).toBe(document.getElementById("prodotti-in-comune"));
      expect(document.getElementById("prodotti-in-comune")?.className).toMatch(/scroll-mt-/);
    } finally {
      Element.prototype.scrollIntoView = originale;
    }
  });

  it("aprendo un pannello dalla sua barra la pagina lo porta in vista", async () => {
    const scorri = vi.fn();
    const originale = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scorri;
    try {
      await apri();
      fireEvent.click(screen.getByRole("button", { name: /Sconti, reparti, meccaniche e marche/ }));
      await waitFor(() => expect(scorri.mock.contexts.some(elemento => (elemento as HTMLElement).id === "pannello-assortimento")).toBe(true));
    } finally {
      Element.prototype.scrollIntoView = originale;
    }
  });

  it("con un solo volantino l'assortimento a confronto è una frase, senza numeri, mappa né elenco", async () => {
    finti.risultato = caricato(dettaglio({ kit: [KIT[0] as KitPromozioneConsultazione], numeroKitTotale: 1 }));
    await apri();

    expect(screen.getByText("La promozione ha un solo volantino: tutti i suoi 5 prodotti sono lì.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Prodotti di un solo volantino/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Vedi / })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Prodotti in comune" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Elenco/ })).not.toBeInTheDocument();
  });

  describe("assortimento a confronto", () => {
    const riquadro = (nome: string) => screen.getByRole("region", { name: nome });
    const elenco = (nome: string) => screen.getByRole("table", { name: nome });
    const righe = (nome: string) => within(elenco(nome)).getAllByRole("row").slice(1).filter(riga => within(riga).queryAllByRole("cell").length > 1);
    const nomiDi = (nome: string) => righe(nome).map(riga => riga.querySelector("p")?.firstChild?.textContent);
    const riga = (nome: string, prodotto: string) => righe(nome).find(r => r.querySelector("p")?.firstChild?.textContent === prodotto) as HTMLElement;
    const mappa = () => screen.getByRole("table", { name: "Prodotti di un solo volantino, per insegna e area" });

    it("senza scegliere nulla: i tre numeri, la mappa dei prodotti di un solo volantino con i margini e l'elenco di tutti i prodotti", async () => {
      await apri();

      expect(riquadro("1 in tutti i 3 volantini")).toHaveTextContent("20% dei 5 prodotti dei volantini mostrati");
      expect(riquadro("1 in tutti i 3 volantini")).not.toHaveTextContent("della promozione");
      // A marchio: olio (Conad) e latte (Sapori & Dintorni), 2 prodotti su 5, con la base scritta
      const marchio = riquadro("40% dei 5 prodotti è a marchio del distributore");
      expect(marchio).toHaveTextContent("2 prodotti a marchio su 5 · il resto 60%");
      // Le linee sono sui soli prodotti a marchio, con il numero dei prodotti
      expect(marchio).toHaveTextContent("Linee, sui 2 prodotti a marchio");
      const linee = within(within(marchio).getByRole("list", { name: "Prodotti a marchio per linea" })).getAllByRole("listitem");
      expect(linee.map(linea => linea.getAttribute("aria-label"))).toEqual([
        "Conad: 50% dei prodotti a marchio, 1 prodotto",
        "Sapori & Dintorni: 50% dei prodotti a marchio, 1 prodotto",
      ]);
      // Fidelity: pasta e latte, contro il resto
      const fidelity = riquadro("40% dei 5 prodotti ha il Prezzo Fidelity");
      expect(fidelity).toHaveTextContent("2 prodotti Fidelity");
      expect(fidelity).toHaveTextContent("il resto: 60%, 3 prodotti");
      // I numeri tolti: prezzi diversi, una sola insegna, una sola area
      expect(screen.queryByText("Prezzi non allineati")).not.toBeInTheDocument();
      expect(screen.queryByText("Esclusivi di un'insegna")).not.toBeInTheDocument();
      expect(screen.queryByText("Esclusivi di un'area")).not.toBeInTheDocument();
      expect(screen.queryByText(/Il più distante:/)).not.toBeInTheDocument();

      // Ai margini della mappa i prodotti di una sola insegna e di una sola area
      expect(within(mappa()).getByRole("button", { name: "2 prodotti solo City" })).toBeInTheDocument();
      expect(within(mappa()).getByRole("button", { name: "2 prodotti solo Superstore" })).toBeInTheDocument();
      expect(within(mappa()).getByRole("button", { name: "3 prodotti solo Toscana" })).toBeInTheDocument();
      expect(within(mappa()).getByRole("button", { name: "0 prodotti solo Lazio" })).toBeDisabled();
      expect(within(mappa()).getByRole("button", { name: "1 prodotto solo in City · Toscana" })).toBeInTheDocument();
      expect(within(mappa()).getByRole("button", { name: "2 prodotti solo in Superstore · Toscana" })).toBeInTheDocument();
      // Superstore non ha un volantino nel Lazio: la casella non si sceglie
      expect(within(mappa()).queryByRole("button", { name: /Superstore · Lazio/ })).not.toBeInTheDocument();

      expect(nomiDi("Tutti i prodotti")).toHaveLength(5);
    });

    it("le linee del distributore: le quattro con più prodotti sui soli prodotti a marchio, le altre insieme, nessuna a 0%", async () => {
      const linee = ["Conad", "Sapori & Dintorni", "Verso Natura", "Conad Percorso Qualità", "Piacersi", "Essentiae"];
      const marchio = linee.flatMap((linea, i) =>
        Array.from({ length: [40, 30, 20, 10, 4, 1][i] ?? 1 }, (_, n) => prodotto(`${linea}-${n}`, `${linea} ${n}`, [presenza("k1")], { linea }))
      );
      const altri = Array.from({ length: 300 }, (_, n) => prodotto(`altro-${n}`, `Altro ${n}`, [presenza("k2")]));
      finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: [...marchio, ...altri] } }));
      await apri();

      // 105 prodotti a marchio su 405
      const riquadroMarchio = riquadro("26% dei 405 prodotti è a marchio del distributore");
      const voci = within(within(riquadroMarchio).getByRole("list", { name: "Prodotti a marchio per linea" })).getAllByRole("listitem");
      expect(voci.map(voce => voce.getAttribute("aria-label"))).toEqual([
        "Conad: 38% dei prodotti a marchio, 40 prodotti",
        "Sapori & Dintorni: 29% dei prodotti a marchio, 30 prodotti",
        "Verso Natura: 19% dei prodotti a marchio, 20 prodotti",
        "Conad Percorso Qualità: 10% dei prodotti a marchio, 10 prodotti",
        "altre 2 linee: 5% dei prodotti a marchio, 5 prodotti",
      ]);
      expect(riquadroMarchio).not.toHaveTextContent(/\b0%/);
    });

    describe("prodotti in comune", () => {
      const comuni = () => screen.getByRole("list", { name: "Prodotti in comune" });
      const schede = () => within(comuni()).getAllByRole("listitem");
      const nomiSchede = () => schede().map(scheda => scheda.querySelector("button > span:nth-child(2)")?.firstChild?.textContent);
      const tuttiIKit = (prezzo: (idKit: string) => number) => KIT.map(k => presenza(k.id, { prezzo: prezzo(k.id) }));

      it("in primo piano dopo i numeri, prima della mappa e dell'elenco: una scheda per prodotto in tutti i volantini, prima i prezzi diversi", async () => {
        finti.risultato = caricato(
          dettaglio({
            assortimento: {
              ...dettaglio().assortimento,
              referenze: [
                ...REFERENZE,
                prodotto("acqua", "Acqua naturale", tuttiIKit(() => 0.25), { marca: "Levissima", formato: "1,5 l", foto: "/foto/acqua.jpg" }),
                prodotto("caffe", "Caffè macinato", tuttiIKit(id => (id === "k2" ? 4.99 : 3.99)), { marca: "Lavazza" }),
              ],
            },
          })
        );
        await apri();

        const sezione = screen.getByRole("region", { name: "Prodotti in comune" });
        expect(sezione).toHaveTextContent("3 prodotti in tutti i 3 volantini · 2 con prezzo diverso, qui per primi");
        // Caffè +25%, Pasta +11%, poi l'acqua allo stesso prezzo ovunque
        expect(nomiSchede()).toEqual(["Caffè macinato", "Pasta di semola", "Acqua naturale"]);
        // Dopo i numeri, prima della mappa e dell'elenco
        const numeri = riquadro("3 in tutti i 3 volantini");
        expect(numeri.compareDocumentPosition(sezione) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(sezione.compareDocumentPosition(mappa()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(sezione.compareDocumentPosition(elenco("Tutti i prodotti")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        const [, pasta, acqua] = schede() as [HTMLElement, HTMLElement, HTMLElement];
        expect(within(pasta).getByText("Barilla").tagName).toBe("STRONG");
        expect(within(pasta).getByText("500 g")).toBeInTheDocument();
        expect(within(pasta).getByText("Drogheria")).toBeInTheDocument();
        expect(within(pasta).getByText("€ 0,89").parentElement).toHaveTextContent("€ 0,89 altrove");
        expect(within(pasta).getByText("€ 0,99").parentElement).toHaveTextContent("€ 0,99 Superstore");
        expect(within(pasta).getByText("+€ 0,10 · +11%")).toBeInTheDocument();
        expect(acqua.querySelector("img")).toHaveAttribute("src", "/foto/acqua.jpg");
        expect(within(acqua).getByText("€ 0,25")).toBeInTheDocument();
        expect(within(acqua).getByText("uguale in tutti i 3 volantini")).toBeInTheDocument();
        expect(within(acqua).queryByText(/^\+€/)).not.toBeInTheDocument();
      });

      it("il ruolo sopra la foto della scheda: una etichetta per ruolo, con il conteggio in vista e la frase nel suggerimento", async () => {
        await apri();

        const [pasta] = schede() as [HTMLElement];
        const etichette = pasta.querySelector("[title^='Ruolo:']") as HTMLElement;
        expect(etichette).toHaveAttribute("title", "Ruolo: Base in 2 dei 3 volantini in cui compare · Star in 1 dei 3 volantini in cui compare");
        // Nome e conteggio in elementi separati: "Star 1/3", mai "Star1/3" né "Starin"
        const voci = Array.from(etichette.querySelectorAll<HTMLElement>(":scope > [aria-hidden='true']"));
        expect(voci.map(voce => Array.from(voce.children).map(parte => parte.textContent))).toEqual([
          ["Base", "2/3"],
          ["Star", "1/3"],
        ]);
        expect(screen.queryByText(/Starin/)).not.toBeInTheDocument();
        // Le etichette stanno sopra la foto, nel suo riquadro
        expect(etichette.parentElement?.querySelector("img, svg")).not.toBeNull();
      });

      it("come elenco compatto: una riga per prodotto con ruolo, reparto, prezzi e differenza, che apre prezzi e pagine", async () => {
        const router = await apri();

        fireEvent.click(within(screen.getByRole("radiogroup", { name: "Vedi i prodotti in comune come" })).getByRole("radio", { name: "Elenco" }));
        expect(router.state.location.search).toBe("?vistaComuni=elenco");
        const righeComuni = within(comuni()).getAllByRole("listitem");
        expect(righeComuni).toHaveLength(1);
        const pasta = righeComuni[0] as HTMLElement;
        for (const testo of ["Pasta di semola", "Barilla", "Drogheria", "+€ 0,10 · +11%"]) expect(pasta).toHaveTextContent(testo);
        expect(pasta).toHaveTextContent("Ruolo: Base in 2 dei 3 volantini in cui compare");

        fireEvent.click(within(pasta).getByRole("button"));
        expect(await screen.findByRole("dialog", { name: /Pasta di semola Barilla/ })).toBeInTheDocument();
      });

      it("un prodotto in comune senza ruolo non ha etichette sopra la foto", async () => {
        const senza = REFERENZE.map(r => ({ ...r, ruoli: [] }));
        finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: senza } }));
        await apri();

        expect((schede()[0] as HTMLElement).querySelector("[title^='Ruolo:']")).toBeNull();
      });

      it("filtri propri per testo, reparto e ruolo, nell'indirizzo, che non cambiano l'elenco di tutti i prodotti", async () => {
        finti.risultato = caricato(
          dettaglio({
            assortimento: {
              ...dettaglio().assortimento,
              referenze: [
                ...REFERENZE,
                prodotto("burro", "Burro", tuttiIKit(() => 2.1), { reparto: LATTICINI, ruoli: ["Star"] }),
                prodotto("caffe", "Caffè macinato", tuttiIKit(() => 3.99), { marca: "Lavazza", ruoli: ["Base"] }),
              ],
            },
          })
        );
        const router = await apri();
        expect(nomiSchede()).toEqual(["Pasta di semola", "Burro", "Caffè macinato"]);

        const reparto = screen.getByRole("combobox", { name: "Reparto dei prodotti in comune" });
        expect(within(reparto).getAllByRole("option").map(o => o.textContent)).toEqual(["Tutti i reparti", "Drogheria", "Latticini"]);
        fireEvent.change(reparto, { target: { value: "LAT" } });
        expect(nomiSchede()).toEqual(["Burro"]);
        expect(router.state.location.search).toBe("?repartoComuni=LAT");
        expect(screen.getByRole("region", { name: "Prodotti in comune" })).toHaveTextContent("1 di 3 prodotti in comune");
        // L'elenco di tutti i prodotti non cambia
        expect(nomiDi("Tutti i prodotti")).toHaveLength(7);

        fireEvent.change(reparto, { target: { value: "" } });
        const ruoli = screen.getByRole("group", { name: "Ruolo dei prodotti in comune" });
        // Le pillole dei ruoli con i loro prodotti in comune
        expect(within(ruoli).getAllByRole("button").map(voce => voce.textContent)).toEqual(["Tutti i ruoli", "Base2", "Star2"]);
        fireEvent.click(within(ruoli).getByRole("button", { name: /^Star/ }));
        expect(nomiSchede()).toEqual(["Pasta di semola", "Burro"]);
        expect(router.state.location.search).toBe("?ruoloComuni=Star");
        // Più ruoli insieme valgono in alternativa
        fireEvent.click(within(ruoli).getByRole("button", { name: /^Base/ }));
        expect(nomiSchede()).toEqual(["Pasta di semola", "Burro", "Caffè macinato"]);
        expect(router.state.location.search).toBe("?ruoloComuni=Star%2CBase");
        // Scelto solo Base, il filtro dei reparti propone solo i reparti dei prodotti Base
        fireEvent.click(within(ruoli).getByRole("button", { name: /^Star/ }));
        expect(within(reparto).getAllByRole("option").map(o => o.textContent)).toEqual(["Tutti i reparti", "Drogheria"]);
        fireEvent.click(within(ruoli).getByRole("button", { name: /^Base/ }));
        fireEvent.click(within(ruoli).getByRole("button", { name: /^Star/ }));

        fireEvent.change(screen.getByRole("searchbox", { name: "Cerca fra i prodotti in comune" }), { target: { value: "lavazza" } });
        await waitFor(() => expect(screen.getByRole("region", { name: "Prodotti in comune" })).toHaveTextContent("Nessun prodotto in comune corrisponde ai filtri."));
        expect(screen.queryByRole("list", { name: "Prodotti in comune" })).not.toBeInTheDocument();

        fireEvent.click(within(screen.getByRole("region", { name: "Prodotti in comune" })).getAllByRole("button", { name: /Azzera filtri/ })[0] as HTMLElement);
        await waitFor(() => expect(nomiSchede()).toEqual(["Pasta di semola", "Burro", "Caffè macinato"]));
        expect(router.state.location.search).toBe("");
      });

      it("una scheda apre prezzi, sconti e pagine per insegna e area, e da una pagina gli insight del kit su quel prodotto", async () => {
        await apri();

        fireEvent.click(within(comuni()).getByRole("button", { name: /Pasta di semola/ }));

        const pannello = await screen.findByRole("dialog", { name: /Pasta di semola Barilla/ });
        expect(within(pannello).getByText("In tutti i 3 volantini")).toBeInTheDocument();
        const tabella = within(pannello).getByRole("table", { name: "Pasta di semola: prezzi e pagine per insegna e area" });
        expect(within(tabella).getAllByText("−20%")).toHaveLength(2);
        expect(within(tabella).getByRole("link", { name: /Superstore · Toscana, pagina 5/ })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k2&pagina=5&referenza=r-k2");

        fireEvent.click(within(pannello).getByRole("button", { name: "Chiudi" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      });

      it("oltre 36 prodotti in comune mostra le prime 36 schede e, a richiesta, tutte", async () => {
        const molti = Array.from({ length: 40 }, (_, i) => prodotto(`c${i}`, `Comune ${String(i).padStart(2, "0")}`, tuttiIKit(() => 1)));
        finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: molti } }));
        await apri();

        expect(schede()).toHaveLength(36);
        const comando = screen.getByRole("button", { name: "Mostra tutti i 40 prodotti in comune" });
        expect(comando).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(comando);
        expect(schede()).toHaveLength(40);
        fireEvent.click(screen.getByRole("button", { name: "Mostra meno" }));
        expect(schede()).toHaveLength(36);
      });

      it("senza prodotti in tutti i volantini lo dice, al posto delle schede", async () => {
        finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: REFERENZE.slice(1) } }));
        await apri();

        expect(screen.getByRole("region", { name: "Prodotti in comune" })).toHaveTextContent("Nessun prodotto è in tutti i 3 volantini mostrati.");
        expect(screen.queryByRole("list", { name: "Prodotti in comune" })).not.toBeInTheDocument();
      });
    });

    it("a marchio e Fidelity aprono i loro prodotti nell'elenco e stanno nell'indirizzo", async () => {
      const router = await apri();

      fireEvent.click(within(riquadro("40% dei 5 prodotti è a marchio del distributore")).getByRole("button", { name: /Vedi i prodotti/ }));
      expect(router.state.location.search).toBe("?vista=marchio");
      expect(nomiDi("A marchio del distributore").sort()).toEqual(["Latte intero", "Olio extravergine"]);

      fireEvent.click(within(riquadro("40% dei 5 prodotti ha il Prezzo Fidelity")).getByRole("button", { name: /Vedi i prodotti/ }));
      expect(router.state.location.search).toBe("?vista=fidelity");
      expect(nomiDi("Con Prezzo Fidelity").sort()).toEqual(["Latte intero", "Pasta di semola"]);
    });

    it("senza prodotti a marchio né Fidelity i numeri sono a zero e non aprono l'elenco", async () => {
      const senza = REFERENZE.map(r => ({ ...r, linea: null, meccaniche: [] }));
      finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: senza } }));
      await apri();

      const marchio = riquadro("0% dei 5 prodotti è a marchio del distributore");
      expect(marchio).toHaveTextContent("Nessun prodotto a marchio del distributore");
      expect(within(marchio).getByRole("button", { name: /Vedi i prodotti/ })).toBeDisabled();
      expect(within(riquadro("0% dei 5 prodotti ha il Prezzo Fidelity")).getByRole("button", { name: /Vedi i prodotti/ })).toBeDisabled();
    });

    it("il ruolo: colonna dell'elenco con il conteggio in vista quando sono più d'uno, e filtro a pillole nell'indirizzo, anche con più ruoli", async () => {
      const router = await apri();

      expect(within(elenco("Tutti i prodotti")).getByRole("columnheader", { name: "Ruolo" })).toBeInTheDocument();
      const pasta = riga("Tutti i prodotti", "Pasta di semola");
      expect(within(pasta).getByTitle("Base in 2 dei 3 volantini in cui compare")).toHaveTextContent("Base2/3");
      expect(within(pasta).getByTitle("Star in 1 dei 3 volantini in cui compare")).toHaveTextContent("Star1/3");
      expect(within(riga("Tutti i prodotti", "Olio extravergine")).getByText("Vedette")).toBeInTheDocument();
      expect(screen.queryByText(/Starin|Basein/)).not.toBeInTheDocument();

      const ruoli = screen.getByRole("group", { name: "Ruolo" });
      expect(within(ruoli).getAllByRole("button").map(voce => voce.textContent)).toEqual(["Tutti i ruoli", "Base1", "Star1", "Vedette1", "Senza ruolo3"]);
      fireEvent.click(within(ruoli).getByRole("button", { name: /^Vedette/ }));
      expect(router.state.location.search).toBe("?ruolo=Vedette");
      expect(nomiDi("Tutti i prodotti")).toEqual(["Olio extravergine"]);
      fireEvent.click(within(ruoli).getByRole("button", { name: /^Senza ruolo/ }));
      expect(router.state.location.search).toBe("?ruolo=Vedette%2Csenza-ruolo");
      expect(nomiDi("Tutti i prodotti").sort()).toEqual(["Biscotti frollini", "Latte intero", "Olio extravergine", "Yogurt bianco"]);
    });

    it("un vecchio indirizzo con un ruolo solo vale ancora", async () => {
      await apri("/volantini/promozioni/p1?ruolo=Star");

      expect(nomiDi("Tutti i prodotti")).toEqual(["Pasta di semola"]);
      expect(within(screen.getByRole("group", { name: "Ruolo" })).getByRole("button", { name: /^Star/ })).toHaveAttribute("aria-pressed", "true");
    });

    it("senza ruoli nei dati niente colonna né filtro Ruolo", async () => {
      const senza = REFERENZE.map(r => ({ ...r, ruoli: [], presenze: r.presenze.map(p => ({ ...p, ruolo: null })) }));
      finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: senza } }));
      await apri();

      expect(within(elenco("Tutti i prodotti")).queryByRole("columnheader", { name: "Ruolo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Ruolo" })).not.toBeInTheDocument();
    });

    it("le intestazioni riordinano l'elenco: prezzo dal più basso, di nuovo dal più alto, con aria-sort e l'ordine nell'indirizzo", async () => {
      const router = await apri();
      const intestazione = (nome: string) => within(elenco("Tutti i prodotti")).getByRole("columnheader", { name: nome });

      expect(intestazione("Prezzo")).toHaveAttribute("aria-sort", "none");
      fireEvent.click(within(intestazione("Prezzo")).getByRole("button"));
      expect(router.state.location.search).toBe("?ordina=prezzo%3Acrescente");
      expect(intestazione("Prezzo")).toHaveAttribute("aria-sort", "ascending");
      expect(nomiDi("Tutti i prodotti")).toEqual(["Yogurt bianco", "Pasta di semola", "Latte intero", "Biscotti frollini", "Olio extravergine"]);

      fireEvent.click(within(intestazione("Prezzo")).getByRole("button"));
      expect(intestazione("Prezzo")).toHaveAttribute("aria-sort", "descending");
      expect(nomiDi("Tutti i prodotti")).toEqual(["Olio extravergine", "Biscotti frollini", "Latte intero", "Pasta di semola", "Yogurt bianco"]);

      fireEvent.click(within(intestazione("Prodotto")).getByRole("button"));
      expect(nomiDi("Tutti i prodotti")).toEqual(["Biscotti frollini", "Latte intero", "Olio extravergine", "Pasta di semola", "Yogurt bianco"]);
      // L'ordine resta nell'indirizzo: tornando dagli insight di un kit lo si ritrova
      expect(router.state.location.search).toBe("?ordina=prodotto%3Acrescente");
    });

    it("un prezzo stampato all'etto lo dice nell'elenco e nei prezzi per insegna e area", async () => {
      const gorgonzola = prodotto("gorgonzola", "Gorgonzola dolce DOP", [presenza("k1", { prezzo: 0.99, prezzoAllEtto: true }), presenza("k3", { prezzo: 1.29, prezzoAllEtto: true })], {
        marca: "Sapori & Dintorni",
        prezzoAlKg: "al kg € 9,90",
      });
      finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: [...REFERENZE, gorgonzola] } }));
      await apri();

      const voce = riga("Tutti i prodotti", "Gorgonzola dolce DOP");
      expect(voce).toHaveTextContent("€ 0,99 all'etto");
      expect(voce).toHaveTextContent("€ 1,29 all'etto");
      expect(voce).toHaveTextContent("al kg € 9,90");
      fireEvent.click(within(voce).getByRole("button", { name: /Prezzi e pagine/ }));
      const tabella = screen.getByRole("table", { name: "Gorgonzola dolce DOP: prezzi e pagine per insegna e area" });
      expect(tabella).toHaveTextContent("€ 0,99 all'etto");
    });

    it("l'elenco di tutti i prodotti scorre dentro un riquadro: ricerca e filtri stanno fuori, sempre in vista", async () => {
      await apri();

      const riquadroElenco = screen.getByRole("region", { name: "Elenco: Tutti i prodotti" });
      expect(riquadroElenco).toHaveClass("overflow-auto");
      expect(riquadroElenco.className).toMatch(/max-h-/);
      expect(riquadroElenco).toHaveAttribute("tabindex", "0");
      expect(within(riquadroElenco).getByRole("table", { name: "Tutti i prodotti" })).toBeInTheDocument();
      expect(within(riquadroElenco).queryByRole("searchbox")).not.toBeInTheDocument();
      expect(within(riquadroElenco).queryByRole("combobox")).not.toBeInTheDocument();
      // Dopo il riquadro la pagina prosegue con i pannelli, chiusi, dell'assortimento e del confronto fra i kit
      const pannello = within(screen.getByRole("region", { name: "Confronto fra i volantini" })).getByRole("button", { name: /Confronto fra i volantini/ });
      expect(riquadroElenco.compareDocumentPosition(pannello) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(pannello).toHaveAttribute("aria-expanded", "false");
    });

    it("scegliendo un numero la pagina porta all'elenco; togliendo la scelta resta dov'è", async () => {
      const scorri = vi.fn();
      const originale = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = scorri;
      try {
        await apri();

        fireEvent.click(within(mappa()).getByRole("button", { name: "2 prodotti solo City" }));
        expect(scorri).toHaveBeenCalledTimes(1);
        expect(scorri.mock.contexts[0]).toContainElement(elenco("Solo City"));

        fireEvent.click(within(mappa()).getByRole("button", { name: "2 prodotti solo City" }));
        expect(scorri).toHaveBeenCalledTimes(1);

        fireEvent.click(within(mappa()).getByRole("button", { name: "2 prodotti solo in Superstore · Toscana" }));
        expect(scorri).toHaveBeenCalledTimes(2);
      } finally {
        Element.prototype.scrollIntoView = originale;
      }
    });

    it("un numero mostra i suoi prodotti nell'elenco e sta nell'indirizzo; di nuovo, o con Mostra tutti, si torna a tutti", async () => {
      const router = await apri();

      fireEvent.click(within(riquadro("1 in tutti i 3 volantini")).getByRole("button", { name: /Vedi i prodotti/ }));
      expect(router.state.location.search).toBe("?vista=base");
      expect(nomiDi("In tutti i 3 volantini")).toEqual(["Pasta di semola"]);

      fireEvent.click(within(riquadro("1 in tutti i 3 volantini")).getByRole("button", { name: /Mostra tutti i prodotti/ }));
      expect(router.state.location.search).toBe("");

      fireEvent.click(within(mappa()).getByRole("button", { name: "2 prodotti solo City" }));
      expect(router.state.location.search).toBe(`?vista=insegna%3A${CITY.id}`);
      expect(nomiDi("Solo City").sort()).toEqual(["Latte intero", "Olio extravergine"]);
      fireEvent.click(screen.getAllByRole("button", { name: /Mostra tutti i prodotti/ })[0] as HTMLElement);
      expect(nomiDi("Tutti i prodotti")).toHaveLength(5);
    });

    it("la mappa: una casella mostra i prodotti che escono solo in quel volantino", async () => {
      const router = await apri();

      fireEvent.click(within(mappa()).getByRole("button", { name: "2 prodotti solo in Superstore · Toscana" }));

      expect(router.state.location.search).toBe(`?vista=casella%3A${SUPERSTORE.id}%3A${TOSCANA.id}`);
      expect(nomiDi("Solo Superstore · Toscana").sort()).toEqual(["Biscotti frollini", "Yogurt bianco"]);
    });

    it("ogni prodotto: dove c'è a parole, prezzi per luogo, differenza; e prezzi, sconti, barrati e pagine per insegna e area", async () => {
      await apri();

      const pasta = riga("Tutti i prodotti", "Pasta di semola");
      expect(within(pasta).getByText("In tutti i 3 volantini")).toBeInTheDocument();
      expect(within(pasta).getByText("€ 0,89").parentElement).toHaveTextContent("€ 0,89 altrove");
      expect(within(pasta).getByText("€ 0,99").parentElement).toHaveTextContent("€ 0,99 Superstore");
      expect(within(pasta).getByText("+€ 0,10 · +11%")).toBeInTheDocument();
      expect(within(riga("Tutti i prodotti", "Olio extravergine")).getByText("Solo City")).toBeInTheDocument();
      expect(within(riga("Tutti i prodotti", "Olio extravergine")).getByText("uguale in tutti i suoi 2 volantini")).toBeInTheDocument();

      const latte = riga("Tutti i prodotti", "Latte intero");
      fireEvent.click(within(latte).getByRole("button", { name: /Prezzi e pagine/ }));
      const dettaglioLatte = screen.getByRole("table", { name: "Latte intero: prezzi e pagine per insegna e area" });
      expect(within(dettaglioLatte).getByText("€ 1,49")).toBeInTheDocument();
      expect(within(dettaglioLatte).getByRole("link", { name: /City · Toscana, pagina 4/ })).toHaveAttribute(
        "href",
        "/volantini/tutti_i_volantini?kit=k1&pagina=4&referenza=r-latte"
      );
    });

    it("la griglia di ogni prodotto dice solo c'è o non c'è, a qualunque prezzo; la legenda ha solo queste due voci", async () => {
      await apri();

      const pallini = (nome: string) => Array.from(riga("Tutti i prodotti", nome).querySelectorAll<HTMLElement>("[data-stato]"));
      const statoDi = (nome: string, casella: string) => pallini(nome).find(p => p.title.startsWith(`${casella}:`))?.dataset.stato;

      // La pasta costa € 0,89 nei due City e € 0,99 nel Superstore: il Superstore è "c'è" come gli altri
      expect(statoDi("Pasta di semola", "Superstore · Toscana")).toBe("presente");
      expect(statoDi("Pasta di semola", "City · Toscana")).toBe("presente");
      expect(statoDi("Pasta di semola", "City · Lazio")).toBe("presente");
      // L'olio non è nel Superstore
      expect(statoDi("Olio extravergine", "Superstore · Toscana")).toBe("assente");
      for (const nome of ["Pasta di semola", "Olio extravergine", "Latte intero"]) {
        for (const pallino of pallini(nome)) expect(["presente", "assente", "vuota"]).toContain(pallino.dataset.stato);
      }

      const legenda = screen.getByText("non c'è").parentElement as HTMLElement;
      expect(Array.from(legenda.children).map(voce => voce.textContent?.trim())).toEqual(["c'è", "non c'è"]);
      expect(screen.queryByText(/a un prezzo più alto/)).not.toBeInTheDocument();
    });

    it("i dati minimi del prodotto: foto, marca in evidenza, formato e codice, prezzo al litro, reparto, meccanica, linea e sottocosto", async () => {
      await apri();

      const latte = riga("Tutti i prodotti", "Latte intero");
      expect(latte.querySelector("img")).toHaveAttribute("src", "/foto/latte.jpg");
      expect(within(latte).getByText("Granarolo").tagName).toBe("STRONG");
      expect(within(latte).getByText("1 l · cod. 0014823")).toBeInTheDocument();
      expect(within(latte).getByText("al l € 1,19")).toBeInTheDocument();
      for (const testo of ["Latticini", "Prezzo Fidelity", "Sapori & Dintorni", "Sottocosto", "Solo City · Toscana"]) {
        expect(within(latte).getByText(testo)).toBeInTheDocument();
      }
    });

    it("dal punto di vista di un'insegna: il suo numero di esclusivi, la sua riga nella mappa e i soli prodotti che stampa", async () => {
      const router = await apri();

      fireEvent.change(screen.getByRole("combobox", { name: "Punto di vista" }), { target: { value: SUPERSTORE.id } });

      expect(router.state.location.search).toBe(`?punto=${SUPERSTORE.id}`);
      expect(within(mappa()).getByRole("button", { name: "2 prodotti solo Superstore" })).toBeInTheDocument();
      expect(within(mappa()).queryByRole("rowheader", { name: /City/ })).not.toBeInTheDocument();
      // Dal punto di vista di un'insegna non c'è la riga delle aree
      expect(within(mappa()).queryByRole("button", { name: /solo Toscana$/ })).not.toBeInTheDocument();
      expect(screen.getByText("3 prodotti stampati da Superstore")).toBeInTheDocument();
      expect(nomiDi("Tutti i prodotti").sort()).toEqual(["Biscotti frollini", "Pasta di semola", "Yogurt bianco"]);
    });

    it("ricerca per nome, marca o codice, reparto e ruolo; Azzera filtri li toglie; niente tendina dell'ordine né solo prezzo diverso", async () => {
      const router = await apri();

      expect(screen.queryByRole("combobox", { name: "Ordina per" })).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: "Solo prezzo diverso" })).not.toBeInTheDocument();
      // Un solo ordine: prima i prezzi diversi, poi per nome
      expect(nomiDi("Tutti i prodotti")).toEqual(["Pasta di semola", "Biscotti frollini", "Latte intero", "Olio extravergine", "Yogurt bianco"]);

      fireEvent.change(screen.getByRole("combobox", { name: "Reparto" }), { target: { value: "LAT" } });
      expect(nomiDi("Tutti i prodotti").sort()).toEqual(["Latte intero", "Yogurt bianco"]);

      fireEvent.change(screen.getByRole("searchbox", { name: "Cerca prodotto, marca, codice o EAN" }), { target: { value: "0014823" } });
      await waitFor(() => expect(nomiDi("Tutti i prodotti")).toEqual(["Latte intero"]));

      fireEvent.click(screen.getByRole("button", { name: "Azzera filtri" }));
      await waitFor(() => expect(nomiDi("Tutti i prodotti")).toHaveLength(5));

      fireEvent.click(within(screen.getByRole("group", { name: "Ruolo" })).getByRole("button", { name: /^Star/ }));
      expect(nomiDi("Tutti i prodotti")).toEqual(["Pasta di semola"]);
      fireEvent.click(screen.getByRole("button", { name: "Azzera filtri" }));
      await waitFor(() => expect(router.state.location.search).toBe(""));
    });

    it("un vecchio indirizzo con solo prezzo diverso e ordine mostra tutti i prodotti, nell'ordine di apertura", async () => {
      await apri("/volantini/promozioni/p1?diversi=1&ordina=nome&vista=prezzi");

      expect(nomiDi("Tutti i prodotti")).toEqual(["Pasta di semola", "Biscotti frollini", "Latte intero", "Olio extravergine", "Yogurt bianco"]);
    });

    it("Scarica Excel salva l'elenco mostrato in un file per Excel con il nome della promozione", async () => {
      const creati: Blob[] = [];
      const nomi: string[] = [];
      const originale = { crea: URL.createObjectURL, revoca: URL.revokeObjectURL };
      URL.createObjectURL = vi.fn((blob: Blob) => {
        creati.push(blob);
        return "blob:assortimento";
      }) as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn();
      const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        nomi.push(this.download);
      });
      try {
        await apri("/volantini/promozioni/p1?vista=base");
        fireEvent.click(screen.getByRole("button", { name: "Scarica Excel" }));

        expect(nomi).toEqual(["assortimento Volantino novembre.csv"]);
        const testo = await (creati[0] as Blob).text();
        expect(testo.split("\r\n")).toHaveLength(2);
        expect(testo).toContain('"Pasta di semola";"Barilla"');
      } finally {
        clic.mockRestore();
        URL.createObjectURL = originale.crea;
        URL.revokeObjectURL = originale.revoca;
      }
    });

    it("cambiando insegna la scelta nel confronto si toglie", async () => {
      const router = await apri("/volantini/promozioni/p1?vista=base");

      fireEvent.change(screen.getByRole("combobox", { name: "Insegna" }), { target: { value: CITY.id } });

      expect(router.state.location.search).toBe(`?canale=${CITY.id}`);
    });

    it("con un server che non manda i prodotti lo dice, senza numeri né elenco", async () => {
      // Un server non aggiornato non manda `referenze`
      finti.risultato = caricato(dettaglio({ assortimento: { ...dettaglio().assortimento, referenze: undefined as unknown as ReferenzaPromozione[] } }));
      await apri();

      expect(screen.getByText("Nessun prodotto riconosciuto")).toBeInTheDocument();
      expect(screen.queryByRole("table", { name: "Tutti i prodotti" })).not.toBeInTheDocument();
    });
  });

  it("la tabella di confronto si ordina cliccando le intestazioni, con aria-sort", async () => {
    await apri(CON_CONFRONTO);

    const nomi = () => righeDi(tabellaConfronto()).map(r => within(r).getByRole("link").textContent);
    const intestazione = (nome: string) => within(tabellaConfronto()).getByRole("columnheader", { name: nome });

    expect(intestazione("Punti vendita")).toHaveAttribute("aria-sort", "descending");
    expect(intestazione("Volantino")).toHaveAttribute("aria-sort", "none");
    expect(nomi()).toEqual(["City · Toscana", "Superstore · Toscana", "City · Lazio"]);

    fireEvent.click(within(intestazione("Volantino")).getByRole("button"));
    expect(intestazione("Volantino")).toHaveAttribute("aria-sort", "ascending");
    expect(intestazione("Punti vendita")).toHaveAttribute("aria-sort", "none");
    expect(nomi()).toEqual(["City · Lazio", "City · Toscana", "Superstore · Toscana"]);

    fireEvent.click(within(intestazione("Volantino")).getByRole("button"));
    expect(intestazione("Volantino")).toHaveAttribute("aria-sort", "descending");
    expect(nomi()).toEqual(["Superstore · Toscana", "City · Toscana", "City · Lazio"]);

    // Lo sconto medio mancante resta in fondo
    fireEvent.click(within(intestazione("Sconto medio")).getByRole("button"));
    expect(intestazione("Sconto medio")).toHaveAttribute("aria-sort", "descending");
    expect(nomi()).toEqual(["City · Toscana", "City · Lazio", "Superstore · Toscana"]);
    expect(within(righeDi(tabellaConfronto())[2]).getByText("N/D")).toBeInTheDocument();
  });

  it("una riga del confronto apre gli insight del kit col clic", async () => {
    const router = await apri(CON_CONFRONTO);

    const [prima] = righeDi(tabellaConfronto());
    expect(within(prima).getByRole("link")).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k1");
    fireEvent.click(prima);

    expect(router.state.location.pathname).toBe("/volantini/tutti_i_volantini");
    expect(router.state.location.search).toBe("?kit=k1");
  });

  it.each(["Enter", " "])("una riga del confronto si apre da tastiera con %j", async tasto => {
    const router = await apri(CON_CONFRONTO);

    const righe = righeDi(tabellaConfronto());
    expect(righe[1]).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(righe[1], { key: tasto });

    expect(router.state.location.search).toBe("?kit=k2");
  });

  it("nessun collegamento alla produzione e nessun dato di vendita, previsione o visibilità", async () => {
    finti.permessi = new Set(["gdo.visualizza"]);
    await apri();

    const indirizzi = screen.getAllByRole("link").map(percorso);
    expect(indirizzi.length).toBeGreaterThan(0);
    for (const indirizzo of indirizzi) {
      expect(indirizzo).toMatch(/^\/(volantini\/tutti_i_volantini\?kit=|volantini\/attivi$|punti-vendita\/)/);
    }
    expect(document.body.textContent).not.toMatch(/vendite|previsio|calore|visibilit|lavorazione|kit runtime/i);
  });

  it("caricamento: scheletri al posto dei contenuti", async () => {
    finti.risultato = { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    await apri();

    expect(screen.getByRole("status", { name: "Caricamento della promozione" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "La promozione" })).not.toBeInTheDocument();
  });

  it("una promozione che non c'è (404) è non disponibile, con il ritorno a Volantini attivi e senza errore", async () => {
    finti.risultato = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: Object.assign(new Error("Promozione non trovata"), { httpStatus: 404 }),
      refetch: vi.fn(),
    };
    const router = await apri();

    expect(screen.getByRole("heading", { name: "Promozione non disponibile" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Torna a Volantini Attivi" }));

    expect(router.state.location.pathname).toBe("/volantini/attivi");
  });

  it("un errore del servizio mostra il motivo e Riprova", async () => {
    const refetch = vi.fn();
    finti.risultato = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: Object.assign(new Error("Servizio non raggiungibile"), { httpStatus: 500 }),
      refetch,
    };
    await apri();

    const errore = screen.getByRole("alert");
    expect(within(errore).getByText("Promozione non caricata")).toBeInTheDocument();
    expect(within(errore).getByText("Servizio non raggiungibile")).toBeInTheDocument();

    fireEvent.click(within(errore).getByRole("button", { name: "Riprova" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe("Filtri per insegna e area", () => {
  const opzioniDi = (etichetta: string) =>
    within(screen.getByRole("combobox", { name: etichetta }))
      .getAllByRole("option")
      .map(opzione => opzione.textContent);
  const barra = () => screen.getByRole("search", { name: "Filtri della promozione" });

  it("senza filtri chiede tutta la promozione; le tendine propongono insegne e aree dei volantini", async () => {
    await apri();

    expect(finti.filtri.at(-1)).toEqual({ idCanale: undefined, idArea: undefined });
    expect(within(barra()).getByText("3 volantini")).toBeInTheDocument();
    expect(opzioniDi("Insegna")).toEqual(["Tutte le insegne", "City", "Superstore"]);
    expect(opzioniDi("Area")).toEqual(["Tutte le aree", "Lazio", "Toscana"]);
    expect(within(barra()).queryByRole("button", { name: "Azzera filtri" })).not.toBeInTheDocument();
  });

  it("scegliere un'insegna aggiorna l'indirizzo e chiede il dettaglio di quell'insegna; Azzera toglie tutto", async () => {
    const router = await apri();
    finti.risultato = caricato(dettaglio({ kit: KIT.slice(0, 2), numeroKitTotale: 3 }));

    fireEvent.change(screen.getByRole("combobox", { name: "Insegna" }), { target: { value: CITY.id } });

    await waitFor(() => expect(router.state.location.search).toBe(`?canale=${CITY.id}`));
    expect(finti.filtri.at(-1)).toEqual({ idCanale: CITY.id, idArea: undefined });
    expect(within(barra()).getByText("2 di 3 volantini")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Copertine dei volantini" })).getAllByRole("listitem")).toHaveLength(2);

    fireEvent.click(within(barra()).getByRole("button", { name: "Azzera filtri" }));

    await waitFor(() => expect(router.state.location.search).toBe(""));
    expect(finti.filtri.at(-1)).toEqual({ idCanale: undefined, idArea: undefined });
  });

  it("i filtri arrivano dall'indirizzo; un valore che non è un UUID non arriva al server e si può togliere", async () => {
    await apri(`/volantini/promozioni/p1?canale=${SUPERSTORE.id}&area=toscana`);

    expect(finti.filtri.at(-1)).toEqual({ idCanale: SUPERSTORE.id, idArea: undefined });
    expect(screen.getByRole("combobox", { name: "Insegna" })).toHaveValue(SUPERSTORE.id);
    expect(screen.getByRole("combobox", { name: "Area" })).toHaveValue("toscana");
    expect(opzioniDi("Area")).toEqual(["Tutte le aree", "Lazio", "Toscana", "Area scelta"]);
  });

  it("le insegne della banda filtrano la pagina; di nuovo sulla stessa il filtro si toglie", async () => {
    const router = await apri();
    const banda = () => screen.getByRole("region", { name: "La promozione" });

    fireEvent.click(within(banda()).getByRole("button", { name: "Solo i volantini dell'insegna Superstore" }));

    await waitFor(() => expect(router.state.location.search).toBe(`?canale=${SUPERSTORE.id}`));
    const scelta = within(banda()).getByRole("button", { name: "Togli il filtro sull'insegna Superstore" });
    expect(scelta).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(scelta);

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("insegna e area senza volantini insieme: lo dice e offre di azzerare, non che la promozione non c'è", async () => {
    finti.risultato = caricato(dettaglio({ kit: [], numeroKitTotale: 3 }));
    const router = await apri(`/volantini/promozioni/p1?canale=${SUPERSTORE.id}&area=${LAZIO.id}`);

    const vuoto = screen.getByRole("heading", { name: "Nessun volantino con questi filtri" }).closest("section") ?? document.body;
    expect(screen.queryByText("Promozione non disponibile")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Copertine dei volantini" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "La promozione" })).toBeInTheDocument();
    expect(within(barra()).getByText("0 di 3 volantini")).toBeInTheDocument();

    fireEvent.click(within(vuoto).getAllByRole("button", { name: "Azzera filtri" }).at(-1)!);

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("mentre arriva il dettaglio dei filtri nuovi resta quello di prima, attenuato", async () => {
    finti.risultato = { ...caricato(dettaglio()), isPlaceholderData: true };
    await apri(`/volantini/promozioni/p1?area=${TOSCANA.id}`);

    const griglia = screen.getByRole("list", { name: "Copertine dei volantini" });
    expect(griglia.closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("status", { name: "Caricamento della promozione" })).not.toBeInTheDocument();
  });
});
