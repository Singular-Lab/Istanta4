// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom non implementa ResizeObserver, usato da Headless UI all'apertura di Dialog e Menu
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const finti = vi.hoisted(() => ({
  puntiVendita: {} as Record<string, unknown>,
  consultazione: {} as Record<string, unknown>,
  qualita: {} as Record<string, unknown>,
  righe: {} as Record<string, unknown>,
  richiesteRighe: [] as Array<[number, number]>,
  collegamenti: {} as Record<string, unknown>,
  volantiniRiga: {} as Record<string, unknown>,
  richiesteVolantini: [] as Array<string | null>,
  puoConsultareVolantini: true,
  collega: { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() },
  scollega: { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() },
  importJob: {} as Record<string, unknown>,
  verifica: {} as Record<string, unknown>,
  richiesteVerifica: [] as Array<Record<string, unknown>>,
  cambia: { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() },
  correggi: { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() },
  posizioni: {} as Record<string, unknown>,
  put: vi.fn(),
  combinazioni: {
    data: [{ id: "comb1", sigla_combinazione: "SN", stato_combinazione: "attiva", id_canale: "c1", id_area: "a1", nome_canale: "Super", nome_area: "Nord" }],
  },
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
// La mappa vera non serve: Leaflet in jsdom non disegna nulla
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="mappa" />,
  TileLayer: () => null,
  CircleMarker: () => null,
  Polyline: () => null,
  Popup: () => null,
  Tooltip: () => null,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));
vi.mock("../../../lib/server_call", () => ({ ServerCall: { get: vi.fn(), post: vi.fn(), put: finti.put, delete: vi.fn() } }));
vi.mock("@/components/SessionChecker", () => ({ default: (Componente: any) => Componente }));
vi.mock("@/components/PermissionGate", () => ({ PermissionGate: ({ children }: any) => <>{children}</> }));
vi.mock("@/context/NotificationContext", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));
vi.mock("@/query/query", () => ({
  useFetchAllCombinazioneForGDO: () => finti.combinazioni,
  useFetchPuntiVenditaFromIdGDO: () => finti.puntiVendita,
  useFetchPuntiVenditaConsultazione: () => finti.consultazione,
  useFetchQualitaPuntiVendita: () => finti.qualita,
  useFetchReteInsegne: () => ({ data: undefined }),
  useFetchRigheNonAbbinate: (pagina: number, dimensione: number) => {
    finti.richiesteRighe.push([pagina, dimensione]);
    return finti.righe;
  },
  useFetchCollegamentiManuali: () => finti.collegamenti,
  useFetchVolantiniRigaNonAbbinata: (chiave: string | null) => {
    finti.richiesteVolantini.push(chiave);
    return finti.volantiniRiga;
  },
  useCollegaRigaNonAbbinata: () => finti.collega,
  useScollegaCollegamentoManuale: () => finti.scollega,
  useFetchVerificaCollegamenti: (filtri: Record<string, unknown>) => {
    finti.richiesteVerifica.push(filtri);
    return finti.verifica;
  },
  useCambiaCollegamento: () => finti.cambia,
  useCorreggiPosizioneRiga: () => finti.correggi,
}));
vi.mock("./usePosizioniRighe", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  usePosizioniRighe: () => finti.posizioni,
}));
vi.mock("./useImportPuntiVendita", () => ({ useImportPuntiVendita: () => finti.importJob }));
vi.mock("@/context/PermissionContext", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  usePermission: () => finti.puoConsultareVolantini,
}));

import PuntiVendita from ".";

/** Nessun import in corso. */
const JOB_FERMO = {
  stato: null,
  inCorso: false,
  avvioInCorso: false,
  annullamentoInCorso: false,
  avvia: vi.fn(),
  annulla: vi.fn(),
  decidi: vi.fn(),
  azzera: vi.fn(),
};

const puntoVendita = (indice: number, dati: Record<string, unknown> = {}) => ({
  id: `pv${indice}`,
  nome: `Punto vendita ${indice}`,
  indirizzo: `Via Roma ${indice}`,
  cap: "50100",
  citta: "Firenze",
  provincia: "FI",
  id_combinazione_canale_area: "comb1",
  id_canale: "c1",
  nome_canale: "Super",
  id_area: "a1",
  nome_area: "Nord",
  has_coordinate: false,
  coordinate: null,
  meta: {},
  ...dati,
});

const apri = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PuntiVendita />
      </MemoryRouter>
    </QueryClientProvider>
  );

const QUALITA = { totale: 12, senzaCoordinate: 10, senzaCodice: 0, righeDaRevisionare: 3, conStoria: 9, dispositiviOffline: 2 };

const statoImport = (dati: Record<string, unknown> = {}) => ({
  jobId: "job1",
  stato: "in_corso",
  totale: 1310,
  elaborate: 812,
  creati: 3,
  aggiornati: 790,
  scartati: 19,
  inseritiAMano: 0,
  soloFp: 0,
  geolocalizzati: 0,
  senzaCoordinate: 0,
  erroriNominatim: 0,
  nonElaborate: 0,
  errori: [],
  avviatoIl: "2026-10-30T10:00:00Z",
  ...dati,
});

const SUPER_NORD = { canale: { id: "c1", nome: "Super" }, area: { id: "a1", nome: "Nord" } };

