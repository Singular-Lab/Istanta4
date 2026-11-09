import { describe, expect, it } from "vitest";
import { PALETTE_REPORT_STANDARD, type VoceGrafico } from "../../../../lib/insightVolantino/report";
import { coloriConfronto, fetteCiambella, lunghezzaBarra, righeNelloSpazio, scalaAsse, settoreAnulare } from "./grafici";

const voce = (etichetta: string, valore: number, colore: string | null = null): VoceGrafico => ({
  etichetta,
  valore,
  testo: String(valore),
  colore,
});

describe("scala degli assi", () => {
  it("arrotonda il massimo a un passo tondo, con tacche regolari da 0", () => {
    expect(scalaAsse(87)).toEqual({ massimo: 100, tacche: [0, 25, 50, 75, 100] });
    expect(scalaAsse(4)).toEqual({ massimo: 4, tacche: [0, 1, 2, 3, 4] });
    expect(scalaAsse(0.9)).toEqual({ massimo: 1, tacche: [0, 0.25, 0.5, 0.75, 1] });
    expect(scalaAsse(1830)).toEqual({ massimo: 2000, tacche: [0, 500, 1000, 1500, 2000] });
  });

  it("senza valori positivi l'asse va da 0 a 1", () => {
    expect(scalaAsse(0)).toEqual({ massimo: 1, tacche: [0, 1] });
    expect(scalaAsse(Number.NaN)).toEqual({ massimo: 1, tacche: [0, 1] });
  });

  it("la barra è proporzionale al fondo scala, mai negativa né oltre la traccia", () => {
    expect(lunghezzaBarra(50, 100, 200)).toBe(100);
    expect(lunghezzaBarra(-5, 100, 200)).toBe(0);
    expect(lunghezzaBarra(150, 100, 200)).toBe(200);
  });
});

describe("righe di un grafico nello spazio", () => {
  it("tutte le righe entrano, alte al massimo 20 pt", () => {
    const righe = righeNelloSpazio([1, 2, 3], 300);
    expect(righe).toEqual({ visibili: [1, 2, 3], nascoste: 0, altezzaRiga: 20 });
  });

  it("oltre la capienza le ultime voci restano fuori e il grafico lo sa", () => {
    const righe = righeNelloSpazio(Array.from({ length: 30 }, (_, indice) => indice), 120);
    expect(righe.visibili).toHaveLength(10);
    expect(righe.nascoste).toBe(20);
    expect(righe.altezzaRiga).toBe(12);
  });
});

describe("ciambella", () => {
  it("le fette coprono il giro intero, con i colori delle categorie e le quote", () => {
    const fette = fetteCiambella([voce("Drogheria", 30), voce("Freschi", 10, "#123456")], PALETTE_REPORT_STANDARD);
    expect(fette.map((fetta) => [fetta.etichetta, fetta.colore, fetta.quota])).toEqual([
      ["Drogheria", PALETTE_REPORT_STANDARD.categorie[0], 0.75],
      ["Freschi", "#123456", 0.25],
    ]);
    expect(fette[0].inizio).toBe(0);
    expect(fette[1].fine).toBeCloseTo(360);
  });

  it("oltre il massimo le voci più piccole finiscono in «Altre N voci»", () => {
    const voci = [voce("A", 50), voce("B", 1), voce("C", 40), voce("D", 2), voce("E", 30)];
    const fette = fetteCiambella(voci, PALETTE_REPORT_STANDARD, 3);
    expect(fette.map((fetta) => fetta.etichetta)).toEqual(["A", "C", "Altre 3 voci"]);
    expect(fette[2]).toMatchObject({ valore: 33, testo: "", altre: true, colore: PALETTE_REPORT_STANDARD.linee });
  });

  it("senza un totale positivo non ci sono fette", () => {
    expect(fetteCiambella([voce("A", 0), voce("B", -3)], PALETTE_REPORT_STANDARD)).toEqual([]);
  });

  it("il settore di corona parte da ore 12 e gira in senso orario", () => {
    expect(settoreAnulare(50, 50, 40, 20, 0, 90)).toBe("M50 10 A40 40 0 0 1 90 50 L70 50 A20 20 0 0 0 50 30 Z");
    // Un giro intero si disegna in due metà
    expect(settoreAnulare(50, 50, 40, 20, 0, 360).match(/M/g)).toHaveLength(2);
    expect(settoreAnulare(50, 50, 40, 20, 10, 10)).toBe("");
  });
});

describe("confronto fra due serie", () => {
  it("usa il primario e una categoria chiara diversa dal primario", () => {
    expect(coloriConfronto(PALETTE_REPORT_STANDARD)).toEqual([PALETTE_REPORT_STANDARD.primario, PALETTE_REPORT_STANDARD.categorie[2]]);
    expect(coloriConfronto({ ...PALETTE_REPORT_STANDARD, categorie: [] })).toEqual([
      PALETTE_REPORT_STANDARD.primario,
      PALETTE_REPORT_STANDARD.inchiostroTenue,
    ]);
  });
});
