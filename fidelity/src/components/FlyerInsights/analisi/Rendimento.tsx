import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import EmptyState from "@/components/EmptyState";
import { formatEuro, formatPercentuale, periodoValidita } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formattaValore } from "../../../../lib/insightVolantino/calore";
import { SOGLIA_INDICE_SPAZIO, type RendimentoBox, type RendimentoVolantino } from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { BarreAppaiate, type VoceAppaiata } from "./BarreAppaiate";
import { Blocco, MostraTutte, Nota } from "./comuni";

/**
 * Rendimento del volantino dalle vendite importate del cliente (spec vendite-volantino): quanto ha
 * venduto nel periodo della promo, nei punti vendita della stessa area e canale, e quali box rendono
 * più o meno dello spazio che occupano. I numeri arrivano già calcolati dal server
 * (RendimentoVolantino); qui si raggruppano per reparto e si scrivono.
 */

export interface RendimentoProps {
  /** null: nessuna vendita importata nel periodo della promo; undefined finché non arriva. */
  rendimento: RendimentoVolantino | null | undefined;
  /** I box del volantino, per nome, pagina e reparto. */
  box: readonly BoxInsight[];
  caricamento?: boolean;
  errore?: string | null;
  onRiprova?: () => void;
  /** Indirizzo della pagina Vendite, dove si importa il file: se c'è, lo stato vuoto ci porta. */
  percorsoVendite?: string;
}

/** Righe dei box sopra e sotto lo spazio prima di "Mostra tutte". */
export const RIGHE_BOX_RENDIMENTO = 5;

const ETICHETTA_SENZA_REPARTO = "Reparto non noto";

/** Quota delle vendite accanto alla quota dello spazio per reparto, dal reparto che vende di più. */
export const vociRendimentoReparto = (rendimento: RendimentoVolantino, box: readonly BoxInsight[]): VoceAppaiata[] => {
  const perId = new Map(box.map(voce => [voce.id, voce]));
  const gruppi = new Map<string, VoceAppaiata>();
  for (const voce of rendimento.perBox) {
    const reparto = perId.get(voce.idBox)?.reparto ?? null;
    const id = reparto ? reparto.codice || reparto.descrizione : "";
    const etichetta = reparto ? reparto.descrizione || reparto.codice : ETICHETTA_SENZA_REPARTO;
    const gruppo = gruppi.get(id) ?? { id: id || "senza", etichetta, principale: 0, confronto: 0 };
    gruppo.principale += voce.quota;
    gruppo.confronto += voce.quotaSpazio;
    gruppi.set(id, gruppo);
  }
  return [...gruppi.values()]
    .map(voce => ({ ...voce, principale: Math.round(voce.principale * 10) / 10, confronto: Math.round(voce.confronto * 10) / 10 }))
    .sort((a, b) => b.principale - a.principale || a.etichetta.localeCompare(b.etichetta, "it"));
};

/** "€ 12.345,00" o "1.234 pezzi", nella misura principale del file delle vendite. */
export const testoTotaleVendite = (rendimento: Pick<RendimentoVolantino, "misura" | "totaleValore" | "totalePezzi">): string =>
  rendimento.misura === "valore" && rendimento.totaleValore !== null
    ? formatEuro(rendimento.totaleValore)
    : `${formatNumero(rendimento.totalePezzi)} ${rendimento.totalePezzi === 1 ? "pezzo" : "pezzi"}`;

const testoVenditeBox = (voce: RendimentoBox, misura: RendimentoVolantino["misura"]): string =>
  misura === "valore" && voce.valore !== null ? formatEuro(voce.valore) : `${formatNumero(voce.pezzi)} pz`;

const testoIndice = (indice: number | null): string => (indice === null || !Number.isFinite(indice) ? VALORE_ASSENTE : `${formattaValore(indice, "indice")}×`);

interface RigaBox {
  box: BoxInsight | undefined;
  rendimento: RendimentoBox;
}

