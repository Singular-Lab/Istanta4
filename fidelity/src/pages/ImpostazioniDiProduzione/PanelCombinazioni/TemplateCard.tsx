import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { Menu } from '@/components/Base/Headless';
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
        'relative flex flex-col rounded-card cursor-pointer transition-all duration-200 select-none',
        isSelected
          ? 'border-2 border-primary bg-primary/5'
          : 'border border-slate-200 bg-white hover:border-slate-300'
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
              'w-10 h-10 rounded-control flex items-center justify-center shrink-0',
              isSelected ? 'bg-primary/15' : 'bg-slate-100'
            )}
          >
            <Lucide
              icon={isManuale ? 'FolderOpen' : 'Zap'}
              aria-hidden="true"
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

        {/* Azioni del template */}
        <Menu className="shrink-0">
          <Menu.Button
            as={Button}
            variant="outline-secondary"
            size="sm"
            className="h-7 w-7 justify-center rounded-full border-transparent p-0 shadow-none"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            aria-label={`Azioni template ${template.titolo}`}
          >
            <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4 text-slate-400" />
          </Menu.Button>
          <Menu.Items className="w-44">
            <Menu.Item
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onNavigateDetails(template.guidId);
              }}
            >
              <Lucide icon="Settings2" aria-hidden="true" className="mr-2 h-4 w-4" />
              Dettagli
            </Menu.Item>
            <Menu.Item
              className="text-danger"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDelete(template.guidId);
              }}
            >
              <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
              Elimina
            </Menu.Item>
          </Menu.Items>
        </Menu>
      </div>

      {/* Type badge */}
      <div className="px-5 pb-3">
        <Badge
          variant={isManuale ? 'warning' : 'success'}
          size="sm"
        >
          {isManuale ? 'Manuale' : 'Automatico'}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <div className="rounded-control bg-slate-50 p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Quantità</p>
          <p className="font-semibold text-slate-700 text-sm tabular-nums">{template.quantita}</p>
        </div>
        <div className="rounded-control bg-slate-50 p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Kit creati</p>
          {template.quantitaKit > 0 ? (
            <Badge variant="info" size="sm">
              {template.quantitaKit}
            </Badge>
          ) : (
            <span className="text-xs text-slate-400">Nessuno</span>
          )}
        </div>
        <div className="rounded-control bg-slate-50 p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Export</p>
          <p className="font-semibold text-slate-700 text-sm tabular-nums">
            {template.tipiDiExportInKit?.length ?? 0}
          </p>
        </div>
        <div className="rounded-control bg-slate-50 p-2.5">
          <p className="text-xs text-slate-400 mb-0.5">Declinazioni</p>
          <p className="font-semibold text-slate-700 text-sm tabular-nums">
            {template.declinazioni?.length ?? 0}
          </p>
        </div>
      </div>

      {/* Footer action */}
      <div className="px-5 pb-5">
        <Button
          variant="outline-secondary"
          size="sm"
          className="w-full justify-center"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onNavigateDetails(template.guidId);
          }}
        >
          <Lucide icon="Settings2" aria-hidden="true" className="w-3.5 h-3.5 mr-1.5" />
          Gestisci template
        </Button>
      </div>
    </motion.div>
  );
}
