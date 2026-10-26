import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import type { ApiStatistics } from "../../types";

interface ActivityTableProps {
  activities: ApiStatistics['attivita_recente'];
}

function ActivityTable({ activities }: ActivityTableProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Lucide icon="Activity" className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Nessuna attività recente</p>
        <p className="text-xs text-slate-400 mt-1">Le attività verranno visualizzate qui</p>
      </div>
    );
  }

  const getStatusStyle = (code: number) => {
    if (code >= 200 && code < 300) return "text-success bg-success/10";
    if (code >= 400 && code < 500) return "text-warning bg-warning/10";
    if (code >= 500) return "text-danger bg-danger/10";
    return "text-slate-600 bg-slate-100";
  };

  const getMethodStyle = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":    return "text-blue-600 bg-blue-50";
      case "POST":   return "text-emerald-600 bg-emerald-50";
      case "PUT":    return "text-amber-600 bg-amber-50";
      case "PATCH":  return "text-violet-600 bg-violet-50";
      case "DELETE": return "text-red-600 bg-red-50";
      default:       return "text-slate-600 bg-slate-100";
    }
  };

  const getSpeedStyle = (ms: number) => {
    if (ms < 200)  return "text-success";
    if (ms < 1000) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-y border-slate-100">
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">Timestamp</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Endpoint</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">Metodo</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">Status</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">Tempo</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">Ruolo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {activities.map((activity, index) => (
            <tr
              key={index}
              className={clsx(
                "hover:bg-slate-50/80 transition-colors duration-100",
                index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
              )}
            >
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className="text-xs text-slate-500 font-mono">
                  {activity.data} {activity.orario}
                </span>
              </td>
              <td className="px-4 py-2.5 max-w-[220px]">
                <code
                  className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono truncate block"
                  title={activity.endpoint}
                >
                  {activity.endpoint}
                </code>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span
                  className={clsx(
                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono",
                    getMethodStyle(activity.metodo)
                  )}
                >
                  {activity.metodo}
                </span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span
                  className={clsx(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                    getStatusStyle(activity.codice_risposta)
                  )}
                >
                  {activity.codice_risposta}
                </span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className={clsx("text-xs font-semibold font-mono", getSpeedStyle(activity.tempo_risposta_ms))}>
                  {activity.tempo_risposta_ms}ms
                </span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <span className="text-xs text-slate-500">
                  {activity.ruolo_utente || <span className="text-slate-300">—</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ActivityTable;
