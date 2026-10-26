import {
    ALTEZZA_LETTERE,
    ALTEZZA_RIGA,
    cellaCorrisponde,
    clamp,
    colonnaInX,
    Intervallo,
    leggiNumero,
    letteraColonna,
    Selezione,
    testoCella,
    ValoreCella,
} from "./foglio";

/* =======================
   DISEGNO DEL FOGLIO SU CANVAS
   Tutta la griglia, intestazioni comprese, e disegnata qui: la pagina non crea
   elementi DOM per le celle. Gira nel worker su un OffscreenCanvas.
   ======================= */

export type ContestoDisegno = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type StatoDisegno = {
    larghezza: number;
    altezza: number;
    dpr: number;
    scrollTop: number;
    scrollLeft: number;
    righe: ValoreCella[][];
    visibili: number[];
    larghezze: number[];
    offset: number[];
    gutter: number;
    selezione: Selezione | null;
    intervallo: Intervallo | null;
    termine: string;
    tema: TemaFoglio;
};

/**
 * Colori e font della griglia. Il worker non vede le variabili CSS del tema:
 * la pagina li legge con getColor e li manda con il messaggio "tema".
 */
export type TemaFoglio = {
    font: string;
    sfondo: string;
    testo: string;
    griglia: string;
    intestazione: string;
    intestazioneBordo: string;
    intestazioneTesto: string;
    intestazioneAttiva: string;
    intestazioneAttivaTesto: string;
    rigaBloccata: string;
    divisoreBloccato: string;
    selezione: string;
    bordoSelezione: string;
    ricerca: string;
};

/** Usato solo finche la pagina non manda il tema attivo (stessi toni slate/primary di Echo). */
export const TEMA_PREDEFINITO: TemaFoglio = {
    font: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    sfondo: "#ffffff",
    testo: "#1e293b",
    griglia: "#e2e8f0",
    intestazione: "#f8fafc",
    intestazioneBordo: "#e2e8f0",
    intestazioneTesto: "#64748b",
    intestazioneAttiva: "rgb(3 4 94 / 0.1)",
    intestazioneAttivaTesto: "rgb(3 4 94 / 1)",
    rigaBloccata: "#f8fafc",
    divisoreBloccato: "#cbd5e1",
    selezione: "rgb(3 4 94 / 0.08)",
    bordoSelezione: "rgb(3 4 94 / 1)",
    ricerca: "rgb(202 138 4 / 0.18)",
};

export const fontCelle = (tema: TemaFoglio) => `12px ${tema.font}`;
const fontGrassetto = (tema: TemaFoglio) => `600 12px ${tema.font}`;
const fontIntestazioni = (tema: TemaFoglio) => `500 11px ${tema.font}`;
const PADDING_X = 6;
const MAX_CARATTERI = 400;

/** y nel viewport della riga visiva v (la riga 0 e bloccata sotto le lettere). */
const yRiga = (v: number, scrollTop: number) =>
    v === 0 ? ALTEZZA_LETTERE : ALTEZZA_LETTERE + ALTEZZA_RIGA + (v - 1) * ALTEZZA_RIGA - scrollTop;

const tronca = (ctx: ContestoDisegno, testo: string, max: number): string => {
    const s = testo.length > MAX_CARATTERI ? testo.slice(0, MAX_CARATTERI) : testo;
    if (ctx.measureText(s).width <= max) return s;
    const ell = "…";
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(s.slice(0, mid) + ell).width <= max) lo = mid;
        else hi = mid - 1;
    }
    return s.slice(0, lo) + ell;
};

const testoInCella = (ctx: ContestoDisegno, valore: ValoreCella, x: number, y: number, w: number) => {
    const s = testoCella(valore).replace(/[\r\n\t]+/g, " ");
    if (s === "") return;
    const t = tronca(ctx, s, w - PADDING_X * 2);
    if (leggiNumero(valore) !== null) {
        ctx.textAlign = "right";
        ctx.fillText(t, x + w - PADDING_X, y + ALTEZZA_RIGA / 2);
        ctx.textAlign = "left";
    } else {
        ctx.fillText(t, x + PADDING_X, y + ALTEZZA_RIGA / 2);
    }
};

