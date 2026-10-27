import Badge from '@/components/Base/Badge';
import BarraFiltri from '@/components/Base/BarraFiltri';
import Button from '@/components/Base/Button';
import CampoRicerca from '@/components/Base/CampoRicerca';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Skeleton from '@/components/Base/Skeleton';
import StatusBadge from '@/components/Base/StatusBadge';
import Table from '@/components/Base/Table';
import EmptyState from '@/components/EmptyState';
import { VALORE_ASSENTE } from '@/utils/format';
import { AnimatePresence, motion } from 'framer-motion';
import { STATO_COMBINAZIONI, TIPO_KIT_DESIGN } from '../../../../lib/enums';
import { CombinazioneData, TemplateData } from './types';

interface CombinationDetailPanelProps {
  selectedTemplate: TemplateData;
  combinations: CombinazioneData[];
  isLoading: boolean;
  /** Combinazioni non caricate: motivo e Riprova. */
  errore?: { motivo: string; onRiprova: () => void } | null;
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

const COLONNE = 6;

function renderSkeletonRows(count = 4) {
  return Array.from({ length: count }).map((_, i) => (
    <Table.Tr key={i}>
      <Table.Td><Skeleton className="h-4 w-3/4" /></Table.Td>
      <Table.Td><Skeleton className="h-4 w-1/2" /></Table.Td>
      <Table.Td><Skeleton className="h-4 w-1/2" /></Table.Td>
      <Table.Td><Skeleton className="h-5 w-20 rounded-full" /></Table.Td>
      <Table.Td><Skeleton className="h-5 w-16 rounded-full" /></Table.Td>
      <Table.Td><Skeleton className="ml-auto h-7 w-16 rounded-control" /></Table.Td>
    </Table.Tr>
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
  errore,
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
      className="flex flex-col rounded-card border border-slate-200 bg-white"
    >
      {/* Intestazione */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <Lucide icon="Boxes" aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />
          <h3 className="title-card truncate">
            Combinazioni di <span className="text-primary">{selectedTemplate.titolo}</span>
          </h3>
          {!isLoading && !errore && (
            <Badge variant="info" size="sm" className="shrink-0">
              {combinations.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={onClose}
          aria-label="Chiudi pannello"
          title="Chiudi"
        >
          <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      </div>

      <BarraFiltri className="px-4 pb-4 pt-0">
        <CampoRicerca
          etichetta="Cerca combinazioni"
          placeholder="Titolo, area o canale"
          value={searchQuery}
          onChange={onSearchChange}
        />
      </BarraFiltri>

      {errore ? (
        <div className="p-4">
          <PageError compatta titolo="Combinazioni non caricate" motivo={errore.motivo} onRiprova={errore.onRiprova} />
        </div>
      ) : (
      <div className="overflow-x-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Titolo</Table.Th>
              <Table.Th>Area</Table.Th>
              <Table.Th>Canale</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Stato</Table.Th>
              <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              renderSkeletonRows()
            ) : combinations.length > 0 ? (
              <AnimatePresence>
                {combinations.map((combo, index) => (
                  <motion.tr
                    key={combo.guidId}
                    className="transition-colors hover:bg-slate-50"
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.15, delay: index * 0.04 }}
                  >
                    <Table.Td>
                      <span className="text-sm font-medium text-slate-800">{combo.titolo}</span>
                    </Table.Td>
                    <Table.Td className="text-sm text-slate-600">
                      {combo.nomeArea ?? <span className="text-slate-400">{VALORE_ASSENTE}</span>}
                    </Table.Td>
                    <Table.Td className="text-sm text-slate-600">
                      {combo.nomeCanale ?? <span className="text-slate-400">{VALORE_ASSENTE}</span>}
                    </Table.Td>
                    <Table.Td>{tipoBadge(combo.tipo)}</Table.Td>
                    <Table.Td>
                      <StatusBadge
                        tono={combo.stato === STATO_COMBINAZIONI.DISATTIVO ? 'neutral' : 'success'}
                        etichetta={combo.stato === STATO_COMBINAZIONI.DISATTIVO ? 'Disattivato' : 'Attivo'}
                      />
                    </Table.Td>
                    <Table.Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => onNavigateDetails(combo.guidId)}
                          aria-label={`Dettagli della combinazione ${combo.titolo}`}
                          title="Dettagli"
                        >
                          <Lucide icon="FileText" aria-hidden="true" className="h-3.5 w-3.5" />
                        </Button>
                        {combo.stato === STATO_COMBINAZIONI.DISATTIVO ? (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => onStateChange(combo.guidId, STATO_COMBINAZIONI.ATTIVO)}
                            aria-label={`Attiva la combinazione ${combo.titolo}`}
                            title="Attiva"
                          >
                            <Lucide icon="Power" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => onStateChange(combo.guidId, STATO_COMBINAZIONI.DISATTIVO)}
                            aria-label={`Disattiva la combinazione ${combo.titolo}`}
                            title="Disattiva"
                          >
                            <Lucide icon="PowerOff" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </Table.Td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            ) : (
              <Table.Tr>
                <Table.Td colSpan={COLONNE} className="p-0">
                  {searchQuery ? (
                    <EmptyState
                      compatta
                      icon="SearchX"
                      title="Nessun risultato"
                      description="Nessuna combinazione corrisponde alla ricerca."
                      buttonText="Azzera ricerca"
                      buttonIcon="X"
                      onButtonClick={() => onSearchChange('')}
                    />
                  ) : (
                    <EmptyState
                      compatta
                      icon="PackageSearch"
                      title="Nessuna combinazione"
                      description="Non ci sono combinazioni per questo template."
                    />
                  )}
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>
      )}
    </motion.div>
  );
}
