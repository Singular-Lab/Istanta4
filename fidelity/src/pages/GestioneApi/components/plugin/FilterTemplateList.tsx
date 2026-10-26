import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import TemplateFilterCard from "../../sub-components/TemplateFilterCard";

interface FilterTemplateListProps {
  filterTemplates: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
}

function FilterTemplateList({
  filterTemplates,
  selectedId,
  onSelect,
  onCreateNew,
  onEdit
}: FilterTemplateListProps) {
  const hasTemplates = filterTemplates && filterTemplates.length > 0;

  return (
    <div>
      {!hasTemplates ? (
        <div className="box p-8 text-center">
          <Lucide icon="Filter" className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Nessun template disponibile</h3>
          <p className="text-slate-600 mb-4">
            Crea il tuo primo Filter Template per configurare e distribuire il plugin
          </p>
          <Button variant="primary" onClick={onCreateNew}>
            <Lucide icon="Plus" className="w-4 h-4 mr-2" />
            Crea Nuovo Template
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Filter Template Configurati</h3>
            <div className="flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!selectedId}
                onClick={() => selectedId && onEdit(selectedId)}
              >
                <Lucide icon="Pen" className="w-4 h-4 mr-2" />
                Modifica
              </Button>
              <Button variant="primary" size="sm" onClick={onCreateNew}>
                <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                Nuovo Template
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterTemplates.map((template) => (
              <TemplateFilterCard
                key={template.id_filter_template}
                template={template}
                selected={template.id_filter_template === selectedId}
                onSelect={() => onSelect(template.id_filter_template)}
                onEdit={() => onEdit(template.id_filter_template)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default FilterTemplateList;
