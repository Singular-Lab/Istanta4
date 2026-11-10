import { Legenda, SERIE_PRINCIPALE, TINTA_NEUTRA, TINTA_PRINCIPALE } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useState } from "react";
import type { BolloInsight, LineaInsight, LineeDistributore } from "../../../../lib/insightVolantino/tipi";
import { Blocco } from "./comuni";

/**
 * "Marchi del distributore": quanto spazio del volantino va alle linee di marca del distributore
 * (Sapori & Dintorni, Verso Natura...), linea per linea con il suo logo, e i bolli stampati (DOP,
 * Filiera controllata...). Le linee e i bolli li dichiara la libreria agenzia del cliente, i loghi
 * vengono dal catalogo di Istanta (EstensioneInsight.lineeDistributore).
 */

export interface MarchiDistributoreProps {
  linee: LineeDistributore;
}

const PAROLE_VUOTE = new Set(["a", "al", "con", "da", "dal", "dei", "del", "della", "delle", "di", "e", "gli", "i", "il", "in", "la", "le", "lo", "per"]);

/** Le iniziali per il segnaposto del logo: "Sapori & Dintorni" → "SD", "Bio" → "BI". */
export const iniziali = (nome: string, sigla = ""): string => {
  const parole = nome.split(/[^\p{L}\p{N}]+/u).filter(parola => parola && !PAROLE_VUOTE.has(parola.toLocaleLowerCase("it")));
  if (parole.length >= 2) return (parole[0][0] + parole[1][0]).toLocaleUpperCase("it");
  if (parole.length === 1) return parole[0].slice(0, 2).toLocaleUpperCase("it");
  return sigla.slice(0, 2).toLocaleUpperCase("it") || "?";
};

/** Testo chiaro o scuro sopra un colore #rrggbb (o #rgb), perché le iniziali si leggano. */
export const testoSuColore = (colore: string | null | undefined): "text-white" | "text-slate-900" | null => {
  const esadecimale = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colore?.trim() ?? "")?.[1];
  if (!esadecimale) return null;
  const pieno = esadecimale.length === 3 ? [...esadecimale].map(c => c + c).join("") : esadecimale;
  const [r, g, b] = [0, 2, 4].map(i => {
    const v = parseInt(pieno.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? "text-slate-900" : "text-white";
};

/**
 * Il logo della linea o del bollo; senza logo, o se non si carica, un riquadro con le iniziali nel
 * colore della linea (o neutro).
 */
function Logo({ url, nome, sigla, colore, misura }: { url: string | null; nome: string; sigla: string; colore?: string | null; misura: "grande" | "piccola" }) {
  const [rotto, setRotto] = useState(false);
  const classeMisura = misura === "grande" ? "h-11 w-11 text-sm" : "h-5 w-5 text-[0.5rem]";
  if (url && !rotto) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setRotto(true)}
        className={twMerge("flex-none rounded-control border border-slate-200 bg-white object-contain p-0.5 dark:border-darkmode-400", classeMisura)}
      />
    );
  }
  const testo = testoSuColore(colore);
  return (
    <span
      aria-hidden="true"
      data-monogramma
      style={testo && colore ? { backgroundColor: colore } : undefined}
      className={twMerge(
        "flex flex-none items-center justify-center rounded-control font-bold leading-none",
        classeMisura,
        testo ?? "bg-slate-200 text-slate-700 dark:bg-darkmode-400 dark:text-slate-200"
      )}
    >
      {iniziali(nome, sigla)}
    </span>
  );
}

const contaBox = (numero: number): string => (numero === 1 ? "1 box" : `${formatNumero(numero)} box`);

