import { formatNumero } from "@/utils/format";
import { urlPaginaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import type { MenaboVolantino as Menabo, PdfVolantino } from "../../../../lib/insightVolantino/tipi";
import { PROPORZIONE_PREDEFINITA } from "../volantino/geometria";

/** Una pagina del menabò: con la sua sezione e il colore della sezione, o senza. */
export interface PaginaDelMenabo {
  pagina: number;
  /** Il valore come lo scrive la fonte; null per una pagina senza referenze o senza sezione. */
  sezione: string | null;
  nome: string | null;
  /** Indice del colore della sezione (coloreSezione); null senza sezione. */
  colore: number | null;
}

/** Una sezione del menabò con le sue pagine, nell'ordine in cui compare. */
export interface SezioneDelMenabo {
  nome: string;
  colore: number;
  pagine: number[];
}

/**
 * Sedici colori ben distinti, nell'ordine in cui si assegnano: sezioni di fila prendono tinte lontane.
 * Pieni e di media luminosità, si leggono sul bianco e sul fondo scuro; il numero sopra è chiaro o
 * scuro secondo il colore (testoSuColore).
 */
const PALETTE_SEZIONI = [
  "#2563eb",
  "#ea580c",
  "#16a34a",
  "#db2777",
  "#7c3aed",
  "#f59e0b",
  "#0d9488",
  "#dc2626",
  "#84cc16",
  "#4f46e5",
  "#c026d3",
  "#06b6d4",
  "#78716c",
  "#e11d48",
  "#0284c7",
  "#92400e",
] as const;

/** L'angolo aureo: le tinte generate oltre la palette cadono sempre lontane dalle precedenti. */
const ANGOLO_AUREO = 137.508;

/** Il colore della sezione `indice`: i sedici della palette, poi tinte generate tutte diverse. */
export const coloreSezione = (indice: number): string =>
  PALETTE_SEZIONI[indice] ?? `hsl(${Math.round((indice * ANGOLO_AUREO) % 360)} 65% 42%)`;

const daHsl = (h: number, s: number, l: number): [number, number, number] => {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

const rgbDi = (colore: string): [number, number, number] | null => {
  const esadecimale = /^#([0-9a-f]{6})$/i.exec(colore);
  if (esadecimale) {
    const valore = Number.parseInt(esadecimale[1] ?? "0", 16);
    return [(valore >> 16) & 255, (valore >> 8) & 255, valore & 255];
  }
  const hsl = /^hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)$/.exec(colore);
  return hsl ? daHsl(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100) : null;
};

/**
 * La classe del testo sopra un colore pieno: scuro sui colori chiari (giallo, lime, ciano), bianco
 * sugli altri, uguale nei due temi. Classi text-*: il numero è testo HTML, non un segno SVG.
 */
export const testoSuColore = (colore: string): string => {
  const rgb = rgbDi(colore);
  if (!rgb) return "text-white";
  const [r, g, b] = rgb.map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "text-slate-900" : "text-white";
};

/** "12–21, 24–26": le pagine ordinate, senza ripetizioni, raggruppate in intervalli di pagine di fila. */
export const intervalliPagine = (pagine: readonly number[]): string => {
  const ordinate = [...new Set(pagine)].sort((a, b) => a - b);
  const intervalli: string[] = [];
  let inizio: number | null = null;
  let fine: number | null = null;
  const chiudi = () => {
    if (inizio === null || fine === null) return;
    intervalli.push(inizio === fine ? String(inizio) : `${inizio}–${fine}`);
  };
  for (const pagina of ordinate) {
    if (fine !== null && pagina === fine + 1) {
      fine = pagina;
      continue;
    }
    chiudi();
    inizio = pagina;
    fine = pagina;
  }
  chiudi();
  return intervalli.join(", ");
};

/**
 * Tutte le pagine del volantino, dalla prima all'ultima, con la loro sezione. Le sezioni prendono i
 * colori per nome, nell'ordine in cui compaiono: lo stesso nome ha sempre lo stesso colore ("Dispensa
 * doppia" e "Dispensa singola" sono già "Dispensa"), nomi diversi colori diversi. Una pagina senza
 * sezione, con o senza prodotti, non ha nome né colore. Funzione pura.
 */
export const pagineDelMenabo = (menabo: Menabo, totalePagine: number): PaginaDelMenabo[] => {
  const perPagina = new Map(menabo.pagine.map(voce => [voce.pagina, voce]));
  const ultima = Math.max(Number.isFinite(totalePagine) ? Math.floor(totalePagine) : 0, ...menabo.pagine.map(voce => voce.pagina));
  const colori = new Map<string, number>();
  const pagine: PaginaDelMenabo[] = [];
  for (let pagina = 1; pagina <= ultima; pagina++) {
    const voce = perPagina.get(pagina);
    if (!voce) {
      pagine.push({ pagina, sezione: null, nome: null, colore: null });
      continue;
    }
    const nome = voce.nome || voce.sezione;
    if (!colori.has(nome)) colori.set(nome, colori.size);
    pagine.push({ pagina, sezione: voce.sezione, nome, colore: colori.get(nome) ?? null });
  }
  return pagine;
};

/** Le sezioni del menabò con le loro pagine, nell'ordine in cui compaiono. Funzione pura. */
export const sezioniDelMenabo = (pagine: readonly PaginaDelMenabo[]): SezioneDelMenabo[] => {
  const sezioni = new Map<string, SezioneDelMenabo>();
  for (const voce of pagine) {
    if (voce.nome === null || voce.colore === null) continue;
    const sezione = sezioni.get(voce.nome) ?? { nome: voce.nome, colore: voce.colore, pagine: [] };
    sezione.pagine.push(voce.pagina);
    sezioni.set(voce.nome, sezione);
  }
  return [...sezioni.values()];
};

/** Larghezza in pixel CSS della copertina accanto al menabò. */
const LARGHEZZA_COPERTINA = 112;

/** La copertina da Olimpo, ridotta, sul segnaposto che pulsa finché arriva; se non si carica resta il foglio bianco. */
function Copertina({ pdf, proporzione, corrente, onVai }: { pdf: PdfVolantino | null; proporzione: number; corrente: boolean; onVai?: () => void }) {
  const [rotta, setRotta] = useState(false);
  const [caricata, setCaricata] = useState(false);
  const larghezza = LARGHEZZA_COPERTINA * 2;
  const url = pdf?.idOlimpoCloud ? urlPaginaMateriale(pdf.idOlimpoCloud, 1, { larghezza, altezza: Math.round(larghezza / proporzione) }) : null;
  const conImmagine = Boolean(url && !rotta);
  const contenuto = conImmagine ? (
    <img src={url ?? undefined} alt="" loading="lazy" onLoad={() => setCaricata(true)} onError={() => setRotta(true)} className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-xs text-slate-400 dark:text-slate-500">Copertina</span>
  );
  const classi = twMerge(
    "block flex-none overflow-hidden rounded-control border bg-white shadow-sm dark:bg-darkmode-700",
    conImmagine && !caricata && "animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-darkmode-400",
    corrente ? "border-theme-1 ring-2 ring-theme-1/40 dark:border-indigo-300" : "border-slate-200 dark:border-darkmode-400"
  );
  const stile = { width: LARGHEZZA_COPERTINA, aspectRatio: String(proporzione) };
  if (!onVai) return <span aria-hidden="true" className={classi} style={stile}>{contenuto}</span>;
  return (
    <button type="button" aria-label="Apri la copertina nel volantino" onClick={onVai} className={twMerge(classi, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40")} style={stile}>
      {contenuto}
    </button>
  );
}

/** Al posto del nome, per una pagina di cui non si trova la sezione: senza referenze o senza mastro. */
export const SEZIONE_NON_TROVATA = "Non trovata";

/** Il testo del riquadro di una pagina per chi non vede: la sezione, o che non è stata trovata. */
const descrizionePagina = (voce: PaginaDelMenabo): string =>
  voce.nome ? `Pagina ${voce.pagina}: ${voce.nome}` : `Pagina ${voce.pagina}: sezione non trovata`;

export interface MenaboVolantinoProps {
  menabo: Menabo;
  /** Le pagine del volantino: il menabò le mostra tutte, anche quelle senza sezione. */
  totalePagine: number;
  pdf: PdfVolantino | null;
  /** Larghezza/altezza della pagina, per la copertina; senza, quella di un A4. */
  proporzione?: number | null;
  /** La pagina che l'utente sta guardando nel volantino: è evidenziata. */
  paginaCorrente?: number;
  /** Apre la pagina nel volantino; senza, i riquadri non sono comandi. */
  onVaiAllaPagina?: (pagina: number) => void;
}

/**
 * Il menabò del volantino (spec insight-volantino, "Menabò del volantino"): la copertina e un
 * riquadro per pagina, dalla prima all'ultima, con il numero e il nome della sezione (per Conad CNO la
 * mastro, col nome pulito), nel colore della sezione; sezioni diverse hanno colori diversi. Niente
 * reparto. Una pagina di cui non si trova la sezione, senza referenze o senza mastro, dice "Non
 * trovata". Il nome intero della fonte sta nel suggerimento. Sotto, le sezioni con le loro pagine a
 * intervalli. Scegliendo una pagina il volantino va lì.
 */
export function MenaboVolantino({ menabo, totalePagine, pdf, proporzione, paginaCorrente, onVaiAllaPagina }: MenaboVolantinoProps) {
  const pagine = pagineDelMenabo(menabo, totalePagine);
  const sezioni = sezioniDelMenabo(pagine);
  const formato = proporzione && Number.isFinite(proporzione) && proporzione > 0 ? proporzione : PROPORZIONE_PREDEFINITA;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-start">
          <Copertina pdf={pdf} proporzione={formato} corrente={paginaCorrente === 1} onVai={onVaiAllaPagina ? () => onVaiAllaPagina(1) : undefined} />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatNumero(pagine.length)} pagine
            <br />
            {sezioni.length === 1 ? "1 sezione" : `${formatNumero(sezioni.length)} sezioni`}
          </p>
        </div>
        <ul aria-label="Menabò: le pagine con la loro sezione" className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
          {pagine.map(voce => {
            const corrente = voce.pagina === paginaCorrente;
            const colore = voce.colore !== null ? coloreSezione(voce.colore) : null;
            const contenuto = (
              <>
                <span
                  aria-hidden="true"
                  style={colore ? { backgroundColor: colore } : undefined}
                  className={twMerge(
                    "flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold tabular-nums",
                    colore ? testoSuColore(colore) : "bg-slate-100 text-slate-600 dark:bg-darkmode-400 dark:text-slate-200"
                  )}
                >
                  {voce.pagina}
                </span>
                <span className={twMerge("min-w-0 truncate text-sm", voce.nome ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500")}>
                  {voce.nome ?? SEZIONE_NON_TROVATA}
                </span>
              </>
            );
            const classi = twMerge(
              "flex w-full items-center gap-2 rounded-card border bg-white px-2.5 py-2 text-left dark:bg-darkmode-600",
              corrente ? "border-theme-1 ring-1 ring-theme-1 dark:border-indigo-300 dark:ring-indigo-300" : "border-slate-200 dark:border-darkmode-400"
            );
            return (
              <li key={voce.pagina} data-pagina-menabo={voce.pagina} data-sezione={voce.sezione ?? undefined}>
                {onVaiAllaPagina ? (
                  <button
                    type="button"
                    title={voce.sezione ?? undefined}
                    aria-label={descrizionePagina(voce)}
                    aria-current={corrente ? "page" : undefined}
                    onClick={() => onVaiAllaPagina(voce.pagina)}
                    className={twMerge(
                      classi,
                      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
                      !corrente && "hover:border-slate-300 hover:bg-slate-50 dark:hover:border-darkmode-300 dark:hover:bg-darkmode-500"
                    )}
                  >
                    {contenuto}
                  </button>
                ) : (
                  <div title={voce.sezione ?? undefined} className={classi}>
                    {contenuto}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {sezioni.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-dashed border-slate-200 pt-3 dark:border-darkmode-400">
          <ul aria-label="Le sezioni del volantino e le loro pagine" className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {sezioni.map(sezione => (
              <li key={sezione.nome} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: coloreSezione(sezione.colore) }} />
                <span>
                  <span className="font-semibold">{sezione.nome}</span>: <span className="tabular-nums text-slate-500 dark:text-slate-400">{intervalliPagine(sezione.pagine)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MenaboVolantino;
