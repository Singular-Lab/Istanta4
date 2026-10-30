// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { paletteColore } from "@/utils/chartTheme";
import {
  ampiezzaClassi,
  classeTestoSu,
  indiciPerNome,
  MASSIMO_CATEGORIE,
  PASSI_SEQUENZIALI,
  passoSequenziale,
  tintaCategoria,
  tintaSequenziale,
  TINTA_NEUTRA,
} from "./colori";

// Colori dei grafici: categorie in ordine fisso per entità, scala sequenziale, testo leggibile

const rif = (id: string, nome: string) => ({ id, nome });

describe("colori delle categorie", () => {
  it("l'indice segue il nome dell'entità, non l'ordine in cui arriva né quante volte compare", () => {
    const primo = indiciPerNome([rif("c3", "Conad Superstore"), rif("c1", "Conad"), rif("c2", "Conad City"), rif("c1", "Conad")]);
    const secondo = indiciPerNome([rif("c2", "Conad City"), rif("c1", "Conad"), rif("c3", "Conad Superstore")]);

    expect([...primo]).toEqual([["c1", 0], ["c2", 1], ["c3", 2]]);
    expect(secondo).toEqual(primo);
  });

  it("le categorie usano la palette di chartTheme saltando il navy del tema, che è troppo scuro per i segni", () => {
    expect(tintaCategoria(0).colore).toBe(paletteColore(1));
    expect(tintaCategoria(1).colore).toBe(paletteColore(2));
  });

  it("oltre le categorie distinguibili, o senza indice, la tinta è neutra", () => {
    expect(tintaCategoria(MASSIMO_CATEGORIE)).toBe(TINTA_NEUTRA);
    expect(tintaCategoria(-1)).toBe(TINTA_NEUTRA);
  });

  it("il testo dentro un colore è scuro sui fondi chiari e chiaro su quelli scuri", () => {
    expect(classeTestoSu("rgb(254 243 199 / 1)")).toBe("fill-slate-900");
    expect(classeTestoSu("rgb(8 145 178 / 1)")).toBe("fill-white");
  });
});

describe("scala sequenziale", () => {
  it("una tinta sola in 7 passi, dal chiaro allo scuro, con il testo che cambia sui passi scuri", () => {
    expect(PASSI_SEQUENZIALI).toHaveLength(7);
    expect(PASSI_SEQUENZIALI.every(p => p.classe?.startsWith("fill-theme-1"))).toBe(true);
    expect(PASSI_SEQUENZIALI[0].classeTesto).toContain("fill-slate-700");
    expect(PASSI_SEQUENZIALI[6].classeTesto).toContain("fill-white");
  });

  it("classi larghe quanto serve perché il massimo cada nell'ultima", () => {
    expect(ampiezzaClassi(41)).toBe(6);
    expect(passoSequenziale(41, 6)).toBe(6);
    expect(passoSequenziale(0, 6)).toBe(0);
    expect(passoSequenziale(13, 6)).toBe(2);
    expect(ampiezzaClassi(14)).toBe(2);
    expect(ampiezzaClassi(0)).toBe(1);
  });

  it("un valore mancante non ha passo e prende la tinta neutra", () => {
    expect(passoSequenziale(null, 8)).toBe(-1);
    expect(tintaSequenziale(-1)).toBe(TINTA_NEUTRA);
  });
});
