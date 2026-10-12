import { ContestoDisegno, disegnaFoglio, fontCelle, TEMA_PREDEFINITO, TemaFoglio } from "./disegnaFoglio";
import {
    contaColonne,
    FoglioGrezzo,
    filtraRighe,
    indirizzoCella,
    larghezzaAdatta,
    larghezzaGutter,
    LARGHEZZA_MAX_COLONNA,
    LARGHEZZA_MIN_COLONNA,
    LARGHEZZA_PREDEFINITA,
    clamp,
    limitaCella,
    normalizzaSelezione,
    offsetColonne,
    Selezione,
    StatisticheSelezione,
    statisticheSelezione,
    testoCella,
    testoSelezione,
} from "./foglio";

/* =======================
   MOTORE DEL FOGLIO
   Vive nel Web Worker: scarica e legge il tracciato, filtra, calcola selezione e copia
   e disegna sul canvas trasferito dalla pagina. La pagina gli manda solo input e vista.
   ======================= */

export type MessaggioVersoMotore =
    | { tipo: "canvas"; canvas: OffscreenCanvas }
    | { tipo: "tema"; tema: TemaFoglio }
    | { tipo: "carica"; url: string }
    | { tipo: "foglio"; indice: number }
    | { tipo: "cerca"; termine: string }
    | { tipo: "vista"; scrollTop: number; scrollLeft: number; larghezza: number; altezza: number; dpr: number }
    | { tipo: "selezione"; selezione: Selezione }
    | { tipo: "larghezza"; colonna: number; larghezza: number }
    | { tipo: "adatta"; colonna: number }
    | { tipo: "copia"; richiesta: number };

export type InfoFoglio = { nome: string; righe: number; colonne: number };

export type LayoutFoglio = {
    foglio: number;
    righeVisibili: number;
    righeFile: number;
    larghezze: number[];
    gutter: number;
    termine: string;
};

export type MessaggioDalMotore =
    | { tipo: "caricato"; fogli: InfoFoglio[] }
    | { tipo: "errore"; messaggio: string; status?: number }
    | { tipo: "layout"; layout: LayoutFoglio }
    | { tipo: "infoSelezione"; indirizzo: string; valore: string; statistiche: StatisticheSelezione }
    | { tipo: "testoCopia"; richiesta: number; testo: string; celle: number };

export type OpzioniMotore = {
    invia: (messaggio: MessaggioDalMotore) => void;
    fetch?: typeof fetch;
    /** Coalescenza dei ridisegni: nel worker requestAnimationFrame, nei test sincrona. */
    pianifica?: (cb: () => void) => void;
    /** Misura del testo quando non c'e un canvas (test). */
    misura?: (testo: string) => number;
};

/** Righe misurate all'apertura per la larghezza iniziale delle colonne. */
const RIGHE_MISURATE_INIZIALI = 300;

export class MotoreFoglio {
    private fogli: FoglioGrezzo[] = [];
    private indiceFoglio = 0;
    private visibili: number[] = [];
    private larghezze: number[] = [];
    private larghezzePerFoglio = new Map<number, number[]>();
    private offset: number[] = [0];
    private gutter = 40;
    private termine = "";
    private selezione: Selezione | null = null;
    private tema: TemaFoglio = TEMA_PREDEFINITO;
    private vista = { scrollTop: 0, scrollLeft: 0, larghezza: 0, altezza: 0, dpr: 1 };
    private canvas: OffscreenCanvas | null = null;
    private ctx: ContestoDisegno | null = null;
    private ridisegnoPianificato = false;
    private caricamento = 0;

    constructor(private readonly opzioni: OpzioniMotore) { }

