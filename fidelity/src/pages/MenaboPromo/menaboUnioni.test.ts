import { describe, expect, it } from "vitest";
import { alternaGruppoDaUnire, altrePagineDellUnione, filtraGruppiUnibili, gruppiDellUnione, normalizzaUnioni, numeroDelleUnioni, raggruppaPerUnione, rimandoAltrePagine, sciogliUnione, togliGruppoDallUnione, unisciGruppi } from "./menaboUnioni";

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

describe("lettura dell'unione nel menabò (task 17ac016e)", () => {
    it("numera le unioni nell'ordine in cui compaiono, lo stesso numero su tutte le pagine", () => {
        const el: El[] = [
            { id: "a-p1", groupId: "A", unioneId: "ux" },
            { id: "b-p1", groupId: "B" },
            { id: "c-p1", groupId: "C", unioneId: "uy" },
            { id: "a-p2", groupId: "A", unioneId: "ux" },
        ];
        const numeri = numeroDelleUnioni(el);
        expect(numeri.get("ux")).toBe(1);
        expect(numeri.get("uy")).toBe(2);
        expect(numeri.size).toBe(2);
    });

    it("senza unioni non numera niente", () => {
        expect(numeroDelleUnioni(base).size).toBe(0);
    });
});

describe("riconoscere le unioni sulle pagine (task 769e2865)", () => {
    it("le schede unite consecutive stanno in un blocco solo", () => {
        const schede = [{ unioneId: "u1" }, { unioneId: "u1" }, { unioneId: "u1" }, {}, { unioneId: "u2" }];
        expect(raggruppaPerUnione(schede)).toEqual([
            { unioneId: "u1", indici: [0, 1, 2] },
            { indici: [3] },
            { unioneId: "u2", indici: [4] },
        ]);
    });

    it("due unioni diverse una dopo l'altra restano blocchi separati", () => {
        expect(raggruppaPerUnione([{ unioneId: "u1" }, { unioneId: "u2" }])).toEqual([
            { unioneId: "u1", indici: [0] },
            { unioneId: "u2", indici: [1] },
        ]);
    });

    it("la stessa unione interrotta da una scheda non unita dà tre blocchi", () => {
        expect(raggruppaPerUnione([{ unioneId: "u1" }, {}, { unioneId: "u1" }]).map(b => b.indici)).toEqual([[0], [1], [2]]);
    });

    it("le schede non unite sono un blocco ciascuna, senza unione", () => {
        expect(raggruppaPerUnione([{}, {}])).toEqual([{ indici: [0] }, { indici: [1] }]);
        expect(raggruppaPerUnione([])).toEqual([]);
    });

    it("le altre pagine dell'unione, senza quella corrente e senza doppioni", () => {
        const el = [
            { unioneId: "u1", pageIndex: 4 },
            { unioneId: "u1", pageIndex: 4 },
            { unioneId: "u1", pageIndex: 5 },
            { unioneId: "u2", pageIndex: 7 },
            { pageIndex: 8 },
        ];
        expect(altrePagineDellUnione(el, "u1", 4)).toEqual([5]);
        expect(altrePagineDellUnione(el, "u1", 5)).toEqual([4]);
        expect(altrePagineDellUnione(el, undefined, 4)).toEqual([]);
    });

    it("il rimando dice dove prosegue l'unione, con le pagine da 1", () => {
        expect(rimandoAltrePagine([5], 4)).toBe("→ pag. 6");
        expect(rimandoAltrePagine([3], 4)).toBe("← pag. 4");
        expect(rimandoAltrePagine([2, 5], 4)).toBe("← pag. 3 · → pag. 6");
        expect(rimandoAltrePagine([], 4)).toBe("");
    });
});

describe("ricerca fra i gruppi unibili (I20-1267)", () => {
    const gruppi = [
        { groupId: "a", label: "CAMPIONI DEL RISPARMIO (OS20A)" },
        { groupId: "b", label: "CONVENIENZA (OS20A)" },
        { groupId: "c", label: "Più valore SOCI" },
    ];

    it("senza testo restituisce tutti i gruppi", () => {
        expect(filtraGruppiUnibili(gruppi, "  ")).toHaveLength(3);
    });

    it("cerca per parole, senza maiuscole né accenti", () => {
        expect(filtraGruppiUnibili(gruppi, "campioni risparmio").map(g => g.groupId)).toEqual(["a"]);
        expect(filtraGruppiUnibili(gruppi, "piu VALORE").map(g => g.groupId)).toEqual(["c"]);
    });

    it("tiene visibili i gruppi già spuntati anche se non corrispondono", () => {
        expect(filtraGruppiUnibili(gruppi, "convenienza", new Set(["c"])).map(g => g.groupId)).toEqual(["b", "c"]);
    });

    it("nessuna corrispondenza: elenco vuoto", () => {
        expect(filtraGruppiUnibili(gruppi, "zzz")).toEqual([]);
    });

    it("alternaGruppoDaUnire aggiunge e toglie la spunta", () => {
        expect(alternaGruppoDaUnire(["a"], "b")).toEqual(["a", "b"]);
        expect(alternaGruppoDaUnire(["a", "b"], "a")).toEqual(["b"]);
    });
});
