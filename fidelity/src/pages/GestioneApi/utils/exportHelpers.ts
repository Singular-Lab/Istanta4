import * as XLSX from 'xlsx';
import type { ApiStatistics } from "../types";

/**
 * Esporta le statistiche in formato CSV
 */
export function exportStatisticsToCSV(
  aggregate: ApiStatistics,
  details: ApiStatistics['attivita_recente']
): void {
  const headers = ['Timestamp', 'Endpoint', 'Metodo', 'Status', 'Tempo (ms)', 'Ruolo'];
  const rows = details.map(d => [
    `${d.orario} - ${d.data}`,
    d.endpoint,
    d.metodo,
    d.codice_risposta,
    d.tempo_risposta_ms,
    d.ruolo_utente || '-'
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `statistiche-api-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Esporta le statistiche in formato Excel
 */
export function exportStatisticsToExcel(
  aggregate: ApiStatistics,
  details: ApiStatistics['attivita_recente']
): void {
  const workbook = XLSX.utils.book_new();

  // Sheet Overview
  const overviewData = [
    ['Metrica', 'Valore'],
    ['Totale Richieste', aggregate.totale_richieste],
    ['Richieste Riuscite', aggregate.richieste_riuscite],
    ['Richieste Fallite', aggregate.richieste_fallite],
    ['Tasso Successo', `${((aggregate.richieste_riuscite / aggregate.totale_richieste) * 100).toFixed(1)}%`],
    ['Tempo Medio Risposta', `${Math.round(aggregate.tempo_medio_risposta_ms)}ms`],
    ['Richieste Ultimo Giorno', aggregate.statistiche_temporali.ultimo_giorno.richieste_totali],
    ['Richieste Ultima Settimana', aggregate.statistiche_temporali.ultima_settimana.richieste_totali],
    ['Richieste Ultimo Mese', aggregate.statistiche_temporali.ultimo_mese.richieste_totali]
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(workbook, wsOverview, 'Panoramica');

  // Sheet Dettagli
  const detailsData = details.map(d => ({
    Timestamp: `${d.orario} - ${d.data}`,
    Endpoint: d.endpoint,
    Metodo: d.metodo,
    Status: d.codice_risposta,
    'Tempo (ms)': d.tempo_risposta_ms,
    Ruolo: d.ruolo_utente || '-',
    IP: d.ip_richiedente || '-'
  }));
  const wsDetails = XLSX.utils.json_to_sheet(detailsData);
  XLSX.utils.book_append_sheet(workbook, wsDetails, 'Dettagli');

  // Sheet Endpoint
  if (aggregate.endpoint_piu_utilizzati && aggregate.endpoint_piu_utilizzati.length > 0) {
    const endpointsData = aggregate.endpoint_piu_utilizzati.map(e => ({
      Endpoint: e.endpoint,
      'Richieste': e.richieste,
      'Tempo Medio (ms)': e.tempo_medio_ms
    }));
    const wsEndpoints = XLSX.utils.json_to_sheet(endpointsData);
    XLSX.utils.book_append_sheet(workbook, wsEndpoints, 'Endpoints');
  }

  XLSX.writeFile(workbook, `statistiche-api-${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Esporta le statistiche in formato PDF (client-side, react-pdf)
 */
export async function exportStatisticsToPDF(
  aggregate: ApiStatistics,
  details: ApiStatistics['attivita_recente']
): Promise<void> {
  const [{ pdf }, { StatistichePdfDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../StatistichePdfDocument'),
  ]);

  const element = StatistichePdfDocument({ aggregate, details });
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `statistiche-api-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
