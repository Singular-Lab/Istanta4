import { describe, expect, it, vi } from "vitest";
import { TEMA_PREDEFINITO } from "./disegnaFoglio";
import { MessaggioDalMotore, MotoreFoglio } from "./motoreFoglio";

const RISPOSTA = {
    sheets: [
        {
            name: "PROMO",
            rows: [
                ["Codice", "Descrizione", "Prezzo"],
                ["A1", "Pasta", "1,20"],
                ["B2", "Olio", "8,50"],
                ["C3", "Vino", "12,00"],
            ],
        },
        { name: "NOTE", rows: [["Nota"], ["Consegna lunedi"]] },
    ],
};

const rispostaFetch = (status: number, corpo: unknown) =>
    vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response);

const creaMotore = (fetch: ReturnType<typeof rispostaFetch>) => {
    const messaggi: MessaggioDalMotore[] = [];
    const motore = new MotoreFoglio({
        invia: m => messaggi.push(m),
        fetch: fetch as unknown as typeof globalThis.fetch,
        pianifica: cb => cb(),
        misura: t => t.length * 7,
    });
    const ultimo = <T extends MessaggioDalMotore["tipo"]>(tipo: T) =>
        [...messaggi].reverse().find(m => m.tipo === tipo) as Extract<MessaggioDalMotore, { tipo: T }> | undefined;
    const attendi = () => new Promise(r => setTimeout(r, 0));
    return { motore, messaggi, ultimo, attendi };
};

describe("MotoreFoglio", () => {
    it("legge il tracciato con la sessione dell'utente e presenta tutti i fogli", async () => {
        const fetch = rispostaFetch(200, RISPOSTA);
        const { motore, ultimo, attendi } = creaMotore(fetch);
        motore.gestisci({ tipo: "carica", url: "http://host/api/tracciati/t1/parse" });
        await attendi();

        expect(fetch).toHaveBeenCalledWith(
            "http://host/api/tracciati/t1/parse",
            expect.objectContaining({ credentials: "include" })
        );
        expect(ultimo("caricato")?.fogli).toEqual([
            { nome: "PROMO", righe: 4, colonne: 3 },
            { nome: "NOTE", righe: 2, colonne: 1 },
        ]);
        const layout = ultimo("layout")!.layout;
        expect(layout.foglio).toBe(0);
        expect(layout.righeVisibili).toBe(4);
        expect(layout.larghezze).toHaveLength(3);
        expect(ultimo("infoSelezione")).toMatchObject({ indirizzo: "A1", valore: "Codice" });
    });

    it("cambia foglio quando l'operatore sceglie la scheda", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(200, RISPOSTA));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        motore.gestisci({ tipo: "foglio", indice: 1 });

        expect(ultimo("layout")!.layout).toMatchObject({ foglio: 1, righeVisibili: 2, righeFile: 2 });
        motore.gestisci({ tipo: "selezione", selezione: { ancora: { v: 1, c: 0 }, cursore: { v: 1, c: 0 } } });
        expect(ultimo("infoSelezione")).toMatchObject({ indirizzo: "A2", valore: "Consegna lunedi" });
    });

    it("la ricerca mostra le righe trovate con il loro numero originale e la copia le rispetta", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(200, RISPOSTA));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        motore.gestisci({ tipo: "cerca", termine: "vino" });

        expect(ultimo("layout")!.layout).toMatchObject({ righeVisibili: 2, termine: "vino" });
        motore.gestisci({ tipo: "selezione", selezione: { ancora: { v: 1, c: 0 }, cursore: { v: 1, c: 2 } } });
        expect(ultimo("infoSelezione")!.indirizzo).toBe("A4");

        motore.gestisci({ tipo: "copia", richiesta: 7 });
        expect(ultimo("testoCopia")).toEqual({ tipo: "testoCopia", richiesta: 7, testo: "C3\tVino\t12,00", celle: 3 });
    });

    it("calcola conteggio e somma della selezione", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(200, RISPOSTA));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        motore.gestisci({ tipo: "selezione", selezione: { ancora: { v: 1, c: 2 }, cursore: { v: 3, c: 2 } } });

        const stat = ultimo("infoSelezione")!.statistiche;
        expect(stat).toMatchObject({ celle: 3, conteggio: 3, numerici: 3 });
        expect(stat.somma).toBeCloseTo(21.7);
    });

    it("una selezione fuori dal foglio viene riportata entro i bordi", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(200, RISPOSTA));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        motore.gestisci({ tipo: "selezione", selezione: { ancora: { v: 99, c: 99 }, cursore: { v: 99, c: 99 } } });
        expect(ultimo("infoSelezione")).toMatchObject({ indirizzo: "C4", valore: "12,00" });
    });

    it("ridimensiona e adatta le colonne entro i limiti", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(200, RISPOSTA));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        motore.gestisci({ tipo: "larghezza", colonna: 1, larghezza: 5 });
        expect(ultimo("layout")!.layout.larghezze[1]).toBe(40);
        motore.gestisci({ tipo: "adatta", colonna: 1 });
        expect(ultimo("layout")!.layout.larghezze[1]).toBe(Math.ceil("Descrizione".length * 7 + 16));
    });

    it("accetta il tema della pagina prima dei dati e misura le colonne con il suo font", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(200, RISPOSTA));
        motore.gestisci({ tipo: "tema", tema: { ...TEMA_PREDEFINITO, font: "Urbanist, sans-serif", bordoSelezione: "rgb(91 33 182 / 1)" } });
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        expect(ultimo("caricato")).toBeDefined();
        expect(ultimo("layout")!.layout.larghezze).toHaveLength(3);
    });

    it("se il server rifiuta la lettura riporta il motivo", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(500, { message: "Errore durante il parsing del tracciato" }));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        expect(ultimo("errore")).toEqual({ tipo: "errore", status: 500, messaggio: "Errore durante il parsing del tracciato" });
        expect(ultimo("caricato")).toBeUndefined();
    });

    it("con la sessione scaduta lo dice all'operatore", async () => {
        const { motore, ultimo, attendi } = creaMotore(rispostaFetch(401, null));
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        expect(ultimo("errore")).toMatchObject({ status: 401, messaggio: "Sessione scaduta: accedi di nuovo" });
    });

    it("se la rete non risponde riporta l'errore", async () => {
        const fetch = vi.fn(async () => {
            throw new Error("Failed to fetch");
        });
        const { motore, ultimo, attendi } = creaMotore(fetch as unknown as ReturnType<typeof rispostaFetch>);
        motore.gestisci({ tipo: "carica", url: "u" });
        await attendi();
        expect(ultimo("errore")?.messaggio).toBe("Failed to fetch");
    });
});
