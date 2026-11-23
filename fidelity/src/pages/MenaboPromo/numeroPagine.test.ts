import { describe, expect, it } from "vitest";
import { cambioNumeroPagine } from "./MenaboCanvas";

// I20-1256: il numero di pagine del menabò scritto a mano (spec menabo-promo, solo per i clienti la
// cui libreria agenzia lo dichiara). Una pagina è l'elenco delle porzioni di gruppo che contiene.
const piena = (referenze: number) => [{ records: Array.from({ length: referenze }, (_, i) => i) }];
const vuota = () => [] as { records: number[] }[];

/** 22 pagine: le prime 12 con 3 referenze ciascuna, le altre vuote. */
const ventidue = [
    ...Array.from({ length: 12 }, () => piena(3)),
    ...Array.from({ length: 10 }, vuota),
];

describe("menabò: numero di pagine scritto a mano", () => {
    it("da 22 a 12 pagine vuote tolte: 10 pagine sono più di 5, si chiede conferma", () => {
        const cambio = cambioNumeroPagine(22, "12", ventidue, {}, 5);

        expect(cambio).toEqual({ da: 22, a: 12, tolte: 10, referenze: 0, etichette: 0, chiediConferma: true });
    });

    it("da 22 a 19 con le ultime pagine vuote si toglie senza domande", () => {
        const cambio = cambioNumeroPagine(22, "19", ventidue, {}, 5);

        expect(cambio?.tolte).toBe(3);
        expect(cambio?.chiediConferma).toBe(false);
    });

    it("meno di 5 pagine tolte ma con referenze: si chiede conferma e si contano le referenze", () => {
        const pagine = [...ventidue.slice(0, 20), piena(2), piena(4)];

        const cambio = cambioNumeroPagine(22, "19", pagine, {}, 5);

        expect(cambio).toMatchObject({ tolte: 3, referenze: 6, chiediConferma: true });
    });

    it("meno di 5 pagine tolte con un'etichetta: si chiede conferma", () => {
        const cambio = cambioNumeroPagine(22, "20", ventidue, { 3: "AVANCASSA", 21: "PIEDE" }, 5);

        expect(cambio).toMatchObject({ tolte: 2, etichette: 1, chiediConferma: true });
    });

    it("con le pagine tolte si contano tutte le referenze, anche di più porzioni sulla stessa pagina", () => {
        const pagine = [piena(3), [{ records: [1, 2] }, { records: [3] }]];

        expect(cambioNumeroPagine(2, "1", pagine, {}, 5)?.referenze).toBe(3);
    });

    it("un numero più grande aggiunge pagine e non chiede niente", () => {
        const cambio = cambioNumeroPagine(12, "16", ventidue.slice(0, 12), { 3: "AVANCASSA" }, 5);

        expect(cambio).toEqual({ da: 12, a: 16, tolte: 0, referenze: 0, etichette: 0, chiediConferma: false });
    });

    it("gli spazi intorno al numero non contano", () => {
        expect(cambioNumeroPagine(22, " 12 ", ventidue, {}, 5)?.a).toBe(12);
    });

    it.each(["", "abc", "0", "-3", "12.5", "1e3", "12 pagine"])(
        "«%s» non è un numero di pagine valido e si ignora",
        scritto => {
            expect(cambioNumeroPagine(22, scritto, ventidue, {}, 5)).toBeNull();
        },
    );

    it("lo stesso numero di adesso non cambia niente", () => {
        expect(cambioNumeroPagine(22, "22", ventidue, {}, 5)).toBeNull();
    });
});
