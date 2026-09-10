import { useState, useEffect } from "react";
import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import { useNotification } from "../../../../context/NotificationContext";
import { operatorOptions } from "../../constants";
import type { GetFilesTestPanelProps, FilterCondition } from "../../types";
import FilterValueInput from "./FilterValueInput";
import MonacoJsonViewer from "./MonacoJsonViewer";

function GetFilesTestPanel({ apiKey, isLoading, testResponse, onTest, onUpdateTestData, onUpdateTestResponse, tipiExport, metadataFields, testMode }: GetFilesTestPanelProps) {
  // Inizializza selectedTipoExport con i primi 3 tipi dalla lista (se disponibili)
  const defaultSelectedTypes = tipiExport.slice(0, 3).map(t => t.codice);
  const [selectedTipoExport, setSelectedTipoExport] = useState<string[]>(defaultSelectedTypes);
  const [filterGroups, setFilterGroups] = useState<FilterCondition[][]>([[]]);
  const [responseSearch, setResponseSearch] = useState("");
  const [showSearchInResponse, setShowSearchInResponse] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenSearch, setFullscreenSearch] = useState("");

  const { showNotification } = useNotification();

  // Campi disponibili per i metadati dei files (dal database)
  const fileMetadataFields = metadataFields.map(field => {
    // Per campi annidati (es: customData.reparto), formatta meglio il label
    const parts = field.split('.');
    const label = parts.length > 1
      ? parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' → ')
      : field.charAt(0).toUpperCase() + field.slice(1);

    return {
      value: field,
      label
    };
  });

  // Aggiorna il JSON quando cambiano i parametri
  useEffect(() => {
    const validFilters = filterGroups.filter(group =>
      group.length > 0 && group.some(filter => filter.field && filter.operator && filter.value)
    );

    const jsonData = {
      ...(selectedTipoExport.length > 0 && { tipo_export: selectedTipoExport }),
      ...(validFilters.length > 0 && { filters: validFilters })
    };
    onUpdateTestData(JSON.stringify(jsonData, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTipoExport, filterGroups]);

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
      tipo_export: selectedTipoExport.length > 0 ? selectedTipoExport : undefined,
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
            <h3 className="text-lg font-medium">Test chiamata per richiesta dei files</h3>
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
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-4">
              <div className="flex items-center">
                <Lucide icon="Info" className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">API Key necessaria per il testing</span>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Selezione Tipo Export */}
            <div>
              <FormLabel className="flex items-center">
                <Lucide icon="FileType" className="w-4 h-4 mr-2" />
                Tipo Export (Opzionale)
              </FormLabel>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {tipiExport.map((tipo) => (
                  <FormCheck key={tipo.codice} className="p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <FormCheck.Input
                      id={`tipo-${tipo.codice}`}
                      type="checkbox"
                      checked={selectedTipoExport.includes(tipo.codice)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTipoExport([...selectedTipoExport, tipo.codice]);
                        } else {
                          setSelectedTipoExport(selectedTipoExport.filter(t => t !== tipo.codice));
                        }
                      }}
                      className="mr-2 !rounded-md"
                    />
                    <FormCheck.Label htmlFor={`tipo-${tipo.codice}`}>
                      <div className="font-medium text-sm">{tipo.codice}</div>
                      <div className="text-xs text-slate-500">{tipo.nome}</div>
                    </FormCheck.Label>
                  </FormCheck>
                ))}
              </div>
            </div>

            {/* Gestione Filtri - Struttura simile a GetRefsTestPanel */}
            <div>
              <div className="flex items-center justify-between">
                <FormLabel className="flex items-center">
                  <Lucide icon="Filter" className="w-4 h-4 mr-2" />
                  Filtri sui Metadati (Opzionale)
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
                              {fileMetadataFields.map((field: any, i: number) => (
                                <option key={i} value={field.value}>{field.label}</option>
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
                              mode="files"
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
                  ...(selectedTipoExport.length > 0 && { tipo_export: selectedTipoExport }),
                  ...(filterGroups.filter(g => g.length > 0 && g.some(f => f.field && f.operator && f.value)).length > 0 && {
                    filters: filterGroups.filter(g => g.length > 0 && g.some(f => f.field && f.operator && f.value))
                  })
                }, null, 2)}
              </pre>
            </div>

            <Button
              variant="primary"
              onClick={onTest}
              disabled={isLoading || (!testMode && !apiKey)}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Testing getFiles...
                </>
              ) : (
                <>
                  <Lucide icon="Play" className="w-4 h-4 mr-2" />
                  Esegui Test getFiles
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
                      const blob = new Blob([testResponse], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `getFiles-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
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
              className="rounded-lg"
            />
          </div>

          {testResponse && (
            <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Caratteri: {testResponse.length} |
                Righe: {testResponse.split('\n').length}
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
            <span className="font-semibold">Risposta getFiles</span>
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
                  a.download = `getFiles-response-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
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

export default GetFilesTestPanel;
