import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import { TracciatiResponseDTO } from "../../../server/core/dto";
import Button from "../../components/Base/Button";
import CampoRicerca from "../../components/Base/CampoRicerca";
import Lucide from "../../components/Base/Lucide";
import PageError from "../../components/Base/PageError";
import Spinner from "../../components/Base/Spinner";
import withSessionCheck from "../../components/SessionChecker";
import EmptyState from "../../components/EmptyState";
import { formatNumero } from "../../utils/format";
import { getColor } from "../../utils/colors";
import type { TemaFoglio } from "./disegnaFoglio";
import {
    ALTEZZA_LETTERE,
    ALTEZZA_RIGA,
    Cella,
    colonnaInX,
    LARGHEZZA_MIN_COLONNA,
    offsetColonne,
    Selezione,
    selezioneSingola,
    spostaCella,
    StatisticheSelezione,
    TOLLERANZA_BORDO,
} from "./foglio";
import type { InfoFoglio, LayoutFoglio, MessaggioDalMotore, MessaggioVersoMotore } from "./motoreFoglio";

/* =======================
   ANTEPRIMA TRACCIATO A SCHERMO INTERO
   Fuori dal layout Echo. La griglia e un OffscreenCanvas disegnato nel Web Worker
   (foglio.worker.ts), che possiede anche i dati: qui restano solo input, scroll e barre.
   ======================= */

type StatoPagina = "caricamento" | "pronto" | "errore";

type InfoSelezione = { indirizzo: string; valore: string; statistiche: StatisticheSelezione };

type Colpo =
    | { zona: "angolo" }
    | { zona: "lettera"; c: number; bordo: number }
    | { zona: "numero"; v: number }
    | { zona: "cella"; v: number; c: number };

type Trascinamento =
    | { tipo: "selezione"; zona: "cella" | "lettera" | "numero" }
    | { tipo: "larghezza"; colonna: number; xIniziale: number; larghezzaIniziale: number };

const INFO_VUOTA: InfoSelezione = {
    indirizzo: "",
    valore: "",
    statistiche: { celle: 0, conteggio: 0, numerici: 0, somma: 0, media: null },
};

const formatoNumero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });

const getFileSize = (blob: any): string | null => {
    if (!blob?.data?.length) return null;
    return (blob.data.length / (1024 * 1024)).toFixed(2);
};

/**
 * Colori del tema attivo per la griglia. Il worker non vede le variabili CSS:
 * li leggiamo qui con getColor, come i grafici, e li mandiamo al motore.
 */
const leggiTema = (): TemaFoglio => {
    const scuro = document.documentElement.classList.contains("dark");
    return {
        font: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
        sfondo: scuro ? getColor("darkmode.600") : getColor("white"),
        testo: scuro ? getColor("slate.300") : getColor("dark"),
        griglia: scuro ? getColor("darkmode.400") : getColor("slate.200"),
        intestazione: scuro ? getColor("darkmode.700") : getColor("slate.50"),
        intestazioneBordo: scuro ? getColor("darkmode.400") : getColor("slate.200"),
        intestazioneTesto: getColor("slate.500"),
        intestazioneAttiva: getColor("primary", scuro ? 0.3 : 0.1),
        intestazioneAttivaTesto: scuro ? getColor("slate.200") : getColor("primary"),
        rigaBloccata: scuro ? getColor("darkmode.700") : getColor("slate.50"),
        divisoreBloccato: scuro ? getColor("darkmode.300") : getColor("slate.300"),
        selezione: getColor("primary", scuro ? 0.25 : 0.08),
        bordoSelezione: getColor("primary"),
        ricerca: getColor("warning", 0.18),
    };
};

const offscreenSupportato = () =>
    typeof HTMLCanvasElement !== "undefined" && "transferControlToOffscreen" in HTMLCanvasElement.prototype;

const scriviAppunti = async (testo: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(testo);
        return;
    }
    // Fallback per contesti non HTTPS
    const textarea = document.createElement("textarea");
    textarea.value = testo;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
};

