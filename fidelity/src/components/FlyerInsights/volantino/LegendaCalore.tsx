import { twMerge } from "@/utils/twMerge";
import type { ReactNode } from "react";
import { legendaCalore, MISURE_CALORE, SCALA_CALORE_STANDARD, type MisuraCalore, type UnitaMisura } from "../../../../lib/insightVolantino/calore";
import { gradienteScala, NOMI_UNITA } from "./mappaCalore";

export interface LegendaCaloreProps {
  misura: MisuraCalore;
  unita: UnitaMisura;
  /** Valore più alto della misura fra i box: l'estremo caldo della scala. */
  massimo: number;
  tappe?: readonly string[];
  /** Una frase in più sotto la descrizione: periodo delle vendite, come è fatta la previsione. */
  nota?: ReactNode;
  className?: string;
}

/**
 * Legenda continua della mappa di calore: il gradiente della scala con le tacche di legendaCalore
 * nell'unità della misura, e sotto cosa misura. I colori sono relativi al punto più caldo del
 * volantino, così le pagine si confrontano fra loro.
 */
export function LegendaCalore({ misura, unita, massimo, tappe = SCALA_CALORE_STANDARD, nota, className }: LegendaCaloreProps) {
  const { etichetta, descrizione } = MISURE_CALORE[misura];
  const tacche = legendaCalore(massimo, unita, tappe);
  return (
    <figure aria-label={`Legenda della mappa di calore: ${etichetta}`} className={twMerge("m-0 flex max-w-xl flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{etichetta}</span>
        <span className="text-slate-500 dark:text-slate-400">{NOMI_UNITA[unita]}</span>
      </div>
      <div
        aria-hidden="true"
        data-testid="gradiente-calore"
        className="h-2.5 w-full rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
        style={{ backgroundImage: gradienteScala(tappe) }}
      />
      {tacche.length > 0 && (
        <ul aria-label={`Scala di ${etichetta}`} className="relative h-4 text-2xs tabular-nums text-slate-600 dark:text-slate-300">
          {tacche.map((tacca, i) => (
            <li
              key={tacca.t}
              className={twMerge(
                "absolute top-0 whitespace-nowrap",
                i === 0 ? "translate-x-0" : i === tacche.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
              )}
              style={{ left: `${tacca.t * 100}%` }}
            >
              {tacca.testo}
            </li>
          ))}
        </ul>
      )}
      <figcaption className="text-xs text-slate-500 dark:text-slate-400">
        {descrizione} Dove la pagina resta senza colore il valore è zero o manca; il colore più caldo è il punto più alto di tutto il volantino.
        {nota ? <> {nota}</> : null}
      </figcaption>
    </figure>
  );
}

export default LegendaCalore;
