import Lucide from "@/components/Base/Lucide";
import Pagination from "@/components/Base/Pagination";
import Skeleton from "@/components/Base/Skeleton";
import {
  useFetchAuditEventTypes,
  useFetchAuditLogs,
  useFetchAuditSeverities,
  useFetchAuditSummary,
  type AuditLogFilters as FiltersType,
} from "@/query/query";
import clsx from "clsx";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import { useNotification } from "../../context/NotificationContext";
import AuditLogFilters from "./AuditLogFilters";
import AuditLogTable from "./AuditLogTable";

const DEFAULT_FILTERS: FiltersType = {
  page: 1,
  limit: 50,
  sortBy: "createdat",
  sortOrder: "DESC",
};

const AuditLogDashboard: FC = () => {
  const [filters, setFilters] = useState<FiltersType>(DEFAULT_FILTERS);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showNotification } = useNotification();

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } =
    useFetchAuditLogs(filters);
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } =
    useFetchAuditSummary();
  const { data: eventTypes, refetch: refetchEventTypes } = useFetchAuditEventTypes();
  const { data: severities, refetch: refetchSeverities } = useFetchAuditSeverities();

  const handleFilterChange = useCallback(
    (partial: Partial<FiltersType>) => {
      setFilters((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleSort = useCallback((field: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder:
        prev.sortBy === field && prev.sortOrder === "DESC" ? "ASC" : "DESC",
      page: 1,
    }));
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const refreshResults = await Promise.all([
        refetchLogs(),
        refetchSummary(),
        refetchEventTypes(),
        refetchSeverities(),
      ]);

      if (refreshResults.some((result) => result.isError)) {
        showNotification("Errore durante l'aggiornamento dei dati audit", {
          variant: "error",
        });
      }
    } catch {
      showNotification("Errore durante l'aggiornamento dei dati audit", {
        variant: "error",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [
    refetchLogs,
    refetchSummary,
    refetchEventTypes,
    refetchSeverities,
    showNotification,
  ]);

  // Snap page back if beyond total pages
  useEffect(() => {
    if (
      logsData &&
      logsData.totalPages > 0 &&
      (filters.page ?? 1) > logsData.totalPages
    ) {
      setFilters((prev) => ({ ...prev, page: logsData.totalPages }));
    }
  }, [logsData, filters.page]);

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== "" &&
          value !== null &&
          key !== "page" &&
          key !== "limit"
        ) {
          params.append(key, String(value));
        }
      });
      const qs = params.toString();
      const url = `${ServerCall.getUrl()}/audit-log/export/csv${qs ? `?${qs}` : ""}`;
      const csfrToken = ServerCall.getCSRFToken()
      const response = await fetch(url, { credentials: "include", headers: { "x-csrf-token": csfrToken ?? "" } });
      if (!response.ok) {
        showNotification("Errore durante l'esportazione del CSV", { variant: "error" });
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      showNotification("Errore durante l'esportazione del CSV", { variant: "error" });
    } finally {
      setIsExporting(false);
    }
  }, [filters, showNotification]);

  const totalPages = logsData?.totalPages ?? 0;
  const currentPage = filters.page ?? 1;

  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return [];
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [totalPages, currentPage]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-4 bg-white"
              >
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            ))}
          </>
        ) : summary ? (
          <>
            <SummaryCard
              label="Totale eventi"
              value={summary.totalEvents}
              icon="Activity"
              tone="slate"
            />
            <SummaryCard
              label="Eventi oggi"
              value={summary.totalToday}
              icon="CalendarDays"
              tone="blue"
            />
            <SummaryCard
              label="Critici"
              value={summary.criticalCount}
              icon="OctagonAlert"
              tone={summary.criticalCount > 0 ? "red" : "slate"}
              pulse={summary.criticalCount > 0}
            />
            <SummaryCard
              label="Alti"
              value={summary.highCount}
              icon="TriangleAlert"
              tone={summary.highCount > 0 ? "amber" : "slate"}
            />
          </>
        ) : null}
      </div>

      {/* ── Filters + Export ── */}
      <div className="box box--stacked p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <AuditLogFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            eventTypes={eventTypes ?? []}
            severities={severities ?? []}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isRefreshing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin flex-none" />
                  Aggiornamento...
                </>
              ) : (
                <>
                  <Lucide icon="RefreshCw" className="w-4 h-4" />
                  Aggiorna
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="h-9 px-4 rounded-lg bg-theme-1/10 text-theme-1 text-sm font-medium hover:bg-theme-1/20 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-theme-1/30 border-t-theme-1 animate-spin flex-none" />
                  Esportazione...
                </>
              ) : (
                <>
                  <Lucide icon="Download" className="w-4 h-4" />
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="box box--stacked p-0 overflow-hidden">
        {logsLoading ? (
          <div className="p-12 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-slate-200" />
              <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-theme-1 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              Caricamento audit log...
            </p>
          </div>
        ) : (
          <AuditLogTable
            items={logsData?.items ?? []}
            sortBy={filters.sortBy ?? "createdat"}
            sortOrder={filters.sortOrder ?? "DESC"}
            onSort={handleSort}
          />
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Pagina{" "}
              <span className="font-semibold text-slate-700">
                {currentPage}
              </span>{" "}
              di{" "}
              <span className="font-semibold text-slate-700">
                {totalPages}
              </span>{" "}
              —{" "}
              <span className="font-semibold text-slate-700">
                {logsData?.totalItems ?? 0}
              </span>{" "}
              risultati
            </span>
            <Pagination>
              <Pagination.Link
                onClick={() =>
                  handleFilterChange({ page: Math.max(1, currentPage - 1) })
                }
              >
                <Lucide icon="ChevronLeft" className="w-4 h-4" />
              </Pagination.Link>
              {pageNumbers[0] > 1 && (
                <>
                  <Pagination.Link
                    onClick={() => handleFilterChange({ page: 1 })}
                  >
                    1
                  </Pagination.Link>
                  {pageNumbers[0] > 2 && (
                    <span className="px-1 text-slate-400 text-xs self-end pb-1.5">
                      ...
                    </span>
                  )}
                </>
              )}
              {pageNumbers.map((p) => (
                <Pagination.Link
                  key={p}
                  active={p === currentPage}
                  onClick={() => handleFilterChange({ page: p })}
                >
                  {p}
                </Pagination.Link>
              ))}
              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <>
                  {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                    <span className="px-1 text-slate-400 text-xs self-end pb-1.5">
                      ...
                    </span>
                  )}
                  <Pagination.Link
                    onClick={() => handleFilterChange({ page: totalPages })}
                  >
                    {totalPages}
                  </Pagination.Link>
                </>
              )}
              <Pagination.Link
                onClick={() =>
                  handleFilterChange({
                    page: Math.min(totalPages, currentPage + 1),
                  })
                }
              >
                <Lucide icon="ChevronRight" className="w-4 h-4" />
              </Pagination.Link>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Summary card (internal) ──

