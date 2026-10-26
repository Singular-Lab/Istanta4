import { describe, expect, it } from "vitest";
import { formattaData, formattaDataOra } from "./dataPromo";

describe("date della promo", () => {
  it("data e ora senza articolo né maiuscole, da usare dopo 'il'", () => {
    const testo = `scaduta il ${formattaDataOra(new Date(2026, 8, 3, 10, 30))}`;

    expect(testo).toBe("scaduta il 03/09/2026 alle 10:30");
  });

  it("solo data per scadenze e validità", () => {
    expect(formattaData(new Date(2026, 8, 3))).toBe("03/09/2026");
  });

  it("senza data restituisce N/A", () => {
    expect(formattaDataOra(undefined)).toBe("N/A");
    expect(formattaData(undefined)).toBe("N/A");
  });
});
