/* =======================
   LOGICA DEL FOGLIO
   Funzioni pure condivise tra pagina e worker: niente DOM, niente canvas.
   Le righe "visive" sono quelle mostrate in griglia dopo la ricerca: la riga visiva 0
   e sempre la prima riga del file (bloccata come in Excel), le altre puntano alla riga
   originale tramite l'elenco restituito da filtraRighe.
   ======================= */

export type ValoreCella = string | number | null | undefined;

export type FoglioGrezzo = {
    name: string;
    rows: ValoreCella[][];
};

export type Cella = { v: number; c: number };

/** Selezione come in Excel: l'ancora e la cella attiva, il cursore l'altro estremo. */
export type Selezione = { ancora: Cella; cursore: Cella };

export type Intervallo = { v0: number; c0: number; v1: number; c1: number };

export type StatisticheSelezione = {
    celle: number;
    conteggio: number;
    numerici: number;
    somma: number;
    media: number | null;
};

/* =======================
   GEOMETRIA
   ======================= */
export const ALTEZZA_RIGA = 24;
export const ALTEZZA_LETTERE = 24;
export const LARGHEZZA_MIN_COLONNA = 40;
export const LARGHEZZA_MAX_COLONNA = 600;
export const LARGHEZZA_PREDEFINITA = 96;
/** Tolleranza in pixel attorno al bordo destro di una lettera per afferrarlo e ridimensionare. */
export const TOLLERANZA_BORDO = 4;

export const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

/** 0 → A, 25 → Z, 26 → AA, 701 → ZZ, 702 → AAA. */
export const letteraColonna = (indice: number): string => {
    let n = indice + 1;
    let lettere = "";
    while (n > 0) {
        const resto = (n - 1) % 26;
        lettere = String.fromCharCode(65 + resto) + lettere;
        n = Math.floor((n - 1) / 26);
    }
    return lettere;
};

/** Indirizzo Excel di una cella del file, con la riga originale (0-based) del file. */
export const indirizzoCella = (rigaOriginale: number, colonna: number): string =>
    `${letteraColonna(colonna)}${rigaOriginale + 1}`;

export const larghezzaGutter = (numeroRigheFile: number): number =>
    Math.max(40, String(Math.max(1, numeroRigheFile)).length * 8 + 20);

export const contaColonne = (righe: ValoreCella[][]): number => {
    let max = 0;
    for (const r of righe) if (r && r.length > max) max = r.length;
    return max;
};

/** Posizione x (nel contenuto, senza gutter) dell'inizio di ogni colonna; l'ultimo elemento e la larghezza totale. */
export const offsetColonne = (larghezze: number[]): number[] => {
    const offset = new Array<number>(larghezze.length + 1);
    offset[0] = 0;
    for (let i = 0; i < larghezze.length; i++) offset[i + 1] = offset[i] + larghezze[i];
    return offset;
};

/** Colonna che contiene la x data (nel contenuto); -1 se oltre l'ultima colonna. */
export const colonnaInX = (offset: number[], x: number): number => {
    const n = offset.length - 1;
    if (n <= 0 || x < 0 || x >= offset[n]) return -1;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (offset[mid] <= x) lo = mid;
        else hi = mid - 1;
    }
    return lo;
};

/* =======================
   VALORI
   ======================= */
export const testoCella = (valore: ValoreCella): string => {
    if (valore === null || valore === undefined) return "";
    return String(valore);
};

/**
 * Interpreta un valore come numero, accettando sia "1.234,56" sia "1,234.56",
 * simboli di valuta e percentuale. Restituisce null per testo non numerico.
 */
export const leggiNumero = (valore: ValoreCella): number | null => {
    if (typeof valore === "number") return isFinite(valore) ? valore : null;
    if (valore === null || valore === undefined) return null;
    let s = String(valore).trim().replace(/[\s€$£%]/g, "");
    if (s === "" || !/^[-+]?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

    const ultimaVirgola = s.lastIndexOf(",");
    const ultimoPunto = s.lastIndexOf(".");
    if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
        // Il separatore che compare per ultimo e quello decimale.
        const decimale = ultimaVirgola > ultimoPunto ? "," : ".";
        const migliaia = decimale === "," ? "." : ",";
        s = s.split(migliaia).join("").replace(decimale, ".");
    } else if (ultimaVirgola >= 0) {
        // Solo virgole: una sola virgola e decimale, piu virgole sono migliaia.
        s = s.split(",").length > 2 ? s.split(",").join("") : s.replace(",", ".");
    } else if (s.split(".").length > 2) {
        s = s.split(".").join("");
    }

    const n = Number(s);
    return isFinite(n) ? n : null;
};

/* =======================
   RICERCA
   ======================= */
/**
 * Righe originali da mostrare per il termine cercato. La prima riga del file resta sempre
 * (e l'intestazione bloccata), le altre compaiono solo se una cella contiene il termine.
 */
