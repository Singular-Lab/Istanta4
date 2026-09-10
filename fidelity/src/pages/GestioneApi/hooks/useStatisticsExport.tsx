import { useState, useCallback } from "react";
import type { ApiStatistics } from "../types";
import {
  exportStatisticsToCSV,
  exportStatisticsToExcel,
  exportStatisticsToPDF
} from "../utils/exportHelpers";

export function useStatisticsExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = useCallback(async (
    aggregate: ApiStatistics,
    details: ApiStatistics['attivita_recente']
  ) => {
    setIsExporting(true);
    try {
      exportStatisticsToCSV(aggregate, details);
    } catch (error) {
      console.error('Errore durante l\'export CSV:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToExcel = useCallback(async (
    aggregate: ApiStatistics,
    details: ApiStatistics['attivita_recente']
  ) => {
    setIsExporting(true);
    try {
      exportStatisticsToExcel(aggregate, details);
    } catch (error) {
      console.error('Errore durante l\'export Excel:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToPDF = useCallback(async (
    aggregate: ApiStatistics,
    details: ApiStatistics['attivita_recente']
  ) => {
    setIsExporting(true);
    try {
      await exportStatisticsToPDF(aggregate, details);
    } catch (error) {
      console.error('Errore durante l\'export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportToCSV,
    exportToExcel,
    exportToPDF,
    isExporting
  };
}
