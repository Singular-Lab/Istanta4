import { describe, expect, it } from "vitest";
import { anteprimaNote } from "./menaboNote";

describe("suggerimento della linguetta delle note (task 769e2865)", () => {
    it("una nota: il conteggio al singolare e la sua prima riga", () => {
        expect(anteprimaNote([{ text: "Controllare il prezzo\nsecondo rigo" }])).toBe("1 nota — «Controllare il prezzo» · clicca per aprire");
    });

    it("più note: il conteggio al plurale e la prima riga della prima nota con testo", () => {
        expect(anteprimaNote([{ text: "  \n " }, { text: "\n  Foto da cambiare" }, { text: "Altro" }]))
            .toBe("3 note — «Foto da cambiare» · clicca per aprire");
    });

    it("note tutte vuote: solo il conteggio", () => {
        expect(anteprimaNote([{ text: "" }])).toBe("1 nota — clicca per aprire");
    });

    it("la riga lunga si accorcia con i puntini", () => {
        const lunga = "x".repeat(100);
        const r = anteprimaNote([{ text: lunga }]);
        expect(r).toContain("…");
        expect(r.length).toBeLessThan(100);
    });
});
