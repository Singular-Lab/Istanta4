// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PeriodoConsultazione } from "../../../lib/consultazione/periodi";
import type {
  DettaglioPromozioneVolantiniConsultazione,
  KitPromozioneConsultazione,
  PuntoVenditaPromozioneConsultazione,
} from "../../../lib/consultazione/tipi";

// Consultazione di una promozione (/volantini/promozioni/:idPromo): banda con le copertine, numeri,
// griglia canali × aree, dove arriva (cartogramma, mappa, elenco), assortimento e confronto fra i kit.
// Ogni kit apre i suoi insight; nessun collegamento alla produzione.

const finti = vi.hoisted(() => ({
  risultato: {} as Record<string, unknown>,
  richieste: [] as unknown[],
  permessi: new Set<string>(),
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="mappa">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => <span data-testid="pallino" />,
  Popup: () => null,
  useMap: () => ({ fitBounds: () => undefined }),
}));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: unknown) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.has(codice) }));
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: () => Promise.resolve(undefined), getUrl: () => "" } }));
vi.mock("@/query/consultazione", () => ({
  useDettaglioPromozioneVolantini: (idPromo: string) => {
    finti.richieste.push(idPromo);
    return finti.risultato;
  },
}));

import PromozioneVolantini from ".";

const CITY = { id: "c1", nome: "City" };
const SUPERSTORE = { id: "c2", nome: "Superstore" };
const TOSCANA = { id: "a1", nome: "Toscana" };
const LAZIO = { id: "a2", nome: "Lazio" };
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
  idKit: "k1",
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
  riga("r4", { idKit: "k2", localita: "Firenze", indirizzo: "Viale Europa 4", regione: "TOS", puntoVendita: { id: "pv3", nome: "Conad Firenze", coordinate } }),
  riga("r5", { idKit: "k2", riga: "SEDE - VIA SENZA NOME" }),
  riga("r6", { idKit: "k3", localita: "Roma", indirizzo: "Via Appia 6", regione: "LAZ", puntoVendita: { id: "pv4", nome: "Conad Roma", coordinate } }),
];

