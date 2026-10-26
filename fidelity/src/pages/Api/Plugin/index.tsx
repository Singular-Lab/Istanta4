import Lucide from "@/components/Base/Lucide";
import withSessionCheck from "@/components/SessionChecker";
import { useState } from "react";
import { useLoaderData, useSearchParams } from "react-router-dom";
import PageHeader from "../../../components/Base/PageHeader";
import { useFetchFieldOptions, useFetchTipiExport } from "../../../query/query";
import FilterTemplateForm from "../../GestioneApi/components/plugin/FilterTemplateForm";
import FilterTemplateList from "../../GestioneApi/components/plugin/FilterTemplateList";
import PluginConfigPanel from "../../GestioneApi/components/plugin/PluginConfigPanel";
import type { Template } from "../../GestioneApi/types";

type FormMode = 'view' | 'create' | 'edit';

interface LoaderData {
  apiKey: string;
  template: Template[];
  template_filters: {
    success: boolean;
    data: any[];
    timestamp: Date;
  };
}

function PluginPage() {
  const { apiKey, template: templateLoader, template_filters } = useLoaderData<LoaderData>();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();

  const rawMode = searchParams.get("mode");
  const formMode: FormMode =
    rawMode === "create" || rawMode === "edit" || rawMode === "view"
      ? rawMode
      : "view";

  const setMode = (mode: FormMode) => {
    const next = new URLSearchParams(searchParams);
    next.set("mode", mode);
    setSearchParams(next);
  };

  // Fetch options
  const { data: fieldOptions = [] } = useFetchFieldOptions();
  const { data: tipiExportData } = useFetchTipiExport();

  const tipiExport = Array.isArray(tipiExportData) ? tipiExportData : [];
  const templates = templateLoader || [];
  const filterTemplates = template_filters?.data || [];

  const selectedTemplate = filterTemplates.find(
    (tpl) => tpl.id_filter_template === selectedTemplateId
  );

  const handleCreateNew = () => {
    setSelectedTemplateId("");
    setMode('create');
  };

  const handleEdit = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setMode('edit');
  };

  const handleSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setMode('view');
  };

  const handleFormSuccess = () => {
    setMode('view');
    setSelectedTemplateId("");
  };

  const handleFormCancel = () => {
    setMode('view');
  };

  // Mostra form creazione/modifica
  if (formMode === 'create' || formMode === 'edit') {
    return (
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title={formMode === 'create' ? 'Nuovo Filter Template' : 'Modifica Filter Template'}
            description={formMode === 'create' ? 'Definisci sorgente dati, filtri e parametri di rendering del nuovo template' : 'Modifica la configurazione del template selezionato'}
          />
          {/* Content */}
          <div className="mt-3.5">
            <div className="flex flex-col box box--stacked">
              <div className="p-5">
                {/* Sezione Form */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <Lucide icon={formMode === 'create' ? "Plus" : "Pencil"} className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-bold text-slate-900">
                      {formMode === 'create' ? 'Configurazione Nuovo Template' : `Modifica Template: ${selectedTemplate?.nome}`}
                    </h2>
                  </div>

                  <FilterTemplateForm
                    mode={formMode}
                    template={formMode === 'edit' ? selectedTemplate : undefined}
                    templates={templates}
                    tipiExport={tipiExport}
                    fieldOptions={fieldOptions}
                    onSuccess={handleFormSuccess}
                    onCancel={handleFormCancel}
                    apiKey={apiKey}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista normale
  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header */}
        <PageHeader
          title="Plugin"
          description="Gestisci i Filter Template del plugin: definisci sorgenti dati, predicati di filtro e modalità di rendering"
        />
        {/* Content */}
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="p-5">
              {/* Sezione Filter Templates */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Lucide icon="Filter" className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold text-slate-900">Filter Templates</h2>
                </div>

                <div className="box p-6">
                  <p className="text-slate-600 mb-6">
                    I Filter Template sono lo strumento principale per governare il comportamento del plugin.
                    Ogni template incapsula sorgente dati, predicati di filtro, modalità di rendering e parametri di layout,
                    e viene referenziato a runtime tramite il proprio <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono">slug</code> univoco.
                  </p>

                  <FilterTemplateList
                    filterTemplates={filterTemplates}
                    selectedId={selectedTemplateId}
                    onSelect={handleSelect}
                    onCreateNew={handleCreateNew}
                    onEdit={handleEdit}
                  />
                </div>
              </div>

              {/* Sezione Configurazione */}
              {selectedTemplate && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <Lucide icon="Settings" className="w-6 h-6 text-success" />
                    <h2 className="text-2xl font-bold text-slate-900">Configurazione Plugin</h2>
                  </div>

                  <PluginConfigPanel
                    template={selectedTemplate}
                    templates={templates}
                  />
                </div>
              )}

              {/* Messaggio quando nessun template selezionato */}
              {!selectedTemplate && filterTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <Lucide icon="Info" className="w-6 h-6 text-info" />
                    <h2 className="text-2xl font-bold text-slate-900">Inizia</h2>
                  </div>

                  <div className="box p-8 text-center">
                    <Lucide icon="MousePointerClick" className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">
                      Seleziona un template dalla lista sopra per visualizzarne la configurazione,
                      oppure crea un nuovo template.
                    </p>
                  </div>
                </div>
              )}

              {/* Messaggio quando non ci sono template */}
              {filterTemplates.length === 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <Lucide icon="CircleAlert" className="w-6 h-6 text-warning" />
                    <h2 className="text-2xl font-bold text-slate-900">Nessun Template</h2>
                  </div>

                  <div className="box p-8 text-center">
                    <Lucide icon="Package" className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-4">
                      Non hai ancora creato nessun Filter Template.
                      Crea il tuo primo template per iniziare a configurare il plugin.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(PluginPage);
