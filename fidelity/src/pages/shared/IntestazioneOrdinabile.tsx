import Lucide from "@/components/Base/Lucide";
import type { ReactNode } from "react";
import { twMerge } from "@/utils/twMerge";

export type DirezioneOrdinamento = "asc" | "desc";

/** Valore di aria-sort da mettere sul th della colonna ordinata. */
export const ARIA_SORT: Record<DirezioneOrdinamento, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

interface IntestazioneOrdinabileProps {
  /** Direzione dell'ordinamento se la colonna è quella ordinata, altrimenti assente. */
  direzione?: DirezioneOrdinamento;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Pulsante dentro il Table.Th di una colonna ordinabile: eredita la tipografia dell'intestazione
 * e mostra le frecce di ordinamento. aria-sort resta sul th (vedi ARIA_SORT).
 * Va definito fuori dal componente della pagina: ridefinito a ogni render perderebbe il focus.
 */
function IntestazioneOrdinabile({ direzione, onClick, children, className }: IntestazioneOrdinabileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "group inline-flex select-none items-center gap-1.5 rounded-control uppercase hover:text-slate-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40",
        direzione && "text-slate-700",
        className
      )}
    >
      {children}
      <span aria-hidden="true" className="flex flex-col">
        <Lucide
          icon="ChevronUp"
          className={twMerge(
            "-mb-1 h-3 w-3 transition-colors",
            direzione === "asc" ? "text-slate-800" : "text-slate-400 group-hover:text-slate-600"
          )}
        />
        <Lucide
          icon="ChevronDown"
          className={twMerge(
            "-mt-1 h-3 w-3 transition-colors",
            direzione === "desc" ? "text-slate-800" : "text-slate-400 group-hover:text-slate-600"
          )}
        />
      </span>
    </button>
  );
}

export default IntestazioneOrdinabile;
