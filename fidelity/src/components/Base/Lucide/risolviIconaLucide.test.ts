import { describe, expect, it } from "vitest";
import { risolviIconaLucide } from "./risolviIconaLucide";

describe("risolviIconaLucide", () => {
  it.each(["Trash2", "AlertTriangle", "History"])(
    "risolve il nome legacy %s, assente dalla mappa icons",
    (nome) => {
      expect(risolviIconaLucide(nome)).toBeDefined();
    }
  );

  it("risolve un nome presente nella mappa icons", () => {
    expect(risolviIconaLucide("Trash")).toBeDefined();
  });

  it("restituisce undefined per un nome inesistente", () => {
    expect(risolviIconaLucide("IconaCheNonEsiste")).toBeUndefined();
  });

  it("non scambia per icona un export che non lo e'", () => {
    expect(risolviIconaLucide("createLucideIcon")).toBeUndefined();
  });
});
