// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReteInsegne, StoriaInElenco } from "../../../lib/puntiVendita/analisi";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";

// Consultazione dei punti vendita (/punti-vendita): spec anagrafica-punti-vendita,
// "Vista dei punti vendita per canale e area" ed "Elenco e ricerca dei punti vendita"

const finti = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  rete: {} as Record<string, unknown>,
  permessi: new Set<string>(),
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
// La mappa vera non serve: Leaflet in jsdom non disegna nulla
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div data-testid="mappa" />,
  TileLayer: () => null,
  CircleMarker: () => null,
  Popup: () => null,
  useMap: () => ({ fitBounds: vi.fn() }),
}));
vi.mock("@/components/SessionChecker", () => ({ default: <P extends object>(Componente: ComponentType<P>) => Componente }));
vi.mock("@/context/PermissionContext", () => ({ usePermission: (codice: string) => finti.permessi.has(codice) }));
vi.mock("@/query/query", () => ({
  useFetchPuntiVenditaConsultazione: () => finti.query,
  useFetchReteInsegne: () => finti.rete,
}));

import PuntiVenditaConsultazione from ".";

type ConStoria = PuntoVenditaConsultazione & { storia?: StoriaInElenco };

const CITY = { id: "c-city", nome: "Conad City" };
const SUPERSTORE = { id: "c-sup", nome: "Conad Superstore" };

const RETE: ReteInsegne = {
  anni: [2024, 2025, 2026],
  insegne: [
    {
      canale: CITY,
      puntiVendita: 2,
      nelleListe: [
        { anno: 2024, puntiVendita: 3 },
        { anno: 2025, puntiVendita: 2 },
        { anno: 2026, puntiVendita: 2 },
      ],
    },
    { canale: SUPERSTORE, puntiVendita: 1, nelleListe: [{ anno: 2025, puntiVendita: 1 }, { anno: 2026, puntiVendita: 1 }] },
    // Un'insegna dei soli volantini passati: niente barra, solo la linea
    { canale: { id: "c-margherita", nome: "Margherita" }, puntiVendita: 0, nelleListe: [{ anno: 2024, puntiVendita: 4 }] },
  ],
};

const STORIE: Record<string, StoriaInElenco> = {
  "pv-lucca": {
    volantini: 12,
    cambioInsegna: false,
    insegnePerAnno: [
      { anno: 2024, canale: CITY },
      { anno: 2025, canale: CITY },
      { anno: 2026, canale: CITY },
    ],
  },
  "pv-pisa": {
    volantini: 30,
    cambioInsegna: true,
    insegnePerAnno: [
      { anno: 2024, canale: CITY },
      { anno: 2025, canale: SUPERSTORE },
      { anno: 2026, canale: SUPERSTORE },
    ],
  },
};

const conStoria = (puntiVendita: PuntoVenditaConsultazione[]): ConStoria[] =>
  puntiVendita.map(p => (STORIE[p.id] ? { ...p, storia: STORIE[p.id] } : p));

const pv = (dati: Partial<PuntoVenditaConsultazione> & { id: string; nome: string }): PuntoVenditaConsultazione => ({
  ragioneSociale: null,
  indirizzo: "Via Roma 1",
  cap: "55100",
  citta: "Lucca",
  provincia: "LU",
  regione: "Toscana",
  telefono: null,
  canale: { id: "c-city", nome: "Conad City", codice: "CC" },
  area: { id: "a-tos", nome: "Toscana", codice: "TO" },
  meta: {},
  coordinate: { lat: 43.84, lon: 10.5 },
  ...dati,
});

const PUNTI_VENDITA = [
  pv({ id: "pv-lucca", nome: "Conad Lucca", meta: { id_anacan: "004512", insegna: "Conad City" } }),
  pv({ id: "pv-genova", nome: "Conad Genova", citta: "Genova", area: { id: "a-lig", nome: "Liguria", codice: "LI" }, coordinate: null }),
  pv({ id: "pv-pisa", nome: "Superstore Pisa", citta: "Pisa", canale: { id: "c-sup", nome: "Conad Superstore", codice: "CS" } }),
];

