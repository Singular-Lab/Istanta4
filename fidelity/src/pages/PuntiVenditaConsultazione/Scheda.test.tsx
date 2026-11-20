// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATO_PROMO } from "../../../lib/enums";
import type { AnalisiPuntoVendita, DettaglioVolantinoPv, EdizioneTimeline, PeriodoAnalisi } from "../../../lib/puntiVendita/analisi";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";
import type { PaginaVolantiniStoria, StoriaPuntoVendita, VolantinoNellaStoria } from "../../../lib/puntiVendita/storia";

// Scheda di consultazione del punto vendita (/punti-vendita/:id), costruita sulla timeline dei
// volantini: un periodo per tutta la scheda, numeri, storia con insegna, volantini e assenze, il volantino scelto,
// infografiche del periodo, cambiamenti, volantini attivi, tutti i volantini, dati e mappa

const finti = vi.hoisted(() => ({
  permessi: new Set<string>(),
  pv: {} as Record<string, unknown>,
  volantiniAttivi: {} as Record<string, unknown>,
  storia: {} as Record<string, unknown>,
  volantiniStoria: {} as Record<string, unknown>,
  analisi: {} as Record<string, unknown>,
  dettaglio: (_idKit: string) => ({}) as Record<string, unknown>,
  richiesteVolantiniStoria: [] as Array<[string, number, number]>,
  richiesteVolantino: [] as string[],
  richiesteAnalisi: [] as Array<PeriodoAnalisi | null>,
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="mappa" />,
  TileLayer: () => null,
  CircleMarker: () => null,
}));
vi.mock("@/components/SessionChecker", () => ({ default: <P extends object>(Componente: ComponentType<P>) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.has(codice) }));
vi.mock("@/components/PreviewImmaginePdf", () => ({
  PreviewImmaginePdf: ({ imageUrl }: { imageUrl: string }) => <div role="dialog" aria-label="Anteprima del PDF">{imageUrl}</div>,
}));
// L'import della storia è della gestione (con le sue chiamate al server): qui basta sapere che si apre
vi.mock("../PuntiVendita/ImportStoricoVolantini", () => ({
  ImportStoricoVolantini: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Importa la storia dai volantini">
      <button type="button" onClick={onClose}>
        Chiudi
      </button>
    </div>
  ),
}));
vi.mock("@/query/query", () => ({
  useFetchPuntoVenditaConsultazione: () => finti.pv,
  useFetchVolantiniAttiviPuntoVendita: () => finti.volantiniAttivi,
  useFetchStoriaPuntoVendita: () => finti.storia,
  useFetchVolantiniStoriaPuntoVendita: (idPv: string, pagina: number, dimensione: number) => {
    finti.richiesteVolantiniStoria.push([idPv, pagina, dimensione]);
    return finti.volantiniStoria;
  },
  useFetchAnalisiPuntoVendita: (_idPv: string, periodo: PeriodoAnalisi | null) => {
    finti.richiesteAnalisi.push(periodo);
    return finti.analisi;
  },
  useFetchVolantinoPuntoVendita: (_idPv: string, idKit: string) => {
    finti.richiesteVolantino.push(idKit);
    return finti.dettaglio(idKit);
  },
  useFetchReteInsegne: () => ({ data: { anni: [], insegne: [] } }),
}));

import SchedaPuntoVendita from "./Scheda";

const PUNTO_VENDITA: PuntoVenditaConsultazione = {
  id: "pv1",
  nome: "Conad Lucca",
  ragioneSociale: "Conad Lucca Srl",
  indirizzo: "Via Roma 1",
  cap: "55100",
  citta: "Lucca",
  provincia: "LU",
  regione: "Toscana",
  telefono: "0583 123456",
  canale: { id: "c1", nome: "Conad City", codice: "CC" },
  area: { id: "a1", nome: "Toscana", codice: "TO" },
  meta: { id_anacan: "004512" },
  coordinate: { lat: 43.84, lon: 10.5 },
};

const STORIA: StoriaPuntoVendita = {
  idPuntoVendita: "pv1",
  sintesi: {
    primoVolantino: "2019-03-01",
    ultimoVolantino: "2026-10-20",
    numeroVolantini: 120,
    insegne: [{ id: "c1", nome: "Conad City" }, { id: "c2", nome: "Conad Superstore" }],
  },
  anni: [
    { anno: 2022, volantini: 20, insegne: [{ canale: { id: "c1", nome: "Conad City" }, area: { id: "a1", nome: "Toscana" }, volantini: 20 }] },
    { anno: 2023, volantini: 18, insegne: [{ canale: { id: "c2", nome: "Conad Superstore" }, area: { id: "a1", nome: "Toscana" }, volantini: 18 }] },
  ],
  insegne: [
    { canale: { id: "c1", nome: "Conad City" }, area: { id: "a1", nome: "Toscana" }, dal: "2019-03-01", al: "2022-12-20", volantini: 80 },
    { canale: { id: "c2", nome: "Conad Superstore" }, area: { id: "a1", nome: "Toscana" }, dal: "2023-01-10", al: "2026-10-20", volantini: 40 },
  ],
  recapiti: [
    { localita: "Lucca", indirizzo: "Via Roma 1", telefono: "0583 123456", dal: "2021-01-01", al: "2026-10-20", volantini: 70, diversoDallAttuale: false },
    { localita: "Lucca", indirizzo: "Via Vecchia 3", telefono: "0583 000000", dal: "2019-03-01", al: "2020-12-20", volantini: 50, diversoDallAttuale: true },
  ],
  eventi: [
    { tipo: "cambio_insegna", data: "2023-01-10", da: { id: "c1", nome: "Conad City" }, a: { id: "c2", nome: "Conad Superstore" } },
    { tipo: "cambio_indirizzo", data: "2021-01-01", da: "Via Vecchia 3", a: "Via Roma 1" },
  ],
  // Di solito una sola combinazione: la striscia delle insegne non compare
  insegneNelTempo: [
    { canale: { id: "c1", nome: "Conad City" }, area: { id: "a1", nome: "Toscana" }, dal: "2019-03-01", al: "2026-10-20", volantini: 120 },
  ],
};

