import { describe, expect, it } from "vitest";
import { urlMiniatura } from "./materiali";

const BASE = "/olimpo/materiali/getThumbnailMaterialePdfs?id=abc";

describe("urlMiniatura: anteprime ridotte alla misura mostrata (task a2fb02c1)", () => {
  it("aggiunge larghezza e altezza al doppio della misura mostrata, con la proporzione A4", () => {
    expect(urlMiniatura(BASE, 80)).toBe(`${BASE}&width=160&height=226`);
  });

  it("usa la proporzione della pagina quando si conosce", () => {
    expect(urlMiniatura(BASE, 100, 1)).toBe(`${BASE}&width=200&height=200`);
  });

  it("mantiene il numero di pagina già nell'indirizzo", () => {
    expect(urlMiniatura(`${BASE}&page=1`, 50)).toBe(`${BASE}&page=1&width=100&height=141`);
  });

  it("non ridimensiona due volte un indirizzo che ha già la sua misura", () => {
    const gia = `${BASE}&width=104&height=147`;
    expect(urlMiniatura(gia, 80)).toBe(gia);
  });

  it("lascia com'è un indirizzo che non è di Olimpo", () => {
    expect(urlMiniatura("/api/foto/1.png", 80)).toBe("/api/foto/1.png");
    expect(urlMiniatura("", 80)).toBe("");
  });

  it("una misura non valida lascia l'indirizzo com'è, una proporzione non valida usa A4", () => {
    expect(urlMiniatura(BASE, 0)).toBe(BASE);
    expect(urlMiniatura(BASE, Number.NaN)).toBe(BASE);
    expect(urlMiniatura(BASE, 80, 0)).toBe(`${BASE}&width=160&height=226`);
  });

  it("senza altri parametri usa il punto interrogativo", () => {
    expect(urlMiniatura("/olimpo/materiali/getThumbnailMaterialePdfs", 80)).toBe("/olimpo/materiali/getThumbnailMaterialePdfs?width=160&height=226");
  });
});
