import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useEffect, useState } from "react";
import { useNotification } from "../../../../context/NotificationContext";
import { operatorOptions } from "../../constants";
import type { FilterCondition, GetRefsTestPanelProps } from "../../types";
import FilterValueInput from "./FilterValueInput";
import MonacoJsonViewer from "./MonacoJsonViewer";

function GetRefsTestPanel({ fieldOptions, apiKey, isLoading, testResponse, onTest, onUpdateTestData, onUpdateTestResponse, template, testMode }: GetRefsTestPanelProps) {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [filterGroups, setFilterGroups] = useState<FilterCondition[][]>([[]]);
  const [responseSearch, setResponseSearch] = useState("");
  const [showSearchInResponse, setShowSearchInResponse] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenSearch, setFullscreenSearch] = useState("");

  const { showNotification } = useNotification();

  const [limitResults, setLimitResults] = useState(true);
  const [maxResults, setMaxResults] = useState(100);

  // Aggiorna il JSON quando cambiano i parametri
  useEffect(() => {
    const jsonData = {
      template_id: selectedTemplates,
      filters: filterGroups.filter(group =>
        group.length > 0 && group.some(filter => filter.field && filter.operator && filter.value)
      ),
      ...(limitResults && { limit: maxResults })
    };
    onUpdateTestData(JSON.stringify(jsonData, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplates, filterGroups, limitResults, maxResults]);

  const addFilterGroup = () => {
    setFilterGroups([...filterGroups, []]);
  };

  const removeFilterGroup = (groupIndex: number) => {
    if (filterGroups.length > 1) {
      setFilterGroups(filterGroups.filter((_, index) => index !== groupIndex));
    }
  };

  const addFilterToGroup = (groupIndex: number) => {
    const newGroups = [...filterGroups];
    newGroups[groupIndex] = [...newGroups[groupIndex], { field: "", operator: "equals", value: "" }];
    setFilterGroups(newGroups);
  };

  const removeFilterFromGroup = (groupIndex: number, filterIndex: number) => {
    const newGroups = [...filterGroups];
    newGroups[groupIndex] = newGroups[groupIndex].filter((_, index) => index !== filterIndex);
    setFilterGroups(newGroups);
  };

  const updateFilter = (groupIndex: number, filterIndex: number, field: keyof FilterCondition, value: string) => {
    const newGroups = [...filterGroups];
    newGroups[groupIndex][filterIndex] = {
      ...newGroups[groupIndex][filterIndex],
      [field]: value
    };
    setFilterGroups(newGroups);
  };

  const copyJsonToClipboard = () => {
    const jsonData = {
      template_id: selectedTemplates,
      filters: filterGroups.filter(group =>
        group.length > 0 && group.some(filter => filter.field && filter.operator && filter.value)
      )
    };
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    showNotification(
      <div className="flex items-center">
        <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
        <div className="ml-3">
          <div className="font-semibold">JSON copiato negli appunti!</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6">
          <div className="box p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Test chiamata per richiesta delle referenze</h3>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={copyJsonToClipboard}
              >
                <Lucide icon="Copy" className="w-4 h-4 mr-1" />
                Copia JSON
              </Button>
            </div>

            {!apiKey && !testMode && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                <div className="flex items-center">
                  <Lucide icon="Info" className="w-4 h-4 text-amber-600 mr-2" />
                  <span className="text-sm font-medium text-amber-800">API Key necessaria per il testing</span>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Selezione Template */}
              <div>
                <FormLabel className="flex items-center">
                  <Lucide icon="Package" className="w-4 h-4 mr-2" />
                  Template (Obbligatorio)
                </FormLabel>
                <div className="space-y-2 mt-2">
                  {template.map((tmpl, index) => (
                    <FormCheck key={index} className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                      <FormCheck.Input
                        id={tmpl.guidId}
                        type="checkbox"
                        checked={selectedTemplates.includes(tmpl.guidId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTemplates([...selectedTemplates, tmpl.guidId]);
                          } else {
                            setSelectedTemplates(selectedTemplates.filter(id => id !== tmpl.guidId));
                          }
                        }}
                        className="mr-3 !rounded-md"
                      />
                      <FormCheck.Label htmlFor={tmpl.guidId}>
                        <div className="font-medium text-sm">{tmpl.titolo}</div>
                        <div className="text-xs text-slate-500">{tmpl.guidId}</div>
                      </FormCheck.Label>
                    </FormCheck>
                  ))}
                </div>
              </div>

              {/* Gestione Filtri */}
              <div>
                <div className="flex items-center justify-between">
                  <FormLabel className="flex items-center">
                    <Lucide icon="Filter" className="w-4 h-4 mr-2" />
                    Filtri (Opzionale)
                  </FormLabel>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={addFilterGroup}
                  >
                    <Lucide icon="Plus" className="w-4 h-4 mr-1" />
                    Gruppo Filtro
                  </Button>
                </div>

                <div className="space-y-4 mt-3">
                  {filterGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-600">
                          Gruppo {groupIndex + 1} {groupIndex > 0 && <span className="text-xs text-slate-400">(OR)</span>}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => addFilterToGroup(groupIndex)}
                          >
                            <Lucide icon="Plus" className="w-3 h-3" />
                          </Button>
                          {filterGroups.length > 1 && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => removeFilterGroup(groupIndex)}
                            >
                              <Lucide icon="Trash2" className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {group.map((filter, filterIndex) => (
                          <div key={filterIndex} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4">
                              <FormSelect
                                value={filter.field}
                                onChange={(e) => updateFilter(groupIndex, filterIndex, 'field', e.target.value)}
                                className="text-sm"
                              >
                                <option value="">Campo</option>
                                {fieldOptions.map((field: any, i: number) => (
                                  <option key={i} value={field.expected_output || field.expected_input}>{field.expected_output || field.expected_input}</option>
                                ))}
                              </FormSelect>
                            </div>
                            <div className="col-span-3">
                              <FormSelect
                                value={filter.operator}
                                onChange={(e) => updateFilter(groupIndex, filterIndex, 'operator', e.target.value)}
                                className="text-sm"
                              >
                                {operatorOptions.map(op => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </FormSelect>
                            </div>
                            <div className="col-span-4">
                              <FilterValueInput
                                field={filter.field}
                                value={filter.value}
                                onChange={(value) => updateFilter(groupIndex, filterIndex, 'value', value)}
                                templateId={selectedTemplates}
                                mode="refs"
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeFilterFromGroup(groupIndex, filterIndex)}
                              >
                                <Lucide icon="X" className="w-3 h-3" />
                              </Button>
                            </div>
                            {filterIndex < group.length - 1 && (
                              <div className="col-span-12 text-center">
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">AND</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {group.length === 0 && (
                          <div className="text-center py-4">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => addFilterToGroup(groupIndex)}
                            >
                              <Lucide icon="Plus" className="w-4 h-4 mr-1" />
                              Aggiungi Filtro
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controlli Risultati */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <FormLabel className="flex items-center">
                    <Lucide icon="Settings" className="w-4 h-4 mr-2" />
                    Controlli Risultati
                  </FormLabel>
                </div>

                <div className="space-y-3">
                  <FormCheck>
                    <FormCheck.Input
                      type="checkbox"
                      id="limitResults"
                      checked={limitResults}
                      onChange={(e) => setLimitResults(e.target.checked)}
                      className="mr-3"
                    />
                    <FormCheck.Label htmlFor="limitResults" className="text-sm font-medium">
                      Limita numero risultati
                    </FormCheck.Label>
                  </FormCheck>

                  {limitResults && (
                    <div className="flex items-center gap-3">
                      <FormLabel className="text-sm">Massimo:</FormLabel>
                      <FormInput
                        type="number"
                        value={maxResults}
                        onChange={(e) => setMaxResults(parseInt(e.target.value) || 100)}
                        min="1"
                        max="10000"
                        className="w-24 text-sm"
                      />
                      <span className="text-xs text-slate-500">risultati</span>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                    💡 <strong>Suggerimento:</strong> Per risposte molto grandi, abilita la limitazione
                    per migliorare le performance. Puoi sempre scaricare il file completo.
                  </div>
                </div>
              </div>

              {/* Preview JSON Richiesta */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">JSON Richiesta (Preview)</span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={copyJsonToClipboard}
                  >
                    <Lucide icon="Copy" className="w-3 h-3 mr-1" />
                    Copia
                  </Button>
                </div>
                <pre className="text-xs bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 overflow-auto max-h-40">
                  {JSON.stringify({
                    template_id: selectedTemplates,
                    ...(filterGroups.filter(g => g.length > 0 && g.some(f => f.field && f.operator && f.value)).length > 0 && {
                      filters: filterGroups.filter(g => g.length > 0 && g.some(f => f.field && f.operator && f.value))
                    }),
                    ...(limitResults && { limit: maxResults })
                  }, null, 2)}
                </pre>
              </div>

              <Button
                variant="primary"
                onClick={onTest}
                disabled={isLoading || template.length === 0 || (!testMode && !apiKey)}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                    Testing getRefs...
                  </>
                ) : (
                  <>
                    <Lucide icon="Play" className="w-4 h-4 mr-2" />
                    Esegui Test getRefs
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="box p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Risposta</h3>
              <div className="flex gap-2">
                {testResponse && (
                  <>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => { setFullscreenSearch(""); setFullscreenOpen(true); }}
                    >
                      <Lucide icon="Maximize2" className="w-4 h-4 mr-1" />
                      Espandi
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(testResponse);
                        showNotification(
                          <div className="flex items-center">
                            <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
                            <div className="ml-3">
                              <div className="font-semibold">Risposta copiata negli appunti!</div>
                            </div>
                          </div>
                        );
                      }}
                    >
                      <Lucide icon="Copy" className="w-4 h-4 mr-1" />
                      Copia
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(testResponse);
                          const formatted = JSON.stringify(parsed, null, 2);
                          onUpdateTestResponse(formatted);
                          showNotification(
                            <div className="flex items-center">
                              <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
                              <div className="ml-3">
                                <div className="font-semibold">JSON formattato!</div>
                              </div>
                            </div>
                          );
                        } catch (error) {
                          showNotification(
                            <div className="flex items-center">
                              <Lucide icon="CircleX" className="text-danger w-6 h-6" />
                              <div className="ml-3">
                                <div className="font-semibold">Errore nella formattazione JSON</div>
                              </div>
                            </div>
                          );
                        }
                      }}
                    >
                      <Lucide icon="Code" className="w-4 h-4 mr-1" />
                      Formatta
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([testResponse], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `getRefs-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showNotification(
                          <div className="flex items-center">
                            <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
                            <div className="ml-3">
                              <div className="font-semibold">File JSON scaricato!</div>
                            </div>
                          </div>
                        );
                      }}
                    >
                      <Lucide icon="Download" className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>

            {testResponse && showSearchInResponse && (
              <div className="mb-4">
                <FormInput
                  type="text"
                  placeholder="Cerca nella risposta..."
                  value={responseSearch}
                  onChange={(e) => setResponseSearch(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            <div className="rounded-lg overflow-hidden">
              <MonacoJsonViewer
                value={testResponse}
                searchTerm={responseSearch}
              />
            </div>

            {testResponse && (
              <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
                <span>
                  Caratteri: {testResponse.length} |
                  Righe: {testResponse.split('\n').length}
                  {responseSearch && (
                    <span className="ml-2 text-warning">
                      | Trovati: {testResponse.split(new RegExp(responseSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).length - 1}
                    </span>
                  )}
                </span>
                <span className="text-warning">
                  {testResponse.length > 10000 && "⚠️ Risposta molto grande - considera il download"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog fullscreen risposta */}
      <Dialog
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        size="xl"
        centered
      >
        <Dialog.Panel className="!w-[95vw] max-w-none h-[calc(100vh-8rem)] flex flex-col">
          <Dialog.Title>
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold">Risposta getRefs</span>
              <div className="flex items-center gap-2">
                <FormInput
                  type="text"
                  placeholder="Cerca nella risposta..."
                  value={fullscreenSearch}
                  onChange={(e) => setFullscreenSearch(e.target.value)}
                  className="w-56 h-8 text-sm"
                />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(testResponse);
                    showNotification(
                      <div className="flex items-center">
                        <Lucide icon="CircleCheck" className="text-success w-6 h-6" />
                        <div className="ml-3">
                          <div className="font-semibold">Risposta copiata negli appunti!</div>
                        </div>
                      </div>
                    );
                  }}
                >
                  <Lucide icon="Copy" className="w-4 h-4 mr-1" />
                  Copia
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([testResponse], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `getRefs-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Lucide icon="Download" className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setFullscreenOpen(false)}
                >
                  <Lucide icon="X" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Dialog.Title>
          <div className="flex-1 min-h-0 p-3">
            <MonacoJsonViewer
              value={testResponse}
              searchTerm={fullscreenSearch}
              height="calc(100vh - 14rem)"
            />
          </div>
          {testResponse && (
            <div className="px-5 py-2 text-xs text-slate-500 border-t border-slate-200/60 dark:border-darkmode-400 flex items-center gap-4">
              <span>Caratteri: {testResponse.length}</span>
              <span>Righe: {testResponse.split('\n').length}</span>
              {fullscreenSearch && (
                <span className="text-warning">
                  Trovati: {testResponse.split(new RegExp(fullscreenSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).length - 1}
                </span>
              )}
            </div>
          )}
        </Dialog.Panel>
      </Dialog>
    </>
  );
}

export default GetRefsTestPanel;
