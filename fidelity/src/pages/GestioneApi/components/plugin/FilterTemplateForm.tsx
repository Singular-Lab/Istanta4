import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormLabel, FormSelect, FormTextarea } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { TipiDiExportResponseDTO } from "../../../../../server/core/dto";
import { operatorOptions } from "../../constants";
import { useFilterTemplates } from "../../hooks/useFilterTemplates";
import type { FieldOption, FilterCondition, Template } from "../../types";
import FilterValueInput from "../test-api/FilterValueInput";
import FilterTemplateVersionHistory from "./FilterTemplateVersionHistory";

// Schema completo del form
const filterTemplateSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio").max(100, "Massimo 100 caratteri"),
  slug: z.string()
    .min(1, "Slug obbligatorio")
    .max(100, "Massimo 100 caratteri")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minuscole, numeri e trattini (es: template-promo)"),
  descrizione: z.string().optional().nullable(),
  endpoint_type: z.enum(['refs', 'refs-html', 'files']),
  render_type: z.enum(['grid', 'carousel', 'list']).optional().nullable(),
  template_ids: z.array(z.string()).default([]),
  export_codes: z.array(z.string()).default([]),
  auto_scroll: z.boolean().default(true),
  scroll_speed: z.coerce.number().min(1000, "Minimo 1000ms").max(30000, "Massimo 30000ms").default(5000),
  show_indicators: z.boolean().default(true),
  show_nav_buttons: z.boolean().default(true),
  meta_options: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true)
});

// I campi con default sono facoltativi in ingresso al form e sempre presenti dopo la validazione
type FilterTemplateFormInput = z.input<typeof filterTemplateSchema>;
type FilterTemplateFormData = z.output<typeof filterTemplateSchema>;

