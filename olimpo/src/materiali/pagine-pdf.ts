import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

/**
 * Come Olimpo disegna e conserva l'immagine di una pagina di un PDF.
 *
 * Ci sono due rese:
 * - la base, a 150 dpi, per anteprime e miniature;
 * - quella di lettura, a 300 dpi, per leggere le scritte dei prodotti.
 * Ognuna ha il suo file in cache, così un consumatore che chiede la base non cambia peso
 * né aspetto quando arriva l'altra.
 */
export interface ResaPagina {
    /** Densità dell'immagine finale, in dpi. */
    readonly dpi: number;
    /** Ghostscript disegna a dpi × sovracampionamento, poi sharp riduce l'immagine alla densità finale. */
    readonly sovracampionamento: number;
    /** Opzioni WebP di sharp. */
    readonly webp: sharp.WebpOptions;
    /** Parte del nome del file in cache dopo `{id}_page{N}`. */
    readonly suffisso: string;
}

/**
 * La resa di sempre. Non va cambiata. Con questo disegno della prima pagina si calcolano
 * l'MD5 dei PDF di una sola pagina, per riconoscere i doppioni, e il dHash con cui
 * groupPDFsByEquality confronta i PDF. Un disegno diverso non riconoscerebbe più i
 * materiali già archiviati.
 */
export const RESA_BASE: ResaPagina = Object.freeze({
    dpi: 150,
    sovracampionamento: 1,
    webp: Object.freeze({ quality: 80 }),
    suffisso: '',
});

/**
 * La resa per leggere le scritte delle confezioni. Le foto dei volantini sono a circa
 * 300 ppi: sotto i 300 dpi le scritte piccole si perdono.
 *
 * La pagina si disegna a 600 dpi e si riduce a 300. Così testo e grafica hanno i bordi
 * sfumati e le foto sono ridotte con un buon filtro. L'antialias di Ghostscript
 * (-dGraphicsAlphaBits) su certi PDF rallenta il disegno di 15 volte (26 s per pagina),
 * mentre questa strada resta sui 4-8 s. smartSubsample tiene più nitidi i bordi delle
 * scritte colorate (prezzi rossi, testo bianco su fondo colorato).
 */
export const RESA_LETTURA: ResaPagina = Object.freeze({
    dpi: 300,
    sovracampionamento: 2,
    webp: Object.freeze({ quality: 75, smartSubsample: true }),
    suffisso: '_300dpi',
});

/** La resa chiesta col parametro `dpi`: senza valore la base, null se il valore non è ammesso. */
export function resaRichiesta(dpi: string | undefined | null): ResaPagina | null {
    const valore = (dpi ?? '').trim();
    if (valore === '' || valore === String(RESA_BASE.dpi)) return RESA_BASE;
    if (valore === String(RESA_LETTURA.dpi)) return RESA_LETTURA;
    return null;
}

/** Argomenti di Ghostscript per disegnare una pagina in PNG su stdout. */
export function argomentiGhostscriptPagina(pdfPath: string, page: number, resa: ResaPagina, safeFlag: string): string[] {
    return [
        '-q',
        safeFlag,
        '-dBATCH',
        '-dNOPAUSE',
        '-sDEVICE=png16m',
        `-dFirstPage=${page}`,
        `-dLastPage=${page}`,
        `-r${resa.dpi * resa.sovracampionamento}`,
        '-sOutputFile=-',
        pdfPath,
    ];
}

/** File in cache dell'immagine di una pagina. */
export function percorsoCachePagina(thumbnailsDir: string, materialeId: string, page: number, resa: ResaPagina): string {
    return path.join(thumbnailsDir, `${materialeId}_page${page}${resa.suffisso}.webp`);
}

/** Codifica in WebP il PNG di una pagina disegnato da Ghostscript, riducendolo alla densità finale. */
export async function codificaPagina(png: Buffer, resa: ResaPagina): Promise<Buffer> {
    let immagine = sharp(png, { limitInputPixels: false });
    if (resa.sovracampionamento > 1) {
        const { width, height } = await immagine.metadata();
        immagine = immagine.resize(
            Math.max(1, Math.round(width / resa.sovracampionamento)),
            Math.max(1, Math.round(height / resa.sovracampionamento)),
            { kernel: 'lanczos3', fit: 'fill' },
        );
    }
    return immagine.webp({ ...resa.webp }).toBuffer();
}

/**
 * Scrive il file con un nome temporaneo e poi lo rinomina. Così chi legge la cache (anche
 * l'altro worker) non trova mai un file scritto a metà.
 */
