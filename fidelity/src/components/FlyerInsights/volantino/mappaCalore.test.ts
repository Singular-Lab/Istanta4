import { describe, expect, it } from "vitest";
import { SCALA_CALORE_STANDARD } from "../../../../lib/insightVolantino/calore";
import type { RendimentoVolantino } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import {
  calcolaMappaCalore,
  COLONNE_CALORE,
  creaCalcolatoreMappe,
  gradienteScala,
  misuraEffettiva,
  misuraPredefinita,
  rigaMisura,
  testoValoreMisura,
} from "./mappaCalore";

// Supporto della mappa di calore continua del visualizzatore: misura proposta, cache per misura,
// testi della legenda e del tooltip

const A4 = 210 / 297;

const box = (id: string, dati: Partial<BoxInsight> = {}): BoxInsight => ({
  id,
  codiceBox: id,
  pagina: 1,
  geometria: { x: 0.1, y: 0.1, w: 0.4, h: 0.3 },
  spazio: 12,
  proporzionePagina: A4,
  chiave: `c-${id}`,
  nome: id,
  marca: null,
  formato: null,
  prezzo: null,
  barrato: null,
  sconto: null,
  prezzoAlKg: null,
  punti: null,
  sottocosto: false,
  meccanica: null,
  meccanicaOriginale: null,
  reparto: null,
  foto: [],
  prodotti: 1,
  idReferenze: [],
  visibilita: 40,
  ...dati,
});

const BOX = [box("a", { sconto: 20 }), box("b", { pagina: 3, sconto: 40, spazio: 6, geometria: { x: 0.5, y: 0.6, w: 0.3, h: 0.2 } })];

const rendimento = (misura: RendimentoVolantino["misura"]): RendimentoVolantino => ({
  periodo: { dal: "2026-10-01", al: "2026-10-14" },
  puntiVendita: 3,
  misura,
  totalePezzi: 30,
  totaleValore: misura === "valore" ? 90 : null,
  perBox: [
    { idBox: "a", pezzi: 10, valore: misura === "valore" ? 30 : null, quota: 33.3, quotaSpazio: 66.7, indiceSpazio: 0.5, prodotti: 1, prodottiSenzaVendite: 0 },
    { idBox: "b", pezzi: 20, valore: misura === "valore" ? 60 : null, quota: 66.7, quotaSpazio: 33.3, indiceSpazio: 2, prodotti: 1, prodottiSenzaVendite: 0 },
  ],
  prodotti: 2,
  prodottiSenzaVendite: 0,
  sopraSpazio: ["b"],
  sottoSpazio: ["a"],
});

describe("misura proposta", () => {
  it("parte dalle vendite quando ci sono, altrimenti dalla prima disponibile; null senza misure", () => {
    expect(misuraPredefinita(["investimento", "sconto", "vendite"])).toBe("vendite");
    expect(misuraPredefinita(["sconto", "spazio"])).toBe("sconto");
    expect(misuraPredefinita([])).toBeNull();
  });

  it("la misura scelta vale finché è disponibile; se sparisce si torna alla predefinita", () => {
    expect(misuraEffettiva("spazio", ["sconto", "spazio"])).toBe("spazio");
    expect(misuraEffettiva("vendite", ["sconto", "spazio"])).toBe("sconto");
    expect(misuraEffettiva(null, ["sconto", "vendite"])).toBe("vendite");
  });
});

describe("calcolaMappaCalore", () => {
  it("densità delle sole pagine con box, nella griglia di COLONNE_CALORE colonne, normalizzate sul volantino", () => {
    const mappa = calcolaMappaCalore("sconto", BOX, {}, A4);

    expect([...mappa.densita.keys()].sort()).toEqual([1, 3]);
    const pagina1 = mappa.densita.get(1)!;
    expect(pagina1.colonne).toBe(COLONNE_CALORE);
    expect(pagina1.righe).toBe(Math.round(COLONNE_CALORE / A4));
    // Il punto più caldo del volantino è sulla pagina 3 (sconto 40), non sulla 1
    expect(Math.max(...mappa.densita.get(3)!.valori)).toBeCloseTo(1, 5);
    expect(Math.max(...pagina1.valori)).toBeLessThan(1);
    expect(mappa.massimo).toBe(40);
    expect(mappa.unita).toBe("percentuale");
  });

  it("le vendite sono in euro se il file ha il valore, in pezzi altrimenti", () => {
    const inEuro = calcolaMappaCalore("vendite", BOX, { rendimento: rendimento("valore") }, A4);
    expect(inEuro.unita).toBe("euro");
    expect(inEuro.massimo).toBe(60);

    const inPezzi = calcolaMappaCalore("vendite", BOX, { rendimento: rendimento("pezzi") }, A4);
    expect(inPezzi.unita).toBe("pezzi");
    expect(inPezzi.massimo).toBe(20);
  });

  it("il calcolatore calcola ogni misura una volta sola", () => {
    const calcola = creaCalcolatoreMappe(BOX, {}, A4);

    const prima = calcola("sconto");
    expect(calcola("spazio")).not.toBe(prima);
    expect(calcola("sconto")).toBe(prima);
  });
});

describe("testi della legenda e del tooltip", () => {
  it("il gradiente va dal freddo al caldo con tutte le tappe della scala", () => {
    const gradiente = gradienteScala();
    expect(gradiente.startsWith("linear-gradient(to right, ")).toBe(true);
    expect(gradiente).toContain(`${SCALA_CALORE_STANDARD[0]} 0%`);
    expect(gradiente).toContain(`${SCALA_CALORE_STANDARD[SCALA_CALORE_STANDARD.length - 1]} 100%`);
    expect(gradienteScala(["#000000"])).toBe("#000000");
  });

  it("il valore del box nella misura, o \"Nessun dato\"", () => {
    const mappa = calcolaMappaCalore("vendite", BOX, { rendimento: rendimento("valore") }, A4);

    expect(testoValoreMisura(mappa, "b")).toBe("60 €");
    expect(testoValoreMisura(mappa, "x")).toBe("Nessun dato");
    expect(rigaMisura(mappa, "a")).toEqual({ etichetta: "Vendite", valore: "30 €" });
  });
});
