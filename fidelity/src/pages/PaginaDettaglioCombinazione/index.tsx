import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { FormInput, FormLabel } from '@/components/Base/Form';
import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import ProprietaForm from '@/components/Base/FormFiltriDesign/ProprietaForm';
import { Disclosure, Tab } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import FileManagement from '@/components/FilesKit';
import withSessionCheck from '@/components/SessionChecker';
import { useNotification } from '@/context/NotificationContext';
import { useFetchAllDeclinazioni, useFetchCombinazioneDesignById } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';
import { DESIGN_KIT_MONGO, FileItemKit } from '../../../lib/types';
// ... eventuali altri import necessari

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
    mutationFn: async (data: DESIGN_KIT_MONGO) => {
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


  return (
    <div className="container mx-auto px-4 py-6">
      {/* Tab principale per dividere le due schede */}
      <Tab.Group>
        <div className="flex sm:flex-row xs:flex-col xs:items-end 2xl:items-center  gap-y-3">
          <Tab.List
            variant="boxed-tabs"
            className="flex-col sm:flex-row sm:w-auto mr-auto bg-white box rounded-[0.6rem] border-slate-200">
            <Tab className="bg-slate-50 first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current">
              <Tab.Button className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]" as="button">
                Declinazioni
              </Tab.Button>
            </Tab>
            <Tab className="bg-slate-50 first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current">
              <Tab.Button className="w-full xl:w-40 py-2.5 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.94rem]" as="button">
                File Aggiunti
              </Tab.Button>
            </Tab>
          </Tab.List>
        </div>
        <Tab.Panels>
          {/* Scheda 1: Declinazioni */}
          <Tab.Panel className="mt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="box p-6 shadow-md rounded-lg">
              {/* Tab interno per ciascuna declinazione */}
              <Tab.Group vertical>
                <Tab.List variant="pills" className="flex space-x-3">
                  {fields.map((field, index) => (
                    <Tab key={field.id}>
                      <Tab.Button className="flex items-center space-x-2">
                        <Lucide icon="FileText" className="w-5 h-5" />
                        <span>{field.titolo || `Declinazione ${index + 1}`}</span>
                      </Tab.Button>
                    </Tab>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="soft-primary"
                    onClick={() =>
                      append({
                        titolo: '',
                        proprieta: [{ idChiave: 0, valore: '' }],
                        filtri: [
                          {
                            titoloFiltro: '',
                            condizioni: [{ nome_field: '', operatore: '=', valore: '' }],
                          },
                        ],
                      })
                    }
                    className="ml-auto"
                  >
                    <Lucide icon="Plus" className="w-5 h-5" />
                    <span>Aggiungi Declinazione</span>
                  </Button>
                </Tab.List>
                <Tab.Panels className="border rounded-md mt-4">
                  {fields.map((field, index) => (
                    <Tab.Panel key={field.id}>
                      <div className="p-5">
                        <div className="grid grid-cols-12 gap-4 items-end mb-6">
                          <div className="col-span-7 md:col-span-6">
                            <FormLabel htmlFor={`declinazioni.${index}.titolo`}>
                              Titolo Declinazione
                            </FormLabel>
                            <FormInput
                              id={`declinazioni.${index}.titolo`}
                              {...register(`declinazioni.${index}.titolo`)}
                              placeholder="Titolo Declinazione"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-3">
                            <Button
                              type="button"
                              variant="soft-danger"
                              onClick={() => handleRemoveDeclinazione(index)}
                            >
                              <Lucide icon="Trash2" className="w-5 h-5 mr-1" />
                              Rimuovi Declinazione
                            </Button>
                          </div>
                        </div>
                        {/* Sezioni Collassabili per Proprietà e Filtri */}
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
              <div className="flex justify-end mt-6">
                <Button type="submit" variant="soft-success">
                  <Lucide icon="Save" className="w-5 h-5 mr-1" />
                  Salva Declinazioni
                </Button>
              </div>
            </form>
          </Tab.Panel>
          {/* Scheda 2: File Aggiunti */}
          <Tab.Panel className="mt-4">
            <div className="p-5 bg-white box rounded-lg shadow-md">
              <ul className="space-y-4">
                {files.length === 0 ? (
                  <Badge variant="info" className="p-2 text-blue-500 bg-blue-100 rounded-md">
                    Nessun file aggiunto
                  </Badge>
                ) : (
                  <FileManagement
                    files={files}
                    setFiles={setFiles}
                    setNameToPreview={setNameToPreview}
                  />
                )}
              </ul>
              <div className="flex justify-end mt-6">
                <Button
                  type="button"
                  variant="soft-success"
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
                  <Lucide icon="Save" className="w-5 h-5 mr-1" />
                  Salva File
                </Button>
              </div>
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}

export default withSessionCheck(Main);
