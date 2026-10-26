import { useFetchStatisticheApiAggregate, useFetchStatisticheApiDettagli } from "../../../query/query";
import type { ApiStatistics } from "../types";

export function useStatistics() {
  // Hook per le statistiche aggregate
  const {
    data: apiStatsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats
  } = useFetchStatisticheApiAggregate();

  // Hook per le statistiche dettagliate (attività recente)
  const {
    data: detailedStatsData,
    isLoading: detailedStatsLoading,
    error: detailedStatsError
  } = useFetchStatisticheApiDettagli({
    limite: 10,
    ordina_per: 'timestamp_richiesta',
    direzione_ordine: 'DESC'
  });

  // Estrae i dati dalle risposte (gestisce sia formato `data.data` che `data` diretto)
  const getStatsData = (data: any): ApiStatistics | null => {
    if (!data) return null;
    return data?.data || data;
  };

  const stats = getStatsData(apiStatsData);
  const detailedStats = Array.isArray(detailedStatsData?.statistiche)
    ? detailedStatsData.statistiche
    : Array.isArray(detailedStatsData)
      ? detailedStatsData
      : [];

  // Valori calcolati
  const totalRequests = stats?.totale_richieste || 0;
  const successRate = stats ? ((stats.richieste_riuscite / stats.totale_richieste) * 100) : 0;
  const avgResponseTime = stats?.tempo_medio_risposta_ms || 0;
  const topEndpoints = stats?.endpoint_piu_utilizzati?.slice(0, 5) || [];

  // Statistiche temporali
  const temporalStats = stats?.statistiche_temporali || {
    ultimo_giorno: { richieste_totali: 0, richieste_riuscite: 0, richieste_fallite: 0, tempo_medio_ms: 0 },
    ultima_settimana: { richieste_totali: 0, richieste_riuscite: 0, richieste_fallite: 0, tempo_medio_ms: 0 },
    ultimo_mese: { richieste_totali: 0, richieste_riuscite: 0, richieste_fallite: 0, tempo_medio_ms: 0 }
  };

  // Statistiche per ruolo
  const roleStats = stats?.statistiche_per_ruolo || [];

  return {
    // Dati raw
    stats,
    detailedStats,

    // Stati di caricamento ed errori
    statsLoading,
    statsError,
    detailedStatsLoading,
    detailedStatsError,

    // Valori calcolati
    totalRequests,
    successRate,
    avgResponseTime,
    topEndpoints,
    temporalStats,
    roleStats,

    // Funzioni
    refetchStats
  };
}
