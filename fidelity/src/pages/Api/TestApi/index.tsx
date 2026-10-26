import { FormSelect, FormSwitch } from "@/components/Base/Form";
import PageHeader from "@/components/Base/PageHeader";
import withSessionCheck from "@/components/SessionChecker";
import clsx from "clsx";
import { useLoaderData } from "react-router-dom";
import { useFetchFieldOptions, useFetchFilesMetadataFields, useFetchTipiExportPOP } from "../../../query/query";
import GetFilesTestPanel from "../../GestioneApi/components/test-api/GetFilesTestPanel";
import GetRefsTestPanel from "../../GestioneApi/components/test-api/GetRefsTestPanel";
import { useApiTesting, type ApiEndpoint } from "../../GestioneApi/hooks/useApiTesting";
import type { Template } from "../../GestioneApi/types";

interface LoaderData {
  apiKey: string;
  template: Template[];
}

const endpointDescriptions: Record<ApiEndpoint, string> = {
  refs: "Recupera referenze in formato JSON.",
  "refs-html": "Recupera referenze in formato HTML.",
  files: "Recupera file e metadati associati."
};

function TestApiPage() {
  const { apiKey, template: templateLoader } = useLoaderData<LoaderData>();

  const {
    selectedEndpoint,
    setSelectedEndpoint,
    testData,
    setTestData,
    testResponse,
    setTestResponse,
    isLoading: isTestingApi,
    testMode,
    setTestMode,
    executeTest
  } = useApiTesting();

  const { data: fieldOptions = [] } = useFetchFieldOptions();
  const { data: tipiExportData } = useFetchTipiExportPOP();
  const { data: metadataFields = [] } = useFetchFilesMetadataFields();

  const tipiExport = Array.isArray(tipiExportData) ? tipiExportData : [];
  const template = templateLoader || [];

  const handleTest = () => {
    executeTest(apiKey, selectedEndpoint, testData, testMode);
  };

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <PageHeader
          title="Test API"
          description="Console per testare gli endpoint API"
        />

        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5">
              <div className="space-y-6">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 xl:col-span-8">
                    <div
                      className={clsx(
                        "h-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors",
                        testMode
                          ? "bg-amber-50 border-amber-400 dark:bg-amber-900/20 dark:border-amber-600"
                          : "bg-slate-50 border-slate-200 dark:bg-darkmode-800 dark:border-darkmode-600"
                      )}
                    >
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {testMode ? "Modalita Test Attiva" : "Modalita Produzione"}
                          </p>
                          {testMode && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 uppercase tracking-wider">
                              TEST
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {testMode
                            ? "Bypass validita promo attivo — tutti i dati sono visibili. Autenticazione tramite sessione corrente."
                            : "Filtro validita promo attivo. Richiede API Key per autenticarsi."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <FormSwitch>
                          <FormSwitch.Input
                            type="checkbox"
                            checked={testMode}
                            onChange={(e) => setTestMode(e.target.checked)}
                            className={testMode ? "checked:bg-amber-500 checked:border-amber-500" : ""}
                          />
                        </FormSwitch>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 xl:col-span-4">
                    <div className="h-full rounded-lg border border-slate-200 bg-slate-50 dark:bg-darkmode-800 dark:border-darkmode-600 p-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Endpoint da testare
                      </label>
                      <FormSelect
                        value={selectedEndpoint}
                        onChange={(e) => setSelectedEndpoint(e.target.value as ApiEndpoint)}
                        className="w-full mt-2"
                      >
                        <option value="refs">GET Referenze (JSON)</option>
                        <option value="refs-html">GET Referenze (HTML)</option>
                        <option value="files">GET Files</option>
                      </FormSelect>
                      <p className="text-xs text-slate-500 mt-2">
                        {endpointDescriptions[selectedEndpoint]}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  {selectedEndpoint === "refs" && (
                    <GetRefsTestPanel
                      fieldOptions={fieldOptions}
                      apiKey={apiKey}
                      isLoading={isTestingApi}
                      testResponse={testResponse}
                      onTest={handleTest}
                      onUpdateTestData={setTestData}
                      onUpdateTestResponse={setTestResponse}
                      template={template}
                      testMode={testMode}
                    />
                  )}

                  {selectedEndpoint === "refs-html" && (
                    <GetRefsTestPanel
                      fieldOptions={fieldOptions}
                      apiKey={apiKey}
                      isLoading={isTestingApi}
                      testResponse={testResponse}
                      onTest={handleTest}
                      onUpdateTestData={setTestData}
                      onUpdateTestResponse={setTestResponse}
                      template={template}
                      testMode={testMode}
                    />
                  )}

                  {selectedEndpoint === "files" && (
                    <GetFilesTestPanel
                      apiKey={apiKey}
                      isLoading={isTestingApi}
                      testResponse={testResponse}
                      onTest={handleTest}
                      onUpdateTestData={setTestData}
                      onUpdateTestResponse={setTestResponse}
                      tipiExport={tipiExport}
                      metadataFields={metadataFields}
                      testMode={testMode}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(TestApiPage);
