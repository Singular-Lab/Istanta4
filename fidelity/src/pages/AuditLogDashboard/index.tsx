import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import {
  useFetchAuditEventTypes,
  useFetchAuditLogs,
  useFetchAuditSeverities,
  useFetchAuditSummary,
  type AuditLogFilters as FiltersType,
} from "@/query/query";
import { formatNumero } from "@/utils/format";
import { FC, useCallback, useEffect, useState } from "react";
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

const ETICHETTE_RIEPILOGO = ["Totale eventi", "Eventi oggi", "Critici", "Alti"];

const AuditLogDashboard: FC = () => {
  const [filters, setFilters] = useState<FiltersType>(DEFAULT_FILTERS);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Cambia a ogni azzeramento: i filtri ripartono da capo, compreso il testo della ricerca
  const [versioneFiltri, setVersioneFiltri] = useState(0);
  const { showNotification } = useNotification();

  const {
    data: logsData,
    isLoading: logsLoading,
    isError: logsIsError,
    error: logsError,
    refetch: refetchLogs,
  } = useFetchAuditLogs(filters);
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
    setVersioneFiltri((versione) => versione + 1);
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

  const currentPage = filters.page ?? 1;
  const filtriAttivi = Boolean(
    filters.eventType ||
      filters.severity ||
      filters.result ||
      filters.searchTerm ||
      filters.dateFrom ||
      filters.dateTo
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── KPI ── */}
      <StatCardGrid>
        {summaryLoading ? (
          ETICHETTE_RIEPILOGO.map((etichetta) => (
            <StatCard key={etichetta} etichetta={etichetta} valore={null} densita="compatta" loading />
          ))
        ) : summary ? (
          <>
            <StatCard
              etichetta="Totale eventi"
              valore={formatNumero(summary.totalEvents)}
              icona="Activity"
              tono="neutral"
              densita="compatta"
            />
            <StatCard
              etichetta="Eventi oggi"
              valore={formatNumero(summary.totalToday)}
              icona="CalendarDays"
              tono="info"
              densita="compatta"
            />
            <StatCard
              etichetta="Critici"
              valore={formatNumero(summary.criticalCount)}
              icona="OctagonAlert"
              tono={summary.criticalCount > 0 ? "danger" : "neutral"}
              evidenzia={summary.criticalCount > 0}
              pulsa={summary.criticalCount > 0}
              densita="compatta"
            />
            <StatCard
              etichetta="Alti"
              valore={formatNumero(summary.highCount)}
              icona="TriangleAlert"
              tono={summary.highCount > 0 ? "warning" : "neutral"}
              evidenzia={summary.highCount > 0}
              densita="compatta"
            />
          </>
        ) : (
          // Riepilogo non arrivato: lo si dice al posto dei valori, non si nascondono le card
          ETICHETTE_RIEPILOGO.map((etichetta) => (
            <StatCard key={etichetta} etichetta={etichetta} valore={null} densita="compatta" errore="Non disponibile" />
          ))
        )}
      </StatCardGrid>

      {/* ── Registro: filtri, tabella e paginazione ── */}
      <Sezione
        senzaPadding
        titolo="Registro eventi"
        descrizione="Eventi di audit registrati dal sistema"
        azioni={
          <>
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              {!isRefreshing && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
              Aggiorna
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={handleExportCsv}
              loading={isExporting}
            >
              {!isExporting && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
              Esporta CSV
            </Button>
          </>
        }
      >
        <AuditLogFilters
          key={versioneFiltri}
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
          eventTypes={eventTypes ?? []}
          severities={severities ?? []}
        />

        {logsLoading ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" etichetta="Caricamento del registro audit…" />
          </div>
        ) : logsIsError ? (
          <div className="p-5">
            <PageError
              compatta
              titolo="Impossibile caricare il registro audit"
              motivo={(logsError as Error | null)?.message || "Il servizio non ha restituito gli eventi."}
              onRiprova={() => refetchLogs()}
            />
          </div>
        ) : (
          <>
            <AuditLogTable
              items={logsData?.items ?? []}
              sortBy={filters.sortBy ?? "createdat"}
              sortOrder={filters.sortOrder ?? "DESC"}
              onSort={handleSort}
              filtriAttivi={filtriAttivi}
              onAzzeraFiltri={handleReset}
            />
            <PaginazioneTabella
              totale={logsData?.totalItems ?? 0}
              pagina={currentPage}
              dimensionePagina={filters.limit ?? DEFAULT_FILTERS.limit ?? 50}
              onCambiaPagina={(pagina) => handleFilterChange({ page: pagina })}
            />
          </>
        )}
      </Sezione>
    </div>
  );
};

export default AuditLogDashboard;
