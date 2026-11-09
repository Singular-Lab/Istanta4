import { describe, expect, it } from "vitest";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import {
  CAMPI_VUOTI,
  campiDelProdotto,
  filtraProdotti,
  leggiNumero,
  nomeZona,
  prodottiSimulabili,
  riquadroSimulato,
  stessaRichiesta,
  validaSimulazione,
  ZONE_PAGINA,
  type CampiSimulazione,
} from "./supporto";

// Supporto del simulatore: prodotti, zone, campi, validazione e anteprima del box simulato

const box = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 2,
  geometria: { x: 0.2, y: 0.1, w: 0.4, h: 0.2 },
  spazio: 8,
  proporzionePagina: 0.7,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: 25.4,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [],
  visibilita: 50,
  ...dati,
});

const campi = (dati: Partial<CampiSimulazione> = {}): CampiSimulazione => ({
  chiave: "c-a",
  pagina: "3",
  zona: { x: 0.5, y: 0.5 },
  spazio: "10",
  sconto: "30",
  ...dati,
});

describe("prodotti e zone", () => {
  it("un prodotto una volta sola, dal box nella prima pagina, in ordine di nome; senza chiave non si simula", () => {
    const prodotti = prodottiSimulabili([
      box("z", { nome: "Zucchero", pagina: 5 }),
      box("b5", { nome: "Biscotti", chiave: "c-bis", pagina: 6 }),
      box("b2", { nome: "Biscotti", chiave: "c-bis", pagina: 2 }),
      box("x", { chiave: "" }),
    ]);

    expect(prodotti.map(voce => [voce.nome, voce.box.id])).toEqual([
      ["Biscotti", "b2"],
      ["Zucchero", "z"],
    ]);
  });

  it("la ricerca filtra per nome o marca e tiene sempre il prodotto scelto", () => {
    const prodotti = prodottiSimulabili([box("a", { nome: "Mozzarella", marca: "Granarolo" }), box("b", { nome: "Pasta" })]);

    expect(filtraProdotti(prodotti, "granarolo", "").map(voce => voce.chiave)).toEqual(["c-a"]);
    expect(filtraProdotti(prodotti, "granarolo", "c-b").map(voce => voce.chiave)).toEqual(["c-a", "c-b"]);
    expect(filtraProdotti(prodotti, "  ", "")).toHaveLength(2);
  });

  it("nove zone al centro delle celle 3×3, con il nome; la posizione attuale ha il suo", () => {
    expect(ZONE_PAGINA).toHaveLength(9);
    expect(ZONE_PAGINA[0]).toMatchObject({ nome: "In alto a sinistra", x: 0.1667, y: 0.1667 });
    expect(ZONE_PAGINA[4]).toMatchObject({ nome: "Al centro", x: 0.5, y: 0.5 });
    expect(nomeZona({ x: 0.5, y: 0.8333 }, null)).toBe("In basso al centro");
    expect(nomeZona({ x: 0.4, y: 0.2 }, { x: 0.4, y: 0.2 })).toBe("Posizione attuale");
    expect(nomeZona({ x: 0.41, y: 0.2 }, null)).toBe("Punto scelto");
  });

  it("i campi di partenza sono pagina, posizione, spazio e sconto attuali del prodotto", () => {
    const [prodotto] = prodottiSimulabili([box("a")]);

    expect(campiDelProdotto(prodotto)).toEqual({ chiave: "c-a", pagina: "2", zona: { x: 0.4, y: 0.2 }, spazio: "8", sconto: "25" });
    const [senzaSconto] = prodottiSimulabili([box("b", { sconto: null, geometria: null, pagina: null, spazio: 0 })]);
    expect(campiDelProdotto(senzaSconto)).toEqual({ chiave: "c-b", pagina: "1", zona: { x: 0.5, y: 0.5 }, spazio: "", sconto: "" });
  });
});

describe("validaSimulazione", () => {
  it("con i campi validi dà la richiesta del contratto", () => {
    expect(validaSimulazione(campi({ spazio: "12,5" }), 8)).toEqual({
      richiesta: { chiave: "c-a", pagina: 3, x: 0.5, y: 0.5, spazio: 12.5, sconto: 30 },
      errori: {},
    });
  });

  it("lo sconto vuoto vuol dire senza sconto", () => {
    expect(validaSimulazione(campi({ sconto: "" }), 8).richiesta?.sconto).toBeNull();
  });

  it("segnala prodotto mancante, pagina fuori dal volantino, spazio e sconto non validi", () => {
    const { richiesta, errori } = validaSimulazione({ ...CAMPI_VUOTI, pagina: "9", spazio: "0", sconto: "100" }, 8);

    expect(richiesta).toBeNull();
    expect(errori.chiave).toMatch(/Scegli il prodotto/);
    expect(errori.pagina).toBe("La pagina va da 1 a 8.");
    expect(errori.spazio).toMatch(/più di 0, al massimo 100/);
    expect(errori.sconto).toMatch(/da 0 a 99%/);
    expect(validaSimulazione(campi({ spazio: "abc" }), 8).errori.spazio).toBeDefined();
    expect(validaSimulazione(campi({ spazio: "101" }), 8).errori.spazio).toBeDefined();
    expect(validaSimulazione(campi({ sconto: "-1" }), 8).errori.sconto).toBeDefined();
  });

  it("stessaRichiesta confronta tutti i campi", () => {
    const { richiesta } = validaSimulazione(campi(), 8);
    expect(stessaRichiesta(richiesta, { ...richiesta! })).toBe(true);
    expect(stessaRichiesta(richiesta, { ...richiesta!, x: 0.1667 })).toBe(false);
    expect(stessaRichiesta(richiesta, null)).toBe(false);
  });

  it("legge i numeri all'italiana e all'inglese", () => {
    expect(leggiNumero("12,5")).toBe(12.5);
    expect(leggiNumero(" 7.5 ")).toBe(7.5);
    expect(leggiNumero("")).toBeNull();
    expect(leggiNumero("dieci")).toBeNull();
  });
});

describe("riquadroSimulato", () => {
  it("ha l'area dello spazio, è quadrato sulla carta, centrato sulla zona e dentro la pagina", () => {
    const riquadro = riquadroSimulato({ x: 0.5, y: 0.5 }, 9, 0.7)!;
    expect(riquadro.w * riquadro.h).toBeCloseTo(0.09, 6);
    // Quadrato sulla carta: larghezza × proporzione = altezza
    expect(riquadro.h).toBeCloseTo(riquadro.w * 0.7, 6);
    expect(riquadro.x + riquadro.w / 2).toBeCloseTo(0.5, 6);

    const inAngolo = riquadroSimulato({ x: 0.98, y: 0.02 }, 9, 0.7)!;
    expect(inAngolo.x + inAngolo.w).toBeCloseTo(1, 6);
    expect(inAngolo.y).toBe(0);
    expect(riquadroSimulato({ x: 0.5, y: 0.5 }, null, 0.7)).toBeNull();
  });
});
