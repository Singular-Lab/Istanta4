import { icons } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as iconeUsate from "./iconeUsate";

type ModuloRisolutore = typeof import("./risolviIconaLucide");

// Il risolutore tiene in memoria la mappa completa: ogni test parte da un modulo nuovo
let risolutore: ModuloRisolutore;
beforeEach(async () => {
  vi.resetModules();
  risolutore = await import("./risolviIconaLucide");
});

// Un'icona vera che il codice non nomina: si risolve solo con la mappa completa
const iconaNonUsata = Object.keys(icons).find(
  (nome) => !Object.prototype.hasOwnProperty.call(iconeUsate, nome)
) as string;

describe("risolviIconaLucide", () => {
  it("risolve subito le icone nominate nel codice, senza la mappa completa", () => {
    const nomi = Object.keys(iconeUsate);
    expect(nomi.length).toBeGreaterThan(0);
    for (const nome of nomi) expect(risolutore.risolviIconaLucide(nome)).toBeDefined();
    expect(risolutore.mappaCompletaCaricata()).toBe(false);
  });

  it("non risolve un'icona non usata nel codice finché la mappa completa non è caricata", async () => {
    expect(iconaNonUsata).toBeDefined();
    expect(risolutore.risolviIconaLucide(iconaNonUsata)).toBeUndefined();

    await risolutore.caricaMappaCompleta();

    expect(risolutore.mappaCompletaCaricata()).toBe(true);
    expect(risolutore.risolviIconaLucide(iconaNonUsata)).toBe(icons[iconaNonUsata as keyof typeof icons]);
  });

  it("carica la mappa completa una volta sola", () => {
    expect(risolutore.caricaMappaCompleta()).toBe(risolutore.caricaMappaCompleta());
  });

  it.each(["Trash2", "AlertTriangle", "History"])(
    "con la mappa completa risolve il nome legacy %s, assente dalla mappa icons",
    async (nome) => {
      await risolutore.caricaMappaCompleta();
      expect(risolutore.risolviIconaLucide(nome)).toBeDefined();
    }
  );

  it("restituisce undefined per un nome inesistente", async () => {
    await risolutore.caricaMappaCompleta();
    expect(risolutore.risolviIconaLucide("IconaCheNonEsiste")).toBeUndefined();
  });

  it("non scambia per icona un export che non lo e' né una proprietà ereditata", async () => {
    await risolutore.caricaMappaCompleta();
    for (const nome of ["createLucideIcon", "icons", "toString", "constructor"]) {
      expect(risolutore.risolviIconaLucide(nome)).toBeUndefined();
    }
  });
});
