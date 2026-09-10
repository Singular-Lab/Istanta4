import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { Popover } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import React from 'react';
import { TIPO_KIT_DESIGN } from '../../../../lib/enums';
import { TemplateData } from './types';

interface TemplateCardProps {
  template: TemplateData;
  isSelected: boolean;
  onSelect: (template: TemplateData) => void;
  onDelete: (guidId: string) => void;
  onNavigateDetails: (guidId: string) => void;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -8 },
};

export default function TemplateCard({
  template,
  isSelected,
  onSelect,
  onDelete,
  onNavigateDetails,
}: TemplateCardProps) {
  const isManuale = template.tipo === TIPO_KIT_DESIGN.MANUALE;

  return (
    <motion.div
      layout
      key={template.guidId}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.2 }}
      onClick={() => onSelect(template)}
      className={clsx(
        'relative flex flex-col rounded-xl cursor-pointer transition-all duration-200 select-none',
        isSelected
          ? 'border-2 border-primary bg-primary/5 shadow-lg'
          : 'border border-slate-200/80 bg-white hover:shadow-md hover:border-slate-300'
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-12 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start p-5 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              isSelected ? 'bg-primary/15' : 'bg-slate-100'
            )}
          >
            <Lucide
              icon={isManuale ? 'FolderOpen' : 'Zap'}
              className={clsx('w-5 h-5', isSelected ? 'text-primary' : 'text-slate-500')}
            />
          </div>
          <div className="min-w-0">
            <p
              className={clsx(
                'font-semibold text-sm leading-tight truncate',
                isSelected ? 'text-primary' : 'text-slate-800'
              )}
              title={template.titolo}
            >
              {template.titolo}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 font-mono truncate" title={template.codiceFormato}>
              {template.codiceFormato}
            </p>
          </div>
        </div>

        {/* Context menu */}
        <Popover className="relative shrink-0">
          <Popover.Button
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            aria-label="Azioni template"
          >
            <Lucide icon="EllipsisVertical" className="w-4 h-4 text-slate-400" />
          </Popover.Button>
          <Popover.Panel
            placement="bottom-end"
            className="w-44 z-50 p-0 border-0 shadow-none bg-transparent"
          >
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg py-1.5">
              <button
                className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onNavigateDetails(template.guidId);
                }}
              >
                <Lucide icon="Settings2" className="w-4 h-4 mr-2 text-slate-400" />
                Dettagli
              </button>
              <button
                className="flex items-center w-full px-3 py-2 text-sm text-danger hover:bg-danger/5 transition-colors"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDelete(template.guidId);
                }}
              >
                <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                Elimina
              </button>
            </div>
          </Popover.Panel>
        </Popover>
      </div>

      {/* Type badge */}
      <div className="px-5 pb-3">
        <Badge
          variant={isManuale ? 'warning' : 'success'}
          size="sm"
          className="px-2.5 py-0.5"
        >
          {isManuale ? 'Manuale' : 'Automatico'}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Quantità</p>
          <p className="font-semibold text-slate-700 text-sm">{template.quantita}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Kit creati</p>
          {template.quantitaKit > 0 ? (
            <Badge variant="info" size="sm" className="px-2 py-0 font-semibold">
              {template.quantitaKit}
            </Badge>
          ) : (
            <span className="text-xs text-slate-400">Nessuno</span>
          )}
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Export</p>
          <p className="font-semibold text-slate-700 text-sm">
            {template.tipiDiExportInKit?.length ?? 0}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Declinazioni</p>
          <p className="font-semibold text-slate-700 text-sm">
            {template.declinazioni?.length ?? 0}
          </p>
        </div>
      </div>

      {/* Footer action */}
      <div className="px-5 pb-5">
        <Button
          variant={isSelected ? 'soft-primary' : 'outline-secondary'}
          size="sm"
          className="w-full justify-center text-xs"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onNavigateDetails(template.guidId);
          }}
        >
          <Lucide icon="Settings2" className="w-3.5 h-3.5 mr-1.5" />
          Gestisci template
        </Button>
      </div>
    </motion.div>
  );
}
