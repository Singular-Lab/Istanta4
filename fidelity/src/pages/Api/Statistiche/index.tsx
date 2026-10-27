import androidSVG from "@/assets/images/icons/android.svg";
import appleSVG from "@/assets/images/icons/apple.svg";
import consoleSVG from "@/assets/images/icons/console.svg";
import linuxSVG from "@/assets/images/icons/linux.svg";
import unknownSVG from "@/assets/images/icons/unknown.svg";
import windowsSVG from "@/assets/images/icons/windows.svg";
import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { formatNumero, valoreOAssente } from "@/utils/format";
import clsx from "clsx";
import { useMemo } from "react";
import ActivityTable from "../../GestioneApi/components/statistics/ActivityTable";
import ExportButton from "../../GestioneApi/components/statistics/ExportButton";
import { useStatistics } from "../../GestioneApi/hooks/useStatistics";
import type { ApiStatistics } from "../../GestioneApi/types";
import { createChartOptions, createEndpointChartData, createSuccessRateChartData, createTemporalChartData } from "../../GestioneApi/utils/chartHelpers";

function formatMs(value: number) {
  return `${formatNumero(Math.round(value))} ms`;
}

function formatPercent(value: number) {
  return `${formatNumero(value, 1)}%`;
}

function safeRate(partial: number, total: number) {
  if (total <= 0) return 0;
  return (partial / total) * 100;
}

const ETICHETTE_KPI = ["Richieste totali", "Tasso di successo", "Errori", "Tempo medio", "Richieste oggi", "Endpoint leader"];

