import { describe, expect, it } from "vitest";
import { pagineDelGruppo, referenzeDellaPagina } from "./menaboSelezione";

// Pagine come le produce paginatePlacedItems: una porzione per pagina, stesso groupId
const sprint = (pageIndex: number, records: string[]) => ({ groupId: "sprint", pageIndex, records });
const vini = (pageIndex: number, records: string[]) => ({ groupId: "vini", pageIndex, records });

const pagine = [
    [],
    [],
    [sprint(2, ["S1", "S2", "S3"]), vini(2, ["V1"])],
    [sprint(3, ["S4", "S5"])],
];

describe("referenzeDellaPagina", () => {
    it("gruppo su due pagine: solo le referenze della pagina selezionata", () => {
        expect(referenzeDellaPagina(pagine, "sprint", 3)).toEqual(["S4", "S5"]);
        expect(referenzeDellaPagina(pagine, "sprint", 2)).toEqual(["S1", "S2", "S3"]);
    });

    it("non include gli altri gruppi della stessa pagina", () => {
        expect(referenzeDellaPagina(pagine, "vini", 2)).toEqual(["V1"]);
    });

    it("senza pagina selezionata: tutte le referenze del gruppo in ordine di pagina", () => {
        expect(referenzeDellaPagina(pagine, "sprint", null)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    });

    it("pagina su cui il gruppo non c'è più: tutte le referenze del gruppo", () => {
        expect(referenzeDellaPagina(pagine, "sprint", 0)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    });

    it("gruppo inesistente: nessuna referenza", () => {
        expect(referenzeDellaPagina(pagine, "altro", 2)).toEqual([]);
    });
});

describe("pagineDelGruppo", () => {
    it("pagine numerate da 1, senza duplicati", () => {
        expect(pagineDelGruppo(pagine, "sprint")).toEqual([3, 4]);
        expect(pagineDelGruppo(pagine, "vini")).toEqual([3]);
    });
});
