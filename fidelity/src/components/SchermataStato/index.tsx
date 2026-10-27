import Lucide from "@/components/Base/Lucide";
import { twMerge } from "@/utils/twMerge";
import clsx from "clsx";
import type { ReactNode } from "react";

const TONI = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
} as const;

interface SchermataStatoProps {
  /** Icona Lucide nella tessera. */
  icona?: string;
  /** Contenuto della tessera al posto dell'icona (per esempio "404"). */
  simbolo?: ReactNode;
  tono?: keyof typeof TONI;
  titolo: string;
  descrizione?: ReactNode;
  /** Pulsanti, centrati sotto il testo: prima il secondario, poi il principale. */
  azioni?: ReactNode;
  /** Riga di aiuto in fondo, in piccolo. */
  nota?: ReactNode;
  /** Fuori dal layout: copre tutta la finestra invece della sola area della pagina. */
  aSchermoIntero?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Schermata di stato a pagina intera (pagina non trovata, accesso negato, rimando esterno):
 * stesso aspetto di PageError a pagina intera, con tessera, titolo di pagina e azioni.
 */
function SchermataStato({
  icona,
  simbolo,
  tono = "primary",
  titolo,
  descrizione,
  azioni,
  nota,
  aSchermoIntero = false,
  className,
  children,
}: SchermataStatoProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "flex items-center justify-center px-6",
          aSchermoIntero
            ? "fixed inset-0 z-[60] bg-slate-100 dark:bg-darkmode-800"
            : "box box--stacked min-h-[calc(100vh-12rem)]"
        ),
        className
      )}
    >
      <div className={clsx("w-full max-w-lg space-y-6 text-center", aSchermoIntero && "box box--stacked p-10")}>
        <div className={clsx("mx-auto flex h-20 w-20 items-center justify-center rounded-card", TONI[tono])}>
          {simbolo ?? (icona && <Lucide icon={icona} aria-hidden="true" className="h-10 w-10" />)}
        </div>
        <div className="space-y-2">
          <h1 className="title-page text-slate-800 dark:text-slate-100">{titolo}</h1>
          {descrizione && <p className="leading-relaxed text-slate-500">{descrizione}</p>}
        </div>
        {children}
        {azioni && <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">{azioni}</div>}
        {nota && <p className="text-xs text-slate-400">{nota}</p>}
      </div>
    </div>
  );
}

export default SchermataStato;
