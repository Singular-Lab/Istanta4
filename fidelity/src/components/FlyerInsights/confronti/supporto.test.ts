// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { BoxInsight, DifferenzaProdotto, VolantinoDiRiferimento } from "../../../../lib/insightVolantino/tipi";
import {
  etichettaVariante,
  etichetteVarianti,
  filtraDifferenze,
  formatDifferenzaNumero,
  ORDINE_STATI,
  pagineVariante,
  STATI_DIFFERENZA,
} from "./supporto";

const variante = (idKit: string, area: string, canale: string, titolo = "Volantino"): VolantinoDiRiferimento => ({
  idKit,
  titolo,
  idPromo: "p1",
  nomePromo: null,
  area,
  canale,
  validitaDal: null,
  validitaAl: null,
  storico: false,
});

const differenza = (chiave: string, stato: DifferenzaProdotto["stato"]): DifferenzaProdotto => ({
  chiave,
  nome: chiave,
  marca: null,
  stato,
  qui: null,
  altra: null,
});

describe("Supporto dei confronti del volantino", () => {
  it("chiama una variante per area e canale, e per titolo solo se mancano entrambi", () => {
    expect(etichettaVariante(variante("k1", "Nord", "Super"))).toBe("Nord · Super");
    expect(etichettaVariante(variante("k1", "", "Super"))).toBe("Super");
    expect(etichettaVariante(variante("k1", " ", "", "Volantino storico"))).toBe("Volantino storico");
    expect(etichettaVariante(variante("k1", "", "", ""))).toBe("Variante senza nome");
  });

  it("aggiunge il titolo solo alle varianti che altrimenti avrebbero lo stesso nome", () => {
    const etichette = etichetteVarianti([
      variante("k1", "Nord", "Super", "Volantino A"),
      variante("k2", "Nord", "Super", "Volantino B"),
      variante("k3", "Sud", "Super", "Volantino C"),
    ]);

    expect(etichette.get("k1")).toBe("Nord · Super (Volantino A)");
    expect(etichette.get("k2")).toBe("Nord · Super (Volantino B)");
    expect(etichette.get("k3")).toBe("Sud · Super");
  });

  it("filtra le differenze per tipo e lascia fuori gli uguali anche da tutte", () => {
    const voci = [differenza("a", "solo-qui"), differenza("b", "solo-altra"), differenza("c", "prezzo-diverso"), differenza("d", "uguale")];

    expect(filtraDifferenze(voci, "tutte").map((voce) => voce.chiave)).toEqual(["a", "b", "c"]);
    expect(filtraDifferenze(voci, "solo-altra").map((voce) => voce.chiave)).toEqual(["b"]);
    expect(filtraDifferenze([], "prezzo-diverso")).toEqual([]);
  });

  it("conta le pagine di una variante dal PDF o, se manca o è più corto, dall'ultima pagina con un box", () => {
    const box = (pagina: number | null) => ({ id: `b${pagina}`, pagina }) as BoxInsight;

    expect(pagineVariante({ idOlimpoCloud: "o1", pagine: 12 }, [box(3)])).toBe(12);
    expect(pagineVariante(null, [box(3), box(7), box(null)])).toBe(7);
    expect(pagineVariante({ idOlimpoCloud: "o1", pagine: 4 }, [box(6)])).toBe(6);
    expect(pagineVariante(null, [])).toBe(0);
  });

  it("scrive la differenza di un conteggio col segno, stabile a zero e un trattino se manca", () => {
    expect(formatDifferenzaNumero(12)).toBe("+12");
    expect(formatDifferenzaNumero(-3)).toBe("−3");
    expect(formatDifferenzaNumero(0)).toBe("stabile");
    expect(formatDifferenzaNumero(0.04)).toBe("stabile");
    expect(formatDifferenzaNumero(1234.5)).toBe("+1.234,5");
    expect(formatDifferenzaNumero(null)).toBe("—");
    expect(formatDifferenzaNumero(Number.NaN)).toBe("—");
  });

  it("descrive ogni stato con etichetta, tono e tinta, nell'ordine della legenda", () => {
    expect(ORDINE_STATI).toEqual(["solo-qui", "solo-altra", "prezzo-diverso", "uguale"]);
    for (const stato of ORDINE_STATI) {
      expect(STATI_DIFFERENZA[stato].etichetta).not.toBe("");
      expect(STATI_DIFFERENZA[stato].tinta.classe).toMatch(/^fill-/);
      expect(STATI_DIFFERENZA[stato].sfondo).toMatch(/^bg-/);
    }
  });
});
