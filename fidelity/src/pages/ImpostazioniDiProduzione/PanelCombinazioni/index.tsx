import LoadingIcon from '@/components/Base/LoadingIcon';
import Button from '@/components/Base/Button';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import { useNotification } from '@/context/NotificationContext';
import { useFetchAllCombinazioniDesign, useFetchTemplateCombinazioni } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATO_COMBINAZIONI } from '../../../../lib/enums';
import { ServerCall } from '../../../../lib/server_call';
import CombinationDetailPanel from './CombinationDetailPanel';
import TemplateCardGrid from './TemplateCardGrid';
import { CombinazioneData, TemplateData } from './types';

interface PanelCombinazioniProps {
  callbackEditaTemplate?: (data: TemplateData) => void;
}

interface State {
  selectedTemplate: TemplateData | null;
}

type Action =
  | { type: 'SELECT_TEMPLATE'; payload: TemplateData }
  | { type: 'CLEAR_SELECTION' };

function templateReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_TEMPLATE':
      if (state.selectedTemplate?.guidId === action.payload.guidId) {
        return { ...state, selectedTemplate: null };
      }
      return { ...state, selectedTemplate: action.payload };
    case 'CLEAR_SELECTION':
      return { ...state, selectedTemplate: null };
    default:
      return state;
  }
}