const DettaglioAnteprimaTracciato: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams<{ idPromo?: string; idTracciato?: string }>();
    const idTracciato = params.idTracciato;
    const storico = location.pathname.indexOf("/promozioni/storico/") === 0;

    const [tracciato, setTracciato] = useState<TracciatiResponseDTO | null>(
        (location.state as { tracciato?: TracciatiResponseDTO } | null)?.tracciato ?? null
    );
    const [stato, setStato] = useState<StatoPagina>("caricamento");
    const [errore, setErrore] = useState<string | null>(null);
    const [fogli, setFogli] = useState<InfoFoglio[]>([]);
    const [layout, setLayout] = useState<LayoutFoglio | null>(null);
    const [info, setInfo] = useState<InfoSelezione>(INFO_VUOTA);
    const [termine, setTermine] = useState("");
    const [cursore, setCursore] = useState("cell");
    const [copiate, setCopiate] = useState<number | null>(null);

    const hostRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const ricercaRef = useRef<HTMLInputElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const layoutRef = useRef<{ layout: LayoutFoglio; offset: number[] } | null>(null);
    const selezioneRef = useRef<Selezione | null>(null);
    const trascinamentoRef = useRef<Trascinamento | null>(null);
    const richiestaCopiaRef = useRef(0);
    const timeoutCopiaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tornaAllaPromo = useCallback(() => {
        const base = storico ? "/promozioni/storico/dettagli" : "/promozioni/in-corso/dettagli";
        navigate(params.idPromo ? `${base}/${params.idPromo}` : storico ? "/promozioni/storico" : "/promozioni/in-corso");
    }, [navigate, params.idPromo, storico]);

    const invia = useCallback((messaggio: MessaggioVersoMotore, trasferibili?: Transferable[]) => {
        workerRef.current?.postMessage(messaggio, trasferibili ?? []);
    }, []);

    const inviaVista = useCallback(() => {
        const scroll = scrollRef.current;
        const canvas = hostRef.current?.querySelector("canvas");
        if (!scroll || !canvas) return;
        canvas.style.width = `${scroll.clientWidth}px`;
        canvas.style.height = `${scroll.clientHeight}px`;
        invia({
            tipo: "vista",
            scrollTop: scroll.scrollTop,
            scrollLeft: scroll.scrollLeft,
            larghezza: scroll.clientWidth,
            altezza: scroll.clientHeight,
            dpr: window.devicePixelRatio || 1,
        });
    }, [invia]);

    const carica = useCallback(() => {
        if (!idTracciato) return;
        setStato("caricamento");
        setErrore(null);
        const url = new URL(`${ServerCall.getUrl()}/tracciati/${idTracciato}/parse`, window.location.href).toString();
        invia({ tipo: "carica", url });
    }, [idTracciato, invia]);

    /* =======================
       WORKER E CANVAS
       ======================= */
    useEffect(() => {
        const host = hostRef.current;
        if (!host || !idTracciato) return;
        if (!offscreenSupportato()) {
            setStato("errore");
            setErrore("Il browser non supporta l'anteprima del tracciato: aggiornalo all'ultima versione.");
            return;
        }

        // Il canvas e creato qui: transferControlToOffscreen si puo chiamare una volta sola per elemento.
        const canvas = document.createElement("canvas");
        canvas.className = "absolute top-0 left-0 pointer-events-none";
        host.prepend(canvas);
        const offscreen = canvas.transferControlToOffscreen();

        const worker = new Worker(new URL("./foglio.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;

        worker.onmessage = (evento: MessageEvent<MessaggioDalMotore>) => {
            const m = evento.data;
            switch (m.tipo) {
                case "caricato":
                    setFogli(m.fogli);
                    setStato("pronto");
                    break;
                case "errore":
                    setErrore(m.messaggio);
                    setStato("errore");
                    break;
                case "layout": {
                    const precedente = layoutRef.current?.layout;
                    layoutRef.current = { layout: m.layout, offset: offsetColonne(m.layout.larghezze) };
                    setLayout(m.layout);
                    if (!precedente || precedente.foglio !== m.layout.foglio) {
                        selezioneRef.current = m.layout.righeVisibili ? selezioneSingola({ v: 0, c: 0 }) : null;
                        if (scrollRef.current) {
                            scrollRef.current.scrollTop = 0;
                            scrollRef.current.scrollLeft = 0;
                        }
                    }
                    break;
                }
                case "infoSelezione":
                    setInfo({ indirizzo: m.indirizzo, valore: m.valore, statistiche: m.statistiche });
                    break;
                case "testoCopia":
                    if (m.richiesta !== richiestaCopiaRef.current || !m.celle) break;
                    scriviAppunti(m.testo)
                        .then(() => m.celle, () => -1)
                        .then(esito => {
                            setCopiate(esito);
                            if (timeoutCopiaRef.current) clearTimeout(timeoutCopiaRef.current);
                            timeoutCopiaRef.current = setTimeout(() => setCopiate(null), 1500);
                        });
                    break;
            }
        };
        worker.onerror = () => {
            setErrore("Errore interno dell'anteprima del tracciato");
            setStato("errore");
        };

        // Il tema arriva prima dei dati: le larghezze iniziali si misurano con il font giusto
        worker.postMessage({ tipo: "tema", tema: leggiTema() } satisfies MessaggioVersoMotore);
        worker.postMessage({ tipo: "canvas", canvas: offscreen } satisfies MessaggioVersoMotore, [offscreen]);
        inviaVista();
        carica();

        const osservatore = new ResizeObserver(() => inviaVista());
        if (scrollRef.current) osservatore.observe(scrollRef.current);
        const suDpr = () => inviaVista();
        window.addEventListener("resize", suDpr);

        return () => {
            osservatore.disconnect();
            window.removeEventListener("resize", suDpr);
            worker.terminate();
            workerRef.current = null;
            layoutRef.current = null;
            canvas.remove();
            if (timeoutCopiaRef.current) clearTimeout(timeoutCopiaRef.current);
        };
    }, [idTracciato, carica, inviaVista]);

    // Dati descrittivi del tracciato (nome, dimensione): non bloccano la griglia.
    useEffect(() => {
        if (tracciato || !idTracciato) return;
        let annullato = false;
        ServerCall.get<TracciatiResponseDTO>(`/tracciati/${idTracciato}`)
            .then(res => {
                if (!annullato) setTracciato(res);
            })
            .catch(() => {
                // Il nome manca ma la griglia resta utilizzabile; gli errori del contenuto arrivano dal worker.
            });
        return () => {
            annullato = true;
        };
    }, [idTracciato, tracciato]);

    // Ricerca con un piccolo ritardo per non filtrare a ogni tasto
    useEffect(() => {
        if (stato !== "pronto") return;
        const t = setTimeout(() => invia({ tipo: "cerca", termine }), 180);
        return () => clearTimeout(t);
    }, [termine, stato, invia]);

    // Ctrl+F porta alla ricerca del tracciato invece che a quella del browser
    useEffect(() => {
        const suTasto = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
                e.preventDefault();
                ricercaRef.current?.focus();
                ricercaRef.current?.select();
            }
        };
        window.addEventListener("keydown", suTasto);
        return () => window.removeEventListener("keydown", suTasto);
    }, []);

    /* =======================
       SELEZIONE
       ======================= */
    const assicuraVisibile = (cella: Cella) => {
        const scroll = scrollRef.current;
        const l = layoutRef.current;
        if (!scroll || !l) return;
        const areaW = scroll.clientWidth - l.layout.gutter;
        const x0 = l.offset[cella.c] ?? 0;
        const x1 = l.offset[cella.c + 1] ?? x0;
        if (x0 < scroll.scrollLeft) scroll.scrollLeft = x0;
        else if (x1 > scroll.scrollLeft + areaW) scroll.scrollLeft = x1 - areaW;
        if (cella.v === 0) return;
        const areaH = scroll.clientHeight - ALTEZZA_LETTERE - ALTEZZA_RIGA;
        const y0 = (cella.v - 1) * ALTEZZA_RIGA;
        const y1 = y0 + ALTEZZA_RIGA;
        if (y0 < scroll.scrollTop) scroll.scrollTop = y0;
        else if (y1 > scroll.scrollTop + areaH) scroll.scrollTop = y1 - areaH;
    };

    const impostaSelezione = (selezione: Selezione, mostra: Cella = selezione.cursore) => {
        selezioneRef.current = selezione;
        invia({ tipo: "selezione", selezione });
        assicuraVisibile(mostra);
    };

    const copia = () => {
        richiestaCopiaRef.current += 1;
        invia({ tipo: "copia", richiesta: richiestaCopiaRef.current });
    };

    /** Zona del canvas sotto il puntatore; con `limita` le coordinate fuori griglia vanno sul bordo. */
    const colpisci = (clientX: number, clientY: number, limita = false): Colpo | null => {
        const scroll = scrollRef.current;
        const l = layoutRef.current;
        if (!scroll || !l) return null;
        const rect = scroll.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const { gutter, righeVisibili, larghezze } = l.layout;
        const nColonne = larghezze.length;
        const totale = l.offset[nColonne] ?? 0;
        if (!limita && (x > scroll.clientWidth || y > scroll.clientHeight)) return null;

        const xc = x - gutter + scroll.scrollLeft;
        let c = colonnaInX(l.offset, xc);
        if (c < 0) c = limita || (xc >= totale && xc - totale <= TOLLERANZA_BORDO) ? (xc < 0 ? 0 : nColonne - 1) : -1;

        if (y < ALTEZZA_LETTERE && !limita) {
            if (x < gutter) return { zona: "angolo" };
            let bordo = -1;
            if (c >= 0 && Math.abs(l.offset[c + 1] - xc) <= TOLLERANZA_BORDO) bordo = c;
            else if (c > 0 && Math.abs(l.offset[c] - xc) <= TOLLERANZA_BORDO) bordo = c - 1;
            if (c < 0) return null;
            return { zona: "lettera", c, bordo };
        }

        // La riga visiva 0 e bloccata sotto le lettere; le altre scorrono
        let v =
            y < ALTEZZA_LETTERE + ALTEZZA_RIGA
                ? 0
                : 1 + Math.floor((y - ALTEZZA_LETTERE - ALTEZZA_RIGA + scroll.scrollTop) / ALTEZZA_RIGA);
        if (v >= righeVisibili) {
            if (!limita) return null;
            v = righeVisibili - 1;
        }
        if (v < 0) v = 0;

        if (x < gutter && !limita) return { zona: "numero", v };
        if (c < 0) return null;
        return { zona: "cella", v, c: Math.max(0, c) };
    };

    const suMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const l = layoutRef.current;
        const colpo = colpisci(e.clientX, e.clientY);
        if (!l || !colpo) return;
        e.preventDefault();
        scrollRef.current?.focus();
        const ultimaRiga = l.layout.righeVisibili - 1;
        const ultimaColonna = l.layout.larghezze.length - 1;
        if (ultimaRiga < 0 || ultimaColonna < 0) return;
        const precedente = selezioneRef.current;

        switch (colpo.zona) {
            case "angolo":
                impostaSelezione({ ancora: { v: 0, c: 0 }, cursore: { v: ultimaRiga, c: ultimaColonna } }, { v: 0, c: 0 });
                return;
            case "lettera":
                if (colpo.bordo >= 0) {
                    trascinamentoRef.current = {
                        tipo: "larghezza",
                        colonna: colpo.bordo,
                        xIniziale: e.clientX,
                        larghezzaIniziale: l.layout.larghezze[colpo.bordo],
                    };
                    return;
                }
                if (e.shiftKey && precedente) {
                    impostaSelezione(
                        { ancora: { v: 0, c: precedente.ancora.c }, cursore: { v: ultimaRiga, c: colpo.c } },
                        { v: 0, c: colpo.c }
                    );
                } else {
                    impostaSelezione({ ancora: { v: 0, c: colpo.c }, cursore: { v: ultimaRiga, c: colpo.c } }, { v: 0, c: colpo.c });
                }
                trascinamentoRef.current = { tipo: "selezione", zona: "lettera" };
                return;
            case "numero":
                if (e.shiftKey && precedente) {
                    impostaSelezione(
                        { ancora: { v: precedente.ancora.v, c: 0 }, cursore: { v: colpo.v, c: ultimaColonna } },
                        { v: colpo.v, c: 0 }
                    );
                } else {
                    impostaSelezione({ ancora: { v: colpo.v, c: 0 }, cursore: { v: colpo.v, c: ultimaColonna } }, { v: colpo.v, c: 0 });
                }
                trascinamentoRef.current = { tipo: "selezione", zona: "numero" };
                return;
            case "cella": {
                const cella = { v: colpo.v, c: colpo.c };
                if (e.shiftKey && precedente) impostaSelezione({ ancora: precedente.ancora, cursore: cella });
                else impostaSelezione(selezioneSingola(cella));
                trascinamentoRef.current = { tipo: "selezione", zona: "cella" };
                return;
            }
        }
    };

    const suDoppioClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const colpo = colpisci(e.clientX, e.clientY);
        if (colpo?.zona === "lettera" && colpo.bordo >= 0) invia({ tipo: "adatta", colonna: colpo.bordo });
    };

    const suMouseMoveLocale = (e: React.MouseEvent<HTMLDivElement>) => {
        if (trascinamentoRef.current) return;
        const colpo = colpisci(e.clientX, e.clientY);
        const nuovo = colpo?.zona === "lettera" && colpo.bordo >= 0 ? "col-resize" : colpo?.zona === "cella" ? "cell" : "default";
        if (nuovo !== cursore) setCursore(nuovo);
    };

    // Trascinamento: segue il mouse anche fuori dalla griglia
    useEffect(() => {
        const suMove = (e: MouseEvent) => {
            const t = trascinamentoRef.current;
            const l = layoutRef.current;
            const scroll = scrollRef.current;
            if (!t || !l || !scroll) return;
            if (t.tipo === "larghezza") {
                const larghezza = Math.max(LARGHEZZA_MIN_COLONNA, t.larghezzaIniziale + e.clientX - t.xIniziale);
                invia({ tipo: "larghezza", colonna: t.colonna, larghezza });
                return;
            }
            // Scorrimento automatico vicino ai bordi
            const rect = scroll.getBoundingClientRect();
            if (e.clientY > rect.top + scroll.clientHeight - 8) scroll.scrollTop += ALTEZZA_RIGA;
            else if (e.clientY < rect.top + ALTEZZA_LETTERE + ALTEZZA_RIGA) scroll.scrollTop -= ALTEZZA_RIGA;
            if (e.clientX > rect.left + scroll.clientWidth - 8) scroll.scrollLeft += 40;
            else if (e.clientX < rect.left + l.layout.gutter) scroll.scrollLeft -= 40;

            const colpo = colpisci(e.clientX, e.clientY, true);
            const precedente = selezioneRef.current;
            if (!colpo || colpo.zona !== "cella" || !precedente) return;
            const ultimaRiga = l.layout.righeVisibili - 1;
            const ultimaColonna = l.layout.larghezze.length - 1;
            const cursoreNuovo =
                t.zona === "lettera"
                    ? { v: ultimaRiga, c: colpo.c }
                    : t.zona === "numero"
                        ? { v: colpo.v, c: ultimaColonna }
                        : { v: colpo.v, c: colpo.c };
            if (cursoreNuovo.v === precedente.cursore.v && cursoreNuovo.c === precedente.cursore.c) return;
            selezioneRef.current = { ancora: precedente.ancora, cursore: cursoreNuovo };
            invia({ tipo: "selezione", selezione: selezioneRef.current });
        };
        const suUp = () => {
            trascinamentoRef.current = null;
        };
        window.addEventListener("mousemove", suMove);
        window.addEventListener("mouseup", suUp);
        return () => {
            window.removeEventListener("mousemove", suMove);
            window.removeEventListener("mouseup", suUp);
        };
    }, [invia]);

    const suTasto = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const l = layoutRef.current;
        const sel = selezioneRef.current;
        if (!l || !sel) return;
        const righe = l.layout.righeVisibili;
        const colonne = l.layout.larghezze.length;
        const ctrl = e.ctrlKey || e.metaKey;
        const tasto = e.key;

        if (ctrl && tasto.toLowerCase() === "c") {
            e.preventDefault();
            copia();
            return;
        }
        if (ctrl && tasto.toLowerCase() === "a") {
            e.preventDefault();
            impostaSelezione({ ancora: { v: 0, c: 0 }, cursore: { v: righe - 1, c: colonne - 1 } }, sel.ancora);
            return;
        }

        const pagina = Math.max(1, Math.floor(((scrollRef.current?.clientHeight ?? 0) - ALTEZZA_LETTERE - ALTEZZA_RIGA) / ALTEZZA_RIGA) - 1);
        let dv = 0;
        let dc = 0;
        let aBordo = ctrl;
        let estendi = e.shiftKey;
        switch (tasto) {
            case "ArrowUp": dv = -1; break;
            case "ArrowDown": dv = 1; break;
            case "ArrowLeft": dc = -1; break;
            case "ArrowRight": dc = 1; break;
            case "Tab": dc = e.shiftKey ? -1 : 1; estendi = false; aBordo = false; break;
            case "Enter": dv = e.shiftKey ? -1 : 1; estendi = false; aBordo = false; break;
            case "PageUp": dv = -pagina; aBordo = false; break;
            case "PageDown": dv = pagina; aBordo = false; break;
            case "Home":
                dc = -1;
                aBordo = true;
                if (ctrl) dv = -1;
                break;
            case "End":
                dc = 1;
                aBordo = true;
                if (ctrl) dv = 1;
                break;
            default:
                return;
        }
        e.preventDefault();
        if (estendi) {
            const cursoreNuovo = spostaCella(sel.cursore, dv, dc, righe, colonne, aBordo);
            impostaSelezione({ ancora: sel.ancora, cursore: cursoreNuovo });
        } else {
            const cella = spostaCella(sel.ancora, dv, dc, righe, colonne, aBordo);
            impostaSelezione(selezioneSingola(cella));
        }
    };

    /* =======================
       RENDER
       ======================= */
    const contenutoW = layout ? layout.gutter + layout.larghezze.reduce((a, b) => a + b, 0) : 0;
    const contenutoH = layout && layout.righeVisibili > 0 ? ALTEZZA_LETTERE + layout.righeVisibili * ALTEZZA_RIGA : 0;
    const risultati = layout && layout.termine.trim() ? Math.max(0, layout.righeVisibili - 1) : null;
    const nomeTracciato = tracciato?.nome || tracciato?.filename || "Tracciato";
    const dimensione = getFileSize(tracciato?.blobfile);
    const foglioAttivo = fogli[layout?.foglio ?? 0];
    const stat = info.statistiche;

    return (
        <div className="fixed inset-0 flex flex-col bg-white text-slate-700 dark:bg-darkmode-600 dark:text-slate-300">
            {/* Barra superiore */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200/80 bg-slate-50/60 flex-shrink-0 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                <Button size="sm" variant="outline-secondary" onClick={tornaAllaPromo} className="flex-shrink-0">
                    <Lucide icon="ArrowLeft" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Torna alla promo
                </Button>
                <div className="h-6 w-px bg-slate-200 dark:bg-darkmode-400" />
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control bg-gradient-to-b from-theme-1 to-theme-2/80">
                        <Lucide icon="FileSpreadsheet" aria-hidden="true" className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                        {/* Pagina a tutto schermo: il nome del tracciato è il suo titolo */}
                        <h1 className="title-card truncate dark:text-slate-200" title={nomeTracciato}>
                            {nomeTracciato}
                        </h1>
                        <div className="text-xs text-slate-400 truncate">
                            Anteprima tracciato
                            {tracciato?.filename && tracciato.nome && tracciato.nome !== tracciato.filename && ` · ${tracciato.filename}`}
                            {dimensione && ` · ${dimensione} MB`}
                        </div>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {risultati !== null && (
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                            {formatNumero(risultati)} {risultati === 1 ? "riga trovata" : "righe trovate"}
                        </span>
                    )}
                    <CampoRicerca
                        ref={ricercaRef}
                        etichetta="Cerca nel tracciato"
                        placeholder="Cerca nel tracciato (Ctrl+F)"
                        value={termine}
                        onChange={setTermine}
                        onKeyDown={e => {
                            if (e.key === "Escape") {
                                setTermine("");
                                scrollRef.current?.focus();
                            } else if (e.key === "Enter") {
                                scrollRef.current?.focus();
                            }
                        }}
                        disabled={stato !== "pronto"}
                        className="w-72"
                    />
                </div>
            </div>

            {/* Barra della formula */}
            <div className="flex items-stretch h-9 border-b border-slate-200/80 flex-shrink-0 text-sm dark:border-darkmode-400">
                <div
                    className="w-28 flex items-center px-3 border-r border-slate-200/80 font-mono text-xs font-medium text-primary dark:border-darkmode-400 dark:text-slate-200"
                    title="Cella attiva"
                >
                    {info.indirizzo}
                </div>
                <div className="w-10 flex items-center justify-center border-r border-slate-200/80 text-slate-400 dark:border-darkmode-400">
                    <Lucide icon="SquareFunction" aria-hidden="true" className="w-4 h-4" />
                </div>
                <input
                    readOnly
                    value={info.valore}
                    className="flex-1 min-w-0 px-3 border-0 bg-transparent text-sm text-slate-700 focus:outline-none focus:ring-0 dark:text-slate-200"
                    aria-label="Contenuto della cella attiva"
                />
            </div>

            {/* Griglia */}
            <div ref={hostRef} className="relative flex-1 min-h-0 overflow-hidden">
                <div
                    ref={scrollRef}
                    tabIndex={0}
                    onScroll={inviaVista}
                    onMouseDown={suMouseDown}
                    onMouseMove={suMouseMoveLocale}
                    onDoubleClick={suDoppioClick}
                    onKeyDown={suTasto}
                    className="absolute inset-0 overflow-auto outline-none scrollbar-enhanced"
                    style={{ cursor: cursore }}
                    role="grid"
                    aria-label={`Anteprima ${nomeTracciato}`}
                    aria-rowcount={layout?.righeVisibili ?? 0}
                    aria-colcount={layout?.larghezze.length ?? 0}
                >
                    <div style={{ width: contenutoW, height: contenutoH }} />
                </div>

                {stato === "caricamento" && (
                    <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/80 dark:bg-darkmode-600/80">
                        <Spinner size="lg" decorativo />
                        <p className="text-slate-600 font-medium">Analisi dati in corso...</p>
                    </div>
                )}

                {stato === "errore" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto bg-white p-4 dark:bg-darkmode-600">
                        {/* Senza OffscreenCanvas riprovare non serve: resta solo il ritorno alla promo */}
                        <PageError
                            titolo="Impossibile caricare il tracciato"
                            motivo={errore || "Il tracciato non è disponibile."}
                            onRiprova={offscreenSupportato() ? carica : undefined}
                            className="min-h-0 w-full max-w-xl py-10"
                        />
                        <Button size="sm" variant="outline-secondary" onClick={tornaAllaPromo}>
                            <Lucide icon="ArrowLeft" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                            Torna alla promo
                        </Button>
                    </div>
                )}

                {stato === "pronto" && layout && layout.righeFile === 0 && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <EmptyState compatta icon="Sheet" title="Il foglio è vuoto" description="" />
                    </div>
                )}
            </div>

            {/* Schede dei fogli e barra di stato */}
            <div className="flex items-stretch h-9 border-t border-slate-200/80 bg-slate-50/60 flex-shrink-0 text-xs dark:border-darkmode-400 dark:bg-darkmode-700/40">
                <div role="tablist" aria-label="Fogli del tracciato" className="flex items-stretch overflow-x-auto min-w-0">
                    {fogli.map((f, i) => (
                        <button
                            key={`${i}-${f.nome}`}
                            type="button"
                            role="tab"
                            aria-selected={layout?.foglio === i}
                            onClick={() => invia({ tipo: "foglio", indice: i })}
                            className={clsx(
                                "flex items-center gap-1.5 px-4 border-r border-slate-200/80 whitespace-nowrap transition-colors dark:border-darkmode-400",
                                layout?.foglio === i
                                    ? "bg-white font-medium text-primary shadow-[inset_0_-2px_0_0_rgb(var(--color-primary))] dark:bg-darkmode-600 dark:text-slate-200"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-darkmode-500"
                            )}
                            title={`${formatNumero(f.righe)} righe, ${f.colonne} colonne`}
                        >
                            <Lucide icon="Sheet" aria-hidden="true" className="w-3.5 h-3.5" />
                            {f.nome || `Foglio ${i + 1}`}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-4 px-4 text-slate-500 whitespace-nowrap">
                    <AnimatePresence>
                        {copiate !== null && (
                            <motion.span
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={clsx("flex items-center gap-1 font-medium", copiate < 0 ? "text-danger" : "text-success")}
                            >
                                <Lucide icon={copiate < 0 ? "CircleAlert" : "Check"} aria-hidden="true" className="w-3.5 h-3.5" />
                                {copiate < 0
                                    ? "Impossibile copiare negli appunti"
                                    : `${formatNumero(copiate)} ${copiate === 1 ? "cella copiata" : "celle copiate"}`}
                            </motion.span>
                        )}
                    </AnimatePresence>
                    {stat.celle > 1 && (
                        <>
                            {stat.numerici > 0 && stat.media !== null && <span>Media: {formatoNumero.format(stat.media)}</span>}
                            <span>Conteggio: {formatNumero(stat.conteggio)}</span>
                            {stat.numerici > 0 && <span>Somma: {formatoNumero.format(stat.somma)}</span>}
                        </>
                    )}
                    {foglioAttivo && (
                        <span className="text-slate-400">
                            {formatNumero(foglioAttivo.righe)} righe × {foglioAttivo.colonne} colonne
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default withSessionCheck(DettaglioAnteprimaTracciato);
