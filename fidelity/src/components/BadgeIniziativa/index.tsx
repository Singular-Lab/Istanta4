import { twMerge } from "@/utils/twMerge";

export interface BadgeIniziativaProps {
  /** Codice dell'iniziativa della promo; assente o vuoto: niente badge. */
  codice?: string | null;
  /** Il badge sta su un fondo scuro (vetrina e dettaglio della promozione): colori chiari. */
  suScuro?: boolean;
  className?: string;
}

/**
 * Badge piccolo con il codice dell'iniziativa a cui corrisponde una promozione (per CONAD CNO il valore del
 * nome prima del primo «_»). Il server lo manda solo per i clienti che lo hanno: senza codice non c'è.
 */
export function BadgeIniziativa({ codice, suScuro = false, className }: BadgeIniziativaProps) {
  const testo = codice?.trim();
  if (!testo) return null;
  return (
    <span
      data-testid="badge-iniziativa"
      title={`Codice iniziativa ${testo}`}
      className={twMerge(
        "inline-flex flex-none items-center rounded-control border px-1.5 py-0.5 align-middle text-3xs font-bold leading-none tabular-nums tracking-normal normal-case",
        suScuro
          ? "border-white/30 bg-white/15 text-white"
          : "border-primary/20 bg-primary/5 text-primary dark:border-indigo-300/30 dark:bg-indigo-300/10 dark:text-indigo-200",
        className
      )}
    >
      <span className="sr-only">Iniziativa </span>
      {testo}
    </span>
  );
}

export default BadgeIniziativa;
