import Lucide from "@/components/Base/Lucide";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useFetchFlyerInsightsConfig } from "@/query/query";
import { FlyerInsights as FlyerInsightsType } from "@/types/flyerInsights";
import clsx from "clsx";
import { FC, useMemo, useState } from "react";
import FlyerPageMap from "./FlyerPageMap";
import RiepilogoMeccaniche from "./RiepilogoMeccaniche";
import RiepilogoPagine from "./RiepilogoPagine";
import RiepilogoReparti from "./RiepilogoReparti";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";

interface FlyerInsightsProps {
  insights: FlyerInsightsType | null;
  isLoading?: boolean;
  paginaSelezionata?: number;
  className?: string;
  exportCodes?: string[];
}

const FlyerInsights: FC<FlyerInsightsProps> = ({
  insights,
  isLoading = false,
  paginaSelezionata,
  className,
  exportCodes
}) => {
  const [activeTab, setActiveTab] = useState<'pagine' | 'reparti' | 'meccaniche' | 'mappa'>('pagine');
  const [selectedPage, setSelectedPage] = useState<number | null>(paginaSelezionata ?? null);
  const { data: insightsConfig } = useFetchFlyerInsightsConfig();

  const referenzeFiltrate = useMemo(() => {
    if (!insights?.referenze) return [];
    if (selectedPage === null) return insights.referenze;
    return insights.referenze.filter(r => r.posizione?.pag === selectedPage);
  }, [insights?.referenze, selectedPage]);

  // IMPORTANTE: tutti gli hooks devono essere chiamati prima dei return condizionali
  const tabs = useMemo(() => {
    const allTabs = [
      { id: 'pagine', label: 'Per Pagina', icon: 'FileText', enabled: insightsConfig?.pagine?.enabled !== false },
      { id: 'reparti', label: 'Per Reparto', icon: 'LayoutGrid', enabled: insightsConfig?.reparti?.enabled !== false },
      { id: 'meccaniche', label: 'Meccaniche', icon: 'Tag', enabled: insightsConfig?.meccaniche?.enabled !== false },
      { id: 'mappa', label: 'Mappa Visiva', icon: 'Map', enabled: insightsConfig?.mappa?.enabled !== false },
    ] as const;
    return allTabs.filter(tab => tab.enabled);
  }, [insightsConfig]);

  if (isLoading) {
    return (
      <div className={clsx("flex items-center justify-center py-12", className)}>
        <LoadingSpinner />
      </div>
    );
  }
  if (exportCodes !== undefined) {
    if (!exportCodes.includes(EXPORT_DI_SISTEMA.VOL)) {
      return (
        <div className={clsx("rounded-lg border border-dashed border-slate-200 p-8 text-center", className)}>
          <Lucide icon="FileSearch" className="mx-auto h-10 w-10 text-slate-400 mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">Per questo kit non è presente il tipo di esportazione VOL</h3>
          <p className="text-xs text-slate-500 mt-1">
            Le statistiche sono disponibili per i kit con esportazione VOL.
          </p>
        </div>
      );
    }
  }

  if (!insights || insights.totaleReferenze === 0) {
    return (
      <div className={clsx("rounded-lg border border-dashed border-slate-200 p-8 text-center", className)}>
        <Lucide icon="FileSearch" className="mx-auto h-10 w-10 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">Nessuna referenza trovata</h3>
        <p className="text-xs text-slate-500 mt-1">
          Le statistiche saranno disponibili quando le referenze avranno dati di posizione.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Lucide icon="Package" className="h-3.5 w-3.5" />
            Referenze
          </div>
          <p className="text-2xl font-bold text-slate-800">{insights.totaleReferenze}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Lucide icon="BookOpen" className="h-3.5 w-3.5" />
            Pagine
          </div>
          <p className="text-2xl font-bold text-slate-800">{insights.totalePagine}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Lucide icon="LayoutGrid" className="h-3.5 w-3.5" />
            Reparti
          </div>
          <p className="text-2xl font-bold text-slate-800">{insights.riepilogoReparti.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition",
              activeTab === tab.id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            <Lucide icon={tab.icon as any} className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-slate-200 bg-white">
        {activeTab === 'pagine' && insightsConfig && (
          <RiepilogoPagine
            riepilogo={insights.riepilogoPagine}
            selectedPage={selectedPage}
            onSelectPage={setSelectedPage}
            config={insightsConfig.pagine}
          />
        )}
        {activeTab === 'reparti' && insightsConfig && (
          <RiepilogoReparti
            riepilogo={insights.riepilogoReparti}
            config={insightsConfig.reparti}
          />
        )}
        {activeTab === 'meccaniche' && insightsConfig && (
          <RiepilogoMeccaniche
            riepilogo={insights.riepilogoMeccaniche}
            config={insightsConfig.meccaniche}
          />
        )}
        {activeTab === 'mappa' && insights.riepilogoPagine.length > 0 && (
          <FlyerPageMap
            referenze={insights.referenze}
            paginaCorrente={selectedPage ?? insights.riepilogoPagine[0]?.pagina ?? 1}
            onChangePage={setSelectedPage}
            totalePagine={insights.totalePagine}
            config={insightsConfig?.mappa}
            repartiColorStrategy={insightsConfig?.reparti?.colorStrategy}
          />
        )}
        {activeTab === 'mappa' && insights.riepilogoPagine.length === 0 && (
          <div className="p-6 text-center text-slate-500">
            <Lucide icon={(insightsConfig?.mappa?.emptyState?.icon || "MapPinOff") as any} className="mx-auto h-8 w-8 mb-2 text-slate-400" />
            <p className="text-sm">{insightsConfig?.mappa?.emptyState?.message || "Nessuna referenza con dati di posizione per la mappa"}</p>
          </div>
        )}
        {!insightsConfig && activeTab !== 'mappa' && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        )}
      </div>
    </div>
  );
};

export default FlyerInsights;
