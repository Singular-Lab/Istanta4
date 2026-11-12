import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import { BarraQuota } from "@/components/FlyerInsights/analisi/comuni";
import { BarreAppaiate } from "@/components/FlyerInsights/analisi/BarreAppaiate";
import { BarreImpilate100, SERIE_PRINCIPALE, TabellaDati, taccheTonde } from "@/components/Grafici";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo } from "react";
import type { FasciaSconto } from "../../../lib/insightVolantino/tipi";
import type { AssortimentoPromozioneConsultazione, MarcaPromozione } from "../../../lib/consultazione/tipi";
import { etichettaFascia, meccanicheImpilate, plurale } from "./analisi";

/* ---------- Quanto è profondo lo sconto ---------- */

/**
 * Colonne dei box per fascia di sconto, con il numero sopra ogni colonna e l'asse a tacche tonde:
 * sono poche fasce e il numero si legge senza passare sul grafico. In scala: la tacca più alta è
 * almeno il massimo, e sopra c'è lo spazio per il numero della colonna più alta.
 */
function ColonneFasce({ fasce }: { fasce: readonly FasciaSconto[] }) {
  const massimo = Math.max(0, ...fasce.map(fascia => fascia.box));
  const tacche = taccheTonde(0, massimo, 4);
  const fondoScala = tacche[tacche.length - 1] || 1;
  const altezza = (valore: number) => `${(valore / fondoScala) * 100}%`;
  const descrizione = fasce.map(fascia => `${etichettaFascia(fascia)}: ${plurale(fascia.box, "box", "box")}`).join(", ");

  return (
    <figure className="m-0 min-w-0">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
        {/* Asse verticale: le etichette sulle stesse altezze delle righe della griglia */}
        <div aria-hidden="true" className="relative h-44">
          <div className="absolute inset-x-0 bottom-0 top-5">
            {tacche.map(tacca => (
              <span
                key={tacca}
                style={{ bottom: altezza(tacca) }}
                className="absolute right-0 translate-y-1/2 text-3xs tabular-nums text-slate-500 dark:text-slate-400"
              >
                {formatNumero(tacca)}
              </span>
            ))}
          </div>
        </div>
        <div role="img" aria-label={`Box per fascia di sconto: ${descrizione}`} className="relative h-44 border-b border-slate-300 dark:border-darkmode-300">
          <div className="absolute inset-x-0 bottom-0 top-5">
            {tacche.slice(1).map(tacca => (
              <span
                key={tacca}
                aria-hidden="true"
                style={{ bottom: altezza(tacca) }}
                className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-darkmode-400"
              />
            ))}
            <div className="absolute inset-0 grid auto-cols-fr grid-flow-col items-end gap-2.5 sm:gap-4">
              {fasce.map(fascia => (
                <div key={fascia.da} className="relative flex h-full items-end justify-center">
                  <div
                    style={{ height: altezza(fascia.box) }}
                    className={twMerge("relative w-full max-w-12 rounded-t", SERIE_PRINCIPALE.sfondo, fascia.box > 0 && "min-h-[2px]")}
                  >
                    <span className="absolute inset-x-0 bottom-full mb-1 text-center text-2xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {formatNumero(fascia.box)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div />
        <div aria-hidden="true" className="mt-1.5 grid auto-cols-fr grid-flow-col gap-2.5 text-center text-3xs tabular-nums text-slate-500 sm:gap-4 dark:text-slate-400">
          {fasce.map(fascia => (
            <span key={fascia.da}>{etichettaFascia(fascia)}</span>
          ))}
        </div>
      </div>
      <TabellaDati titolo="Box per fascia di sconto" colonne={["Fascia di sconto", "Box"]} righe={fasce.map(fascia => [etichettaFascia(fascia), formatNumero(fascia.box)])} />
    </figure>
  );
}

function ProfonditaSconto({ fasce }: { fasce: readonly FasciaSconto[] }) {
  const conSconto = fasce.reduce((somma, fascia) => somma + fascia.box, 0);
  return (
    <Sezione titolo="Quanto è profondo lo sconto" descrizione="I box di tutti i volantini per fascia di sconto.">
      {conSconto === 0 ? (
        <EmptyState compatta icon="Percent" title="Nessuno sconto calcolabile" description="Nessun box dei volantini ha un prezzo barrato o uno sconto stampato." />
      ) : (
        <ColonneFasce fasce={fasce} />
      )}
    </Sezione>
  );
}

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
                    {formatPercentuale(marca.scontoMedio, 0)}
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
 * L'assortimento della promozione sommando tutti i kit: prodotti comuni o locali, profondità dello
 * sconto, reparti, meccaniche per insegna e marche. In due colonne sugli schermi larghi.
 */
/**
 * Quanto è profondo lo sconto, reparti, meccaniche per insegna e marche: i numeri dell'assortimento di
 * tutti i volantini mostrati. Il confronto dei prodotti fra i volantini sta in ConfrontoAssortimento.
 */
export function Assortimento({ assortimento }: { assortimento: AssortimentoPromozioneConsultazione }) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <ProfonditaSconto fasce={assortimento.fasceSconto} />
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
