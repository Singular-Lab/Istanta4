import ConfirmDialog from '@/components/ConfirmDialog';
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
          variables.stato === STATO_COMBINAZIONI.DISATTIVO
            ? 'Disattivazione avvenuta con successo'
            : 'Attivazione avvenuta con successo',
          { variant: 'success' }
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
      showNotification('Eliminazione avvenuta con successo', { variant: 'success' });
    },
    onError: (error: Error) => {
      showNotification(`Errore durante l'eliminazione: ${error.message}`, { variant: 'error' });
    },
  });

  const mutationCambioStatoCombinazioni = useMutation({
    mutationFn: ({ guidId, stato }: { guidId: string; stato: string }) =>
      ServerCall.put('/cambioStatoCombinazione', { guidId, stato }),
    mutationKey: ['cambioStatoCombinazione'],
    onError: (error: Error) => {
      showNotification(`Errore durante il cambio di stato: ${error.message}`, { variant: 'error' });
    },
  });

  return (
    <>
      {/* Conferma di eliminazione */}
      <ConfirmDialog
        open={showDialogEliminazione}
        title="Eliminare il template?"
        description={<>Il template <strong>{state.selectedTemplate?.titolo}</strong> verrà eliminato. Questa operazione non può essere annullata.</>}
        confirmLabel="Elimina"
        loading={mutationEliminazioneKit.isPending}
        onClose={() => setShowDialogEliminazione(false)}
        onConfirm={() => {
          if (state.selectedTemplate?.guidId) {
            mutationEliminazioneKit.mutate(state.selectedTemplate.guidId);
          }
        }}
      />

      <div className="flex flex-col gap-5">
        {/* Template card grid */}
        <TemplateCardGrid
          templates={filteredTemplates}
          isLoading={dataTemplateCombinazioni.isLoading}
          errore={dataTemplateCombinazioni.isError ? {
            motivo: (dataTemplateCombinazioni.error as Error)?.message || 'Non è stato possibile caricare i template.',
            onRiprova: () => dataTemplateCombinazioni.refetch(),
          } : null}
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
              errore={dataCombinazioni.isError ? {
                motivo: (dataCombinazioni.error as Error)?.message || 'Non è stato possibile caricare le combinazioni.',
                onRiprova: () => dataCombinazioni.refetch(),
              } : null}
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