/** I box che rendono più (o meno) dello spazio: tabella con vendite, quote e indice. */
function TabellaBox({ titolo, righe, misura }: { titolo: string; righe: readonly RigaBox[]; misura: RendimentoVolantino["misura"] }) {
  const [tutte, setTutte] = useState(false);
  const idTabella = useId();
  const visibili = tutte ? righe : righe.slice(0, RIGHE_BOX_RENDIMENTO);
  if (righe.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Nessun box.</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table id={idTabella} className="w-full text-xs">
          <caption className="sr-only">{titolo}</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-2xs uppercase tracking-wide text-slate-500 dark:border-darkmode-400 dark:text-slate-400">
              <th scope="col" className="py-1.5 pl-1 pr-3 font-medium">
                Box
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Vendite
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Quota vendite
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                Quota spazio
              </th>
              <th scope="col" className="py-1.5 pl-2 pr-1 text-right font-medium">
                Indice
              </th>
            </tr>
          </thead>
          <tbody>
            {visibili.map(({ box, rendimento }) => (
              <tr key={rendimento.idBox} className="border-b border-slate-100 last:border-0 dark:border-darkmode-400">
                <th scope="row" className="py-1.5 pl-1 pr-3 text-left font-medium text-slate-700 dark:text-slate-200">
                  <span className="block max-w-56 truncate" title={box?.nome}>
                    {box?.nome || "Box senza nome"}
                  </span>
                  {box && box.pagina !== null && <span className="block font-normal text-slate-500 dark:text-slate-400">pagina {formatNumero(box.pagina)}</span>}
                </th>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{testoVenditeBox(rendimento, misura)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatPercentuale(rendimento.quota)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400">{formatPercentuale(rendimento.quotaSpazio)}</td>
                <td className="whitespace-nowrap py-1.5 pl-2 pr-1 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {testoIndice(rendimento.indiceSpazio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MostraTutte totale={righe.length} aperto={tutte} onCambia={setTutte} iniziali={RIGHE_BOX_RENDIMENTO} controlla={idTabella} />
    </div>
  );
}

export function Rendimento({ rendimento, box, caricamento = false, errore = null, onRiprova, percorsoVendite }: RendimentoProps) {
  const perReparto = useMemo(() => (rendimento ? vociRendimentoReparto(rendimento, box) : []), [rendimento, box]);
  const righe = useMemo(() => {
    if (!rendimento) return { sopra: [], sotto: [] };
    const perBox = new Map(rendimento.perBox.map(voce => [voce.idBox, voce]));
    const perId = new Map(box.map(voce => [voce.id, voce]));
    const riga = (id: string): RigaBox[] => {
      const voce = perBox.get(id);
      return voce ? [{ box: perId.get(id), rendimento: voce }] : [];
    };
    return { sopra: rendimento.sopraSpazio.flatMap(riga), sotto: rendimento.sottoSpazio.flatMap(riga) };
  }, [rendimento, box]);

  if (errore) {
    return <PageError compatta titolo="Rendimento non caricato" motivo={errore} onRiprova={onRiprova} />;
  }
  if (caricamento || rendimento === undefined) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (rendimento === null) {
    return (
      <div className="space-y-3">
        <EmptyState
          compatta
          icon="FileSpreadsheet"
          title="Nessuna vendita importata per il periodo di questa promo"
          description="Importa il file delle vendite del cliente dalla pagina Vendite: il rendimento dei box si calcola sulle vendite dei punti vendita della stessa area e canale nel periodo di validità della promo."
        />
        {percorsoVendite && (
          <p className="text-center">
            <Link to={percorsoVendite} className="text-sm text-primary underline-offset-2 hover:underline">
              Vai alla pagina Vendite
            </Link>
          </p>
        )}
      </div>
    );
  }

  const periodo = periodoValidita(rendimento.periodo.dal, rendimento.periodo.al);
  const boxSenzaVendite = rendimento.perBox.filter(voce => voce.pezzi === 0).length;
  const soglia = formattaValore(SOGLIA_INDICE_SPAZIO, "indice");
  const sogliaInversa = formattaValore(1 / SOGLIA_INDICE_SPAZIO, "indice");

  return (
    <div className="space-y-6">
      <Blocco
        titolo="Rendimento dalle vendite"
        descrizione={`Vendite ${periodo} nei punti vendita della stessa area e canale del volantino.`}
      >
        <StatCardGrid className="sm:grid-cols-3 xl:grid-cols-5">
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Vendite nella promo"
            valore={testoTotaleVendite(rendimento)}
            icona="ShoppingCart"
            sottotitolo={rendimento.misura === "valore" ? `${formatNumero(rendimento.totalePezzi)} pezzi` : "in pezzi: il file non ha il valore"}
          />
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Punti vendita"
            valore={formatNumero(rendimento.puntiVendita)}
            icona="Store"
            sottotitolo="con almeno una vendita"
          />
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Prodotti senza vendite"
            valore={formatNumero(rendimento.prodottiSenzaVendite)}
            icona="PackageX"
            sottotitolo={`su ${formatNumero(rendimento.prodotti)} prodotti`}
          />
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Rendono più dello spazio"
            valore={formatNumero(rendimento.sopraSpazio.length)}
            icona="TrendingUp"
            sottotitolo="box"
          />
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Rendono meno dello spazio"
            valore={formatNumero(rendimento.sottoSpazio.length)}
            icona="TrendingDown"
            sottotitolo={boxSenzaVendite > 0 ? `box, ${formatNumero(boxSenzaVendite)} senza vendite` : "box"}
          />
        </StatCardGrid>
      </Blocco>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Blocco titolo="Rendono più dello spazio" descrizione={`Quota delle vendite almeno ${soglia} volte la quota dello spazio, dal migliore.`}>
          <TabellaBox titolo="Box che rendono più dello spazio che occupano" righe={righe.sopra} misura={rendimento.misura} />
        </Blocco>
        <Blocco titolo="Rendono meno dello spazio" descrizione={`Quota delle vendite al massimo ${sogliaInversa} volte la quota dello spazio, dal peggiore.`}>
          <TabellaBox titolo="Box che rendono meno dello spazio che occupano" righe={righe.sotto} misura={rendimento.misura} />
        </Blocco>
      </div>

      <Blocco titolo="Vendite e spazio per reparto" descrizione="Quota delle vendite accanto alla quota dello spazio del volantino.">
        {perReparto.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nessun box con la posizione nella pagina.</p>
        ) : (
          <BarreAppaiate
            voci={perReparto}
            titolo="Vendite e spazio per reparto"
            nomePrincipale="Quota delle vendite"
            nomeConfronto="Quota dello spazio"
            testoEvidenza="più vendite che spazio"
          />
        )}
      </Blocco>

      <Nota>
        Indice = quota delle vendite ÷ quota dello spazio: 1 vuol dire che il box vende quanto lo spazio che occupa. Le quote sono{" "}
        {rendimento.misura === "valore" ? "sul valore in euro" : "sui pezzi"}, i prodotti di un box contano tutti (pilota compreso).
      </Nota>
    </div>
  );
}

export default Rendimento;
