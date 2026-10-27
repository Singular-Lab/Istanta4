import Lucide from "@/components/Base/Lucide";
import { useId, type HTMLAttributes, type ReactNode } from "react";
import { twMerge } from "@/utils/twMerge";

export interface SezioneProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  titolo?: ReactNode;
  descrizione?: ReactNode;
  /** Azioni della sezione, a destra del titolo (Button size="sm"). */
  azioni?: ReactNode;
  /** Nome dell'icona Lucide prima del titolo. */
  icona?: string;
  /** Padding ridotto, per sezioni piccole o affiancate. */
  compatta?: boolean;
  /** Nessun padding: il contenuto (tabella, BarraFiltri, PaginazioneTabella) arriva ai bordi. */
  senzaPadding?: boolean;
  as?: "section" | "div" | "article" | "aside";
  className?: string;
  children?: ReactNode;
}

/** Classe dell'intestazione: BarraFiltri la usa per non raddoppiare lo spazio subito sotto. */
export const CLASSE_INTESTAZIONE_SEZIONE = "sezione-intestazione";

/**
 * Riquadro di primo livello della pagina (box box--stacked) con intestazione opzionale:
 * titolo h2, descrizione e azioni. Dentro una Sezione non va un'altra Sezione.
 */
function Sezione({
  titolo,
  descrizione,
  azioni,
  icona,
  compatta = false,
  senzaPadding = false,
  as: Elemento = "section",
  className,
  children,
  ...props
}: SezioneProps) {
  const idTitolo = useId();
  const conIntestazione = Boolean(titolo || descrizione || azioni);
  // Una section con titolo diventa una regione con nome per le tecnologie assistive
  const etichettata = Elemento === "section" && Boolean(titolo) && !props["aria-label"] && !props["aria-labelledby"];

  return (
    <Elemento
      aria-labelledby={etichettata ? idTitolo : undefined}
      {...props}
      className={twMerge("box box--stacked", !senzaPadding && (compatta ? "p-4" : "p-5"), className)}
    >
      {conIntestazione && (
        <div
          className={twMerge(
            CLASSE_INTESTAZIONE_SEZIONE,
            "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
            senzaPadding
              ? "p-5"
              : compatta
                ? "mb-4 border-b border-dashed border-slate-200 pb-3"
                : "mb-5 border-b border-dashed border-slate-200 pb-4"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icona && <Lucide icon={icona} aria-hidden="true" className="mt-1 h-5 w-5 flex-none text-slate-500" />}
            <div className="min-w-0">
              {titolo && (
                <h2 id={idTitolo} className="title-section">
                  {titolo}
                </h2>
              )}
              {descrizione && <div className="text-sm text-slate-500">{descrizione}</div>}
            </div>
          </div>
          {azioni && <div className="flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">{azioni}</div>}
        </div>
      )}
      {children}
    </Elemento>
  );
}

export default Sezione;
