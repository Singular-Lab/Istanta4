import { useCallback, useState } from "react";
import { ServerCall } from "../../../../lib/server_call";

export type ApiEndpoint = "refs" | "files" | "refs-html";

export function useApiTesting() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>("refs");
  const [testData, setTestData] = useState("{}");
  const [testResponse, setTestResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // Esegue il test dell'endpoint
  const executeTest = useCallback(async (
    apiKey: string,
    endpoint: ApiEndpoint,
    data: string,
    isTestMode: boolean = false
  ) => {
    if (!isTestMode && !apiKey) {
      setTestResponse(JSON.stringify({
        error: "API Key mancante",
        message: "Genera o inserisci una API key prima di testare, oppure attiva la Modalità Test"
      }, null, 2));
      return;
    }

    setIsLoading(true);
    setTestResponse("");

    try {
      const requestBody = JSON.parse(data);

      const apiEndpoint = isTestMode
        ? `/external/test/${endpoint}`
        : `/external/${endpoint}`;

      const url = ServerCall.getUrl();

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (!isTestMode && apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(`${url}${apiEndpoint}`, {
        method: 'POST',
        headers,
        credentials: isTestMode ? 'include' : 'omit',
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      setTestResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      setTestResponse(JSON.stringify({
        error: "Errore durante il test",
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
        details: "Verifica la sintassi JSON e riprova"
      }, null, 2));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset del test
  const resetTest = useCallback(() => {
    setTestData("{}");
    setTestResponse("");
  }, []);

  return {
    selectedEndpoint,
    setSelectedEndpoint,
    testData,
    setTestData,
    testResponse,
    setTestResponse,
    isLoading,
    testMode,
    setTestMode,
    executeTest,
    resetTest
  };
}