interface SummaryCardProps {
  label: string;
  value: number;
  icon: string;
  tone?: "slate" | "blue" | "red" | "amber" | "green";
  pulse?: boolean;
}

const TONE_STYLES: Record<
  string,
  { border: string; iconBg: string; iconText: string; valueBg: string }
> = {
  slate: {
    border: "border-slate-200",
    iconBg: "bg-slate-100",
    iconText: "text-slate-500",
    valueBg: "",
  },
  blue: {
    border: "border-blue-200",
    iconBg: "bg-blue-50",
    iconText: "text-blue-500",
    valueBg: "",
  },
  red: {
    border: "border-red-200",
    iconBg: "bg-red-50",
    iconText: "text-red-500",
    valueBg: "text-red-600",
  },
  amber: {
    border: "border-amber-200",
    iconBg: "bg-amber-50",
    iconText: "text-amber-500",
    valueBg: "text-amber-600",
  },
  green: {
    border: "border-emerald-200",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-500",
    valueBg: "",
  },
};

const SummaryCard: FC<SummaryCardProps> = ({
  label,
  value,
  icon,
  tone = "slate",
  pulse = false,
}) => {
  const t = TONE_STYLES[tone] ?? TONE_STYLES.slate;
  return (
    <div
      className={clsx(
        "flex items-center gap-4 rounded-xl border px-5 py-4 bg-white transition-shadow hover:shadow-sm",
        t.border
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-xl flex-none",
          t.iconBg,
          pulse && "animate-pulse"
        )}
      >
        <Lucide icon={icon} className={clsx("w-5 h-5", t.iconText)} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <span
          className={clsx(
            "text-2xl font-bold tabular-nums mt-0.5",
            t.valueBg || "text-slate-800"
          )}
        >
          {value.toLocaleString("it-IT")}
        </span>
      </div>
    </div>
  );
};

export default AuditLogDashboard;
