import { describe, expect, it } from "vitest";
import { gruppiDellUnione, normalizzaUnioni, sciogliUnione, togliGruppoDallUnione, unisciGruppi } from "./menaboUnioni";

type El = { id: string; groupId: string; unioneId?: string };
const base: El[] = [
    { id: "a-p1", groupId: "A" },
    { id: "b-p1", groupId: "B" },
    { id: "c-p1", groupId: "C" },
];

describe("unioni di gruppi del menabò", () => {
    it("unisce due gruppi e li riconosce come unione", () => {
        const r = unisciGruppi(base, ["A", "B"], "u1");
        expect(r.map(e => e.unioneId)).toEqual(["u1", "u1", undefined]);
        expect(gruppiDellUnione(r, "u1")).toEqual(["A", "B"]);
    });

    it("l'unione vale su tutte le porzioni del gruppo, anche su pagine diverse", () => {
        const conPorzioni: El[] = [...base, { id: "a-p2", groupId: "A" }];
        const r = unisciGruppi(conPorzioni, ["A", "B"], "u1");
        expect(r.filter(e => e.unioneId === "u1").map(e => e.id)).toEqual(["a-p1", "b-p1", "a-p2"]);
        expect(gruppiDellUnione(r, "u1")).toEqual(["A", "B"]);
    });

    it("con meno di due gruppi non cambia niente", () => {
        expect(unisciGruppi(base, ["A"], "u1")).toEqual(base);
    });

    it("unire un gruppo a un'unione esistente la allarga, senza lasciare due unioni", () => {
        const r1 = unisciGruppi(base, ["A", "B"], "u1");
        const r2 = unisciGruppi(r1, ["B", "C"], "u2");
        expect(new Set(r2.map(e => e.unioneId))).toEqual(new Set(["u2"]));
    });

    it("sciogliendo l'unione i gruppi tornano senza unione", () => {
        const r = sciogliUnione(unisciGruppi(base, ["A", "B"], "u1"), "u1");
        expect(r).toEqual(base);
        expect(r.every(e => !("unioneId" in e))).toBe(true);
    });

    it("togliendo un gruppo da un'unione di due, anche l'altro resta solo e si scioglie", () => {
        const r = togliGruppoDallUnione(unisciGruppi(base, ["A", "B"], "u1"), "A");
        expect(r.every(e => e.unioneId === undefined)).toBe(true);
    });

    it("togliendo un gruppo da un'unione di tre, restano uniti gli altri due", () => {
        const r = togliGruppoDallUnione(unisciGruppi(base, ["A", "B", "C"], "u1"), "A");
        expect(gruppiDellUnione(r, "u1")).toEqual(["B", "C"]);
    });

    it("normalizza le unioni rimaste con un solo gruppo", () => {
        const r = normalizzaUnioni([{ id: "x", groupId: "A", unioneId: "u9" }, { id: "y", groupId: "B" }] as El[]);
        expect(r[0].unioneId).toBeUndefined();
    });
});