function StatistichePage() {
  const {
    stats,
    statsLoading,
    statsError,
    refetchStats
  } = useStatistics();

  return (
    <Pagina
      titolo="Statistiche API"
      descrizione="Monitora le performance e l'utilizzo delle API esterne"
      badges={stats && (
        <StatusBadge
          tono={stats.crescita_settimanale_percentuale >= 0 ? "success" : "danger"}
          icon={stats.crescita_settimanale_percentuale >= 0 ? "TrendingUp" : "TrendingDown"}
          etichetta={`${stats.crescita_settimanale_percentuale >= 0 ? "+" : ""}${formatPercent(stats.crescita_settimanale_percentuale)} settimana`}
        />
      )}
      azioni={
        <>
          {stats && stats.attivita_recente && (
            <ExportButton aggregate={stats} details={stats.attivita_recente} />
          )}
          <Button
            variant="outline-secondary"
            onClick={() => { void refetchStats(); }}
            loading={statsLoading}
          >
            {!statsLoading && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
            Aggiorna
          </Button>
        </>
      }
    >
      {statsLoading ? (
        <LoadingSkeleton />
      ) : statsError ? (
        <PageError
          titolo="Errore nel caricamento"
          motivo="Non è stato possibile caricare le statistiche API"
          onRiprova={() => { void refetchStats(); }}
        />
      ) : stats ? (
        <StatsContent stats={stats} />
      ) : (
        <Sezione>
          <EmptyState
            compatta
            icon="Database"
            title="Nessun dato disponibile"
            description="Le statistiche API verranno visualizzate qui quando disponibili"
          />
        </Sezione>
      )}
    </Pagina>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <StatCardGrid className="lg:grid-cols-3 2xl:grid-cols-6">
        {ETICHETTE_KPI.map((etichetta) => (
          <StatCard key={etichetta} etichetta={etichetta} valore={null} densita="compatta" loading />
        ))}
      </StatCardGrid>
      <div className="grid grid-cols-12 gap-6">
        <Sezione as="div" className="col-span-12 xl:col-span-8">
          <Skeleton className="mb-4 h-4 w-1/4" />
          <Skeleton className="h-64" />
        </Sezione>
        <Sezione as="div" className="col-span-12 xl:col-span-4">
          <Skeleton className="mb-4 h-4 w-1/3" />
          <Skeleton className="h-64" />
        </Sezione>
      </div>
      <Sezione as="div">
        <Skeleton className="mb-4 h-4 w-1/4" />
        <Skeleton className="h-52" />
      </Sezione>
    </>
  );
}

function StatsContent({ stats }: { stats: ApiStatistics }) {
  const chartOptions = useMemo(() => createChartOptions(), []);
  const successRate = safeRate(stats.richieste_riuscite, stats.totale_richieste);
  const failureRate = safeRate(stats.richieste_fallite, stats.totale_richieste);
  const activityCount = (stats.attivita_recente || []).length;
  const endpointLeader = valoreOAssente(stats.endpoint_piu_utilizzati?.[0]?.endpoint);
  const trendPositive = stats.crescita_settimanale_percentuale >= 0;
  const osList = stats.dispositivi?.sistemi_operativi || [];
  const responseHint =
    stats.tempo_medio_risposta_ms <= 250
      ? "latenza ottima"
      : stats.tempo_medio_risposta_ms <= 750
        ? "latenza sotto controllo"
        : "latenza da monitorare";

  return (
    <>
      <StatCardGrid className="lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          densita="compatta"
          etichetta="Richieste totali"
          valore={formatNumero(stats.totale_richieste)}
          icona="Activity"
          tono="brand"
        />
        <StatCard
          densita="compatta"
          etichetta="Tasso di successo"
          valore={formatPercent(successRate)}
          icona="CircleCheck"
          tono="success"
          variazione={{
            valore: `${formatNumero(stats.richieste_riuscite)} riuscite`,
            direzione: trendPositive ? "su" : "giu",
          }}
        />
        <StatCard
          densita="compatta"
          etichetta="Errori"
          valore={formatNumero(stats.richieste_fallite)}
          icona="TriangleAlert"
          tono="danger"
          evidenzia={stats.richieste_fallite > 0}
          sottotitolo={`Failure rate ${formatPercent(failureRate)}`}
        />
        <StatCard
          densita="compatta"
          etichetta="Tempo medio"
          valore={formatMs(stats.tempo_medio_risposta_ms)}
          icona="Clock"
          tono="warning"
          sottotitolo={responseHint}
        />
        <StatCard
          densita="compatta"
          etichetta="Richieste oggi"
          valore={formatNumero(stats.richieste_oggi)}
          icona="Calendar"
          tono="neutral"
          sottotitolo={`${formatNumero(stats.statistiche_temporali.ultimo_giorno.richieste_totali)} nell'ultimo giorno`}
        />
        <StatCard
          densita="compatta"
          etichetta="Endpoint leader"
          valore={<span title={endpointLeader} className="font-mono text-sm">{endpointLeader}</span>}
          icona="Route"
          tono="neutral"
        />
      </StatCardGrid>

      <div className="grid grid-cols-12 gap-6">
        <Sezione
          className="col-span-12 xl:col-span-8"
          icona="ChartLine"
          titolo="Trend temporale"
          descrizione="Andamento richieste per ultimo giorno, settimana e mese"
        >
          <div className="relative h-64 overflow-hidden">
            <Chart
              type="line"
              data={createTemporalChartData(stats)}
              options={chartOptions.line}
              width="auto"
              height="auto"
              className="h-full w-full"
            />
          </div>
        </Sezione>
        <Sezione
          className="col-span-12 xl:col-span-4"
          icona="ChartPie"
          titolo="Tasso di successo"
          descrizione="Distribuzione chiamate riuscite e fallite"
          azioni={
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-success" />
                OK
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-danger" />
                KO
              </span>
            </div>
          }
        >
          <div className="relative h-64 overflow-hidden">
            <Chart
              type="doughnut"
              data={createSuccessRateChartData(stats)}
              options={chartOptions.pie}
              width="auto"
              height="auto"
              className="h-full w-full"
            />
          </div>
        </Sezione>

        <Sezione
          className="col-span-12 xl:col-span-7"
          icona="ChartBar"
          titolo="Endpoint più usati"
          descrizione="Top 5 endpoint per volume di richieste"
        >
          <div className="relative h-64 overflow-hidden">
            <Chart
              type="bar"
              data={createEndpointChartData(stats)}
              options={chartOptions.bar}
              width="auto"
              height="auto"
              className="h-full w-full"
            />
          </div>
        </Sezione>
        <Sezione
          className="col-span-12 xl:col-span-5"
          icona="MonitorSmartphone"
          titolo="Sistemi operativi"
          descrizione={`${formatNumero(osList.length)} piattaforme rilevate`}
        >
          {osList.length > 0 ? (
            <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {osList.map(os => (
                <OsStatRow
                  key={os.os}
                  os={os.os}
                  totale={os.totale_richieste}
                  riuscite={os.richieste_riuscite}
                  tempoMedio={Math.round(os.tempo_medio_ms)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              compatta
              icon="MonitorSmartphone"
              title="Nessun sistema operativo rilevato"
              description="Nel periodo selezionato non ci sono richieste con un sistema operativo riconosciuto."
            />
          )}
        </Sezione>
      </div>

      <Sezione
        senzaPadding
        icona="History"
        titolo="Attività recente"
        descrizione={`${formatNumero(activityCount)} ${activityCount === 1 ? "richiesta" : "richieste"} registrate`}
        azioni={
          <>
            <Badge variant="secondary" size="sm" className="tabular-nums">
              {formatNumero(stats.richieste_riuscite)} ok
            </Badge>
            <Badge variant="error" size="sm" className="tabular-nums">
              {formatNumero(stats.richieste_fallite)} errori
            </Badge>
          </>
        }
      >
        <ActivityTable activities={stats.attivita_recente || []} />
      </Sezione>
    </>
  );
}

interface OsStatRowProps {
  os: string;
  totale: number;
  riuscite: number;
  tempoMedio: number;
}

function OsStatRow({ os, totale, riuscite, tempoMedio }: OsStatRowProps) {
  const successRate = safeRate(riuscite, totale);

  const resolveIconSrc = (label: string) => {
    const n = label.toLowerCase();
    if (n.includes("windows")) return windowsSVG;
    if (n.includes("linux")) return linuxSVG;
    if (n.includes("android")) return androidSVG;
    if (n.includes("console")) return consoleSVG;
    if (n.includes("mac") || n.includes("ios") || n.includes("apple")) return appleSVG;
    return unknownSVG;
  };

  const tono = successRate >= 95 ? "success" : successRate >= 80 ? "warning" : "danger";

  return (
    <li className="rounded-control border border-slate-100 bg-slate-50 px-3 py-2.5 transition-colors hover:border-slate-200">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control border border-slate-200 bg-white">
          <img src={resolveIconSrc(os)} alt="" className="h-4 w-4 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5 gap-3">
            <span className="text-xs font-semibold text-slate-700 truncate">{os}</span>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <span className="text-2xs tabular-nums text-slate-500">{formatNumero(totale)} req</span>
              <span aria-hidden="true" className="text-2xs text-slate-400">·</span>
              <span className="font-mono text-2xs text-slate-500">{formatMs(tempoMedio)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-300",
                  successRate >= 95 ? "bg-success" : successRate >= 80 ? "bg-warning" : "bg-danger"
                )}
                style={{ width: `${Math.min(successRate, 100)}%` }}
              />
            </div>
            <StatusBadge tono={tono} etichetta={formatPercent(successRate)} className="tabular-nums" />
          </div>
        </div>
      </div>
    </li>
  );
}

export default withSessionCheck(StatistichePage);
