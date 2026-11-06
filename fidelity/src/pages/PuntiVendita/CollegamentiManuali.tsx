import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import { useSchermoStretto } from "@/components/PuntiVendita/useSchermoStretto";
import { PERMISSIONS } from "@/constants/permissions";
import { useScollegaCollegamentoManuale } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import type { UseQueryResult } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { CollegamentoManuale, PaginaCollegamentiManuali } from "../../../lib/puntiVendita/analisi";

const DIMENSIONI_PAGINA = [10, 25, 50];

interface CollegamentiManualiProps {
  query: UseQueryResult<PaginaCollegamentiManuali>;
  pagina: number;
  dimensione: number;
  onCambiaPagina: (pagina: number) => void;
  onCambiaDimensione: (dimensione: number) => void;
}

const righeCollegate = (righe: number) => (righe === 1 ? "1 riga" : `${formatNumero(righe)} righe`);

function PuntoVenditaCollegato({ collegamento }: { collegamento: CollegamentoManuale }) {
  const { puntoVendita } = collegamento;
  const indirizzo = [puntoVendita.indirizzo, puntoVendita.citta].filter(Boolean).join(", ");
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        to={`/gestione-interna/punti-vendita/${puntoVendita.id}`}
        className="font-medium text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
      >
        {puntoVendita.nome}
      </Link>
      {indirizzo && <span className="break-words text-xs text-slate-500">{indirizzo}</span>}
    </span>
  );
}

/**
 * "Scollega" chiede conferma nella riga stessa: il collegamento si annulla solo al secondo clic,
 * e le sue righe tornano all'abbinamento automatico.
 */
function Scollega({ collegamento, onScollegato }: { collegamento: CollegamentoManuale; onScollegato: (righe: number) => void }) {
  const scollega = useScollegaCollegamentoManuale();
  const [conferma, setConferma] = useState(false);
  if (!conferma) {
    return (
      <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
        <Button size="sm" variant="outline-secondary" onClick={() => setConferma(true)} aria-label={`Scollega ${collegamento.riga}`}>
          <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
          Scollega
        </Button>
      </PermissionGate>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="danger"
        loading={scollega.isPending}
        disabled={scollega.isPending}
        onClick={() => scollega.mutate(collegamento.id, { onSuccess: esito => onScollegato(esito.righe) })}
      >
        Conferma
      </Button>
      <Button size="sm" variant="outline-secondary" disabled={scollega.isPending} onClick={() => setConferma(false)}>
        Annulla
      </Button>
      {scollega.isError && (
        <span role="alert" className="text-xs text-danger">
          {(scollega.error as Error)?.message || "Non riuscito"}
        </span>
      )}
    </span>
  );
}

/**
 * I collegamenti fatti a mano fra righe dei volantini e punti vendita (contratto in
 * lib/puntiVendita/analisi.ts), dal più recente: com'era stampata la riga, il punto vendita,
 * quante righe collega oggi e quando. Ognuno si può annullare.
 */
export function CollegamentiManuali({ query, pagina, dimensione, onCambiaPagina, onCambiaDimensione }: CollegamentiManualiProps) {
  const stretto = useSchermoStretto();
  const [esito, setEsito] = useState<string | null>(null);
  const collegamenti = query.data?.collegamenti ?? [];
  const totale = query.data?.totale ?? 0;
  const scollegato = (righe: number) =>
    setEsito(`Collegamento annullato: ${righeCollegate(righe)} tornano all'abbinamento automatico.`);

  let contenuto: ReactNode;
  if (query.isLoading) {
    contenuto = (
      <div aria-busy="true" aria-label="Caricamento dei collegamenti" className="flex flex-col gap-3 border-t border-slate-200 p-5 dark:border-darkmode-400">
        {Array.from({ length: 3 }, (_, indice) => (
          <Skeleton key={indice} className="h-4" />
        ))}
      </div>
    );
  } else if (query.isError) {
    contenuto = (
      <div className="px-5 pb-5">
        <PageError
          compatta
          titolo="Collegamenti non caricati"
          motivo={(query.error as Error | null)?.message || "Errore durante il recupero dei collegamenti"}
          onRiprova={() => query.refetch()}
        />
      </div>
    );
  } else if (collegamenti.length === 0) {
    contenuto = (
      <EmptyState
        compatta
        icon="Link"
        title={totale === 0 ? "Nessuna riga collegata a mano" : "Nessun collegamento in questa pagina"}
        description={totale === 0 ? "Le righe collegate da «Collega» compaiono qui." : "I collegamenti sono nelle pagine precedenti."}
      />
    );
  } else if (stretto) {
    contenuto = (
      <ul aria-label="Righe collegate a mano" className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
        {collegamenti.map(collegamento => (
          <li key={collegamento.id} className="px-5 py-3">
            <div className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{collegamento.riga}</div>
            <div className="mt-1 text-sm">
              <PuntoVenditaCollegato collegamento={collegamento} />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {righeCollegate(collegamento.righe)} · {formatData(collegamento.creatoIl)}
            </div>
            <div className="mt-2">
              <Scollega collegamento={collegamento} onScollegato={scollegato} />
            </div>
          </li>
        ))}
      </ul>
    );
  } else {
    contenuto = (
      <div className="overflow-x-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Come era stampato</Table.Th>
              <Table.Th>Punto vendita</Table.Th>
              <Table.Th className="text-right">Righe</Table.Th>
              <Table.Th>Collegata il</Table.Th>
              <Table.Th>
                <span className="sr-only">Azioni</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody className="text-slate-700 dark:text-slate-300">
            {collegamenti.map(collegamento => (
              <Table.Tr key={collegamento.id}>
                <Table.Td className="max-w-md">
                  <div className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{collegamento.riga}</div>
                </Table.Td>
                <Table.Td>
                  <PuntoVenditaCollegato collegamento={collegamento} />
                </Table.Td>
                <Table.Td className="text-right tabular-nums">{formatNumero(collegamento.righe)}</Table.Td>
                <Table.Td className="whitespace-nowrap tabular-nums">{formatData(collegamento.creatoIl)}</Table.Td>
                <Table.Td className="text-right">
                  <Scollega collegamento={collegamento} onScollegato={scollegato} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    );
  }

  return (
    <>
      {esito && (
        <div className="px-5 pb-3">
          <Alert variant="soft-success" icona="CircleCheck" className="px-3 py-2 text-sm" role="status">
            {esito}
          </Alert>
        </div>
      )}
      {contenuto}
      <PaginazioneTabella
        totale={totale}
        pagina={pagina}
        dimensionePagina={dimensione}
        opzioniDimensione={DIMENSIONI_PAGINA}
        onCambiaPagina={onCambiaPagina}
        onCambiaDimensione={onCambiaDimensione}
        unita="collegamenti"
      />
    </>
  );
}

export default CollegamentiManuali;
