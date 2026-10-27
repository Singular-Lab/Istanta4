import Badge from "@/components/Base/Badge";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import type { TonoStato } from "@/constants/stati";
import EmptyState from "@/components/EmptyState";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import clsx from "clsx";
import type { ApiStatistics } from "../../types";

interface ActivityTableProps {
  activities: ApiStatistics['attivita_recente'];
}

const NUMERO_COLONNE = 6;

// Tono del codice HTTP: 2xx riuscita, 4xx errore del client, 5xx errore del server
const tonoStatus = (code: number): TonoStato => {
  if (code >= 200 && code < 300) return "success";
  if (code >= 400 && code < 500) return "warning";
  if (code >= 500) return "danger";
  return "neutral";
};

const VARIANTE_METODO: Record<string, "info" | "success" | "warning" | "primary" | "error"> = {
  GET: "info",
  POST: "success",
  PUT: "warning",
  PATCH: "primary",
  DELETE: "error",
};

const getSpeedStyle = (ms: number) => {
  if (ms < 200) return "text-success";
  if (ms < 1000) return "text-warning";
  return "text-danger";
};

function ActivityTable({ activities }: ActivityTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data e ora</Table.Th>
            <Table.Th>Endpoint</Table.Th>
            <Table.Th>Metodo</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th className="text-right">Tempo</Table.Th>
            <Table.Th>Ruolo</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {!activities || activities.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={NUMERO_COLONNE} className="p-0">
                <EmptyState
                  compatta
                  icon="Activity"
                  title="Nessuna attività recente"
                  description="Le attività verranno visualizzate qui"
                />
              </Table.Td>
            </Table.Tr>
          ) : (
            activities.map((activity, index) => (
              <Table.Tr key={index}>
                <Table.Td className="whitespace-nowrap">
                  {/* Data e ora arrivano già formattate dal servizio */}
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {activity.data} {activity.orario}
                  </span>
                </Table.Td>
                <Table.Td className="max-w-56">
                  <code
                    className="block truncate rounded-control bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700"
                    title={activity.endpoint}
                  >
                    {activity.endpoint}
                  </code>
                </Table.Td>
                <Table.Td className="whitespace-nowrap">
                  <Badge variant={VARIANTE_METODO[activity.metodo.toUpperCase()] ?? "secondary"} size="sm" className="font-mono">
                    {activity.metodo}
                  </Badge>
                </Table.Td>
                <Table.Td className="whitespace-nowrap">
                  <StatusBadge tono={tonoStatus(activity.codice_risposta)} etichetta={String(activity.codice_risposta)} />
                </Table.Td>
                <Table.Td className="whitespace-nowrap text-right">
                  <span className={clsx("font-mono text-xs font-semibold tabular-nums", getSpeedStyle(activity.tempo_risposta_ms))}>
                    {formatNumero(activity.tempo_risposta_ms)} ms
                  </span>
                </Table.Td>
                <Table.Td className="whitespace-nowrap text-xs text-slate-500">
                  {activity.ruolo_utente || <span className="text-slate-400">{VALORE_ASSENTE}</span>}
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </div>
  );
}

export default ActivityTable;
