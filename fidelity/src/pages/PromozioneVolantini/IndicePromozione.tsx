import Lucide from "@/components/Base/Lucide";
import { portaInVista } from "./PannelliAnalisi";

/** Gli id delle parti dell'assortimento a confronto, per i collegamenti dell'indice. */
export const ID_PRODOTTI_IN_COMUNE = "prodotti-in-comune";
export const ID_TUTTI_I_PRODOTTI = "tutti-i-prodotti";

/** Una voce dell'indice: una parte della pagina, oppure un pannello da aprire. */
export type VoceIndice = { etichetta: string; id: string } | { etichetta: string; pannello: string };

export interface IndicePromozioneProps {
  voci: readonly VoceIndice[];
  /** Apre il pannello e lo porta in vista (PannelliAnalisi, daMostrare). */
  onApriPannello: (chiave: string) => void;
}

/**
 * L'indice della pagina, sotto i filtri (spec volantini-pop, "Dettaglio di consultazione della
 * promozione"): i collegamenti ai prodotti in comune, all'elenco di tutti i prodotti e ai pannelli
 * delle analisi, che altrimenti si trovano solo scorrendo fino in fondo. Il collegamento di un
 * pannello lo apre; ogni parte arriva in vista sotto la barra dei filtri.
 */
export function IndicePromozione({ voci, onApriPannello }: IndicePromozioneProps) {
  if (voci.length === 0) return null;
  return (
    <nav aria-label="In questa pagina" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">In questa pagina</span>
      {voci.map(voce => (
        <button
          key={voce.etichetta}
          type="button"
          onClick={() => ("pannello" in voce ? onApriPannello(voce.pannello) : portaInVista(voce.id))}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-theme-1 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-200 dark:hover:bg-indigo-300/15"
        >
          {voce.etichetta}
          <Lucide icon="ArrowDown" aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ))}
    </nav>
  );
}

export default IndicePromozione;
