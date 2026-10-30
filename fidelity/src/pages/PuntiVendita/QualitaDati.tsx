import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { UseQueryResult } from "@tanstack/react-query";
import type { QualitaPuntiVendita } from "../../../lib/puntiVendita/analisi";

/** I filtri dell'elenco che si accendono dalle tessere della qualità dei dati. */
export type FiltroQualita = "senzaCoordinate" | "senzaCodice" | "senzaStoria";

export const ETICHETTA_FILTRO_QUALITA: Record<FiltroQualita, string> = {
  senzaCoordinate: "Senza coordinate",
  senzaCodice: "Senza codice",
  senzaStoria: "Mai nei volantini",
};

type Tono = "attenzione" | "errore" | "ok" | "neutro";

const CLASSI_TONO: Record<Tono, { valore: string; barra: string }> = {
  attenzione: { valore: "text-warning", barra: "bg-warning" },
  errore: { valore: "text-danger", barra: "bg-danger" },
  ok: { valore: "text-success", barra: "bg-success" },
  neutro: { valore: "text-slate-700 dark:text-slate-200", barra: "bg-slate-400" },
};

interface Tessera {
  chiave: string;
  valore: string;
  etichetta: string;
  descrizione: string;
  tono: Tono;
  /** Riempimento della barra, 0–100. */
  quota: number;
  filtro?: FiltroQualita;
  /** Azione al posto del filtro, per esempio aprire l'import. */
  azione?: () => void;
  /** Cosa fa il clic, per il title. */
  suggerimento?: string;
}

interface QualitaDatiProps {
  query: Pick<UseQueryResult<QualitaPuntiVendita>, "data" | "isLoading" | "isError" | "error" | "refetch">;
  filtroAttivo: FiltroQualita | null;
  /** Accende il filtro o, se è già acceso, lo spegne. */
  onFiltro: (filtro: FiltroQualita) => void;
  /** Filtri che l'elenco sa applicare: il codice solo se la GDO usa i codici, la storia solo se arriva. */
  filtriDisponibili: { senzaCodice: boolean; senzaStoria: boolean };
  /** Apre l'ultimo import Excel, dove stanno le righe da revisionare; senza, la tessera è solo un numero. */
  onRigheDaRevisionare?: () => void;
}

const quota = (parte: number, totale: number) => (totale > 0 ? Math.min(100, (parte / totale) * 100) : 0);

// Su mobile due colonne compatte invece di una tessera per riga; da md tre, da lg tutte in fila
const GRIGLIA = "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5";
// L'ultima tessera rimasta sola nella riga delle due colonne le occupa entrambe
const ULTIMA_DISPARI = "col-span-2 md:col-span-1";

/**
 * I problemi dei dati dell'anagrafica in alto, ciascuno con il suo numero e la quota sul totale:
 * quelli che riguardano i punti vendita dell'elenco fanno da filtro con un clic.
 */
