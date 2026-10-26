import { FormInput } from '@/components/Base/Form';
import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SkeletonTemplateCard from './SkeletonTemplateCard';
import TemplateCard from './TemplateCard';
import { TemplateData } from './types';

interface TemplateCardGridProps {
  templates: TemplateData[] | undefined;
  isLoading: boolean;
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
  selectedTemplateId,
  searchQuery,
  onSearchChange,
  onSelectTemplate,
  onDeleteTemplate,
  onNavigateDetails,
}: TemplateCardGridProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col p-5 box box--stacked">
      {/* Panel header */}
      <div className="pb-5 mb-5 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem] flex justify-between items-center">
        <span className="flex items-center gap-2">
          <Lucide icon="LayoutGrid" className="w-5 h-5 text-primary" />
          Template combinazioni
          {templates && (
            <Badge variant="info" size="sm" className="px-2 py-1 ml-1">
              {templates.length}
            </Badge>
          )}
        </span>
      </div>

      {/* Search */}
      <div className="mb-5">
        <FormInput
          type="text"
          placeholder="Cerca template per nome o formato..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTemplateCard key={i} />
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <AnimatePresence>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      ) : (
        <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-12 border border-dashed border-slate-300">
          <Lucide icon="FileSearch" className="w-14 h-14 text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium mb-1">Nessun template disponibile</p>
          <p className="text-xs text-slate-400 text-center mb-4">
            {searchQuery
              ? 'Nessun template corrisponde alla ricerca'
              : 'Crea il primo template per iniziare'}
          </p>
          {!searchQuery && (
            <div className="flex gap-2">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => navigate('creazione-kit-automatico')}
              >
                <Lucide icon="Zap" className="w-4 h-4 mr-1.5" />
                Automatico
              </Button>
              <Button
                variant="outline-warning"
                size="sm"
                onClick={() => navigate('creazione-kit-manuale')}
              >
                <Lucide icon="FolderOpen" className="w-4 h-4 mr-1.5" />
                Manuale
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
