import { getColor } from "@/utils/colors";
import type { ApiStatistics } from "../types";

/**
 * Crea i dati per il grafico a torta del tasso di successo
 */
export function createSuccessRateChartData(stats: ApiStatistics) {
  if (!stats) {
    return {
      labels: ['Riuscite', 'Fallite'],
      datasets: [{
        data: [0, 0],
        backgroundColor: [
          getColor("success", 0.8),
          getColor("danger", 0.8)
        ],
        borderColor: [
          getColor("success"),
          getColor("danger")
        ],
        borderWidth: 1
      }]
    };
  }

  return {
    labels: ['Riuscite', 'Fallite'],
    datasets: [{
      data: [stats.richieste_riuscite, stats.richieste_fallite],
      backgroundColor: [
        getColor("success", 0.8),
        getColor("danger", 0.8)
      ],
      borderColor: [
        getColor("success"),
        getColor("danger")
      ],
      borderWidth: 1
    }]
  };
}

/**
 * Crea i dati per il grafico a barre degli endpoint più usati
 */
export function createEndpointChartData(stats: ApiStatistics) {
  if (!stats?.endpoint_piu_utilizzati || !Array.isArray(stats.endpoint_piu_utilizzati)) {
    return {
      labels: [],
      datasets: [{
        label: 'Richieste',
        data: [],
        backgroundColor: getColor("primary", 0.8),
        borderColor: getColor("primary"),
        borderWidth: 1
      }]
    };
  }

  const topEndpoints = stats.endpoint_piu_utilizzati.slice(0, 5);

  return {
    labels: topEndpoints.map(e => e.endpoint.split('/').pop() || e.endpoint),
    datasets: [{
      label: 'Richieste',
      data: topEndpoints.map(e => e.richieste),
      backgroundColor: getColor("primary", 0.8),
      borderColor: getColor("primary"),
      borderWidth: 1
    }]
  };
}

/**
 * Crea i dati per il grafico temporale delle richieste
 */
export function createTemporalChartData(stats: ApiStatistics) {
  if (!stats?.statistiche_temporali) {
    return {
      labels: ['Ultimo Giorno', 'Ultima Settimana', 'Ultimo Mese'],
      datasets: [{
        label: 'Richieste Totali',
        data: [0, 0, 0],
        fill: true,
        backgroundColor: getColor("primary", 0.1),
        borderColor: getColor("primary"),
        borderWidth: 2,
        tension: 0.4
      }]
    };
  }

  const { ultimo_giorno, ultima_settimana, ultimo_mese } = stats.statistiche_temporali;

  return {
    labels: ['Ultimo Giorno', 'Ultima Settimana', 'Ultimo Mese'],
    datasets: [{
      label: 'Richieste Totali',
      data: [
        ultimo_giorno.richieste_totali,
        ultima_settimana.richieste_totali,
        ultimo_mese.richieste_totali
      ],
      fill: true,
      backgroundColor: getColor("primary", 0.1),
      borderColor: getColor("primary"),
      borderWidth: 2,
      tension: 0.4
    }]
  };
}

/**
 * Opzioni comuni per i grafici
 */
export const chartOptions = {
  pie: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      }
    }
  },
  bar: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  },
  line: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
};
