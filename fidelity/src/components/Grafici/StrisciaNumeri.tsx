import Skeleton from "@/components/Base/Skeleton";
import { VALORE_ASSENTE } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { ReactNode } from "react";

export interface NumeroStriscia {
  id: string;
  /** Il numero, già formattato; vuoto o null diventa "N/D". */
  valore: ReactNode;
  /** Che cosa conta, sotto il numero ("volantini dal gen 2021"). */
  etichetta: string;
  /** Una riga di contesto ("2 attivi adesso", "+6,9 punti dal 2021"). */
  dettaglio?: ReactNode;
}

export interface StrisciaNumeriProps {
  voci: NumeroStriscia[];
  /** Nome della striscia per le tecnologie assistive ("Il punto vendita in numeri"). */
  titolo: string;
  /** Scheletri al posto dei numeri. */
  loading?: boolean;
  /** Celle da mostrare durante il caricamento. */
  vociAttese?: number;
  /**
   * Una riga sottile senza riquadro, per uno o due numeri dentro un altro riquadro: un riquadro
   * largo quanto la pagina per un numero solo sarebbe quasi vuoto.
   */
  inRiga?: boolean;
  className?: string;
}

const assente = (valore: ReactNode) => valore === null || valore === undefined || valore === "";

// Le celle hanno il bordo a sinistra e sopra; la griglia rientra di 1 px sotto il bordo del
// contenitore, che nasconde quelli della prima colonna e della prima riga
const CONTENITORE = "overflow-hidden rounded-card border border-slate-200 bg-white shadow-card dark:border-darkmode-400 dark:bg-darkmode-600";
const GRIGLIA = "-ml-px -mt-px grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]";
const CELLA = "border-l border-t border-slate-200 px-4 py-3 dark:border-darkmode-400";

/**
 * Striscia di numeri in testa a una pagina di dettaglio: il numero grande, che cosa conta e una riga
 * di contesto, in celle affiancate che vanno a capo sugli schermi stretti.
 */
export function StrisciaNumeri({ voci, titolo, loading = false, vociAttese = 4, inRiga = false, className }: StrisciaNumeriProps) {
  if (inRiga && !loading) {
    // Stesso ordine della striscia (numero, che cosa conta, contesto), su una riga che va a capo
    return (
      <dl aria-label={titolo} className={twMerge("flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm", className)}>
        {voci.map(voce => (
          <div key={voce.id} className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="order-2 text-slate-600 dark:text-slate-300">{voce.etichetta}</dt>
            <dd className="order-1 text-lg font-bold leading-tight tabular-nums text-slate-800 dark:text-slate-100">
              {assente(voce.valore) ? VALORE_ASSENTE : voce.valore}
            </dd>
            {voce.dettaglio && (
              <dd className="order-3 text-xs text-slate-500 dark:text-slate-400">
                <span aria-hidden="true">· </span>
                {voce.dettaglio}
              </dd>
            )}
          </div>
        ))}
      </dl>
    );
  }

  if (loading) {
    return (
      <div role="status" aria-label={`Caricamento: ${titolo}`} className={twMerge(CONTENITORE, className)}>
        <div className={GRIGLIA}>
          {Array.from({ length: vociAttese }, (_, i) => (
            <div key={i} className={CELLA}>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={twMerge(CONTENITORE, className)}>
      <dl aria-label={titolo} className={GRIGLIA}>
        {voci.map(voce => {
          return (
            <div key={voce.id} className={twMerge(CELLA, "flex flex-col")}>
              <dt className="order-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{voce.etichetta}</dt>
              <dd className="order-1 text-2xl font-bold leading-tight text-slate-800 dark:text-slate-100">{assente(voce.valore) ? VALORE_ASSENTE : voce.valore}</dd>
              {voce.dettaglio && <dd className="order-3 mt-1.5 text-xs text-slate-600 dark:text-slate-300">{voce.dettaglio}</dd>}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export default StrisciaNumeri;
