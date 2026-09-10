import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { Menu } from "@headlessui/react";
import { useStatisticsExport } from "../../hooks/useStatisticsExport.tsx";
import type { ApiStatistics } from "../../types";

interface ExportButtonProps {
  aggregate: ApiStatistics;
  details: ApiStatistics['attivita_recente'];
}

function ExportButton({ aggregate, details }: ExportButtonProps) {
  const { exportToCSV, exportToExcel, exportToPDF, isExporting } = useStatisticsExport();

  return (
    <Menu as="div" className="relative">
      <Menu.Button as={Button} variant="outline-secondary" size="sm" disabled={isExporting}>
        <Lucide icon={isExporting ? "Loader" : "Download"} className={`w-4 h-4 mr-2 ${isExporting ? 'animate-spin' : ''}`} />
        {isExporting ? 'Esportando...' : 'Esporta'}
      </Menu.Button>

      <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={() => exportToCSV(aggregate, details)}
              className={`w-full text-left px-4 py-2 text-sm flex items-center ${active ? 'bg-slate-100' : ''}`}
            >
              <Lucide icon="FileText" className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          )}
        </Menu.Item>
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={() => exportToExcel(aggregate, details)}
              className={`w-full text-left px-4 py-2 text-sm flex items-center ${active ? 'bg-slate-100' : ''}`}
            >
              <Lucide icon="FileSpreadsheet" className="w-4 h-4 mr-2" />
              Export Excel
            </button>
          )}
        </Menu.Item>
        <Menu.Item>
          {({ active }) => (
            <button
              onClick={() => exportToPDF(aggregate, details)}
              className={`w-full text-left px-4 py-2 text-sm flex items-center ${active ? 'bg-slate-100' : ''}`}
            >
              <Lucide icon="FileType" className="w-4 h-4 mr-2" />
              Export PDF
            </button>
          )}
        </Menu.Item>
      </Menu.Items>
    </Menu>
  );
}

export default ExportButton;
