import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog, Popover } from "@/components/Base/Headless";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import { PermissionGate } from "@/components/PermissionGate";
import Table from "@/components/Base/Table";
import withSessionChecked from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { useFetchAreeCanaliECombinazioni } from "@/query/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import { CombinazioneCanaleAreaAttributes } from "../../../lib/types";
import { AreaResponseDTO, CanaleResponseDTO, CreateAreaDTO } from "../../../server/core/dto";

// Tipi per le risposte aggiornate del server
interface ServerResponse<T> {
  esito: boolean;
  error: string;
  message?: string;
  isUpdate?: boolean;
  data?: T;
}

function Main() {
  const queryClient = useQueryClient();
  const [listaAree, setListaAree] = useState<AreaResponseDTO[]>([]);
  const [listaCanali, setListaCanali] = useState<CanaleResponseDTO[]>([]);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isCanaleDialogOpen, setIsCanaleDialogOpen] = useState(false);
  const [isCombinazioneDialogOpen, setIsCombinazioneDialogOpen] = useState(false);
  const [nomeArea, setNomeArea] = useState<string>("");
  const [siglaArea, setSiglaArea] = useState<string>("");

  const [nomeCanale, setNomeCanale] = useState<string>("");
  const [siglaCanale, setSiglaCanale] = useState<string>("");

  const [idAreaSelezionata, setIdAreaSelezionata] = useState<string>("");
  const [idCanaleSelezionato, setIdCanaleSelezionato] = useState<string>("");
  const [idCombinazioneSelezionata, setIdCombinazioneSelezionata] = useState<string>("");
  const [enabledCombinazione, setEnabledCombinazione] = useState<string>("true");

  // Stati per la modifica
  const [isEditingArea, setIsEditingArea] = useState(false);
  const [isEditingCanale, setIsEditingCanale] = useState(false);
  const [isEditingCombinazione, setIsEditingCombinazione] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string>("");
  const [editingCanaleId, setEditingCanaleId] = useState<string>("");
  const [editingCombinazioneId, setEditingCombinazioneId] = useState<string>("");
  const [showDialogEliminazioneAree, setShowDialogEliminazioneAree] = useState(false);
  const [showDialogEliminazioneCanali, setShowDialogEliminazioneCanali] = useState(false);
  const [showDialogEliminazioneCombinazioni, setShowDialogEliminazioneCombinazioni] = useState(false);
  const { showNotification } = useNotification();

  const { data: dataAreeCanaliECombinazioni } = useFetchAreeCanaliECombinazioni();

  useEffect(() => {
    if (dataAreeCanaliECombinazioni !== null && dataAreeCanaliECombinazioni !== undefined && dataAreeCanaliECombinazioni.aree.length > 0) {
      setListaAree(dataAreeCanaliECombinazioni.aree);
      setIdAreaSelezionata(dataAreeCanaliECombinazioni.aree[0].id as string);
    }
    if (dataAreeCanaliECombinazioni !== null && dataAreeCanaliECombinazioni !== undefined && dataAreeCanaliECombinazioni.canali.length > 0) {
      setListaCanali(dataAreeCanaliECombinazioni.canali);
      setIdCanaleSelezionato(dataAreeCanaliECombinazioni.canali[0].id as string);
    }
  }, [dataAreeCanaliECombinazioni])




  const handleCreateClick = (type: string) => {
    if (type === 'area') {
      setIsAreaDialogOpen(true);
    } else if (type === 'canale') {
      setIsCanaleDialogOpen(true);
    } else if (type === 'combinazione') {
      setIsCombinazioneDialogOpen(true);
    }
  };

  const closeAreaDialog = () => {
    setIsAreaDialogOpen(false);
    setNomeArea("");
    setSiglaArea("");
    setIsEditingArea(false);
    setEditingAreaId("");
  };
  const closeCanaleDialog = () => {
    setIsCanaleDialogOpen(false);
    setNomeCanale("");
    setSiglaCanale("");
    setIsEditingCanale(false);
    setEditingCanaleId("");
  }
  const closeCombinazioneDialog = () => {
    setIsCombinazioneDialogOpen(false);
    setIsEditingCombinazione(false);
    setEditingCombinazioneId("");
  };

  const createArea = async (area: CreateAreaDTO): Promise<void> => {
    const result = await ServerCall.put<ServerResponse<AreaResponseDTO>>('/ACPV/salvaArea', area);
    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditArea();
        // Aggiorna la lista locale
        setListaAree(listaAree.map(a => a.id === result.data!.id ? result.data! : a));
      } else {
        notifySuccessArea();
        setListaAree([...listaAree, result.data]);
      }
    }

    closeAreaDialog();
  };

  const createCanale = async (canale: { nome: string; sigla: string; id?: string }): Promise<void> => {
    const result = await ServerCall.put<ServerResponse<CanaleResponseDTO>>('/ACPV/salvaCanale', canale);
    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditCanale();
        // Aggiorna la lista locale
        setListaCanali(listaCanali.map(c => c.id === result.data!.id ? result.data! : c));
      } else {
        notifySuccessArea();
        setListaCanali([...listaCanali, result.data]);
      }
    }
    closeCanaleDialog();
  };

  const createCombinazione = async (combinazione: { guidIDCanale: string; guidIDArea: string, enabled: string }): Promise<void> => {
    console.log("Combinazione:", combinazione);
    const result = await ServerCall.put<ServerResponse<CombinazioneCanaleAreaAttributes>>('/ACPV/setCombinazione', combinazione);
    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditCombinazione();
      } else {
        notifySuccessArea();
      }
    }
    closeCombinazioneDialog();
  };

  // Funzioni unificate per creazione e modifica
  const saveArea = async (area: CreateAreaDTO): Promise<void> => {
    const areaData = isEditingArea ? { ...area, id: editingAreaId } : area;
    const result = await ServerCall.put<ServerResponse<AreaResponseDTO>>('/ACPV/salvaArea', areaData);
    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditArea();
        // Aggiorna la lista locale
        setListaAree(listaAree.map(a => a.id === result.data!.id ? result.data! : a));
      } else {
        notifySuccessArea();
        setListaAree([...listaAree, result.data]);
      }
    }
    closeAreaDialog();
  };

  const saveCanale = async (canale: { nome: string; sigla: string; id?: string }): Promise<void> => {
    const canaleData = isEditingCanale ? { ...canale, id: editingCanaleId } : canale;
    const result = await ServerCall.put<ServerResponse<CanaleResponseDTO>>('/ACPV/salvaCanale', canaleData);
    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditCanale();
        // Aggiorna la lista locale
        setListaCanali(listaCanali.map(c => c.id === result.data!.id ? result.data! : c));
      } else {
        notifySuccessArea();
        setListaCanali([...listaCanali, result.data]);
      }
    }
    closeCanaleDialog();
  };

  const saveCombinazione = async (combinazione: { guidID: string; guidIDCanale: string; guidIDArea: string; enabled: string }): Promise<void> => {
    const combinazioneData = isEditingCombinazione ? { ...combinazione, id: editingCombinazioneId } : combinazione;
    console.log("Combinazione:", combinazioneData);
    const result = await ServerCall.put<ServerResponse<CombinazioneCanaleAreaAttributes>>('/ACPV/setCombinazione', combinazioneData);

    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditCombinazione();
      } else {
        notifySuccessArea();
      }
    }
    closeCombinazioneDialog();
  };

  // Funzioni per la modifica
  const handleEditArea = (area: AreaResponseDTO) => {
    setEditingAreaId(area.id as string);
    setNomeArea(area.nome);
    setSiglaArea(area.codice);
    setIsEditingArea(true);
    setIsAreaDialogOpen(true);
  };

  const handleEditCanale = (canale: CanaleResponseDTO) => {
    setEditingCanaleId(canale.id as string);
    setNomeCanale(canale.nome);
    setSiglaCanale(canale.codice);
    setIsEditingCanale(true);
    setIsCanaleDialogOpen(true);
  };

  const handleEditCombinazione = (combinazione: { id: string; sigla: string; stato: string }) => {
    setEditingCombinazioneId(combinazione.id);
    // Per ora non possiamo modificare area e canale in una combinazione esistente
    // Dovremmo recuperare questi dati dal server
    setEnabledCombinazione(combinazione.stato === "Attivo" ? "true" : "false");
    setIsEditingCombinazione(true);
    setIsCombinazioneDialogOpen(true);
  };

  const deleteArea = async (id: string): Promise<void> => {
    await ServerCall.delete(`/ACPV/eliminaArea/${id}`);
  };

  const deleteCanale = async (id: string): Promise<void> => {
    await ServerCall.delete(`/ACPV/eliminaCanale/${id}`);
  };

  const deleteCombinazione = async (id: string): Promise<void> => {
    await ServerCall.delete(`/ACPV/deleteCombinazione/${id}`);
  };



  const deleteCombinazioneMutation = useMutation<void, Error, string>({
    mutationFn: deleteCombinazione,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchCombinazioni'] });
    },
    onError: (error) => {
      console.log("Errore nell'eliminazione della combinazione", error);
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nell'eliminazione della combinazione</div>
            <div className="mt-1 text-slate-500">
              Si è verificato un errore durante l'eliminazione della combinazione.
            </div>
          </div>
        </div>
      );
    }
  });

  const deleteAreaMutation = useMutation<void, Error, string>({
    mutationFn: deleteArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchAree'] });
    },
    onError: (error) => {
      console.log("Errore nell'eliminazione dell'area", error);
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nell'eliminazione dell'area</div>
            <div className="mt-1 text-slate-500">
              Si è verificato un errore durante l'eliminazione dell'area.
            </div>
          </div>
        </div>
      );
    }
  });

  const deleteCanaleMutation = useMutation<void, Error, string>({
    mutationFn: deleteCanale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchCanali'] });
    },
    onError: (error) => {
      console.log("Errore nell'eliminazione del canale ", error);
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nell'eliminazione del canale</div>
            <div className="mt-1 text-slate-500">
              Si è verificato un errore durante l'eliminazione del canale.
            </div>
          </div>
        </div>
      );
    }
  });




  // Mutation unificate per creazione e modifica
  const saveAreaMutation = useMutation<void, Error, CreateAreaDTO>({
    mutationFn: saveArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchAree'] });
    }
  });

  const saveCanaleMutation = useMutation<void, Error, { nome: string; sigla: string; id?: string }>({
    mutationFn: saveCanale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchCanali'] });
    },
    onError: () => {
      notifyErrorCanale();
    }
  });

  const saveCombinazioneMutation = useMutation<void, Error, { guidID: string; guidIDCanale: string; guidIDArea: string; enabled: string }>({
    mutationFn: saveCombinazione,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchCombinazioni'] });
    },
    onError: () => {
      notifyErrorCombinazione();
    }
  });

  const handleDeleteArea = (id: string) => {
    setShowDialogEliminazioneAree(true);
    setIdAreaSelezionata(id);
    // deleteAreaMutation.mutate(id);
  };

  const handleDeleteCanale = (id: string) => {
    setShowDialogEliminazioneCanali(true);
    setIdCanaleSelezionato(id);
    // deleteCanaleMutation.mutate(id);
  };
  const handleDeleteCombinazione = (id: string) => {
    setShowDialogEliminazioneCombinazioni(true);
    setIdCombinazioneSelezionata(id);
    // deleteCombinazioneMutation.mutate(id);
  }

  const notifySuccessArea = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Area creata con successo</div>
        </div>
      </div>
    );
  };

  const notifyErrorArea = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleAlert" className="text-alert w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Errore nella creazione dell'area</div>
          <div className="mt-1 text-slate-500">
            Si è verificato un errore durante la creazione dell'area.
          </div>
        </div>
      </div>
    );
  };
  const notifyErrorCanale = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleAlert" className="text-alert w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Errore nella creazione del canale</div>
          <div className="mt-1 text-slate-500">
            Si è verificato un errore durante la creazione del canale.
          </div>
        </div>
      </div>
    );
  };

  const notifySuccessEditArea = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Area modificata con successo</div>
        </div>
      </div>
    );
  };
  const notifyErrorCombinazione = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleAlert" className="text-alert w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Errore nella creazione della combinazione</div>
          <div className="mt-1 text-slate-500">
            Si è verificato un errore durante la creazione della combinazione.
          </div>
        </div>
      </div>
    );
  };
  const notifySuccessEditCanale = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Canale modificato con successo</div>
        </div>
      </div>
    );
  };

  const notifySuccessEditCombinazione = () => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Combinazione modificata con successo</div>
        </div>
      </div>
    );
  };



  return (
    <>
      <Dialog open={showDialogEliminazioneAree} onClose={() => {
        setShowDialogEliminazioneAree(false);
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              Elimina Area
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <p>Sei sicuro di voler eliminare l'area?</p>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="primary" onClick={() => {
              setShowDialogEliminazioneAree(false);
            }}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button variant="danger" type="button" className="w-20" onClick={() => {
              deleteAreaMutation.mutate(idAreaSelezionata);
              setShowDialogEliminazioneAree(false);
            }}>
              Elimina
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={showDialogEliminazioneCanali} onClose={() => {
        setShowDialogEliminazioneCanali(false);
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              Elimina Canale
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <p>Sei sicuro di voler eliminare il canale?</p>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="primary" onClick={() => {
              setShowDialogEliminazioneCanali(false);
            }}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button variant="danger" type="button" className="w-20" onClick={() => {
              deleteCanaleMutation.mutate(idCanaleSelezionato);
              setShowDialogEliminazioneCanali(false);
            }}>
              Elimina
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={showDialogEliminazioneCombinazioni} onClose={() => {
        setShowDialogEliminazioneCombinazioni(false);
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              Elimina Combinazione
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <p>Sei sicuro di voler eliminare la combinazione?</p>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="primary" onClick={() => {
              setShowDialogEliminazioneCombinazioni(false);
            }}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button variant="danger" type="button" className="w-20" onClick={() => {
              deleteCombinazioneMutation.mutate(idCombinazioneSelezionata);
              setShowDialogEliminazioneCombinazioni(false);
            }}>
              Elimina
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={isAreaDialogOpen} onClose={closeAreaDialog}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              {isEditingArea ? 'Modifica Area' : 'Crea Area'}
            </h2>
          </Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="modal-form-1">
                Nome
              </FormLabel>
              <FormInput id="modal-form-1" type="text" value={nomeArea} onChange={(e) => { setNomeArea(e.target.value) }} />
            </div>
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="modal-form-2">
                Sigla
              </FormLabel>
              <FormInput id="modal-form-2" type="text" value={siglaArea} onChange={(e) => { setSiglaArea(e.target.value) }} />
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-danger" onClick={closeAreaDialog}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              className="w-20"
              disabled={saveAreaMutation.isPending || !nomeArea.trim() || !siglaArea.trim()}
              aria-busy={saveAreaMutation.isPending}
              onClick={() =>
                saveAreaMutation.mutate({
                  nome: nomeArea,
                  codice: siglaArea,
                })
              }
            >
              {isEditingArea ? 'Modifica' : 'Crea'}
              {saveAreaMutation.isPending && (
                <LoadingIcon icon="oval" color="white" className="w-4 h-4 ml-2 animate-spin" />
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      {/* Dialog per Crea Canale */}
      <Dialog open={isCanaleDialogOpen} onClose={closeCanaleDialog}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              {isEditingCanale ? 'Modifica Canale' : 'Crea Canale'}
            </h2>
          </Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="modal-form-1">
                Nome
              </FormLabel>
              <FormInput id="modal-form-1" type="text" value={nomeCanale} onChange={(e) => { setNomeCanale(e.target.value) }} />
            </div>
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="modal-form-2">
                Sigla
              </FormLabel>
              <FormInput id="modal-form-2" type="text" value={siglaCanale} onChange={(e) => { setSiglaCanale(e.target.value) }} />
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-danger" onClick={closeCanaleDialog}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              className="w-20"
              disabled={saveCanaleMutation.isPending || !nomeCanale.trim() || !siglaCanale.trim()}
              aria-busy={saveCanaleMutation.isPending}
              onClick={() => saveCanaleMutation.mutate({ nome: nomeCanale, sigla: siglaCanale, id: isEditingCanale ? editingCanaleId : undefined })}
            >
              {isEditingCanale ? 'Modifica' : 'Crea'}
              {saveCanaleMutation.isPending && (
                <LoadingIcon icon="oval" color="white" className="w-4 h-4 ml-2 animate-spin" />
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={isCombinazioneDialogOpen} onClose={closeCombinazioneDialog}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              {isEditingCombinazione ? 'Modifica Combinazione' : 'Crea Combinazione'}
            </h2>
          </Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="modal-form-1">
                Area
              </FormLabel>
              <FormSelect id="modal-form-1" className="w-full" value={idAreaSelezionata} onChange={(e) => { setIdAreaSelezionata(e.target.value) }}>
                {listaAree.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nome}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div className="col-span-12 sm:col-span-6">
              <FormLabel htmlFor="modal-form-2">
                Canale
              </FormLabel>
              <FormSelect id="modal-form-2" className="w-full" value={idCanaleSelezionato} onChange={(e) => { setIdCanaleSelezionato(e.target.value) }}>
                {listaCanali.map((canale) => (
                  <option key={canale.id} value={canale.id}>
                    {canale.nome}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div className="col-span-12 sm:col-span-12">
              <FormLabel htmlFor="modal-form-2">
                Stato
              </FormLabel>
              <FormSelect id="modal-form-2" className="w-full" value={enabledCombinazione} onChange={(e) => { setEnabledCombinazione(e.target.value) }}>
                <option value="true">Attivo</option>
                <option value="false">Disattivo</option>
              </FormSelect>
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-danger" onClick={() => { setIdAreaSelezionata(""); setIdCanaleSelezionato(""); closeCombinazioneDialog() }}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              className="w-20"
              disabled={saveCombinazioneMutation.isPending}
              aria-busy={saveCombinazioneMutation.isPending}
              onClick={() => saveCombinazioneMutation.mutate({ guidID: isEditingCombinazione ? editingCombinazioneId : "", guidIDCanale: idCanaleSelezionato, guidIDArea: idAreaSelezionata, enabled: enabledCombinazione })}
            >
              {isEditingCombinazione ? 'Modifica' : 'Crea'}
              {saveCombinazioneMutation.isPending && (
                <LoadingIcon icon="oval" color="white" className="w-4 h-4 ml-2 animate-spin" />
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title="Aree e Canali"
            description="Gestione aree e canali"
          />
          <div className="mt-3.5">
            <div className="flex flex-col box box--stacked">
              <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                <div>
                  <div className="relative">
                    <Lucide
                      icon="Search"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                    />
                    <FormInput
                      type="text"
                      placeholder="Cerca promozione..."
                      className="pl-9 sm:w-64 rounded-[0.5rem]"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">

                  <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI} mode="disable">
                  <Popover className="inline-block">
                    {({ close }) => (
                      <>
                        <Popover.Button
                          as={Button}
                          variant="outline-secondary"
                          className="w-full sm:w-auto"
                        >
                          <Lucide
                            icon="Plus"
                            className="stroke-[1.3] w-4 h-4 mr-2"
                          />
                          Crea
                          <Lucide
                            icon="ChevronDown"
                            className="stroke-[1.3] w-4 h-4 ml-2"
                          />
                        </Popover.Button>
                        <Popover.Panel className="w-60">
                          <div className="p-2">
                            <div
                              className="flex items-center p-2 transition-colors duration-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-600"
                              onClick={() => {
                                handleCreateClick("area");
                                close();
                              }}
                            >
                              <Lucide icon="MapPin" className="w-4 h-4 mr-2" />
                              Crea Area
                            </div>
                            <div
                              className="flex items-center p-2 transition-colors duration-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-600"
                              onClick={() => {
                                handleCreateClick("canale");
                                close();
                              }}
                            >
                              <Lucide icon="Radio" className="w-4 h-4 mr-2" />
                              Crea Canale
                            </div>
                            <div
                              className="flex items-center p-2 transition-colors duration-200 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-600"
                              onClick={() => {
                                handleCreateClick("combinazione");
                                close();
                              }}
                            >
                              <Lucide icon="Box" className="w-4 h-4 mr-2" />
                              Crea Combinazione
                            </div>
                          </div>
                        </Popover.Panel>
                      </>
                    )}
                  </Popover>
                  </PermissionGate>
                </div>
              </div>

              <div className="overflow-hidden">
                <div className="grid grid-cols-12 gap-6 px-5 -mx-5 border-dashed border-y">
                  <div className="overflow-x-auto lg:col-span-6 sm:col-span-12 xs:col-span-12 px-5">
                    <div className="px-5 border rounded-[0.6rem] dark:border-darkmode-400 relative mt-7 mb-4 border-slate-200/80">
                      <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white dark:bg-darkmode-600 text-slate-500 dark:text-slate-400">
                        <div className="-mt-px">Aree</div>
                      </div>
                      <div className="py-2 mt-4 flex flex-col gap-3.5 overflow-x-auto">
                        <Table>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th className="whitespace-nowrap">#</Table.Th>
                              <Table.Th className="whitespace-nowrap">Nome Area</Table.Th>
                              <Table.Th className="whitespace-nowrap">Codice Area</Table.Th>
                              <Table.Th className="whitespace-nowrap">Azioni</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {dataAreeCanaliECombinazioni?.aree?.length === 0 ? (
                              <Table.Tr>
                                <Table.Td colSpan={4} className="text-center">Nessuna area disponibile</Table.Td>
                              </Table.Tr>
                            ) : (
                              dataAreeCanaliECombinazioni?.aree?.map((area, index) => (
                                <Table.Tr key={area.id}>
                                  <Table.Td className="whitespace-nowrap">{index + 1}</Table.Td>
                                  <Table.Td className="whitespace-nowrap">{area.nome}</Table.Td>
                                  <Table.Td className="whitespace-nowrap">{area.codice}</Table.Td>
                                  <Table.Td className="whitespace-nowrap">
                                    <div className="flex gap-2">
                                      <button
                                        className="text-primary hover:text-primary/80 transition-colors"
                                        onClick={() => handleEditArea(area)}
                                        title="Modifica area"
                                      >
                                        <Lucide icon="Pencil" className="w-4 h-4" />
                                      </button>
                                      <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                                        <button
                                          className="text-danger hover:text-danger/80 transition-colors"
                                          onClick={() => handleDeleteArea(area.id as string)}
                                          title="Elimina area"
                                        >
                                          <Lucide icon="Trash2" className="w-4 h-4" />
                                        </button>
                                      </PermissionGate>
                                    </div>
                                  </Table.Td>
                                </Table.Tr>
                              ))
                            )}
                          </Table.Tbody>
                        </Table>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto lg:col-span-6 sm:col-span-12 xs:col-span-12 px-5">
                    <div className="px-5 border rounded-[0.6rem] dark:border-darkmode-400 relative mt-7 mb-4 border-slate-200/80">
                      <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white dark:bg-darkmode-600 text-slate-500 dark:text-slate-400">
                        <div className="-mt-px">Canali</div>
                      </div>
                      <div className="py-2 mt-4 flex flex-col gap-3.5 overflow-x-auto">
                        <Table>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th className="whitespace-nowrap">#</Table.Th>
                              <Table.Th className="whitespace-nowrap">Nome Canale</Table.Th>
                              <Table.Th className="whitespace-nowrap">Codice Canale</Table.Th>
                              <Table.Th className="whitespace-nowrap">Azioni</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {dataAreeCanaliECombinazioni?.canali?.length === 0 ? (
                              <Table.Tr>
                                <Table.Td colSpan={4} className="text-center">Nessun canale disponibile</Table.Td>
                              </Table.Tr>
                            ) : (
                              dataAreeCanaliECombinazioni?.canali?.map((canale, index) => (
                                <Table.Tr key={canale.id}>
                                  <Table.Td className="whitespace-nowrap">{index + 1}</Table.Td>
                                  <Table.Td className="whitespace-nowrap">{canale.nome}</Table.Td>
                                  <Table.Td className="whitespace-nowrap">{canale.codice}</Table.Td>
                                  <Table.Td className="whitespace-nowrap">
                                    <div className="flex gap-2">
                                      <button
                                        className="text-primary hover:text-primary/80 transition-colors"
                                        onClick={() => handleEditCanale(canale)}
                                        title="Modifica canale"
                                      >
                                        <Lucide icon="Pencil" className="w-4 h-4" />
                                      </button>
                                      <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                                        <button
                                          className="text-danger hover:text-danger/80 transition-colors"
                                          onClick={() => handleDeleteCanale(canale.id as string)}
                                          title="Elimina canale"
                                        >
                                          <Lucide icon="Trash2" className="w-4 h-4" />
                                        </button>
                                      </PermissionGate>
                                    </div>
                                  </Table.Td>
                                </Table.Tr>
                              ))
                            )}
                          </Table.Tbody>
                        </Table>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto px-5">
                  <div className="px-5 border rounded-[0.6rem] dark:border-darkmode-400 relative mt-7 mb-4 border-slate-200/80">
                    <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white dark:bg-darkmode-600 text-slate-500 dark:text-slate-400">
                      <div className="-mt-px">Combinazioni</div>
                    </div>
                    <div className="py-2 mt-4 flex flex-col gap-3.5 overflow-x-auto" >
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th className="whitespace-nowrap">#</Table.Th>
                            <Table.Th className="whitespace-nowrap">Sigla</Table.Th>
                            <Table.Th className="whitespace-nowrap">Stato</Table.Th>
                            <Table.Th className="whitespace-nowrap">Azioni</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {dataAreeCanaliECombinazioni?.combinazioni?.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={4} className="text-center">Nessuna combinazione disponibile</Table.Td>
                            </Table.Tr>
                          ) : (
                            dataAreeCanaliECombinazioni?.combinazioni?.map((combinazione, index) => (
                              <Table.Tr key={combinazione.id}>
                                <Table.Td className="whitespace-nowrap">{index + 1}</Table.Td>
                                <Table.Td className="whitespace-nowrap">{combinazione.sigla}</Table.Td>
                                <Table.Td className="whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${combinazione.stato === "ATTIVO"
                                      ? "bg-success/10 text-success border-success/20"
                                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-darkmode-400 dark:text-slate-300 dark:border-darkmode-300"
                                    }`}>
                                    {combinazione.stato}
                                  </span>
                                </Table.Td>
                                <Table.Td className="whitespace-nowrap">
                                  <div className="flex gap-2">
                                    <button
                                      className="text-primary hover:text-primary/80 transition-colors"
                                      onClick={() => handleEditCombinazione(combinazione)}
                                      title="Modifica combinazione"
                                    >
                                      <Lucide icon="Pencil" className="w-4 h-4" />
                                    </button>
                                    <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                                      <button
                                        className="text-danger hover:text-danger/80 transition-colors"
                                        onClick={() => handleDeleteCombinazione(combinazione.id as string)}
                                        title="Elimina combinazione"
                                      >
                                        <Lucide icon="Trash2" className="w-4 h-4" />
                                      </button>
                                    </PermissionGate>
                                  </div>
                                </Table.Td>
                              </Table.Tr>
                            ))
                          )}
                        </Table.Tbody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse flex-wrap items-center p-5 flex-reverse gap-y-2 sm:flex-row">
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default withSessionChecked(Main);
