import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Spinner from "@/components/Base/Spinner";
import EmptyState from "@/components/EmptyState";
import { useFetchFlyerInsightsConfig } from "@/query/query";
import { FlyerInsights as FlyerInsightsType } from "@/types/flyerInsights";
import clsx from "clsx";
import { FC, useMemo, useState } from "react";
import { MarcheVolantino, PrezziSconti, UsoSpazio } from "./analisi";
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

type IdScheda = "prezzi" | "spazio" | "marche" | "reparti" | "meccaniche" | "pagine";

interface Scheda {
  id: IdScheda;
  etichetta: string;
  icona: string;
}

/**
 * Le analisi calcolate dal server per ogni GDO, senza bisogno della config dell'installazione: ci
 * sono sempre, anche dove flyerInsightsConfig.json manca.
 */
const SCHEDE_ANALISI: readonly Scheda[] = [
  { id: "prezzi", etichetta: "Prezzi e sconti", icona: "Euro" },
  { id: "spazio", etichetta: "Spazio", icona: "LayoutTemplate" },
  { id: "marche", etichetta: "Marche", icona: "Award" },
];

/** I riepiloghi di sempre: grafici e colori vengono dalla config, che puo' spegnerli (enabled: false). */
const SCHEDE_CONFIG: ReadonlyArray<Scheda & { id: "reparti" | "meccaniche" | "pagine" }> = [
  { id: "reparti", etichetta: "Reparti", icona: "LayoutGrid" },
  { id: "meccaniche", etichetta: "Meccaniche", icona: "Tag" },
  { id: "pagine", etichetta: "Pagine", icona: "FileText" },
];

/**
 * Le schede di analisi del volantino. La sintesi dei numeri e il volantino sfogliabile li mette la
 * pagina (SintesiInsight e VolantinoSfogliabile), fuori da qui.
 */
const FlyerInsights: FC<FlyerInsightsProps> = ({
  insights,
  isLoading = false,
  paginaSelezionata,
  className,
  exportCodes
}) => {
  // Con una pagina nell'indirizzo si apre il riepilogo per pagina, altrimenti la prima analisi
  const [activeTab, setActiveTab] = useState<IdScheda>(paginaSelezionata !== undefined ? "pagine" : "prezzi");
  const [selectedPage, setSelectedPage] = useState<number | null>(paginaSelezionata ?? null);
  const { data: insightsConfig, isError: configNonDisponibile } = useFetchFlyerInsightsConfig();

  // IMPORTANTE: tutti gli hooks devono essere chiamati prima dei return condizionali
  const tabs = useMemo<Scheda[]>(() => {
    // Senza config (file assente o non letto) i riepiloghi non si possono disegnare: restano le analisi.
    // Mentre si carica le schede ci sono, con lo spinner; una sezione che la config non ha si toglie.
    const conConfig = SCHEDE_CONFIG.filter(scheda => {
      if (configNonDisponibile) return false;
      if (!insightsConfig) return true;
      const sezione = insightsConfig[scheda.id];
      return Boolean(sezione) && sezione.enabled !== false;
    });
    return [...SCHEDE_ANALISI, ...conConfig];
  }, [insightsConfig, configNonDisponibile]);

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
  // Le sezioni nuove possono mancare in una risposta di un server non ancora aggiornato: la scheda
  // lo dice invece di rompere la pagina
  const copertura = insights.sintesi?.copertura;
  const box = insights.box ?? [];

  const caricamentoConfig = (
    <div className="flex items-center justify-center py-12">
      <Spinner size="md" />
    </div>
  );

  const nonDisponibile = (
    <div className="p-4">
      <EmptyState
        compatta
        icon="ChartColumn"
        title="Analisi non disponibile"
        description="Per questo volantino il server non ha restituito questa analisi."
      />
    </div>
  );

  const contenuto = (id: IdScheda) => {
    switch (id) {
      case "prezzi":
        return insights.prezziSconti ? <PrezziSconti prezziSconti={insights.prezziSconti} box={box} copertura={copertura} /> : nonDisponibile;
      case "spazio":
        return insights.spazio ? <UsoSpazio spazio={insights.spazio} copertura={copertura} /> : nonDisponibile;
      case "marche":
        return insights.marche ? <MarcheVolantino marche={insights.marche} copertura={copertura} /> : nonDisponibile;
      case "pagine":
        return insightsConfig ? (
          <RiepilogoPagine
            riepilogo={insights.riepilogoPagine}
            selectedPage={selectedPage}
            onSelectPage={setSelectedPage}
            config={insightsConfig.pagine}
          />
        ) : caricamentoConfig;
      case "reparti":
        return insightsConfig ? (
          <RiepilogoReparti riepilogo={insights.riepilogoReparti} config={insightsConfig.reparti} />
        ) : caricamentoConfig;
      case "meccaniche":
        return insightsConfig ? (
          <RiepilogoMeccaniche riepilogo={insights.riepilogoMeccaniche} config={insightsConfig.meccaniche} />
        ) : caricamentoConfig;
    }
  };

  return (
    <div className={clsx("space-y-4", className)}>
      <Tab.Group
        className="space-y-4"
        selectedIndex={indiceTab}
        onChange={(indice: number) => setActiveTab(tabs[indice].id)}
      >
        <Tab.List variant="boxed-tabs" aria-label="Analisi del volantino">
          {tabs.map(tab => (
            <Tab key={tab.id}>
              <Tab.Button
                as="button"
                title={tab.etichetta}
                className="flex w-full items-center justify-center gap-2 whitespace-nowrap text-xs font-medium"
              >
                <Lucide icon={tab.icona} aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only lg:not-sr-only">{tab.etichetta}</span>
              </Tab.Button>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="rounded-card border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
          {tabs.map(tab => (
            <Tab.Panel key={tab.id}>{contenuto(tab.id)}</Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default FlyerInsights;
