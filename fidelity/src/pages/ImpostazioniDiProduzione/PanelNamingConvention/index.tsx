import Alert from '@/components/Base/Alert';
import { FormInput } from '@/components/Base/Form';
import { Dialog } from "@/components/Base/Headless";
import LoadingIcon from '@/components/Base/LoadingIcon';
import Lucide from '@/components/Base/Lucide';
import EmptyState from '@/components/EmptyState';
import { useNotification } from '@/context/NotificationContext';
import { useFetchDatiNamingConventionFromIstanta, useFetchNamingConventions } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ServerCall } from '../../../../lib/server_call';
import Button from '../../../components/Base/Button';

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
      }
    };

    fetchAvailableFields();
  }, []);

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
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Naming convention eliminata con successo</div>
          </div>
        </div>
      );
      dataNamingConventions.refetch();
      handleChiudiModaleEliminazione();
    },
    onError: (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'eliminazione della naming convention</div>
            <div className="mt-1 text-slate-500">
              {error instanceof Error ? error.message : "Controlla la console per ulteriori informazioni"}
            </div>
          </div>
        </div>
      );
      dataNamingConventions.refetch();
      handleChiudiModaleEliminazione();
      console.log(error);
    }
  });


  const handleAperturaModaleEliminazione = (convention: any) => {
    console.log(convention);
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

  return (
    <>
      {/* Modale di Eliminazione */}
      <Dialog
        open={isModaleEliminazioneAperto && selectedNamingConventionDaEliminare != null}
        onClose={handleChiudiModaleEliminazione}
      >
        <Dialog.Panel className="p-1">
          <Dialog.Title className="px-5 pt-5">
            <h2 className="mr-auto text-base font-medium">
              Elimina naming convention: <span className="font-semibold text-danger">{selectedNamingConventionDaEliminare?.nome}</span>
            </h2>
          </Dialog.Title>
          <Dialog.Description className="p-5">
            Sei sicuro di voler eliminare questa naming convention? Questa operazione non può essere annullata.
          </Dialog.Description>
          <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400">
            <Button
              type="button"
              variant="outline-secondary"
              onClick={handleChiudiModaleEliminazione}
              className="w-24 mr-2"
              disabled={mutationEliminazioneNamingConvention.isPending}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                handleEliminaNamingConvention();
              }}
              className="w-24"
              disabled={mutationEliminazioneNamingConvention.isPending}
            >
              {mutationEliminazioneNamingConvention.isPending ? (
                <div className="flex items-center justify-center">
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Elimino...
                </div>
              ) : "Elimina"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>


      {/* Contenuto principale */}
      <div className="grid grid-cols-12 gap-y-7 gap-x-6 mt-3.5">
        <div className="col-span-12">
          <div className="flex flex-col gap-y-7">
            <div className="flex flex-col">
              {/* Barra di ricerca */}
              <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                <div className="flex-1">
                  <div className="relative">
                    <Lucide
                      icon="Search"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                    />
                    <FormInput
                      type="text"
                      placeholder="Cerca naming conventions per nome, codice o descrizione..."
                      className="pl-9 sm:w-80 rounded-[0.5rem]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                {searchTerm && (
                  <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleClearFilters}
                    >
                      <Lucide icon="X" className="w-4 h-4 mr-2" />
                      Pulisci ricerca
                    </Button>
                  </div>
                )}
              </div>

              {/* Stati loading, error e empty */}
              {dataNamingConventions.isLoading && (
                <div className="flex justify-center items-center py-16">
                  <div className="text-center">
                    <LoadingIcon icon="tail-spin" className="w-8 h-8 mx-auto mb-4" />
                    <div className="text-slate-600 font-medium">Caricamento naming conventions...</div>
                    <div className="text-slate-500 text-sm mt-1">Attendere prego</div>
                  </div>
                </div>
              )}

              {dataNamingConventions.isError && (
                <div className="p-5">
                  <Alert variant="danger" className="flex items-center">
                    <Lucide icon="TriangleAlert" className="w-6 h-6 mr-3" />
                    <div>
                      <div className="font-medium">Errore durante il caricamento</div>
                      <div className="mt-1">Non è stato possibile caricare le naming conventions. Riprova più tardi.</div>
                    </div>
                  </Alert>
                </div>
              )}

              {!dataNamingConventions.isLoading && !dataNamingConventions.isError && (!dataNamingConventions.data || dataNamingConventions.data.length === 0) && (
                <div className="p-5">
                  <EmptyState
                    icon="FileText"
                    title="Nessuna naming convention disponibile"
                    description="Non ci sono naming conventions configurate nel sistema. Utilizza il pulsante 'Nuova naming convention' per aggiungerne una."
                    buttonText="Ricarica"
                    onButtonClick={dataNamingConventions.refetch}
                    iconColor="text-slate-400"
                  />
                </div>
              )}

              {!dataNamingConventions.isLoading && !dataNamingConventions.isError && dataNamingConventions.data && dataNamingConventions.data.length > 0 && filteredNamingConventions?.length === 0 && (
                <div className="p-5">
                  <EmptyState
                    icon="Search"
                    title="Nessun risultato trovato"
                    description="Non sono state trovate naming conventions che corrispondono ai criteri di ricerca. Prova a modificare la ricerca."
                    buttonText="Pulisci ricerca"
                    onButtonClick={handleClearFilters}
                    iconColor="text-slate-400"
                  />
                </div>
              )}

              {/* Lista delle naming conventions in formato tabella professionale */}
              {!dataNamingConventions.isLoading && !dataNamingConventions.isError && filteredNamingConventions && filteredNamingConventions.length > 0 && (
                <div className="p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Naming Convention
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Campi
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Descrizione
                          </th>
                          <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNamingConventions.map((convention, index) => (
                          <tr
                            key={convention.id || index}
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-150"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/10 mr-3">
                                  <Lucide
                                    icon="FileText"
                                    className="w-5 h-5 text-purple-600"
                                  />
                                </div>
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {convention.nome}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    Naming Convention
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="space-y-1">
                                {convention.fields.map((fieldId: string, index: number) => {
                                  const fieldInfo = getFieldInfo(fieldId);

                                  return (
                                    <div key={index} className="text-sm bg-slate-100 px-2 py-1 rounded">
                                      <div className="font-medium text-slate-800">
                                        {(() => {
                                          const idIstantaTrovato = datiNamingConventionFromIstanta.data?.find((istanta: {
                                            id: string;
                                            nome: string;
                                            nomeVisual: string;
                                            descrizione: string;
                                          }) => {
                                            if (istanta.id === fieldId) {
                                              return istanta
                                            }

                                          });
                                          if (idIstantaTrovato) {
                                            return idIstantaTrovato.nomeVisual;
                                          } else {
                                            return fieldInfo.nomeDisplay;
                                          }
                                        })()}
                                      </div>
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
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm text-slate-600 max-w-xs">
                                <div className="line-clamp-2">
                                  {convention.descrizione || "Nessuna descrizione disponibile"}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => props.onEditNamingConvention?.(convention)}
                                  className="hover:bg-primary/5"
                                >
                                  <Lucide icon="PenLine" className="w-4 h-4 mr-1.5" />
                                  Modifica
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleAperturaModaleEliminazione(convention)}
                                  className="hover:bg-danger/5"
                                >
                                  <Lucide icon="Trash2" className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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

// Componente per la selezione dei campi dall'addestramento
const FieldSelector = ({
  availableFields,
  selectedFields,
  onFieldToggle
}: {
  availableFields: FieldInfo[],
  selectedFields: string[],
  onFieldToggle: (fieldId: string) => void
}) => {
  // Raggruppa i campi per addestramento
  const fieldsByAddestramento = availableFields.reduce((acc, field: FieldInfo) => {
    const addestramentoName = field.nomeAddestramento || 'Altri';
    if (!acc[addestramentoName]) {
      acc[addestramentoName] = [];
    }
    acc[addestramentoName].push(field);
    return acc;
  }, {} as Record<string, FieldInfo[]>);

  return (
    <div className="space-y-4">
      {Object.entries(fieldsByAddestramento).map(([addestramentoName, fields]) => (
        <div key={addestramentoName} className="border rounded-lg p-4">
          <h4 className="font-medium text-slate-800 mb-3">{addestramentoName}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {fields.map((field) => (
              <label
                key={field.idCampo}
                className="flex items-start space-x-2 p-2 rounded border hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field.idCampo.toString())}
                  onChange={() => onFieldToggle(field.idCampo.toString())}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800">
                    {field.nomeVisualizzato || field.nomeColonnaOriginale || field.nomeColonna}
                  </div>
                  {field.nomeColonnaOriginale && field.nomeColonnaOriginale !== (field.nomeVisualizzato || field.nomeColonna) && (
                    <div className="text-xs text-slate-500">
                      {field.nomeColonnaOriginale}
                    </div>
                  )}
                  <div className="text-xs text-slate-400">
                    {field.nomeColonna}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NamingConventionPanel;
