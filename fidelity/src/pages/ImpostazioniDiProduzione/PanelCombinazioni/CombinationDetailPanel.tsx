import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { FormInput } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import Table from '@/components/Base/Table';
import EmptyState from '@/components/EmptyState';
import { AnimatePresence, motion } from 'framer-motion';
import { STATO_COMBINAZIONI, TIPO_KIT_DESIGN } from '../../../../lib/enums';
import { CombinazioneData, TemplateData } from './types';

interface CombinationDetailPanelProps {
  selectedTemplate: TemplateData;
  combinations: CombinazioneData[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onStateChange: (guidId: string, newState: string) => void;
  onClose: () => void;
  onNavigateDetails: (combinationId: string) => void;
}

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

function renderSkeletonRows(count = 4) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} className="animate-pulse">
      <td className="px-5 py-4"><div className="h-4 rounded bg-slate-200 w-3/4" /></td>
      <td className="px-5 py-4"><div className="h-4 rounded bg-slate-200 w-1/2" /></td>
      <td className="px-5 py-4"><div className="h-4 rounded bg-slate-200 w-1/2" /></td>
      <td className="px-5 py-4"><div className="h-5 rounded-full bg-slate-200 w-20" /></td>
      <td className="px-5 py-4"><div className="h-5 rounded-full bg-slate-200 w-16" /></td>
      <td className="px-5 py-4"><div className="h-8 rounded bg-slate-200 w-24 mx-auto" /></td>
    </tr>
  ));
}

function tipoBadge(tipo: string) {
  switch (tipo) {
    case TIPO_KIT_DESIGN.AUTOMATICO:
      return <Badge size="sm" variant="success">Automatico</Badge>;
    case TIPO_KIT_DESIGN.SEMI_AUTOMATICO:
      return <Badge size="sm" variant="warning">Semi-automatico</Badge>;
    case TIPO_KIT_DESIGN.MANUALE:
      return <Badge size="sm" variant="info">Manuale</Badge>;
    default:
      return <Badge size="sm" variant="secondary">{tipo}</Badge>;
  }
}

export default function CombinationDetailPanel({
  selectedTemplate,
  combinations,
  isLoading,
  searchQuery,
  onSearchChange,
  onStateChange,
  onClose,
  onNavigateDetails,
}: CombinationDetailPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col p-5 box box--stacked"
    >
      {/* Header */}
      <div className="pb-4 mb-4 border-b border-dashed border-slate-300/70 flex justify-between items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Lucide icon="Boxes" className="w-5 h-5 text-primary shrink-0" />
          <span className="font-medium text-[0.94rem] truncate">
            Combinazioni di{' '}
            <span className="text-primary font-semibold">{selectedTemplate.titolo}</span>
          </span>
          {!isLoading && (
            <Badge variant="info" size="sm" className="px-2 py-1 shrink-0">
              {combinations.length}
            </Badge>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Chiudi pannello"
        >
          <Lucide icon="X" className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <FormInput
          type="text"
          placeholder="Cerca per titolo, area o canale..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table bordered>
          <Table.Thead>
            <Table.Tr className="text-xs uppercase text-slate-500 bg-slate-50">
              <Table.Th className="px-5 py-3 font-semibold text-slate-700">Titolo</Table.Th>
              <Table.Th className="px-5 py-3 font-semibold text-slate-700">Area</Table.Th>
              <Table.Th className="px-5 py-3 font-semibold text-slate-700">Canale</Table.Th>
              <Table.Th className="px-5 py-3 font-semibold text-slate-700">Tipo</Table.Th>
              <Table.Th className="px-5 py-3 font-semibold text-slate-700">Stato</Table.Th>
              <Table.Th className="px-5 py-3 font-semibold text-slate-700 text-center">Azioni</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <tbody>
            {isLoading ? (
              renderSkeletonRows()
            ) : combinations.length > 0 ? (
              <AnimatePresence>
                {combinations.map((combo, index) => (
                  <motion.tr
                    key={combo.guidId}
                    className="transition-colors hover:bg-slate-50/50"
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                  >
                    <Table.Td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Lucide icon="Box" className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-medium text-slate-800 text-sm">{combo.titolo}</span>
                      </div>
                    </Table.Td>
                    <Table.Td className="px-5 py-3 text-sm text-slate-600">
                      {combo.nomeArea ?? <span className="text-slate-300">—</span>}
                    </Table.Td>
                    <Table.Td className="px-5 py-3 text-sm text-slate-600">
                      {combo.nomeCanale ?? <span className="text-slate-300">—</span>}
                    </Table.Td>
                    <Table.Td className="px-5 py-3">{tipoBadge(combo.tipo)}</Table.Td>
                    <Table.Td className="px-5 py-3">
                      <Badge variant={combo.stato === STATO_COMBINAZIONI.DISATTIVO ? 'warning' : 'success'} size="sm">
                        {combo.stato === STATO_COMBINAZIONI.DISATTIVO ? 'Disattivato' : 'Attivo'}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => onNavigateDetails(combo.guidId)}
                        >
                          <Lucide icon="FileText" className="w-3.5 h-3.5 mr-1" />
                          Dettagli
                        </Button>
                        {combo.stato === STATO_COMBINAZIONI.DISATTIVO ? (
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => onStateChange(combo.guidId, STATO_COMBINAZIONI.ATTIVO)}
                          >
                            <Lucide icon="Power" className="w-3.5 h-3.5 mr-1" />
                            Attiva
                          </Button>
                        ) : (
                          <Button
                            variant="outline-warning"
                            size="sm"
                            onClick={() => onStateChange(combo.guidId, STATO_COMBINAZIONI.DISATTIVO)}
                          >
                            <Lucide icon="PowerOff" className="w-3.5 h-3.5 mr-1" />
                            Disattiva
                          </Button>
                        )}
                      </div>
                    </Table.Td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            ) : (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <EmptyState
                    icon="PackageSearch"
                    title="Nessuna combinazione"
                    description={
                      searchQuery
                        ? 'Nessuna combinazione corrisponde alla ricerca'
                        : 'Non ci sono combinazioni per questo template'
                    }
                    iconColor="text-slate-300"
                  />
                </Table.Td>
              </Table.Tr>
            )}
          </tbody>
        </Table>
      </div>
    </motion.div>
  );
}
