import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import type { ApiStatistics } from "../../types";
import { chartOptions, createEndpointChartData, createSuccessRateChartData, createTemporalChartData } from "../../utils/chartHelpers";
import ActivityTable from "./ActivityTable";
import ExportButton from "./ExportButton";
import StatCard from "./StatCard";

interface StatisticsTabProps {
  stats: ApiStatistics | null;
  isLoading: boolean;
  error: any;
  onRefresh: () => void;
}

function StatisticsTab({ stats, isLoading, error, onRefresh }: StatisticsTabProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Statistiche API</h2>
        <div className="flex items-center gap-2">
          {stats && stats.attivita_recente && (
            <ExportButton aggregate={stats} details={stats.attivita_recente} />
          )}
          <Button
            onClick={onRefresh}
            size="sm"
            disabled={isLoading}
          >
            <Lucide
              icon="RefreshCw"
              className={clsx("w-4 h-4 mr-2", {
                "animate-spin": isLoading
              })}
            />
            Aggiorna
          </Button>
          {stats && (
            <span className="text-sm text-slate-500">
              Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT')}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          // Skeleton loading
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-white rounded-lg border border-slate-200/60 p-5">
                  <div className="h-4 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 bg-slate-200 rounded mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          // Errore
          <div className="text-center py-12">
            <div className="bg-white rounded-lg border border-slate-200/60 p-8 max-w-md mx-auto">
              <Lucide icon="CircleAlert" className="w-12 h-12 text-danger mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Errore nel caricamento</h3>
              <p className="text-slate-600 mb-4">Non è stato possibile caricare le statistiche API</p>
              <Button
                onClick={onRefresh}
                variant="primary"
                size="sm"
              >
                <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
                Riprova
              </Button>
            </div>
          </div>
        ) : stats ? (
          <>
            {/* Cards statistiche principali */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Richieste Totali"
                value={stats.totale_richieste}
                icon="Activity"
              />
              <StatCard
                title="Tasso di successo"
                value={`${((stats.richieste_riuscite / stats.totale_richieste) * 100).toFixed(1)}%`}
                icon="CircleCheck"
                trend="up"
              />
              <StatCard
                title="Tempo Medio"
                value={`${Math.round(stats.tempo_medio_risposta_ms)}ms`}
                icon="Clock"
              />
              <StatCard
                title="Ultimo Giorno"
                value={stats.statistiche_temporali.ultimo_giorno.richieste_totali}
                icon="Calendar"
              />
            </div>

            {/* Grafici */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Grafico a torta del tasso di successo */}
              <div className="bg-white rounded-lg border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Tasso di Successo</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-success rounded-full"></div>
                    <span className="text-sm text-slate-600">Riuscite</span>
                    <div className="w-3 h-3 bg-danger rounded-full"></div>
                    <span className="text-sm text-slate-600">Fallite</span>
                  </div>
                </div>
                <div className="h-64">
                  <Chart
                    type="doughnut"
                    data={createSuccessRateChartData(stats)}
                    options={chartOptions.pie}
                    width="auto"
                    height="auto"
                  />
                </div>
              </div>

              {/* Grafico endpoint più usati */}
              <div className="bg-white rounded-lg border border-slate-200/60 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Endpoint Più Usati</h3>
                <div className="h-64">
                  <Chart
                    type="bar"
                    data={createEndpointChartData(stats)}
                    options={chartOptions.bar}
                    width="auto"
                    height="auto"
                  />
                </div>
              </div>

              {/* Grafico temporale */}
              <div className="bg-white rounded-lg border border-slate-200/60 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Trend Temporale</h3>
                <div className="h-64">
                  <Chart
                    type="line"
                    data={createTemporalChartData(stats)}
                    options={chartOptions.line}
                    width="auto"
                    height="auto"
                  />
                </div>
              </div>
            </div>

            {/* Tabella attività recente */}
            <ActivityTable activities={stats.attivita_recente || []} />
          </>
        ) : (
          // Nessun dato
          <div className="text-center py-12">
            <div className="bg-white rounded-lg border border-slate-200/60 p-8 max-w-md mx-auto">
              <Lucide icon="Database" className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Nessun dato disponibile</h3>
              <p className="text-slate-600">Le statistiche API verranno visualizzate qui quando disponibili</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default StatisticsTab;
