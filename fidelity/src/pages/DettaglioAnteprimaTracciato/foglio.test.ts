import { describe, expect, it } from "vitest";
import {
    colonnaInX,
    filtraRighe,
    indirizzoCella,
    larghezzaAdatta,
    LARGHEZZA_MAX_COLONNA,
    LARGHEZZA_MIN_COLONNA,
    leggiNumero,
    letteraColonna,
    normalizzaSelezione,
    offsetColonne,
    spostaCella,
    statisticheSelezione,
    testoSelezione,
    ValoreCella,
} from "./foglio";

const FOGLIO: ValoreCella[][] = [
    ["Codice", "Descrizione", "Prezzo"],
    ["A1", "Pasta", "1,20"],
    ["B2", "Olio\tEVO", "8.50"],
    ["C3", null, ""],
    ["D4", 'Vino "rosso"', 12],
];

describe("letteraColonna e indirizzoCella", () => {
    it.each([
        [0, "A"],
        [25, "Z"],
        [26, "AA"],
        [51, "AZ"],
        [701, "ZZ"],
        [702, "AAA"],
    ])("la colonna %i e %s", (indice, lettere) => {
        expect(letteraColonna(indice)).toBe(lettere);
    });

    it("l'indirizzo usa la riga del file numerata da 1", () => {
        expect(indirizzoCella(0, 0)).toBe("A1");
        expect(indirizzoCella(119, 27)).toBe("AB120");
    });
});

describe("filtraRighe", () => {
    it("senza termine mostra tutte le righe", () => {
        expect(filtraRighe(FOGLIO, "")).toEqual([0, 1, 2, 3, 4]);
    });

    it("con un termine tiene l'intestazione e le righe che lo contengono, con il loro indice originale", () => {
        expect(filtraRighe(FOGLIO, "  olio ")).toEqual([0, 2]);
        expect(filtraRighe(FOGLIO, "12")).toEqual([0, 4]);
    });

    it("senza corrispondenze resta solo l'intestazione", () => {
        expect(filtraRighe(FOGLIO, "inesistente")).toEqual([0]);
    });

    it("un foglio vuoto non ha righe", () => {
        expect(filtraRighe([], "x")).toEqual([]);
    });
});

describe("testoSelezione", () => {
    it("separa le celle con tabulazione e le righe con a capo, incollabili in Excel", () => {
        const visibili = filtraRighe(FOGLIO, "");
        const testo = testoSelezione(FOGLIO, visibili, normalizzaSelezione({ ancora: { v: 2, c: 1 }, cursore: { v: 1, c: 0 } }));
        expect(testo).toBe('A1\tPasta\r\nB2\t"Olio\tEVO"');
    });

    it("lascia vuote le celle null e raddoppia le virgolette", () => {
        const visibili = filtraRighe(FOGLIO, "");
        expect(testoSelezione(FOGLIO, visibili, { v0: 3, c0: 0, v1: 4, c1: 1 })).toBe('C3\t\r\nD4\t"Vino ""rosso"""');
    });

    it("dopo una ricerca copia le righe mostrate, non quelle nascoste", () => {
        const visibili = filtraRighe(FOGLIO, "vino");
        expect(testoSelezione(FOGLIO, visibili, { v0: 0, c0: 0, v1: 1, c1: 0 })).toBe("Codice\r\nD4");
    });
});

describe("statisticheSelezione e leggiNumero", () => {
    it.each([
        ["1,20", 1.2],
        ["8.50", 8.5],
        ["1.234,56", 1234.56],
        ["1,234.56", 1234.56],
        ["€ 3,00", 3],
        ["-7", -7],
        [12, 12],
    ])("%s vale %d", (valore, atteso) => {
        expect(leggiNumero(valore)).toBeCloseTo(atteso);
    });

    it.each([["Pasta"], [""], [null], ["12/08/2026"], ["."]])("%s non e un numero", valore => {
        expect(leggiNumero(valore)).toBeNull();
    });

    it("conta le celle non vuote e somma solo quelle numeriche", () => {
        const visibili = filtraRighe(FOGLIO, "");
        const stat = statisticheSelezione(FOGLIO, visibili, { v0: 1, c0: 1, v1: 4, c1: 2 });
        expect(stat.celle).toBe(8);
        expect(stat.conteggio).toBe(6);
        expect(stat.numerici).toBe(3);
        expect(stat.somma).toBeCloseTo(21.7);
        expect(stat.media).toBeCloseTo(21.7 / 3);
    });

    it("senza numeri la media e assente", () => {
        const visibili = filtraRighe(FOGLIO, "");
        expect(statisticheSelezione(FOGLIO, visibili, { v0: 0, c0: 0, v1: 0, c1: 1 }).media).toBeNull();
    });
});

describe("spostaCella", () => {
    it("si ferma ai bordi del foglio", () => {
        expect(spostaCella({ v: 0, c: 0 }, -1, -1, 5, 3)).toEqual({ v: 0, c: 0 });
        expect(spostaCella({ v: 4, c: 2 }, 1, 1, 5, 3)).toEqual({ v: 4, c: 2 });
        expect(spostaCella({ v: 1, c: 1 }, 10, 0, 5, 3)).toEqual({ v: 4, c: 1 });
    });

    it("con Ctrl salta al bordo nella direzione della freccia", () => {
        expect(spostaCella({ v: 2, c: 1 }, 1, 0, 5, 3, true)).toEqual({ v: 4, c: 1 });
        expect(spostaCella({ v: 2, c: 1 }, 0, -1, 5, 3, true)).toEqual({ v: 2, c: 0 });
    });
});

describe("colonne", () => {
    it("trova la colonna sotto una x del contenuto", () => {
        const offset = offsetColonne([100, 50, 80]);
        expect(offset).toEqual([0, 100, 150, 230]);
        expect(colonnaInX(offset, 0)).toBe(0);
        expect(colonnaInX(offset, 99)).toBe(0);
        expect(colonnaInX(offset, 100)).toBe(1);
        expect(colonnaInX(offset, 229)).toBe(2);
        expect(colonnaInX(offset, 230)).toBe(-1);
        expect(colonnaInX(offset, -1)).toBe(-1);
    });

    it("la larghezza adatta segue il testo piu lungo entro i limiti", () => {
        const misura = (t: string) => t.length * 7;
        expect(larghezzaAdatta(FOGLIO, 1, misura)).toBe(Math.ceil('Vino "rosso"'.length * 7 + 16));
        expect(larghezzaAdatta(FOGLIO, 1, misura, 1)).toBe(Math.ceil("Descrizione".length * 7 + 16));
        expect(larghezzaAdatta([["x".repeat(500)]], 0, misura)).toBe(LARGHEZZA_MAX_COLONNA);
        expect(larghezzaAdatta([[""]], 0, misura)).toBe(LARGHEZZA_MIN_COLONNA);
    });
});