const volantino = (dati: Partial<VolantinoNellaStoria>): VolantinoNellaStoria => ({
  idKit: "k1",
  titoloKit: "Volantino Toscana",
  promo: { id: "p1", nome: "Promo ottobre", stato: STATO_PROMO.ARCHIVIATA, validitaDal: "2026-10-01", validitaAl: "2026-10-20" },
  canale: { id: "c2", nome: "Conad Superstore" },
  area: { id: "a1", nome: "Toscana" },
  rigaStampata: "LUCCA - Via Roma 1 - tel. 0583 123456",
  localita: "LUCCA",
  indirizzo: "Via Roma 1",
  telefono: "0583 123456",
  abbinamento: "telefono",
  numeroReferenze: 120,
  pdf: { idFile: "f1", idOlimpoCloud: "olimpo-1", nome: "Volantino ottobre", pagine: 8 },
  ...dati,
});

const PAGINA: PaginaVolantiniStoria = {
  volantini: [
    volantino({}),
    volantino({ idKit: "k2", promo: { id: "p2", nome: "Promo settembre", stato: STATO_PROMO.ARCHIVIATA, validitaDal: null, validitaAl: null }, abbinamento: "probabile", numeroReferenze: null, pdf: null }),
  ],
  totale: 30,
  pagina: 1,
  dimensione: 10,
};

const CITY = { id: "c1", nome: "Conad City" };
const SUPERSTORE = { id: "c2", nome: "Conad Superstore" };
const COPERTURA = { conCodice: 90, conReparto: 35, conPrezzo: 95, conMarca: 80 };

const edizione = (idKit: string, dal: string, al: string, canale: typeof CITY, dati: Partial<EdizioneTimeline> = {}): EdizioneTimeline => ({
  idKit,
  dal,
  al,
  promo: { id: `p-${idKit}`, nome: `Promo ${idKit}` },
  canale,
  area: { id: "a1", nome: "Toscana" },
  numeroReferenze: 120,
  attivo: false,
  pagine: 24,
  scontoMedio: null,
  referenzeConSconto: 0,
  meccaniche: [],
  reparti: [],
  ...dati,
});

const ANALISI: AnalisiPuntoVendita = {
  idPuntoVendita: "pv1",
  periodo: null,
  numeri: {
    volantini: 3,
    volantiniAttivi: 1,
    referenze: 398,
    mediaReferenze: 132.7,
    prodotti: 250,
    prodottiFrequenti: 12,
    scontoMedio: 24.3,
    insegne: [CITY, SUPERSTORE],
  },
  timeline: [
    edizione("k1", "2025-03-03", "2025-03-16", CITY, {
      numeroReferenze: 110,
      scontoMedio: 18.5,
      referenzeConSconto: 40,
      meccaniche: [{ meccanica: "sconto", referenze: 50 }, { meccanica: "fidelity", referenze: 10 }],
      reparti: [{ reparto: "Freschi", spazio: 300 }, { reparto: "Drogheria", spazio: 200 }],
    }),
    edizione("k2", "2025-10-06", "2025-10-19", SUPERSTORE, {
      numeroReferenze: 140,
      scontoMedio: 22,
      referenzeConSconto: 60,
      meccaniche: [{ meccanica: "sconto", referenze: 40 }, { meccanica: "fidelity", referenze: 20 }],
      reparti: [{ reparto: "Drogheria", spazio: 300 }, { reparto: "Freschi", spazio: 200 }],
    }),
    edizione("k3", "2026-10-23", "2026-11-05", SUPERSTORE, {
      numeroReferenze: 148,
      attivo: true,
      scontoMedio: 29.3,
      referenzeConSconto: 74,
      meccaniche: [{ meccanica: "sconto", referenze: 37 }, { meccanica: "fidelity", referenze: 21 }],
      reparti: [{ reparto: "Freschi", spazio: 600 }, { reparto: "Drogheria", spazio: 400 }],
    }),
  ],
  assenze: [{ idKit: "a1", dal: "2025-06-02", al: "2025-06-15", promo: { id: "pa1", nome: "Promo assente" } }],
  anni: [2025, 2026],
  marche: [{ marca: "Barilla", quota: 3.2, volantini: 3, linea: null }, { marca: "Granarolo", quota: 2.5, volantini: 1, linea: null }],
  lineeDistributore: null,
  prodottiRicorrenti: [
    {
      chiave: "mozzarella-granarolo",
      nome: "Mozzarella Alta Qualità",
      marca: "Granarolo",
      formato: "3 × 100 g",
      foto: null,
      volantini: 2,
      kit: ["k1", "k3"],
      prezzoMinimo: 1.49,
      prezzoMassimo: 1.99,
      prezzoUltimo: 1.79,
    },
  ],
  copertura: COPERTURA,
};

const dettaglio = (idKit: string): DettaglioVolantinoPv => ({
  kit: { id: idKit, titolo: `VOL ${idKit}` },
  promo: { id: `p-${idKit}`, nome: `Promo ${idKit}`, stato: STATO_PROMO.ARCHIVIATA, validitaDal: null, validitaAl: null },
  canale: SUPERSTORE,
  area: { id: "a1", nome: "Toscana" },
  pdf: { idFile: "f1", idOlimpoCloud: `olimpo-${idKit}`, nome: "Volantino", pagine: 24 },
  numeri: {
    pagine: 24,
    referenze: 148,
    daListino: 132,
    manuali: 16,
    scontoMedio: 31.2,
    scontoMedioPrecedente: 28.8,
    fidelity: 38,
    puntiVenditaInLista: 212,
    puntiVenditaAbbinati: 209,
  },
  pagine: [],
  meccaniche: [],
  rigaPuntoVendita: { riga: `LUCCA - Via Roma 1 - tel. 0583 123456 (${idKit})`, abbinamento: "telefono", regione: "Toscana", provincia: "LU", vicine: [] },
  precedente: null,
  successivo: null,
  copertura: COPERTURA,
});

const caricato = <T,>(data: T) => ({ data, isLoading: false, isError: false, isPlaceholderData: false, refetch: vi.fn() });

const apri = (percorso = "/punti-vendita/pv1") =>
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route path="/punti-vendita/:id" element={<SchedaPuntoVendita />} />
        <Route path="/punti-vendita" element={<div>Elenco dei punti vendita</div>} />
      </Routes>
    </MemoryRouter>
  );

const sezione = (titolo: string) => screen.getByRole("region", { name: titolo });