const RIGHE_NON_ABBINATE = [
  {
    chiave: "tel:01845550143",
    riga: "SANREMO - Via Roma 3 - tel. 0184 555 0143",
    varianti: ["SANREMO - Via Roma 3 - tel. 0184 555 0143", "SANREMO - V. Roma 3 - tel. 0184 555 0143"],
    localita: "Sanremo",
    indirizzo: "Via Roma 3",
    telefono: "0184 555 0143",
    volantini: 40,
    primoVolantino: "2021-03-01",
    ultimoVolantino: "2022-08-12",
    canale: { id: "c1", nome: "Super" },
    provincia: "IM",
    combinazioni: [SUPER_NORD],
    posizione: null,
    suggerimento: { tipo: "stesso_telefono", puntoVendita: { id: "pv7", nome: "Punto vendita 7" } },
    candidati: [
      { puntoVendita: { id: "pv7", nome: "Punto vendita 7", indirizzo: "Via Roma 7", citta: "Firenze" }, motivo: "stesso_telefono" },
      { puntoVendita: { id: "pv3", nome: "Punto vendita 3", indirizzo: "Via Roma 3", citta: "Firenze" }, motivo: "indirizzo_simile" },
    ],
  },
  {
    chiave: "ind:ALASSIO|VIA DANTE 88",
    riga: "ALASSIO - Via Dante 88",
    varianti: ["ALASSIO - Via Dante 88"],
    localita: "Alassio",
    indirizzo: "Via Dante 88",
    telefono: null,
    volantini: 131,
    primoVolantino: "2019-01-10",
    ultimoVolantino: "2025-03-14",
    canale: null,
    provincia: null,
    combinazioni: [SUPER_NORD],
    posizione: null,
    suggerimento: { tipo: "forse_chiuso" },
    candidati: [],
  },
  {
    chiave: "ind:ARMA DI TAGGIA|PIAZZA CHIEROTTI 4",
    riga: "ARMA DI TAGGIA - P.zza Chierotti 4",
    varianti: ["ARMA DI TAGGIA - P.zza Chierotti 4"],
    localita: "Arma di Taggia",
    indirizzo: "P.zza Chierotti 4",
    telefono: "0184 000 111",
    volantini: 12,
    primoVolantino: "2026-01-09",
    ultimoVolantino: "2026-10-23",
    canale: { id: "c1", nome: "Super" },
    provincia: null,
    combinazioni: [SUPER_NORD],
    posizione: null,
    suggerimento: { tipo: "da_aggiungere" },
    candidati: [],
  },
];

const VOLANTINI_ALASSIO = [
  {
    idKit: "k131",
    titoloKit: "CC LI 11",
    promo: { id: "p131", nome: "Volantino marzo" },
    data: "2025-03-14",
    canale: { id: "c1", nome: "Super" },
    area: { id: "a1", nome: "Nord" },
    rigaStampata: "ALASSIO - Via Dante 88",
  },
  {
    idKit: "k130",
    titoloKit: "CC LI 10",
    promo: { id: "p130", nome: "Volantino febbraio" },
    data: "2025-02-27",
    canale: { id: "c1", nome: "Super" },
    area: { id: "a1", nome: "Nord" },
    rigaStampata: "ALASSIO - V. Dante 88",
  },
];

/** Nessuna ricerca delle posizioni in corso. */
const RICERCA_FERMA = { stato: null, inCorso: false, avvia: vi.fn(), annulla: vi.fn(), avvioInCorso: false, annullamentoInCorso: false, errore: null };

const confronto = (dati: Record<string, unknown> = {}) => ({
  telefono: "assente", indirizzo: "diverso", localita: "diverso", provincia: "assente", stessaCombinazione: true, distanzaMetri: null, ...dati,
});

const pvConfrontato = (indice: number, dati: Record<string, unknown> = {}) => ({
  id: `pv${indice}`, nome: `Punto vendita ${indice}`, ragioneSociale: null, indirizzo: `Via Roma ${indice}`, citta: "Firenze", provincia: "FI",
  telefono: null, lat: null, lon: null, combinazione: SUPER_NORD, ...dati,
});

/** Marina di Massa collegata a mano a un PV lontano: incongruente. */
const GRUPPO_MARINA = {
  chiave: "ind:MARINA DI MASSA|VIA S LEONARDO 350",
  riga: "MARINA DI MASSA Via S. Leonardo 350",
  varianti: ["MARINA DI MASSA Via S. Leonardo 350"],
  localita: "MARINA DI MASSA",
  indirizzo: "Via S. Leonardo 350",
  telefono: null,
  provincia: "MS",
  volantini: 2,
  primoVolantino: "2026-09-01",
  ultimoVolantino: "2026-10-01",
  combinazioni: [SUPER_NORD],
  tipo: "manuale",
  abbinamenti: ["manuale"],
  idCollegamento: "c9",
  posizione: {
    chiave: "ind:MARINA DI MASSA|VIA S LEONARDO 350", lat: 44.0098, lon: 10.1077, precisione: "via", fonte: "nominatim", errore: null,
    aggiornataIl: "2026-11-11T09:00:00Z",
  },
  puntoVendita: pvConfrontato(5, { nome: "Massa Marittima", citta: "Massa Marittima", indirizzo: "Via Don Luigi Rossi 5", lat: 43.0496, lon: 10.8888 }),
  confronto: confronto({ distanzaMetri: 122000 }),
  esito: "incongruente",
  motivi: [
    { tipo: "distanza", livello: "incongruente", testo: "122 km fra la posizione stampata (della via) e il punto vendita" },
    { tipo: "localita_diversa", livello: "da_verificare", testo: "Località stampata \"MARINA DI MASSA\", città del punto vendita \"Massa Marittima\"" },
  ],
  vicini: [{ puntoVendita: pvConfrontato(6, { nome: "Conad Marina", lat: 44.0101, lon: 10.108 }), metri: 40 }],
  candidati: [{ puntoVendita: pvConfrontato(6, { nome: "Conad Marina", lat: 44.0101, lon: 10.108 }), motivo: "vicino", confronto: confronto({ distanzaMetri: 40 }) }],
};

const verifica = (gruppi: unknown[], dati: Record<string, unknown> = {}) => ({
  gruppi, totale: gruppi.length, pagina: 1, dimensione: 10,
  conteggi: { incongruente: gruppi.length, da_verificare: 0, coerente: 0 }, posizioniDaCercare: 0, posizioniNonTrovate: 0, ...dati,
});

