import EmptyState from "@/components/EmptyState";
import TemplateFilterCard from "../../sub-components/TemplateFilterCard";

interface FilterTemplateListProps {
  filterTemplates: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
}

/** Griglia dei Filter Template; senza template mostra l'unico stato vuoto della pagina Plugin. */
function FilterTemplateList({
  filterTemplates,
  selectedId,
  onSelect,
  onCreateNew,
  onEdit
}: FilterTemplateListProps) {
  const hasTemplates = filterTemplates && filterTemplates.length > 0;

  if (!hasTemplates) {
    return (
      <EmptyState
        compatta
        icon="Funnel"
        title="Nessun template disponibile"
        description="Crea il tuo primo Filter Template per configurare e distribuire il plugin"
        buttonText="Crea nuovo template"
        buttonIcon="Plus"
        onButtonClick={onCreateNew}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
  );
}

export default FilterTemplateList;
