import { describe, expect, it } from "vitest";
import { canaleArea, codiciGdo, indirizzoCompleto } from "./puntoVendita";

describe("codiciGdo", () => {
  it("rende leggibili i codici del sistema della GDO e salta quelli vuoti", () => {
    expect(codiciGdo({ id_anacan: "004512", vuoto: " ", nullo: null })).toEqual([
      { etichetta: "ID ANACAN", valore: "004512" },
    ]);
  });

  it("senza meta non ci sono codici", () => {
    expect(codiciGdo(undefined)).toEqual([]);
  });
});

describe("indirizzoCompleto", () => {
  it("unisce via, CAP, citta e provincia", () => {
    expect(indirizzoCompleto({ indirizzo: "Via Roma 1", cap: "55100", citta: "Lucca", provincia: "LU" }))
      .toBe("Via Roma 1 - 55100 Lucca (LU)");
  });

  it("salta le parti mancanti", () => {
    expect(indirizzoCompleto({ indirizzo: "Via Roma 1", cap: "55100", citta: "Lucca" })).toBe("Via Roma 1 - 55100 Lucca");
  });
});

describe("canaleArea", () => {
  it("mostra canale e area per nome", () => {
    expect(canaleArea({ nome_canale: "Conad City", nome_area: "Toscana", sigla_combinazione: "CCTO" })).toBe("Conad City · Toscana");
  });

  it("senza nomi ripiega sulla sigla", () => {
    expect(canaleArea({ sigla_combinazione: "CCTO" })).toBe("CCTO");
  });
});