const apri = () =>
  render(
    <MemoryRouter initialEntries={["/punti-vendita"]}>
      <Routes>
        <Route path="/punti-vendita" element={<PuntiVenditaConsultazione />} />
        <Route path="/punti-vendita/:id" element={<div>Scheda aperta</div>} />
      </Routes>
    </MemoryRouter>
  );

/** I nomi dei punti vendita nell'elenco, nell'ordine mostrato. */
const nomiInElenco = () =>
  within(screen.getByRole("list", { name: "Punti vendita" }))
    .getAllByRole("link")
    .map(link => link.getAttribute("aria-label")?.split(",")[0]);
const chip = (gruppo: string, nome: RegExp) => within(screen.getByRole("group", { name: gruppo })).getByRole("button", { name: nome });
const regione = (nome: string) => screen.getByRole("region", { name: nome });

describe("Consultazione dei punti vendita", () => {
  beforeEach(() => {
    finti.permessi = new Set(["gdo.visualizza"]);
    finti.query = { data: conStoria(PUNTI_VENDITA), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
    finti.rete = { data: RETE, isLoading: false, isError: false, refetch: vi.fn() };
  });

  it("intestazione con i conteggi ed elenco in sola lettura, senza la mappa finché non si sceglie", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Punti vendita" })).toBeInTheDocument();
    expect(screen.getByText("3 punti vendita · 2 insegne · 2 aree")).toBeInTheDocument();
    expect(nomiInElenco()).toEqual(["Conad Lucca", "Conad Genova", "Superstore Pisa"]);
    expect(screen.queryByTestId("mappa")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuovo punto vendita|Importa|Modifica|Elimina/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Azioni punto vendita/ })).not.toBeInTheDocument();
  });

  it("la rete per insegna: punti vendita di oggi per insegna, dalla più grande", () => {
    apri();

    const dati = within(regione("La rete per insegna")).getByRole("table", { name: "Punti vendita per insegna" });
    const righe = within(dati).getAllByRole("row").slice(1).map(r => r.textContent);
    // Margherita non ha punti vendita oggi: niente barra
    expect(righe).toEqual(["Conad City2", "Conad Superstore1"]);
  });

  it("i punti vendita nei volantini: una linea per insegna, anno per anno, con il vuoto dove non c'è", () => {
    apri();

    const dati = within(regione("Punti vendita nei volantini")).getByRole("table", {
      name: "Punti vendita nelle liste dei volantini, per anno e insegna",
    });
    const intestazioni = within(dati).getAllByRole("columnheader").map(c => c.textContent);
    expect(intestazioni).toEqual(["Anno", "Conad City", "Conad Superstore", "Margherita"]);
    const righe = within(dati).getAllByRole("row").slice(1).map(r => within(r).getAllByRole("cell").map(c => c.textContent));
    expect(righe).toEqual([
      ["3", "—", "4"],
      ["2", "1", "—"],
      ["2", "1", "—"],
    ]);
  });

  it("senza dati della rete le infografiche lo dicono invece di disegnare grafici vuoti", () => {
    finti.rete = { data: { anni: [], insegne: [] }, isLoading: false, isError: false, refetch: vi.fn() };
    apri();

    expect(within(regione("La rete per insegna")).getByText("Nessuna insegna ha punti vendita in anagrafica.")).toBeInTheDocument();
    expect(within(regione("La rete per insegna")).getByText(/Nessun volantino importato/)).toBeInTheDocument();
  });

  it("senza volantini importati la rete di oggi sta da sola, con una nota al posto del riquadro vuoto", () => {
    finti.rete = {
      data: { anni: [], insegne: RETE.insegne.map(i => ({ ...i, nelleListe: [] })) },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    apri();

    const rete = regione("La rete per insegna");
    expect(within(rete).getByRole("table", { name: "Punti vendita per insegna" })).toBeInTheDocument();
    expect(within(rete).getByText(/Nessun volantino importato/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Punti vendita nei volantini" })).not.toBeInTheDocument();
  });

  it("se la rete non arriva lo dice con Riprova, e l'elenco resta", async () => {
    const refetch = vi.fn();
    finti.rete = { data: undefined, isLoading: false, isError: true, error: new Error("Timeout"), refetch };
    apri();

    const avviso = screen.getAllByRole("alert").find(a => a.textContent?.includes("Infografiche non disponibili"));
    expect(avviso).toHaveTextContent("Timeout");
    await userEvent.click(within(avviso!).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
    expect(nomiInElenco()).toHaveLength(3);
  });

  it("un clic su una barra filtra l'elenco per quell'insegna; un secondo clic toglie il filtro", async () => {
    apri();

    const barra = within(regione("La rete per insegna")).getByRole("button", { name: "Conad Superstore: 1" });
    await userEvent.click(barra);

    expect(nomiInElenco()).toEqual(["Superstore Pisa"]);
    expect(chip("Insegna", /^Conad Superstore/)).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(barra);
    expect(nomiInElenco()).toHaveLength(3);
  });

  it("ogni riga ha l'insegna nei volantini anno per anno, i volantini e il cambio di insegna; apre la scheda", async () => {
    apri();

    const pisa = screen.getByRole("link", { name: /^Superstore Pisa/ });
    expect(pisa).toHaveAttribute("href", "/punti-vendita/pv-pisa");
    expect(pisa).toHaveAccessibleName(
      "Superstore Pisa, Via Roma 1 - 55100 Pisa (LU), Conad Superstore, 30 volantini, nei volantini: Conad City 2024 · Conad Superstore 2025–2026, ha cambiato insegna"
    );
    expect(within(pisa).getByTitle("2024: Conad City")).toBeInTheDocument();
    expect(within(pisa).getByTitle("2025: Conad Superstore")).toBeInTheDocument();
    expect(within(pisa).getByText("Ha cambiato insegna")).toBeInTheDocument();

    const lucca = screen.getByRole("link", { name: /^Conad Lucca/ });
    expect(lucca).toHaveTextContent("12 volantini");
    expect(within(lucca).queryByText("Ha cambiato insegna")).not.toBeInTheDocument();
    // Insegna e area sotto l'indirizzo, con i codici che identificano il punto vendita: l'insegna dei meta non è un codice
    expect(lucca).toHaveTextContent("Conad City · Toscana");
    expect(lucca).toHaveTextContent("ID ANACAN 004512");
    expect(lucca).not.toHaveTextContent("INSEGNA");

    // Mai nei volantini: tutti gli anni in grigio, 0 volantini
    const genova = screen.getByRole("link", { name: /^Conad Genova/ });
    expect(genova).toHaveAccessibleName(/0 volantini, mai nei volantini$/);
    expect(within(genova).getAllByTitle(/nessun volantino$/)).toHaveLength(3);

    await userEvent.click(lucca);
    expect(await screen.findByText("Scheda aperta")).toBeInTheDocument();
  });

  it("se il server non manda la storia con l'elenco, le righe non mostrano striscia né volantini", () => {
    finti.query = { ...finti.query, data: PUNTI_VENDITA };
    apri();

    const lucca = screen.getByRole("link", { name: /^Conad Lucca/ });
    expect(lucca).toHaveAccessibleName("Conad Lucca, Via Roma 1 - 55100 Lucca (LU), Conad City");
    expect(within(lucca).queryByTitle(/2024/)).not.toBeInTheDocument();
    expect(lucca).not.toHaveTextContent("volantini");
  });

  it("i filtri stanno accanto ai risultati: insegna a chip e area a tendina, con i conteggi", async () => {
    apri();

    expect(within(chip("Insegna", /^Tutte/)).getByText("3")).toBeInTheDocument();
    expect(within(chip("Insegna", /^Conad City/)).getByText("2")).toBeInTheDocument();
    expect(within(chip("Insegna", /^Conad Superstore/)).getByText("1")).toBeInTheDocument();
    const area = screen.getByRole("combobox", { name: "Area" });
    expect(within(area).getAllByRole("option").map(o => o.textContent)).toEqual(["Tutte le aree", "Liguria (1)", "Toscana (2)"]);

    await userEvent.click(chip("Insegna", /^Conad City/));

    expect(chip("Insegna", /^Conad City/)).toHaveAttribute("aria-pressed", "true");
    expect(nomiInElenco()).toEqual(["Conad Lucca", "Conad Genova"]);
    // L'area conta i punti vendita dell'insegna scelta
    expect(within(area).getAllByRole("option").map(o => o.textContent)).toEqual(["Tutte le aree", "Liguria (1)", "Toscana (1)"]);

    await userEvent.selectOptions(area, "a-lig");
    expect(nomiInElenco()).toEqual(["Conad Genova"]);
  });

  it("la vista Elenco e mappa aggiunge la mappa e dice chi non ha coordinate", async () => {
    apri();

    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Vista" })).getByRole("radio", { name: "Elenco e mappa" }));

    expect(screen.getByTestId("mappa")).toBeInTheDocument();
    expect(screen.getByText("1 punto vendita filtrato non ha coordinate e non compare sulla mappa.")).toBeInTheDocument();
    expect(nomiInElenco()).toHaveLength(3);
  });

  it("mentre l'elenco si carica mostra le righe di attesa", () => {
    finti.query = { data: undefined, isLoading: true, isFetching: true, isError: false, refetch: vi.fn() };
    apri();

    expect(screen.getByRole("list", { name: "Caricamento dei punti vendita" })).toHaveAttribute("aria-busy", "true");
  });

  it("la ricerca trova anche per città e codice GDO", async () => {
    apri();

    await userEvent.type(screen.getByRole("searchbox", { name: "Cerca punto vendita" }), "004512");

    expect(await screen.findByText("Mostrati 1–1 di 1")).toBeInTheDocument();
    expect(nomiInElenco()).toEqual(["Conad Lucca"]);
  });

  it("senza risultati propone di azzerare i filtri", async () => {
    apri();

    await userEvent.type(screen.getByRole("searchbox", { name: "Cerca punto vendita" }), "Milano");

    expect(await screen.findByText("Nessun risultato")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Azzera filtri/ }));
    expect(await screen.findByRole("link", { name: /^Conad Lucca/ })).toBeInTheDocument();
  });

  it("la gestione si apre solo con il permesso di gestire i punti vendita", () => {
    apri();
    expect(screen.queryByRole("link", { name: /Gestisci punti vendita/ })).not.toBeInTheDocument();
  });

  it("con il permesso di gestione c'è il collegamento alla gestione interna", () => {
    finti.permessi = new Set(["gdo.visualizza", "gdo.gestisci_punti_vendita"]);
    apri();

    expect(screen.getByRole("link", { name: /Gestisci punti vendita/ })).toHaveAttribute("href", "/gestione-interna/punti-vendita");
  });

  it("se l'elenco non arriva mostra l'errore con Riprova", async () => {
    const refetch = vi.fn();
    finti.query = { data: undefined, isLoading: false, isFetching: false, isError: true, error: new Error("Servizio non raggiungibile"), refetch };
    apri();

    const avvisi = screen.getAllByRole("alert").filter(a => a.textContent?.includes("Punti vendita non caricati"));
    expect(avvisi.length).toBeGreaterThan(0);
    expect(avvisi[0]).toHaveTextContent("Servizio non raggiungibile");
    await userEvent.click(within(avvisi[0]).getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalled();
  });
});
