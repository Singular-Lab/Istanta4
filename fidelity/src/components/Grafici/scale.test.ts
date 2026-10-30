import { describe, expect, it } from "vitest";
import {
  dataBreve,
  msData,
  percorsoBarraOrizzontale,
  percorsoColonna,
  scalaLineare,
  taccheTempo,
  taccheTonde,
} from "./scale";

// Calcoli dei grafici SVG: scale, tacche, date e forme dei segni

describe("scale e tacche", () => {
  it("la scala lineare porta il dominio sulle coordinate, anche rovesciate", () => {
    const y = scalaLineare([0, 300], [150, 30]);
    expect(y(0)).toBe(150);
    expect(y(150)).toBe(90);
    expect(y(300)).toBe(30);
  });

  it("un dominio vuoto finisce al centro dell'intervallo", () => {
    expect(scalaLineare([5, 5], [0, 100])(5)).toBe(50);
  });

  it("le tacche sono numeri tondi che coprono minimo e massimo", () => {
    expect(taccheTonde(0, 270, 3)).toEqual([0, 100, 200, 300]);
    expect(taccheTonde(15, 30, 4)).toEqual([15, 20, 25, 30]);
    expect(taccheTonde(1.49, 2.95, 4)).toEqual([1, 1.5, 2, 2.5, 3]);
  });

  it("con un valore solo l'asse parte da zero; senza valori resta 0–1", () => {
    expect(taccheTonde(40, 40, 4)[0]).toBe(0);
    expect(taccheTonde(40, 40, 4).at(-1)).toBeGreaterThanOrEqual(40);
    expect(taccheTonde(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe("tempo", () => {
  it("le date ISO restano il giorno scritto, in UTC", () => {
    expect(msData("2024-04-08")).toBe(Date.UTC(2024, 3, 8));
    expect(dataBreve(msData("2024-04-08"))).toBe("8 apr 2024");
  });

  it("su più anni le tacche sono gli anni, con l'etichetta al centro dell'anno", () => {
    const tacche = taccheTempo(Date.UTC(2021, 0, 1), Date.UTC(2024, 0, 1));
    expect(tacche.map(t => t.etichetta)).toEqual(["2021", "2022", "2023"]);
    expect(tacche[0].centro).toBe((Date.UTC(2021, 0, 1) + Date.UTC(2022, 0, 1)) / 2);
  });

  it("nello zoom su un anno le tacche sono i mesi", () => {
    const tacche = taccheTempo(Date.UTC(2025, 0, 1), Date.UTC(2026, 0, 1));
    expect(tacche).toHaveLength(12);
    expect(tacche[0].etichetta).toBe("gen");
    expect(tacche[11].etichetta).toBe("dic");
  });
});

describe("forme dei segni", () => {
  it("la barra orizzontale ha la base squadrata e l'estremità del dato arrotondata", () => {
    expect(percorsoBarraOrizzontale(10, 0, 100, 20)).toBe("M10 0 h96 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-96 Z");
  });

  it("la colonna sale dalla base con la cima arrotondata; il raggio non supera metà larghezza", () => {
    expect(percorsoColonna(0, 100, 50, 6)).toBe("M0 100 v-47 a3 3 0 0 1 3 -3 h0 a3 3 0 0 1 3 3 v47 Z");
  });

  it("un valore zero non disegna niente", () => {
    expect(percorsoBarraOrizzontale(0, 0, 0, 20)).toBe("");
    expect(percorsoColonna(0, 100, 0, 10)).toBe("");
  });
});
