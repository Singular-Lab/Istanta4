import { describe, expect, it } from "vitest";
import { getSubgroupSourceKey } from "./menaboChiavi";
import { computeSubgroups, etichettaSottogruppo, filtraSottogruppi, type RecordConChiave } from "./menaboSottogruppi";

const SCONTO = [
    { nome_campo: "fascia_sconto", label: "Fascia di sconto" },
    { nome_campo: "txt_sconto", label: "Sconto" },
];
const ref = (codice: string, sconto: string, fascia: string): RecordConChiave => ({
    record: { codice, txt_sconto: sconto, fascia_sconto: fascia },
    recordKey: `k-${codice}`,
});
const dati = [ref("1", "45", "40-49"), ref("2", "40", "40-49"), ref("3", "40", "40-49"), ref("4", "30", "30-39"), ref("5", "", "Senza sconto")];

describe("sottogruppi del menabò a due livelli (task 17ac016e)", () => {
    it("CAMPIONI: fasce nell'ordine ricevuto, dentro ogni fascia i sottogruppi dello sconto preciso", () => {
        const sub = computeSubgroups(SCONTO, "g", dati);
        expect(sub.map(s => s.valoreCampo)).toEqual(["40-49", "30-39", "Senza sconto"]);
        expect(sub[0].figli?.map(f => [f.valoreCampo, f.availableRecords.length])).toEqual([["45", 1], ["40", 2]]);
        expect(sub[1].figli?.map(f => f.valoreCampo)).toEqual(["30"]);
        expect(sub[2].figli?.map(f => f.valoreCampo)).toEqual(["—"]);
    });

    it("con la sola chiave della fascia i sottogruppi sono le fasce, senza figli", () => {
        const sub = computeSubgroups([{ nome_campo: "fascia_sconto", label: "Fascia di sconto" }], "g", dati);
        expect(sub.map(s => s.valoreCampo)).toEqual(["40-49", "30-39", "Senza sconto"]);
        expect(sub.every(s => s.figli === undefined)).toBe(true);
        expect(sub[0].availableRecords).toHaveLength(3);
    });

    it("la fascia contiene tutte le referenze dei suoi sconti", () => {
        const [fascia] = computeSubgroups(SCONTO, "g", dati);
        expect(fascia.availableRecords.map(r => r.record.codice)).toEqual(["1", "2", "3"]);
        expect(fascia.nomeCampo).toBe("fascia_sconto");
        expect(fascia.figli?.[0].nomeCampo).toBe("txt_sconto");
    });

    it("ogni sottogruppo ha la sua chiave di origine", () => {
        const [fascia] = computeSubgroups(SCONTO, "g", dati);
        expect(fascia.sourceKey).toBe(getSubgroupSourceKey("g", "fascia_sconto", "40-49"));
        expect(fascia.figli?.[1].sourceKey).toBe(getSubgroupSourceKey("g", "txt_sconto", "40"));
    });

    it("con una sola chiave resta un livello solo, come per gli altri temi", () => {
        const sub = computeSubgroups([{ nome_campo: "reparto", label: "Reparto" }], "g", [
            { record: { reparto: "Frutta" }, recordKey: "a" },
            { record: { reparto: "Verdura" }, recordKey: "b" },
        ]);
        expect(sub.map(s => s.valoreCampo)).toEqual(["Frutta", "Verdura"]);
        expect(sub.every(s => s.figli === undefined)).toBe(true);
    });

    it("senza chiavi non ci sono sottogruppi", () => {
        expect(computeSubgroups([], "g", dati)).toEqual([]);
    });

    it("le referenze già collocate spariscono dalla fascia e dai suoi sconti", () => {
        const sub = filtraSottogruppi(computeSubgroups(SCONTO, "g", dati), ({ recordKey }) => recordKey !== "k-2");
        expect(sub[0].availableRecords.map(r => r.record.codice)).toEqual(["1", "3"]);
        expect(sub[0].figli?.map(f => f.availableRecords.length)).toEqual([1, 1]);
    });

    it("fasce e sconti portano il «%»; gli altri valori restano com'erano", () => {
        expect(etichettaSottogruppo("fascia_sconto", "40-49")).toBe("Sconto 40-49%");
        expect(etichettaSottogruppo("fascia_sconto", "Senza sconto")).toBe("Senza sconto");
        expect(etichettaSottogruppo("txt_sconto", "40")).toBe("40%");
        expect(etichettaSottogruppo("txt_sconto", "40%")).toBe("40%");
        expect(etichettaSottogruppo("txt_sconto", "—")).toBe("—");
        expect(etichettaSottogruppo("reparto", "Frutta")).toBe("Frutta");
    });
});
