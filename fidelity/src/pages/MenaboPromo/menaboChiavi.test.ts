import { describe, expect, it } from "vitest";
import {
    getGroupSourceKey,
    getRecordKey,
    getSubgroupSourceKey,
    identitaReferenza,
    ricollegaElementiSalvati,
    type ElementoCollocato,
} from "./menaboChiavi";

// Spec fidelity/menabo-promo, "Menabò salvato ricollegato alle referenze della promo"

const DIVISIONE = "canale-1";
const CAMPI_COOPFI = ["Scatto.CodiceGruppo", "Referenza.Codice"];

const ref = (codice: string, tema: string, extra: Record<string, string> = {}): Record<string, string> => ({
    "Referenza.Codice": codice,
    "Scatto.CodiceGruppo": "",
    tema,
    reparto: "ALIMENTARI",
    ...extra,
});

const A = ref("A", "SPRINT");
const B = ref("B", "SPRINT");
const C = ref("C", "SPRINT");
const D = ref("D", "EX TRIPLA", { format1: "MG+" });
const E = ref("E", "CONV.A TAVOLA", { format1: "MG+" });

type Gruppo = { nome_campo: string; valore_campo: string; records: Record<string, string>[] };
const sprint = (...records: Record<string, string>[]): Gruppo => ({ nome_campo: "tema", valore_campo: "SPRINT", records });
const formatPlus = (...records: Record<string, string>[]): Gruppo => ({ nome_campo: "format1", valore_campo: "FORMAT+", records });

const divisione = (...raggruppamento: Gruppo[]) => ({ id: DIVISIONE, raggruppamento });

/** Un gruppo trascinato intero dalla sidebar, come lo salva il menabò. */
function gruppoCollocato(div: ReturnType<typeof divisione>, idx: number, posizioni: number[]): ElementoCollocato {
    const sourceKey = getGroupSourceKey(div.id, div.raggruppamento[idx], idx);
    return {
        sourceKey,
        recordKeys: posizioni.map(p => getRecordKey(sourceKey, p)),
        records: posizioni.map(p => div.raggruppamento[idx].records[p]),
    };
}

/** La referenza della divisione attuale che una chiave indica, come la legge la sidebar. */
function referenzaDellaChiave(div: ReturnType<typeof divisione>, recordKey: string) {
    for (const [idx, item] of div.raggruppamento.entries()) {
        const sourceKey = getGroupSourceKey(div.id, item, idx);
        const r = item.records.findIndex((_, p) => getRecordKey(sourceKey, p) === recordKey);
        if (r >= 0) return item.records[r];
    }
    return undefined;
}

function tutteLeChiaviAttuali(div: ReturnType<typeof divisione>) {
    return new Set(div.raggruppamento.flatMap((item, idx) =>
        item.records.map((_, p) => getRecordKey(getGroupSourceKey(div.id, item, idx), p))));
}

describe("identitaReferenza", () => {
    it("usa il primo campo dichiarato con un valore, senza distinguere maiuscole e minuscole", () => {
        const singola = { "referenza.codice": "7527375", "Scatto.CodiceGruppo": "" };
        const diGruppo = { "Referenza.Codice": "7527375", "Scatto.CodiceGruppo": "7527375,7527380" };

        expect(identitaReferenza(singola, CAMPI_COOPFI)).toBe(identitaReferenza({ "Referenza.Codice": "7527375 " }, CAMPI_COOPFI));
        expect(identitaReferenza(diGruppo, CAMPI_COOPFI)).not.toBe(identitaReferenza(singola, CAMPI_COOPFI));
    });

    it("senza campi dichiarati confronta la referenza intera, indipendentemente dall'ordine dei campi", () => {
        expect(identitaReferenza({ a: "1", b: "2" }, [])).toBe(identitaReferenza({ b: "2", a: "1" }, []));
        expect(identitaReferenza({ a: "1", b: "2" }, [])).not.toBe(identitaReferenza({ a: "1", b: "3" }, []));
    });
});

