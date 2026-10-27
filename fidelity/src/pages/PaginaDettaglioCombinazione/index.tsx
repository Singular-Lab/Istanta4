import Button from '@/components/Base/Button';
import { FormInput, FormLabel } from '@/components/Base/Form';
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import ProprietaForm from '@/components/Base/FormFiltriDesign/ProprietaForm';
import { Disclosure, Tab } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import EmptyState from '@/components/EmptyState';
import FileManagement from '@/components/FilesKit';
import withSessionCheck from '@/components/SessionChecker';
import { useNotification } from '@/context/NotificationContext';
import { useFetchAllDeclinazioni, useFetchCombinazioneDesignById } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';
import { DESIGN_KIT, FileItemKit } from '../../../lib/types';

// Schede con l'aspetto standard di boxed-tabs: solo larghezza e spaziatura
const CLASSE_SCHEDA = 'w-full whitespace-nowrap py-2 text-sm xl:w-40';

function Main() {
  // Esempio di hook e query (in base al tuo codice originale)
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const { showNotification } = useNotification();
  const [files, setFiles] = useState<FileItemKit[]>([]);
  const [nameToPreview, setNameToPreview] = useState<string[]>([]);
  // Dati relativi alla combinazione (kit) e declinazioni
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      declinazioni: [
        {
          titolo: '',
          proprieta: [{ idChiave: 0, valore: '' }],
          filtri: [
            {
              titoloFiltro: '',
              condizioni: [{ nome_field: '', operatore: '=', valore: '' }],
            },
          ],
        },
      ],
    },
  });
  const dataCombinazione = useFetchCombinazioneDesignById(queryParams.get('id') as string);


  useEffect(() => {
    if (dataCombinazione?.data?.files) {
      setFiles(dataCombinazione?.data?.files);
    }
  }, [dataCombinazione?.data]);



  const { fields, append, remove } = useFieldArray({
    control,
    name: 'declinazioni',
  });
  const dataDeclinazioni = useFetchAllDeclinazioni();

  // Mutazione per salvare le declinazioni
  const mutationCreazioneDeclinazioni = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await ServerCall.put('/creaDeclinazioniPerCombinazioneById', { data, id });
      return result;
    },
    onError: (error: any) => {
      showNotification('Errore durante la creazione delle declinazioni', {
        variant: 'error',
      });
    },
    onSuccess: () => {
      showNotification('Declinazione salvata con successo', { variant: 'success' });
    },
  });


  const updateKit = useMutation({
    mutationFn: async (data: DESIGN_KIT) => {
      data.files = files;
      const result = await ServerCall.put('/updateCombinazioneDesign', data);
      return result;
    },
    onError: (error: any) => {
      showNotification('Errore durante il salvataggio del kit', {
        variant: 'error',
      });
    },
    onSuccess: () => {
      showNotification('Kit salvato con successo', { variant: 'success' });
    },
  });

  const onSubmit = (data: any) => {
    const id = queryParams.get('id') || '';
    mutationCreazioneDeclinazioni.mutate({ id, data });
  };

  const handleRemoveDeclinazione = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Funzioni per la gestione dei file (da definire in base al tuo codice)
  const handleFileNameChange = (index: number, newName: string) => {
    // Implementa la logica per aggiornare il nome del file
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles[index].nome = newName;
      return newFiles;
    });
  };

  const handleDirectiveChange = (index: number, newDirective: string) => {
    // Implementa la logica per aggiornare le direttive del file
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles[index].direttive = newDirective;
      return newFiles;
    });
  };

  const handleDeleteFile = (index: number) => {
    // Implementa la logica per rimuovere il file
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };


  const nuovaDeclinazione = () =>
    append({
      titolo: '',
      proprieta: [{ idChiave: 0, valore: '' }],
      filtri: [
        {
          titoloFiltro: '',
          condizioni: [{ nome_field: '', operatore: '=', valore: '' }],
        },
      ],
    });

  return (
    <Pagina
      titolo={dataCombinazione.data?.titolo || 'Dettaglio combinazione'}
      descrizione="Declinazioni e file della combinazione"
      indietro={{ to: '/impostazioni-di-produzione', etichetta: 'Torna alle impostazioni di produzione' }}
    >
      {dataCombinazione.isError ? (
        <PageError
          compatta
          titolo="Impossibile caricare la combinazione"
          motivo={(dataCombinazione.error as Error)?.message || 'Il servizio non ha restituito la combinazione.'}
          onRiprova={() => dataCombinazione.refetch()}
        />
      ) : dataCombinazione.isLoading ? (
        <div role="status" className="box box--stacked flex flex-col items-center gap-3 p-8 text-slate-500">
          <Spinner decorativo />
          <span className="text-sm">Caricamento combinazione…</span>
        </div>
      ) : (
        /* Tab principale per dividere le due schede */
        <Tab.Group>
          <Tab.List variant="boxed-tabs" className="sm:w-auto sm:self-start">
            <Tab>
              <Tab.Button className={CLASSE_SCHEDA} as="button">
                Declinazioni
              </Tab.Button>
            </Tab>
            <Tab>
              <Tab.Button className={CLASSE_SCHEDA} as="button">
                File aggiunti
              </Tab.Button>
            </Tab>
          </Tab.List>
          <Tab.Panels className="mt-6">
            {/* Scheda 1: Declinazioni */}
            <Tab.Panel>
              <form onSubmit={handleSubmit(onSubmit)}>
                <Sezione
                  senzaPadding
                  icona="GitBranch"
                  titolo="Declinazioni"
                  descrizione="Titolo, proprietà e filtri di ogni declinazione"
                  azioni={
                    <Button type="button" size="sm" variant="outline-secondary" onClick={nuovaDeclinazione}>
                      <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      Aggiungi declinazione
                    </Button>
                  }
                >
                  <div className="px-5 pb-5">
                    {/* Tab interno per ciascuna declinazione */}
                    <Tab.Group vertical>
                      <Tab.List variant="pills" className="gap-2">
                        {fields.map((field, index) => (
                          <Tab key={field.id}>
                            <Tab.Button className="flex items-center gap-2">
                              <Lucide icon="FileText" aria-hidden="true" className="h-4 w-4" />
                              <span>{field.titolo || `Declinazione ${index + 1}`}</span>
                            </Tab.Button>
                          </Tab>
                        ))}
                      </Tab.List>
                      <Tab.Panels className="mt-4 rounded-card border border-slate-200">
                        {fields.map((field, index) => (
                          <Tab.Panel key={field.id}>
                            <div className="p-5">
                              <div className="mb-6 grid grid-cols-12 items-end gap-4">
                                <div className="col-span-12 md:col-span-6">
                                  <FormLabel htmlFor={`declinazioni.${index}.titolo`}>
                                    Titolo della declinazione
                                  </FormLabel>
                                  <FormInput
                                    id={`declinazioni.${index}.titolo`}
                                    {...register(`declinazioni.${index}.titolo`)}
                                    placeholder="Titolo della declinazione"
                                  />
                                </div>
                                <div className="col-span-12 md:col-span-6">
                                  <Button
                                    type="button"
                                    variant="outline-danger"
                                    onClick={() => handleRemoveDeclinazione(index)}
                                  >
                                    <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                                    Rimuovi declinazione
                                  </Button>
                                </div>
                              </div>
                              {/* Sezioni collassabili per proprietà e filtri */}
                              <Disclosure.Group variant="boxed" className="space-y-4">
                                <Disclosure defaultOpen={false}>
                                  <Disclosure.Button>
                                    <span className="font-medium">Proprietà</span>
                                  </Disclosure.Button>
                                  <Disclosure.Panel className="p-4">
                                    <ProprietaForm
                                      data={dataDeclinazioni.data}
                                      control={control}
                                      register={register}
                                      errors={errors}
                                      declinazioneIndex={index}
                                    />
                                  </Disclosure.Panel>
                                </Disclosure>
                                <Disclosure defaultOpen={false}>
                                  <Disclosure.Button>
                                    <span className="font-medium">Filtri</span>
                                  </Disclosure.Button>
                                  <Disclosure.Panel className="p-4">
                                    <FilterBaseForm
                                      control={control}
                                      register={register}
                                      errors={errors}
                                      dataFiltri={field.filtri}
                                      dataAddestramenti={[] /* Inserisci i dati addestramenti se presenti */}
                                      declinazioneIndex={index}
                                      namePrefix={`declinazioni.${index}.filtri`}
                                    />
                                  </Disclosure.Panel>
                                </Disclosure>
                              </Disclosure.Group>
                            </div>
                          </Tab.Panel>
                        ))}
                      </Tab.Panels>
                    </Tab.Group>
                  </div>
                  <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                    <Button
                      type="submit"
                      variant="primary"
                      loading={mutationCreazioneDeclinazioni.isPending}
                      disabled={mutationCreazioneDeclinazioni.isPending}
                    >
                      {!mutationCreazioneDeclinazioni.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                      Salva declinazioni
                    </Button>
                  </div>
                </Sezione>
              </form>
            </Tab.Panel>
            {/* Scheda 2: File aggiunti */}
            <Tab.Panel>
              <Sezione senzaPadding icona="Files" titolo="File aggiunti" descrizione="I file della combinazione">
                <div className="px-5 pb-5">
                  {files.length === 0 ? (
                    <EmptyState
                      compatta
                      icon="FileX"
                      title="Nessun file aggiunto"
                      description=""
                      className="border border-dashed border-slate-200"
                    />
                  ) : (
                    <FileManagement
                      files={files}
                      setFiles={setFiles}
                      setNameToPreview={setNameToPreview}
                    />
                  )}
                </div>
                <div className="flex justify-end border-t border-slate-200 px-5 py-4">
                  <Button
                    type="button"
                    variant="primary"
                    loading={updateKit.isPending}
                    onClick={() => {
                      if (dataCombinazione?.data) {
                        updateKit.mutate({
                          ...dataCombinazione.data,
                          guidId: dataCombinazione.data.guidId ?? '',
                          files,
                        });
                      }
                    }}
                  >
                    {!updateKit.isPending && <Lucide icon="Save" aria-hidden="true" className="mr-2 h-4 w-4" />}
                    Salva file
                  </Button>
                </div>
              </Sezione>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      )}
    </Pagina>
  );
}

export default withSessionCheck(Main);
