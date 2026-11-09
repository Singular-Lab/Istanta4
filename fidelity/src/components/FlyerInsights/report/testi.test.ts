import { describe, expect, it } from "vitest";
import { dataEstesa, numeroSezione, segmentiFrase, testoQuota } from "./testi";

describe("testi del report PDF", () => {
  it("la data di generazione si scrive per esteso all'italiana", () => {
    expect(dataEstesa("2026-11-09T10:00:00.000Z")).toBe("9 novembre 2026");
    expect(dataEstesa("non una data")).toBe("");
  });

  it("le sezioni sono numerate a due cifre", () => {
    expect(numeroSezione(0)).toBe("01");
    expect(numeroSezione(11)).toBe("12");
  });

  it("nelle frasi chiave i numeri, con segno e unità, vanno in grassetto", () => {
    expect(segmentiFrase("Il 42% dello spazio va alla Drogheria, con 1.250 box e uno sconto di -3,5 punti.")).toEqual([
      { testo: "Il ", grassetto: false },
      { testo: "42%", grassetto: true },
      { testo: " dello spazio va alla Drogheria, con ", grassetto: false },
      { testo: "1.250", grassetto: true },
      { testo: " box e uno sconto di ", grassetto: false },
      { testo: "-3,5", grassetto: true },
      { testo: " punti.", grassetto: false },
    ]);
    expect(segmentiFrase("Prezzo medio 12,90 €.")).toEqual([
      { testo: "Prezzo medio ", grassetto: false },
      { testo: "12,90 €", grassetto: true },
      { testo: ".", grassetto: false },
    ]);
  });

  it("le cifre dentro una parola restano testo", () => {
    expect(segmentiFrase("Volantino Edro21 senza numeri")).toEqual([{ testo: "Volantino Edro21 senza numeri", grassetto: false }]);
  });

  it("se la frase marca le parti in evidenza con ** valgono quelle", () => {
    expect(segmentiFrase("La **Drogheria** occupa il 42% dello spazio")).toEqual([
      { testo: "La ", grassetto: false },
      { testo: "Drogheria", grassetto: true },
      { testo: " occupa il 42% dello spazio", grassetto: false },
    ]);
  });

  it("quota sul totale", () => {
    expect(testoQuota(25, 200)).toBe("12,5%");
    expect(testoQuota(5, 0)).toBe("—");
  });
});