describe("ricollegaElementiSalvati", () => {
    it("ricollega le referenze quando l'ordinamento merceologico ne cambia l'ordine", () => {
        const prima = divisione(sprint(A, B, C));
        const salvato = [gruppoCollocato(prima, 0, [0, 1])]; // A e B in pagina
        const oggi = divisione(sprint(C, B, A));

        const [ricollegato] = ricollegaElementiSalvati(salvato, oggi, CAMPI_COOPFI);

        expect(ricollegato.recordKeys.map(k => referenzaDellaChiave(oggi, k))).toEqual([A, B]);
        expect(ricollegato.records).toEqual([A, B]);
    });

    it("aggiorna la sourceKey del gruppo che occupa un'altra posizione nell'elenco", () => {
        const prima = divisione(sprint(A, B), formatPlus(D, E));
        const salvato = [gruppoCollocato(prima, 0, [0, 1])];
        const oggi = divisione(formatPlus(E, D), sprint(B, A));

        const [ricollegato] = ricollegaElementiSalvati(salvato, oggi, CAMPI_COOPFI);

        expect(ricollegato.sourceKey).toBe(getGroupSourceKey(DIVISIONE, oggi.raggruppamento[1], 1));
        expect(ricollegato.recordKeys.map(k => referenzaDellaChiave(oggi, k))).toEqual([A, B]);
    });

    it("ricollega un sottogruppo di FORMAT+", () => {
        const prima = divisione(sprint(A), formatPlus(D, E));
        const gruppoPrima = getGroupSourceKey(DIVISIONE, prima.raggruppamento[1], 1);
        const salvato: ElementoCollocato[] = [{
            sourceKey: getSubgroupSourceKey(gruppoPrima, "tema", "EX TRIPLA"),
            recordKeys: [getRecordKey(gruppoPrima, 0)],
            records: [D],
        }];
        const oggi = divisione(formatPlus(E, D), sprint(A));

        const [ricollegato] = ricollegaElementiSalvati(salvato, oggi, CAMPI_COOPFI);

        const gruppoOggi = getGroupSourceKey(DIVISIONE, oggi.raggruppamento[0], 0);
        expect(ricollegato.sourceKey).toBe(getSubgroupSourceKey(gruppoOggi, "tema", "EX TRIPLA"));
        expect(ricollegato.recordKeys).toEqual([getRecordKey(gruppoOggi, 1)]);
    });

    it("con una libreria che non dichiara campi ricollega confrontando la referenza intera", () => {
        const prima = divisione(sprint(A, B, C));
        const salvato = [gruppoCollocato(prima, 0, [0, 2])];
        const oggi = divisione(sprint(C, A, B));

        const [ricollegato] = ricollegaElementiSalvati(salvato, oggi, []);

        expect(ricollegato.recordKeys.map(k => referenzaDellaChiave(oggi, k))).toEqual([A, C]);
    });

    it("lascia in pagina una referenza non più nella promo senza nascondere quelle di oggi", () => {
        const Z = ref("Z", "SPRINT");
        const prima = divisione(sprint(Z, A, B));
        const salvato = [gruppoCollocato(prima, 0, [0, 1])]; // Z e A in pagina
        const oggi = divisione(sprint(B, A)); // Z tolta: la sua vecchia posizione ora è di B

        const [ricollegato] = ricollegaElementiSalvati(salvato, oggi, CAMPI_COOPFI);

        expect(ricollegato.records).toEqual([Z, A]);
        expect(referenzaDellaChiave(oggi, ricollegato.recordKeys[1])).toEqual(A);
        expect(tutteLeChiaviAttuali(oggi).has(ricollegato.recordKeys[0])).toBe(false);
        expect(ricollegato.recordKeys[0]).toContain(DIVISIONE);
    });

    it("non assegna due volte la stessa referenza quando più referenze hanno lo stesso codice", () => {
        const A1 = ref("A", "SPRINT", { prezzo_promo: "1.00" });
        const A2 = ref("A", "SPRINT", { prezzo_promo: "1.20" });
        const prima = divisione(sprint(A1, A2, B));
        const salvato = [gruppoCollocato(prima, 0, [0, 1])];
        const oggi = divisione(sprint(B, A2, A1));

        const [ricollegato] = ricollegaElementiSalvati(salvato, oggi, CAMPI_COOPFI);

        expect(new Set(ricollegato.recordKeys).size).toBe(2);
        expect(ricollegato.recordKeys.map(k => referenzaDellaChiave(oggi, k)?.["Referenza.Codice"])).toEqual(["A", "A"]);
    });

    it("lascia invariato un menabò già allineato alle referenze di oggi", () => {
        const oggi = divisione(sprint(A, B, C), formatPlus(D, E));
        const salvato = [gruppoCollocato(oggi, 0, [1, 2]), gruppoCollocato(oggi, 1, [0])];

        expect(ricollegaElementiSalvati(salvato, oggi, CAMPI_COOPFI)).toEqual(salvato);
    });
});
