import Button from "@/components/Base/Button";
import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useStatisticsExport } from "../../hooks/useStatisticsExport.tsx";
import type { ApiStatistics } from "../../types";

interface ExportButtonProps {
  aggregate: ApiStatistics;
  details: ApiStatistics['attivita_recente'];
}

function ExportButton({ aggregate, details }: ExportButtonProps) {
  const { exportToCSV, exportToExcel, exportToPDF, isExporting } = useStatisticsExport();

  return (
    <Menu className="inline-block text-left">
      <Menu.Button as={Button} variant="outline-secondary" disabled={isExporting} loading={isExporting}>
        {!isExporting && <Lucide icon="Download" aria-hidden="true" className="mr-2 h-4 w-4" />}
        {isExporting ? "Esportazione…" : "Esporta"}
      </Menu.Button>

      <Menu.Items className="w-48">
        <Menu.Item onClick={() => exportToCSV(aggregate, details)}>
          <Lucide icon="FileText" aria-hidden="true" className="mr-2 h-4 w-4" />
          Export CSV
        </Menu.Item>
        <Menu.Item onClick={() => exportToExcel(aggregate, details)}>
          <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-2 h-4 w-4" />
          Export Excel
        </Menu.Item>
        <Menu.Item onClick={() => exportToPDF(aggregate, details)}>
          <Lucide icon="FileType" aria-hidden="true" className="mr-2 h-4 w-4" />
          Export PDF
        </Menu.Item>
      </Menu.Items>
    </Menu>
  );
}

export default ExportButton;