export const filtraRighe = (righe: ValoreCella[][], termine: string): number[] => {
    const risultato: number[] = [];
    if (righe.length === 0) return risultato;
    const q = termine.trim().toLowerCase();
    risultato.push(0);
    for (let r = 1; r < righe.length; r++) {
        if (!q) {
            risultato.push(r);
            continue;
        }
        const riga = righe[r];
        if (!riga) continue;
        for (let c = 0; c < riga.length; c++) {
            const v = riga[c];
            if (v !== null && v !== undefined && String(v).toLowerCase().indexOf(q) >= 0) {
                risultato.push(r);
                break;
            }
        }
    }
    return risultato;
};

export const cellaCorrisponde = (valore: ValoreCella, termine: string): boolean => {
    const q = termine.trim().toLowerCase();
    if (!q || valore === null || valore === undefined) return false;
    return String(valore).toLowerCase().indexOf(q) >= 0;
};

/* =======================
   SELEZIONE
   ======================= */
export const normalizzaSelezione = (sel: Selezione): Intervallo => ({
    v0: Math.min(sel.ancora.v, sel.cursore.v),
    c0: Math.min(sel.ancora.c, sel.cursore.c),
    v1: Math.max(sel.ancora.v, sel.cursore.v),
    c1: Math.max(sel.ancora.c, sel.cursore.c),
});

export const selezioneSingola = (cella: Cella): Selezione => ({ ancora: cella, cursore: cella });

export const limitaCella = (cella: Cella, righeVisibili: number, colonne: number): Cella => ({
    v: clamp(cella.v, 0, Math.max(0, righeVisibili - 1)),
    c: clamp(cella.c, 0, Math.max(0, colonne - 1)),
});

/** Spostamento da tastiera di una cella; con `aBordo` (Ctrl+freccia) salta al bordo del foglio. */
export const spostaCella = (
    cella: Cella,
    dv: number,
    dc: number,
    righeVisibili: number,
    colonne: number,
    aBordo = false
): Cella => {
    if (aBordo) {
        return limitaCella(
            {
                v: dv < 0 ? 0 : dv > 0 ? righeVisibili - 1 : cella.v,
                c: dc < 0 ? 0 : dc > 0 ? colonne - 1 : cella.c,
            },
            righeVisibili,
            colonne
        );
    }
    return limitaCella({ v: cella.v + dv, c: cella.c + dc }, righeVisibili, colonne);
};

/** Una cella per la copia in formato Excel: tra virgolette se contiene tabulazioni, a capo o virgolette. */
const cellaPerCopia = (valore: ValoreCella): string => {
    const s = testoCella(valore);
    if (/[\t\r\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
};

/** Testo della selezione separato da tabulazione e a capo, incollabile in Excel. */
export const testoSelezione = (
    righe: ValoreCella[][],
    visibili: number[],
    intervallo: Intervallo
): string => {
    const linee: string[] = [];
    for (let v = intervallo.v0; v <= intervallo.v1; v++) {
        const riga = righe[visibili[v]] ?? [];
        const celle: string[] = [];
        for (let c = intervallo.c0; c <= intervallo.c1; c++) celle.push(cellaPerCopia(riga[c]));
        linee.push(celle.join("\t"));
    }
    return linee.join("\r\n");
};

/** Conteggio, somma e media della selezione come nella barra di stato di Excel. */
export const statisticheSelezione = (
    righe: ValoreCella[][],
    visibili: number[],
    intervallo: Intervallo
): StatisticheSelezione => {
    let conteggio = 0;
    let numerici = 0;
    let somma = 0;
    for (let v = intervallo.v0; v <= intervallo.v1; v++) {
        const riga = righe[visibili[v]] ?? [];
        for (let c = intervallo.c0; c <= intervallo.c1; c++) {
            const valore = riga[c];
            if (testoCella(valore).trim() === "") continue;
            conteggio++;
            const n = leggiNumero(valore);
            if (n !== null) {
                numerici++;
                somma += n;
            }
        }
    }
    return {
        celle: (intervallo.v1 - intervallo.v0 + 1) * (intervallo.c1 - intervallo.c0 + 1),
        conteggio,
        numerici,
        somma,
        media: numerici > 0 ? somma / numerici : null,
    };
};

/* =======================
   LARGHEZZE
   ======================= */
/**
 * Larghezza adatta al contenuto di una colonna; `misura` restituisce la larghezza del testo in pixel.
 * `limiteRighe` evita di misurare file enormi all'apertura: il doppio click misura tutto.
 */
export const larghezzaAdatta = (
    righe: ValoreCella[][],
    colonna: number,
    misura: (testo: string) => number,
    limiteRighe = Infinity
): number => {
    const intestazione = letteraColonna(colonna);
    let max = misura(intestazione);
    const fine = Math.min(righe.length, limiteRighe);
    for (let r = 0; r < fine; r++) {
        const s = testoCella(righe[r]?.[colonna]);
        if (s === "") continue;
        const w = misura(s);
        if (w > max) max = w;
    }
    return clamp(Math.ceil(max + 16), LARGHEZZA_MIN_COLONNA, LARGHEZZA_MAX_COLONNA);
};