export async function scriviFileAtomico(percorso: string, dati: Buffer): Promise<void> {
    const temporaneo = `${percorso}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await fs.promises.writeFile(temporaneo, dati);
        await fs.promises.rename(temporaneo, percorso);
    } catch (errore) {
        await fs.promises.rm(temporaneo, { force: true });
        throw errore;
    }
}

/** Dopo quanto un lock di pagina si considera lasciato da un processo morto. */
export const SCADENZA_LOCK_MS = 10 * 60 * 1000;

/**
 * Prende il lock di una pagina, un file `.lock` accanto al file in cache creato in modo
 * esclusivo. Serve a non far disegnare la stessa pagina a due processi. Restituisce la
 * funzione che lo rilascia, oppure null se un altro lo tiene. Un lock più vecchio di
 * `scadenzaMs` viene da un processo morto: si toglie e si riprende.
 */
export async function prendiLock(percorso: string, scadenzaMs = SCADENZA_LOCK_MS): Promise<(() => Promise<void>) | null> {
    const lock = `${percorso}.lock`;
    for (let tentativo = 0; tentativo < 2; tentativo++) {
        try {
            const file = await fs.promises.open(lock, 'wx');
            try {
                await file.writeFile(`${process.pid} ${new Date().toISOString()}\n`);
            } finally {
                await file.close();
            }
            return () => fs.promises.rm(lock, { force: true });
        } catch (errore) {
            if ((errore as NodeJS.ErrnoException).code !== 'EEXIST') throw errore;
            const stato = await fs.promises.stat(lock).catch(() => null);
            if (stato && Date.now() - stato.mtimeMs < scadenzaMs) return null;
            await fs.promises.rm(lock, { force: true });
        }
    }
    return null;
}

const lavoriInCorso = new Map<string, Promise<unknown>>();

/** Esegue il lavoro una volta sola per chiave: chi arriva mentre è in corso ne aspetta l'esito. */
export function unaVoltaPerChiave<T>(chiave: string, lavoro: () => Promise<T>): Promise<T> {
    const inCorso = lavoriInCorso.get(chiave);
    if (inCorso) return inCorso as Promise<T>;
    const promessa = lavoro().finally(() => lavoriInCorso.delete(chiave));
    lavoriInCorso.set(chiave, promessa);
    return promessa;
}

interface VoceCoda {
    chiave: string;
    lavoro: () => Promise<unknown>;
    finito: Promise<void>;
    concludi: () => void;
}

/**
 * Coda di lavori in background, eseguiti uno alla volta. Una chiave già in coda (o in
 * corso) non si aggiunge di nuovo: si riceve la promessa del lavoro già previsto. Un lavoro
 * che fallisce non ferma la coda.
 */
export class CodaLavori {
    private readonly coda: VoceCoda[] = [];
    private readonly previste = new Map<string, VoceCoda>();
    private attivo = false;
    private inAttesaDiFine: Array<() => void> = [];

    constructor(private readonly registraErrore: (chiave: string, errore: unknown) => void = () => undefined) {}

    /**
     * Mette in coda il lavoro e restituisce una promessa che si risolve quando è finito,
     * anche se è fallito. Con `inTesta` passa davanti a quelli in attesa: serve a chi sta
     * aspettando una pagina mentre gira la rigenerazione dell'archivio.
     */
    aggiungi(chiave: string, lavoro: () => Promise<unknown>, opzioni: { inTesta?: boolean } = {}): Promise<void> {
        const prevista = this.previste.get(chiave);
        if (prevista) {
            if (opzioni.inTesta) {
                const posizione = this.coda.indexOf(prevista);
                if (posizione > 0) {
                    this.coda.splice(posizione, 1);
                    this.coda.unshift(prevista);
                }
            }
            return prevista.finito;
        }
        let concludi!: () => void;
        const finito = new Promise<void>(risolvi => (concludi = risolvi));
        const voce: VoceCoda = { chiave, lavoro, finito, concludi };
        this.previste.set(chiave, voce);
        if (opzioni.inTesta) this.coda.unshift(voce);
        else this.coda.push(voce);
        void this.avvia();
        return finito;
    }

    /** Se la chiave è in coda o in corso. */
    prevista(chiave: string): boolean {
        return this.previste.has(chiave);
    }

    /** Si risolve quando la coda è vuota e nessun lavoro è in corso. */
    finita(): Promise<void> {
        if (!this.attivo && this.coda.length === 0) return Promise.resolve();
        return new Promise(risolvi => this.inAttesaDiFine.push(risolvi));
    }

    private async avvia(): Promise<void> {
        if (this.attivo) return;
        this.attivo = true;
        try {
            while (this.coda.length > 0) {
                const voce = this.coda.shift();
                try {
                    await voce.lavoro();
                } catch (errore) {
                    this.registraErrore(voce.chiave, errore);
                } finally {
                    this.previste.delete(voce.chiave);
                    voce.concludi();
                }
            }
        } finally {
            this.attivo = false;
            const attese = this.inAttesaDiFine;
            this.inAttesaDiFine = [];
            attese.forEach(risolvi => risolvi());
        }
    }
}
