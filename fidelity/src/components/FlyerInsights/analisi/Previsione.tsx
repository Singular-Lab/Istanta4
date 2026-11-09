import Badge from "@/components/Base/Badge";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import EmptyState from "@/components/EmptyState";
import { formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { useMemo } from "react";
import type { Affidabilita, PrevisioneBox, PrevisioneVolantino } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import {
  ETICHETTE_AFFIDABILITA,
  ETICHETTE_TIPO_PREVISIONE,
  scartoPercentuale,
  testoPrevisto,
  testoScarto,
  VARIANTE_AFFIDABILITA,
} from "./affidabilita";
import { Blocco, Nota } from "./comuni";

/**
 * Previsione del volantino per box (spec insight-volantino): dallo storico delle vendite della
 * stessa GDO, area e canale, o, senza vendite, una stima teorica da posizione, spazio e sconto. Il
 * riquadro dice come è fatta, su quante edizioni, quanto è affidabile e, quando la promo ha già le
 * vendite, quanto si è scostata dal reale. Il dettaglio di ogni box sta nella sua scheda.
 */

export interface PrevisioneProps {
  /** null: nessun box con la posizione nella pagina; undefined finché non arriva. */
  previsione: PrevisioneVolantino | null | undefined;
  box: readonly BoxInsight[];
  caricamento?: boolean;
  errore?: string | null;
  onRiprova?: () => void;
}

/** Box con lo scarto più grande fra previsto e reale mostrati. */
export const MASSIMO_SCARTI = 5;

const ORDINE_AFFIDABILITA: readonly Affidabilita[] = ["alta", "media", "bassa"];

/** Quanti box per affidabilità. */
export const conteggioAffidabilita = (perBox: readonly Pick<PrevisioneBox, "affidabilita">[]): Record<Affidabilita, number> => {
  const conteggi: Record<Affidabilita, number> = { alta: 0, media: 0, bassa: 0 };
  for (const voce of perBox) conteggi[voce.affidabilita] += 1;
  return conteggi;
};

/** I box con il reale, dal più lontano dal previsto (in valore assoluto). */
export const boxPiuScostati = (perBox: readonly PrevisioneBox[], massimo = MASSIMO_SCARTI): Array<PrevisioneBox & { scarto: number }> =>
  perBox
    .flatMap(voce => {
      const scarto = scartoPercentuale(voce.valore, voce.reale);
      return scarto === null ? [] : [{ ...voce, scarto }];
    })
    .sort((a, b) => Math.abs(b.scarto) - Math.abs(a.scarto))
    .slice(0, massimo);

export function Previsione({ previsione, box, caricamento = false, errore = null, onRiprova }: PrevisioneProps) {
  const perId = useMemo(() => new Map(box.map(voce => [voce.id, voce])), [box]);
  const conteggi = useMemo(() => conteggioAffidabilita(previsione?.perBox ?? []), [previsione]);
  const scostati = useMemo(() => boxPiuScostati(previsione?.perBox ?? []), [previsione]);

  if (errore) {
    return <PageError compatta titolo="Previsione non caricata" motivo={errore} onRiprova={onRiprova} />;
  }
  if (caricamento || previsione === undefined) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (previsione === null || previsione.perBox.length === 0) {
    return (
      <EmptyState
        compatta
        icon="Gauge"
        title="Previsione non disponibile"
        description="La previsione si fa sui box con la posizione nella pagina: per questo volantino non ci sono."
      />
    );
  }

  const totalePrevisto = previsione.unita === "pezzi" ? previsione.perBox.reduce((somma, voce) => somma + voce.valore, 0) : null;

  return (
    <Blocco
      titolo="Previsione"
      descrizione={
        previsione.promoValida
          ? "La promo è già iniziata: la previsione serve al confronto con le vendite reali."
          : "Cosa aspettarsi dai box del volantino, prima della promo."
      }
      azioni={
        <Badge variant={previsione.tipo === "vendite" ? "info" : "warning"} size="sm">
          {ETICHETTE_TIPO_PREVISIONE[previsione.tipo]}
        </Badge>
      }
    >
      <StatCardGrid className="sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta={previsione.unita === "pezzi" ? "Pezzi previsti" : "Box stimati"}
          valore={totalePrevisto !== null ? testoPrevisto(totalePrevisto, "pezzi") : formatNumero(previsione.perBox.length)}
          icona="Gauge"
          sottotitolo={previsione.unita === "pezzi" ? `su ${formatNumero(previsione.perBox.length)} box` : "indice da 0 a 100 per box"}
        />
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta="Edizioni storiche"
          valore={formatNumero(previsione.edizioniStoriche)}
          icona="CalendarRange"
          sottotitolo="stessa area e canale"
        />
        <StatCard
          densita="compatta"
          tono="neutral"
          etichetta="Affidabilità alta"
          valore={`${formatNumero(conteggi.alta)} box`}
          icona="Target"
          sottotitolo={ORDINE_AFFIDABILITA.filter(livello => livello !== "alta")
            .map(livello => `${formatNumero(conteggi[livello])} ${ETICHETTE_AFFIDABILITA[livello].toLowerCase()}`)
            .join(" · ")}
        />
        {previsione.scartoMedio !== null && (
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Scarto dal reale"
            valore={formatPercentuale(previsione.scartoMedio)}
            icona="Percent"
            sottotitolo="scarto medio assoluto per box"
          />
        )}
      </StatCardGrid>

      {scostati.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="mb-1.5 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Dove il reale si è scostato di più dal previsto</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-2xs uppercase tracking-wide text-slate-500 dark:border-darkmode-400 dark:text-slate-400">
                <th scope="col" className="py-1.5 pl-1 pr-3 font-medium">
                  Box
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Previsto
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Reale
                </th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">
                  Scarto
                </th>
                <th scope="col" className="py-1.5 pl-2 pr-1 text-right font-medium">
                  Affidabilità
                </th>
              </tr>
            </thead>
            <tbody>
              {scostati.map(voce => {
                const datiBox = perId.get(voce.idBox);
                return (
                  <tr key={voce.idBox} className="border-b border-slate-100 last:border-0 dark:border-darkmode-400">
                    <th scope="row" className="py-1.5 pl-1 pr-3 text-left font-medium text-slate-700 dark:text-slate-200">
                      <span className="block max-w-56 truncate" title={datiBox?.nome}>
                        {datiBox?.nome || "Box senza nome"}
                      </span>
                    </th>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                      {testoPrevisto(voce.valore, previsione.unita)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {testoPrevisto(voce.reale, previsione.unita)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{testoScarto(voce.scarto)}</td>
                    <td className="whitespace-nowrap py-1.5 pl-2 pr-1 text-right">
                      <Badge variant={VARIANTE_AFFIDABILITA[voce.affidabilita]} size="sm">
                        {ETICHETTE_AFFIDABILITA[voce.affidabilita]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Nota icona={previsione.tipo === "teorica" ? "TriangleAlert" : "Info"}>
        {previsione.nota} L&apos;affidabilità dipende da quanti casi storici simili ha ogni box: il dettaglio è nella scheda del box e,
        con la mappa di calore sulla misura Previsione, sulle pagine.
      </Nota>
    </Blocco>
  );
}

export default Previsione;
