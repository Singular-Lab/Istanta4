import { FormLabel, FormSelect, FormSwitch } from "@/components/Base/Form";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
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
    <Pagina titolo="Test API" descrizione="Console per testare gli endpoint API">
      <Sezione titolo="Configurazione del test" descrizione="Modalità di autenticazione ed endpoint da chiamare">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8">
            <div
              className={clsx(
                "flex h-full items-center justify-between gap-4 rounded-card border p-4 transition-colors",
                testMode ? "border-warning/40 bg-warning/5" : "border-slate-200 bg-slate-50"
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="title-card">
                    {testMode ? "Modalità Test Attiva" : "Modalità Produzione"}
                  </h3>
                  {testMode && <StatusBadge tono="warning" etichetta="Test" />}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {testMode
                    ? "Bypass validità promo attivo — tutti i dati sono visibili. Autenticazione tramite sessione corrente."
                    : "Filtro validità promo attivo. Richiede API Key per autenticarsi."}
                </p>
              </div>
              <FormSwitch>
                <FormSwitch.Input
                  type="checkbox"
                  aria-label="Modalità test"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className={testMode ? "checked:border-warning checked:bg-warning" : ""}
                />
              </FormSwitch>
            </div>
          </div>

          <div className="col-span-12 xl:col-span-4">
            <div className="h-full rounded-card border border-slate-200 bg-slate-50 p-4">
              <FormLabel htmlFor="endpoint-test" className="text-sm font-medium text-slate-700">
                Endpoint da testare
              </FormLabel>
              <FormSelect
                id="endpoint-test"
                value={selectedEndpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value as ApiEndpoint)}
                className="w-full"
              >
                <option value="refs">GET Referenze (JSON)</option>
                <option value="refs-html">GET Referenze (HTML)</option>
                <option value="files">GET Files</option>
              </FormSelect>
              <p className="mt-2 text-xs text-slate-500">
                {endpointDescriptions[selectedEndpoint]}
              </p>
            </div>
          </div>
        </div>
      </Sezione>

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
    </Pagina>
  );
}

export default withSessionCheck(TestApiPage);
