import BarraFiltri from '@/components/Base/BarraFiltri';
import CampoRicerca from '@/components/Base/CampoRicerca';
import PageError from '@/components/Base/PageError';
import EmptyState from '@/components/EmptyState';
import { AnimatePresence } from 'framer-motion';
import SkeletonTemplateCard from './SkeletonTemplateCard';
import TemplateCard from './TemplateCard';
import { TemplateData } from './types';

interface TemplateCardGridProps {
  templates: TemplateData[] | undefined;
  isLoading: boolean;
  /** Template non caricati: motivo e Riprova. */
  errore?: { motivo: string; onRiprova: () => void } | null;
  selectedTemplateId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectTemplate: (template: TemplateData) => void;
  onDeleteTemplate: (guidId: string) => void;
  onNavigateDetails: (guidId: string) => void;
}

export default function TemplateCardGrid({
  templates,
  isLoading,
  errore,
  selectedTemplateId,
  searchQuery,
  onSearchChange,
  onSelectTemplate,
  onDeleteTemplate,
  onNavigateDetails,
}: TemplateCardGridProps) {
  let contenuto;
  if (isLoading) {
    contenuto = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTemplateCard key={i} />
        ))}
      </div>
    );
  } else if (errore) {
    contenuto = (
      <PageError compatta titolo="Template non caricati" motivo={errore.motivo} onRiprova={errore.onRiprova} />
    );
  } else if (templates && templates.length > 0) {
    contenuto = (
      <AnimatePresence>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.guidId}
              template={template}
              isSelected={selectedTemplateId === template.guidId}
              onSelect={onSelectTemplate}
              onDelete={onDeleteTemplate}
              onNavigateDetails={onNavigateDetails}
            />
          ))}
        </div>
      </AnimatePresence>
    );
  } else if (searchQuery) {
    contenuto = (
      <EmptyState
        compatta
        icon="SearchX"
        title="Nessun risultato"
        description="Nessun template corrisponde alla ricerca."
        buttonText="Azzera ricerca"
        buttonIcon="X"
        onButtonClick={() => onSearchChange('')}
      />
    );
  } else {
    contenuto = (
      <EmptyState
        compatta
        icon="FileSearch"
        title="Nessun template disponibile"
        description="Crea il primo kit, automatico o manuale, con i pulsanti della sezione."
      />
    );
  }

  return (
    <div className="flex flex-col">
      <BarraFiltri
        variante="interna"
        destra={
          templates && !isLoading && !errore ? (
            <span className="text-sm text-slate-500">
              <span className="tabular-nums">{templates.length}</span> template
            </span>
          ) : undefined
        }
      >
        <CampoRicerca
          etichetta="Cerca template"
          placeholder="Nome o formato"
          value={searchQuery}
          onChange={onSearchChange}
        />
      </BarraFiltri>
      {contenuto}
    </div>
  );
}
