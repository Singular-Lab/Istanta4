import PageHeader, { type Indietro } from "@/components/Base/PageHeader";
import type { ReactNode } from "react";
import { twMerge } from "@/utils/twMerge";

export interface PaginaProps {
  titolo: string;
  descrizione?: ReactNode;
  /** Azioni della pagina: prima le secondarie (outline-secondary), per ultima la primaria. */
  azioni?: ReactNode;
  /** Ritorno all'elenco da cui si è arrivati, nelle pagine di dettaglio. */
  indietro?: Indietro;
  /** Badge accanto al titolo, per esempio lo stato. */
  badges?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Struttura comune delle pagine: intestazione e, sotto, le sezioni distanziate in modo uniforme. */
function Pagina({ titolo, descrizione, azioni, indietro, badges, className, children }: PaginaProps) {
  return (
    <div className={twMerge("flex flex-col gap-6", className)}>
      <PageHeader
        title={titolo}
        description={descrizione}
        actions={azioni}
        indietro={indietro}
        badges={badges}
        className="mb-0"
      />
      {children}
    </div>
  );
}

export default Pagina;