describe("Scheda del punto vendita", () => {
  beforeEach(() => {
    finti.permessi = new Set(["gdo.visualizza", "materiali.visualizza"]);
    finti.pv = caricato(PUNTO_VENDITA);
    finti.volantiniAttivi = caricato([
      {
        id_kit: "k-attivo",
        promo: { id: "p-attiva", nome: "Promo novembre", validita_dal: "2026-11-01", validita_al: "2026-11-15" },
        files: [{ id: "f1", nome: "VOL.pdf", url: "/olimpo/anteprima", url_download: "/olimpo/pdf", nome_download: "VOL.pdf" }],
      },
    ]);
    finti.storia = caricato(STORIA);
    finti.volantiniStoria = caricato(PAGINA);
    finti.analisi = caricato(ANALISI);
    finti.dettaglio = idKit => caricato(dettaglio(idKit));
    finti.richiesteVolantiniStoria = [];
    finti.richiesteVolantino = [];
    finti.richiesteAnalisi = [];
  });

  it("intestazione con nome, insegna e area, e ritorno all'elenco", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Conad Lucca" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Torna ai punti vendita" })).toHaveAttribute("href", "/punti-vendita");
    const intestazione = screen.getByRole("heading", { level: 1 }).parentElement!;
    expect(intestazione).toHaveTextContent("Conad City");
    expect(intestazione).toHaveTextContent("Toscana");
  });

  it("intestazione: indirizzo e codice GDO; \"Dati e mappa\" porta ai dati in fondo alla scheda", () => {
    apri();

    const testata = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
    expect(testata).toHaveTextContent("Via Roma 1 · 55100 Lucca (LU)");
    expect(testata).toHaveTextContent("ID ANACAN 004512");
    expect(screen.getByRole("link", { name: "Dati e mappa" })).toHaveAttribute("href", "#dati-e-mappa");
    expect(sezione("Dati").parentElement).toHaveAttribute("id", "dati-e-mappa");
  });

  it("Numeri: volantini con le assenze, giorni coperti, referenze, sconto e prodotti di tutta la storia", () => {
    apri();

    const numeri = screen.getByLabelText("Il punto vendita in numeri");
    expect(numeri).toHaveTextContent("volantini dal marzo 2025");
    expect(numeri).toHaveTextContent("1 attivo adesso");
    expect(numeri).toHaveTextContent("assente da 1 su 4 della sua insegna e area");
    expect(numeri).toHaveTextContent("dei giorni con un volantino valido");
    const cella = (etichetta: string) => within(numeri).getByText(etichetta).parentElement!;
    expect(cella("referenze per volantino")).toHaveTextContent("133");
    expect(cella("referenze per volantino")).toHaveTextContent("398 in tutto");
    // Sconto pesato sulle referenze col prezzo barrato di ogni volantino
    expect(numeri).toHaveTextContent("24,3%");
    expect(cella("prodotti diversi")).toHaveTextContent("250");
    expect(cella("prodotti diversi")).toHaveTextContent("12 presenti in più di 10 volantini");
    // Tutta la storia non ha un periodo prima con cui confrontarsi
    expect(numeri).not.toHaveTextContent("rispetto");
    expect(finti.richiesteAnalisi.at(-1)).toBeNull();
  });

  it("Numeri di un anno: confronto con l'anno prima e richiesta del periodo al server", () => {
    apri("/punti-vendita/pv1?anno=2026");

    const numeri = screen.getByLabelText("Il punto vendita in numeri");
    expect(numeri).toHaveTextContent("volantini nel 2026");
    expect(numeri).toHaveTextContent("+23 rispetto al 2025");
    expect(numeri).toHaveTextContent("+8,7 punti rispetto al 2025");
    // Nel 2026 il punto vendita non manca da nessun volantino della sua insegna e area
    expect(numeri).not.toHaveTextContent("assente");
    expect(finti.richiesteAnalisi.at(-1)).toEqual({ dal: "2026-01-01", al: "2026-12-31" });
  });

  it("Numeri e riquadri in caricamento: gli scheletri", () => {
    finti.analisi = { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    apri();

    expect(screen.getByRole("status", { name: "Caricamento: Il punto vendita in numeri" })).toBeInTheDocument();
    expect(within(sezione("Storia")).getByRole("status")).toBeInTheDocument();
    expect(within(sezione("Spazio per reparto")).getByRole("status")).toBeInTheDocument();
  });

  it("Dati: anagrafica completa e codici GDO", () => {
    apri();

    const dati = sezione("Dati");
    expect(dati).toHaveTextContent("Conad Lucca Srl");
    expect(dati).toHaveTextContent("Via Roma 1");
    expect(dati).toHaveTextContent("55100 Lucca (LU), Toscana");
    expect(within(dati).getByRole("link", { name: "0583 123456" })).toHaveAttribute("href", "tel:0583 123456");
    // Insegna e area per nome: "Toscana (TO)" sembrerebbe la provincia di Torino
    expect(dati).toHaveTextContent("Conad City");
    expect(dati).not.toHaveTextContent("(CC)");
    expect(dati).not.toHaveTextContent("(TO)");
    const sistemaGdo = within(dati).getByRole("heading", { name: "Dal sistema della GDO" }).parentElement!;
    expect(sistemaGdo).toHaveTextContent("ID ANACAN");
    expect(sistemaGdo).toHaveTextContent("004512");
  });

  it("Dati: i campi del sistema della GDO che non sono identificativi si leggono come parole", () => {
    finti.pv = caricato({ ...PUNTO_VENDITA, meta: { id_anacan: "004512", insegna: "CONAD City" } });
    apri();

    const sistemaGdo = within(sezione("Dati")).getByRole("heading", { name: "Dal sistema della GDO" }).parentElement!;
    expect(within(sistemaGdo).getByText("Insegna")).toBeInTheDocument();
    expect(within(sistemaGdo).getByText("ID ANACAN")).toBeInTheDocument();
    expect(sistemaGdo).toHaveTextContent("CONAD City");
  });

  it("nome, indirizzo e città in maiuscolo si leggono come parole; il dato e le righe stampate no", () => {
    finti.pv = caricato({
      ...PUNTO_VENDITA,
      nome: "BARGA VIA CANIPAIA SNC",
      ragioneSociale: "BARGA MARKET SRL",
      indirizzo: "VIA CANIPAIA",
      cap: "55051",
      citta: "BARGA",
    });
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Barga Via Canipaia snc" })).toBeInTheDocument();
    const testata = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
    expect(testata).toHaveTextContent("Via Canipaia · 55051 Barga (LU)");
    const dati = sezione("Dati");
    expect(dati).toHaveTextContent("Barga Market srl");
    expect(dati).toHaveTextContent("55051 Barga (LU), Toscana");
    // La riga stampata resta com'era nel volantino
    const voci = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    expect(voci[0]).toHaveTextContent("LUCCA - Via Roma 1 - tel. 0583 123456");
  });

  it("Dati: senza ragione sociale e telefono niente righe vuote né segnaposto", () => {
    finti.pv = caricato({ ...PUNTO_VENDITA, ragioneSociale: null, telefono: null, regione: null, meta: {} });
    apri();

    const dati = sezione("Dati");
    expect(dati).not.toHaveTextContent("Ragione sociale");
    expect(dati).not.toHaveTextContent("Telefono");
    expect(dati).not.toHaveTextContent(/Non specificat|Non disponibile|N\/D|Località non impostata/);
    expect(dati).toHaveTextContent("55100 Lucca (LU)");
  });

  it("Mappa: con le coordinate la mappa, senza l'avviso", () => {
    apri();
    expect(within(sezione("Mappa")).getByTestId("mappa")).toBeInTheDocument();
  });

  it("Mappa: senza coordinate \"Coordinate non disponibili\"", () => {
    finti.pv = caricato({ ...PUNTO_VENDITA, coordinate: null });
    apri();

    expect(within(sezione("Mappa")).queryByTestId("mappa")).not.toBeInTheDocument();
    expect(sezione("Mappa")).toHaveTextContent("Coordinate non disponibili");
  });

  it("\"Gestisci\" porta alla gestione solo con il permesso di gestire i punti vendita", () => {
    apri();
    expect(screen.queryByRole("link", { name: /Gestisci/ })).not.toBeInTheDocument();
  });

  it("con il permesso di gestione \"Gestisci\" apre il dettaglio della gestione interna", () => {
    finti.permessi = new Set(["gdo.visualizza", "gdo.gestisci_punti_vendita"]);
    apri();

    expect(screen.getByRole("link", { name: /Gestisci/ })).toHaveAttribute("href", "/gestione-interna/punti-vendita/pv1");
  });

  it("Volantini attivi: sotto i numeri e prima della Storia", () => {
    apri();

    const attivi = sezione("Volantini attivi");
    const numeri = screen.getByLabelText("Il punto vendita in numeri");
    expect(numeri.compareDocumentPosition(attivi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(attivi.compareDocumentPosition(sezione("Storia")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Volantini attivi: senza volantini una riga con insegna e area", () => {
    finti.volantiniAttivi = caricato([]);
    apri();

    const attivi = sezione("Volantini attivi");
    expect(attivi).toHaveTextContent("Nessun volantino attivo per Conad City · Toscana.");
    expect(within(attivi).queryByRole("heading")).not.toBeInTheDocument();
  });

  it("Storia: una descrizione breve e la guida della timeline chiusa in \"Come si legge\"", () => {
    apri();

    const storia = sezione("Storia");
    expect(storia).toHaveTextContent("Scegli un volantino per vederlo qui sotto.");
    // Il <details> si apre da sé al clic sul riassunto: qui basta che la guida ci sia, chiusa
    const guida = within(storia).getByText("Come si legge").closest("details")!;
    expect(guida).not.toHaveAttribute("open");
    expect(guida).toHaveTextContent("Ogni barra è un volantino in cui compare");
  });

  it("Volantini attivi: i PDF delle promo valide del canale e dell'area", () => {
    apri();

    const volantini = sezione("Volantini attivi");
    expect(volantini).toHaveTextContent("Conad City · Toscana");
    expect(within(volantini).getByRole("heading", { name: "Promo novembre" })).toBeInTheDocument();
    expect(within(volantini).getByRole("link", { name: /PDF/ })).toHaveAttribute("href", "/olimpo/pdf");
  });

  it("Storia: una barra per volantino; senza scelta il più recente, con la sua scheda di sola insegna e validità", () => {
    apri();

    const storia = sezione("Storia");
    expect(storia).toHaveTextContent("Nei volantini dal marzo 2019 all'ottobre 2026.");
    expect(storia).toHaveTextContent("Ogni barra è un volantino in cui compare, dal primo all'ultimo giorno di validità");
    expect(within(storia).getAllByRole("option")).toHaveLength(3);
    expect(within(storia).getByRole("option", { name: /Promo k3/ })).toHaveAttribute("aria-selected", "true");
    const scelto = within(storia).getByRole("region", { name: "Volantino selezionato" });
    expect(scelto).toHaveTextContent("Promo k3");
    expect(scelto).toHaveTextContent("23 ottobre – 5 novembre 2026");
    expect(scelto).toHaveTextContent("attivo");
    // Nella Storia solo insegna e volantini (richiesta del 2026-11-19): niente numeri né riga stampata
    expect(scelto).not.toHaveTextContent("referenze");
    expect(scelto).not.toHaveTextContent("sconto medio");
    expect(scelto).not.toHaveTextContent("pagine");
    expect(scelto).not.toHaveTextContent("punti vendita nella lista");
    expect(within(scelto).queryByRole("img", { name: /Meccaniche/ })).not.toBeInTheDocument();
    expect(within(scelto).queryByRole("list", { name: "Reparti con più spazio" })).not.toBeInTheDocument();
    expect(scelto).not.toHaveTextContent("LUCCA - Via Roma 1 - tel. 0583 123456 (k3)");
    expect(within(scelto).getByRole("link", { name: "Apri volantino" })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k3");
    expect(within(scelto).getByRole("button", { name: "Volantino successivo" })).toBeDisabled();
  });

  it("Storia: in legenda insegne e assenze, niente eventi né meccaniche", () => {
    apri();

    const storia = sezione("Storia");
    const voci = within(within(storia).getByRole("list", { name: "Legenda" })).getAllByRole("listitem").map(v => v.textContent);
    for (const voce of ["Conad City", "Conad Superstore"]) expect(voci).toContain(voce);
    expect(voci.some(v => v?.includes("senza il punto vendita"))).toBe(true);
    expect(voci).not.toContain("indirizzo cambiato");
    expect(within(storia).queryByRole("list", { name: "Meccaniche" })).not.toBeInTheDocument();
  });

  it("Storia: sotto la timeline niente corsie di referenze, sconto, meccaniche e indirizzo stampato", () => {
    apri();

    const timeline = within(sezione("Storia")).getByRole("group", { name: /Timeline/ });
    expect(within(timeline).queryByText(/^Referenze/)).not.toBeInTheDocument();
    expect(within(timeline).queryByText(/^Sconto medio/)).not.toBeInTheDocument();
    expect(within(timeline).queryByText(/^Meccaniche/)).not.toBeInTheDocument();
    expect(within(timeline).queryByText(/^Indirizzo stampato/)).not.toBeInTheDocument();
  });

  it("Storia: quando non c'era, con i volantini della sua insegna e area senza il punto vendita, apribili", () => {
    apri();

    const assenze = within(sezione("Storia")).getByRole("region", { name: "Quando non c'era" });
    expect(assenze).toHaveTextContent("Manca da 1 volantino su 4 della sua insegna e area");
    expect(assenze).toHaveTextContent("Promo assente");
    expect(assenze).toHaveTextContent("2 – 15 giugno 2025");
    expect(within(assenze).getByRole("link", { name: "Apri il volantino Promo assente" })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=a1");
  });

  it("Storia: in un periodo senza assenze l'elenco di quando non c'era non compare", () => {
    apri("/punti-vendita/pv1?anno=2026");

    expect(within(sezione("Storia")).queryByRole("region", { name: "Quando non c'era" })).not.toBeInTheDocument();
  });

  it("Periodo: dal primo anno a oggi, per tutta la scheda, con la linea di oggi sul calendario", () => {
    apri();

    expect(screen.getAllByRole("radio").map(r => r.textContent)).toEqual(["Dal 2025", "2026", "2025", "Ultimi 12 mesi", "Ultimi 3 mesi"]);
    expect(screen.getByRole("radio", { name: "Dal 2025" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Il periodo vale per timeline, numeri e grafici.")).not.toBeInTheDocument();
    const timeline = within(sezione("Storia")).getByRole("group", { name: /Timeline/ });
    expect(within(timeline).getByText("oggi")).toBeInTheDocument();
  });

  it("Storia: nello zoom su un anno l'asse va per mesi del calendario e ci sono solo i volantini dell'anno", () => {
    apri("/punti-vendita/pv1?anno=2026");

    const timeline = within(sezione("Storia")).getByRole("group", { name: /Timeline/ });
    expect(within(timeline).getByText(/^ott( 2026)?$/)).toBeInTheDocument();
    expect(within(sezione("Storia")).getAllByRole("option")).toHaveLength(1);
  });

  it("Storia: gli ultimi 3 mesi, dall'indirizzo, mostrano i volantini recenti con le settimane e la linea di oggi", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 12));
    try {
      apri("/punti-vendita/pv1?anno=ultimi3mesi&volantino=k1");

      const storia = sezione("Storia");
      expect(screen.getByRole("radio", { name: "Ultimi 3 mesi" })).toHaveAttribute("aria-checked", "true");
      expect(finti.richiesteAnalisi.at(-1)).toEqual({ dal: "2026-08-10", al: null });
      // Il volantino di marzo 2025 non è nel periodo: si sceglie il più recente
      expect(within(storia).getAllByRole("option")).toHaveLength(1);
      expect(within(storia).getByRole("option", { name: /Promo k3/ })).toHaveAttribute("aria-selected", "true");
      const timeline = within(storia).getByRole("group", { name: /Timeline/ });
      expect(within(timeline).getByText("ago 2026")).toBeInTheDocument();
      expect(within(timeline).getByText("ott 2026")).toBeInTheDocument();
      // Lunedì 12 ottobre 2026
      expect(within(timeline).getByText("12")).toBeInTheDocument();
      expect(within(timeline).getByText("oggi")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: "Dal 2025" }));
      expect(within(storia).getAllByRole("option")).toHaveLength(3);
      expect(finti.richiesteAnalisi.at(-1)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Storia: senza volantini negli ultimi 3 mesi lo dice, e il calendario resta", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2027, 5, 1, 12));
    try {
      apri("/punti-vendita/pv1?anno=ultimi3mesi");

      const storia = sezione("Storia");
      expect(within(storia).queryAllByRole("option")).toHaveLength(0);
      expect(storia).toHaveTextContent("Nessun volantino negli ultimi 3 mesi");
      expect(within(within(storia).getByRole("group", { name: /Timeline/ })).getByText("oggi")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Storia: scegliendo un volantino nella timeline la scheda lo mostra; precedente e successivo scorrono", async () => {
    apri();

    const storia = sezione("Storia");
    fireEvent.click(within(storia).getByRole("option", { name: /Promo k1/ }));
    expect(within(storia).getByRole("option", { name: /Promo k1/ })).toHaveAttribute("aria-selected", "true");
    expect(within(storia).getByRole("region", { name: "Volantino selezionato" })).toHaveTextContent("Promo k1");
    expect(finti.richiesteVolantino).toContain("k1");
    expect(within(storia).getByRole("button", { name: "Volantino precedente" })).toBeDisabled();

    await userEvent.click(within(storia).getByRole("button", { name: "Volantino successivo" }));

    expect(within(storia).getByRole("region", { name: "Volantino selezionato" })).toHaveTextContent("Promo k2");
  });

  it("Storia: il volantino scelto arriva dall'indirizzo, come tornando dal volantino", () => {
    apri("/punti-vendita/pv1?volantino=k2");

    expect(within(sezione("Storia")).getByRole("region", { name: "Volantino selezionato" })).toHaveTextContent("Promo k2");
  });

  it("Storia: il periodo di un anno mostra solo i suoi volantini e sceglie il più recente dell'anno", async () => {
    apri("/punti-vendita/pv1?volantino=k3");

    const storia = sezione("Storia");
    await userEvent.click(screen.getByRole("radio", { name: "2025" }));

    expect(within(storia).getAllByRole("option")).toHaveLength(2);
    expect(finti.richiesteAnalisi.at(-1)).toEqual({ dal: "2025-01-01", al: "2025-12-31" });
    expect(within(storia).getByRole("option", { name: /Promo k2/ })).toHaveAttribute("aria-selected", "true");
    expect(within(storia).getByRole("region", { name: "Volantino selezionato" })).toHaveTextContent("Promo k2");
  });

  it("Storia: senza volantini importati lo dice, senza chiedere l'elenco dei volantini", () => {
    finti.analisi = caricato({ ...ANALISI, timeline: [], anni: [] });
    finti.storia = caricato({ ...STORIA, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] });
    apri();

    expect(sezione("Storia")).toHaveTextContent("Non compare in nessun volantino importato");
    expect(screen.queryByRole("region", { name: "Tutti i volantini" })).not.toBeInTheDocument();
    expect(finti.richiesteVolantiniStoria).toEqual([]);
  });

  it("senza storia un riquadro solo la spiega: niente numeri a zero né un riquadro vuoto per grafico", () => {
    finti.analisi = caricato({
      ...ANALISI,
      numeri: { ...ANALISI.numeri, volantini: 0, volantiniAttivi: 0, referenze: 0, prodotti: 0, prodottiFrequenti: 0, scontoMedio: null, insegne: [] },
      timeline: [],
      assenze: [],
      anni: [],
      marche: [],
      prodottiRicorrenti: [],
    });
    finti.storia = caricato({ ...STORIA, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] });
    apri();

    const storia = sezione("Storia");
    expect(storia).toHaveTextContent("Arriva quando il Plugin InDesign invia i volantini o quando si importano i loro export JSON");
    // La guida alla lettura della timeline non serve senza timeline
    expect(storia).not.toHaveTextContent("Ogni barra è un volantino");
    expect(screen.queryByLabelText("Il punto vendita in numeri")).not.toBeInTheDocument();
    // Senza volantini non c'è un periodo da scegliere
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    for (const titolo of ["Come si promuove", "Spazio per reparto", "Marche più presenti", "Stagionalità dei reparti", "Prodotti che tornano", "Cambiamenti"]) {
      expect(screen.queryByRole("region", { name: titolo })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("complementary", { name: "Grafici senza dati" })).not.toBeInTheDocument();
    // Restano i volantini attivi, i dati e la mappa
    expect(sezione("Volantini attivi")).toBeInTheDocument();
    expect(sezione("Dati")).toBeInTheDocument();
    expect(sezione("Mappa")).toBeInTheDocument();
    // Solo chi gestisce i punti vendita può importare: per gli altri il testo dice chi può farlo
    expect(within(storia).queryByRole("button", { name: /Importa/ })).not.toBeInTheDocument();
    expect(storia).toHaveTextContent("può farlo chi gestisce i punti vendita");
  });

  it("senza storia, a chi gestisce i punti vendita la storia offre l'import degli export dei volantini", async () => {
    finti.permessi = new Set(["gdo.visualizza", "gdo.gestisci_punti_vendita"]);
    finti.analisi = caricato({ ...ANALISI, timeline: [], anni: [] });
    finti.storia = caricato({ ...STORIA, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] });
    apri();

    expect(screen.queryByRole("dialog", { name: "Importa la storia dai volantini" })).not.toBeInTheDocument();
    await userEvent.click(within(sezione("Storia")).getByRole("button", { name: "Importa la storia dai volantini" }));
    expect(screen.getByRole("dialog", { name: "Importa la storia dai volantini" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(screen.queryByRole("dialog", { name: "Importa la storia dai volantini" })).not.toBeInTheDocument();
  });

  it("Numeri: lo sconto che non si può calcolare non ha la sua cella, niente N/D", () => {
    finti.analisi = caricato({
      ...ANALISI,
      numeri: { ...ANALISI.numeri, scontoMedio: null, prodottiFrequenti: 0 },
      timeline: ANALISI.timeline.map(e => ({ ...e, scontoMedio: null, referenzeConSconto: 0 })),
    });
    apri();

    const numeri = screen.getByLabelText("Il punto vendita in numeri");
    expect(numeri).not.toHaveTextContent("sconto medio");
    expect(numeri).not.toHaveTextContent("N/D");
    expect(numeri).not.toHaveTextContent("presenti in più di 10 volantini");
    expect(numeri).toHaveTextContent("prodotti diversi");
  });

  it("intestazione: dei codici GDO solo gli identificativi, l'insegna resta nei dati", () => {
    finti.pv = caricato({ ...PUNTO_VENDITA, meta: { id_muro: "317", insegna: "Spazio Conad", id_anacan: "3418" } });
    apri();

    const testata = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
    expect(testata).toHaveTextContent("ID MURO 317");
    expect(testata).toHaveTextContent("ID ANACAN 3418");
    expect(testata).not.toHaveTextContent("Spazio Conad");
    expect(sezione("Dati")).toHaveTextContent("Spazio Conad");
  });

  it("Analisi non arrivata: ogni riquadro mostra il suo errore con \"Riprova\", il resto della scheda resta", async () => {
    const refetch = vi.fn();
    finti.analisi = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch };
    apri();

    expect(within(sezione("Storia")).getByRole("alert")).toHaveTextContent("Storia non caricata");
    expect(within(sezione("Spazio per reparto")).getByRole("alert")).toHaveTextContent("Timeout");
    expect(within(sezione("Prodotti che tornano")).getByRole("alert")).toHaveTextContent("Prodotti non caricati");
    expect(sezione("Volantini attivi")).toHaveTextContent("Promo novembre");
    await userEvent.click(within(sezione("Prodotti che tornano")).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });

  // Richiesta del 2026-11-19: via "Come si promuove" e "Marche più presenti", anche con le linee del distributore
  it("niente Come si promuove né Marche più presenti, anche con marche, meccaniche e Private Labels", () => {
    finti.analisi = caricato({
      ...ANALISI,
      marche: [{ marca: "CONAD Verso Natura Bio", quota: 15.1, volantini: 3, linea: { nome: "Verso Natura", colore: "#2e7d32", logo: null } }],
      lineeDistributore: { quota: 34.5 },
    });
    apri();

    expect(screen.queryByRole("region", { name: "Come si promuove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Marche più presenti" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Private Label/)).not.toBeInTheDocument();
    expect(sezione("Spazio per reparto")).toBeInTheDocument();
  });

  it("Spazio per reparto in un anno: il valore dell'anno prima e la differenza in punti", () => {
    apri("/punti-vendita/pv1?anno=2026");

    const reparti = sezione("Spazio per reparto");
    // 2026: Freschi 600 su 1000; 2025: 500 su 1000
    expect(reparti).toHaveTextContent("60%");
    expect(reparti).toHaveTextContent("+10 punti");
  });

  it("Prodotti che tornano: presenza volantino per volantino, forbice del prezzo e ultima volta; ogni prodotto apre la sua referenza", () => {
    apri();

    const prodotti = sezione("Prodotti che tornano");
    expect(within(prodotti).getByRole("link", { name: "Mozzarella Alta Qualità" })).toHaveAttribute("href", "/punti-vendita/pv1/referenze/mozzarella-granarolo");
    expect(prodotti).toHaveTextContent("Granarolo · 3 × 100 g");
    expect(prodotti).toHaveTextContent("2 su 3");
    expect(within(prodotti).getByRole("img", { name: "Mozzarella Alta Qualità: presente in 2 su 3 volantini" })).toBeInTheDocument();
    expect(prodotti).toHaveTextContent("€ 1,49 – € 1,99");
    // L'ultima volta è il volantino k3
    expect(prodotti).toHaveTextContent("23/10/2026");
    expect(prodotti).toHaveTextContent("in almeno 2 volantini dal marzo 2025");
  });

  it("Spazio per reparto: con pochi reparti noti dice che il dato è parziale e da dove viene", () => {
    apri();

    const reparti = sezione("Spazio per reparto");
    expect(within(reparti).getByRole("img", { name: "Spazio per reparto" })).toHaveTextContent("Freschi");
    // Tutta la storia: Freschi 1100 su 2000
    expect(reparti).toHaveTextContent("55%");
    expect(reparti).toHaveTextContent("Dato parziale.");
    expect(reparti).toHaveTextContent("Il reparto arriva da DB1");
    expect(reparti).toHaveTextContent("35%");
  });

  it("Spazio per reparto: oltre 8 reparti i 7 più grandi e gli altri sommati in \"Altri reparti\", in fondo", () => {
    const reparti = Array.from({ length: 10 }, (_, i) => ({ reparto: `Reparto ${String.fromCharCode(65 + i)}`, spazio: 100 - i * 5 }));
    finti.analisi = caricato({ ...ANALISI, timeline: ANALISI.timeline.map(e => ({ ...e, reparti })) });
    apri();

    const grafico = within(sezione("Spazio per reparto")).getByRole("img", { name: "Spazio per reparto" });
    expect(grafico).toHaveTextContent("Reparto A");
    expect(grafico).toHaveTextContent("Reparto G");
    expect(grafico).not.toHaveTextContent("Reparto H");
    expect(grafico).toHaveTextContent("Altri reparti");
    // Reparti H, I e J: 65 + 60 + 55 su 775
    expect(grafico).toHaveTextContent("23,2%");
  });

  it("Storia: le barre dei volantini nel colore del tema, non in quello dell'insegna; nella testata l'insegna senza pallino colorato", () => {
    const { container } = apri();

    expect(container.querySelector('[data-barra="k3"]')).toHaveClass("fill-theme-1");
    const intestazione = screen.getByRole("heading", { level: 1 }).parentElement!;
    // Il pallino dell'insegna (PuntoInsegna) era un cerchio di raggio 4,5
    expect(intestazione.querySelector('circle[r="4.5"]')).toBeNull();
  });

  it("Spazio per reparto: senza reparti niente riquadro vuoto, una nota dice che manca e perché", () => {
    finti.analisi = caricato({ ...ANALISI, timeline: ANALISI.timeline.map(e => ({ ...e, reparti: [] })), copertura: { ...COPERTURA, conReparto: 0 } });
    apri();

    expect(screen.queryByRole("region", { name: "Spazio per reparto" })).not.toBeInTheDocument();
    const nota = screen.getByRole("complementary", { name: "Grafici senza dati" });
    expect(nota).toHaveTextContent("Spazio per reparto");
    expect(nota).toHaveTextContent("il reparto non è arrivato da DB1 né da Istanta");
    expect(nota).not.toHaveTextContent("Prodotti che tornano");
    // Gli altri grafici restano
    expect(sezione("Prodotti che tornano")).toBeInTheDocument();
  });

  it("Prodotti che tornano: senza prodotti in almeno 2 volantini la nota lo dice, senza riquadro vuoto", () => {
    finti.analisi = caricato({ ...ANALISI, prodottiRicorrenti: [] });
    apri();

    expect(screen.queryByRole("region", { name: "Prodotti che tornano" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Grafici senza dati" })).toHaveTextContent("nessun prodotto compare in almeno 2 volantini del periodo");
  });

  it("con tutti i grafici disegnati non c'è la nota dei grafici senza dati", () => {
    apri();
    expect(screen.queryByRole("complementary", { name: "Grafici senza dati" })).not.toBeInTheDocument();
  });

  it("niente griglie colorate per mese: anche con volantini in tutti i 12 mesi lo spazio per reparto resta a barre", () => {
    const anno = Array.from({ length: 12 }, (_, m) =>
      edizione(`m${m + 1}`, `2025-${String(m + 1).padStart(2, "0")}-05`, `2025-${String(m + 1).padStart(2, "0")}-18`, SUPERSTORE, {
        meccaniche: [{ meccanica: "sconto", referenze: 10 }],
        reparti: [{ reparto: "Bevande", spazio: m === 6 ? 40 : 20 }, { reparto: "Drogheria", spazio: m === 6 ? 60 : 80 }],
      })
    );
    finti.analisi = caricato({ ...ANALISI, timeline: anno, assenze: [], anni: [2025] });
    apri("/punti-vendita/pv1?anno=2025");

    expect(screen.queryByRole("region", { name: "Stagionalità dei reparti" })).not.toBeInTheDocument();
    expect(screen.queryByText(/media del reparto/)).not.toBeInTheDocument();
    expect(within(sezione("Spazio per reparto")).getByRole("img", { name: "Spazio per reparto" })).toHaveTextContent("Bevande");
  });

  it("niente sezione Cambiamenti e niente recapiti stampati nella Storia: solo insegna e volantini", () => {
    apri();

    expect(screen.queryByRole("region", { name: "Cambiamenti" })).not.toBeInTheDocument();
    const storia = sezione("Storia");
    expect(within(storia).queryByText(/^Indirizzo stampato/)).not.toBeInTheDocument();
    expect(within(storia).queryByText(/^Telefono stampato/)).not.toBeInTheDocument();
  });

  it("Insegne nel tempo: con più insegne una striscia sopra la Storia, l'attuale analizzata e le altre fuori", () => {
    finti.storia = caricato({
      ...STORIA,
      insegneNelTempo: [
        { canale: { id: "c9", nome: "Conad" }, area: { id: "a1", nome: "Toscana" }, dal: "2025-01-09", al: "2025-12-17", volantini: 5 },
        { canale: { id: "c1", nome: "Conad City" }, area: { id: "a1", nome: "Toscana" }, dal: "2026-09-24", al: "2026-11-05", volantini: 2 },
      ],
    });
    apri();

    const insegne = sezione("Insegne nel tempo");
    expect(insegne).toHaveTextContent("La Storia qui sotto analizza solo Conad City · Toscana.");
    const periodi = within(within(insegne).getByRole("list", { name: "Insegne nel tempo" })).getAllByRole("listitem");
    expect(periodi).toHaveLength(2);
    expect(periodi[0]).toHaveTextContent("Conad · Toscana");
    expect(periodi[0]).toHaveTextContent("dal gennaio 2025 al dicembre 2025");
    expect(periodi[0]).toHaveTextContent("5 volantini");
    expect(periodi[0]).toHaveTextContent("non compresa nell'analisi");
    expect(periodi[1]).toHaveTextContent("Conad City · Toscana");
    expect(periodi[1]).toHaveTextContent("Analizzata qui sotto");
    // Sopra la Storia
    expect(insegne.compareDocumentPosition(sezione("Storia")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Insegne nel tempo: con una sola insegna e area la striscia non c'è", () => {
    apri();

    expect(screen.queryByRole("region", { name: "Insegne nel tempo" })).not.toBeInTheDocument();
  });

  it("Storia del punto vendita non arrivata: niente striscia delle insegne, la timeline resta", () => {
    finti.storia = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch: vi.fn() };
    apri();

    expect(screen.queryByRole("region", { name: "Insegne nel tempo" })).not.toBeInTheDocument();
    expect(within(sezione("Storia")).getAllByRole("option")).toHaveLength(3);
  });

  it("Tutti i volantini: riga stampata, referenze, abbinamento probabile, PDF e il volantino da aprire", () => {
    apri();

    const voci = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    expect(voci[0]).toHaveTextContent("Promo ottobre");
    expect(voci[0]).toHaveTextContent("01/10 – 20/10/2026");
    // La riga stampata con lo stesso aspetto del volantino scelto, non fra virgolette
    expect(voci[0]).toHaveTextContent("LUCCA - Via Roma 1 - tel. 0583 123456");
    expect(voci[0]).not.toHaveTextContent("«");
    // Il titolo del kit è un codice tecnico: non si mostra
    expect(voci[0]).not.toHaveTextContent("Volantino Toscana");
    expect(voci[0]).toHaveTextContent("120 referenze");
    expect(voci[0]).not.toHaveTextContent("Abbinamento probabile");
    expect(within(voci[0]).getByRole("link", { name: /Apri volantino/ })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k1");
    const pdf = within(voci[0]).getByRole("link", { name: /PDF/ });
    expect(pdf).toHaveAttribute("href", "/olimpo/materiali/getMaterialePDF?id=olimpo-1");
    expect(pdf).toHaveAttribute("download", "Volantino ottobre.pdf");

    expect(voci[1]).toHaveTextContent("Abbinamento probabile");
    expect(voci[1]).not.toHaveTextContent("referenze");
    expect(within(voci[1]).queryByRole("link", { name: /PDF/ })).not.toBeInTheDocument();
  });

  it("Tutti i volantini: una riga collegata a mano è indicata come tale, non come abbinamento probabile", () => {
    finti.volantiniStoria = caricato({ ...PAGINA, volantini: [volantino({ abbinamento: "manuale" })], totale: 1 });
    apri();

    const [voce] = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    expect(voce).toHaveTextContent("Collegato a mano");
    expect(voce).not.toHaveTextContent("Abbinamento probabile");
  });

  it("Tutti i volantini: l'anteprima del PDF usa le miniature dei materiali", async () => {
    apri();

    const voci = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    await userEvent.click(within(voci[0]).getByRole("button", { name: /^Anteprima$/ }));

    expect(screen.getByRole("dialog", { name: "Anteprima del PDF" })).toHaveTextContent("/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-1");
  });

  it("Tutti i volantini: non espone collegamenti alla lavorazione produttiva", () => {
    apri();
    expect(within(sezione("Tutti i volantini")).queryByRole("link", { name: /Apri kit/ })).not.toBeInTheDocument();
  });

  it("Tutti i volantini: il permesso promo non reintroduce il collegamento produttivo", () => {
    finti.permessi = new Set(["gdo.visualizza", "promo.visualizza"]);
    apri();

    expect(within(sezione("Tutti i volantini")).queryByRole("link", { name: /Apri kit/ })).not.toBeInTheDocument();
  });

  it("senza materiali.visualizza la storia resta consultabile ma non apre il volantino", () => {
    finti.permessi = new Set(["gdo.visualizza"]);
    apri();

    const scelto = within(sezione("Storia")).getByRole("region", { name: "Volantino selezionato" });
    expect(scelto).toHaveTextContent("Promo k3");
    expect(within(scelto).queryByRole("link", { name: "Apri volantino" })).not.toBeInTheDocument();
    const voci = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    expect(voci[0]).toHaveTextContent("Promo ottobre");
    expect(within(voci[0]).queryByRole("link", { name: /Apri volantino/ })).not.toBeInTheDocument();
  });

  it("Tutti i volantini: paginati dal server, dal più recente", async () => {
    apri();

    expect(screen.getByText("Mostrati 1–10 di 30")).toBeInTheDocument();
    expect(finti.richiesteVolantiniStoria.at(-1)).toEqual(["pv1", 1, 10]);

    await userEvent.click(within(sezione("Tutti i volantini")).getByRole("button", { name: "Pagina successiva" }));

    expect(finti.richiesteVolantiniStoria.at(-1)).toEqual(["pv1", 2, 10]);
  });

  it("un punto vendita inesistente o di un'altra GDO: \"Punto vendita non trovato\"", () => {
    const errore = Object.assign(new Error("Punto vendita non trovato"), { httpStatus: 404 });
    finti.pv = { data: undefined, isLoading: false, isError: true, error: errore, refetch: vi.fn() };
    apri();

    expect(screen.getByText("Punto vendita non trovato")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Storia" })).not.toBeInTheDocument();
  });
});
