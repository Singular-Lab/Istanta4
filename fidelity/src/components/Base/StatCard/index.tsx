import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import type { TonoStato } from "@/constants/stati";
import { VALORE_ASSENTE } from "@/utils/format";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type Direzione = "su" | "giu" | "stabile";

export interface Variazione {
  /** Testo della variazione, per esempio "+12%" o "3 rispetto a ieri". */
  valore: string;
  direzione: Direzione;
  /** Direzione che indica un miglioramento; predefinita "su". */
  positivoSe?: "su" | "giu";
}

export interface StatCardProps {
  etichetta: string;
  /** Valore principale; se manca mostra "N/D". */
  valore: ReactNode;
  /** Nome dell'icona Lucide. */
  icona?: string;
  tono?: TonoStato;
  sottotitolo?: ReactNode;
  variazione?: Variazione;
  /** Bordo e valore nel colore del tono, per i dati che richiedono attenzione. */
  evidenzia?: boolean;
  /** L'icona pulsa, per un allarme in corso. */
  pulsa?: boolean;
  loading?: boolean;
  /** Il dato non è stato caricato: mostra il motivo al posto del valore. */
  errore?: string;
  densita?: "comoda" | "compatta";
  className?: string;
}

// Stessi colori di StatusBadge: lo stesso tono ha lo stesso aspetto in tutte le pagine
const CLASSI_TONO: Record<TonoStato, { icona: string; bordo: string; valore: string }> = {
  neutral: { icona: "bg-slate-100 text-slate-700", bordo: "border-slate-300", valore: "text-slate-800" },
  info: { icona: "bg-sky-100 text-sky-800", bordo: "border-sky-200", valore: "text-sky-800" },
  brand: { icona: "bg-theme-1/10 text-theme-1", bordo: "border-theme-1/30", valore: "text-theme-1" },
  success: { icona: "bg-teal-100 text-teal-800", bordo: "border-teal-200", valore: "text-teal-800" },
  warning: { icona: "bg-amber-100 text-amber-800", bordo: "border-amber-200", valore: "text-amber-800" },
  danger: { icona: "bg-red-100 text-red-700", bordo: "border-red-200", valore: "text-red-700" },
};

const DENSITA = {
  comoda: {
    contenitore: "box rounded-card shadow-card p-5",
    valore: "text-2xl",
    scheletro: "h-8 w-24",
    icona: "h-10 w-10",
    simbolo: "h-5 w-5",
  },
  compatta: {
    contenitore: "rounded-control border border-slate-200 bg-white px-4 py-3",
    valore: "text-xl",
    scheletro: "h-7 w-20",
    icona: "h-8 w-8",
    simbolo: "h-4 w-4",
  },
} as const;

const DIREZIONI: Record<Direzione, { icona: string; testo: string }> = {
  su: { icona: "TrendingUp", testo: "In aumento" },
  giu: { icona: "TrendingDown", testo: "In diminuzione" },
  stabile: { icona: "Minus", testo: "Stabile" },
};

const classeVariazione = ({ direzione, positivoSe = "su" }: Variazione) => {
  if (direzione === "stabile") return "text-slate-500";
  return direzione === positivoSe ? "text-success" : "text-danger";
};

/** Indicatore numerico di una dashboard: etichetta, valore e, se serve, variazione e icona. */
function StatCard({
  etichetta,
  valore,
  icona,
  tono = "brand",
  sottotitolo,
  variazione,
  evidenzia = false,
  pulsa = false,
  loading = false,
  errore,
  densita = "comoda",
  className,
}: StatCardProps) {
  const classi = CLASSI_TONO[tono];
  const misure = DENSITA[densita];
  const assente = Boolean(errore) || valore === null || valore === undefined || valore === "";

  return (
    <div
      data-tono={tono}
      aria-busy={loading || undefined}
      className={twMerge(misure.contenitore, evidenzia && classi.bordo, className)}
    >
      <div className="flex items-start justify-between gap-3">
        <dl className="min-w-0 flex-1">
          <dt title={etichetta} className="truncate text-2xs font-medium uppercase tracking-wide text-slate-500">
            {etichetta}
          </dt>
          <dd
            className={twMerge(
              "mt-1 truncate font-bold leading-tight tabular-nums text-slate-800",
              misure.valore,
              evidenzia && !assente && classi.valore
            )}
          >
            {loading ? (
              <>
                <Skeleton className={misure.scheletro} />
                <span className="sr-only">Caricamento…</span>
              </>
            ) : assente ? (
              VALORE_ASSENTE
            ) : (
              valore
            )}
          </dd>
          {!loading && errore && (
            <dd className="mt-1 flex items-center gap-1 text-xs text-danger">
              <Lucide icon="TriangleAlert" aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
              <span className="truncate">{errore}</span>
            </dd>
          )}
          {!loading && !errore && variazione && (
            <dd
              data-direzione={variazione.direzione}
              className={twMerge("mt-1 flex items-center gap-1 text-xs font-medium", classeVariazione(variazione))}
            >
              <Lucide icon={DIREZIONI[variazione.direzione].icona} aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
              <span className="sr-only">{DIREZIONI[variazione.direzione].testo}:</span>
              <span className="truncate">{variazione.valore}</span>
            </dd>
          )}
          {!loading && sottotitolo && <dd className="mt-1 truncate text-xs text-slate-500">{sottotitolo}</dd>}
        </dl>
        {icona && (
          <div
            aria-hidden="true"
            className={twMerge(
              "flex flex-none items-center justify-center rounded-control",
              misure.icona,
              classi.icona,
              pulsa && "motion-safe:animate-pulse"
            )}
          >
            <Lucide icon={icona} className={misure.simbolo} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Griglia delle StatCard: due colonne su mobile, quattro da desktop. */
export function StatCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={twMerge("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}

export default StatCard;
