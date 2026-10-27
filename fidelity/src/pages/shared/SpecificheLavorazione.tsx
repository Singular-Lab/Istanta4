import Skeleton from "@/components/Base/Skeleton";
import type { ReactNode } from "react";
import { twMerge } from "@/utils/twMerge";

interface SpecificheLavorazioneProps {
  /** Il contesto della lavorazione è in caricamento: mostra i segnaposto dei campi. */
  caricamento?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Gruppo dei campi "Specifiche di lavorazione" (contesto della promo), usato nella creazione
 * e nella modifica della promozione.
 */
function SpecificheLavorazione({ caricamento = false, className, children }: SpecificheLavorazioneProps) {
  return (
    <fieldset
      aria-busy={caricamento || undefined}
      className={twMerge("rounded-card border border-slate-200 px-5 pb-4 pt-2 dark:border-darkmode-400", className)}
    >
      <legend className="title-eyebrow px-2">Specifiche di lavorazione</legend>
      {caricamento ? (
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-10 rounded-control" />
          <Skeleton className="h-10 rounded-control" />
          <Skeleton className="h-10 rounded-control" />
        </div>
      ) : (
        children
      )}
    </fieldset>
  );
}

export default SpecificheLavorazione;
