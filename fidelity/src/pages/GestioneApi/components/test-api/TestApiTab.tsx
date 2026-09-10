import { useState } from "react";
import { FormSelect } from "@/components/Base/Form";
import type { ApiEndpoint } from "../../hooks/useApiTesting";
import type { FieldOption, Template } from "../../types";
import type { TipiDiExportResponseDTO } from "../../../../../server/core/dto";
import GetRefsTestPanel from "./GetRefsTestPanel";
import GetFilesTestPanel from "./GetFilesTestPanel";

interface TestApiTabProps {
  apiKey: string;
  template: Template[];
  fieldOptions: FieldOption[];
  tipiExport: TipiDiExportResponseDTO[];
  metadataFields: string[];
  selectedEndpoint: ApiEndpoint;
  onEndpointChange: (endpoint: ApiEndpoint) => void;
  testData: string;
  testResponse: string;
  isLoading: boolean;
  onTest: () => void;
  onUpdateTestData: (data: string) => void;
  onUpdateTestResponse: (data: string) => void;
}

function TestApiTab({
  apiKey,
  template,
  fieldOptions,
  tipiExport,
  metadataFields,
  selectedEndpoint,
  onEndpointChange,
  testData,
  testResponse,
  isLoading,
  onTest,
  onUpdateTestData,
  onUpdateTestResponse
}: TestApiTabProps) {
  return (
    <div className="space-y-6">
      {/* Selettore Endpoint */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Endpoint da testare:
        </label>
        <FormSelect
          value={selectedEndpoint}
          onChange={(e) => onEndpointChange(e.target.value as ApiEndpoint)}
          className="w-64"
        >
          <option value="refs">GET Referenze (JSON)</option>
          <option value="refs-html">GET Referenze (HTML)</option>
          <option value="files">GET Files</option>
        </FormSelect>
      </div>

      {/* Panel specifici per endpoint */}
      {selectedEndpoint === "refs" && (
        <GetRefsTestPanel
          fieldOptions={fieldOptions}
          apiKey={apiKey}
          isLoading={isLoading}
          testResponse={testResponse}
          onTest={onTest}
          onUpdateTestData={onUpdateTestData}
          onUpdateTestResponse={onUpdateTestResponse}
          template={template}
        />
      )}

      {selectedEndpoint === "refs-html" && (
        <GetRefsTestPanel
          fieldOptions={fieldOptions}
          apiKey={apiKey}
          isLoading={isLoading}
          testResponse={testResponse}
          onTest={onTest}
          onUpdateTestData={onUpdateTestData}
          onUpdateTestResponse={onUpdateTestResponse}
          template={template}
        />
      )}

      {selectedEndpoint === "files" && (
        <GetFilesTestPanel
          apiKey={apiKey}
          isLoading={isLoading}
          testResponse={testResponse}
          onTest={onTest}
          onUpdateTestData={onUpdateTestData}
          onUpdateTestResponse={onUpdateTestResponse}
          tipiExport={tipiExport}
          metadataFields={metadataFields}
        />
      )}
    </div>
  );
}

export default TestApiTab;
