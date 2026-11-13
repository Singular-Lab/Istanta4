import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";

/** Un ruolo che si può scegliere: il valore va nell'indirizzo, il conteggio dice quanti elementi lo hanno. */
export interface VoceRuolo {
  valore: string;
  etichetta: string;
  conteggio: number;
}

export interface SceltaRuoliProps {
  /** Nome del gruppo per le tecnologie assistive, per esempio "Ruolo dei prodotti in comune". */
  etichetta: string;
  voci: readonly VoceRuolo[];
  /** I valori scelti; nessuno vuol dire tutti i ruoli. */
  scelti: readonly string[];
  onCambia: (scelti: string[]) => void;
  /** Cosa contano i numeri, per il suggerimento: ["prodotto", "prodotti"] o ["box", "box"]. */
  unita: readonly [singolare: string, plurale: string];
  className?: string;
}

/** I ruoli scelti nell'indirizzo, separati da virgola (?ruolo=Star,Prima pagina): nessuno vuol dire tutti. */
export const ruoliDaIndirizzo = (valore: string | null | undefined): string[] =>
  [...new Set((valore ?? "").split(",").map(voce => voce.trim()).filter(Boolean))];

/** I ruoli scelti da scrivere nell'indirizzo; null quando non ce n'è nessuno, così il parametro sparisce. */
export const ruoliInIndirizzo = (scelti: readonly string[]): string | null => (scelti.length > 0 ? scelti.join(",") : null);

const CLASSI_PILLOLA =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40";
const PILLOLA_SCELTA = "border-theme-1 bg-theme-1 text-white dark:border-indigo-300 dark:bg-indigo-300 dark:text-slate-900";
const PILLOLA_LIBERA =
  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-200 dark:hover:bg-darkmode-500";

/**
 * Il filtro per ruolo a scelta multipla (spec volantini-pop, "Ruolo e filtri dei prodotti della
 * promozione"; spec insight-volantino, "Elenco delle referenze del volantino"): una pillola per ruolo
 * con il numero dei suoi elementi, che si accende e si spegne; più ruoli scelti valgono in alternativa.
 * "Tutti i ruoli" toglie la scelta. Un ruolo scelto che non è più fra le voci (indirizzo vecchio, filtri
 * cambiati) resta visibile con 0, da togliere.
 */
export function SceltaRuoli({ etichetta, voci, scelti, onCambia, unita, className }: SceltaRuoliProps) {
  const presenti = new Set(voci.map(voce => voce.valore));
  const tutte: VoceRuolo[] = [
    ...voci,
    ...scelti.filter(valore => !presenti.has(valore)).map(valore => ({ valore, etichetta: valore, conteggio: 0 })),
  ];
  const sceltiSet = new Set(scelti);
  const cambia = (valore: string) => onCambia(sceltiSet.has(valore) ? scelti.filter(voce => voce !== valore) : [...scelti, valore]);
  const conteggio = (numero: number) => `${formatNumero(numero)} ${numero === 1 ? unita[0] : unita[1]}`;

  return (
    <div role="group" aria-label={etichetta} className={twMerge("flex flex-wrap items-center gap-1.5", className)}>
      <button type="button" aria-pressed={scelti.length === 0} onClick={() => onCambia([])} className={twMerge(CLASSI_PILLOLA, scelti.length === 0 ? PILLOLA_SCELTA : PILLOLA_LIBERA)}>
        Tutti i ruoli
      </button>
      {tutte.map(voce => {
        const scelta = sceltiSet.has(voce.valore);
        return (
          <button
            key={voce.valore}
            type="button"
            aria-pressed={scelta}
            title={`${voce.etichetta}: ${conteggio(voce.conteggio)}`}
            onClick={() => cambia(voce.valore)}
            className={twMerge(CLASSI_PILLOLA, scelta ? PILLOLA_SCELTA : PILLOLA_LIBERA)}
          >
            {voce.etichetta}
            <span className={twMerge("tabular-nums", scelta ? "text-white/80 dark:text-slate-900/70" : "text-slate-400 dark:text-slate-400")}>{formatNumero(voce.conteggio)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SceltaRuoli;
