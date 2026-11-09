import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { annoDi, dataBreve, GraficoLinee, inizioAnno, msData, taccheTempo } from "@/components/Grafici";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { useViaggioProdotto } from "@/query/flyerInsights";
import { formatData, formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { Link } from "react-router-dom";
import { MAX_TAPPE_VIAGGIO, type TappaProdotto, type ViaggioProdotto as DatiViaggio } from "../../../../lib/insightVolantino/tipi";
import { percorsoDettaglioVolantino } from "../../../../lib/materiali/periodi";
import { ETICHETTA_MECCANICA } from "../../../../lib/puntiVendita/analisi";
import { marcaFormato } from "./box";

/** Prezzo in offerta e prezzo barrato in ogni volantino, su un solo asse in euro, dal più vecchio. */
function PrezzoNelViaggio({ tappe }: { tappe: readonly TappaProdotto[] }) {
  const conPrezzo = [...tappe].filter(t => t.prezzo !== null || t.barrato !== null).sort((a, b) => a.data.localeCompare(b.data));
  if (conPrezzo.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nei volantini in cui compare il prodotto non ha un prezzo stampato.</p>;
  }
  const date = conPrezzo.map(t => msData(t.data));
  const t0 = inizioAnno(annoDi(Math.min(...date)));
  const t1 = inizioAnno(annoDi(Math.max(...date)) + 1);
  return (
    <GraficoLinee
      serie={[
        {
          id: "offerta",
          nome: "Prezzo in offerta",
          tono: "principale",
          punti: conPrezzo.map(t => ({
            x: msData(t.data),
            y: t.prezzo,
            segnalato: t.sottocosto,
            dettagli: [
              { etichetta: "Volantino", valore: t.titolo },
              ...(t.sconto !== null ? [{ etichetta: "Sconto", valore: formatPercentuale(Math.round(t.sconto)) }] : []),
            ],
          })),
        },
        { id: "barrato", nome: "Prezzo barrato", tono: "secondaria", punti: conPrezzo.map(t => ({ x: msData(t.data), y: t.barrato })) },
      ]}
      titolo="Prezzo del prodotto nei volantini"
      descrizioneX="Volantino"
      formattaX={dataBreve}
      formattaY={formatEuro}
      dominioX={[t0, t1]}
      taccheX={taccheTempo(t0, t1).map(t => ({ x: t.centro, etichetta: t.etichetta }))}
      etichettaSegnalati="Sottocosto"
      altezza={200}
    />
  );
}

/** Le tappe, dalla più recente: ognuna apre gli insight del suo volantino alla pagina del prodotto. */
function TappeDelViaggio({ viaggio }: { viaggio: DatiViaggio }) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="Volantini in cui compare il prodotto">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Volantino</Table.Th>
            <Table.Th className="text-right">Pagina</Table.Th>
            <Table.Th className="text-right">Spazio</Table.Th>
            <Table.Th>Meccanica</Table.Th>
            <Table.Th className="text-right">Prezzo</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {viaggio.tappe.map(tappa => (
            <Table.Tr key={tappa.idKit} aria-current={tappa.questoVolantino ? "page" : undefined}>
              <Table.Td className="min-w-48">
                {tappa.questoVolantino ? (
                  <span className="font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-200">{tappa.titolo}</span>
                ) : (
                  <Link
                    to={percorsoDettaglioVolantino(tappa.idKit, tappa.pagina, viaggio.nome)}
                    className="font-medium text-slate-800 [overflow-wrap:anywhere] hover:text-primary hover:underline dark:text-slate-200"
                  >
                    {tappa.titolo}
                  </Link>
                )}
                <div className="text-xs text-slate-500">
                  <span className="block tabular-nums">{formatData(tappa.data)}</span>
                  {/* Le varianti della stessa promo hanno titolo e data uguali: le distinguono area e canale */}
                  <span className="block">{[tappa.canale, tappa.area].filter(Boolean).join(" · ") || VALORE_ASSENTE}</span>
                </div>
                {tappa.questoVolantino && (
                  <Badge variant="primary" size="sm" className="mt-1">
                    Questo volantino
                  </Badge>
                )}
              </Table.Td>
              <Table.Td className="text-right tabular-nums">{tappa.pagina !== null ? formatNumero(tappa.pagina) : "—"}</Table.Td>
              <Table.Td className="text-right tabular-nums">{tappa.spazio !== null ? formatPercentuale(tappa.spazio, 0) : "—"}</Table.Td>
              <Table.Td>
                {tappa.meccanica ? ETICHETTA_MECCANICA[tappa.meccanica] : "—"}
                {tappa.sottocosto && <div className="text-xs text-slate-500">sottocosto</div>}
              </Table.Td>
              <Table.Td className="whitespace-nowrap text-right tabular-nums">
                {tappa.prezzo !== null ? <b className="font-bold">{formatEuro(tappa.prezzo)}</b> : "—"}
                {tappa.barrato !== null && (
                  <s className="ml-1.5 text-xs text-slate-500">
                    <span className="sr-only">invece di </span>
                    {formatEuro(tappa.barrato)}
                  </s>
                )}
                {tappa.sconto !== null && <div className="text-xs text-slate-500">−{formatPercentuale(Math.round(tappa.sconto))}</div>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

export interface ViaggioProdottoProps {
  idKit: string;
  chiave: string;
  /** Torna alla scheda del box. */
  onIndietro?: () => void;
}

/**
 * Il viaggio del prodotto: in quali volantini della stessa GDO compare, con il prezzo nel tempo e
 * l'elenco delle edizioni (dalla più recente, al massimo MAX_TAPPE_VIAGGIO).
 */
export function ViaggioProdotto({ idKit, chiave, onIndietro }: ViaggioProdottoProps) {
  const viaggio = useViaggioProdotto(idKit, chiave);

  const indietro = onIndietro && (
    <div>
      <Button type="button" variant="outline-secondary" size="sm" onClick={onIndietro}>
        <Lucide icon="ChevronLeft" aria-hidden="true" className="mr-1 h-4 w-4" />
        Torna alla scheda
      </Button>
    </div>
  );

  if (viaggio.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {indietro}
        <div role="status" aria-label="Caricamento del viaggio del prodotto" className="flex flex-col gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      </div>
    );
  }
  if (viaggio.isError || !viaggio.data) {
    return (
      <div className="flex flex-col gap-4">
        {indietro}
        <PageError
          compatta
          titolo="Viaggio del prodotto non caricato"
          motivo={viaggio.error?.message || "Non è stato possibile recuperare i volantini del prodotto."}
          onRiprova={() => void viaggio.refetch()}
        />
      </div>
    );
  }

  const dati = viaggio.data;
  const altre = dati.tappe.filter(tappa => !tappa.questoVolantino).length;
  const sottotitolo = marcaFormato(dati);

  return (
    <div className="flex flex-col gap-5">
      {indietro}
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{dati.nome}</p>
        {sottotitolo && <p className="text-sm text-slate-600 dark:text-slate-300">{sottotitolo}</p>}
        {altre > 0 && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Compare in {formatNumero(dati.tappe.length)} volantini della GDO
            {dati.tappe.length >= MAX_TAPPE_VIAGGIO ? `: qui gli ultimi ${formatNumero(MAX_TAPPE_VIAGGIO)}` : ""}.
          </p>
        )}
      </div>
      {altre === 0 ? (
        <EmptyState
          compatta
          icon="Route"
          title="Compare solo in questo volantino"
          description="Negli altri volantini della GDO il prodotto non c'è, oppure non è stato riconosciuto con lo stesso codice o lo stesso nome."
        />
      ) : (
        <>
          <PrezzoNelViaggio tappe={dati.tappe} />
          <TappeDelViaggio viaggio={dati} />
        </>
      )}
    </div>
  );
}

export default ViaggioProdotto;
