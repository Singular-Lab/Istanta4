import Alert from '@/components/Base/Alert';
import Button from '@/components/Base/Button';
import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/Base/Form';
import { Dialog, Popover } from "@/components/Base/Headless";
import LoadingIcon from '@/components/Base/LoadingIcon';
import Lucide from '@/components/Base/Lucide';
import EmptyState from '@/components/EmptyState';
import { useNotification } from '@/context/NotificationContext';
import { useFetchFormati } from '@/query/query';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { TIPO_LAVORAZIONE } from '../../../../lib/enums';
import { ServerCall } from '../../../../lib/server_call';
import { FormatiResponseDTO } from '../../../../server/core/dto';

// Tipo per il form di modifica
type FormatiFormData = {
  id?: string;
  nome: string;
  codice: string;
  descrizione: string;
  tipo_lavorazione: number;
  createdat?: Date;
  updatedat?: Date;
};

export interface PanelFormatiRefHandle {
  refetchFormati: () => void;
}

// Schema di validazione per il form
const schemaFormati = yup.object().shape({
  nome: yup.string().required("Il nome è obbligatorio").max(100, "Massimo 100 caratteri"),
  codice: yup.string().required("Il codice è obbligatorio").max(50, "Massimo 50 caratteri"),
  descrizione: yup.string().required("La descrizione è obbligatoria").max(255, "Massimo 255 caratteri"),
  tipo_lavorazione: yup.number().transform(value => (isNaN(value) || value === null || value === undefined) ? undefined : Number(value)).required('Il tipo di lavorazione è obbligatorio').oneOf(Object.values(TIPO_LAVORAZIONE).filter(v => typeof v === 'number') as number[], 'Seleziona un tipo di lavorazione valido'),
  id: yup.string().optional(),
  createdat: yup.date().optional(),
  updatedat: yup.date().optional()
});

