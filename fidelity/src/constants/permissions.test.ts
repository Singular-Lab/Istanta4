import { describe, expect, it } from "vitest";
import { PERMESSI_SEED } from "../../server/core/scripts/seedPermessi";
import { PERMISSIONS } from "./permissions";

const valori = (nodo: object): string[] =>
  Object.values(nodo).flatMap((v) => (typeof v === "string" ? [v] : valori(v)));

describe("PERMISSIONS", () => {
  it("usa solo codici presenti nel catalogo del server", () => {
    const codiciServer = new Set(PERMESSI_SEED.map((p) => p.codice));
    expect(valori(PERMISSIONS).filter((c) => !codiciServer.has(c))).toEqual([]);
  });

  it("usa per le lavorazioni in corso il permesso della rotta /promozioni/in-corso", () => {
    expect(PERMISSIONS.PAGINA.PROMOZIONI_IN_CORSO).toBe("pagina.lavorazioni_in_corso");
  });
});