const dettaglio = (campi: Partial<DettaglioPromozioneVolantiniConsultazione> = {}): DettaglioPromozioneVolantiniConsultazione => ({
  promo: { id: "p1", nome: "Volantino novembre", validitaDal: "2026-11-05", validitaAl: "2026-11-18" },
  periodo: "attivi",
  kit: KIT,
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

const tabellaElenco = () => screen.getByRole("table", { name: "Punti vendita stampati nei volantini della promozione" });
const tabellaConfronto = () => screen.getByRole("table", { name: "I volantini della promozione a confronto" });
const righeDi = (tabella: HTMLElement) => within(tabella).getAllByRole("row").slice(1);
const percorso = (link: HTMLElement) => link.getAttribute("href");

beforeEach(() => {
  finti.risultato = caricato(dettaglio());
  finti.richieste = [];
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

  it("mostra i numeri della promozione", async () => {
    await apri();

    const numeri = screen.getByLabelText("La promozione in numeri");
    expect(within(numeri).getByText("48 pagine in tutto")).toBeInTheDocument();
    expect(within(numeri).getByText("6")).toBeInTheDocument();
    expect(within(numeri).getByText("in 4 località, 2 regioni")).toBeInTheDocument();
    expect(within(numeri).getByText("320")).toBeInTheDocument();
    expect(within(numeri).getByText("495 referenze stampate")).toBeInTheDocument();
    expect(within(numeri).getByText("28%")).toBeInTheDocument();
    expect(within(numeri).getByText("box in sottocosto")).toBeInTheDocument();
  });

  it("ogni copertina del muro apre gli insight del suo kit; senza miniatura c'è il foglio segnaposto", async () => {
    await apri();

    const muro = screen.getByRole("list", { name: "Copertine dei volantini" });
    const copertine = within(muro).getAllByRole("link");
    expect(copertine).toHaveLength(3);
    expect(within(muro).getByRole("link", { name: "Insight del volantino City · Toscana" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k1"
    );
    expect(within(muro).getByRole("link", { name: "Insight del volantino Superstore · Toscana" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k2"
    );
    expect(muro.querySelector(`img[src="${ANTEPRIMA}"]`)).not.toBeNull();
    expect(within(muro).getByRole("link", { name: "Insight del volantino Superstore · Toscana" }).querySelector("img")).toBeNull();
  });

  it("la griglia ha una cella per canale e area, celle vuote senza volantino e i punti vendita sommati", async () => {
    await apri();

    const griglia = screen.getByRole("table", { name: "Volantini per insegna e area, con i punti vendita stampati" });
    expect(within(griglia).getAllByRole("columnheader").map(cella => cella.textContent)).toEqual(["Insegna", "Lazio", "Toscana", "Totale"]);
    expect(within(griglia).getByRole("link", { name: "Insight del volantino City · Toscana: 3 punti vendita, 109 referenze" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k1"
    );
    expect(within(griglia).getByRole("link", { name: "Insight del volantino Superstore · Toscana: 2 punti vendita, 266 referenze" })).toHaveAttribute(
      "href",
      "/volantini/tutti_i_volantini?kit=k2"
    );
    // Superstore non ha il volantino del Lazio
    expect(within(griglia).getAllByText("Nessun volantino")).toHaveLength(1);
    const [, city, superstore, totali] = within(griglia).getAllByRole("row");
    expect(within(city).getByText("4")).toBeInTheDocument();
    expect(within(superstore).getAllByText("2").length).toBeGreaterThan(0);
    expect(within(totali).getByText("1")).toBeInTheDocument();
    expect(within(totali).getByText("5")).toBeInTheDocument();
    expect(within(totali).getByText("6")).toBeInTheDocument();
  });

  it("il cartogramma conta i punti vendita per regione e quelli senza regione a parte", async () => {
    await apri();

    const regioni = screen.getByRole("group", { name: "Punti vendita per regione" });
    expect(within(regioni).getAllByRole("button")).toHaveLength(20);
    expect(within(regioni).getByRole("button", { name: "Toscana: 4 punti vendita" })).toHaveAttribute("aria-pressed", "false");
    expect(within(regioni).getByRole("button", { name: "Lazio: 1 punto vendita" })).toHaveAttribute("aria-pressed", "false");
    expect(within(regioni).getByRole("button", { name: "Lombardia: 0 punti vendita" })).toBeDisabled();
    expect(screen.getByText("1 riga ha la regione non indicata: non è nel cartogramma.")).toBeInTheDocument();
  });

  it("una regione filtra località, mappa ed elenco; di nuovo, o dal chip, il filtro si toglie", async () => {
    await apri();

    expect(screen.getByText("6 di 6 punti vendita")).toBeInTheDocument();
    expect(screen.getAllByTestId("pallino")).toHaveLength(3);
    expect(screen.getByText(/3 righe non sono sulla mappa/)).toBeInTheDocument();

    const lazio = screen.getByRole("button", { name: "Lazio: 1 punto vendita" });
    fireEvent.click(lazio);

    expect(lazio).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Località con più punti vendita in Lazio" })).toBeInTheDocument();
    expect(screen.getByText("Regione: Lazio")).toBeInTheDocument();
    expect(screen.getByText("1 di 1 punto vendita")).toBeInTheDocument();
    expect(within(tabellaElenco()).getByText("Roma")).toBeInTheDocument();
    expect(within(tabellaElenco()).queryByText("Lucca")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("pallino")).toHaveLength(1);
    expect(screen.queryByText(/non sono sulla mappa/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Togli il filtro sulla regione" }));

    expect(lazio).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Regione: Lazio")).not.toBeInTheDocument();
    expect(screen.getByText("6 di 6 punti vendita")).toBeInTheDocument();

    const toscana = screen.getByRole("button", { name: "Toscana: 4 punti vendita" });
    fireEvent.click(toscana);
    expect(screen.getByText("4 di 4 punti vendita")).toBeInTheDocument();
    fireEvent.click(toscana);
    expect(toscana).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("6 di 6 punti vendita")).toBeInTheDocument();
  });

  it("l'elenco si cerca per località e indirizzo e dice quali righe sono riconosciute", async () => {
    finti.permessi = new Set(["gdo.visualizza"]);
    await apri();

    const elenco = tabellaElenco();
    expect(within(elenco).getAllByText("Riconosciuto")).toHaveLength(4);
    expect(within(elenco).getAllByText("Solo nel volantino")).toHaveLength(2);
    expect(within(elenco).getByRole("link", { name: "Scheda del punto vendita Conad Lucca" })).toHaveAttribute("href", "/punti-vendita/pv1");
    // Senza località e indirizzo letti, la riga come è stampata
    expect(within(elenco).getByText("SEDE - VIA SENZA NOME")).toBeInTheDocument();
    expect(within(elenco).getByText("Regione non indicata")).toBeInTheDocument();

    const ricerca = screen.getByRole("searchbox", { name: "Cerca nei punti vendita per località o indirizzo" });
    fireEvent.change(ricerca, { target: { value: "mazzini" } });

    expect(await screen.findByText("1 di 1 punto vendita")).toBeInTheDocument();
    expect(within(tabellaElenco()).getByText("Pisa")).toBeInTheDocument();
    expect(within(tabellaElenco()).queryByText("Firenze")).not.toBeInTheDocument();

    fireEvent.change(ricerca, { target: { value: "LUCCA" } });
    expect(await screen.findByText("2 di 2 punti vendita")).toBeInTheDocument();

    fireEvent.change(ricerca, { target: { value: "nessuna via" } });
    expect(await screen.findByText("Nessun punto vendita con questa ricerca.")).toBeInTheDocument();
  });

  it("senza il permesso dei punti vendita i riconosciuti non portano alla scheda", async () => {
    await apri();

    expect(within(tabellaElenco()).getAllByText("Riconosciuto")).toHaveLength(4);
    expect(within(tabellaElenco()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(tabellaElenco()).getByText("Conad Lucca")).toBeInTheDocument();
  });

  it("l'elenco mostra 25 righe alla volta", async () => {
    const molte = Array.from({ length: 30 }, (_, i) => riga(`m${i}`, { localita: `Località ${i}`, regione: "TOS" }));
    finti.risultato = caricato(dettaglio({ puntiVendita: molte }));
    await apri();

    expect(righeDi(tabellaElenco())).toHaveLength(25);
    expect(screen.getByText("25 di 30 punti vendita")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostra altri 5" }));

    expect(righeDi(tabellaElenco())).toHaveLength(30);
    expect(screen.queryByRole("button", { name: /Mostra altri/ })).not.toBeInTheDocument();
  });

  it("senza righe dei punti vendita lo dice, invece di grafici vuoti", async () => {
    finti.risultato = caricato(dettaglio({ puntiVendita: [] }));
    await apri();

    expect(screen.getByText("Nessun punto vendita nei volantini")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Punti vendita per regione" })).not.toBeInTheDocument();
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
