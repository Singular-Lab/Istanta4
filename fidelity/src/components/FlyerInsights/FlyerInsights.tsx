import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import EmptyState from "@/components/EmptyState";
import { formatNumero } from "@/utils/format";
import { useFetchFlyerInsightsConfig } from "@/query/query";
import { FlyerInsights as FlyerInsightsType } from "@/types/flyerInsights";
import clsx from "clsx";
import { icons } from "lucide-react";
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
        <Spinner size="md" />
      </div>
    );
  }
  if (exportCodes !== undefined) {
    if (!exportCodes.includes(EXPORT_DI_SISTEMA.VOL)) {
      return (
        <EmptyState
          compatta
          icon="FileSearch"
          title="Per questo kit non è presente il tipo di esportazione VOL"
          description="Le statistiche sono disponibili per i kit con esportazione VOL."
          className={clsx("border border-dashed border-slate-200", className)}
        />
      );
    }
  }

  if (!insights || insights.totaleReferenze === 0) {
    return (
      <EmptyState
        compatta
        icon="FileSearch"
        title="Nessuna referenza trovata"
        description="Le statistiche saranno disponibili quando le referenze avranno dati di posizione."
        className={clsx("border border-dashed border-slate-200", className)}
      />
    );
  }

  const indiceTab = Math.max(0, tabs.findIndex(tab => tab.id === activeTab));
  const iconaMappaVuota = (insightsConfig?.mappa?.emptyState?.icon || "MapPinOff") as keyof typeof icons;

  const contenuto = (id: (typeof tabs)[number]["id"]) => {
    if (id !== 'mappa' && !insightsConfig) {
      return (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      );
    }
    switch (id) {
      case 'pagine':
        return insightsConfig && (
          <RiepilogoPagine
            riepilogo={insights.riepilogoPagine}
            selectedPage={selectedPage}
            onSelectPage={setSelectedPage}
            config={insightsConfig.pagine}
          />
        );
      case 'reparti':
        return insightsConfig && (
          <RiepilogoReparti
            riepilogo={insights.riepilogoReparti}
            config={insightsConfig.reparti}
          />
        );
      case 'meccaniche':
        return insightsConfig && (
          <RiepilogoMeccaniche
            riepilogo={insights.riepilogoMeccaniche}
            config={insightsConfig.meccaniche}
          />
        );
      case 'mappa':
        return insights.riepilogoPagine.length > 0 ? (
          <FlyerPageMap
            referenze={insights.referenze}
            paginaCorrente={selectedPage ?? insights.riepilogoPagine[0]?.pagina ?? 1}
            onChangePage={setSelectedPage}
            totalePagine={insights.totalePagine}
            config={insightsConfig?.mappa}
            repartiColorStrategy={insightsConfig?.reparti?.colorStrategy}
            origineStorico={Boolean(insights.origineStorico)}
          />
        ) : (
          <EmptyState
            compatta
            icon={iconaMappaVuota}
            title="Mappa non disponibile"
            description={insightsConfig?.mappa?.emptyState?.message || "Nessuna referenza con dati di posizione per la mappa"}
          />
        );
    }
  };

  return (
    <div className={clsx("space-y-4", className)}>
      {/* Header Stats */}
      <StatCardGrid className="grid-cols-3 lg:grid-cols-3">
        <StatCard densita="compatta" etichetta="Referenze" valore={formatNumero(insights.totaleReferenze)} icona="Package" tono="neutral" />
        <StatCard densita="compatta" etichetta="Pagine" valore={formatNumero(insights.totalePagine)} icona="BookOpen" tono="neutral" />
        <StatCard densita="compatta" etichetta="Reparti" valore={formatNumero(insights.riepilogoReparti.length)} icona="LayoutGrid" tono="neutral" />
      </StatCardGrid>

      {/* Viste */}
      <Tab.Group
        className="space-y-4"
        selectedIndex={indiceTab}
        onChange={(indice: number) => setActiveTab(tabs[indice].id)}
      >
        <Tab.List variant="boxed-tabs" aria-label="Viste delle statistiche">
          {tabs.map(tab => (
            <Tab key={tab.id}>
              <Tab.Button
                as="button"
                title={tab.label}
                className="flex w-full items-center justify-center gap-2 whitespace-nowrap text-xs font-medium"
              >
                <Lucide icon={tab.icon} aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">{tab.label}</span>
              </Tab.Button>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="rounded-card border border-slate-200 bg-white">
          {tabs.map(tab => (
            <Tab.Panel key={tab.id}>{contenuto(tab.id)}</Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default FlyerInsights;
