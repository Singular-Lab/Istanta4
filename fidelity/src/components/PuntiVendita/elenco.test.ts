// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReteInsegne } from "../../../lib/puntiVendita/analisi";

// Elenco dei punti vendita comune a consultazione e gestione: colori delle insegne uguali a quelli
// delle altre pagine dei punti vendita, filtro aggiuntivo della pagina, striscia delle insegne

const finti = vi.hoisted(() => ({ rete: {} as Record<string, unknown> }));
vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => finti.rete }));

import { tintaCategoria, TINTA_NEUTRA } from "@/components/Grafici/colori";
import { tinteCanali } from "@/pages/PuntiVenditaConsultazione/analisi";
import { codiciIdentificativi, coloreDaTinta, useElencoPuntiVendita, type PuntoVenditaInElenco } from "./elenco";
import { periodiInsegna, testoPeriodiInsegna } from "./StrisciaInsegne";

const pv = (id: string, canale: { id: string; nome: string } | null, dati: Partial<PuntoVenditaInElenco> = {}): PuntoVenditaInElenco => ({
  id,
  nome: `Punto vendita ${id}`,
  indirizzo: "Via Roma 1",
  cap: "55100",
  citta: "Lucca",
  meta: {},
  id_canale: canale?.id,
  nome_canale: canale?.nome,
  id_area: "a1",
  nome_area: "Toscana",
  has_coordinate: true,
  coordinate: { lat: 43.8, lon: 10.5 },
  ...dati,
});

const CONAD = { id: "c-conad", nome: "Conad" };
const CITY = { id: "c-city", nome: "Conad City" };
const SUPERSTORE = { id: "c-sup", nome: "Conad Superstore" };
// Solo nei volantini passati: sta nella rete ma non nell'anagrafica di oggi
const MARGHERITA = { id: "c-marg", nome: "Margherita" };

const RETE: ReteInsegne = {
  anni: [2025, 2026],
  insegne: [CONAD, CITY, MARGHERITA, SUPERSTORE].map(canale => ({ canale, puntiVendita: 1, nelleListe: [] })),
};

const TUTTI = [pv("1", SUPERSTORE), pv("2", CITY), pv("3", null)];

describe("colori delle insegne nell'elenco", () => {
  beforeEach(() => {
    finti.rete = { data: RETE };
  });

  it("ogni insegna ha lo stesso colore dell'helper delle altre pagine (tinteCanali sulla rete)", () => {
    const { result } = renderHook(() => useElencoPuntiVendita(TUTTI));
    const helper = tinteCanali(
      RETE.insegne.map(i => i.canale),
      [CITY, SUPERSTORE]
    );

    for (const canale of [CONAD, CITY, MARGHERITA, SUPERSTORE]) {
      expect(result.current.tintaDelCanale(canale.id)).toEqual(helper(canale.id));
      expect(result.current.coloreDelCanale(canale.id)).toBe(coloreDaTinta(helper(canale.id)));
    }
    // Per nome sulla rete: Conad, Conad City, Conad Superstore, Margherita
    expect(result.current.tintaDelCanale(SUPERSTORE.id)).toEqual(tintaCategoria(2));
    expect(result.current.coloreCanale(TUTTI[0])).toBe(tintaCategoria(2).colore);
  });

  it("filtrando, i colori non cambiano", () => {
    const { result } = renderHook(() => useElencoPuntiVendita(TUTTI));
    const prima = result.current.coloreDelCanale(SUPERSTORE.id);

    act(() => result.current.setFiltroCanale(CITY.id));

    expect(result.current.filtrati.map(p => p.id)).toEqual(["2"]);
    expect(result.current.coloreDelCanale(SUPERSTORE.id)).toBe(prima);
  });

  it("senza canale il punto vendita è grigio", () => {
    const { result } = renderHook(() => useElencoPuntiVendita(TUTTI));

    expect(result.current.tintaDelCanale("")).toBe(TINTA_NEUTRA);
    expect(result.current.coloreCanale(TUTTI[2])).toBe(coloreDaTinta(TINTA_NEUTRA));
  });

  it("finché la rete non arriva i colori vengono dalle insegne dell'anagrafica, per nome", () => {
    finti.rete = { data: undefined };
    const { result } = renderHook(() => useElencoPuntiVendita(TUTTI));

    expect(result.current.tintaDelCanale(CITY.id)).toEqual(tintaCategoria(0));
    expect(result.current.tintaDelCanale(SUPERSTORE.id)).toEqual(tintaCategoria(1));
  });
});

describe("filtro aggiuntivo della pagina", () => {
  beforeEach(() => {
    finti.rete = { data: RETE };
  });

  it("vale prima degli altri filtri, anche nei conteggi, e Azzera filtri lo toglie", () => {
    const azzera = vi.fn();
    const senzaCoordinate = [pv("1", CITY, { has_coordinate: false }), pv("2", CITY), pv("3", SUPERSTORE, { has_coordinate: false })];
    const filtro = { chiave: "senzaCoordinate", test: (p: PuntoVenditaInElenco) => !p.has_coordinate, azzera };
    const { result } = renderHook(() => useElencoPuntiVendita(senzaCoordinate, { filtro }));

    expect(result.current.filtrati.map(p => p.id)).toEqual(["1", "3"]);
    expect(result.current.perCanale.map(c => [c.nome, c.totale])).toEqual([
      ["Conad City", 1],
      ["Conad Superstore", 1],
    ]);
    expect(result.current.conFiltri).toBe(true);

    act(() => result.current.azzeraFiltri());
    expect(azzera).toHaveBeenCalled();
  });
});

describe("insegna nei volantini anno per anno", () => {
  it("unisce gli anni consecutivi con la stessa insegna; un anno senza volantini interrompe il tratto", () => {
    const periodi = periodiInsegna([
      { anno: 2026, canale: SUPERSTORE },
      { anno: 2021, canale: CITY },
      { anno: 2022, canale: CITY },
      { anno: 2023, canale: null },
      { anno: 2024, canale: CITY },
      { anno: 2025, canale: SUPERSTORE },
    ]);

    expect(testoPeriodiInsegna(periodi)).toBe("Conad City 2021–2022 · Conad City 2024 · Conad Superstore 2025–2026");
    expect(testoPeriodiInsegna(periodiInsegna([]))).toBe("mai nei volantini");
  });
});

describe("codici che identificano il punto vendita", () => {
  it("tengono gli id del sistema della GDO e lasciano fuori l'insegna, che ha già la sua colonna", () => {
    expect(codiciIdentificativi({ id_muro: "317", insegna: "Spazio Conad", id_anacan: "3418", vuoto: " " })).toEqual([
      { etichetta: "ID MURO", valore: "317" },
      { etichetta: "ID ANACAN", valore: "3418" },
    ]);
    expect(codiciIdentificativi(undefined)).toEqual([]);
  });

  it("la colonna dei codici serve solo se un punto vendita della pagina ha un codice vero", () => {
    finti.rete = { data: undefined };
    const soloInsegna = [pv("1", null, { meta: { insegna: "Conad City" } })];
    const conCodice = [pv("1", null, { meta: { insegna: "Conad City", id_anacan: "12" } })];

    expect(renderHook(() => useElencoPuntiVendita(soloInsegna)).result.current.mostraCodiciGdo).toBe(false);
    expect(renderHook(() => useElencoPuntiVendita(conCodice)).result.current.mostraCodiciGdo).toBe(true);
  });
});
