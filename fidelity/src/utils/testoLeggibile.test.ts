import { describe, expect, it } from "vitest";
import { testoLeggibile } from "./testoLeggibile";

describe("testoLeggibile", () => {
  it("un nome in maiuscolo diventa leggibile, con snc in minuscolo", () => {
    expect(testoLeggibile("BARGA VIA CANIPAIA SNC")).toBe("Barga Via Canipaia snc");
    expect(testoLeggibile("VIA CANIPAIA")).toBe("Via Canipaia");
    expect(testoLeggibile("BARGA")).toBe("Barga");
  });

  it("preposizioni in minuscolo, numeri romani e lettera del civico come sono", () => {
    expect(testoLeggibile("VIA XX SETTEMBRE DELLA REPUBBLICA 12/A")).toBe("Via XX Settembre della Repubblica 12/A");
    expect(testoLeggibile("PIAZZA DEL POPOLO 70E")).toBe("Piazza del Popolo 70E");
    expect(testoLeggibile("VIA DI SOTTO")).toBe("Via di Sotto");
  });

  it("la prima parola è sempre maiuscola, anche se è una preposizione", () => {
    expect(testoLeggibile("DI VITTORIO MARKET")).toBe("Di Vittorio Market");
  });

  it("apostrofi, forme societarie e provincia fra parentesi", () => {
    expect(testoLeggibile("VIA DELL'ARTE")).toBe("Via dell'Arte");
    expect(testoLeggibile("SANT'ANNA SUPERMERCATI SRL")).toBe("Sant'Anna Supermercati srl");
    expect(testoLeggibile("CONAD BARGA (LU)")).toBe("Conad Barga (LU)");
  });

  it("le sigle con il punto restano come sono", () => {
    expect(testoLeggibile("S.P. 12 LOC. FORNACI")).toBe("S.P. 12 Loc. Fornaci");
  });

  it("un testo con lettere minuscole resta com'è", () => {
    expect(testoLeggibile("Conad City Lucca")).toBe("Conad City Lucca");
    expect(testoLeggibile("CONAD city")).toBe("CONAD city");
  });

  it("vuoti e testi senza lettere restano come sono", () => {
    expect(testoLeggibile("")).toBe("");
    expect(testoLeggibile(null)).toBeNull();
    expect(testoLeggibile(undefined)).toBeUndefined();
    expect(testoLeggibile("55051")).toBe("55051");
  });
});