    gestisci(m: MessaggioVersoMotore) {
        switch (m.tipo) {
            case "canvas":
                this.canvas = m.canvas;
                this.ctx = m.canvas.getContext("2d") as ContestoDisegno | null;
                this.ridisegna();
                break;
            case "tema":
                this.tema = m.tema;
                this.ridisegna();
                break;
            case "carica":
                void this.carica(m.url);
                break;
            case "foglio":
                this.attivaFoglio(m.indice);
                break;
            case "cerca":
                this.termine = m.termine;
                this.aggiornaVisibili();
                break;
            case "vista":
                this.vista = { scrollTop: m.scrollTop, scrollLeft: m.scrollLeft, larghezza: m.larghezza, altezza: m.altezza, dpr: m.dpr };
                this.ridisegna();
                break;
            case "selezione":
                this.selezione = {
                    ancora: limitaCella(m.selezione.ancora, this.visibili.length, this.larghezze.length),
                    cursore: limitaCella(m.selezione.cursore, this.visibili.length, this.larghezze.length),
                };
                this.inviaInfoSelezione();
                this.ridisegna();
                break;
            case "larghezza":
                if (m.colonna >= 0 && m.colonna < this.larghezze.length) {
                    this.larghezze[m.colonna] = clamp(Math.round(m.larghezza), LARGHEZZA_MIN_COLONNA, LARGHEZZA_MAX_COLONNA);
                    this.aggiornaLarghezze();
                }
                break;
            case "adatta":
                if (m.colonna >= 0 && m.colonna < this.larghezze.length) {
                    this.larghezze[m.colonna] = larghezzaAdatta(this.righe, m.colonna, t => this.misura(t));
                    this.aggiornaLarghezze();
                }
                break;
            case "copia": {
                if (!this.selezione || this.visibili.length === 0) {
                    this.opzioni.invia({ tipo: "testoCopia", richiesta: m.richiesta, testo: "", celle: 0 });
                    break;
                }
                const intervallo = normalizzaSelezione(this.selezione);
                this.opzioni.invia({
                    tipo: "testoCopia",
                    richiesta: m.richiesta,
                    testo: testoSelezione(this.righe, this.visibili, intervallo),
                    celle: (intervallo.v1 - intervallo.v0 + 1) * (intervallo.c1 - intervallo.c0 + 1),
                });
                break;
            }
        }
    }

    private get righe() {
        return this.fogli[this.indiceFoglio]?.rows ?? [];
    }

    private misura(testo: string): number {
        if (this.ctx) {
            this.ctx.font = fontCelle(this.tema);
            return this.ctx.measureText(testo.length > 400 ? testo.slice(0, 400) : testo).width;
        }
        return this.opzioni.misura ? this.opzioni.misura(testo) : testo.length * 7;
    }

    private async carica(url: string) {
        const richiesta = ++this.caricamento;
        try {
            const esegui = this.opzioni.fetch ?? fetch;
            const risposta = await esegui(url, {
                method: "GET",
                credentials: "include",
                headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
            });
            const corpo = await risposta.json().catch(() => null);
            if (richiesta !== this.caricamento) return;
            if (!risposta.ok) {
                this.opzioni.invia({
                    tipo: "errore",
                    status: risposta.status,
                    messaggio:
                        (corpo && typeof corpo.message === "string" && corpo.message) ||
                        (risposta.status === 401 ? "Sessione scaduta: accedi di nuovo" : "Errore durante la lettura del tracciato"),
                });
                return;
            }
            const fogli: FoglioGrezzo[] = Array.isArray(corpo?.sheets) ? corpo.sheets : [];
            this.fogli = fogli.map(f => ({ name: String(f?.name ?? ""), rows: Array.isArray(f?.rows) ? f.rows : [] }));
            this.larghezzePerFoglio.clear();
            this.larghezze = [];
            this.indiceFoglio = 0;
            this.opzioni.invia({
                tipo: "caricato",
                fogli: this.fogli.map(f => ({ nome: f.name, righe: f.rows.length, colonne: contaColonne(f.rows) })),
            });
            this.attivaFoglio(0);
        } catch (e) {
            if (richiesta !== this.caricamento) return;
            this.opzioni.invia({
                tipo: "errore",
                messaggio: e instanceof Error && e.message ? e.message : "Errore durante la lettura del tracciato",
            });
        }
    }