export function QualitaDati({ query, filtroAttivo, onFiltro, filtriDisponibili, onRigheDaRevisionare }: QualitaDatiProps) {
  if (query.isLoading) {
    return (
      <div aria-busy="true" aria-label="Caricamento della qualità dei dati" className={GRIGLIA}>
        {Array.from({ length: 5 }, (_, indice) => (
          <div key={indice} className={twMerge("rounded-card border border-slate-200 bg-white p-2.5 sm:p-3 dark:border-darkmode-400 dark:bg-darkmode-600", indice === 4 && ULTIMA_DISPARI)}>
            <Skeleton className="h-6 w-12" />
            <Skeleton className="mt-2 h-3 w-2/3" />
            <Skeleton className="mt-3 h-1 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PageError
        compatta
        titolo="Qualità dei dati non disponibile"
        motivo={(query.error as Error | null)?.message || "Errore durante il calcolo della qualità dei dati"}
        onRiprova={() => query.refetch()}
      />
    );
  }

  const q = query.data;
  const senzaStoria = Math.max(0, q.totale - q.conStoria);
  const quotaStoria = quota(q.conStoria, q.totale);
  const tessere: Tessera[] = [
    {
      chiave: "coordinate",
      valore: formatNumero(q.senzaCoordinate),
      etichetta: "Senza coordinate",
      descrizione: "Non compaiono sulla mappa",
      tono: q.senzaCoordinate > 0 ? "attenzione" : "ok",
      quota: quota(q.senzaCoordinate, q.totale),
      filtro: "senzaCoordinate",
    },
    ...(filtriDisponibili.senzaCodice
      ? [
        {
          chiave: "codice",
          valore: formatNumero(q.senzaCodice),
          etichetta: "Senza codice",
          descrizione: "Manca il codice del sistema della GDO",
          tono: q.senzaCodice > 0 ? "attenzione" : "ok",
          quota: quota(q.senzaCodice, q.totale),
          filtro: "senzaCodice",
        } satisfies Tessera,
      ]
      : []),
    {
      chiave: "righe",
      valore: formatNumero(q.righeDaRevisionare),
      etichetta: "Righe da revisionare",
      descrizione: "Dall'ultimo import Excel",
      tono: q.righeDaRevisionare > 0 ? "errore" : "ok",
      quota: q.righeDaRevisionare > 0 ? 100 : 0,
      azione: q.righeDaRevisionare > 0 ? onRigheDaRevisionare : undefined,
      suggerimento: "Apri l'import Excel",
    },
    {
      chiave: "storia",
      // "75%", "96,7%": il decimale solo quando c'è
      valore: `${formatNumero(Math.round(quotaStoria * 10) / 10)}%`,
      etichetta: "Con storia nei volantini",
      descrizione: senzaStoria === 1 ? "1 punto vendita mai nei volantini" : `${formatNumero(senzaStoria)} mai nei volantini`,
      tono: "neutro",
      quota: quotaStoria,
      filtro: filtriDisponibili.senzaStoria && senzaStoria > 0 ? "senzaStoria" : undefined,
      suggerimento: "Mostra i punti vendita mai nei volantini",
    },
    {
      chiave: "dispositivi",
      valore: formatNumero(q.dispositiviOffline),
      etichetta: "Dispositivi offline",
      descrizione: "Display e totem senza segnale",
      tono: q.dispositiviOffline > 0 ? "attenzione" : "ok",
      quota: q.dispositiviOffline > 0 ? 100 : 0,
    },
  ];

  return (
    <div role="group" aria-label="Qualità dei dati" className={GRIGLIA}>
      {tessere.map((t, indice) => {
        const classi = CLASSI_TONO[t.tono];
        const attiva = t.filtro !== undefined && filtroAttivo === t.filtro;
        // Stessa struttura in tutte le tessere: il numero, sotto l'etichetta, poi la descrizione e in
        // fondo la barra. Ognuna occupa tre righe della griglia (subgrid), così fra tessere affiancate
        // numeri, descrizioni e barre restano allineati anche quando un testo va a capo
        const contenuto = (
          <>
            <span className="flex flex-col">
              <span className={twMerge("text-xl font-semibold leading-tight tabular-nums sm:text-2xl", classi.valore)}>{t.valore}</span>
              <span className="text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-200">{t.etichetta}</span>
            </span>
            <span className="block text-2xs text-slate-500 sm:text-xs">{t.descrizione}</span>
            <span aria-hidden="true" className="mt-1 block h-1 self-end overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
              <span className={twMerge("block h-full rounded-full", classi.barra)} style={{ width: `${t.quota}%` }} />
            </span>
          </>
        );
        const classiTessera = twMerge(
          "row-span-3 grid grid-rows-subgrid gap-y-1 rounded-card border border-slate-200 bg-white p-2.5 text-left sm:p-3 dark:border-darkmode-400 dark:bg-darkmode-600",
          attiva && "border-primary ring-1 ring-primary",
          tessere.length % 2 === 1 && indice === tessere.length - 1 && ULTIMA_DISPARI
        );
        const interattiva = "transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:border-darkmode-300";

        if (t.filtro) {
          const filtro = t.filtro;
          return (
            <button
              key={t.chiave}
              type="button"
              aria-pressed={attiva}
              title={attiva ? "Togli il filtro" : t.suggerimento ?? `Mostra solo: ${ETICHETTA_FILTRO_QUALITA[filtro]}`}
              onClick={() => onFiltro(filtro)}
              className={twMerge(classiTessera, interattiva)}
            >
              {contenuto}
            </button>
          );
        }
        if (t.azione) {
          return (
            <button key={t.chiave} type="button" title={t.suggerimento} onClick={t.azione} className={twMerge(classiTessera, interattiva)}>
              {contenuto}
            </button>
          );
        }
        return (
          <div key={t.chiave} className={classiTessera}>
            {contenuto}
          </div>
        );
      })}
    </div>
  );
}

export default QualitaDati;
