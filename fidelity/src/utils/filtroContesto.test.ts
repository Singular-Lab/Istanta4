import { describe, expect, it } from "vitest";
import { normalizzaFiltroContesto } from "./filtroContesto";

describe("normalizzaFiltroContesto", () => {
  it("nome_field diventa schema.colonna, il resto resta invariato", () => {
    const risultato = normalizzaFiltroContesto([
      {
        titoloFiltro: "Solo Toscana",
        condizioni: [{ schemaScelto: "promo", colonna: "codice_area", nome_field: "", operatore: "equals" }],
      },
    ]);

    expect(risultato).toEqual([
      {
        titoloFiltro: "Solo Toscana",
        condizioni: [{ schemaScelto: "promo", colonna: "codice_area", nome_field: "promo.codice_area", operatore: "equals" }],
      },
    ]);
  });

  it("senza filtri restituisce una lista vuota", () => {
    expect(normalizzaFiltroContesto([])).toEqual([]);
    expect(normalizzaFiltroContesto(undefined)).toEqual([]);
  });
});
