import { twMerge } from "@/utils/twMerge";

export interface BadgeIniziativaProps {
  /** Codice dell'iniziativa della promo; assente o vuoto: niente badge. */
  codice?: string | null;
  /** Il badge sta su un fondo scuro (vetrina e dettaglio della promozione): colori chiari. */
  suScuro?: boolean;
  className?: string;
}

/**
 * Badge ben leggibile con il codice dell'iniziativa a cui corrisponde una promozione (per CONAD CNO il valore del
 * nome prima del primo «_»): testo di dimensione normale a contrasto pieno, da mettere per primo nella riga
 * del nome. Il server lo manda solo per i clienti che lo hanno: senza codice non c'è.
 */
export function BadgeIniziativa({ codice, suScuro = false, className }: BadgeIniziativaProps) {
  const testo = codice?.trim();
  if (!testo) return null;
  return (
    <span
      data-testid="badge-iniziativa"
      title={`Codice iniziativa ${testo}`}
      className={twMerge(
        "inline-flex flex-none items-center rounded-control border px-2.5 py-1 align-middle text-sm font-extrabold leading-none tabular-nums tracking-wide normal-case shadow-sm",
        suScuro
          ? "border-white bg-white text-slate-900"
          : "border-primary bg-primary text-white dark:border-indigo-300 dark:bg-indigo-300 dark:text-slate-900",
        className
      )}
    >
      <span className="sr-only">Iniziativa </span>
      {testo}
    </span>
  );
}

export default BadgeIniziativa;
