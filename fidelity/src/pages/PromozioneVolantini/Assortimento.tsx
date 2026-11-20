import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import { BarraQuota } from "@/components/FlyerInsights/analisi/comuni";
import { BarreAppaiate } from "@/components/FlyerInsights/analisi/BarreAppaiate";
import { BarreImpilate100, SERIE_PRINCIPALE } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { useMemo } from "react";
import type { AssortimentoPromozioneConsultazione, MarcaPromozione } from "../../../lib/consultazione/tipi";
import { meccanicheImpilate } from "./analisi";

/* ---------- Reparti, meccaniche, marche ---------- */

function Reparti({ reparti }: { reparti: AssortimentoPromozioneConsultazione["reparti"] }) {
  return (
    <Sezione titolo="Reparti: referenze e spazio" descrizione="Quota dello spazio di pagina accanto alla quota delle referenze, sommando tutti i volantini.">
      {reparti.length === 0 ? (
        <EmptyState compatta icon="LayoutGrid" title="Reparti non disponibili" description="Le referenze dei volantini non hanno un reparto riconosciuto." />
      ) : (
        <BarreAppaiate
          voci={reparti.map(reparto => ({
            id: reparto.chiave || reparto.etichetta,
            etichetta: reparto.etichetta,
            principale: reparto.quotaSpazio,
            confronto: reparto.quotaReferenze,
          }))}
          titolo="Spazio e referenze per reparto"
          nomePrincipale="Quota di spazio"
          nomeConfronto="Quota di referenze"
          testoEvidenza="più spazio che referenze"
        />
      )}
    </Sezione>
  );
}

function Meccaniche({ perCanale }: { perCanale: AssortimentoPromozioneConsultazione["meccanichePerCanale"] }) {
  const { righe, categorie, valori } = useMemo(() => meccanicheImpilate(perCanale), [perCanale]);
  return (
    <Sezione titolo="Meccaniche per insegna" descrizione="Come si dividono i box di ogni insegna fra le meccaniche.">
      {categorie.length === 0 ? (
        <EmptyState compatta icon="Tags" title="Meccaniche non riconosciute" description="Le referenze dei volantini non dicono con quale meccanica sono promosse." />
      ) : (
        <BarreImpilate100 righe={righe} categorie={categorie} valori={valori} titolo="Meccaniche per insegna" descrizioneValore="Quota dei box" />
      )}
    </Sezione>
  );
}

function Marche({ marche }: { marche: readonly MarcaPromozione[] }) {
  const massimo = Math.max(0, ...marche.map(marca => marca.quotaSpazio));
  return (
    <Sezione titolo="Marche con più spazio" descrizione="Quota dello spazio di pagina di tutti i volantini, con lo sconto medio dei box della marca.">
      {marche.length === 0 ? (
        <EmptyState compatta icon="Award" title="Nessuna marca riconosciuta" description="Le referenze dei volantini non hanno la marca." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Marche con più spazio</caption>
            <thead>
              <tr className="text-2xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th scope="col" className="pb-1.5 pl-1 pr-3 text-left font-medium">
                  Marca
                </th>
                <th scope="col" className="pb-1.5 text-left font-medium">
                  Spazio
                </th>
                <th scope="col" className="whitespace-nowrap pb-1.5 pl-3 pr-1 text-right font-medium">
                  Sconto medio
                </th>
              </tr>
            </thead>
            <tbody>
              {marche.map(marca => (
                <tr key={marca.nome} className="border-t border-slate-100 dark:border-darkmode-400">
                  <th scope="row" className="py-1.5 pl-1 pr-3 text-left font-medium text-slate-700 dark:text-slate-200">
                    <span title={marca.nome} className="block max-w-40 truncate">
                      {marca.nome}
                    </span>
                  </th>
                  <td className="w-full py-1.5">
                    <div className="flex items-center gap-2">
                      <BarraQuota valore={marca.quotaSpazio} massimo={massimo} classe={SERIE_PRINCIPALE.sfondo} />
                      <span className="w-12 flex-none text-right text-2xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {formatPercentuale(marca.quotaSpazio)}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pl-3 pr-1 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {/* Senza box scontati la marca non ha uno sconto medio: lo si dice, invece di "N/D" */}
                    {marca.scontoMedio === null ? <span className="text-slate-400 dark:text-slate-500">nessuno sconto</span> : formatPercentuale(marca.scontoMedio, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sezione>
  );
}

/**
 * Reparti, meccaniche per insegna e marche: i numeri dell'assortimento di tutti i volantini mostrati.
 * Niente box per fascia di sconto (spec volantini-pop). Il confronto dei prodotti fra i volantini sta in
 * ConfrontoAssortimento.
 */
export function Assortimento({ assortimento }: { assortimento: AssortimentoPromozioneConsultazione }) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <Reparti reparti={assortimento.reparti} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <Meccaniche perCanale={assortimento.meccanichePerCanale} />
        <Marche marche={assortimento.marche} />
      </div>
    </div>
  );
}

export default Assortimento;
