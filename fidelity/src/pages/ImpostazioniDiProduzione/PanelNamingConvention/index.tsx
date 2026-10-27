import Lucide from '@/components/Base/Lucide';
import Table from '@/components/Base/Table';
import ConfirmDialog from '@/components/ConfirmDialog';
import { valoreOAssente } from '@/utils/format';
import { useNotification } from '@/context/NotificationContext';
import { useFetchDatiNamingConventionFromIstanta, useFetchNamingConventions } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ServerCall } from '../../../../lib/server_call';
import Button from '../../../components/Base/Button';
import PannelloElenco from '../PannelloElenco';

// Tipi per le risposte aggiornate del server
interface ServerResponse<T> {
  esito: boolean;
  error: string;
  message?: string;
  isUpdate?: boolean;
  data?: T;
}

const NamingConventionPanel = forwardRef((props: { onEditNamingConvention?: (convention: any) => void }, ref) => {
  const { showNotification } = useNotification();
  const [isModaleEliminazioneAperto, setIsModaleEliminazioneAperto] = useState(false);
  const [selectedNamingConventionDaEliminare, setSelectedNamingConventionDaEliminare] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableFields, setAvailableFields] = useState<FieldInfo[]>([]);
  const dataNamingConventions = useFetchNamingConventions();
  const datiNamingConventionFromIstanta = useFetchDatiNamingConventionFromIstanta();
  // Funzione helper per estrarre tutti i campi dall'addestramento
  const extractFieldsFromAddestramento = (addestramenti: any[]) => {
    const allFields: any[] = [];

    addestramenti.forEach(addestramento => {
      if (addestramento.fields && Array.isArray(addestramento.fields)) {
        addestramento.fields.forEach((field: any) => {
          allFields.push({
            idCampo: field.idCampo,
            nomeColonnaOriginale: field.nomeColonnaOriginale,
            nomeColonna: field.nomeColonna,
            nomeVisualizzato: field.nomeVisualizzato,
            indice: field.indice,
            idAddestramento: addestramento.id,
            nomeAddestramento: addestramento.nome
          });
        });
      }
    });

    return allFields;
  };

  // Carica i campi disponibili per i naming convention
  useEffect(() => {
    const fetchAvailableFields = async () => {
      try {
        const response = await ServerCall.get<any[]>('/get_all_naming_convention_from_istanta');
        if (response) {
          // Se la risposta contiene addestramenti con campi, estrai tutti i campi
          if (response.some(item => item.fields && Array.isArray(item.fields))) {
            const extractedFields = extractFieldsFromAddestramento(response);
            setAvailableFields(extractedFields);
          } else {
            // Fallback per la struttura precedente
            setAvailableFields(response);
          }
        }
      } catch (error) {
        console.error('Errore nel caricamento dei campi disponibili:', error);
        showNotification(
          `Errore nel caricamento dei campi disponibili: ${error instanceof Error && error.message ? error.message : "impossibile recuperare i campi da Istanta"}`,
          { variant: "error" }
        );
      }
    };

    fetchAvailableFields();
  }, [showNotification]);

  // Funzione per mappare i campi ai nomi leggibili
  const getFieldDisplayName = (fieldId: string) => {
    // Cerca nei campi estratti dall'addestramento
    const field = availableFields.find((f: any) => f.idCampo?.toString() === fieldId);
    if (field) {
      // Usa il nome visualizzato se disponibile, altrimenti il nome colonna originale
      return field.nomeVisualizzato || field.nomeColonnaOriginale || field.nomeColonna || fieldId;
    }

    // Fallback: cerca nei campi diretti (per compatibilità con struttura precedente)
    const fallbackField = availableFields.find((f) => {
      if (typeof f === 'string') {
        return f === fieldId;
      }
      return f.idCampo?.toString() === fieldId;
    });
    return fallbackField ? fallbackField.nomeColonnaOriginale : fieldId;
  };

  // Funzione per ottenere informazioni complete sui campi
  const getFieldInfo = (fieldId: string) => {
    const field = availableFields.find((f: any) => f.idCampo?.toString() === fieldId);
    if (field) {
      return {
        idCampo: field.idCampo,
        nomeDisplay: field.nomeVisualizzato || field.nomeColonnaOriginale || field.nomeColonna || fieldId,
        nomeColonnaOriginale: field.nomeColonnaOriginale,
        nomeColonna: field.nomeColonna,
        nomeVisualizzato: field.nomeVisualizzato,
        nomeAddestramento: field.nomeAddestramento,
        idAddestramento: field.idAddestramento
      };
    }
    return {
      idCampo: fieldId,
      nomeDisplay: fieldId,
      nomeColonnaOriginale: null,
      nomeColonna: null,
      nomeVisualizzato: null,
      nomeAddestramento: null,
      idAddestramento: null
    };
  };

  // Filtri per la ricerca
  const filteredNamingConventions = dataNamingConventions.data?.filter(convention => {
    const matchesSearch = convention.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      convention.codice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      convention.descrizione?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const mutationEliminazioneNamingConvention = useMutation({
    mutationFn: async (guidId: string) => {
      const response = await ServerCall.delete(`/deleteNamingConvention/${guidId}`);
      return response;
    },
    onSuccess: () => {
      showNotification("Naming convention eliminata con successo", { variant: "success" });
      dataNamingConventions.refetch();
      handleChiudiModaleEliminazione();
    },
    onError: (error) => {
      showNotification(
        `Errore durante l'eliminazione della naming convention: ${error instanceof Error ? error.message : "controlla la console per ulteriori informazioni"}`,
        { variant: "error" }
      );
      dataNamingConventions.refetch();
      handleChiudiModaleEliminazione();
      console.error(error);
    }
  });


  const handleAperturaModaleEliminazione = (convention: any) => {
    setSelectedNamingConventionDaEliminare(convention);
    setIsModaleEliminazioneAperto(true);
  };

  const handleChiudiModaleEliminazione = () => {
    setIsModaleEliminazioneAperto(false);
    setSelectedNamingConventionDaEliminare(null);
  };


  const handleEliminaNamingConvention = () => {
    if (selectedNamingConventionDaEliminare?.id) {
      mutationEliminazioneNamingConvention.mutate(selectedNamingConventionDaEliminare.id);
    }
  };


  const handleClearFilters = () => {
    setSearchTerm('');
  };

  useImperativeHandle(ref, () => ({
    refetchNamingConventions: dataNamingConventions.refetch
  }));

  // Nome del campo come lo mostra Istanta, altrimenti quello ricavato dall'addestramento
  const nomeCampo = (fieldId: string) => {
    const daIstanta = datiNamingConventionFromIstanta.data?.find((istanta: { id: string; nomeVisual: string }) => istanta.id === fieldId);
    return daIstanta ? daIstanta.nomeVisual : getFieldInfo(fieldId).nomeDisplay;
  };

  return (
    <>
      {/* Conferma di eliminazione */}
      <ConfirmDialog
        open={isModaleEliminazioneAperto && selectedNamingConventionDaEliminare != null}
        title="Eliminare la naming convention?"
        description={<>La naming convention <strong>{selectedNamingConventionDaEliminare?.nome}</strong> verrà eliminata. Questa operazione non può essere annullata.</>}
        confirmLabel="Elimina"
        loading={mutationEliminazioneNamingConvention.isPending}
        onClose={handleChiudiModaleEliminazione}
        onConfirm={handleEliminaNamingConvention}
      />

      <PannelloElenco
        ricerca={searchTerm}
        onRicerca={setSearchTerm}
        etichettaRicerca="Cerca naming convention"
        placeholderRicerca="Nome, codice o descrizione"
        caricamento={dataNamingConventions.isLoading}
        etichettaCaricamento="Caricamento naming convention…"
        errore={dataNamingConventions.isError ? {
          titolo: "Naming convention non caricate",
          motivo: (dataNamingConventions.error as Error)?.message || "Non è stato possibile caricare le naming conventions.",
          onRiprova: () => dataNamingConventions.refetch(),
        } : null}
        totale={dataNamingConventions.data?.length ?? 0}
        filtrati={filteredNamingConventions?.length ?? 0}
        vuoto={{
          icona: "FileText",
          titolo: "Nessuna naming convention disponibile",
          descrizione: "Non ci sono naming convention configurate. Aggiungine una con Nuova convention.",
        }}
        onAzzeraFiltri={handleClearFilters}
        intestazione={
          <>
            <Table.Th>Naming convention</Table.Th>
            <Table.Th>Campi</Table.Th>
            <Table.Th>Descrizione</Table.Th>
            <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
          </>
        }
      >
        {filteredNamingConventions?.map((convention, index) => (
          <Table.Tr key={convention.id || index}>
            <Table.Td className="font-medium text-slate-800">{convention.nome}</Table.Td>
            <Table.Td>
              <div className="flex flex-col gap-1">
                {convention.fields.map((fieldId: string, indice: number) => {
                  const fieldInfo = getFieldInfo(fieldId);

                  return (
                    <div key={indice} className="rounded-control bg-slate-100 px-2 py-1 text-sm">
                      <div className="font-medium text-slate-800">{nomeCampo(fieldId)}</div>
                      {fieldInfo.nomeAddestramento && (
                        <div className="text-xs text-slate-500">
                          da: {fieldInfo.nomeAddestramento}
                        </div>
                      )}
                      {fieldInfo.nomeColonnaOriginale && fieldInfo.nomeColonnaOriginale !== fieldInfo.nomeDisplay && (
                        <div className="text-xs text-slate-400">
                          originale: {fieldInfo.nomeColonnaOriginale}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Table.Td>
            <Table.Td>
              <div className="line-clamp-2 max-w-xs text-sm text-slate-600">
                {valoreOAssente(convention.descrizione)}
              </div>
            </Table.Td>
            <Table.Td className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => props.onEditNamingConvention?.(convention)}
                  aria-label={`Modifica naming convention ${convention.nome ?? ""}`.trim()}
                  title="Modifica"
                >
                  <Lucide icon="PenLine" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleAperturaModaleEliminazione(convention)}
                  aria-label={`Elimina naming convention ${convention.nome ?? ""}`.trim()}
                  title="Elimina"
                >
                  <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Table.Td>
          </Table.Tr>
        ))}
      </PannelloElenco>
    </>
  );
});

// Tipi per i campi dell'addestramento
interface FieldInfo {
  idCampo: number;
  nomeColonnaOriginale: string;
  nomeColonna: string;
  nomeVisualizzato?: string;
  indice: number;
  idAddestramento: number;
  nomeAddestramento: string;
}

export default NamingConventionPanel;