/** Le linee del distributore contro tutto il resto del volantino, in una barra sola. */
function QuotaDistributore({ linee }: { linee: LineeDistributore }) {
  const quota = Math.max(0, Math.min(100, linee.quotaSpazio));
  const resto = 100 - quota;
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        <b className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatPercentuale(quota)}</b> dello spazio del volantino,{" "}
        {contaBox(linee.box)} ({formatPercentuale(linee.quotaBox)} dei box)
      </p>
      <div
        role="img"
        aria-label={`Marchi del distributore ${formatPercentuale(quota)} dello spazio, altre marche ${formatPercentuale(resto)}`}
        className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400"
      >
        <div className={twMerge("h-full", SERIE_PRINCIPALE.sfondo)} style={{ width: `${quota}%` }} />
      </div>
      <Legenda
        voci={[
          { id: "distributore", etichetta: `Marchi del distributore ${formatPercentuale(quota)}`, forma: "quadrato", tinta: TINTA_PRINCIPALE },
          { id: "altre", etichetta: `Altre marche ${formatPercentuale(resto)}`, forma: "quadrato", tinta: TINTA_NEUTRA },
        ]}
      />
    </div>
  );
}

function SchedaLinea({ linea, massimo }: { linea: LineaInsight; massimo: number }) {
  const larghezza = massimo > 0 ? Math.max(0, Math.min(100, (linea.quotaSpazio / massimo) * 100)) : 0;
  const colorata = testoSuColore(linea.colore) !== null;
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-control border border-slate-200 bg-white p-3 dark:border-darkmode-400 dark:bg-darkmode-600">
      <Logo key={linea.logo ?? ""} url={linea.logo} nome={linea.nome} sigla={linea.sigla} colore={linea.colore} misura="grande" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={linea.nome}>
          {linea.nome}
        </p>
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {contaBox(linea.box)} · {formatPercentuale(linea.quotaSpazio)} dello spazio
        </p>
        {/* Rispetto alla linea con più spazio: le barre delle schede si confrontano fra loro */}
        <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
          <div
            className={twMerge("h-full rounded-full", !colorata && SERIE_PRINCIPALE.sfondo)}
            style={{ width: `${larghezza}%`, ...(colorata && linea.colore ? { backgroundColor: linea.colore } : {}) }}
          />
        </div>
      </div>
    </li>
  );
}

function Bollo({ bollo }: { bollo: BolloInsight }) {
  return (
    <li className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-xs dark:border-darkmode-400 dark:bg-darkmode-600">
      <Logo key={bollo.logo ?? ""} url={bollo.logo} nome={bollo.nome} sigla={bollo.sigla} misura="piccola" />
      <span className="truncate font-medium text-slate-700 dark:text-slate-200">{bollo.nome}</span>
      <span className="flex-none tabular-nums text-slate-500 dark:text-slate-400">{contaBox(bollo.box)}</span>
    </li>
  );
}

export function MarchiDistributore({ linee }: MarchiDistributoreProps) {
  const massimo = Math.max(0, ...linee.linee.map(linea => linea.quotaSpazio));
  return (
    <div className="space-y-6">
      <QuotaDistributore linee={linee} />

      <Blocco titolo="Linee nel volantino" descrizione="Box e spazio di ogni linea, nell'ordine dichiarato dal distributore.">
        {linee.linee.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nessun prodotto delle linee del distributore in questo volantino.</p>
        ) : (
          <ul aria-label="Linee del distributore" className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
            {linee.linee.map(linea => (
              <SchedaLinea key={linea.sigla || linea.nome} linea={linea} massimo={massimo} />
            ))}
          </ul>
        )}
      </Blocco>

      {linee.bolli.length > 0 && (
        <Blocco titolo="Bolli nel volantino" descrizione="I bolli stampati sui box, dal più frequente.">
          <ul aria-label="Bolli nel volantino" className="flex flex-wrap gap-2">
            {linee.bolli.map(bollo => (
              <Bollo key={bollo.sigla || bollo.nome} bollo={bollo} />
            ))}
          </ul>
        </Blocco>
      )}
    </div>
  );
}

export default MarchiDistributore;
