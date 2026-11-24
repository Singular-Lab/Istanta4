import { describe, expect, it } from "vitest";
import { codiceIniziativaConadCno } from "../codice-iniziativa.js";

describe("conadcno: codice iniziativa dal nome della promo (task 1f340bec)", () => {
  it("è il valore prima del primo «_»", () => {
    expect(codiceIniziativaConadCno("P2620_KIT_TOSCANA")).toBe("P2620");
    expect(codiceIniziativaConadCno("PE2623_24_MIPREMIO_05-11-26")).toBe("PE2623");
  });

  it("senza «_» la promo non ha un codice", () => {
    expect(codiceIniziativaConadCno("PASQUA")).toBeNull();
    expect(codiceIniziativaConadCno("")).toBeNull();
  });

  it("con il «_» all'inizio, o solo spazi prima, non ha un codice", () => {
    expect(codiceIniziativaConadCno("_KIT")).toBeNull();
    expect(codiceIniziativaConadCno("   _KIT")).toBeNull();
  });

  it("gli spazi ai lati del nome e del codice non contano, le maiuscole restano com'erano", () => {
    expect(codiceIniziativaConadCno("  p2620 _kit  ")).toBe("p2620");
  });

  it("un valore che non è testo non rompe", () => {
    expect(codiceIniziativaConadCno(undefined as unknown as string)).toBeNull();
    expect(codiceIniziativaConadCno(null as unknown as string)).toBeNull();
  });
});
