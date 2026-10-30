import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { CLASSI_TESTO, tintaCategoria, type Tinta } from "./colori";
import { Legenda } from "./Legenda";
import { larghezzaTesto } from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

export interface CategoriaImpilata {
  id: string;
  etichetta: string;
  /** Tinta della categoria; predefinita quella della sua posizione nell'elenco (ordine fisso). */
  tinta?: Tinta;
}

export interface BarreImpilate100Props {
  /** Una barra per riga (per esempio un anno), dall'alto. */
  righe: Array<{ id: string; etichetta: string }>;
  /** Le parti di ogni barra, nell'ordine dei colori: il colore segue la categoria, non la sua quota. */
  categorie: CategoriaImpilata[];
  /** valori[riga][categoria], in percentuale; ogni riga si riporta a 100. */
  valori: number[][];
  /** Nome del grafico per le tecnologie assistive e didascalia della tabella dei dati. */
  titolo: string;
  /** Che cosa misura il valore, nel tooltip ("Spazio di pagina"). */
  descrizioneValore: string;
  formatta?: (valore: number) => string;
  vuoto?: string;
  className?: string;
}

const SPESSORE = 22;
const SPAZIO = 10;
const STACCO = 2;

/**
 * Barre al 100% impilate, una per riga: come si divide il totale fra le categorie e come cambia
 * da una riga all'altra. 2 px di superficie fra le parti, la quota dentro la parte solo se ci sta.
 */
export function BarreImpilate100({
  righe,
  categorie,
  valori,
  titolo,
  descrizioneValore,
  formatta = v => `${formatNumero(v, 0)}%`,
  vuoto = "Nessun dato da mostrare.",
  className,
}: BarreImpilate100Props) {
  const [contenitore, larghezza] = useLarghezza(520);
  const { conTooltip, tooltip } = useTooltip();

  if (righe.length === 0 || categorie.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const tinte = categorie.map((c, k) => c.tinta ?? tintaCategoria(k));
  const colonnaEtichette = Math.min(larghezza * 0.3, Math.max(...righe.map(r => larghezzaTesto(r.etichetta, 12))) + 12);
  const disponibile = Math.max(40, larghezza - colonnaEtichette);
  const altezza = righe.length * (SPESSORE + SPAZIO) - SPAZIO;

  return (
    <figure ref={contenitore} className={twMerge("m-0 min-w-0", className)}>
      <svg role="img" aria-label={titolo} width={larghezza} height={altezza} viewBox={`0 0 ${larghezza} ${altezza}`} className="block h-auto max-w-full">
        {righe.map((riga, i) => {
          const y = i * (SPESSORE + SPAZIO);
          const quote = valori[i] ?? [];
          const totale = quote.reduce((somma, q) => somma + Math.max(0, q || 0), 0);
          const parti = categorie.filter((_, k) => (quote[k] ?? 0) > 0).length;
          const utile = disponibile - STACCO * Math.max(0, parti - 1);
          let x = colonnaEtichette;
          return (
            <g key={riga.id}>
              <text x={colonnaEtichette - 10} y={y + SPESSORE / 2} dominantBaseline="central" textAnchor="end" className={twMerge("text-xs font-medium tabular-nums", CLASSI_TESTO.primario)}>
                {riga.etichetta}
              </text>
              {categorie.map((categoria, k) => {
                const quota = Math.max(0, quote[k] ?? 0);
                if (quota === 0 || totale === 0) return null;
                const w = (quota / totale) * utile;
                const inizio = x;
                x += w + STACCO;
                const testo = formatta(quota);
                const tinta = tinte[k];
                return (
                  <g
                    key={categoria.id}
                    {...conTooltip({ titolo: categoria.etichetta, sottotitolo: riga.etichetta, righe: [{ etichetta: descrizioneValore, valore: testo }] })}
                  >
                    <rect x={inizio} y={y} width={w} height={SPESSORE} rx={3} fill={tinta.colore} className={tinta.classe} />
                    {w >= larghezzaTesto(testo, 11) + 12 && (
                      <text x={inizio + 6} y={y + SPESSORE / 2} dominantBaseline="central" className={twMerge("pointer-events-none text-2xs font-bold tabular-nums", tinta.classeTesto)}>
                        {testo}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <Legenda voci={categorie.map((c, k) => ({ id: c.id, etichetta: c.etichetta, forma: "quadrato", tinta: tinte[k] }))} className="mt-3" />
      <TabellaDati
        titolo={titolo}
        colonne={["", ...categorie.map(c => c.etichetta)]}
        righe={righe.map((riga, i) => [riga.etichetta, ...categorie.map((_, k) => formatta(valori[i]?.[k] ?? 0))])}
      />
      {tooltip}
    </figure>
  );
}

export default BarreImpilate100;