interface FilterTemplateFormProps {
  mode: 'create' | 'edit';
  template?: any;
  templates: Template[];
  tipiExport: TipiDiExportResponseDTO[];
  fieldOptions: FieldOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

function FilterTemplateForm({
  mode,
  template,
  templates,
  tipiExport,
  fieldOptions,
  onSuccess,
  onCancel
}: FilterTemplateFormProps) {
  const { create, update, deleteTemplate, restore, isCreating, isUpdating, isDeleting, isRestoring } = useFilterTemplates();

  // State per i filtri (come in GetRefsTestPanel)
  const [filterGroups, setFilterGroups] = useState<FilterCondition[][]>(
    template?.filters?.length > 0 ? template.filters : [[]]
  );

  const [metaOptionsJson, setMetaOptionsJson] = useState(
    template?.meta_options ? JSON.stringify(template.meta_options, null, 2) : '{}'
  );
  const [metaOptionsError, setMetaOptionsError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FilterTemplateFormInput, unknown, FilterTemplateFormData>({
    resolver: zodResolver(filterTemplateSchema),
    defaultValues: template ? {
      nome: template.nome || '',
      slug: template.slug || '',
      descrizione: template.descrizione || '',
      endpoint_type: template.endpoint_type || 'refs',
      render_type: template.render_type || 'grid',
      template_ids: template.template_ids || [],
      export_codes: template.export_codes || [],
      auto_scroll: template.auto_scroll ?? true,
      scroll_speed: template.scroll_speed || 5000,
      show_indicators: template.show_indicators ?? true,
      show_nav_buttons: template.show_nav_buttons ?? true,
      meta_options: template.meta_options || {},
      is_active: template.is_active ?? true
    } : {
      nome: '',
      slug: '',
      descrizione: '',
      endpoint_type: 'refs',
      render_type: 'grid',
      template_ids: [],
      export_codes: [],
      auto_scroll: true,
      scroll_speed: 5000,
      show_indicators: true,
      show_nav_buttons: true,
      meta_options: {},
      is_active: true
    }
  });

  const endpointType = watch('endpoint_type');
  const renderType = watch('render_type');
  const selectedTemplateIds = watch('template_ids') ?? [];
  const selectedExportCodes = watch('export_codes') ?? [];

  // Genera slug automatico dal nome
  const generateSlug = (nome: string) => {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    setValue('nome', nome);
    // Auto-genera slug solo se è un nuovo template
    if (mode === 'create') {
      setValue('slug', generateSlug(nome));
    }
  };

  const handleMetaOptionsChange = (value: string) => {
    setMetaOptionsJson(value);
    try {
      const parsed = JSON.parse(value);
      setValue('meta_options', parsed);
      setMetaOptionsError(null);
    } catch {
      setMetaOptionsError('JSON non valido');
    }
  };

  // Funzioni per gestire i filtri (come in GetRefsTestPanel)
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

  const onSubmit = async (data: FilterTemplateFormData) => {
    // Valida meta_options prima del submit
    if (metaOptionsError) {
      return;
    }

    try {
      // Prepara i filtri validi
      const validFilters = filterGroups.filter(group =>
        group.length > 0 && group.some(filter => filter.field && filter.operator && filter.value)
      );

      // Converti i nomi dei campi nel formato che il backend si aspetta (camelCase)
      const payload = {
        nome: data.nome,
        slug: data.slug,
        descrizione: data.descrizione || undefined,
        mode: data.endpoint_type, // endpoint_type → mode
        renderType: data.render_type || undefined, // render_type → renderType
        templateIds: data.endpoint_type === 'files' ? [] : data.template_ids, // template_ids → templateIds
        exportIds: data.endpoint_type === 'files' ? data.export_codes : [], // export_codes → exportIds
        filters: validFilters,
        autoScroll: data.auto_scroll, // auto_scroll → autoScroll
        scrollSpeed: data.scroll_speed, // scroll_speed → scrollSpeed
        showIndicators: data.show_indicators, // show_indicators → showIndicators
        showNavButtons: data.show_nav_buttons, // show_nav_buttons → showNavButtons
        is_active: data.is_active
      };

      if (mode === 'create') {
        await create.mutateAsync(payload as any);
      } else {
        await update.mutateAsync({ id: template.id_filter_template, ...payload } as any);
      }
      onSuccess();
    } catch (error) {
      console.error('Errore salvataggio template:', error);
    }
  };

  const handleDelete = async () => {
    if (mode !== 'edit' || !template) return;

    try {
      await deleteTemplate.mutateAsync(template.id_filter_template);
      setConfermaElimina(false);
      onSuccess();
    } catch (error) {
      console.error('Errore eliminazione template:', error);
    }
  };

  const isLoading = isCreating || isUpdating;
  const currentVersion = template?.version ? Number(template.version) : undefined;

  return (
    <>
      {mode === 'edit' && !template?.id_filter_template ? (
        <div className="space-y-4">
          <Alert variant="soft-warning" icona="TriangleAlert" titolo="Nessun template è attualmente selezionato per la modifica.">
            <p className="text-sm">
              Seleziona un template dall&apos;elenco a sinistra per continuare o annulla l&apos;operazione.
            </p>
          </Alert>
          <div className="flex justify-end">
            <Button type="button" variant="outline-secondary" onClick={onCancel}>
              Chiudi
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                {/* <h3 className="text-lg font-semibold">
                  {mode === 'create' ? 'Crea Nuovo Template Filtro' : `Modifica: ${template?.nome}`}
                </h3> */}
                {mode === 'edit' && currentVersion && (
                  <p className="title-eyebrow mt-1 flex items-center gap-2">
                    Versione attuale <Badge variant="primary" size="sm">v{currentVersion}</Badge>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {mode === 'edit' && template?.slug && (
                  <Button
                    variant="outline-secondary"
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <Lucide icon="Clock" aria-hidden="true" className="mr-2 h-4 w-4" /> Versioni
                  </Button>
                )}
                {mode === 'edit' && (
                  <Controller
                    name="is_active"
                    control={control}
                    render={({ field }) => (
                      <FormCheck className="flex items-center gap-2 text-sm">
                        <FormCheck.Input
                          id="is_active"
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                        <FormCheck.Label htmlFor="is_active">
                          Attivo
                        </FormCheck.Label>
                      </FormCheck>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Informazioni Base */}
            <div className="space-y-4">
              <h3 className="title-card">Informazioni Base</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel htmlFor="nome">Nome Template *</FormLabel>
                  <Controller
                    name="nome"
                    control={control}
                    render={({ field }) => (
                      <FormInput
                        {...field}
                        id="nome"
                        onChange={handleNameChange}
                        placeholder="Es: Prodotti in Promozione"
                        className={errors.nome ? "border-danger" : ""}
                      />
                    )}
                  />
                  {errors.nome && <p className="text-xs text-danger mt-1">{errors.nome.message}</p>}
                </div>

                <div>
                  <FormLabel htmlFor="slug">Slug (identificatore URL) *</FormLabel>
                  <FormInput
                    {...register('slug')}
                    id="slug"
                    placeholder="es: prodotti-promo"
                    className={errors.slug ? "border-danger" : ""}
                  />
                  {errors.slug && <p className="text-xs text-danger mt-1">{errors.slug.message}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    Identificatore univoco del template — referenziato a runtime dal plugin tramite il parametro <code className="font-mono">slug</code>
                  </p>
                </div>
              </div>

              <div>
                <FormLabel htmlFor="descrizione">Descrizione</FormLabel>
                <FormTextarea
                  {...register('descrizione')}
                  id="descrizione"
                  rows={2}
                  placeholder="Descrizione opzionale del template..."
                />
              </div>
            </div>

            {/* Sorgente Dati */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="title-card">Sorgente Dati</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel htmlFor="endpoint_type">Tipo Sorgente *</FormLabel>
                  <FormSelect
                    {...register('endpoint_type')}
                    id="endpoint_type"
                    className={errors.endpoint_type ? "border-danger" : ""}
                  >
                    {/* <option value="refs">Referenze JSON (refs)</option> */}
                    <option value="refs-html">Referenze</option>
                    <option value="files">Files (files)</option>
                  </FormSelect>
                  {errors.endpoint_type && <p className="text-xs text-danger mt-1">{errors.endpoint_type.message}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    {endpointType === 'refs-html' && 'Markup HTML server-rendered delle referenze promozionali'}
                    {endpointType === 'files' && 'Asset di export (PDF, immagini, archivi) associati alle referenze'}
                  </p>
                </div>

                <div>
                  <FormLabel htmlFor="render_type">Modalità di Rendering</FormLabel>
                  <FormSelect {...register('render_type')} id="render_type">
                    <option value="">Default (ereditato dal plugin)</option>
                    <option value="grid">Grid</option>
                    <option value="carousel">Carousel</option>
                  </FormSelect>
                  <p className="text-xs text-slate-500 mt-1">
                    Layout di rendering applicato agli item restituiti dalla sorgente
                  </p>
                </div>
              </div>

              {/* Selezione Template */}
              {(endpointType === 'refs' || endpointType === 'refs-html') && (
                <div>
                  <FormLabel className="flex items-center">
                    <Lucide icon="Package" className="w-4 h-4 mr-2" />
                    Template da Includere
                  </FormLabel>
                  <p className="text-xs text-slate-500 mb-2">
                    Vincola la sorgente ai template selezionati; se nessuno è selezionato vengono inclusi tutti i template attivi
                  </p>
                  <Controller
                    name="template_ids"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                        {templates.length === 0 ? (
                          <p className="text-slate-500 text-sm">Nessun template disponibile</p>
                        ) : (
                          templates.map((tmpl) => (
                            <FormCheck key={tmpl.guidId} className="cursor-pointer rounded-control border border-slate-200 p-3 hover:bg-slate-50">
                              <FormCheck.Input
                                id={`tmpl-${tmpl.guidId}`}
                                type="checkbox"
                                checked={field.value?.includes(tmpl.guidId) || false}
                                onChange={(e) => {
                                  const newValue = e.target.checked
                                    ? [...(field.value || []), tmpl.guidId]
                                    : (field.value || []).filter((id: string) => id !== tmpl.guidId);
                                  field.onChange(newValue);
                                }}
                                className="mr-3"
                              />
                              <FormCheck.Label htmlFor={`tmpl-${tmpl.guidId}`}>
                                <div className="font-medium text-sm">{tmpl.titolo}</div>
                                <div className="text-xs text-slate-500">{tmpl.guidId}</div>
                              </FormCheck.Label>
                            </FormCheck>
                          ))
                        )}
                      </div>
                    )}
                  />
                  {selectedTemplateIds?.length > 0 && (
                    <p className="text-xs text-slate-600 mt-1">
                      {selectedTemplateIds.length} template selezionati
                    </p>
                  )}
                </div>
              )}

              {/* Selezione Tipi Export */}
              {endpointType === 'files' && (
                <div>
                  <FormLabel className="flex items-center">
                    <Lucide icon="FileOutput" className="w-4 h-4 mr-2" />
                    Tipi Export da Includere
                  </FormLabel>
                  <p className="text-xs text-slate-500 mb-2">
                    Filtra gli asset per tipo di export; se nessuno è selezionato vengono restituiti tutti i tipi disponibili
                  </p>
                  <Controller
                    name="export_codes"
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                        {tipiExport.length === 0 ? (
                          <p className="text-slate-500 text-sm">Nessun tipo export disponibile</p>
                        ) : (
                          tipiExport.map((tipo) => (
                            <FormCheck key={tipo.codice} className="cursor-pointer rounded-control border border-slate-200 p-3 hover:bg-slate-50">
                              <FormCheck.Input
                                id={`export-${tipo.codice}`}
                                type="checkbox"
                                checked={field.value?.includes(tipo.codice) || false}
                                onChange={(e) => {
                                  const newValue = e.target.checked
                                    ? [...(field.value || []), tipo.codice]
                                    : (field.value || []).filter((code: string) => code !== tipo.codice);
                                  field.onChange(newValue);
                                }}
                                className="mr-3"
                              />
                              <FormCheck.Label htmlFor={`export-${tipo.codice}`}>
                                <div className="font-medium text-sm">{tipo.nome}</div>
                                <div className="text-xs text-slate-500">{tipo.codice}</div>
                              </FormCheck.Label>
                            </FormCheck>
                          ))
                        )}
                      </div>
                    )}
                  />
                  {selectedExportCodes?.length > 0 && (
                    <p className="text-xs text-slate-600 mt-1">
                      {selectedExportCodes.length} tipi export selezionati
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Opzioni Carousel */}
            {renderType === 'carousel' && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="title-card">Parametri Carousel</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="scroll_speed">Velocità Scorrimento (ms)</FormLabel>
                    <FormInput
                      {...register('scroll_speed')}
                      id="scroll_speed"
                      type="number"
                      min={1000}
                      max={30000}
                      step={500}
                      className={errors.scroll_speed ? "border-danger" : ""}
                    />
                    {errors.scroll_speed && <p className="text-xs text-danger mt-1">{errors.scroll_speed.message}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      Intervallo di transizione tra slide in millisecondi (range: 1000–30000)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Controller
                      name="auto_scroll"
                      control={control}
                      render={({ field }) => (
                        <FormCheck className="flex items-center gap-2">
                          <FormCheck.Input
                            id="auto_scroll"
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                          <FormCheck.Label htmlFor="auto_scroll" className="text-sm">
                            Scorrimento Automatico
                          </FormCheck.Label>
                        </FormCheck>
                      )}
                    />

                    <Controller
                      name="show_indicators"
                      control={control}
                      render={({ field }) => (
                        <FormCheck className="flex items-center gap-2">
                          <FormCheck.Input
                            id="show_indicators"
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                          <FormCheck.Label htmlFor="show_indicators" className="text-sm">
                            Mostra Indicatori (pallini)
                          </FormCheck.Label>
                        </FormCheck>
                      )}
                    />

                    <Controller
                      name="show_nav_buttons"
                      control={control}
                      render={({ field }) => (
                        <FormCheck className="flex items-center gap-2">
                          <FormCheck.Input
                            id="show_nav_buttons"
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                          />
                          <FormCheck.Label htmlFor="show_nav_buttons" className="text-sm">
                            Mostra Pulsanti Navigazione
                          </FormCheck.Label>
                        </FormCheck>
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Filtri */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel className="flex items-center">
                    <Lucide icon="Filter" className="w-4 h-4 mr-2" />
                    Filtri (Opzionale)
                  </FormLabel>
                  <p className="text-xs text-slate-500">
                    Predicati di filtro applicati alla query. Le condizioni all'interno dello stesso gruppo sono in AND logico; gruppi distinti sono in OR logico.
                  </p>
                </div>
                <Button
                  type="button"
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
                  <div key={groupIndex} className="rounded-card border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-600">
                        Gruppo {groupIndex + 1} {groupIndex > 0 && <span className="text-xs text-slate-400">(OR)</span>}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => addFilterToGroup(groupIndex)}
                          aria-label="Aggiungi filtro al gruppo"
                        >
                          <Lucide aria-hidden="true" icon="Plus" className="w-3 h-3" />
                        </Button>
                        {filterGroups.length > 1 && (
                          <Button
                            type="button"
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
                                <option key={i} value={field.expected_input || field.expected_output}>
                                  {field.expected_output || field.expected_input}
                                </option>
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
                              templateId={selectedTemplateIds}
                              mode={endpointType === 'files' ? 'files' : 'refs'}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
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
                            type="button"
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

            {/* Meta Options */}
            <div className="space-y-4 border-t pt-4">
              <div>
                <h3 className="title-card">Meta-opzioni (JSON)</h3>
                <p className="text-xs text-slate-500">
                  Payload JSON per sovrascrivere o estendere i parametri di configurazione del template a runtime
                </p>
              </div>

              <div>
                <FormTextarea
                  value={metaOptionsJson}
                  onChange={(e) => handleMetaOptionsChange(e.target.value)}
                  rows={4}
                  className={`font-mono text-sm ${metaOptionsError ? "border-danger" : ""}`}
                  placeholder='{}'
                />
                {metaOptionsError && <p className="text-xs text-danger mt-1">{metaOptionsError}</p>}
              </div>
            </div>

            {mode === 'edit' && currentVersion && (
              <Alert variant="soft-primary" icona="Info">
                <p className="text-sm">
                  Il prossimo commit genererà automaticamente la versione <span className="font-semibold">v{currentVersion + 1}</span>; le versioni precedenti restano accessibili nello storico.
                </p>
              </Alert>
            )}

            {/* Azioni */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {mode === 'edit' && (
                  <Button
                    type="button"
                    variant="outline-danger"
                    onClick={() => setConfermaElimina(true)}
                    disabled={isDeleting}
                    loading={isDeleting}
                  >
                    {!isDeleting && <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />}
                    {isDeleting ? "Eliminazione..." : "Elimina"}
                  </Button>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline-secondary" onClick={onCancel}>
                  Annulla
                </Button>
                <Button type="submit" variant="primary" disabled={isLoading || !!metaOptionsError} loading={isLoading}>
                  {!isLoading && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                  {isLoading ? "Salvataggio..." : mode === 'create' ? 'Crea Template' : 'Salva Modifiche'}
                </Button>
              </div>
            </div>
          </form>

          {mode === 'edit' && template?.slug && (
            <FilterTemplateVersionHistory
              slug={template.slug}
              isOpen={isHistoryOpen}
              onClose={() => setIsHistoryOpen(false)}
              onRestore={async (version: number) => {
                await restore.mutateAsync({ slug: template.slug, version });
              }}
              isRestoring={isRestoring}
            />
          )}

          <ConfirmDialog
            open={confermaElimina}
            title="Eliminare il template?"
            description={`Il template "${template?.nome ?? ""}" verrà eliminato definitivamente.`}
            confirmLabel="Elimina template"
            loading={isDeleting}
            onClose={() => setConfermaElimina(false)}
            onConfirm={handleDelete}
          />
        </>
      )}
    </>
  );
}

export default FilterTemplateForm;
