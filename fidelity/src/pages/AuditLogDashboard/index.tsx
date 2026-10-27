import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagination from "@/components/Base/Pagination";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import {
  useFetchAuditEventTypes,
  useFetchAuditLogs,
  useFetchAuditSeverities,
  useFetchAuditSummary,
  type AuditLogFilters as FiltersType,
} from "@/query/query";
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
      <StatCardGrid>
        {summaryLoading ? (
          <>
            {["Totale eventi", "Eventi oggi", "Critici", "Alti"].map((etichetta) => (
              <StatCard key={etichetta} etichetta={etichetta} valore={null} densita="compatta" loading />
            ))}
          </>
        ) : summary ? (
          <>
            <StatCard
              etichetta="Totale eventi"
              valore={summary.totalEvents.toLocaleString("it-IT")}
              icona="Activity"
              tono="neutral"
              densita="compatta"
            />
            <StatCard
              etichetta="Eventi oggi"
              valore={summary.totalToday.toLocaleString("it-IT")}
              icona="CalendarDays"
              tono="info"
              densita="compatta"
            />
            <StatCard
              etichetta="Critici"
              valore={summary.criticalCount.toLocaleString("it-IT")}
              icona="OctagonAlert"
              tono={summary.criticalCount > 0 ? "danger" : "neutral"}
              evidenzia={summary.criticalCount > 0}
              pulsa={summary.criticalCount > 0}
              densita="compatta"
            />
            <StatCard
              etichetta="Alti"
              valore={summary.highCount.toLocaleString("it-IT")}
              icona="TriangleAlert"
              tono={summary.highCount > 0 ? "warning" : "neutral"}
              evidenzia={summary.highCount > 0}
              densita="compatta"
            />
          </>
        ) : null}
      </StatCardGrid>

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
            <Button
              type="button"
              variant="neutral"
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              {!isRefreshing && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
              Aggiorna
            </Button>
            <Button
              type="button"
              variant="soft-primary"
              onClick={handleExportCsv}
              loading={isExporting}
            >
              {!isExporting && <Lucide icon="Download" aria-hidden="true" className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="box box--stacked p-0 overflow-hidden">
        {logsLoading ? (
          <div role="status" className="p-12 flex flex-col items-center gap-3">
            <Spinner size="lg" decorativo />
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
                aria-label="Pagina precedente"
                title="Pagina precedente"
                onClick={() =>
                  handleFilterChange({ page: Math.max(1, currentPage - 1) })
                }
              >
                <Lucide icon="ChevronLeft" aria-hidden="true" className="w-4 h-4" />
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
                aria-label="Pagina successiva"
                title="Pagina successiva"
                onClick={() =>
                  handleFilterChange({
                    page: Math.min(totalPages, currentPage + 1),
                  })
                }
              >
                <Lucide icon="ChevronRight" aria-hidden="true" className="w-4 h-4" />
              </Pagination.Link>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogDashboard;
