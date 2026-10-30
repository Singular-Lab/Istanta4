import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { ampiezzaClassi, CLASSI_TESTO, PASSI_SEQUENZIALI, passoSequenziale, tintaSequenziale, TINTA_NEUTRA } from "./colori";
import { Legenda } from "./Legenda";
import { larghezzaTesto } from "./scale";
import { TabellaDati } from "./TabellaDati";
import { useTooltip } from "./Tooltip";
import { useLarghezza } from "./useLarghezza";

export interface AsseHeatmap {
  id: string;
  etichetta: string;
}

export interface HeatmapProps {
  /** Righe (per esempio le meccaniche), dall'alto. */
  righe: AsseHeatmap[];
  /** Colonne (per esempio gli anni), da sinistra. */
  colonne: AsseHeatmap[];
  /** valori[riga][colonna]; null dove il dato manca. */
  valori: Array<Array<number | null>>;
  /** Nome del grafico per le tecnologie assistive e didascalia della tabella dei dati. */
  titolo: string;
  /** Che cosa misura il valore, nel tooltip e in testa alla legenda ("Quota delle referenze"). */
  descrizioneValore: string;
  formatta?: (valore: number) => string;
  /** Fondo scala; predefinito il valore più alto. */
  massimo?: number;
  vuoto?: string;
  className?: string;
}

const ALTEZZA_RIGA = 32;
const ALTEZZA_TESTA = 20;
const LARGHEZZA_MASSIMA_CELLA = 72;

/**
 * Tabella colorata righe × colonne su una scala sequenziale (una tinta, dal chiaro allo scuro),
 * con il valore scritto nelle celle quando c'è spazio, in chiaro o in scuro secondo il fondo.
 * La legenda dice i confini delle classi; il tooltip il valore preciso.
 */
export function Heatmap({
  righe,
  colonne,
  valori,
  titolo,
  descrizioneValore,
  formatta = v => formatNumero(v),
  massimo,
  vuoto = "Nessun dato da mostrare.",
  className,
}: HeatmapProps) {
  const [contenitore, larghezza] = useLarghezza(520);
  const { conTooltip, tooltip } = useTooltip();

  const tutti = valori.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  if (righe.length === 0 || colonne.length === 0 || tutti.length === 0) {
    return <p className={twMerge("text-sm text-slate-500", className)}>{vuoto}</p>;
  }

  const passi = PASSI_SEQUENZIALI.length;
  const ampiezza = ampiezzaClassi(Math.max(massimo ?? 0, ...tutti), passi);
  const colonnaEtichette = Math.min(larghezza * 0.4, Math.max(...righe.map(r => larghezzaTesto(r.etichetta, 12))) + 12);
  const larghezzaCella = Math.min(LARGHEZZA_MASSIMA_CELLA, Math.max(24, (larghezza - colonnaEtichette) / colonne.length));
  const larghezzaTotale = colonnaEtichette + larghezzaCella * colonne.length;
  const altezza = ALTEZZA_TESTA + righe.length * ALTEZZA_RIGA;
  const conValori = larghezzaCella >= 36;

  const vociLegenda = PASSI_SEQUENZIALI.map((tinta, i) => ({
    id: String(i),
    etichetta: i === passi - 1 ? `≥ ${formatta(i * ampiezza)}` : `${formatta(i * ampiezza)}–${formatta((i + 1) * ampiezza)}`,
    forma: "quadrato" as const,
    tinta,
  }));

  return (
    <figure ref={contenitore} className={twMerge("m-0 min-w-0", className)}>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={titolo}
          width={larghezzaTotale}
          height={altezza}
          viewBox={`0 0 ${larghezzaTotale} ${altezza}`}
          className="block overflow-visible"
        >
          {colonne.map((colonna, j) => (
            <text
              key={colonna.id}
              x={colonnaEtichette + j * larghezzaCella + larghezzaCella / 2}
              y={ALTEZZA_TESTA / 2}
              dominantBaseline="central"
              textAnchor="middle"
              className={twMerge("text-2xs font-semibold tabular-nums", CLASSI_TESTO.secondario)}
            >
              {colonna.etichetta}
            </text>
          ))}
          {righe.map((riga, i) => {
            const y = ALTEZZA_TESTA + i * ALTEZZA_RIGA;
            return (
              <g key={riga.id}>
                <text x={colonnaEtichette - 10} y={y + ALTEZZA_RIGA / 2} dominantBaseline="central" textAnchor="end" className={twMerge("text-xs font-medium", CLASSI_TESTO.primario)}>
                  {riga.etichetta}
                </text>
                {colonne.map((colonna, j) => {
                  const valore = valori[i]?.[j] ?? null;
                  const passo = passoSequenziale(valore, ampiezza, passi);
                  const tinta = valore === null ? TINTA_NEUTRA : tintaSequenziale(passo);
                  const x = colonnaEtichette + j * larghezzaCella;
                  return (
                    <g
                      key={colonna.id}
                      data-passo={passo}
                      {...conTooltip({
                        titolo: riga.etichetta,
                        sottotitolo: colonna.etichetta,
                        righe: [{ etichetta: descrizioneValore, valore: valore === null ? "nessun dato" : formatta(valore) }],
                      })}
                    >
                      {/* 2 px di superficie fra le celle */}
                      <rect x={x + 1} y={y + 1} width={larghezzaCella - 2} height={ALTEZZA_RIGA - 2} rx={4} className={tinta.classe} />
                      {conValori && valore !== null && (
                        <text
                          x={x + larghezzaCella / 2}
                          y={y + ALTEZZA_RIGA / 2}
                          dominantBaseline="central"
                          textAnchor="middle"
                          className={twMerge("pointer-events-none text-xs font-semibold tabular-nums", tinta.classeTesto)}
                        >
                          {formatta(valore)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <Legenda titolo={descrizioneValore} voci={vociLegenda} className="mt-2" />
      <TabellaDati
        titolo={titolo}
        colonne={["", ...colonne.map(c => c.etichetta)]}
        righe={righe.map((riga, i) => [riga.etichetta, ...colonne.map((_, j) => {
          const valore = valori[i]?.[j] ?? null;
          return valore === null ? "—" : formatta(valore);
        })])}
      />
      {tooltip}
    </figure>
  );
}

export default Heatmap;
