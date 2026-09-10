import androidSVG from "@/assets/images/icons/android.svg";
import appleSVG from "@/assets/images/icons/apple.svg";
import consoleSVG from "@/assets/images/icons/console.svg";
import linuxSVG from "@/assets/images/icons/linux.svg";
import unknownSVG from "@/assets/images/icons/unknown.svg";
import windowsSVG from "@/assets/images/icons/windows.svg";
import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import withSessionCheck from "@/components/SessionChecker";
import clsx from "clsx";
import type { ReactNode } from "react";
import ActivityTable from "../../GestioneApi/components/statistics/ActivityTable";
import ExportButton from "../../GestioneApi/components/statistics/ExportButton";
import StatCard from "../../GestioneApi/components/statistics/StatCard";
import { useStatistics } from "../../GestioneApi/hooks/useStatistics";
import type { ApiStatistics } from "../../GestioneApi/types";
import { chartOptions, createEndpointChartData, createSuccessRateChartData, createTemporalChartData } from "../../GestioneApi/utils/chartHelpers";

const numberFormatter = new Intl.NumberFormat("it-IT");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function safeRate(partial: number, total: number) {
  if (total <= 0) return 0;
  return (partial / total) * 100;
}

function StatistichePage() {
  const {
    stats,
    statsLoading,
    statsError,
    refetchStats
  } = useStatistics();

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <PageHeader
          title="Statistiche API"
          description="Monitora le performance e l'utilizzo delle API esterne"
          className="mb-4"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3">
              {stats && (
                <span
                  className={clsx(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
                    stats.crescita_settimanale_percentuale >= 0
                      ? "text-success border-success/20 bg-success/10"
                      : "text-danger border-danger/20 bg-danger/10"
                  )}
                >
                  <Lucide
                    icon={stats.crescita_settimanale_percentuale >= 0 ? "TrendingUp" : "TrendingDown"}
                    className="w-3.5 h-3.5 mr-1.5"
                  />
                  {stats.crescita_settimanale_percentuale >= 0 ? "+" : ""}
                  {formatPercent(stats.crescita_settimanale_percentuale)} settimana
                </span>
              )}
              {stats && stats.attivita_recente && (
                <ExportButton aggregate={stats} details={stats.attivita_recente} />
              )}
              <Button
                onClick={() => { void refetchStats(); }}
                size="sm"
                disabled={statsLoading}
              >
                <Lucide
                  icon="RefreshCw"
                  className={clsx("w-4 h-4 mr-2", { "animate-spin": statsLoading })}
                />
                Aggiorna
              </Button>
            </div>
          }
        />

        <div className="mt-5">
          {statsLoading ? (
            <LoadingSkeleton />
          ) : statsError ? (
            <ErrorState onRetry={() => { void refetchStats(); }} />
          ) : stats ? (
            <StatsContent stats={stats} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8 box p-6 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-32 mb-3" />
          <div className="h-7 bg-slate-200 rounded w-2/3 mb-4" />
          <div className="h-3 bg-slate-200 rounded w-4/5 mb-5" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="col-span-12 xl:col-span-4 grid grid-cols-2 gap-3 animate-pulse">
          <div className="h-24 box bg-slate-100 border-slate-100" />
          <div className="h-24 box bg-slate-100 border-slate-100" />
          <div className="h-24 box bg-slate-100 border-slate-100 col-span-2" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-span-12 sm:col-span-6 xl:col-span-3 box p-5 border-l-4 border-l-slate-200 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
            <div className="h-7 bg-slate-200 rounded w-3/4 mb-2" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 box p-5 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
          <div className="h-64 bg-slate-100 rounded" />
        </div>
        <div className="col-span-12 lg:col-span-4 box p-5 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-slate-100 rounded" />
        </div>
      </div>

      <div className="box p-5 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/4 mb-4" />
        <div className="h-52 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="box p-8 sm:p-10">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mb-4">
          <Lucide icon="CircleAlert" className="w-7 h-7 text-danger" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Errore nel caricamento</h3>
        <p className="text-sm text-slate-500 mb-5">Non è stato possibile caricare le statistiche API</p>
        <Button onClick={onRetry} variant="primary" size="sm">
          <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
          Riprova
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="box p-8 sm:p-10">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Lucide icon="Database" className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Nessun dato disponibile</h3>
        <p className="text-sm text-slate-500">Le statistiche API verranno visualizzate qui quando disponibili</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, label, sub, right }: { icon: string; label: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 pb-3 border-b border-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Lucide icon={icon} className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{label}</h3>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
        </div>
        {right}
      </div>
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  tone,
  className
}: {
  icon: string;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning";
  className?: string;
}) {
  const toneMap: Record<"primary" | "success" | "warning", { iconWrap: string; icon: string }> = {
    primary: { iconWrap: "bg-primary/10", icon: "text-primary" },
    success: { iconWrap: "bg-success/10", icon: "text-success" },
    warning: { iconWrap: "bg-warning/10", icon: "text-warning" }
  };

  return (
    <div className={clsx("box border-slate-200 p-3.5 hover:border-slate-300 transition-colors", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 leading-none">{value}</p>
        </div>
        <div className={clsx("w-8 h-8 rounded-md flex items-center justify-center", toneMap[tone].iconWrap)}>
          <Lucide icon={icon} className={clsx("w-4 h-4", toneMap[tone].icon)} />
        </div>
      </div>
    </div>
  );
}

function StatsContent({ stats }: { stats: ApiStatistics }) {
  const successRate = safeRate(stats.richieste_riuscite, stats.totale_richieste);
  const failureRate = safeRate(stats.richieste_fallite, stats.totale_richieste);
  const activityCount = (stats.attivita_recente || []).length;
  const endpointTop = stats.endpoint_piu_utilizzati?.[0];
  const trendPositive = stats.crescita_settimanale_percentuale >= 0;
  const osList = stats.dispositivi?.sistemi_operativi || [];
  const responseHint =
    stats.tempo_medio_risposta_ms <= 250
      ? "latenza ottima"
      : stats.tempo_medio_risposta_ms <= 750
        ? "latenza sotto controllo"
        : "latenza da monitorare";

  return (
    <div className="space-y-5 lg:space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8 box p-6 bg-gradient-to-r from-primary/10 via-white to-success/5 border-primary/20">
          <div className="text-[11px] uppercase tracking-[0.18em] text-primary/80 font-semibold mb-2">
            API Health Snapshot
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {formatPercent(successRate)} richieste completate con successo
            </h2>
            <span
              className={clsx(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
                trendPositive ? "text-success bg-success/10 border-success/20" : "text-danger bg-danger/10 border-danger/20"
              )}
            >
              <Lucide icon={trendPositive ? "ArrowUpRight" : "ArrowDownRight"} className="w-3.5 h-3.5 mr-1" />
              {trendPositive ? "+" : ""}
              {formatPercent(stats.crescita_settimanale_percentuale)} su base settimanale
            </span>
          </div>
          <p className="text-sm text-slate-600 max-w-3xl mb-5">
            Traffico API monitorato in tempo reale: volume richieste, affidabilita risposta e carico endpoint
            con focus operativo su errori e latenza.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Richieste totali</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(stats.totale_richieste)}</p>
            </div>
            <div className="rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Errori</p>
              <p className="mt-1 text-lg font-semibold text-danger">{formatNumber(stats.richieste_fallite)}</p>
            </div>
            <div className="rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tempo medio</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatMs(stats.tempo_medio_risposta_ms)}</p>
            </div>
            <div className="rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Endpoint leader</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 truncate" title={endpointTop?.endpoint || "N/A"}>
                {endpointTop?.endpoint || "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 grid grid-cols-2 gap-3 auto-rows-fr">
          <HeroMetric
            icon="Calendar"
            label="Richieste oggi"
            value={formatNumber(stats.richieste_oggi)}
            tone="primary"
          />
          <HeroMetric
            icon="ShieldCheck"
            label="Failure rate"
            value={formatPercent(failureRate)}
            tone="success"
          />
          <HeroMetric
            icon="Gauge"
            label="Stato latenza"
            value={responseHint}
            tone="warning"
            className="col-span-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 xl:col-span-4">
          <StatCard
            title="Richieste Totali"
            value={formatNumber(stats.totale_richieste)}
            icon="Activity"
            variant="blue"
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <StatCard
            title="Tasso di Successo"
            value={formatPercent(successRate)}
            icon="CircleCheck"
            variant="green"
            trend={trendPositive ? "up" : "down"}
            trendValue={`${formatNumber(stats.richieste_riuscite)} riuscite`}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-2">
          <StatCard
            title="Tempo Medio"
            value={formatMs(stats.tempo_medio_risposta_ms)}
            icon="Clock"
            variant="amber"
            subtitle={responseHint}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 xl:col-span-3">
          <StatCard
            title="Richieste Oggi"
            value={formatNumber(stats.richieste_oggi)}
            icon="Calendar"
            variant="slate"
            subtitle={`${formatNumber(stats.statistiche_temporali.ultimo_giorno.richieste_totali)} nell'ultimo giorno`}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 box p-5 lg:p-6">
          <SectionTitle
            icon="ChartLine"
            label="Trend Temporale"
            sub="Andamento richieste per ultimo giorno, settimana e mese"
            right={
              <span className="hidden sm:inline-flex text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                serie comparativa
              </span>
            }
          />
          <div className="relative h-64 overflow-hidden">
            <Chart
              type="line"
              data={createTemporalChartData(stats)}
              options={chartOptions.line}
              width="auto"
              height="auto"
              className="w-full h-full"
            />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 box p-5 lg:p-6">
          <SectionTitle
            icon="ChartPie"
            label="Tasso di Successo"
            sub="Distribuzione chiamate riuscite e fallite"
            right={
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  OK
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                  KO
                </span>
              </div>
            }
          />
          <div className="relative h-64 overflow-hidden">
            <Chart
              type="doughnut"
              data={createSuccessRateChartData(stats)}
              options={chartOptions.pie}
              width="auto"
              height="auto"
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7 box p-5 lg:p-6">
          <SectionTitle icon="ChartBar" label="Endpoint Più Usati" sub="Top 5 endpoint per volume di richieste" />
          <div className="relative h-64 overflow-hidden">
            <Chart
              type="bar"
              data={createEndpointChartData(stats)}
              options={chartOptions.bar}
              width="auto"
              height="auto"
              className="w-full h-full"
            />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-5 box p-5 lg:p-6">
          <SectionTitle
            icon="MonitorSmartphone"
            label="Sistemi Operativi"
            sub={`${osList.length} piattaforme rilevate`}
          />
          {osList.length > 0 ? (
            <div className="space-y-3.5 overflow-y-auto max-h-64 pr-1">
              {osList.map(os => (
                <OsStatRow
                  key={os.os}
                  os={os.os}
                  totale={os.totale_richieste}
                  riuscite={os.richieste_riuscite}
                  tempoMedio={Math.round(os.tempo_medio_ms)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
              Nessun sistema operativo rilevato nel periodo selezionato.
            </div>
          )}
        </div>
      </div>

      <div className="box p-5 lg:p-6">
        <SectionTitle
          icon="History"
          label="Attività Recente"
          sub={`${activityCount} ${activityCount === 1 ? "richiesta" : "richieste"} registrate`}
          right={
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center px-2 py-1 rounded-full border border-slate-200 bg-slate-50">
                {formatNumber(stats.richieste_riuscite)} ok
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-full border border-danger/20 bg-danger/10 text-danger">
                {formatNumber(stats.richieste_fallite)} errori
              </span>
            </div>
          }
        />
        <ActivityTable activities={stats.attivita_recente || []} />
      </div>
    </div>
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

  const statusStyle =
    successRate >= 95
      ? "bg-success/10 text-success border-success/20"
      : successRate >= 80
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-danger/10 text-danger border-danger/20";

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
          <img src={resolveIconSrc(os)} alt={os} className="w-4 h-4 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5 gap-3">
            <span className="text-xs font-semibold text-slate-700 truncate">{os}</span>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <span className="text-[11px] text-slate-500">{formatNumber(totale)} req</span>
              <span className="text-[11px] text-slate-300">·</span>
              <span className="text-[11px] font-mono text-slate-500">{formatMs(tempoMedio)}</span>
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
            <span className={clsx("text-[11px] px-2 py-0.5 rounded-full border font-semibold", statusStyle)}>
              {formatPercent(successRate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(StatistichePage);
