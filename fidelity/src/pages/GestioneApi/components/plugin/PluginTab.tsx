import { useCallback, useState } from "react";
import type { TipiDiExportResponseDTO } from "../../../../../server/core/dto";
import type { FieldOption, Template } from "../../types";
import FilterTemplateForm from "./FilterTemplateForm";
import FilterTemplateList from "./FilterTemplateList";
import PluginConfigPanel from "./PluginConfigPanel";

type FormMode = 'view' | 'create' | 'edit';

interface PluginTabProps {
  templates: Template[];
  filterTemplates: any[];
  tipiExport: TipiDiExportResponseDTO[];
  fieldOptions: FieldOption[];
  apiKey: string | null;
}

function PluginTab({ templates, filterTemplates, tipiExport, fieldOptions, apiKey }: PluginTabProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [formMode, setFormMode] = useState<FormMode>('view');

  const selectedTemplate = filterTemplates.find(
    (tpl) => tpl.id_filter_template === selectedTemplateId
  );
  const handleCreateNew = useCallback(() => {
    setSelectedTemplateId("");
    setFormMode('create');
  }, []);

  const handleEdit = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    setFormMode('edit');
  }, []);

  const handleSelect = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    setFormMode('view');
  }, []);

  const handleFormSuccess = useCallback(() => {
    setFormMode('view');
    setSelectedTemplateId("");
  }, []);

  const handleFormCancel = useCallback(() => {
    setFormMode('view');
  }, []);

  // Mostra form creazione/modifica
  if (formMode === 'create' || formMode === 'edit') {
    return (
      <div className="space-y-6">
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
    );
  }

  // Vista normale
  return (
    <div className="space-y-6">
      {/* Lista template filtri */}
      <FilterTemplateList
        filterTemplates={filterTemplates}
        selectedId={selectedTemplateId}
        onSelect={handleSelect}
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
      />

      {/* Pannello configurazione */}
      {selectedTemplate && (
        <PluginConfigPanel
          template={selectedTemplate}
          templates={templates}
        />
      )}

      {/* Messaggio quando nessun template selezionato */}
      {!selectedTemplate && filterTemplates.length > 0 && (
        <div className="box p-8 text-center">
          <p className="text-slate-600">
            Seleziona un template dalla lista sopra per visualizzarne la configurazione,
            oppure crea un nuovo template.
          </p>
        </div>
      )}
    </div>
  );
}

export default PluginTab;
