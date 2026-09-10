import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import { useLoaderData } from "react-router-dom";
import withSessionCheck from "../../components/SessionChecker";
import { useFetchFieldOptions, useFetchFilesMetadataFields, useFetchTipiExport } from "../../query/query";
import ApiKeysTab from "./components/api-keys/ApiKeysTab";
import PluginTab from "./components/plugin/PluginTab";
import StatisticsTab from "./components/statistics/StatisticsTab";
import TestApiTab from "./components/test-api/TestApiTab";
import { useApiKeyManagement } from "./hooks/useApiKeyManagement";
import { useApiTesting } from "./hooks/useApiTesting";
import { useStatistics } from "./hooks/useStatistics";
import type { Template } from "./types";

interface LoaderData {
  apiKey: string;
  template: Template[];
  template_filters: {
    success: boolean;
    data: any[];
    timestamp: Date;
  };
}

function GestioneApi() {
  const { apiKey: apiKeyLoader, template: templateLoader, template_filters } = useLoaderData<LoaderData>();

  // Custom hooks
  const { apiKey, copied, isGenerating, generateKey, copyToClipboard, setApiKey } = useApiKeyManagement(apiKeyLoader);
  const {
    selectedEndpoint,
    setSelectedEndpoint,
    testData,
    setTestData,
    testResponse,
    setTestResponse,
    isLoading: isTestingApi,
    executeTest
  } = useApiTesting();
  const {
    stats,
    statsLoading,
    statsError,
    refetchStats
  } = useStatistics();

  // Fetch options
  const { data: fieldOptions = [] } = useFetchFieldOptions();
  const { data: tipiExportData } = useFetchTipiExport();
  const { data: metadataFields = [] } = useFetchFilesMetadataFields();

  const tipiExport = Array.isArray(tipiExportData) ? tipiExportData : [];

  // Handler per il test API
  const handleTest = () => {
    executeTest(apiKey, selectedEndpoint, testData);
  };

  return (
    <>
      <PageHeader
        title="Gestione API"
        description="Gestisci e monitora le tue API di Istanta 2 GDO Suite: configura endpoint, visualizza statistiche di utilizzo, gestisci autenticazioni e monitora le performance in tempo reale."
      />

      <div className="mt-3.5">
        <Tab.Group className="flex flex-col gap-y-7">
          {/* Tab Navigation */}
          <div className="flex flex-col p-2 box box--stacked">
            <Tab.List
              variant="boxed-tabs"
              className="bg-transparent border-transparent"
            >
              <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.04] [&[aria-selected='true']_button]:border-primary/[0.15]">
                <Tab.Button
                  className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center"
                  as="button"
                >
                  <Lucide icon="Activity" className="w-4 h-4 stroke-[1.4]" />
                  Statistiche
                </Tab.Button>
              </Tab>
              <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.04] [&[aria-selected='true']_button]:border-primary/[0.15]">
                <Tab.Button
                  className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center"
                  as="button"
                >
                  <Lucide icon="TestTubeDiagonal" className="w-4 h-4 stroke-[1.4]" />
                  Test API
                </Tab.Button>
              </Tab>
              <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.04] [&[aria-selected='true']_button]:border-primary/[0.15]">
                <Tab.Button
                  className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center"
                  as="button"
                >
                  <Lucide icon="Key" className="w-4 h-4 stroke-[1.4]" />
                  API Keys
                </Tab.Button>
              </Tab>
              <Tab className="first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current [&[aria-selected='true']_button]:text-primary [&[aria-selected='true']_button]:font-medium [&[aria-selected='true']_button]:shadow-sm [&[aria-selected='true']_button]:bg-primary/[0.04] [&[aria-selected='true']_button]:border-primary/[0.15]">
                <Tab.Button
                  className="w-full text-slate-500 whitespace-nowrap rounded-[0.6rem] py-3 flex items-center gap-2 justify-center"
                  as="button"
                >
                  <Lucide icon="Code" className="w-4 h-4 stroke-[1.4]" />
                  Plugin
                </Tab.Button>
              </Tab>
            </Tab.List>
          </div>

          {/* Tab Panels */}
          <div className="flex flex-col p-5 box box--stacked">
            <Tab.Panels>
              {/* Tab Statistiche */}
              <Tab.Panel>
                <StatisticsTab
                  stats={stats}
                  isLoading={statsLoading}
                  error={statsError}
                  onRefresh={refetchStats}
                />
              </Tab.Panel>

              {/* Tab Test API */}
              <Tab.Panel>
                <TestApiTab
                  apiKey={apiKey}
                  template={templateLoader || []}
                  fieldOptions={fieldOptions}
                  tipiExport={tipiExport}
                  metadataFields={metadataFields}
                  selectedEndpoint={selectedEndpoint}
                  onEndpointChange={setSelectedEndpoint}
                  testData={testData}
                  testResponse={testResponse}
                  isLoading={isTestingApi}
                  onTest={handleTest}
                  onUpdateTestData={setTestData}
                  onUpdateTestResponse={setTestResponse}
                />
              </Tab.Panel>

              {/* Tab API Keys */}
              <Tab.Panel>
                <ApiKeysTab
                  apiKey={apiKey}
                  copied={copied}
                  isGenerating={isGenerating}
                  onGenerate={generateKey}
                  onCopy={copyToClipboard}
                />
              </Tab.Panel>

              {/* Tab Plugin */}
              <Tab.Panel>
                <PluginTab
                  templates={templateLoader || []}
                  filterTemplates={template_filters?.data || []}
                  tipiExport={tipiExport}
                  fieldOptions={fieldOptions}
                  apiKey={apiKey}
                />
              </Tab.Panel>
            </Tab.Panels>
          </div>
        </Tab.Group>
      </div>
    </>
  );
}

export default withSessionCheck(GestioneApi);