const COLLEGAMENTI_VUOTI = { data: { collegamenti: [], totale: 0, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };

const regione = (nome: string) => screen.getByRole("region", { name: nome });
const rigaDi = (nome: string) => screen.getByRole("link", { name: nome }).closest("tr")!;

describe("Gestione punti vendita", () => {
  beforeEach(() => {
    finti.puntiVendita = {
      // I primi due hanno le coordinate, gli altri no
      data: Array.from({ length: 12 }, (_, indice) =>
        puntoVendita(indice + 1, indice < 2 ? { has_coordinate: true, coordinate: { lat: 43.8, lon: 11.2 } } : {})
      ),
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
    finti.consultazione = { data: [] };
    finti.qualita = { data: QUALITA, isLoading: false, isError: false, refetch: vi.fn() };
    finti.righe = { data: { righe: [], totale: 0, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };
    finti.richiesteRighe = [];
    finti.collegamenti = COLLEGAMENTI_VUOTI;
    finti.volantiniRiga = { data: { chiave: "ind:ALASSIO|VIA DANTE 88", volantini: VOLANTINI_ALASSIO }, isLoading: false, isError: false, refetch: vi.fn() };
    finti.richiesteVolantini = [];
    finti.puoConsultareVolantini = true;
    finti.collega.mutate = vi.fn();
    finti.scollega.mutate = vi.fn();
    finti.importJob = { ...JOB_FERMO };
    finti.verifica = { data: verifica([]), isLoading: false, isError: false, refetch: vi.fn() };
    finti.richiesteVerifica = [];
    finti.cambia.mutate = vi.fn();
    finti.correggi.mutate = vi.fn();
    finti.posizioni = { ...RICERCA_FERMA };
    finti.put.mockReset();
  });

  it("la paginazione mostra l'intervallo di righe e il totale", () => {
    apri();

    expect(screen.getByText("Mostrati 1–10 di 12")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginazione" })).toBeInTheDocument();
    expect(screen.getByLabelText("Righe per pagina")).toBeInTheDocument();
  });

  it("i comandi di riga sono compatti: Modifica a icona in vista, scheda, dispositivi ed Elimina nel menu ⋯; il nome apre la gestione", async () => {
    apri();

    const modifica = screen.getByRole("button", { name: "Modifica Punto vendita 1" });
    expect(modifica).not.toHaveTextContent("Modifica");
    expect(screen.queryByRole("link", { name: "Scheda Punto vendita 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Punto vendita 1" })).toHaveAttribute("href", "/gestione-interna/punti-vendita/pv1");

    await userEvent.click(screen.getByRole("button", { name: "Altre azioni punto vendita Punto vendita 1" }));
    expect(await screen.findByRole("menuitem", { name: "Apri scheda" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Dispositivi e display" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Elimina" })).toBeInTheDocument();
  });

  it("la tabella ha punto vendita, indirizzo, insegna · area, dati e comandi, senza la colonna #", () => {
    apri();

    const intestazioni = screen.getAllByRole("columnheader").map(th => th.textContent);
    expect(intestazioni).toEqual(["Punto vendita", "Indirizzo", "Insegna · area", "Dati", "Azioni"]);
    // L'indirizzo su due righe: via, poi CAP, città e provincia
    expect(within(rigaDi("Punto vendita 1")).getByText("Via Roma 1")).toBeInTheDocument();
    expect(within(rigaDi("Punto vendita 1")).getByText("50100 Firenze (FI)")).toBeInTheDocument();
  });

  it("senza punti vendita lo stato vuoto sta fuori dalla tabella, a tutta larghezza", () => {
    finti.puntiVendita = { ...finti.puntiVendita, data: [] };
    apri();

    const vuoto = screen.getByText("Nessun punto vendita disponibile");
    expect(vuoto.closest("table")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Indirizzo" })).not.toBeInTheDocument();
  });

  it("i codici sono solo quelli che identificano il punto vendita: l'insegna dei meta non è un codice", () => {
    finti.puntiVendita = {
      ...finti.puntiVendita,
      data: [puntoVendita(1, { meta: { id_muro: "317", insegna: "Spazio Conad", id_anacan: "3418" } }), puntoVendita(2)],
    };
    apri();

    expect(screen.getByRole("columnheader", { name: "Codici" })).toBeInTheDocument();
    const riga = rigaDi("Punto vendita 1");
    expect(riga).toHaveTextContent("ID MURO 317");
    expect(riga).toHaveTextContent("ID ANACAN 3418");
    expect(riga).not.toHaveTextContent("INSEGNA");
    expect(riga).not.toHaveTextContent("Spazio Conad");
  });

  it("sotto sm ogni punto vendita è una scheda con nome, indirizzo, insegna · area, stato e comandi, senza tabella", () => {
    const originale = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    try {
      apri();

      expect(screen.queryByRole("columnheader", { name: "Indirizzo" })).not.toBeInTheDocument();
      // Il terzo punto vendita non ha le coordinate
      const scheda = screen.getByRole("link", { name: "Punto vendita 3" }).closest("li")!;
      expect(scheda).toHaveTextContent("Via Roma 3 - 50100 Firenze (FI)");
      expect(scheda).toHaveTextContent("Super · Nord");
      expect(within(scheda).getByText("Senza coordinate")).toBeInTheDocument();
      expect(within(scheda).getByRole("button", { name: "Modifica Punto vendita 3" })).toBeInTheDocument();
      expect(within(scheda).getByRole("button", { name: "Altre azioni punto vendita Punto vendita 3" })).toBeInTheDocument();
    } finally {
      window.matchMedia = originale;
    }
  });

  it("creare un punto vendita è l'unica azione primaria; i due import stanno sotto Importa", async () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Gestione punti vendita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuovo punto vendita/ })).toHaveClass("bg-primary");
    const importa = screen.getByRole("button", { name: /^Importa/ });
    expect(importa).not.toHaveClass("bg-primary");

    await userEvent.click(importa);
    expect(await screen.findByRole("menuitem", { name: /Anagrafica da Excel/ })).toHaveTextContent("Crea e aggiorna i punti vendita dal file della GDO");
    expect(screen.getByRole("menuitem", { name: /Storia dai volantini/ })).toHaveTextContent("non modifica l'anagrafica");
  });

  it("dalla riga si apre la scheda di consultazione del punto vendita", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/gestione-interna/punti-vendita"]}>
          <Routes>
            <Route path="/gestione-interna/punti-vendita" element={<PuntiVendita />} />
            <Route path="/punti-vendita/:id" element={<div>Scheda aperta</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Altre azioni punto vendita Punto vendita 1" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Apri scheda" }));

    expect(await screen.findByText("Scheda aperta")).toBeInTheDocument();
  });

  it("l'import dello storico dai volantini, da Importa, spiega i file e che l'anagrafica non cambia", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: /^Importa/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Storia dai volantini/ }));

    expect(await screen.findByText(/cartella/)).toHaveTextContent("EXPORT");
    expect(screen.getByText("L'anagrafica dei punti vendita non viene modificata.")).toBeInTheDocument();
  });

  it("l'import dell'anagrafica da Excel si apre da Importa", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: /^Importa/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Anagrafica da Excel/ }));

    expect(await screen.findByText("Importa l'anagrafica da Excel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seleziona file Excel/ })).toBeInTheDocument();
  });

  it("Modifica apre il modale con i dati del punto vendita e salva una volta sola con modificaPV", async () => {
    finti.put.mockResolvedValue({ esito: true, error: "", isUpdate: true, data: { id: "pv1" } });
    apri();

    await userEvent.click(screen.getByRole("button", { name: "Modifica Punto vendita 1" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByLabelText("Nome")).toHaveValue("Punto vendita 1");
    await userEvent.clear(within(dialogo).getByLabelText("Telefono"));
    await userEvent.type(within(dialogo).getByLabelText("Telefono"), "055 123456");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => expect(finti.put).toHaveBeenCalled());
    expect(finti.put).toHaveBeenCalledTimes(1);
    const [url, corpo] = finti.put.mock.calls[0];
    // modificaPV scrive prima su Istanta e poi in Fidelity, con lo stesso GUID
    expect(url).toBe("/ACPV/modificaPV");
    expect(corpo).toMatchObject({ guidID: "pv1", nome: "Punto vendita 1", telefono: "055 123456", guidIDCombinazione: "comb1", lat: 43.8, lon: 11.2 });
  });

  it("un nuovo punto vendita senza i campi obbligatori non parte e dice cosa manca", async () => {
    apri();

    await userEvent.click(screen.getByRole("button", { name: /Nuovo punto vendita/ }));
    const dialogo = await screen.findByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crea punto vendita" }));

    expect(await within(dialogo).findByText("Il nome è obbligatorio")).toBeInTheDocument();
    expect(within(dialogo).getByText("L'indirizzo è obbligatorio")).toBeInTheDocument();
    expect(finti.put).not.toHaveBeenCalled();
  });

  it("le tessere della qualità dei dati hanno tutte la stessa struttura: numero sopra l'etichetta, descrizione, barra in fondo", () => {
    apri();

    const tessere = Array.from(screen.getByRole("group", { name: "Qualità dei dati" }).children);
    expect(tessere.length).toBeGreaterThanOrEqual(4);
    for (const tessera of tessere) {
      // Tre righe della griglia madre, condivise fra le tessere affiancate: si allineano anche se un testo va a capo
      expect(tessera).toHaveClass("row-span-3", "grid-rows-subgrid");
      const [testata, descrizione, barra] = Array.from(tessera.children);
      expect(tessera.children).toHaveLength(3);
      // Numero ed etichetta nello stesso blocco, uno sopra l'altra, anche per la quota in percentuale
      expect(testata).toHaveClass("flex-col");
      expect(testata.children).toHaveLength(2);
      expect(descrizione.textContent).not.toBe("");
      expect(barra).toHaveAttribute("aria-hidden", "true");
    }
    expect(within(screen.getByRole("group", { name: "Qualità dei dati" })).getByText("Con storia nei volantini").previousElementSibling).toHaveTextContent("75%");
  });

  it("le tessere della qualità dei dati mostrano i problemi e quelle dei punti vendita fanno da filtro", async () => {
    apri();

    const qualita = screen.getByRole("group", { name: "Qualità dei dati" });
    const senzaCoordinate = within(qualita).getByRole("button", { name: /Senza coordinate/ });
    expect(senzaCoordinate).toHaveTextContent("10");
    expect(within(qualita).getByText("Righe da revisionare").parentElement).toHaveTextContent("3");
    expect(within(qualita).getByText("75%")).toBeInTheDocument();
    expect(within(qualita).getByText("Dispositivi offline").parentElement).toHaveTextContent("2");
    // La GDO non usa codici propri: la tessera "Senza codice" non serve
    expect(within(qualita).queryByText("Senza codice")).not.toBeInTheDocument();
    // Senza la storia nell'elenco la tessera della storia non può filtrare
    expect(within(qualita).queryByRole("button", { name: /Con storia nei volantini/ })).not.toBeInTheDocument();

    await userEvent.click(senzaCoordinate);

    expect(senzaCoordinate).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Mostrati 1–10 di 10")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Punto vendita 1" })).not.toBeInTheDocument();

    // Il filtro si toglie dal riepilogo sopra la tabella
    await userEvent.click(screen.getByRole("button", { name: /Solo: Senza coordinate/ }));
    expect(await screen.findByText("Mostrati 1–10 di 12")).toBeInTheDocument();
    expect(senzaCoordinate).toHaveAttribute("aria-pressed", "false");
  });

  it("la colonna Dati segnala coordinate mancanti e, con la storia nell'elenco, i punti vendita mai nei volantini", async () => {
    finti.consultazione = {
      data: [
        { id: "pv1", storia: { volantini: 4, insegnePerAnno: [], cambioInsegna: false } },
        { id: "pv2", storia: { volantini: 0, insegnePerAnno: [], cambioInsegna: false } },
      ],
    };
    apri();

    expect(within(rigaDi("Punto vendita 1")).getByText("Completi")).toBeInTheDocument();
    expect(within(rigaDi("Punto vendita 2")).getByText("Mai nei volantini")).toBeInTheDocument();
    expect(within(rigaDi("Punto vendita 3")).getByText("Senza coordinate")).toBeInTheDocument();

    // Ora la tessera della storia filtra: tutti tranne pv1
    await userEvent.click(screen.getByRole("button", { name: /Con storia nei volantini/ }));
    expect(await screen.findByText("Mostrati 1–10 di 11")).toBeInTheDocument();
  });

  it("con un import Excel in corso la fascia mostra l'avanzamento senza aprire la finestra", async () => {
    finti.importJob = { ...JOB_FERMO, inCorso: true, stato: statoImport() };
    apri();

    const fascia = screen.getByRole("status", { name: "Import Excel in corso" });
    expect(fascia).toHaveTextContent("812 di 1.310 righe · 3 creati · 790 aggiornati · 19 scartati");
    expect(within(fascia).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(screen.queryByText("Importa l'anagrafica da Excel")).not.toBeInTheDocument();

    await userEvent.click(within(fascia).getByRole("button", { name: "Dettagli" }));
    expect(await screen.findByText("Importa l'anagrafica da Excel")).toBeInTheDocument();
  });

  it("le righe dei volantini non abbinate hanno il suggerimento e sono paginate dal server", async () => {
    finti.righe = {
      data: { righe: RIGHE_NON_ABBINATE, totale: 23, pagina: 1, dimensione: 10 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    apri();

    const sezione = regione("Righe dei volantini non abbinate");
    expect(within(sezione).getByRole("link", { name: /Stesso telefono di Punto vendita 7/ })).toHaveAttribute(
      "href",
      "/gestione-interna/punti-vendita/pv7"
    );
    expect(within(sezione).getByText("Forse chiuso")).toBeInTheDocument();
    expect(within(sezione).getByText("Da aggiungere?")).toBeInTheDocument();
    expect(within(sezione).getByText("Mostrati 1–10 di 23 righe")).toBeInTheDocument();
    expect(finti.richiesteRighe.at(-1)).toEqual([1, 10]);

    await userEvent.click(within(sezione).getByLabelText("Pagina successiva"));
    expect(finti.richiesteRighe.at(-1)).toEqual([2, 10]);
  });

  it("una riga da aggiungere apre Nuovo punto vendita con indirizzo, città e telefono stampati", async () => {
    finti.righe = {
      data: { righe: RIGHE_NON_ABBINATE, totale: 3, pagina: 1, dimensione: 10 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    apri();

    await userEvent.click(
      within(regione("Righe dei volantini non abbinate")).getByRole("button", { name: "Aggiungi ARMA DI TAGGIA - P.zza Chierotti 4" })
    );

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Nuovo punto vendita");
    expect(within(dialogo).getByLabelText("Indirizzo")).toHaveValue("P.zza Chierotti 4");
    expect(within(dialogo).getByLabelText("Città")).toHaveValue("Arma di Taggia");
    expect(within(dialogo).getByLabelText("Telefono")).toHaveValue("0184 000 111");
  });

  it("Collega sulla riga con lo stesso telefono apre il dialogo con quel punto vendita già scelto e collega tutto il gruppo", async () => {
    finti.righe = { data: { righe: RIGHE_NON_ABBINATE, totale: 3, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };
    finti.collega.mutate = vi.fn((_richiesta, opzioni) => opzioni?.onSuccess?.({ idCollegamento: "c1", righe: 40 }));
    apri();
    const sezione = regione("Righe dei volantini non abbinate");

    const pulsante = within(sezione).getByRole("button", { name: "Collega SANREMO - Via Roma 3 - tel. 0184 555 0143" });
    expect(pulsante).toHaveTextContent("Collega a Punto vendita 7");
    await userEvent.click(pulsante);

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Collega a un punto vendita");
    // Le varianti stampate del gruppo: verranno collegate tutte
    expect(within(dialogo).getByText("SANREMO - V. Roma 3 - tel. 0184 555 0143")).toBeInTheDocument();
    const suggeriti = within(dialogo).getByRole("list", { name: "Punti vendita suggeriti" });
    expect(within(suggeriti).getByRole("radio", { name: /Punto vendita 7/ })).toBeChecked();
    expect(within(suggeriti).getByText("Indirizzo simile")).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Collega" }));

    expect(finti.collega.mutate).toHaveBeenCalledWith({ chiave: "tel:01845550143", idPuntoVendita: "pv7" }, expect.anything());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(sezione).getByText("40 righe dei volantini collegate a Punto vendita 7.")).toBeInTheDocument();
  });

  it("senza suggerimenti il punto vendita si cerca fra tutti quelli della GDO; Collega resta spento finché non se ne sceglie uno", async () => {
    finti.righe = { data: { righe: RIGHE_NON_ABBINATE, totale: 3, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };
    apri();

    await userEvent.click(within(regione("Righe dei volantini non abbinate")).getByRole("button", { name: "Collega ALASSIO - Via Dante 88" }));
    const dialogo = await screen.findByRole("dialog");
    // Solo fra i punti vendita dell'insegna e dell'area dei volantini della riga
    expect(dialogo).toHaveTextContent("Nessun punto vendita di Super · Nord con lo stesso telefono, indirizzo o località, né vicino");
    const collega = within(dialogo).getByRole("button", { name: "Collega" });
    expect(collega).toBeDisabled();

    await userEvent.type(within(dialogo).getByLabelText("Cerca il punto vendita da collegare"), "vendita 12");
    await userEvent.click(within(within(dialogo).getByRole("list", { name: "Punti vendita trovati" })).getByRole("radio", { name: /Punto vendita 12/ }));
    await userEvent.click(collega);

    expect(finti.collega.mutate).toHaveBeenCalledWith({ chiave: "ind:ALASSIO|VIA DANTE 88", idPuntoVendita: "pv12" }, expect.anything());
  });

  it("il numero di volantini apre i volantini in cui compare la riga, ognuno con la riga stampata e il volantino da aprire", async () => {
    finti.righe = { data: { righe: RIGHE_NON_ABBINATE, totale: 3, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };
    apri();
    // Finché non si chiedono, i volantini non si caricano
    expect(finti.richiesteVolantini).toEqual([]);

    await userEvent.click(within(regione("Righe dei volantini non abbinate")).getByRole("button", { name: "Volantini di ALASSIO - Via Dante 88" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Volantini con questa riga");
    expect(finti.richiesteVolantini).toContain("ind:ALASSIO|VIA DANTE 88");
    const voci = within(within(dialogo).getByRole("list", { name: "Volantini della riga" })).getAllByRole("listitem");
    expect(voci).toHaveLength(2);
    expect(voci[0]).toHaveTextContent("CC LI 11");
    expect(voci[0]).toHaveTextContent("Volantino marzo");
    expect(voci[0]).toHaveTextContent("Super · Nord");
    expect(voci[1]).toHaveTextContent("«ALASSIO - V. Dante 88»");
    expect(within(voci[0]).getByRole("link", { name: /Apri volantino/ })).toHaveAttribute("href", "/volantini/tutti_i_volantini?kit=k131");
  });

  it("senza il permesso dei materiali i volantini della riga si vedono ma non si aprono", async () => {
    finti.righe = { data: { righe: RIGHE_NON_ABBINATE, totale: 3, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };
    finti.puoConsultareVolantini = false;
    apri();

    await userEvent.click(within(regione("Righe dei volantini non abbinate")).getByRole("button", { name: "Volantini di ALASSIO - Via Dante 88" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getAllByRole("listitem")).toHaveLength(2);
    expect(within(dialogo).queryByRole("link", { name: /Apri volantino/ })).not.toBeInTheDocument();
  });

  it("nel dialogo Collega: i volantini della riga a richiesta, la ragione sociale dei suggeriti e la ricerca per ragione sociale", async () => {
    finti.puntiVendita = {
      ...finti.puntiVendita,
      data: [puntoVendita(1), puntoVendita(2, { nome: "Conad Lucca", ragionesociale: "Lucca Market Srl" })],
    };
    finti.righe = {
      data: {
        righe: [{
          ...RIGHE_NON_ABBINATE[1],
          candidati: [{ puntoVendita: { id: "pv1", nome: "Superstore Alassio", ragioneSociale: "Dante Market Srl", indirizzo: "Via Roma 1", citta: "Alassio" }, motivo: "nome_simile" }],
        }],
        totale: 1,
        pagina: 1,
        dimensione: 10,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    apri();

    await userEvent.click(within(regione("Righe dei volantini non abbinate")).getByRole("button", { name: "Collega ALASSIO - Via Dante 88" }));
    const dialogo = await screen.findByRole("dialog");

    const suggeriti = within(dialogo).getByRole("list", { name: "Punti vendita suggeriti" });
    expect(suggeriti).toHaveTextContent("Dante Market Srl");
    expect(suggeriti).toHaveTextContent("Nome o ragione sociale");

    expect(within(dialogo).queryByRole("list", { name: "Volantini della riga" })).not.toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole("button", { name: "In quali volantini" }));
    expect(within(within(dialogo).getByRole("list", { name: "Volantini della riga" })).getAllByRole("listitem")).toHaveLength(2);

    await userEvent.type(within(dialogo).getByLabelText("Cerca il punto vendita da collegare"), "lucca market");
    expect(within(within(dialogo).getByRole("list", { name: "Punti vendita trovati" })).getByRole("radio", { name: /Conad Lucca/ })).toBeInTheDocument();
  });

  it("Collegate a mano elenca i collegamenti; Scollega chiede conferma nella riga prima di annullare", async () => {
    finti.righe = { data: { righe: RIGHE_NON_ABBINATE, totale: 3, pagina: 1, dimensione: 10 }, isLoading: false, isError: false, refetch: vi.fn() };
    finti.collegamenti = {
      data: {
        collegamenti: [{
          id: "c1",
          riga: "PRA - Via Murtola 12/14 - tel. 010 6197180",
          puntoVendita: { id: "pv3", nome: "Punto vendita 3", indirizzo: "Via Roma 3", citta: "Firenze" },
          righe: 40,
          creatoIl: "2026-11-06T10:00:00Z",
        }],
        totale: 1,
        pagina: 1,
        dimensione: 10,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    apri();
    const sezione = regione("Righe dei volantini non abbinate");

    await userEvent.click(within(sezione).getByRole("radio", { name: /Collegate a mano/ }));

    expect(within(sezione).getByText("PRA - Via Murtola 12/14 - tel. 010 6197180")).toBeInTheDocument();
    expect(within(sezione).getByRole("link", { name: "Punto vendita 3" })).toHaveAttribute("href", "/gestione-interna/punti-vendita/pv3");
    await userEvent.click(within(sezione).getByRole("button", { name: "Scollega PRA - Via Murtola 12/14 - tel. 010 6197180" }));
    expect(finti.scollega.mutate).not.toHaveBeenCalled();
    await userEvent.click(within(sezione).getByRole("button", { name: "Conferma" }));
    expect(finti.scollega.mutate).toHaveBeenCalledWith("c1", expect.anything());
  });

  it("senza righe da abbinare ma con collegamenti fatti a mano il riquadro mostra i collegamenti", () => {
    finti.collegamenti = {
      ...COLLEGAMENTI_VUOTI,
      data: {
        collegamenti: [{ id: "c1", riga: "PRA - Via Murtola 12/14", puntoVendita: { id: "pv3", nome: "Punto vendita 3", indirizzo: null, citta: null }, righe: 2, creatoIl: "2026-11-06T10:00:00Z" }],
        totale: 1,
        pagina: 1,
        dimensione: 10,
      },
    };
    apri();

    const riquadro = regione("Righe dei volantini non abbinate");
    expect(within(riquadro).getByRole("radio", { name: /Collegate a mano/ })).toHaveAttribute("aria-checked", "true");
    expect(within(riquadro).getByText("PRA - Via Murtola 12/14")).toBeInTheDocument();
  });

  it("senza righe da abbinare il riquadro si riduce a una riga, senza tabella vuota", () => {
    apri();

    const riquadro = regione("Righe dei volantini non abbinate");
    expect(riquadro).toHaveTextContent("Tutte le righe dei volantini sono abbinate");
    expect(within(riquadro).queryByRole("table")).not.toBeInTheDocument();
    expect(within(riquadro).queryByText(/Mostrati/)).not.toBeInTheDocument();
  });

  it("le righe non abbinate in attesa non disegnano la tabella: l'attesa sta fuori, a tutta larghezza", () => {
    finti.righe = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    apri();

    const riquadro = regione("Righe dei volantini non abbinate");
    expect(within(riquadro).getByLabelText("Caricamento delle righe non abbinate")).toHaveAttribute("aria-busy", "true");
    expect(within(riquadro).queryByRole("table")).not.toBeInTheDocument();
  });

  it("se le righe non abbinate non arrivano lo dice con Riprova", async () => {
    const refetch = vi.fn();
    finti.righe = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch };
    apri();

    const sezione = regione("Righe dei volantini non abbinate");
    expect(within(sezione).getByRole("alert")).toHaveTextContent("Timeout");
    // L'errore sta fuori dalla tabella: nessuna colonna lo taglia
    expect(within(sezione).queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(within(sezione).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("la vista Mappa sostituisce la tabella", async () => {
    apri();

    expect(screen.queryByTestId("mappa")).not.toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Vista" })).getByRole("radio", { name: "Mappa" }));

    expect(screen.getByTestId("mappa")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Punto vendita 1" })).not.toBeInTheDocument();
  });

  it("nel dialogo Collega: solo punti vendita della stessa insegna e area, i suggeriti col confronto e Google Maps", async () => {
    finti.puntiVendita = {
      ...finti.puntiVendita,
      data: [puntoVendita(1), puntoVendita(2, { nome: "Conad Lucca Sud", id_area: "a2", nome_area: "Sud" }), puntoVendita(3, { nome: "Conad Lucca Nord" })],
    };
    finti.righe = {
      data: {
        righe: [{
          ...RIGHE_NON_ABBINATE[1],
          posizione: { chiave: "ind:ALASSIO|VIA DANTE 88", lat: 44.0, lon: 8.17, precisione: "via", fonte: "nominatim", errore: null, aggiornataIl: "2026-11-11T09:00:00Z" },
          candidati: [{ puntoVendita: pvConfrontato(1, { nome: "Superstore Alassio", lat: 44.001, lon: 8.171 }), motivo: "vicino", confronto: confronto({ distanzaMetri: 150 }) }],
        }],
        totale: 1, pagina: 1, dimensione: 10,
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    };
    apri();

    await userEvent.click(within(regione("Righe dei volantini non abbinate")).getByRole("button", { name: "Collega ALASSIO - Via Dante 88" }));
    const dialogo = await screen.findByRole("dialog");

    expect(dialogo).toHaveTextContent("Posizione da OpenStreetMap: solo la via");
    expect(within(dialogo).getByRole("link", { name: "Apri l'indirizzo stampato in Google Maps" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Via%20Dante%2088%2C%20Alassio"
    );
    expect(within(dialogo).getByRole("link", { name: "Apri l'indirizzo stampato in Street View" })).toHaveAttribute("target", "_blank");
    const suggeriti = within(dialogo).getByRole("list", { name: "Punti vendita suggeriti" });
    expect(suggeriti).toHaveTextContent("Vicino");
    expect(suggeriti).toHaveTextContent("a 150 m");
    expect(suggeriti).toHaveTextContent("Super · Nord");

    // La ricerca non trova i punti vendita di un'altra area
    await userEvent.type(within(dialogo).getByLabelText("Cerca il punto vendita da collegare"), "lucca");
    const trovati = within(dialogo).getByRole("list", { name: "Punti vendita trovati" });
    expect(within(trovati).getByRole("radio", { name: /Conad Lucca Nord/ })).toBeInTheDocument();
    expect(within(trovati).queryByRole("radio", { name: /Conad Lucca Sud/ })).not.toBeInTheDocument();
  });

  it("verifica dei collegamenti: gli incongruenti col motivo; il dettaglio confronta stampato e anagrafica, Cambia collegamento usa il cambio", async () => {
    finti.verifica = { data: verifica([GRUPPO_MARINA]), isLoading: false, isError: false, refetch: vi.fn() };
    finti.cambia.mutate = vi.fn((_richiesta, opzioni) => opzioni?.onSuccess?.({ idCollegamento: "c9", righe: 2 }));
    apri();
    const sezione = regione("Verifica dei collegamenti");

    // Si parte dagli incongruenti
    expect(finti.richiesteVerifica.at(-1)).toMatchObject({ esito: "incongruente", tipo: null, pagina: 1 });
    expect(within(sezione).getByText("Incongruente")).toBeInTheDocument();
    expect(within(sezione).getByText("122 km fra la posizione stampata (della via) e il punto vendita")).toBeInTheDocument();

    await userEvent.click(within(sezione).getByRole("button", { name: /MARINA DI MASSA Via S. Leonardo 350/ }));
    const confrontoTabella = within(sezione).getByRole("table", { name: "Stampato nei volantini e anagrafica" });
    expect(confrontoTabella).toHaveTextContent("Via Don Luigi Rossi 5");
    expect(confrontoTabella).toHaveTextContent("Località diverso");
    expect(within(sezione).getByRole("list", { name: "Punti vendita vicini" })).toHaveTextContent("Conad Marina");
    expect(within(sezione).getByRole("link", { name: "Apri Massa Marittima in Street View" })).toBeInTheDocument();

    await userEvent.click(within(sezione).getByRole("button", { name: "Collega a Conad Marina" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Cambia collegamento");
    expect(dialogo).toHaveTextContent("Oggi collegato a Massa Marittima");
    expect(within(within(dialogo).getByRole("list", { name: "Punti vendita suggeriti" })).getByRole("radio", { name: /Conad Marina/ })).toBeChecked();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Cambia" }));

    expect(finti.cambia.mutate).toHaveBeenCalledWith(
      { chiave: GRUPPO_MARINA.chiave, idPuntoVenditaAttuale: "pv5", idPuntoVendita: "pv6" },
      expect.anything()
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(sezione).getByText("2 righe dei volantini collegate a Conad Marina.")).toBeInTheDocument();
  });

  it("verifica: filtri per esito e tipo; Scollega solo per i collegamenti fatti a mano, con conferma", async () => {
    finti.verifica = { data: verifica([GRUPPO_MARINA]), isLoading: false, isError: false, refetch: vi.fn() };
    apri();
    const sezione = regione("Verifica dei collegamenti");

    await userEvent.click(within(within(sezione).getByRole("radiogroup", { name: "Esito della verifica" })).getByRole("radio", { name: /Tutti/ }));
    expect(finti.richiesteVerifica.at(-1)).toMatchObject({ esito: null });
    await userEvent.click(within(within(sezione).getByRole("radiogroup", { name: "Tipo di collegamento" })).getByRole("radio", { name: "A mano" }));
    expect(finti.richiesteVerifica.at(-1)).toMatchObject({ tipo: "manuale" });

    await userEvent.click(within(sezione).getByRole("button", { name: /MARINA DI MASSA Via S. Leonardo 350/ }));
    await userEvent.click(within(sezione).getByRole("button", { name: "Scollega MARINA DI MASSA Via S. Leonardo 350" }));
    expect(finti.scollega.mutate).not.toHaveBeenCalled();
    await userEvent.click(within(sezione).getByRole("button", { name: "Conferma" }));
    expect(finti.scollega.mutate).toHaveBeenCalledWith("c9", expect.anything());
  });

  it("Correggi la posizione rifiuta un testo senza coordinate e salva quelle di un link di Google Maps", async () => {
    finti.verifica = { data: verifica([GRUPPO_MARINA]), isLoading: false, isError: false, refetch: vi.fn() };
    apri();
    const sezione = regione("Verifica dei collegamenti");
    await userEvent.click(within(sezione).getByRole("button", { name: /MARINA DI MASSA Via S. Leonardo 350/ }));

    await userEvent.click(within(sezione).getByRole("button", { name: "Correggi la posizione" }));
    const campo = within(sezione).getByLabelText(/Coordinate o link di Google Maps/);
    await userEvent.type(campo, "via roma");
    await userEvent.click(within(sezione).getByRole("button", { name: "Salva la posizione" }));
    expect(within(sezione).getByRole("alert")).toHaveTextContent("Coordinate non riconosciute");
    expect(finti.correggi.mutate).not.toHaveBeenCalled();

    await userEvent.clear(campo);
    await userEvent.type(campo, "https://www.google.com/maps/@44.0101,10.108,17z");
    await userEvent.click(within(sezione).getByRole("button", { name: "Salva la posizione" }));
    expect(finti.correggi.mutate).toHaveBeenCalledWith({ chiave: GRUPPO_MARINA.chiave, lat: 44.0101, lon: 10.108 }, expect.anything());
  });

  it("ricerca delle posizioni: Cerca le posizioni la avvia; in corso mostra l'avanzamento e si annulla", async () => {
    const avvia = vi.fn();
    finti.verifica = { data: verifica([GRUPPO_MARINA], { posizioniDaCercare: 120, posizioniNonTrovate: 3 }), isLoading: false, isError: false, refetch: vi.fn() };
    finti.posizioni = { ...RICERCA_FERMA, avvia };
    const { unmount } = apri();
    const sezione = regione("Verifica dei collegamenti");

    expect(sezione).toHaveTextContent("120 indirizzi stampati senza posizione");
    await userEvent.click(within(sezione).getByRole("button", { name: "Cerca le posizioni" }));
    expect(avvia).toHaveBeenCalledWith();
    await userEvent.click(within(sezione).getByRole("button", { name: "Riprova le non trovate" }));
    expect(avvia).toHaveBeenCalledWith({ nonTrovate: true });
    unmount();

    const annulla = vi.fn();
    finti.posizioni = {
      ...RICERCA_FERMA,
      inCorso: true,
      annulla,
      stato: { jobId: "j1", stato: "in_corso", totale: 120, esaminate: 30, trovate: 25, approssimate: 6, nonTrovate: 4, errori: 1, avviatoIl: "2026-11-11T10:00:00Z" },
    };
    apri();
    const avanzamento = screen.getByRole("status", { name: "Ricerca delle posizioni in corso" });
    expect(avanzamento).toHaveTextContent("Ricerca delle posizioni: 30 di 120");
    expect(avanzamento).toHaveTextContent("25 trovate (6 solo via o comune) · 4 non trovate · 1 errori di OpenStreetMap");
    expect(within(avanzamento).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    await userEvent.click(within(avanzamento).getByRole("button", { name: "Annulla" }));
    expect(annulla).toHaveBeenCalled();
  });
});
