import { describe, expect, it } from "vitest";
import { ContestoDisegno, disegnaFoglio, StatoDisegno, TEMA_PREDEFINITO, TemaFoglio } from "./disegnaFoglio";
import { filtraRighe, larghezzaGutter, normalizzaSelezione, offsetColonne, Selezione, ValoreCella } from "./foglio";

type Tratto = { tipo: "fillRect" | "strokeRect" | "fillText"; colore: string; spessore: number; font: string; testo?: string };

/** Contesto canvas finto: registra con quale colore, spessore e font viene disegnato ogni elemento. */
const contestoRegistratore = () => {
    const tratti: Tratto[] = [];
    const ctx = {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "left",
        textBaseline: "alphabetic",
        setTransform() { },
        save() { },
        restore() { },
        beginPath() { },
        closePath() { },
        rect() { },
        clip() { },
        moveTo() { },
        lineTo() { },
        stroke() { },
        fill() { },
        measureText: (t: string) => ({ width: t.length * 6 }),
        fillRect() {
            tratti.push({ tipo: "fillRect", colore: String(ctx.fillStyle), spessore: ctx.lineWidth, font: ctx.font });
        },
        strokeRect() {
            tratti.push({ tipo: "strokeRect", colore: String(ctx.strokeStyle), spessore: ctx.lineWidth, font: ctx.font });
        },
        fillText(testo: string) {
            tratti.push({ tipo: "fillText", colore: String(ctx.fillStyle), spessore: ctx.lineWidth, font: ctx.font, testo });
        },
    };
    return { ctx: ctx as unknown as ContestoDisegno, tratti };
};

const RIGHE: ValoreCella[][] = [
    ["Codice", "Descrizione"],
    ["A1", "Pasta"],
    ["B2", "Olio"],
];

const stato = (tema: TemaFoglio, selezione: Selezione | null = null): StatoDisegno => {
    const larghezze = [80, 120];
    return {
        larghezza: 400,
        altezza: 200,
        dpr: 1,
        scrollTop: 0,
        scrollLeft: 0,
        righe: RIGHE,
        visibili: filtraRighe(RIGHE, ""),
        larghezze,
        offset: offsetColonne(larghezze),
        gutter: larghezzaGutter(RIGHE.length),
        selezione,
        intervallo: selezione ? normalizzaSelezione(selezione) : null,
        termine: "",
        tema,
    };
};

const TEMA_VIOLA: TemaFoglio = {
    ...TEMA_PREDEFINITO,
    font: "Urbanist, sans-serif",
    sfondo: "rgb(255 255 255 / 1)",
    testo: "rgb(30 41 59 / 1)",
    bordoSelezione: "rgb(76 29 149 / 1)",
    intestazioneAttivaTesto: "rgb(76 29 149 / 1)",
};

describe("disegnaFoglio", () => {
    it("usa lo sfondo e il font del tema ricevuto dalla pagina", () => {
        const { ctx, tratti } = contestoRegistratore();
        disegnaFoglio(ctx, stato(TEMA_VIOLA));

        expect(tratti[0]).toMatchObject({ tipo: "fillRect", colore: TEMA_VIOLA.sfondo });
        const celle = tratti.filter(t => t.tipo === "fillText" && t.testo === "Pasta");
        expect(celle).toHaveLength(1);
        expect(celle[0].font).toContain("Urbanist, sans-serif");
        expect(celle[0].colore).toBe(TEMA_VIOLA.testo);
    });

    it("borda la selezione e colora le intestazioni attive con il colore primario del tema", () => {
        const { ctx, tratti } = contestoRegistratore();
        disegnaFoglio(ctx, stato(TEMA_VIOLA, { ancora: { v: 1, c: 1 }, cursore: { v: 2, c: 1 } }));

        const bordo = tratti.filter(t => t.tipo === "strokeRect" && t.spessore === 2);
        expect(bordo).toHaveLength(1);
        expect(bordo[0].colore).toBe(TEMA_VIOLA.bordoSelezione);
        expect(tratti.find(t => t.tipo === "fillText" && t.testo === "B")?.colore).toBe(TEMA_VIOLA.intestazioneAttivaTesto);
        expect(tratti.find(t => t.tipo === "fillText" && t.testo === "A")?.colore).toBe(TEMA_VIOLA.intestazioneTesto);
    });

    it("cambiando tema cambiano i colori disegnati", () => {
        const primo = contestoRegistratore();
        const secondo = contestoRegistratore();
        const selezione = { ancora: { v: 1, c: 0 }, cursore: { v: 1, c: 0 } };
        disegnaFoglio(primo.ctx, stato(TEMA_PREDEFINITO, selezione));
        disegnaFoglio(secondo.ctx, stato(TEMA_VIOLA, selezione));

        const coloreBordo = (tratti: Tratto[]) => tratti.find(t => t.tipo === "strokeRect" && t.spessore === 2)?.colore;
        expect(coloreBordo(primo.tratti)).toBe(TEMA_PREDEFINITO.bordoSelezione);
        expect(coloreBordo(secondo.tratti)).toBe(TEMA_VIOLA.bordoSelezione);
    });
});
