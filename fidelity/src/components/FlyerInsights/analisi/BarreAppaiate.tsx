import { Legenda, SERIE_PRINCIPALE, SERIE_SECONDARIA, TINTA_PRINCIPALE, type Tinta } from "@/components/Grafici";
import Lucide from "@/components/Base/Lucide";
import { formatDifferenzaPunti, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { twMerge } from "@/utils/twMerge";
import { useId, useState } from "react";
import { BarraQuota, MostraTutte, RIGHE_INIZIALI, SCARTO_RILEVANTE } from "./comuni";

export interface VoceAppaiata {
  id: string;
  etichetta: string;
  /** Quota della serie principale (spazio, visibilita'), in %. */
  principale: number;
  /** Quota con cui si confronta (referenze, spazio), in %. */
  confronto: number;
}

export interface BarreAppaiateProps {
  voci: VoceAppaiata[];
  /** Didascalia della tabella per le tecnologie assistive. */
  titolo: string;
  nomePrincipale: string;
  nomeConfronto: string;
  /** Cosa vuol dire una voce in evidenza: "più spazio che referenze". */
  testoEvidenza: string;
  /** Righe prima di "Mostra tutte"; predefinite RIGHE_INIZIALI. */
  righeIniziali?: number;
  className?: string;
}

// La seconda serie in grigio: e' il termine di paragone, resta un passo indietro
const TINTA_CONFRONTO: Tinta = { classe: SERIE_SECONDARIA.fill, classeTesto: "fill-white" };

/**
 * Due quote affiancate per voce (per esempio spazio e referenze di un reparto), sulla stessa scala:
 * a colpo d'occhio chi occupa piu' spazio di quante referenze ha. Le voci con la quota principale
 * sopra l'altra di almeno SCARTO_RILEVANTE punti sono evidenziate. E' una tabella vera: righe,
 * intestazioni e valori si leggono anche con le tecnologie assistive.
 */
export function BarreAppaiate({
  voci,
  titolo,
  nomePrincipale,
  nomeConfronto,
  testoEvidenza,
  righeIniziali = RIGHE_INIZIALI,
  className,
}: BarreAppaiateProps) {
  const [tutte, setTutte] = useState(false);
  const idTabella = useId();
  const massimo = Math.max(0, ...voci.flatMap(v => [v.principale, v.confronto]));
  const visibili = tutte ? voci : voci.slice(0, righeIniziali);
  const conEvidenza = voci.some(v => v.principale - v.confronto >= SCARTO_RILEVANTE);

  return (
    <figure className={twMerge("m-0 min-w-0 space-y-2", className)}>
      <Legenda
        voci={[
          { id: "principale", etichetta: nomePrincipale, forma: "quadrato", tinta: TINTA_PRINCIPALE },
          { id: "confronto", etichetta: nomeConfronto, forma: "quadrato", tinta: TINTA_CONFRONTO },
        ]}
      />
      <div className="overflow-x-auto">
        <table id={idTabella} className="w-full text-xs">
          <caption className="sr-only">{titolo}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Voce</th>
              <th scope="col">
                {nomePrincipale} e {nomeConfronto.toLowerCase()}
              </th>
              <th scope="col">Scarto</th>
            </tr>
          </thead>
          <tbody>
            {visibili.map(voce => {
              const scarto = voce.principale - voce.confronto;
              const evidenziata = scarto >= SCARTO_RILEVANTE;
              return (
                <tr
                  key={voce.id}
                  data-evidenziata={evidenziata || undefined}
                  className={twMerge("border-b border-slate-100 last:border-0 dark:border-darkmode-400", evidenziata && "bg-theme-1/5 dark:bg-indigo-300/10")}
                >
                  <th scope="row" className="py-1.5 pl-1 pr-3 text-left font-medium text-slate-700 dark:text-slate-200">
                    {/* Il troncamento sta su un blocco interno: sulle celle max-width non vale in tutti i browser */}
                    <span title={voce.etichetta} className="block max-w-40 truncate">
                      {voce.etichetta}
                    </span>
                  </th>
                  <td className="w-full py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="sr-only">{nomePrincipale}:</span>
                      <BarraQuota valore={voce.principale} massimo={massimo} classe={SERIE_PRINCIPALE.sfondo} />
                      <span className="w-12 flex-none text-right text-2xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatPercentuale(voce.principale)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="sr-only">{nomeConfronto}:</span>
                      <BarraQuota valore={voce.confronto} massimo={massimo} classe={SERIE_SECONDARIA.sfondo} />
                      <span className="w-12 flex-none text-right text-2xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatPercentuale(voce.confronto)}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pl-3 pr-1 text-right tabular-nums">
                    {evidenziata ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-theme-1 dark:text-indigo-300">
                        <Lucide icon="ArrowUp" aria-hidden="true" className="h-3 w-3" />
                        {formatDifferenzaPunti(scarto)}
                        <span className="sr-only">, {testoEvidenza}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">{formatDifferenzaPunti(scarto)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {conEvidenza ? (
          <p className="text-2xs text-slate-500 dark:text-slate-400">
            In evidenza: {testoEvidenza} (almeno {SCARTO_RILEVANTE} punti di scarto).
          </p>
        ) : (
          <span />
        )}
        <MostraTutte totale={voci.length} aperto={tutte} onCambia={setTutte} iniziali={righeIniziali} controlla={idTabella} />
      </div>
    </figure>
  );
}

export default BarreAppaiate;