const PanelFormati = forwardRef<PanelFormatiRefHandle>((props, ref) => {
  // Hooks e state
  const { showNotification } = useNotification();
  const [isModaleEliminazioneAperto, setIsModaleEliminazioneAperto] = useState(false);
  const [isModaleModificaAperto, setIsModaleModificaAperto] = useState(false);
  const [selectedFormato, setSelectedFormato] = useState<FormatiResponseDTO | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');

  const {
    register: registerModifica,
    handleSubmit: handleSubmitModifica,
    formState: { errors: errorsModifica },
    reset: resetModificaForm,
  } = useForm<FormatiFormData>({
    resolver: yupResolver(schemaFormati),
  });

  // Query per i dati
  const {
    data: formati,
    isLoading,
    isError,
    refetch
  } = useFetchFormati();

  // Filtri per la ricerca
  const filteredFormati = formati?.filter(formato => {
    const matchesSearch = formato.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formato.codice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formato.descrizione?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterTipo === '' || formato.tipo_lavorazione?.toString() === filterTipo;

    return matchesSearch && matchesFilter;
  });

  // Mutation per eliminazione formato
  const mutationEliminazioneFormato = useMutation({
    mutationFn: async (guidId: string) => {
      return await ServerCall.delete(`/deleteFormato/${guidId}`);
    },
    onSuccess: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Formato eliminato con successo</div>
          </div>
        </div>
      );
      refetch();
      handleChiudiModaleEliminazione();
    },
    onError: (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'eliminazione del formato</div>
            <div className="mt-1 text-slate-500">
              {error instanceof Error ? error.message : "Dettagli in console."}
            </div>
          </div>
        </div>
      );
      console.error("Errore eliminazione formato:", error);
      handleChiudiModaleEliminazione();
    }
  });

  const mutationAggiornamentoFormato = useMutation({
    mutationFn: async (data: FormatiFormData) => {
      if (!data.id) throw new Error("ID Formato mancante per l'aggiornamento.");
      return await ServerCall.put(`/salvaFormato`, data);
    },
    onSuccess: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Formato aggiornato con successo</div>
          </div>
        </div>
      );
      refetch();
      handleChiudiModaleModifica();
    },
    onError: (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'aggiornamento del formato</div>
            <div className="mt-1 text-slate-500">
              {error instanceof Error ? error.message : 'Errore sconosciuto'}
            </div>
          </div>
        </div>
      );
      console.error("Errore aggiornamento formato:", error);
    }
  });

  // Funzioni di utility
  const handleAperturaModaleEliminazione = (formato: FormatiResponseDTO) => {
    setSelectedFormato(formato);
    setIsModaleEliminazioneAperto(true);
  };

  const handleChiudiModaleEliminazione = () => {
    setIsModaleEliminazioneAperto(false);
    setSelectedFormato(null);
  };

  const handleEliminaFormato = () => {
    if (selectedFormato?.id) {
      mutationEliminazioneFormato.mutate(selectedFormato.id);
    }
  };

  const handleAperturaModaleModifica = (formato: FormatiResponseDTO) => {
    setSelectedFormato(formato);
    resetModificaForm({
      id: formato.id,
      nome: formato.nome,
      codice: formato.codice,
      descrizione: formato.descrizione,
      tipo_lavorazione: formato.tipo_lavorazione,
    });
    setIsModaleModificaAperto(true);
  };

  const handleChiudiModaleModifica = () => {
    setIsModaleModificaAperto(false);
    setSelectedFormato(null);
    resetModificaForm();
  };

  const handleModificaFormatoSubmit: SubmitHandler<FormatiFormData> = (data) => {
    if (selectedFormato?.id) {
      // Rimuovo eventuali proprietà undefined per rispettare il tipo richiesto
      const payload = {
        ...data,
        id: selectedFormato.id,
      };
      mutationAggiornamentoFormato.mutate(payload);
    } else {
      console.error("ID del formato selezionato non disponibile per l'aggiornamento.");
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="TriangleAlert" className="text-warning w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">ID Formato Mancante</div>
            <div className="mt-1 text-slate-500">
              Non è stato possibile aggiornare il formato.
            </div>
          </div>
        </div>
      );
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterTipo('');
  };

  // Esponi refetch attraverso ref
  useImperativeHandle(ref, () => ({
    refetchFormati: refetch
  }));

  // Render del componente
  return (
    <>
      {/* Modale di Eliminazione */}
      <Dialog
        open={isModaleEliminazioneAperto && selectedFormato !== null}
        onClose={handleChiudiModaleEliminazione}
      >
        <Dialog.Panel className="p-1">
          <Dialog.Title className="px-5 pt-5">
            <h2 className="mr-auto text-base font-medium">
              Elimina formato: <span className="font-semibold text-danger">{selectedFormato?.nome}</span>
            </h2>
          </Dialog.Title>
          <Dialog.Description className="p-5">
            Sei sicuro di voler eliminare questo formato? Questa operazione non può essere annullata.
          </Dialog.Description>
          <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400">
            <Button
              type="button"
              variant="outline-secondary"
              onClick={handleChiudiModaleEliminazione}
              className="w-24 mr-2"
              disabled={mutationEliminazioneFormato.isPending}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleEliminaFormato}
              className="w-24"
              disabled={mutationEliminazioneFormato.isPending}
            >
              {mutationEliminazioneFormato.isPending ? (
                <div className="flex items-center justify-center">
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Elimino...
                </div>
              ) : "Elimina"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Modale di Modifica Formato */}
      <Dialog
        open={isModaleModificaAperto && selectedFormato !== null}
        onClose={handleChiudiModaleModifica}
        size="lg"
      >
        <Dialog.Panel className="p-1">
          <form onSubmit={handleSubmitModifica(handleModificaFormatoSubmit)}>
            <Dialog.Title className="px-5 pt-5">
              <h2 className="mr-auto text-base font-medium">
                Modifica Formato: <span className="font-semibold text-primary">{selectedFormato?.nome}</span>
              </h2>
            </Dialog.Title>
            <Dialog.Description className="grid grid-cols-12 gap-4 p-5 gap-y-5">
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="modifica-nome-formato">Nome</FormLabel>
                <FormInput id="modifica-nome-formato" type="text" {...registerModifica("nome")} className={errorsModifica.nome ? "border-danger" : ""} />
                {errorsModifica.nome && <div className="mt-1 text-xs text-danger">{errorsModifica.nome.message}</div>}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="modifica-codice-formato">Codice</FormLabel>
                <FormInput id="modifica-codice-formato" type="text" {...registerModifica("codice")} className={errorsModifica.codice ? "border-danger" : ""} />
                {errorsModifica.codice && <div className="mt-1 text-xs text-danger">{errorsModifica.codice.message}</div>}
              </div>
              <div className="col-span-12">
                <FormLabel htmlFor="modifica-descrizione-formato">Descrizione</FormLabel>
                <FormTextarea id="modifica-descrizione-formato" rows={3} {...registerModifica("descrizione")} className={errorsModifica.descrizione ? "border-danger" : ""} />
                {errorsModifica.descrizione && <div className="mt-1 text-xs text-danger">{errorsModifica.descrizione.message}</div>}
              </div>
              <div className="col-span-12">
                <FormLabel htmlFor="modifica-tipo-lavorazione">Tipo Lavorazione</FormLabel>
                <FormSelect id="modifica-tipo-lavorazione" {...registerModifica("tipo_lavorazione")} className={errorsModifica.tipo_lavorazione ? "border-danger" : ""}>
                  <option value="">Seleziona un tipo</option>
                  {Object.keys(TIPO_LAVORAZIONE)
                    .filter(key => !isNaN(Number(key)))
                    .map((key) => {
                      const enumKey = parseInt(key, 10) as unknown as keyof typeof TIPO_LAVORAZIONE;
                      return <option key={enumKey} value={enumKey}>{TIPO_LAVORAZIONE[enumKey]}</option>;
                    })}
                </FormSelect>
                {errorsModifica.tipo_lavorazione && <div className="mt-1 text-xs text-danger">{errorsModifica.tipo_lavorazione.message}</div>}
              </div>
            </Dialog.Description>
            <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400">
              <Button
                type="button"
                variant="outline-secondary"
                onClick={handleChiudiModaleModifica}
                className="w-32 mr-2"
                disabled={mutationAggiornamentoFormato.isPending}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="w-36"
                disabled={mutationAggiornamentoFormato.isPending}
              >
                {mutationAggiornamentoFormato.isPending ? (
                  <div className="flex items-center justify-center">
                    <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                    Salvo...
                  </div>
                ) : "Salva Modifiche"}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>

      {/* Contenuto principale */}
      <div className="grid grid-cols-12 gap-y-7 gap-x-6 mt-3.5">
        <div className="col-span-12">
          <div className="flex flex-col gap-y-7">
            <div className="flex flex-col">
              {/* Barra di ricerca e filtri */}
              <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                <div className="flex-1">
                  <div className="relative">
                    <Lucide
                      icon="Search"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                    />
                    <FormInput
                      type="text"
                      placeholder="Cerca formati..."
                      className="pl-9 sm:w-80 rounded-[0.5rem]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">
                  <Popover className="inline-block">
                    {({ close }) => (
                      <>
                        <Popover.Button
                          as={Button}
                          variant="outline-secondary"
                          className="w-full sm:w-auto"
                        >
                          <Lucide
                            icon="Filter"
                            className="stroke-[1.3] w-4 h-4 mr-2"
                          />
                          Filtri
                          {filterTipo && (
                            <div className="flex items-center justify-center h-5 px-1.5 ml-2 text-xs font-medium border rounded-full bg-primary/10 text-primary border-primary/20">
                              1
                            </div>
                          )}
                        </Popover.Button>
                        <Popover.Panel placement="bottom-end" className="p-4 w-64">
                          <div className="mb-4">
                            <div className="text-left text-slate-600 font-medium mb-2">
                              Tipo Lavorazione
                            </div>
                            <FormSelect
                              className="w-full"
                              value={filterTipo}
                              onChange={(e) => setFilterTipo(e.target.value)}
                            >
                              <option value="">Tutti i tipi</option>
                              {Object.keys(TIPO_LAVORAZIONE)
                                .filter(key => !isNaN(Number(key)))
                                .map((key) => {
                                  const enumKey = parseInt(key, 10) as unknown as keyof typeof TIPO_LAVORAZIONE;
                                  return (
                                    <option key={enumKey} value={enumKey}>
                                      {TIPO_LAVORAZIONE[enumKey]}
                                    </option>
                                  );
                                })}
                            </FormSelect>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={handleClearFilters}
                              className="flex-1"
                            >
                              Pulisci
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              className="flex-1"
                              onClick={() => close()}
                            >
                              Applica
                            </Button>
                          </div>
                        </Popover.Panel>
                      </>
                    )}
                  </Popover>
                </div>
              </div>

              {/* Stati loading, error e empty */}
              {isLoading && (
                <div className="flex justify-center items-center py-16">
                  <div className="text-center">
                    <LoadingIcon icon="tail-spin" className="w-8 h-8 mx-auto mb-4" />
                    <div className="text-slate-600 font-medium">Caricamento formati...</div>
                    <div className="text-slate-500 text-sm mt-1">Attendere prego</div>
                  </div>
                </div>
              )}

              {isError && (
                <div className="p-5">
                  <Alert variant="danger" className="flex items-center">
                    <Lucide icon="TriangleAlert" className="w-6 h-6 mr-3" />
                    <div>
                      <div className="font-medium">Errore durante il caricamento</div>
                      <div className="mt-1">Non è stato possibile caricare i formati. Riprova più tardi.</div>
                    </div>
                  </Alert>
                </div>
              )}

              {!isLoading && !isError && (!formati || formati.length === 0) && (
                <div className="p-5">
                  <EmptyState
                    icon="FileImage"
                    title="Nessun formato disponibile"
                    description="Non ci sono formati configurati. Aggiungine uno per iniziare."
                    buttonText="Ricarica"
                    onButtonClick={refetch}
                    iconColor="text-slate-400"
                  />
                </div>
              )}

              {!isLoading && !isError && formati && formati.length > 0 && filteredFormati?.length === 0 && (
                <div className="p-5">
                  <EmptyState
                    icon="Search"
                    title="Nessun risultato trovato"
                    description="Nessun formato corrisponde ai criteri di ricerca. Prova a modificare i filtri."
                    buttonText="Pulisci filtri"
                    onButtonClick={handleClearFilters}
                    iconColor="text-slate-400"
                  />
                </div>
              )}

              {/* Lista dei formati in formato tabella professionale */}
              {!isLoading && !isError && filteredFormati && filteredFormati.length > 0 && (
                <div className="p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Formato
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Codice Formato
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Descrizione
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Tipo Lavorazione
                          </th>
                          <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFormati.map((formato, index) => (
                          <tr
                            key={formato.id || index}
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-150"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 mr-3">
                                  <Lucide
                                    icon="FileImage"
                                    className="w-5 h-5 text-primary"
                                  />
                                </div>
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {formato.nome}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {formato.codice}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm text-slate-600 max-w-xs">
                                <div className="line-clamp-2">
                                  {formato.descrizione || "Nessuna descrizione"}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {TIPO_LAVORAZIONE[formato.tipo_lavorazione] || "Non specificato"}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleAperturaModaleModifica(formato)}
                                  className="hover:bg-primary/5"
                                >
                                  <Lucide icon="PenLine" className="w-4 h-4 mr-1.5" />
                                  Modifica
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleAperturaModaleEliminazione(formato)}
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

PanelFormati.displayName = "PanelFormati";
export default PanelFormati;
