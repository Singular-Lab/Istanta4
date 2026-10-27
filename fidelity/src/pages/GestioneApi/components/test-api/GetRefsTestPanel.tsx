import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
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
        <Sezione
          className="col-span-12 xl:col-span-6"
          titolo="Test chiamata per richiesta delle referenze"
          azioni={
            <>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={copyJsonToClipboard}
              >
                <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Copia JSON
              </Button>
            </>
          }
        >

            {!apiKey && !testMode && (
              <Alert variant="soft-warning" icona="Info" className="mb-4">
              API Key necessaria per il testing
            </Alert>
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
                    <FormCheck key={index} className="cursor-pointer rounded-control border border-slate-200 p-3 hover:bg-slate-50">
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
                        className="mr-3"
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
                    <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Gruppo Filtro
                  </Button>
                </div>

                <div className="space-y-4 mt-3">
                  {filterGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="rounded-card border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-600">
                          Gruppo {groupIndex + 1} {groupIndex > 0 && <span className="text-xs text-slate-400">(OR)</span>}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => addFilterToGroup(groupIndex)}
                            aria-label="Aggiungi filtro al gruppo"
                          >
                            <Lucide aria-hidden="true" icon="Plus" className="w-3 h-3" />
                          </Button>
                          {filterGroups.length > 1 && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => removeFilterGroup(groupIndex)}
                              aria-label="Rimuovi gruppo"
                            >
                              <Lucide aria-hidden="true" icon="Trash2" className="w-3 h-3" />
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
                                aria-label="Rimuovi filtro"
                              >
                                <Lucide aria-hidden="true" icon="X" className="w-3 h-3" />
                              </Button>
                            </div>
                            {filterIndex < group.length - 1 && (
                              <div className="col-span-12 text-center">
                                <Badge variant="secondary" size="sm">AND</Badge>
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
                              <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
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
              <div className="rounded-card border border-slate-200 p-4">
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

                  <div className="rounded-control bg-slate-50 p-2 text-xs text-slate-500">
                    💡 <strong>Suggerimento:</strong> Per risposte molto grandi, abilita la limitazione
                    per migliorare le performance. Puoi sempre scaricare il file completo.
                  </div>
                </div>
              </div>

              {/* Preview JSON Richiesta */}
              <div className="rounded-card border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="title-eyebrow">JSON Richiesta (Preview)</span>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={copyJsonToClipboard}
                  >
                    <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Copia
                  </Button>
                </div>
                <pre className="max-h-40 overflow-auto rounded-control border border-slate-200 bg-white p-3 text-xs">
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
                loading={isLoading}
              >
                {!isLoading && <Lucide icon="Play" aria-hidden="true" className="mr-2 h-4 w-4" />}
                {isLoading ? "Test getRefs in corso..." : "Esegui Test getRefs"}
              </Button>
            </div>
        </Sezione>

        <Sezione
          className="col-span-12 xl:col-span-6"
          titolo="Risposta"
          azioni={
            <>
              <div className="flex gap-2">
                {testResponse && (
                  <>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => { setFullscreenSearch(""); setFullscreenOpen(true); }}
                    >
                      <Lucide icon="Maximize2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
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
                      <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
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
                      <Lucide icon="Code" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
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
                      <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </>
          }
        >

            {testResponse && (
              <div className="mb-4">
                <CampoRicerca
                etichetta="Cerca nella risposta"
                placeholder="Cerca nella risposta…"
                value={responseSearch}
                onChange={setResponseSearch}
                className="sm:w-full"
              />
              </div>
            )}

            <div className="overflow-hidden rounded-card">
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
        </Sezione>
      </div>

      {/* Dialog fullscreen risposta */}
      <Dialog
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        size="2xl"
        centered
      >
        <Dialog.Panel className="flex h-[calc(100vh-8rem)] flex-col">
          <Dialog.Title>Risposta getRefs</Dialog.Title>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/60 px-5 py-3">
                <CampoRicerca
                etichetta="Cerca nella risposta"
                placeholder="Cerca nella risposta…"
                value={fullscreenSearch}
                onChange={setFullscreenSearch}
                className="sm:w-56"
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
                  <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
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
                  <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
          <div className="flex-1 min-h-0 p-3">
            <MonacoJsonViewer
              value={testResponse}
              searchTerm={fullscreenSearch}
              height="calc(100vh - 21rem)"
            />
          </div>
          {testResponse && (
            <div className="px-5 py-2 text-xs text-slate-500 border-t border-slate-200/60 flex items-center gap-4">
              <span>Caratteri: {testResponse.length}</span>
              <span>Righe: {testResponse.split('\n').length}</span>
              {fullscreenSearch && (
                <span className="text-warning">
                  Trovati: {testResponse.split(new RegExp(fullscreenSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).length - 1}
                </span>
              )}
            </div>
          )}
          <Dialog.Footer>
            <Button variant="outline-secondary" onClick={() => setFullscreenOpen(false)}>
              Chiudi
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </>
  );
}

export default GetRefsTestPanel;