    private attivaFoglio(indice: number) {
        if (indice < 0 || indice >= this.fogli.length) return;
        this.larghezzePerFoglio.set(this.indiceFoglio, this.larghezze);
        this.indiceFoglio = indice;
        const righe = this.righe;
        const salvate = this.larghezzePerFoglio.get(indice);
        if (salvate && salvate.length) {
            this.larghezze = salvate;
        } else {
            const n = contaColonne(righe);
            this.larghezze = new Array<number>(n);
            for (let c = 0; c < n; c++) {
                this.larghezze[c] = righe.length
                    ? larghezzaAdatta(righe, c, t => this.misura(t), RIGHE_MISURATE_INIZIALI)
                    : LARGHEZZA_PREDEFINITA;
            }
        }
        this.offset = offsetColonne(this.larghezze);
        this.gutter = larghezzaGutter(righe.length);
        this.selezione = righe.length && this.larghezze.length ? { ancora: { v: 0, c: 0 }, cursore: { v: 0, c: 0 } } : null;
        this.aggiornaVisibili();
    }

    private aggiornaVisibili() {
        this.visibili = filtraRighe(this.righe, this.termine);
        if (this.selezione) {
            this.selezione = {
                ancora: limitaCella(this.selezione.ancora, this.visibili.length, this.larghezze.length),
                cursore: limitaCella(this.selezione.cursore, this.visibili.length, this.larghezze.length),
            };
        }
        this.inviaLayout();
        this.inviaInfoSelezione();
        this.ridisegna();
    }

    private aggiornaLarghezze() {
        this.offset = offsetColonne(this.larghezze);
        this.inviaLayout();
        this.ridisegna();
    }

    private inviaLayout() {
        this.opzioni.invia({
            tipo: "layout",
            layout: {
                foglio: this.indiceFoglio,
                righeVisibili: this.visibili.length,
                righeFile: this.righe.length,
                larghezze: this.larghezze.slice(),
                gutter: this.gutter,
                termine: this.termine,
            },
        });
    }

    private inviaInfoSelezione() {
        if (!this.selezione || this.visibili.length === 0 || this.larghezze.length === 0) {
            this.opzioni.invia({
                tipo: "infoSelezione",
                indirizzo: "",
                valore: "",
                statistiche: { celle: 0, conteggio: 0, numerici: 0, somma: 0, media: null },
            });
            return;
        }
        const { ancora } = this.selezione;
        const rigaOriginale = this.visibili[ancora.v];
        this.opzioni.invia({
            tipo: "infoSelezione",
            indirizzo: indirizzoCella(rigaOriginale, ancora.c),
            valore: testoCella(this.righe[rigaOriginale]?.[ancora.c]),
            statistiche: statisticheSelezione(this.righe, this.visibili, normalizzaSelezione(this.selezione)),
        });
    }

    private ridisegna() {
        if (!this.ctx || this.ridisegnoPianificato) return;
        this.ridisegnoPianificato = true;
        const pianifica = this.opzioni.pianifica ?? ((cb: () => void) => setTimeout(cb, 0));
        pianifica(() => {
            this.ridisegnoPianificato = false;
            this.disegna();
        });
    }

    private disegna() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const { larghezza, altezza, dpr } = this.vista;
        if (!ctx || !canvas || larghezza <= 0 || altezza <= 0) return;
        const w = Math.round(larghezza * dpr);
        const h = Math.round(altezza * dpr);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        disegnaFoglio(ctx, {
            ...this.vista,
            righe: this.righe,
            visibili: this.visibili,
            larghezze: this.larghezze,
            offset: this.offset,
            gutter: this.gutter,
            selezione: this.selezione,
            intervallo: this.selezione ? normalizzaSelezione(this.selezione) : null,
            termine: this.termine,
            tema: this.tema,
        });
    }
}
