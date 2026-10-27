import type { ReactNode } from "react";
import { twMerge } from "@/utils/twMerge";

type Variante = "sezione" | "interna" | "libera";

export interface BarraFiltriProps {
  /** Ricerca e filtri, a sinistra (CampoRicerca, FormSelect sm, Segmenti…). */
  children?: ReactNode;
  /** Azioni o filtri secondari, a destra. */
  destra?: ReactNode;
  /**
   * sezione: a filo dentro una Sezione senzaPadding, sopra la tabella (predefinita);
   * interna: in cima a una Sezione con padding; libera: senza spaziature né bordi.
   */
  variante?: Variante;
  className?: string;
}

const VARIANTI: Record<Variante, string> = {
  // Subito sotto l'intestazione della Sezione il suo padding basta: niente spazio doppio
  sezione: "p-5 border-b border-dashed border-slate-200 [.sezione-intestazione+&]:pt-0",
  interna: "pb-5 mb-5 border-b border-dashed border-slate-200",
  libera: "",
};

/** Riga di ricerca e filtri della sezione che filtrano; su mobile gli elementi vanno in colonna. */
function BarraFiltri({ children, destra, variante = "sezione", className }: BarraFiltriProps) {
  return (
    <div
      className={twMerge(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        VARIANTI[variante],
        className
      )}
    >
      {children && <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>}
      {destra && <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">{destra}</div>}
    </div>
  );
}

export default BarraFiltri;
