import { describe, expect, it } from "vitest";
import { PERMESSI, TUTTI_I_PERMESSI } from "../../lib/accessi/catalogo";
import { PERMISSIONS } from "./permissions";

describe("PERMISSIONS", () => {
  it("sono le costanti del catalogo condiviso con il server", () => {
    expect(PERMISSIONS).toBe(PERMESSI);
  });

  it("non contengono più permessi di pagina: le pagine dipendono dall'accesso all'area", () => {
    expect(TUTTI_I_PERMESSI.filter((p) => p.codice.indexOf("pagina.") === 0)).toEqual([]);
    expect(PERMISSIONS.PROMO.VISUALIZZA).toBe("promo.visualizza");
  });
});
