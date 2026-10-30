import { twMerge } from "@/utils/twMerge";
import type { StoriaInElenco } from "../../../lib/puntiVendita/analisi";

/** Un tratto di anni consecutivi con la stessa insegna nei volantini. */
export interface PeriodoInsegnaAnni {
  id: string;
  nome: string;
  dal: number;
  al: number;
}

/**
 * Gli anni con la stessa insegna, uniti: "Conad 2021–2023, Conad City 2024–2026". Un anno senza
 * volantini interrompe il tratto.
 */
export const periodiInsegna = (insegnePerAnno: StoriaInElenco["insegnePerAnno"]): PeriodoInsegnaAnni[] => {
  const periodi: PeriodoInsegnaAnni[] = [];
  let precedente: PeriodoInsegnaAnni | null = null;
  for (const { anno, canale } of [...insegnePerAnno].sort((a, b) => a.anno - b.anno)) {
    if (!canale) {
      precedente = null;
      continue;
    }
    if (precedente && precedente.id === canale.id && precedente.al === anno - 1) {
      precedente.al = anno;
    } else {
      precedente = { id: canale.id, nome: canale.nome, dal: anno, al: anno };
      periodi.push(precedente);
    }
  }
  return periodi;
};

/** "Conad 2021–2023 · Conad City 2024–2026", o "mai nei volantini". */
export const testoPeriodiInsegna = (periodi: PeriodoInsegnaAnni[]) =>
  periodi.length === 0
    ? "mai nei volantini"
    : periodi.map(p => `${p.nome} ${p.dal === p.al ? p.dal : `${p.dal}–${p.al}`}`).join(" · ");

interface StrisciaInsegneProps {
  /** Gli anni da mostrare, dal più vecchio: gli stessi per tutte le righe, perché si confrontino. */
  anni: number[];
  storia: StoriaInElenco | undefined;
  /** Colore dell'insegna, lo stesso della mappa, dei filtri e delle infografiche. */
  coloreDelCanale: (idCanale: string) => string;
  className?: string;
}

/**
 * L'insegna con cui il punto vendita compare nei volantini, anno per anno: una cella per anno
 * colorata come l'insegna, grigia negli anni senza volantini. Il testo equivalente sta nel nome
 * della riga che la contiene; qui il title di ogni cella.
 */
export function StrisciaInsegne({ anni, storia, coloreDelCanale, className }: StrisciaInsegneProps) {
  if (anni.length === 0) return null;
  const perAnno = new Map((storia?.insegnePerAnno ?? []).map(voce => [voce.anno, voce.canale]));

  return (
    <div aria-hidden="true" className={twMerge("w-full", className)}>
      <div className="flex gap-0.5">
        {anni.map(anno => {
          const canale = perAnno.get(anno) ?? null;
          return (
            <span
              key={anno}
              title={`${anno}: ${canale ? canale.nome : "nessun volantino"}`}
              className={twMerge("h-3 flex-1 rounded-sm", !canale && "bg-slate-200 dark:bg-darkmode-400")}
              style={canale ? { backgroundColor: coloreDelCanale(canale.id) } : undefined}
            />
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-3xs tabular-nums text-slate-400">
        <span>{anni[0]}</span>
        {anni.length > 1 && <span>{anni[anni.length - 1]}</span>}
      </div>
    </div>
  );
}

export default StrisciaInsegne;
