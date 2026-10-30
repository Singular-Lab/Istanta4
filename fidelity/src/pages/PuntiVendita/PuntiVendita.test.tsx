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
  importJob: {} as Record<string, unknown>,
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
  Popup: () => null,
  Tooltip: () => null,
  useMap: () => ({ fitBounds: vi.fn() }),
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
}));
vi.mock("./useImportPuntiVendita", () => ({ useImportPuntiVendita: () => finti.importJob }));

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

const RIGHE_NON_ABBINATE = [
  {
    riga: "SANREMO - Via Roma 3 - tel. 0184 555 0143",
    localita: "Sanremo",
    indirizzo: "Via Roma 3",
    telefono: "0184 555 0143",
    volantini: 40,
    primoVolantino: "2021-03-01",
    ultimoVolantino: "2022-08-12",
    canale: { id: "c1", nome: "Super" },
    suggerimento: { tipo: "stesso_telefono", puntoVendita: { id: "pv7", nome: "Punto vendita 7" } },
  },
  {
    riga: "ALASSIO - Via Dante 88",
    localita: "Alassio",
    indirizzo: "Via Dante 88",
    telefono: null,
    volantini: 131,
    primoVolantino: "2019-01-10",
    ultimoVolantino: "2025-03-14",
    canale: null,
    suggerimento: { tipo: "forse_chiuso" },
  },
  {
    riga: "ARMA DI TAGGIA - P.zza Chierotti 4",
    localita: "Arma di Taggia",
    indirizzo: "P.zza Chierotti 4",
    telefono: "0184 000 111",
    volantini: 12,
    primoVolantino: "2026-01-09",
    ultimoVolantino: "2026-10-23",
    canale: { id: "c1", nome: "Super" },
    suggerimento: { tipo: "da_aggiungere" },
  },
];

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
    finti.importJob = { ...JOB_FERMO };
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
});
