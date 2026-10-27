import Button from "@/components/Base/Button";
import { FormField, FormInput, FormSelect } from "@/components/Base/Form";
import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
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
  const [ricerca, setRicerca] = useState("");
  const { showNotification } = useNotification();

  const {
    data: dataAreeCanaliECombinazioni,
    isLoading: caricamentoAreeCanali,
    isError: erroreAreeCanali,
    error: dettaglioErroreAreeCanali,
    refetch: ricaricaAreeCanali,
  } = useFetchAreeCanaliECombinazioni();

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
        notifySuccess("Area creata con successo");
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
        notifySuccess("Canale creato con successo");
        setListaCanali([...listaCanali, result.data]);
      }
    }
    closeCanaleDialog();
  };

  const saveCombinazione = async (combinazione: { guidID: string; guidIDCanale: string; guidIDArea: string; enabled: string }): Promise<void> => {
    const combinazioneData = isEditingCombinazione ? { ...combinazione, id: editingCombinazioneId } : combinazione;
    const result = await ServerCall.put<ServerResponse<CombinazioneCanaleAreaAttributes>>('/ACPV/setCombinazione', combinazioneData);

    if (result.esito && result.data) {
      if (result.isUpdate) {
        notifySuccessEditCombinazione();
      } else {
        notifySuccess("Combinazione creata con successo");
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
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nell'eliminazione della combinazione</div>
            <div className="mt-1 text-slate-500">
              {error?.message || "Si è verificato un errore durante l'eliminazione della combinazione."}
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
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nell'eliminazione dell'area</div>
            <div className="mt-1 text-slate-500">
              {error?.message || "Si è verificato un errore durante l'eliminazione dell'area."}
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
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore nell'eliminazione del canale</div>
            <div className="mt-1 text-slate-500">
              {error?.message || "Si è verificato un errore durante l'eliminazione del canale."}
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
    },
    onError: (error) => {
      notifyErrorArea(error);
    }
  });

  const saveCanaleMutation = useMutation<void, Error, { nome: string; sigla: string; id?: string }>({
    mutationFn: saveCanale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchCanali'] });
    },
    onError: (error) => {
      notifyErrorCanale(error);
    }
  });

  const saveCombinazioneMutation = useMutation<void, Error, { guidID: string; guidIDCanale: string; guidIDArea: string; enabled: string }>({
    mutationFn: saveCombinazione,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchCombinazioni'] });
    },
    onError: (error) => {
      notifyErrorCombinazione(error);
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

  const notifySuccess = (titolo: string) => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">{titolo}</div>
        </div>
      </div>
    );
  };

  const notifyErrorArea = (error?: Error) => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Errore nella {isEditingArea ? "modifica" : "creazione"} dell'area</div>
          <div className="mt-1 text-slate-500">
            {error?.message || `Si è verificato un errore durante la ${isEditingArea ? "modifica" : "creazione"} dell'area.`}
          </div>
        </div>
      </div>
    );
  };
  const notifyErrorCanale = (error?: Error) => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Errore nella {isEditingCanale ? "modifica" : "creazione"} del canale</div>
          <div className="mt-1 text-slate-500">
            {error?.message || `Si è verificato un errore durante la ${isEditingCanale ? "modifica" : "creazione"} del canale.`}
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
  const notifyErrorCombinazione = (error?: Error) => {
    showNotification(
      <div className="flex flex-row items-center">
        <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
        <div className="ml-4 mr-4">
          <div className="font-bold">Errore nella {isEditingCombinazione ? "modifica" : "creazione"} della combinazione</div>
          <div className="mt-1 text-slate-500">
            {error?.message || `Si è verificato un errore durante la ${isEditingCombinazione ? "modifica" : "creazione"} della combinazione.`}
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



  // Ricerca locale sulle tre tabelle, senza distinzione fra maiuscole e minuscole
  const termine = ricerca.trim().toLowerCase();
  const corrisponde = (...valori: (string | null | undefined)[]) =>
    !termine || valori.some((valore) => (valore ?? "").toLowerCase().includes(termine));
  const areeVisibili = (dataAreeCanaliECombinazioni?.aree ?? []).filter((area) => corrisponde(area.nome, area.codice));
  const canaliVisibili = (dataAreeCanaliECombinazioni?.canali ?? []).filter((canale) => corrisponde(canale.nome, canale.codice));
  const combinazioniVisibili = (dataAreeCanaliECombinazioni?.combinazioni ?? []).filter((combinazione) =>
    corrisponde(combinazione.sigla)
  );

  // Riga vuota della tabella: distingue l'assenza di dati da una ricerca senza risultati
  const rigaVuota = (colonne: number, senzaDati: boolean, titolo: string, icona: "MapPin" | "Radio" | "Box") => (
    <Table.Tr>
      <Table.Td colSpan={colonne} className="p-0">
        {senzaDati ? (
          <EmptyState compatta icon={icona} title={titolo} description="Usa Crea per aggiungerne." />
        ) : (
          <EmptyState compatta icon="SearchX" title="Nessun risultato" description={`Nessun elemento corrisponde a "${ricerca.trim()}".`} />
        )}
      </Table.Td>
    </Table.Tr>
  );

  return (
    <>
      <ConfirmDialog
        open={showDialogEliminazioneAree}
        title="Elimina area"
        description="Sei sicuro di voler eliminare l'area?"
        confirmLabel="Elimina"
        onClose={() => setShowDialogEliminazioneAree(false)}
        onConfirm={() => {
          deleteAreaMutation.mutate(idAreaSelezionata);
          setShowDialogEliminazioneAree(false);
        }}
      />
      <ConfirmDialog
        open={showDialogEliminazioneCanali}
        title="Elimina canale"
        description="Sei sicuro di voler eliminare il canale?"
        confirmLabel="Elimina"
        onClose={() => setShowDialogEliminazioneCanali(false)}
        onConfirm={() => {
          deleteCanaleMutation.mutate(idCanaleSelezionato);
          setShowDialogEliminazioneCanali(false);
        }}
      />
      <ConfirmDialog
        open={showDialogEliminazioneCombinazioni}
        title="Elimina combinazione"
        description="Sei sicuro di voler eliminare la combinazione?"
        confirmLabel="Elimina"
        onClose={() => setShowDialogEliminazioneCombinazioni(false)}
        onConfirm={() => {
          deleteCombinazioneMutation.mutate(idCombinazioneSelezionata);
          setShowDialogEliminazioneCombinazioni(false);
        }}
      />
      <Dialog open={isAreaDialogOpen} onClose={closeAreaDialog}>
        <Dialog.Panel>
          <Dialog.Title>{isEditingArea ? 'Modifica Area' : 'Crea Area'}</Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <FormField className="col-span-12 sm:col-span-6" etichetta="Nome" obbligatorio>
              <FormInput type="text" value={nomeArea} onChange={(e) => { setNomeArea(e.target.value) }} />
            </FormField>
            <FormField className="col-span-12 sm:col-span-6" etichetta="Sigla" obbligatorio>
              <FormInput type="text" value={siglaArea} onChange={(e) => { setSiglaArea(e.target.value) }} />
            </FormField>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeAreaDialog}>
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!nomeArea.trim() || !siglaArea.trim()}
              loading={saveAreaMutation.isPending}
              onClick={() =>
                saveAreaMutation.mutate({
                  nome: nomeArea,
                  codice: siglaArea,
                })
              }
            >
              {isEditingArea ? 'Modifica' : 'Crea'}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      {/* Dialog per Crea Canale */}
      <Dialog open={isCanaleDialogOpen} onClose={closeCanaleDialog}>
        <Dialog.Panel>
          <Dialog.Title>{isEditingCanale ? 'Modifica Canale' : 'Crea Canale'}</Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <FormField className="col-span-12 sm:col-span-6" etichetta="Nome" obbligatorio>
              <FormInput type="text" value={nomeCanale} onChange={(e) => { setNomeCanale(e.target.value) }} />
            </FormField>
            <FormField className="col-span-12 sm:col-span-6" etichetta="Sigla" obbligatorio>
              <FormInput type="text" value={siglaCanale} onChange={(e) => { setSiglaCanale(e.target.value) }} />
            </FormField>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={closeCanaleDialog}>
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!nomeCanale.trim() || !siglaCanale.trim()}
              loading={saveCanaleMutation.isPending}
              onClick={() => saveCanaleMutation.mutate({ nome: nomeCanale, sigla: siglaCanale, id: isEditingCanale ? editingCanaleId : undefined })}
            >
              {isEditingCanale ? 'Modifica' : 'Crea'}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={isCombinazioneDialogOpen} onClose={closeCombinazioneDialog}>
        <Dialog.Panel>
          <Dialog.Title>{isEditingCombinazione ? 'Modifica Combinazione' : 'Crea Combinazione'}</Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <FormField className="col-span-12 sm:col-span-6" etichetta="Area">
              <FormSelect className="w-full" value={idAreaSelezionata} onChange={(e) => { setIdAreaSelezionata(e.target.value) }}>
                {listaAree.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nome}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField className="col-span-12 sm:col-span-6" etichetta="Canale">
              <FormSelect className="w-full" value={idCanaleSelezionato} onChange={(e) => { setIdCanaleSelezionato(e.target.value) }}>
                {listaCanali.map((canale) => (
                  <option key={canale.id} value={canale.id}>
                    {canale.nome}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField className="col-span-12" etichetta="Stato">
              <FormSelect className="w-full" value={enabledCombinazione} onChange={(e) => { setEnabledCombinazione(e.target.value) }}>
                <option value="true">Attivo</option>
                <option value="false">Disattivo</option>
              </FormSelect>
            </FormField>
          </Dialog.Description>
          <Dialog.Footer>
            <Button type="button" variant="outline-secondary" onClick={() => { setIdAreaSelezionata(""); setIdCanaleSelezionato(""); closeCombinazioneDialog() }}>
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              loading={saveCombinazioneMutation.isPending}
              onClick={() => saveCombinazioneMutation.mutate({ guidID: isEditingCombinazione ? editingCombinazioneId : "", guidIDCanale: idCanaleSelezionato, guidIDArea: idAreaSelezionata, enabled: enabledCombinazione })}
            >
              {isEditingCombinazione ? 'Modifica' : 'Crea'}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Pagina
        titolo="Aree e Canali"
        descrizione="Gestione aree e canali"
        azioni={
          <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI} mode="disable">
            <Menu className="inline-block text-left">
              <Menu.Button as={Button} variant="primary">
                <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                Crea
                <Lucide icon="ChevronDown" aria-hidden="true" className="ml-2 h-4 w-4" />
              </Menu.Button>
              <Menu.Items className="w-56">
                <Menu.Item onClick={() => handleCreateClick("area")}>
                  <Lucide icon="MapPin" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea Area
                </Menu.Item>
                <Menu.Item onClick={() => handleCreateClick("canale")}>
                  <Lucide icon="Radio" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea Canale
                </Menu.Item>
                <Menu.Item onClick={() => handleCreateClick("combinazione")}>
                  <Lucide icon="Box" aria-hidden="true" className="mr-2 h-4 w-4" />
                  Crea Combinazione
                </Menu.Item>
              </Menu.Items>
            </Menu>
          </PermissionGate>
        }
      >
        <Sezione senzaPadding titolo="Aree, canali e combinazioni" descrizione="Le aree e i canali dei punti vendita e le loro combinazioni">
          <BarraFiltri>
            <CampoRicerca
              etichetta="Cerca aree, canali e combinazioni"
              placeholder="Cerca per nome, codice o sigla"
              value={ricerca}
              onChange={setRicerca}
            />
          </BarraFiltri>

          {caricamentoAreeCanali ? (
            <div className="flex justify-center py-10">
              <Spinner etichetta="Caricamento aree e canali…" />
            </div>
          ) : erroreAreeCanali ? (
            <div className="p-5">
              <PageError
                compatta
                titolo="Aree e canali non caricati"
                motivo={(dettaglioErroreAreeCanali as Error)?.message || "Errore durante il recupero di aree e canali"}
                onRiprova={() => ricaricaAreeCanali()}
              />
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-5 p-5">
              <div className="col-span-12 overflow-hidden rounded-card border border-slate-200 bg-white lg:col-span-6">
                <h3 className="title-card px-4 py-3">Aree</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th className="w-12">#</Table.Th>
                        <Table.Th>Nome Area</Table.Th>
                        <Table.Th>Codice Area</Table.Th>
                        <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {areeVisibili.length === 0
                        ? rigaVuota(4, !dataAreeCanaliECombinazioni?.aree?.length, "Nessuna area disponibile", "MapPin")
                        : areeVisibili.map((area, index) => (
                          <Table.Tr key={area.id}>
                            <Table.Td className="whitespace-nowrap tabular-nums">{index + 1}</Table.Td>
                            <Table.Td className="whitespace-nowrap">{area.nome}</Table.Td>
                            <Table.Td className="whitespace-nowrap">{area.codice}</Table.Td>
                            <Table.Td className="whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => handleEditArea(area)}
                                  title="Modifica area"
                                  aria-label={`Modifica area ${area.nome}`}
                                >
                                  <Lucide icon="Pencil" aria-hidden="true" className="h-4 w-4" />
                                </Button>
                                <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleDeleteArea(area.id as string)}
                                    title="Elimina area"
                                    aria-label={`Elimina area ${area.nome}`}
                                  >
                                    <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
                                  </Button>
                                </PermissionGate>
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </div>
              <div className="col-span-12 overflow-hidden rounded-card border border-slate-200 bg-white lg:col-span-6">
                <h3 className="title-card px-4 py-3">Canali</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th className="w-12">#</Table.Th>
                        <Table.Th>Nome Canale</Table.Th>
                        <Table.Th>Codice Canale</Table.Th>
                        <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {canaliVisibili.length === 0
                        ? rigaVuota(4, !dataAreeCanaliECombinazioni?.canali?.length, "Nessun canale disponibile", "Radio")
                        : canaliVisibili.map((canale, index) => (
                          <Table.Tr key={canale.id}>
                            <Table.Td className="whitespace-nowrap tabular-nums">{index + 1}</Table.Td>
                            <Table.Td className="whitespace-nowrap">{canale.nome}</Table.Td>
                            <Table.Td className="whitespace-nowrap">{canale.codice}</Table.Td>
                            <Table.Td className="whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => handleEditCanale(canale)}
                                  title="Modifica canale"
                                  aria-label={`Modifica canale ${canale.nome}`}
                                >
                                  <Lucide icon="Pencil" aria-hidden="true" className="h-4 w-4" />
                                </Button>
                                <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleDeleteCanale(canale.id as string)}
                                    title="Elimina canale"
                                    aria-label={`Elimina canale ${canale.nome}`}
                                  >
                                    <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
                                  </Button>
                                </PermissionGate>
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </div>
              <div className="col-span-12 overflow-hidden rounded-card border border-slate-200 bg-white">
                <h3 className="title-card px-4 py-3">Combinazioni</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th className="w-12">#</Table.Th>
                        <Table.Th>Sigla</Table.Th>
                        <Table.Th>Stato</Table.Th>
                        <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {combinazioniVisibili.length === 0
                        ? rigaVuota(4, !dataAreeCanaliECombinazioni?.combinazioni?.length, "Nessuna combinazione disponibile", "Box")
                        : combinazioniVisibili.map((combinazione, index) => (
                          <Table.Tr key={combinazione.id}>
                            <Table.Td className="whitespace-nowrap tabular-nums">{index + 1}</Table.Td>
                            <Table.Td className="whitespace-nowrap">{combinazione.sigla}</Table.Td>
                            <Table.Td className="whitespace-nowrap">
                              <StatusBadge
                                tono={combinazione.stato === "ATTIVO" ? "success" : "neutral"}
                                etichetta={combinazione.stato === "ATTIVO" ? "Attivo" : "Disattivo"}
                              />
                            </Table.Td>
                            <Table.Td className="whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => handleEditCombinazione(combinazione)}
                                  title="Modifica combinazione"
                                  aria-label={`Modifica combinazione ${combinazione.sigla}`}
                                >
                                  <Lucide icon="Pencil" aria-hidden="true" className="h-4 w-4" />
                                </Button>
                                <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_AREE_CANALI}>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleDeleteCombinazione(combinazione.id as string)}
                                    title="Elimina combinazione"
                                    aria-label={`Elimina combinazione ${combinazione.sigla}`}
                                  >
                                    <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
                                  </Button>
                                </PermissionGate>
                              </div>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </Sezione>
      </Pagina>
    </>
  );
}

export default withSessionChecked(Main);
