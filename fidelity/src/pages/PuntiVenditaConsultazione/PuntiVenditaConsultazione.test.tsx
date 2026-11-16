// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoriaInElenco } from "../../../lib/puntiVendita/analisi";
import type { PuntoVenditaConsultazione } from "../../../lib/puntiVendita/consultazione";

// Consultazione dei punti vendita (/punti-vendita): spec anagrafica-punti-vendita,
// "Vista dei punti vendita per canale e area", "Elenco e ricerca dei punti vendita", "Rete dei punti
// vendita e qualità dei dati", "Elenco e mappa della consultazione secondo i volantini" e
// "Ricerca per codice del sistema della GDO"

const finti = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
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
  // Solo per i colori delle insegne: senza rete vengono dall'anagrafica
  useFetchReteInsegne: () => ({ data: undefined }),
}));

import PuntiVenditaConsultazione from ".";

type ConStoria = PuntoVenditaConsultazione & { storia?: StoriaInElenco };

const CITY = { id: "c-city", nome: "Conad City" };
const SUPERSTORE = { id: "c-sup", nome: "Conad Superstore" };

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
  combinazioneConVolantini: true,
  ...dati,
});

const PUNTI_VENDITA = [
  pv({ id: "pv-lucca", nome: "Conad Lucca", meta: { id_anacan: "004512", id_muro: "317", insegna: "Conad City" } }),
  pv({ id: "pv-genova", nome: "Conad Genova", citta: "Genova", area: { id: "a-lig", nome: "Liguria", codice: "LI" }, coordinate: null }),
  pv({
    id: "pv-pisa",
    nome: "Superstore Pisa",
    citta: "Pisa",
    canale: { id: "c-sup", nome: "Conad Superstore", codice: "CS" },
    meta: { id_anacan: "45120" },
  }),
  // Insegna senza volantini, né nello storico né in produzione: non si mostra
  pv({ id: "pv-pet", nome: "Pet Store Lucca", canale: { id: "c-pet", nome: "PetStore", codice: "PT" }, combinazioneConVolantini: false }),
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
const cerca = (testo: string) => userEvent.type(screen.getByRole("searchbox", { name: "Cerca punto vendita" }), testo);

describe("Consultazione dei punti vendita", () => {
  beforeEach(() => {
    finti.permessi = new Set(["gdo.visualizza"]);
    finti.query = { data: conStoria(PUNTI_VENDITA), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() };
  });

  it("intestazione con i conteggi, elenco e mappa insieme, senza scelta della vista né infografiche", () => {
    apri();

    expect(screen.getByRole("heading", { level: 1, name: "Punti vendita" })).toBeInTheDocument();
    expect(screen.getByText("3 punti vendita · 2 insegne · 2 aree")).toBeInTheDocument();
    expect(nomiInElenco()).toEqual(["Conad Lucca", "Conad Genova", "Superstore Pisa"]);
    expect(screen.getByTestId("mappa")).toBeInTheDocument();
    expect(screen.getByText("1 punto vendita filtrato non ha coordinate e non compare sulla mappa.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Vista" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "La rete per insegna" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Punti vendita nei volantini" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuovo punto vendita|Importa|Modifica|Elimina/ })).not.toBeInTheDocument();
  });

  it("solo le insegne e le aree dei volantini: i punti vendita senza volantini non compaiono e la pagina li conta", () => {
    apri();

    expect(nomiInElenco()).not.toContain("Pet Store Lucca");
    expect(within(screen.getByRole("group", { name: "Insegna" })).queryByRole("button", { name: /^PetStore/ })).not.toBeInTheDocument();
    expect(within(chip("Insegna", /^Tutte/)).getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/1 punto vendita non è mostrato perché la sua insegna e la sua area non hanno volantini\./)).toBeInTheDocument();
  });

  it("se nessuna combinazione ha volantini lo dice, invece di dire che la GDO non ha punti vendita", () => {
    finti.query = { ...finti.query, data: PUNTI_VENDITA.map(p => ({ ...p, combinazioneConVolantini: false })) };
    apri();

    expect(screen.getByText("Nessun punto vendita nei volantini")).toBeInTheDocument();
    expect(screen.getByText(/4 punti vendita non sono mostrati/)).toBeInTheDocument();
  });

  it("senza l'indicazione dei volantini (combinazioni non lette dal server) li mostra tutti", () => {
    finti.query = { ...finti.query, data: PUNTI_VENDITA.map(({ combinazioneConVolantini: _c, ...resto }) => resto) };
    apri();

    expect(nomiInElenco()).toContain("Pet Store Lucca");
    expect(screen.queryByText(/non è mostrato|non sono mostrati/)).not.toBeInTheDocument();
  });

  it("ogni riga dice i volantini e il cambio di insegna, senza l'insegna anno per anno; apre la scheda", async () => {
    apri();

    const pisa = screen.getByRole("link", { name: /^Superstore Pisa/ });
    expect(pisa).toHaveAttribute("href", "/punti-vendita/pv-pisa");
    expect(pisa).toHaveAccessibleName("Superstore Pisa, Via Roma 1 - 55100 Pisa (LU), Conad Superstore, 30 volantini, ha cambiato insegna");
    expect(within(pisa).queryByTitle(/2024/)).not.toBeInTheDocument();
    expect(within(pisa).getByText("Ha cambiato insegna")).toBeInTheDocument();

    const lucca = screen.getByRole("link", { name: /^Conad Lucca/ });
    expect(lucca).toHaveTextContent("12 volantini");
    expect(within(lucca).queryByText("Ha cambiato insegna")).not.toBeInTheDocument();
    // Insegna e area sotto l'indirizzo, con i codici che identificano il punto vendita: l'insegna dei meta non è un codice
    expect(lucca).toHaveTextContent("Conad City · Toscana");
    expect(lucca).toHaveTextContent("ID ANACAN 004512");
    expect(lucca).not.toHaveTextContent("INSEGNA");

    const genova = screen.getByRole("link", { name: /^Conad Genova/ });
    expect(genova).toHaveAccessibleName(/, mai nei volantini$/);
    expect(genova).toHaveTextContent("0 volantini");

    await userEvent.click(lucca);
    expect(await screen.findByText("Scheda aperta")).toBeInTheDocument();
  });

  it("se il server non manda la storia con l'elenco, le righe non mostrano i volantini", () => {
    finti.query = { ...finti.query, data: PUNTI_VENDITA };
    apri();

    const lucca = screen.getByRole("link", { name: /^Conad Lucca/ });
    expect(lucca).toHaveAccessibleName("Conad Lucca, Via Roma 1 - 55100 Lucca (LU), Conad City");
    expect(lucca).not.toHaveTextContent("volantini");
  });

  it("i filtri valgono per elenco e mappa: insegna a chip e area a tendina, con i conteggi", async () => {
    apri();

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
    expect(screen.getByText("1 punto vendita filtrato non ha coordinate e non compare sulla mappa.")).toBeInTheDocument();
  });

  it("mentre l'elenco si carica mostra le righe di attesa", () => {
    finti.query = { data: undefined, isLoading: true, isFetching: true, isError: false, refetch: vi.fn() };
    apri();

    expect(screen.getByRole("list", { name: "Caricamento dei punti vendita" })).toHaveAttribute("aria-busy", "true");
  });

  it("su tutti i campi la ricerca trova anche per parte del codice GDO", async () => {
    apri();

    await cerca("4512");

    expect(await screen.findByText("Mostrati 1–2 di 2")).toBeInTheDocument();
    expect(nomiInElenco()).toEqual(["Conad Lucca", "Superstore Pisa"]);
  });

  it("\"Cerca in\" un codice della GDO lo vuole intero, senza contare gli zeri iniziali", async () => {
    apri();

    const campo = screen.getByRole("combobox", { name: "Cerca in" });
    // I codici dei meta, per nome; l'insegna non è un codice
    expect(within(campo).getAllByRole("option").map(o => o.textContent)).toEqual(["Tutti i campi", "ID ANACAN", "ID MURO"]);
    await userEvent.selectOptions(campo, "id_anacan");
    expect(screen.getByRole("searchbox", { name: "Cerca punto vendita" })).toHaveAttribute("placeholder", "ID ANACAN esatto");

    await cerca("4512");

    expect(await screen.findByText("Mostrati 1–1 di 1")).toBeInTheDocument();
    expect(nomiInElenco()).toEqual(["Conad Lucca"]);
  });

  it("senza codici nei meta non c'è la scelta del campo", () => {
    finti.query = { ...finti.query, data: PUNTI_VENDITA.map(p => ({ ...p, meta: {} })) };
    apri();

    expect(screen.queryByRole("combobox", { name: "Cerca in" })).not.toBeInTheDocument();
  });

  it("senza risultati propone di azzerare i filtri", async () => {
    apri();

    await cerca("Milano");

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
