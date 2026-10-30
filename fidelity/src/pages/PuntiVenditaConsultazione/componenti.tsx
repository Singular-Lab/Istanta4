import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import type { Tinta } from "@/components/Grafici";
import { twMerge } from "@/utils/twMerge";
import { useState, type ReactNode } from "react";
import { urlFotoOlimpo } from "../../../lib/olimpo/url";

/**
 * Pezzi comuni alle pagine del punto vendita (scheda, volantino, referenza): stato di un box che
 * dipende da una query, note sulla copertura dei dati, righe stampate e foto. Il percorso fino alla
 * pagina è nel breadcrumb della barra in alto.
 */

/** Lo stato di una query che serve a un box (UseQueryResult lo soddisfa). */
export interface QueryBox<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Contenuto di un box che dipende da una query: scheletro durante il caricamento, errore con
 * "Riprova", stato vuoto (se `vuoto` restituisce qualcosa), altrimenti i dati.
 */
export function StatoBox<T>({
  query,
  titoloErrore,
  vuoto,
  scheletro,
  children,
}: {
  query: QueryBox<T>;
  titoloErrore: string;
  vuoto?: (dati: T) => ReactNode;
  scheletro?: ReactNode;
  children: (dati: T) => ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div role="status" aria-label="Caricamento" className="flex flex-col gap-3">
        {scheletro ?? (
          <>
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6 w-2/3" />
          </>
        )}
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return (
      <PageError
        compatta
        titolo={titoloErrore}
        motivo={(query.error as Error | null)?.message || "Errore durante il recupero dei dati"}
        onRiprova={() => query.refetch()}
      />
    );
  }
  const statoVuoto = vuoto?.(query.data);
  if (statoVuoto) return <>{statoVuoto}</>;
  return <>{children(query.data)}</>;
}

/** Nota sotto un grafico: da dove viene il dato e quanto è completo. */
export function NotaDato({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={twMerge("mt-4 flex gap-2 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500 dark:border-darkmode-400 dark:text-slate-400", className)}>
      <Lucide icon="Info" aria-hidden="true" className="mt-px h-3.5 w-3.5 flex-none" />
      <span>{children}</span>
    </p>
  );
}

/** Una riga com'era stampata nel volantino, in carattere a spaziatura fissa. */
export function RigaStampata({ children, evidenziata = false, className }: { children: ReactNode; evidenziata?: boolean; className?: string }) {
  return (
    <span
      className={twMerge(
        "inline-block break-words rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-300",
        evidenziata && "border-theme-1 ring-2 ring-theme-1/40 dark:border-indigo-300 dark:ring-indigo-300/40",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Il pallino colorato dell'insegna accanto al suo nome (il nome resta nel colore del testo). */
export function PuntoInsegna({ tinta }: { tinta: Tinta }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="flex-none">
      <circle cx="5" cy="5" r="4.5" fill={tinta.colore} className={tinta.classe} />
    </svg>
  );
}

/** Foto di una referenza dalla miniatura di Olimpo (guid o URL), o un segnaposto. */
export function FotoReferenza({ foto, nome, className }: { foto: string | null | undefined; nome: string; className?: string }) {
  const [rotta, setRotta] = useState(false);
  const classi = twMerge("flex-none overflow-hidden rounded-control bg-slate-100 dark:bg-darkmode-500", className);
  if (!foto || rotta) {
    return (
      <div className={twMerge(classi, "flex items-center justify-center text-slate-400")}>
        <Lucide icon="Package" aria-hidden="true" className="h-1/3 w-1/3" />
      </div>
    );
  }
  return (
    <div className={classi}>
      <img src={urlFotoOlimpo(foto, { performante: true })} alt={nome} loading="lazy" onError={() => setRotta(true)} className="h-full w-full object-contain" />
    </div>
  );
}
