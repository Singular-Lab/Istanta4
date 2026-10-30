import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import { useSchermoStretto } from "@/components/PuntiVendita/useSchermoStretto";
import { PERMISSIONS } from "@/constants/permissions";
import { useFetchRigheNonAbbinate } from "@/query/query";
import { formatData, formatNumero } from "@/utils/format";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RigaNonAbbinata } from "../../../lib/puntiVendita/analisi";

const DIMENSIONI_PAGINA = [10, 25, 50];

/** "ago 2022": il mese dell'ultimo volantino basta a dire da quanto la riga non compare. */
const meseBreve = (dataIso: string) => {
  const data = dayjs(dataIso);
  return data.isValid() ? data.locale("it").format("MMM YYYY") : dataIso;
};

function Suggerimento({ riga, onAggiungi }: { riga: RigaNonAbbinata; onAggiungi: (riga: RigaNonAbbinata) => void }) {
  const { suggerimento } = riga;
  switch (suggerimento.tipo) {
    case "stesso_telefono":
      return (
        <Link
          to={`/gestione-interna/punti-vendita/${suggerimento.puntoVendita.id}`}
          className="inline-flex max-w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
          title="Apri la gestione del punto vendita con lo stesso telefono"
        >
          <StatusBadge tono="info" icon="Phone" etichetta={`Stesso telefono di ${suggerimento.puntoVendita.nome}`} />
        </Link>
      );
    case "forse_chiuso":
      return <StatusBadge tono="neutral" etichetta="Forse chiuso" />;
    case "da_aggiungere":
      return (
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge tono="warning" etichetta="Da aggiungere?" />
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
            <Button size="sm" variant="outline-secondary" onClick={() => onAggiungi(riga)} aria-label={`Aggiungi ${riga.riga}`}>
              <Lucide icon="Plus" aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              Aggiungi
            </Button>
          </PermissionGate>
        </span>
      );
  }
}

interface RigheNonAbbinateProps {
  /** Colore dell'insegna, lo stesso dell'elenco. */
  coloreDelCanale: (idCanale: string) => string;
  /** Apre "Nuovo punto vendita" con i dati della riga. */
  onAggiungi: (riga: RigaNonAbbinata) => void;
}

/** L'insegna della riga col suo colore, o un trattino. */
function Insegna({ riga, coloreDelCanale }: { riga: RigaNonAbbinata; coloreDelCanale: (idCanale: string) => string }) {
  if (!riga.canale) return <>-</>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: coloreDelCanale(riga.canale.id) }} />
      {riga.canale.nome}
    </span>
  );
}

const periodo = (riga: RigaNonAbbinata) => `Dal ${formatData(riga.primoVolantino)} al ${formatData(riga.ultimoVolantino)}`;

const TITOLO = "Righe dei volantini non abbinate";
const DESCRIZIONE =
  "Punti vendita stampati nei volantini che non corrispondono a nessuno dell'anagrafica: chiusi, trasferiti o da aggiungere.";

/**
 * Righe delle liste dei volantini che non corrispondono a nessun punto vendita dell'anagrafica
 * (contratto in lib/puntiVendita/analisi.ts), paginate dal server: per ognuna come era stampata,
 * l'insegna, in quanti volantini e fino a quando, e un suggerimento (stesso telefono di un PV,
 * forse chiuso, da aggiungere). Senza righe da abbinare il riquadro si riduce a una riga; attesa
 * ed errore stanno fuori dalla tabella, a tutta larghezza; sotto sm ogni riga è una scheda.
 */
export function RigheNonAbbinate({ coloreDelCanale, onAggiungi }: RigheNonAbbinateProps) {
  const [pagina, setPagina] = useState(1);
  const [dimensione, setDimensione] = useState(DIMENSIONI_PAGINA[0]);
  const query = useFetchRigheNonAbbinate(pagina, dimensione);
  const stretto = useSchermoStretto();
  const righe = query.data?.righe ?? [];
  const totale = query.data?.totale ?? 0;

  if (!query.isLoading && !query.isError && totale === 0 && righe.length === 0) {
    return (
      <Sezione compatta aria-label={TITOLO} className="py-3">
        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Lucide icon="ListChecks" aria-hidden="true" className="h-4 w-4 flex-none text-success" />
          Tutte le righe dei volantini sono abbinate
        </p>
      </Sezione>
    );
  }

  let contenuto: ReactNode;
  if (query.isLoading) {
    contenuto = (
      <div aria-busy="true" aria-label="Caricamento delle righe non abbinate" className="flex flex-col gap-3 border-t border-slate-200 p-5 dark:border-darkmode-400">
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
          titolo="Righe non abbinate non caricate"
          motivo={(query.error as Error | null)?.message || "Errore durante il recupero delle righe dei volantini"}
          onRiprova={() => query.refetch()}
        />
      </div>
    );
  } else if (righe.length === 0) {
    // Una pagina oltre l'ultima, per esempio dopo aver abbinato le righe: la paginazione riporta indietro
    contenuto = <EmptyState compatta icon="ListChecks" title="Nessuna riga in questa pagina" description="Le righe da abbinare sono nelle pagine precedenti." />;
  } else if (stretto) {
    contenuto = (
      <ul aria-label={TITOLO} className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
        {righe.map((riga, indice) => (
          <li key={`${riga.riga}-${indice}`} className="px-5 py-3">
            <div className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{riga.riga}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <Insegna riga={riga} coloreDelCanale={coloreDelCanale} />
              <span className="tabular-nums">{riga.volantini === 1 ? "1 volantino" : `${formatNumero(riga.volantini)} volantini`}</span>
              <span className="tabular-nums" title={periodo(riga)}>
                ultima volta {meseBreve(riga.ultimoVolantino)}
              </span>
            </div>
            <div className="mt-2">
              <Suggerimento riga={riga} onAggiungi={onAggiungi} />
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
              <Table.Th>Insegna</Table.Th>
              <Table.Th className="text-right">Volantini</Table.Th>
              <Table.Th>Ultima volta</Table.Th>
              <Table.Th>Suggerimento</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody className="text-slate-700 dark:text-slate-300">
            {righe.map((riga, indice) => (
              <Table.Tr key={`${riga.riga}-${indice}`}>
                <Table.Td className="max-w-md">
                  <div className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{riga.riga}</div>
                </Table.Td>
                <Table.Td>
                  <Insegna riga={riga} coloreDelCanale={coloreDelCanale} />
                </Table.Td>
                <Table.Td className="text-right tabular-nums">{formatNumero(riga.volantini)}</Table.Td>
                <Table.Td className="whitespace-nowrap tabular-nums" title={periodo(riga)}>
                  {meseBreve(riga.ultimoVolantino)}
                </Table.Td>
                <Table.Td>
                  <Suggerimento riga={riga} onAggiungi={onAggiungi} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    );
  }

  return (
    <Sezione senzaPadding titolo={TITOLO} descrizione={DESCRIZIONE}>
      {contenuto}
      <PaginazioneTabella
        totale={totale}
        pagina={pagina}
        dimensionePagina={dimensione}
        opzioniDimensione={DIMENSIONI_PAGINA}
        onCambiaPagina={setPagina}
        onCambiaDimensione={nuova => {
          setDimensione(nuova);
          setPagina(1);
        }}
        unita="righe"
      />
    </Sezione>
  );
}

export default RigheNonAbbinate;
