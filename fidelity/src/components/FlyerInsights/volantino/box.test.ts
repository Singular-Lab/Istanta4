// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";

vi.mock("@/query/query", () => ({ useFetchReteInsegne: () => ({ data: undefined }) }));

import { descrizioneBox, testoReparto, tooltipBox, trovaBoxIniziale } from "./box";

// Testi dei box del volantino e scelta del box da aprire all'avvio

const boxDi = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: `B${id}`,
  pagina: 1,
  geometria: { x: 0, y: 0, w: 0.5, h: 0.5 },
  spazio: 25,
  proporzionePagina: 210 / 297,
  chiave: `c-${id}`,
  nome: `Prodotto ${id}`,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [`r-${id}`],
  ...dati,
});

describe("box da aprire all'avvio", () => {
  const elenco = [boxDi("a", { nome: "Mozzarella Granarolo" }), boxDi("b", { idReferenze: ["r-b", "r-b2"] })];

  it("si riconosce per id del box, id di una sua referenza, chiave del prodotto o nome", () => {
    expect(trovaBoxIniziale(elenco, "b")?.id).toBe("b");
    expect(trovaBoxIniziale(elenco, "r-b2")?.id).toBe("b");
    expect(trovaBoxIniziale(elenco, "c-a")?.id).toBe("a");
    expect(trovaBoxIniziale(elenco, "  mozzarella granarolo ")?.id).toBe("a");
  });

  it("senza indicazione o senza corrispondenza non apre nulla", () => {
    expect(trovaBoxIniziale(elenco, null)).toBeNull();
    expect(trovaBoxIniziale(elenco, "   ")).toBeNull();
    expect(trovaBoxIniziale(elenco, "Latte")).toBeNull();
  });
});

describe("testi del box", () => {
  it("il nome per le tecnologie assistive dice prodotto, marca, prezzo e sconto che ci sono", () => {
    expect(descrizioneBox(boxDi("a", { nome: "Mozzarella", marca: "Granarolo", prezzo: 1.69, sconto: 31.6 }))).toBe("Mozzarella, Granarolo, € 1,69, sconto 32%");
    expect(descrizioneBox(boxDi("a", { nome: "" }))).toBe("Box senza nome");
  });

  it("il reparto con codice e descrizione, o quello che c'è", () => {
    expect(testoReparto({ codice: "24", descrizione: "LATTICINI" })).toBe("LATTICINI (24)");
    expect(testoReparto({ codice: "24", descrizione: "" })).toBe("24");
    expect(testoReparto(null)).toBeNull();
  });

  it("il tooltip ha solo le righe dei dati presenti, senza indici di visibilità", () => {
    const tooltip = tooltipBox(boxDi("a", { prezzo: 2, barrato: 2.5, meccanica: "fidelity", prodotti: 3 }));
    expect(tooltip.righe?.map(riga => riga.etichetta)).toEqual(["Prezzo", "Meccanica", "Prodotti nel box"]);
    expect(tooltip.righe?.[0].valore).toBe("€ 2,00 invece di € 2,50");
  });

  it("il prezzo calcolato dal barrato e dallo sconto si scrive come quello stampato, e il nome e il tooltip lo dicono", () => {
    const calcolato = boxDi("a", { nome: "Olio", prezzo: 2.59, prezzoCalcolato: true, barrato: 5.39, sconto: 51.95 });

    expect(descrizioneBox(calcolato)).toBe("Olio, € 2,59 calcolato, sconto 52%");
    const tooltip = tooltipBox(calcolato);
    expect(tooltip.righe?.[0]).toEqual({ etichetta: "Prezzo calcolato", valore: "€ 2,59 invece di € 5,39" });
  });
});