const ritaglia = (ctx: ContestoDisegno, x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
};

export const disegnaFoglio = (ctx: ContestoDisegno, s: StatoDisegno) => {
    const { larghezza: W, altezza: H, scrollTop, scrollLeft, righe, visibili, larghezze, offset, gutter: G } = s;
    const nColonne = larghezze.length;
    const nVisibili = visibili.length;
    const sel = s.intervallo;
    const tema = s.tema;
    const yCorpo = ALTEZZA_LETTERE + ALTEZZA_RIGA;

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.fillStyle = tema.sfondo;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.lineWidth = 1;

    // Colonne nel viewport
    const primaColonna = Math.max(0, colonnaInX(offset, scrollLeft));
    let ultimaColonna = primaColonna;
    while (ultimaColonna < nColonne - 1 && G + offset[ultimaColonna + 1] - scrollLeft < W) ultimaColonna++;
    const xColonna = (c: number) => G + offset[c] - scrollLeft;

    // Righe del corpo nel viewport
    const primaRiga = clamp(1 + Math.floor(scrollTop / ALTEZZA_RIGA), 1, Math.max(1, nVisibili));
    const ultimaRiga = clamp(1 + Math.ceil((scrollTop + H - yCorpo) / ALTEZZA_RIGA), 0, nVisibili - 1);

    const inSelezione = (v: number, c: number) =>
        !!sel && v >= sel.v0 && v <= sel.v1 && c >= sel.c0 && c <= sel.c1;
    const eAttiva = (v: number, c: number) =>
        !!s.selezione && s.selezione.ancora.v === v && s.selezione.ancora.c === c;

    const disegnaRiga = (v: number, bloccata: boolean) => {
        const y = yRiga(v, scrollTop);
        const riga = righe[visibili[v]] ?? [];
        if (bloccata) {
            ctx.fillStyle = tema.rigaBloccata;
            ctx.fillRect(G, y, W - G, ALTEZZA_RIGA);
        }
        ctx.font = bloccata ? fontGrassetto(tema) : fontCelle(tema);
        for (let c = primaColonna; c <= ultimaColonna && c < nColonne; c++) {
            const x = xColonna(c);
            const w = larghezze[c];
            const valore = riga[c];
            if (s.termine && cellaCorrisponde(valore, s.termine)) {
                ctx.fillStyle = tema.ricerca;
                ctx.fillRect(x, y, w, ALTEZZA_RIGA);
            }
            if (inSelezione(v, c) && !eAttiva(v, c)) {
                ctx.fillStyle = tema.selezione;
                ctx.fillRect(x, y, w, ALTEZZA_RIGA);
            }
            ctx.strokeStyle = tema.griglia;
            ctx.strokeRect(x + 0.5, y + 0.5, w, ALTEZZA_RIGA);
            ctx.fillStyle = tema.testo;
            testoInCella(ctx, valore, x, y, w);
        }
    };

    // Corpo scorrevole
    ctx.save();
    ritaglia(ctx, G, yCorpo, W - G, H - yCorpo);
    for (let v = primaRiga; v <= ultimaRiga; v++) disegnaRiga(v, false);
    ctx.restore();

    // Prima riga bloccata
    if (nVisibili > 0) {
        ctx.save();
        ritaglia(ctx, G, ALTEZZA_LETTERE, W - G, ALTEZZA_RIGA);
        disegnaRiga(0, true);
        ctx.restore();
        ctx.strokeStyle = tema.divisoreBloccato;
        ctx.beginPath();
        ctx.moveTo(0, yCorpo - 0.5);
        ctx.lineTo(W, yCorpo - 0.5);
        ctx.stroke();
    }

    // Bordo della selezione e cella attiva
    if (sel && s.selezione && nVisibili > 0 && nColonne > 0) {
        ctx.save();
        ritaglia(ctx, G, ALTEZZA_LETTERE, W - G, H - ALTEZZA_LETTERE);
        const x0 = xColonna(sel.c0);
        const x1 = xColonna(sel.c1) + larghezze[sel.c1];
        const y0 = yRiga(sel.v0, scrollTop);
        const y1 = yRiga(sel.v1, scrollTop) + ALTEZZA_RIGA;
        ctx.strokeStyle = tema.bordoSelezione;
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
        // Quadratino di riempimento in basso a destra, come in Excel
        ctx.fillStyle = tema.bordoSelezione;
        ctx.fillRect(x1 - 3, y1 - 3, 6, 6);
        ctx.restore();
        ctx.lineWidth = 1;
    }

    // Lettere delle colonne
    ctx.fillStyle = tema.intestazione;
    ctx.fillRect(G, 0, W - G, ALTEZZA_LETTERE);
    ctx.save();
    ritaglia(ctx, G, 0, W - G, ALTEZZA_LETTERE);
    ctx.font = fontIntestazioni(tema);
    ctx.textAlign = "center";
    for (let c = primaColonna; c <= ultimaColonna && c < nColonne; c++) {
        const x = xColonna(c);
        const w = larghezze[c];
        const attiva = !!sel && c >= sel.c0 && c <= sel.c1;
        if (attiva) {
            ctx.fillStyle = tema.intestazioneAttiva;
            ctx.fillRect(x, 0, w, ALTEZZA_LETTERE);
        }
        ctx.strokeStyle = tema.intestazioneBordo;
        ctx.strokeRect(x + 0.5, 0.5, w, ALTEZZA_LETTERE - 1);
        ctx.fillStyle = attiva ? tema.intestazioneAttivaTesto : tema.intestazioneTesto;
        ctx.fillText(letteraColonna(c), x + w / 2, ALTEZZA_LETTERE / 2);
    }
    ctx.restore();

    // Numeri di riga (originali del file)
    ctx.fillStyle = tema.intestazione;
    ctx.fillRect(0, ALTEZZA_LETTERE, G, H - ALTEZZA_LETTERE);
    ctx.font = fontIntestazioni(tema);
    ctx.textAlign = "right";
    const disegnaNumero = (v: number) => {
        const y = yRiga(v, scrollTop);
        const attiva = !!sel && v >= sel.v0 && v <= sel.v1;
        if (attiva) {
            ctx.fillStyle = tema.intestazioneAttiva;
            ctx.fillRect(0, y, G, ALTEZZA_RIGA);
        }
        ctx.strokeStyle = tema.intestazioneBordo;
        ctx.strokeRect(0.5, y + 0.5, G - 1, ALTEZZA_RIGA);
        ctx.fillStyle = attiva ? tema.intestazioneAttivaTesto : tema.intestazioneTesto;
        ctx.fillText(String(visibili[v] + 1), G - PADDING_X, y + ALTEZZA_RIGA / 2);
    };
    ctx.save();
    ritaglia(ctx, 0, yCorpo, G, H - yCorpo);
    for (let v = primaRiga; v <= ultimaRiga; v++) disegnaNumero(v);
    ctx.restore();
    if (nVisibili > 0) disegnaNumero(0);

    // Angolo in alto a sinistra con il triangolo di "seleziona tutto"
    ctx.fillStyle = tema.intestazione;
    ctx.fillRect(0, 0, G, ALTEZZA_LETTERE);
    ctx.strokeStyle = tema.intestazioneBordo;
    ctx.strokeRect(0.5, 0.5, G - 1, ALTEZZA_LETTERE - 1);
    ctx.fillStyle = tema.divisoreBloccato;
    ctx.beginPath();
    ctx.moveTo(G - 4, ALTEZZA_LETTERE - 4);
    ctx.lineTo(G - 4, ALTEZZA_LETTERE - 14);
    ctx.lineTo(G - 14, ALTEZZA_LETTERE - 4);
    ctx.closePath();
    ctx.fill();
};