const PanelCombinazioni = forwardRef<unknown, PanelCombinazioniProps>((_props, ref) => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [state, dispatch] = useReducer(templateReducer, { selectedTemplate: null });
  const [showDialogEliminazione, setShowDialogEliminazione] = useState(false);
  const [searchTemplateQuery, setSearchTemplateQuery] = useState('');
  const [searchCombinationQuery, setSearchCombinationQuery] = useState('');
  const [combinations, setCombinations] = useState<CombinazioneData[]>([]);

  const dataTemplateCombinazioni = useFetchTemplateCombinazioni();
  const dataCombinazioni = useFetchAllCombinazioniDesign(state.selectedTemplate?.guidId ?? '');

  useEffect(() => {
    if (dataCombinazioni.data) {
      setCombinations(dataCombinazioni.data);
    }
  }, [dataCombinazioni.data]);

  useEffect(() => {
    if (state.selectedTemplate) {
      dataCombinazioni.refetch();
    }
  }, [state.selectedTemplate]);

  useImperativeHandle(ref, () => ({
    refetchData: () => dataCombinazioni.refetch(),
  }));

  const filteredTemplates = useMemo(() => {
    if (!searchTemplateQuery || !dataTemplateCombinazioni.data) return dataTemplateCombinazioni.data;
    const q = searchTemplateQuery.toLowerCase();
    return dataTemplateCombinazioni.data.filter(
      (t: TemplateData) =>
        t.titolo.toLowerCase().includes(q) || t.codiceFormato.toLowerCase().includes(q)
    );
  }, [dataTemplateCombinazioni.data, searchTemplateQuery]);

  const filteredCombinations = useMemo(() => {
    if (!searchCombinationQuery) return combinations;
    const q = searchCombinationQuery.toLowerCase();
    return combinations.filter(
      (c) =>
        c.titolo.toLowerCase().includes(q) ||
        (c.nomeArea ?? '').toLowerCase().includes(q) ||
        (c.nomeCanale ?? '').toLowerCase().includes(q)
    );
  }, [combinations, searchCombinationQuery]);

  const handleStateChange = useCallback((guidId: string, newState: string) => {
    mutationCambioStatoCombinazioni.mutate({ guidId, stato: newState }, {
      onSuccess: (_data, variables) => {
        setCombinations((prev) =>
          prev.map((c) => (c.guidId === variables.guidId ? { ...c, stato: variables.stato } : c))
        );
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
            <div className="ml-4">
              <div className="font-bold">
                {variables.stato === STATO_COMBINAZIONI.DISATTIVO
                  ? 'Disattivazione avvenuta con successo'
                  : 'Attivazione avvenuta con successo'}
              </div>
            </div>
          </div>
        );
      },
    });
  }, []);

  const callbackAperturaDialogEliminazioneLocal = useCallback((_id: string) => {
    setShowDialogEliminazione(true);
  }, []);

  const mutationEliminazioneKit = useMutation({
    mutationFn: (guidId: string) => ServerCall.delete(`/eliminaRaccoglitoreKit/${guidId}`),
    mutationKey: ['eliminaRaccoglitoreKit'],
    onSuccess: () => {
      setShowDialogEliminazione(false);
      dispatch({ type: 'CLEAR_SELECTION' });
      dataTemplateCombinazioni.refetch();
      dataCombinazioni.refetch();
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4">
            <div className="font-bold">Eliminazione avvenuta con successo</div>
          </div>
        </div>
      );
    },
    onError: (error: Error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-error w-14 h-14" />
          <div className="ml-4">
            <div className="font-bold">Errore durante l'eliminazione</div>
            <div className="mt-1 text-slate-500">{error.message}</div>
          </div>
        </div>
      );
    },
  });

  const mutationCambioStatoCombinazioni = useMutation({
    mutationFn: ({ guidId, stato }: { guidId: string; stato: string }) =>
      ServerCall.put('/cambioStatoCombinazione', { guidId, stato }),
    mutationKey: ['cambioStatoCombinazione'],
    onError: (error: Error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-error w-14 h-14" />
          <div className="ml-4">
            <div className="font-bold">Errore durante il cambio di stato</div>
            <div className="mt-1 text-slate-500">{error.message}</div>
          </div>
        </div>
      );
    },
  });

  return (
    <>
      {/* Delete confirmation dialog */}
      <Dialog open={showDialogEliminazione} onClose={() => setShowDialogEliminazione(false)}>
        <Dialog.Panel>
          <Dialog.Title className="font-bold">Elimina template</Dialog.Title>
          <Dialog.Description>
            Sei sicuro di voler eliminare il template selezionato?
            <br />
            <span className="text-danger">Questa operazione non può essere annullata.</span>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              className="mx-1"
              variant="secondary"
              onClick={() => setShowDialogEliminazione(false)}
              disabled={mutationEliminazioneKit.isPending}
            >
              Annulla
            </Button>
            <Button
              className="mx-1"
              variant="danger"
              disabled={mutationEliminazioneKit.isPending}
              onClick={() => {
                if (state.selectedTemplate?.guidId) {
                  mutationEliminazioneKit.mutate(state.selectedTemplate.guidId);
                }
              }}
            >
              {mutationEliminazioneKit.isPending ? (
                <div className="flex items-center">
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Eliminazione...
                </div>
              ) : (
                <>
                  <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                  Elimina
                </>
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <div className="flex flex-col gap-5 mt-3.5">
        {/* Template card grid */}
        <TemplateCardGrid
          templates={filteredTemplates}
          isLoading={dataTemplateCombinazioni.isLoading}
          selectedTemplateId={state.selectedTemplate?.guidId ?? null}
          searchQuery={searchTemplateQuery}
          onSearchChange={setSearchTemplateQuery}
          onSelectTemplate={(t) => dispatch({ type: 'SELECT_TEMPLATE', payload: t })}
          onDeleteTemplate={callbackAperturaDialogEliminazioneLocal}
          onNavigateDetails={(id) => navigate(`dettagli?id=${id}`)}
        />

        {/* Combination detail panel — slides in when a template is selected */}
        <AnimatePresence>
          {state.selectedTemplate && (
            <CombinationDetailPanel
              key={state.selectedTemplate.guidId}
              selectedTemplate={state.selectedTemplate}
              combinations={filteredCombinations}
              isLoading={dataCombinazioni.isLoading}
              searchQuery={searchCombinationQuery}
              onSearchChange={setSearchCombinationQuery}
              onStateChange={handleStateChange}
              onClose={() => {
                dispatch({ type: 'CLEAR_SELECTION' });
                setSearchCombinationQuery('');
              }}
              onNavigateDetails={(id) =>
                navigate(`/impostazioni-di-produzione/dettagli-combinazione-produzione?id=${id}`)
              }
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
});

export default PanelCombinazioni;
