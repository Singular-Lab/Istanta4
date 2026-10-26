import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Editor from "@monaco-editor/react";
import clsx from "clsx";
import { useCallback, useRef, useState } from 'react';
import { ServerCall } from "../../../lib/server_call";

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

interface TryItPanelProps {
  endpoint: string;
  method: "GET" | "POST";
  apiKey?: string;
  templates?: Array<{ guidId: string; titolo: string }>;
  tipiExport?: Array<{ codice: string; descrizione?: string }>;
  fieldOptions?: string[];
  className?: string;
  // Tipo di endpoint per mostrare campi appropriati
  endpointType: "refs" | "files" | "promo" | "status";
}

export default function TryItPanel({
  endpoint,
  method,
  apiKey,
  templates = [],
  tipiExport = [],
  fieldOptions = [],
  className,
  endpointType
}: TryItPanelProps) {
  // Stati per la configurazione della richiesta
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedTipoExport, setSelectedTipoExport] = useState<string[]>([]);
  const [filterGroups, setFilterGroups] = useState<FilterCondition[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [copied, setCopied] = useState(false);

  const editorRef = useRef<any>(null);

  // Gestione Monaco Editor
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('tryit-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '9CDCFE' },
        { token: 'string.value.json', foreground: 'CE9178' },
        { token: 'number.json', foreground: 'B5CEA8' },
        { token: 'keyword.json', foreground: '569CD6' }
      ],
      colors: {
        'editor.background': '#1e293b',
        'editor.foreground': '#e2e8f0'
      }
    });
    editor.updateOptions({ theme: 'tryit-theme' });
  };

  // Costruisce il body della richiesta
  const buildRequestBody = useCallback(() => {
    const body: Record<string, any> = {};

    if (endpointType === "refs") {
      if (selectedTemplates.length > 0) {
        body.template_id = selectedTemplates;
      }
    }

    if (endpointType === "files" && selectedTipoExport.length > 0) {
      body.tipo_export = selectedTipoExport;
    }

    if (filterGroups.length > 0 && filterGroups.some(g => g.length > 0)) {
      body.filters = filterGroups.filter(g => g.length > 0);
    }

    return body;
  }, [selectedTemplates, selectedTipoExport, filterGroups, endpointType]);

  // Esegue la chiamata API
  const executeRequest = async () => {
    if (!apiKey) {
      setResponse(JSON.stringify({ error: "API Key non disponibile. Genera una API Key dalla sezione Gestione API." }, null, 2));
      setResponseStatus(401);
      setShowResponse(true);
      return;
    }

    setIsLoading(true);
    setShowResponse(true);
    const startTime = performance.now();

    try {
      const url = `${ServerCall.getUrl()}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      };

      if (method === "POST") {
        options.body = JSON.stringify(buildRequestBody());
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setResponseStatus(res.status);

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setResponseStatus(500);
      setResponse(JSON.stringify({
        error: "Errore nella richiesta",
        message: error.message
      }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  // Copia la risposta
  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Errore copia:', err);
    }
  };

  // Aggiungi un gruppo di filtri
  const addFilterGroup = () => {
    setFilterGroups([...filterGroups, []]);
  };

  // Aggiungi un filtro a un gruppo
  const addFilter = (groupIndex: number) => {
    const newGroups = [...filterGroups];
    newGroups[groupIndex] = [...newGroups[groupIndex], { field: '', operator: 'equals', value: '' }];
    setFilterGroups(newGroups);
  };

  // Aggiorna un filtro
  const updateFilter = (groupIndex: number, filterIndex: number, key: keyof FilterCondition, value: string) => {
    const newGroups = [...filterGroups];
    newGroups[groupIndex][filterIndex] = { ...newGroups[groupIndex][filterIndex], [key]: value };
    setFilterGroups(newGroups);
  };

  // Rimuovi un filtro
  const removeFilter = (groupIndex: number, filterIndex: number) => {
    const newGroups = [...filterGroups];
    newGroups[groupIndex].splice(filterIndex, 1);
    if (newGroups[groupIndex].length === 0) {
      newGroups.splice(groupIndex, 1);
    }
    setFilterGroups(newGroups);
  };

  // Verifica se il pulsante deve essere disabilitato
  const isExecuteDisabled = () => {
    if (!apiKey) return true;
    if (isLoading) return true;
    if (endpointType === "refs" && selectedTemplates.length === 0) {
      return true;
    }
    return false;
  };

  // Operatori disponibili
  const operators = [
    { value: 'equals', label: 'Uguale a' },
    { value: 'not_equals', label: 'Diverso da' },
    { value: 'contains', label: 'Contiene' },
    { value: 'not_contains', label: 'Non contiene' },
    { value: 'greater_than', label: 'Maggiore di' },
    { value: 'less_than', label: 'Minore di' },
    { value: 'in', label: 'In (lista)' },
    { value: 'not_in', label: 'Non in (lista)' }
  ];

  return (
    <div className={clsx("mt-4 border border-primary/20 rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-primary/5 dark:bg-primary/10 px-4 py-3 flex items-center gap-2">
        <Lucide icon="Play" className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm text-primary">Prova questo endpoint</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Avviso se manca API Key */}
        {!apiKey && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-3">
            <Lucide icon="TriangleAlert" className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-warning font-medium">API Key non disponibile</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Per testare gli endpoint, genera prima una API Key dalla sezione{" "}
                <a href="/gestione-api" className="text-primary hover:underline">Gestione API</a>.
              </p>
            </div>
          </div>
        )}

        {/* Selezione Template (per refs) */}
        {endpointType === "refs" && templates.length > 0 && (
          <div>
            <FormLabel className="flex items-center gap-2 mb-2">
              <Lucide icon="Package" className="w-4 h-4" />
              Template (Obbligatorio)
            </FormLabel>
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2 bg-slate-50 dark:bg-darkmode-600">
              {templates.map((t) => (
                <FormCheck key={t.guidId} className="p-2 hover:bg-white dark:hover:bg-darkmode-500 rounded">
                  <FormCheck.Input
                    id={`tryit-${t.guidId}`}
                    type="checkbox"
                    checked={selectedTemplates.includes(t.guidId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTemplates([...selectedTemplates, t.guidId]);
                      } else {
                        setSelectedTemplates(selectedTemplates.filter(id => id !== t.guidId));
                      }
                    }}
                    className="mr-2"
                  />
                  <FormCheck.Label htmlFor={`tryit-${t.guidId}`} className="text-sm">
                    {t.titolo}
                  </FormCheck.Label>
                </FormCheck>
              ))}
            </div>
          </div>
        )}

        {/* Selezione Tipo Export (per files) */}
        {endpointType === "files" && tipiExport.length > 0 && (
          <div>
            <FormLabel className="flex items-center gap-2 mb-2">
              <Lucide icon="FileType" className="w-4 h-4" />
              Tipo Export (Opzionale)
            </FormLabel>
            <div className="grid grid-cols-3 gap-2">
              {tipiExport.map((tipo) => (
                <FormCheck key={tipo.codice} className="p-2 border rounded hover:bg-slate-50 dark:hover:bg-darkmode-600">
                  <FormCheck.Input
                    id={`tryit-tipo-${tipo.codice}`}
                    type="checkbox"
                    checked={selectedTipoExport.includes(tipo.codice)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTipoExport([...selectedTipoExport, tipo.codice]);
                      } else {
                        setSelectedTipoExport(selectedTipoExport.filter(t => t !== tipo.codice));
                      }
                    }}
                    className="mr-2"
                  />
                  <FormCheck.Label htmlFor={`tryit-tipo-${tipo.codice}`} className="text-xs">
                    {tipo.codice}
                  </FormCheck.Label>
                </FormCheck>
              ))}
            </div>
          </div>
        )}

        {/* Sezione Filtri (per refs e files) */}
        {(endpointType === "refs" || endpointType === "files") && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <FormLabel className="flex items-center gap-2 mb-0">
                <Lucide icon="Filter" className="w-4 h-4" />
                Filtri (Opzionale)
              </FormLabel>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={addFilterGroup}
                className="text-xs"
              >
                <Lucide icon="Plus" className="w-3 h-3 mr-1" />
                Aggiungi Gruppo
              </Button>
            </div>

            {filterGroups.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nessun filtro applicato. Clicca "Aggiungi Gruppo" per filtrare i risultati.
              </p>
            ) : (
              <div className="space-y-3">
                {filterGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="border rounded-lg p-3 bg-slate-50 dark:bg-darkmode-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Gruppo {groupIndex + 1} (AND)
                      </span>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => addFilter(groupIndex)}
                        className="text-xs"
                      >
                        <Lucide icon="Plus" className="w-3 h-3 mr-1" />
                        Filtro
                      </Button>
                    </div>

                    {group.map((filter, filterIndex) => (
                      <div key={filterIndex} className="flex items-center gap-2 mb-2">
                        <FormSelect
                          value={filter.field}
                          onChange={(e) => updateFilter(groupIndex, filterIndex, 'field', e.target.value)}
                          className="flex-1 text-xs"
                        >
                          <option value="">Seleziona campo...</option>
                          {fieldOptions.map(field => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </FormSelect>

                        <FormSelect
                          value={filter.operator}
                          onChange={(e) => updateFilter(groupIndex, filterIndex, 'operator', e.target.value)}
                          className="w-32 text-xs"
                        >
                          {operators.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </FormSelect>

                        <FormInput
                          type="text"
                          value={filter.value}
                          onChange={(e) => updateFilter(groupIndex, filterIndex, 'value', e.target.value)}
                          placeholder="Valore"
                          className="flex-1 text-xs"
                        />

                        <Button
                          variant="soft-danger"
                          size="sm"
                          onClick={() => removeFilter(groupIndex, filterIndex)}
                          className="p-1"
                        >
                          <Lucide icon="X" className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}

                    {group.length === 0 && (
                      <p className="text-xs text-slate-400">Clicca "Filtro" per aggiungere condizioni</p>
                    )}
                  </div>
                ))}

                {filterGroups.length > 1 && (
                  <p className="text-xs text-slate-500 text-center">
                    I gruppi sono combinati con OR (almeno uno deve corrispondere)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preview Request Body */}
        {method === "POST" && (endpointType === "refs" || endpointType === "files") && (
          <div>
            <FormLabel className="flex items-center gap-2 mb-2">
              <Lucide icon="Code" className="w-4 h-4" />
              Request Body Preview
            </FormLabel>
            <pre className="bg-slate-800 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(buildRequestBody(), null, 2) || "{}"}
            </pre>
          </div>
        )}

        {/* Pulsante Esegui */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={executeRequest}
            disabled={isExecuteDisabled()}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                Esecuzione...
              </>
            ) : (
              <>
                <Lucide icon="Play" className="w-4 h-4 mr-2" />
                Esegui Richiesta
              </>
            )}
          </Button>

          {showResponse && response && (
            <Button
              variant="outline-secondary"
              onClick={copyResponse}
              disabled={copied}
            >
              {copied ? (
                <>
                  <Lucide icon="Check" className="w-4 h-4 mr-1" />
                  Copiato!
                </>
              ) : (
                <>
                  <Lucide icon="Copy" className="w-4 h-4 mr-1" />
                  Copia
                </>
              )}
            </Button>
          )}
        </div>

        {/* Risposta */}
        {showResponse && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <FormLabel className="flex items-center gap-2 mb-0">
                <Lucide icon="FileJson" className="w-4 h-4" />
                Risposta
              </FormLabel>
              <div className="flex items-center gap-3 text-xs">
                {responseStatus && (
                  <span className={clsx(
                    "px-2 py-1 rounded font-medium",
                    responseStatus >= 200 && responseStatus < 300
                      ? "bg-success/10 text-success"
                      : "bg-danger/10 text-danger"
                  )}>
                    Status: {responseStatus}
                  </span>
                )}
                {responseTime !== null && (
                  <span className="text-slate-500">
                    {responseTime}ms
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-darkmode-400">
              <Editor
                height="300px"
                language="json"
                value={response}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  fontSize: 12,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                }}
                onMount={handleEditorDidMount}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
