import { describe, expect, it } from "vitest";
import { pagineDaPrecaricare, pagineVisibili } from "./paginePrecaricate";

describe("pagine dell'anteprima PDF da precaricare (task a2fb02c1)", () => {
    it("la copertina è sola, poi le pagine vanno a due a due", () => {
        expect(pagineVisibili(1, true, 40)).toEqual([1]);
        expect(pagineVisibili(4, false, 40)).toEqual([4, 5]);
    });

    it("l'ultima pagina pari resta sola", () => {
        expect(pagineVisibili(40, false, 40)).toEqual([40]);
    });

    it("dalla copertina si precarica solo l'apertura 2-3, non tutto il volantino", () => {
        expect(pagineDaPrecaricare(1, true, 40)).toEqual([1, 2, 3]);
    });

    it("in mezzo al volantino si precaricano la corrente e le due aperture vicine", () => {
        expect(pagineDaPrecaricare(10, false, 40)).toEqual([10, 11, 8, 9, 12, 13]);
    });

    it("dalla pagina 2 l'apertura precedente è la copertina", () => {
        expect(pagineDaPrecaricare(2, false, 40)).toEqual([2, 3, 1, 4, 5]);
    });

    it("alla fine non chiede pagine che non esistono", () => {
        expect(pagineDaPrecaricare(40, false, 40)).toEqual([40, 38, 39]);
        expect(pagineDaPrecaricare(1, true, 1)).toEqual([1]);
    });

    it("un volantino da 40 pagine non ne precarica più di 6", () => {
        for (let pagina = 2; pagina <= 40; pagina += 2) {
            expect(pagineDaPrecaricare(pagina, false, 40).length).toBeLessThanOrEqual(6);
        }
    });
});
