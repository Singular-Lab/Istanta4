import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import { useState } from "react";
import { useLoaderData, useSearchParams } from "react-router-dom";
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
      <Pagina
        titolo={formMode === 'create' ? 'Nuovo Filter Template' : 'Modifica Filter Template'}
        descrizione={formMode === 'create' ? 'Definisci sorgente dati, filtri e parametri di rendering del nuovo template' : 'Modifica la configurazione del template selezionato'}
        indietro={{ onClick: handleFormCancel, etichetta: "Torna ai Filter Template" }}
      >
        <Sezione
          icona={formMode === 'create' ? "Plus" : "Pencil"}
          titolo={formMode === 'create' ? 'Configurazione nuovo template' : `Modifica template: ${selectedTemplate?.nome ?? ""}`}
        >
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
        </Sezione>
      </Pagina>
    );
  }

  // Vista normale
  return (
    <Pagina
      titolo="Plugin"
      descrizione="Gestisci i Filter Template del plugin: definisci sorgenti dati, predicati di filtro e modalità di rendering"
    >
      <Sezione
        icona="Filter"
        titolo="Filter Template"
        descrizione={
          <>
            I Filter Template sono lo strumento principale per governare il comportamento del plugin.
            Ogni template incapsula sorgente dati, predicati di filtro, modalità di rendering e parametri di layout,
            e viene referenziato a runtime tramite il proprio{" "}
            <code className="rounded-control bg-slate-100 px-1.5 py-0.5 font-mono text-sm">slug</code> univoco.
          </>
        }
        azioni={filterTemplates.length > 0 && (
          <>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={!selectedTemplateId}
              onClick={() => selectedTemplateId && handleEdit(selectedTemplateId)}
            >
              <Lucide icon="Pen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Modifica
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateNew}>
              <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Nuovo template
            </Button>
          </>
        )}
      >
        <FilterTemplateList
          filterTemplates={filterTemplates}
          selectedId={selectedTemplateId}
          onSelect={handleSelect}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
        />
      </Sezione>

      {/* Senza template lo stato vuoto è solo quello dell'elenco */}
      {filterTemplates.length > 0 && (
        <Sezione icona="Settings" titolo="Configurazione plugin">
          {selectedTemplate ? (
            <PluginConfigPanel
              template={selectedTemplate}
              templates={templates}
            />
          ) : (
            <EmptyState
              compatta
              icon="MousePointerClick"
              title="Nessun template selezionato"
              description="Seleziona un template dall'elenco sopra per visualizzarne la configurazione, oppure crea un nuovo template."
            />
          )}
        </Sezione>
      )}
    </Pagina>
  );
}

export default withSessionCheck(PluginPage);
