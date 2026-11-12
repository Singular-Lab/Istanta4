// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type {
  DettaglioPromozioneVolantiniConsultazione,
  KitPromozioneConsultazione,
  PuntoVenditaPromozioneConsultazione,
} from "../../../lib/consultazione/tipi";

// Consultazione di una promozione (/volantini/promozioni/:idPromo): banda con le insegne, filtri per
// insegna e area, griglia delle miniature, assortimento e confronto fra i kit, senza la sezione
// "Dove arriva". Ogni kit apre i suoi insight; nessun collegamento alla produzione.

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

const coordinate = { lat: 43.84, lon: 10.5 };

const riga = (id: string, campi: Partial<PuntoVenditaPromozioneConsultazione>): PuntoVenditaPromozioneConsultazione => ({
  id,
  idKit: ["k1"],
  riga: `RIGA ${id}`,
  localita: null,
  indirizzo: null,
  regione: null,
  puntoVendita: null,
  ...campi,
});

const PUNTI_VENDITA: PuntoVenditaPromozioneConsultazione[] = [
  riga("r1", { localita: "Lucca", indirizzo: "Via Roma 1", regione: "TOS", puntoVendita: { id: "pv1", nome: "Conad Lucca", coordinate } }),
  riga("r2", { localita: "Pisa", indirizzo: "Via Mazzini 2", regione: "TOS" }),
  riga("r3", { localita: "Lucca", indirizzo: "Via Verdi 3", regione: "TOS", puntoVendita: { id: "pv2", nome: "Conad Lucca Verdi", coordinate: null } }),
  riga("r4", { idKit: ["k2"], localita: "Firenze", indirizzo: "Viale Europa 4", regione: "TOS", puntoVendita: { id: "pv3", nome: "Conad Firenze", coordinate } }),
  riga("r5", { idKit: ["k2"], riga: "SEDE - VIA SENZA NOME" }),
  riga("r6", { idKit: ["k3"], localita: "Roma", indirizzo: "Via Appia 6", regione: "LAZ", puntoVendita: { id: "pv4", nome: "Conad Roma", coordinate } }),
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
  puntiVendita: PUNTI_VENDITA,
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
    expect(titoli[titoli.indexOf("I volantini") + 1]).toBe("Comune o locale");
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

  it("con due volantini della stessa insegna e area la miniatura dice anche il titolo", async () => {
    finti.risultato = caricato(dettaglio({ kit: [kit("k1"), kit("k4", { titolo: "VOL_bis" })], numeroKitTotale: 2 }));
    await apri();

    const griglia = screen.getByRole("list", { name: "Copertine dei volantini" });
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana – VOL_bis" })).toBeInTheDocument();
    expect(within(griglia).getByText("VOL_k1")).toBeInTheDocument();
  });

  it("accanto alle insegne c'è il loro logo; senza logo, o se non si carica, il pallino colorato", async () => {
    finti.risultato = caricato(dettaglio({ loghiInsegne: { [CITY.id]: LOGO_CITY } }));
    await apri();

    const loghiCity = () => Array.from(document.querySelectorAll(`img[src="${LOGO_CITY}"]`));
    const griglia = screen.getByRole("list", { name: "Copertine dei volantini" });
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana" }).querySelector(`img[src="${LOGO_CITY}"]`)).not.toBeNull();
    // Superstore non ha logo: il pallino dell'insegna, nessuna immagine rotta
    const superstore = within(griglia).getByRole("link", { name: "Insight del volantino Superstore · Toscana" });
    expect(superstore.querySelectorAll("img")).toHaveLength(0);
    expect(superstore.querySelector("svg circle")).not.toBeNull();
    // Il logo anche nella banda, nel confronto e nell'elenco dei punti vendita
    expect(loghiCity().length).toBeGreaterThanOrEqual(5);
    expect(within(screen.getByRole("region", { name: "La promozione" })).getByRole("button", { name: "Solo i volantini dell'insegna City" }).querySelector("img")).not.toBeNull();

    // Un logo che non si carica diventa il pallino
    for (const logo of loghiCity()) fireEvent.error(logo);
    expect(loghiCity()).toHaveLength(0);
  });

  it("la tabella insegne × aree non c'è più: le miniature bastano", async () => {
    await apri();

    expect(screen.queryByRole("heading", { name: "I volantini della promozione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /Volantini per insegna e area/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "I volantini" })).toBeInTheDocument();
  });

  it("la sezione Dove arriva non c'è: niente regioni, insegne, località, elenco né mappa dei punti vendita", async () => {
    // Il server manda ancora le righe dei punti vendita: la pagina non le mostra
    finti.permessi = new Set(["gdo.visualizza"]);
    await apri();

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
    const stessaLista = [
      riga("arezzo", { idKit: ["em", "li"], localita: "AREZZO", indirizzo: "VIA CHIARINI 23/A", regione: "TOS" }),
      riga("barga", { idKit: ["em", "li"], localita: "BARGA", indirizzo: "VIA CANIPAIA", regione: "TOS" }),
    ];
    finti.risultato = caricato(dettaglio({
      kit: [kit("em", { area: EMILIA, numeroPuntiVendita: 2 }), kit("li", { area: LIGURIA, numeroPuntiVendita: 2 })],
      numeri: { ...dettaglio().numeri, kit: 2, puntiVendita: 2, localita: 2, regioni: 1 },
      puntiVendita: stessaLista,
    }));
    await apri();

    // Nel confronto ogni volantino ha i suoi 2 punti vendita
    // La seconda colonna del confronto sono i punti vendita del volantino
    const puntiVenditaDi = (riga: HTMLElement) => within(riga).getAllByRole("cell")[1]?.textContent;
    expect(righeDi(tabellaConfronto()).map(puntiVenditaDi)).toEqual(["2", "2"]);
    // Le righe stampate non diventano un elenco nella pagina
    expect(screen.queryByText("AREZZO")).not.toBeInTheDocument();
  });

  it("mostra l'assortimento: comune o locale, fasce di sconto, reparti, meccaniche e marche", async () => {
    await apri();

    expect(screen.getByText("In tutti i 3 volantini")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "40 prodotti in tutti i volantini, 120 in alcuni, 160 in uno solo" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Box per fascia di sconto: 0–10%: 5 box, 10–20%: 30 box/ })).toBeInTheDocument();
    expect(screen.getAllByText("Drogheria alimentare").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Meccaniche per insegna" })).toBeInTheDocument();
    const marche = screen.getByRole("table", { name: "Marche con più spazio" });
    expect(within(marche).getByText("Borgo Antico")).toBeInTheDocument();
    expect(within(marche).getByText("24%")).toBeInTheDocument();
  });

  it("con un solo volantino il comune o locale è una frase", async () => {
    finti.risultato = caricato(
      dettaglio({ kit: [KIT[0]], assortimento: { ...dettaglio().assortimento, prodotti: { inTutti: 0, inAlcuni: 0, inUnoSolo: 109 } } })
    );
    await apri();

    expect(screen.getByText("La promozione ha un solo volantino: tutti i suoi 109 prodotti sono lì.")).toBeInTheDocument();
  });

  it("la tabella di confronto si ordina cliccando le intestazioni, con aria-sort", async () => {
    await apri();

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
    const router = await apri();

    const [prima] = righeDi(tabellaConfronto());
    expect(within(prima).getByRole("link")).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k1");
    fireEvent.click(prima);

    expect(router.state.location.pathname).toBe("/volantini/tutti_i_volantini");
    expect(router.state.location.search).toBe("?kit=k1");
  });

  it.each(["Enter", " "])("una riga del confronto si apre da tastiera con %j", async tasto => {
    const router = await apri();

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
    finti.risultato = caricato(dettaglio({ kit: [], puntiVendita: [], numeroKitTotale: 3 }));
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
