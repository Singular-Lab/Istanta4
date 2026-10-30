// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATO_PROMO } from "../../../lib/enums";
import type { AnalisiPuntoVendita, DettaglioVolantinoPv, EdizioneTimeline } from "../../../lib/puntiVendita/analisi";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";
import type { PaginaVolantiniStoria, StoriaPuntoVendita, VolantinoNellaStoria } from "../../../lib/puntiVendita/storia";

// Scheda di consultazione del punto vendita (/punti-vendita/:id), costruita sulla timeline dei
// volantini: numeri, storia con il volantino scelto, infografiche, recapiti, eventi, volantini attivi,
// tutti i volantini, dati e mappa

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
  useFetchAnalisiPuntoVendita: () => finti.analisi,
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
  ...dati,
});

const ANALISI: AnalisiPuntoVendita = {
  idPuntoVendita: "pv1",
  numeri: {
    volantini: 3,
    volantiniAttivi: 1,
    referenze: 400,
    mediaReferenze: 133.3,
    prodotti: 250,
    prodottiFrequenti: 12,
    scontoMedio: 27.8,
    scontoMedioPrimoAnno: 20.9,
    insegne: [CITY, SUPERSTORE],
  },
  timeline: [
    edizione("k1", "2025-03-03", "2025-03-16", CITY, { numeroReferenze: 110 }),
    edizione("k2", "2025-10-06", "2025-10-19", SUPERSTORE, { numeroReferenze: 140 }),
    edizione("k3", "2026-10-23", "2026-11-05", SUPERSTORE, { numeroReferenze: 148, attivo: true }),
  ],
  anni: [2025, 2026],
  meccaniche: [
    { meccanica: "fidelity", anni: [{ anno: 2025, quota: 14 }, { anno: 2026, quota: 21 }] },
    { meccanica: "sconto", anni: [{ anno: 2025, quota: 41 }, { anno: 2026, quota: 37 }] },
  ],
  scontoPerAnno: [{ anno: 2025, sconto: 20.9 }, { anno: 2026, sconto: 27.8 }],
  marche: [{ marca: "Barilla", quota: 3.2 }, { marca: "Granarolo", quota: 2.5 }],
  prodottiRicorrenti: [
    {
      chiave: "mozzarella-granarolo",
      nome: "Mozzarella Alta Qualità",
      marca: "Granarolo",
      formato: "3 × 100 g",
      foto: null,
      volantini: 23,
      perAnno: [{ anno: 2025, volantini: 10 }, { anno: 2026, volantini: 13 }],
      prezzoMinimo: 1.49,
      prezzoMassimo: 1.99,
    },
  ],
  reparti: [{ anno: 2026, reparti: [{ reparto: "Freschi", quota: 60 }, { reparto: "Drogheria", quota: 40 }] }],
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
    finti.permessi = new Set(["gdo.visualizza"]);
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

  it("Numeri: volantini, referenze, prodotti, sconto medio e insegne, con il contesto", () => {
    apri();

    const numeri = screen.getByLabelText("Il punto vendita in numeri");
    expect(numeri).toHaveTextContent("volantini dal mar 2025");
    expect(numeri).toHaveTextContent("1 attivo adesso");
    expect(numeri).toHaveTextContent("133 per volantino in media");
    expect(numeri).toHaveTextContent("12 presenti in più di 10 volantini");
    expect(numeri).toHaveTextContent("27,8%");
    expect(numeri).toHaveTextContent("+6,9 punti dal 2025");
    expect(numeri).toHaveTextContent("Conad City → Conad Superstore");
  });

  it("Numeri e riquadri in caricamento: gli scheletri", () => {
    finti.analisi = { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
    apri();

    expect(screen.getByRole("status", { name: "Caricamento: Il punto vendita in numeri" })).toBeInTheDocument();
    expect(within(sezione("Storia")).getByRole("status")).toBeInTheDocument();
    expect(within(sezione("Come si promuove")).getByRole("status")).toBeInTheDocument();
  });

  it("Dati: anagrafica completa e codici GDO", () => {
    apri();

    const dati = sezione("Dati");
    expect(dati).toHaveTextContent("Conad Lucca Srl");
    expect(dati).toHaveTextContent("Via Roma 1");
    expect(dati).toHaveTextContent("55100 Lucca (LU), Toscana");
    expect(within(dati).getByRole("link", { name: "0583 123456" })).toHaveAttribute("href", "tel:0583 123456");
    expect(dati).toHaveTextContent("Conad City (CC)");
    expect(dati).toHaveTextContent("ID ANACAN");
    expect(dati).toHaveTextContent("004512");
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

  it("Volantini attivi: i PDF delle promo valide del canale e dell'area", () => {
    apri();

    const volantini = sezione("Volantini attivi");
    expect(volantini).toHaveTextContent("Conad City · Toscana");
    expect(within(volantini).getByRole("heading", { name: "Promo novembre" })).toBeInTheDocument();
    expect(within(volantini).getByRole("link", { name: /PDF/ })).toHaveAttribute("href", "/olimpo/pdf");
  });

  it("Storia: una colonna per volantino; senza scelta il più recente, con la sua scheda", () => {
    apri();

    const storia = sezione("Storia");
    expect(storia).toHaveTextContent("Nei volantini dal marzo 2019 all'ottobre 2026.");
    expect(within(storia).getAllByRole("option")).toHaveLength(3);
    expect(within(storia).getByRole("option", { name: /Promo k3/ })).toHaveAttribute("aria-selected", "true");
    const scelto = within(storia).getByRole("region", { name: "Volantino selezionato" });
    expect(scelto).toHaveTextContent("Promo k3");
    expect(scelto).toHaveTextContent("23 ottobre – 5 novembre 2026");
    expect(scelto).toHaveTextContent("attivo");
    expect(scelto).toHaveTextContent("24 pagine");
    expect(scelto).toHaveTextContent("sconto medio 31,2%");
    expect(scelto).toHaveTextContent("212 punti vendita nella lista");
    expect(scelto).toHaveTextContent("LUCCA - Via Roma 1 - tel. 0583 123456 (k3)");
    expect(within(scelto).getByRole("link", { name: "Apri volantino" })).toHaveAttribute("href", "/punti-vendita/pv1/volantini/k3");
    expect(within(scelto).getByRole("button", { name: "Volantino successivo" })).toBeDisabled();
  });

  it("Storia: insegne ed eventi della storia in legenda", () => {
    apri();

    const legenda = within(sezione("Storia")).getByRole("list", { name: "Legenda" });
    expect(within(legenda).getAllByRole("listitem").map(v => v.textContent)).toEqual(["Conad City", "Conad Superstore", "cambio di insegna", "indirizzo cambiato"]);
  });

  it("Storia: nello zoom su un anno l'insegna è scritta nella fascia e l'asse va per mesi", () => {
    apri("/punti-vendita/pv1?anno=2026");

    const timeline = within(sezione("Storia")).getByRole("group", { name: /Timeline/ });
    expect(timeline).toHaveTextContent("Conad Superstore · Toscana");
    expect(within(timeline).getByText("ott")).toBeInTheDocument();
    expect(within(sezione("Storia")).getAllByRole("option")).toHaveLength(1);
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
    await userEvent.click(within(storia).getByRole("radio", { name: "2025" }));

    expect(within(storia).getAllByRole("option")).toHaveLength(2);
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
      anni: [],
      meccaniche: [],
      scontoPerAnno: [],
      marche: [],
      prodottiRicorrenti: [],
      reparti: [],
    });
    finti.storia = caricato({ ...STORIA, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] });
    apri();

    const storia = sezione("Storia");
    expect(storia).toHaveTextContent("Arriva quando il Plugin InDesign invia i volantini o quando si importano i loro export JSON");
    // La guida alla lettura della timeline non serve senza timeline
    expect(storia).not.toHaveTextContent("Ogni colonna è un volantino");
    expect(screen.queryByLabelText("Il punto vendita in numeri")).not.toBeInTheDocument();
    for (const titolo of ["Come si promuove", "Sconto medio", "Marche più presenti", "Prodotti che tornano", "Dove sta nel volantino", "Indirizzo e telefono stampati", "Eventi"]) {
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
    finti.analisi = caricato({ ...ANALISI, numeri: { ...ANALISI.numeri, scontoMedio: null, prodottiFrequenti: 0 } });
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
    expect(within(sezione("Come si promuove")).getByRole("alert")).toHaveTextContent("Timeout");
    expect(within(sezione("Prodotti che tornano")).getByRole("alert")).toHaveTextContent("Prodotti non caricati");
    expect(sezione("Volantini attivi")).toHaveTextContent("Promo novembre");
    await userEvent.click(within(sezione("Sconto medio")).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("Come si promuove: le meccaniche per anno, nell'ordine fisso delle meccaniche", () => {
    apri();

    const grafico = within(sezione("Come si promuove")).getByRole("img", { name: "Meccaniche per anno" });
    const righe = within(grafico).getAllByText(/^(Sconto in %|Prezzo Fidelity)$/).map(t => t.textContent);
    expect(righe).toEqual(["Sconto in %", "Prezzo Fidelity"]);
    expect(within(grafico).getByText("41%")).toBeInTheDocument();
  });

  it("Sconto medio e marche più presenti: i grafici con i loro valori", () => {
    apri();

    expect(within(sezione("Sconto medio")).getByRole("img", { name: "Sconto medio per anno" })).toHaveTextContent("27,8%");
    const marche = within(sezione("Marche più presenti")).getByRole("img", { name: "Marche più presenti" });
    expect(marche).toHaveTextContent("Barilla");
    expect(marche).toHaveTextContent("3,2%");
  });

  it("Prodotti che tornano: ogni prodotto apre la sua referenza, con la presenza anno per anno", () => {
    apri();

    const prodotti = sezione("Prodotti che tornano");
    expect(within(prodotti).getByRole("link", { name: "Mozzarella Alta Qualità" })).toHaveAttribute("href", "/punti-vendita/pv1/referenze/mozzarella-granarolo");
    expect(within(prodotti).getByRole("img", { name: "Volantini per anno: 2025 10, 2026 13" })).toBeInTheDocument();
    expect(prodotti).toHaveTextContent("Granarolo · 3 × 100 g");
    // Il prezzo minimo sopra, il massimo sotto: la colonna resta stretta e il nome del prodotto ha spazio
    expect(prodotti).toHaveTextContent("€ 1,49");
    expect(prodotti).toHaveTextContent("fino a € 1,99");
  });

  it("Dove sta nel volantino: con pochi reparti noti dice che il dato è parziale e da dove viene", () => {
    apri();

    const reparti = sezione("Dove sta nel volantino");
    expect(within(reparti).getByRole("img", { name: "Spazio di pagina per reparto" })).toBeInTheDocument();
    expect(reparti).toHaveTextContent("Dato parziale.");
    expect(reparti).toHaveTextContent("Il reparto arriva da DB1");
    expect(reparti).toHaveTextContent("35%");
  });

  it("Dove sta nel volantino: senza reparti niente riquadro vuoto, una nota dice che manca e perché", () => {
    finti.analisi = caricato({ ...ANALISI, reparti: [], copertura: { ...COPERTURA, conReparto: 0 } });
    apri();

    expect(screen.queryByRole("region", { name: "Dove sta nel volantino" })).not.toBeInTheDocument();
    const nota = screen.getByRole("complementary", { name: "Grafici senza dati" });
    expect(nota).toHaveTextContent("Dove sta nel volantino");
    expect(nota).toHaveTextContent("il reparto non è arrivato da DB1 né da Istanta");
    expect(nota).not.toHaveTextContent("Prodotti che tornano");
    // Gli altri grafici restano
    expect(sezione("Prodotti che tornano")).toBeInTheDocument();
  });

  it("con tutti i grafici disegnati non c'è la nota dei grafici senza dati", () => {
    apri();
    expect(screen.queryByRole("complementary", { name: "Grafici senza dati" })).not.toBeInTheDocument();
  });

  it("Marche più presenti: senza anni la descrizione si chiude senza la virgola", () => {
    finti.analisi = caricato({ ...ANALISI, anni: [] });
    apri();
    expect(sezione("Marche più presenti")).toHaveTextContent("Quota delle referenze con la marca.");
  });

  it("Eventi: in italiano, con la data, e il primo volantino registrato in fondo", () => {
    apri();

    const voci = within(within(sezione("Eventi")).getByRole("list", { name: "Eventi" })).getAllByRole("listitem");
    expect(voci[0]).toHaveTextContent("Cambio di insegna");
    expect(voci[0]).toHaveTextContent("10/01/2023");
    expect(voci[0]).toHaveTextContent("Da Conad City a Conad Superstore.");
    expect(voci[1]).toHaveTextContent("Nei volantini era «Via Vecchia 3», poi «Via Roma 1».");
    expect(voci[2]).toHaveTextContent("Primo volantino registrato");
    expect(voci[2]).toHaveTextContent("03/03/2025");
    expect(voci[2]).toHaveTextContent("Promo k1 · Conad City · Toscana");
  });

  it("Indirizzo e telefono stampati: i tratti nel tempo e i recapiti diversi dall'attuale segnalati", () => {
    apri();

    const recapiti = sezione("Indirizzo e telefono stampati");
    expect(within(recapiti).getByRole("img", { name: "Indirizzo e telefono stampati nel tempo" })).toBeInTheDocument();
    const voci = within(within(recapiti).getByRole("list", { name: "Recapiti stampati" })).getAllByRole("listitem");
    expect(voci[0]).toHaveTextContent("Via Roma 1, Lucca · tel. 0583 123456");
    expect(voci[0]).not.toHaveTextContent("Diverso dall'attuale");
    expect(voci[1]).toHaveTextContent("Via Vecchia 3, Lucca · tel. 0583 000000");
    expect(voci[1]).toHaveTextContent("Diverso dall'attuale");
  });

  it("Storia del punto vendita non arrivata: eventi e recapiti mostrano l'errore, la timeline resta", async () => {
    const refetch = vi.fn();
    finti.storia = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch };
    apri();

    expect(within(sezione("Eventi")).getByRole("alert")).toHaveTextContent("Eventi non caricati");
    expect(within(sezione("Indirizzo e telefono stampati")).getByRole("alert")).toHaveTextContent("Timeout");
    expect(within(sezione("Storia")).getAllByRole("option")).toHaveLength(3);
    await userEvent.click(within(sezione("Eventi")).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("Tutti i volantini: riga stampata, referenze, abbinamento probabile, PDF e il volantino da aprire", () => {
    apri();

    const voci = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    expect(voci[0]).toHaveTextContent("Promo ottobre");
    expect(voci[0]).toHaveTextContent("01/10 – 20/10/2026");
    expect(voci[0]).toHaveTextContent("«LUCCA - Via Roma 1 - tel. 0583 123456»");
    expect(voci[0]).toHaveTextContent("120 referenze");
    expect(voci[0]).not.toHaveTextContent("Abbinamento probabile");
    expect(within(voci[0]).getByRole("link", { name: /Apri volantino/ })).toHaveAttribute("href", "/punti-vendita/pv1/volantini/k1");
    const pdf = within(voci[0]).getByRole("link", { name: /PDF/ });
    expect(pdf).toHaveAttribute("href", "/olimpo/materiali/getMaterialePDF?id=olimpo-1");
    expect(pdf).toHaveAttribute("download", "Volantino ottobre.pdf");

    expect(voci[1]).toHaveTextContent("Abbinamento probabile");
    expect(voci[1]).not.toHaveTextContent("referenze");
    expect(within(voci[1]).queryByRole("link", { name: /PDF/ })).not.toBeInTheDocument();
  });

  it("Tutti i volantini: l'anteprima del PDF usa le miniature dei materiali", async () => {
    apri();

    const voci = within(within(sezione("Tutti i volantini")).getByRole("list", { name: "Volantini della storia" })).getAllByRole("listitem");
    await userEvent.click(within(voci[0]).getByRole("button", { name: /^Anteprima$/ }));

    expect(screen.getByRole("dialog", { name: "Anteprima del PDF" })).toHaveTextContent("/olimpo/materiali/getThumbnailMaterialePdfs?id=olimpo-1");
  });

  it("Tutti i volantini: il link al kit c'è solo con il permesso di vedere le promozioni", () => {
    apri();
    expect(within(sezione("Tutti i volantini")).queryByRole("link", { name: /Apri kit/ })).not.toBeInTheDocument();
  });

  it("Tutti i volantini: con il permesso il kit si apre dalla sua promozione", () => {
    finti.permessi = new Set(["gdo.visualizza", "promo.visualizza"]);
    apri();

    const kit = within(sezione("Tutti i volantini")).getAllByRole("link", { name: /Apri kit/ });
    expect(kit[0]).toHaveAttribute("href", "/promozioni/storico/dettagli/p1/kits/k1");
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
