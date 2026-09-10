import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormSelect, FormTextarea } from "@/components/Base/Form";
import { Dialog, Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Pagination from "@/components/Base/Pagination";
import { PermissionGate } from "@/components/PermissionGate";
import ProgressBar from "@/components/Base/Progress";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import Table from "@/components/Base/Table";
import Tippy from "@/components/Base/Tippy";
import EmptyState from "@/components/EmptyState";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { FotoRicetta, Ricette, STATO_RICETTA, TIPO_RICETTA } from "../../../../lib/types";

const GestioneRicette: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Inizializza i filtri dai parametri URL
  const [filtri, setFiltri] = useState({
    titolo: searchParams.get('titolo') || "",
    stato: (searchParams.get('stato') as STATO_RICETTA | "") || "",
    tipo: (searchParams.get('tipo') as TIPO_RICETTA | "") || "",
    data_corrente: searchParams.get('data_corrente') || "",
    pagina: parseInt(searchParams.get('pagina') || '1'),
    pagina_size: parseInt(searchParams.get('pagina_size') || '10')
  });

  // Funzione per aggiornare i filtri e sincronizzare con URL
  const updateFiltri = (newFiltri: typeof filtri) => {
    setFiltri(newFiltri);

    // Aggiorna i parametri URL
    const params = new URLSearchParams();
    if (newFiltri.titolo) params.set('titolo', newFiltri.titolo);
    if (newFiltri.stato) params.set('stato', newFiltri.stato);
    if (newFiltri.tipo) params.set('tipo', newFiltri.tipo);
    if (newFiltri.data_corrente) params.set('data_corrente', newFiltri.data_corrente);
    if (newFiltri.pagina > 1) params.set('pagina', newFiltri.pagina.toString());
    if (newFiltri.pagina_size !== 10) params.set('pagina_size', newFiltri.pagina_size.toString());

    setSearchParams(params);
  };

  // Reset alla pagina 1 quando cambiano i filtri
  const updateFiltriConReset = (newFiltri: Omit<typeof filtri, 'pagina'>) => {
    updateFiltri({ ...newFiltri, pagina: 1 });
  };

  const [quantita, setQuantita] = useState<number | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [openDialogCreazioneQuantita, setOpenDialogCreazioneQuantita] = useState(false);
  const [selectedRicette, setSelectedRicette] = useState<Ricette[]>([]);
  const [ricettaDaEliminare, setRicettaDaEliminare] = useState<Ricette | null>(null);
  const [openDialogEliminazioneRicetta, setOpenDialogEliminazioneRicetta] = useState(false);
  const [ricettaDaPubblicare, setRicettaDaPubblicare] = useState<Ricette | null>(null);
  const [openDialogPubblicazioneRicetta, setOpenDialogPubblicazioneRicetta] = useState(false);
  const [openDialogEliminazioneMultipla, setOpenDialogEliminazioneMultipla] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const { data: ricetteResponse, isLoading: isLoadingRicette, isFetching: isFetchingRicette, refetch: refetchRicette } = useQuery({
    queryKey: ['ricette', filtri],
    queryFn: async () => {
      const response = await ServerCall.put<{ data: Ricette[], pagination: { total: number, page: number, pageSize: number, totalPages: number } }>("/get_all_ricette_by_filtri_e_promozioni_in_corso", filtri);
      return response; // Return just the data array from the response
    }
  });


  const ricette: Ricette[] = ricetteResponse?.data || [];

  // Funzione per generare ricette placeholder
  const generatePlaceholderRicette = (count: number): Ricette[] => {
    return Array.from({ length: count }, (_, index) => ({
      guid_id: `placeholder-${index}`,
      titolo: "Generazione in corso...",
      stato: STATO_RICETTA.REVISIONARE,
      tipo: TIPO_RICETTA.CORTA,
      procedimento: null,
      ingredienti: [],
      tempo_in_secondi: null,
      costo_in_euro: null,
      abbinamento_vino: null,
      foto_ricetta: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as unknown as Ricette));
  };

  // Funzione per determinare se una ricetta è approfondita
  const isRicettaApprofondita = (ricetta: Ricette): boolean => {
    return !!(
      ricetta.procedimento &&
      ricetta.ingredienti &&
      ricetta.ingredienti.length > 0 &&
      ricetta.tempo_in_secondi &&
      ricetta.costo_in_euro
    );
  };

  // Funzione per verificare se ha abbinamento vino
  const hasAbbinamentoVino = (ricetta: Ricette): boolean => {
    return !!(ricetta.abbinamento_vino &&
      ricetta.abbinamento_vino.vini_abbinati &&
      ricetta.abbinamento_vino.vini_abbinati.length > 0);
  };

  // Funzione per verificare se ha foto
  const hasFoto = (ricetta: Ricette): boolean => {
    return !!(ricetta.foto_ricetta &&
      ricetta.foto_ricetta.length > 0 &&
      ricetta.foto_ricetta.some(foto => foto.url));
  };

  const generaRicetteConQuantita = useMutation({
    mutationFn: (params: { quantita: number; messaggio: string }) => ServerCall.put("/genera_ricette_corte_multiple", {
      messaggio: params.messaggio,
      quantita: params.quantita,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ricette'] });
      setOpenDialogCreazioneQuantita(false);
      setQuantita(0);
    }
  });

  // Combina ricette reali con placeholder se la mutazione è in corso
  const ricetteConPlaceholder = generaRicetteConQuantita.isPending
    ? [...(ricette || []), ...generatePlaceholderRicette(quantita ?? 0)]
    : (ricette || []);

  const filteredRicette = ricetteConPlaceholder.filter((ricetta: Ricette) => {
    // Non filtrare i placeholder
    if (ricetta.guid_id.startsWith('placeholder-')) {
      return true;
    }

    const matchStato = filtri.stato ? ricetta.stato === filtri.stato : true;
    const matchTipo = filtri.tipo ? ricetta.tipo === filtri.tipo : true;
    // Aggiungi qui la logica per il filtro rangeDiDate se necessario
    return matchStato && matchTipo;
  });

  // Componente per la riga placeholder
  const PlaceholderRow = () => (
    <Table.Tr className="[&_td]:last:border-b-0">
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
        <FormCheck.Input type="checkbox" disabled />
      </Table.Td>
      <Table.Td className="py-4 border-dashed w-80 dark:bg-darkmode-600">
        <div className="flex items-center gap-3">
          <div className="animate-spin">
            <Lucide icon="Loader" className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-slate-500">Generazione in corso...</span>
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
        <div className="flex justify-center">
          <Lucide icon="ImageOff" className="w-5 h-5 text-gray-400" />
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
        <div className="flex justify-center">
          <Lucide icon="CircleAlert" className="w-5 h-5 text-gray-400" />
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
        <div className="flex justify-center">
          <Lucide icon="Minus" className="w-5 h-5 text-gray-400" />
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
        <div className="flex justify-center">
          <Lucide icon="ImageOff" className="w-5 h-5 text-gray-400" />
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
        <div className="w-40">
          <div className="text-xs text-slate-500">0%</div>
          <div className="flex h-1 border rounded-sm bg-slate-50 mt-1.5">
            <div className="first:rounded-l-sm last:rounded-r-sm border border-primary/20 -m-px bg-primary/40 w-[5%]"></div>
          </div>
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
        <div className="flex items-center justify-center text-slate-400">
          <Lucide icon="Clock" className="w-3.5 h-3.5 stroke-[1.7]" />
          <div className="ml-1.5 whitespace-nowrap text-xs">In generazione</div>
        </div>
      </Table.Td>
      <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
        <div className="whitespace-nowrap text-sm text-gray-400">
          {dayjs().format("DD/MM/YYYY")}
        </div>
      </Table.Td>
      <Table.Td className="relative py-4 border-dashed dark:bg-darkmode-600">
        <div className="flex items-center justify-center">
          <Button variant="secondary" size="sm" className="px-2 py-1 opacity-50" disabled>
            <Lucide icon="EllipsisVertical" className="w-4 h-4" />
          </Button>
        </div>
      </Table.Td>
    </Table.Tr>
  );

  // Funzione per calcolare la completezza della ricetta
  const getCompletenessPercentage = (ricetta: Ricette): number => {
    let score = 0;
    const total = 7;

    if (ricetta.titolo) score++;
    if (ricetta.procedimento) score++;
    if (ricetta.ingredienti && ricetta.ingredienti.length > 0) score++;
    if (ricetta.tempo_in_secondi) score++;
    if (ricetta.costo_in_euro) score++;
    if (hasAbbinamentoVino(ricetta)) score++;
    if (hasFoto(ricetta)) score++;

    return Math.round((score / total) * 100);
  };

  const eliminaRicetta = useMutation({
    mutationFn: async (guidId: string) => {
      const response = await ServerCall.delete(`/delete_ricetta?id=${guidId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ricette'] });
      setOpenDialogEliminazioneRicetta(false);
      setRicettaDaEliminare(null);
    }
  });

  const eliminaRicetteMultiple = useMutation({
    mutationFn: async (ricette: Ricette[]) => {
      setIsDeletingMultiple(true);
      setDeletionProgress(0);
      const total = ricette.length;
      let deletedCount = 0;

      for (const ricetta of ricette) {
        await ServerCall.delete(`/delete_ricetta?id=${ricetta.guid_id}`);
        deletedCount++;
        setDeletionProgress(Math.round((deletedCount / total) * 100));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ricette'] });
      setSelectedRicette([]);
      setIsDeletingMultiple(false);
      setDeletionProgress(0);
      setOpenDialogEliminazioneMultipla(false);
    },
    onError: () => {
      // TODO: handle error, maybe show a toast
      setIsDeletingMultiple(false);
      setDeletionProgress(0);
    }
  });

  const pubblicaRicetta = useMutation({
    mutationFn: async (guidId: string) => {
      const response = await ServerCall.put(`/cambia_stato_ricetta`, {
        guidId,
        stato: STATO_RICETTA.PUBBLICARE
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ricette'] });
      setOpenDialogPubblicazioneRicetta(false);
      setRicettaDaPubblicare(null);
    }
  });
  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Gestione Ricette"
        description="Elenco ricette generate"
        actions={
          <PermissionGate permission={PERMISSIONS.AI.GESTISCI_RICETTE} mode="disable">
            <Button
              variant="primary"
              className="group-[.mode--light]:!bg-white/[0.12] group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-transparent"
              onClick={() => setOpenDialogCreazioneQuantita(true)}
              disabled={generaRicetteConQuantita.isPending}
            >
              <Lucide icon="CookingPot" className="stroke-[1.3] w-4 h-4 mr-2" />{" "}
              {generaRicetteConQuantita.isPending ? "Generando..." : "Genera ricette"}
            </Button>
          </PermissionGate>
        }
      />
      <Dialog open={openDialogCreazioneQuantita} onClose={() => setOpenDialogCreazioneQuantita(false)}>
        <Dialog.Panel>
          <Dialog.Title>
            Genera ricette
          </Dialog.Title>
          <Dialog.Description className="flex flex-col gap-2">
            <FormTextarea
              maxLength={100}
              placeholder='Scrivi qua un tipo di ricetta che vuoi generare ("Ricette Vegane", "Ricette Vegetariane", "Primi", etc...)'
              value={messaggio ?? ''}
              onChange={(e) => {
                setMessaggio(e.target.value)
              }}
            />
            <FormInput
              type="number"
              max={10}
              placeholder="Quantità"
              value={quantita ?? ''}
              onChange={(e) => setQuantita(parseInt(e.target.value))}
            />
          </Dialog.Description>
          <Dialog.Footer className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setOpenDialogCreazioneQuantita(false)}
              disabled={generaRicetteConQuantita.isPending}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setOpenDialogCreazioneQuantita(false);
                generaRicetteConQuantita.mutate({
                  quantita: quantita ?? 0,
                  messaggio: messaggio ?? ""
                })
              }}
              disabled={generaRicetteConQuantita.isPending || !quantita || quantita <= 0}
            >
              {generaRicetteConQuantita.isPending ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                "Genera"
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={openDialogEliminazioneRicetta} onClose={() => setOpenDialogEliminazioneRicetta(false)}>
        <Dialog.Panel>
          <Dialog.Title>
            Elimina ricetta
          </Dialog.Title>
          <Dialog.Description className="flex flex-col gap-2">
            <p>Sei sicuro di voler eliminare la ricetta {ricettaDaEliminare?.titolo}?</p>
          </Dialog.Description>
          <Dialog.Footer className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setOpenDialogEliminazioneRicetta(false)}>Annulla</Button>
            <Button variant="primary" onClick={() => {
              setOpenDialogEliminazioneRicetta(false);
              eliminaRicetta.mutate(ricettaDaEliminare?.guid_id ?? "");
            }} disabled={eliminaRicetta.isPending}>
              {eliminaRicetta.isPending ? "Eliminazione in corso..." : "Elimina"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={openDialogPubblicazioneRicetta} onClose={() => setOpenDialogPubblicazioneRicetta(false)}>
        <Dialog.Panel>
          <Dialog.Title>
            Pubblica ricetta
          </Dialog.Title>
          <Dialog.Description className="flex flex-col gap-2">
            <p>Sei sicuro di voler pubblicare la ricetta {ricettaDaPubblicare?.titolo}?</p>
          </Dialog.Description>
          <Dialog.Footer className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setOpenDialogPubblicazioneRicetta(false)}>Annulla</Button>
            <Button variant="primary" onClick={() => {
              pubblicaRicetta.mutate(ricettaDaPubblicare?.guid_id ?? "");
            }} disabled={pubblicaRicetta.isPending}>
              {pubblicaRicetta.isPending ? "Pubblicazione in corso..." : "Pubblica"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={openDialogEliminazioneMultipla} onClose={() => { if (!isDeletingMultiple) setOpenDialogEliminazioneMultipla(false) }}>
        <Dialog.Panel>
          <Dialog.Title>
            Elimina ricette selezionate
          </Dialog.Title>
          <Dialog.Description className="flex flex-col gap-2">
            {isDeletingMultiple ? (
              <>
                <p>Eliminazione di {selectedRicette.length} ricette in corso...</p>
                <ProgressBar
                  progress={deletionProgress}
                  className="h-4 mt-2"
                />
              </>
            ) : (
              <p>Sei sicuro di voler eliminare {selectedRicette.length} ricette selezionate?</p>
            )}
          </Dialog.Description>
          <Dialog.Footer className="flex gap-2 justify-end mt-4">
            <Button variant="secondary" onClick={() => setOpenDialogEliminazioneMultipla(false)} disabled={isDeletingMultiple}>Annulla</Button>
            <Button variant="danger" onClick={() => eliminaRicetteMultiple.mutate(selectedRicette)} disabled={isDeletingMultiple}>
              {isDeletingMultiple ? "Eliminazione in corso..." : "Elimina"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <div className="flex gap-2 justify-end">
        {selectedRicette.length > 0 && (
          <PermissionGate permission={PERMISSIONS.AI.GESTISCI_RICETTE}>
            <Button
              variant="danger"
              onClick={() => setOpenDialogEliminazioneMultipla(true)}
              disabled={eliminaRicetteMultiple.isPending}
            >
              <Lucide icon="Trash2" className="stroke-[1.3] w-4 h-4 mr-2" />
              Elimina selezionati ({selectedRicette.length})
            </Button>
          </PermissionGate>
        )}

      </div>

      <div className="flex flex-col w-full box box--stacked">
        <div className="flex flex-col p-5 pb-2 sm:items-center sm:flex-row gap-y-2">
          <div>
            <div className="relative">
              <Lucide
                icon="Search"
                className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
              />
              <FormInput
                type="text"
                placeholder="Cerca ricette"
                className="pl-9 sm:w-64 rounded-[0.5rem]"
                value={filtri.titolo}
                onChange={(e) => updateFiltriConReset({ ...filtri, titolo: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <FormSelect
              value={filtri.stato}
              onChange={(e) => updateFiltriConReset({ ...filtri, stato: e.target.value as STATO_RICETTA | "" })}
              className="rounded-[0.5rem] sm:w-40"
            >
              <option value="">Tutti gli stati</option>
              {Object.values(STATO_RICETTA).map((stato) => (
                <option key={stato} value={stato}>
                  {stato.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              value={filtri.tipo}
              onChange={(e) => updateFiltriConReset({ ...filtri, tipo: e.target.value as TIPO_RICETTA | "" })}
              className="rounded-[0.5rem] sm:w-40"
            >
              <option value="">Tutti i tipi</option>
              {Object.values(TIPO_RICETTA).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </FormSelect>
            <FormInput
              type="date"
              placeholder="Data di inizio"
              value={filtri.data_corrente}
              onChange={(e) => updateFiltriConReset({ ...filtri, data_corrente: e.target.value })}
            />
          </div>
        </div>

        <div className="py-5">
          <Table className="border-b border-slate-200/60">
            <Table.Thead>
              <Table.Tr>
                <Table.Td className="w-5 py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  <FormCheck.Input type="checkbox" onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.checked) {
                      setSelectedRicette(ricette)
                    } else {
                      setSelectedRicette([]);
                    }
                  }} />
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Foto
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Nome
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500 text-center">
                  <Tippy content="Ricetta approfondita">
                    <Lucide icon="BookOpen" className="w-4 h-4 mx-auto" />
                  </Tippy>
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500 text-center">
                  <Tippy content="Abbinamento vino">
                    <Lucide icon="Wine" className="w-4 h-4 mx-auto" />
                  </Tippy>
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500 text-center">
                  <Tippy content="Foto ricetta">
                    <Lucide icon="Camera" className="w-4 h-4 mx-auto" />
                  </Tippy>
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t w-52 bg-slate-50 border-slate-200/60 text-slate-500">
                  Completezza Ricetta
                </Table.Td>
                <Table.Td className="py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Stato
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Data Creazione
                </Table.Td>
                <Table.Td className="w-20 py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Azioni
                </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoadingRicette ? (
                <Table.Tr className="[&_td]:last:border-b-0">
                  <Table.Td colSpan={9} className="py-8 border-dashed dark:bg-darkmode-600 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin">
                        <Lucide icon="Loader" className="w-8 h-8 text-primary" />
                      </div>
                      <span className="text-sm text-slate-500">Caricamento ricette...</span>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ) : filteredRicette.length > 0 ? filteredRicette.map((ricetta) => (
                ricetta.guid_id.startsWith('placeholder-') ? (
                  <PlaceholderRow key={ricetta.guid_id} />
                ) : (
                  <Table.Tr key={ricetta.guid_id} className="[&_td]:last:border-b-0">
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <FormCheck.Input type="checkbox" checked={selectedRicette.includes(ricetta) ? true : false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.checked) {
                          setSelectedRicette([...selectedRicette, ricetta]);
                        } else {
                          setSelectedRicette(selectedRicette.filter(r => r.guid_id !== ricetta.guid_id));
                        }
                      }} />
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                      <div className="flex justify-center">
                        {ricetta.foto_ricetta?.length > 0 && ricetta.foto_ricetta.find((foto: FotoRicetta) => foto.main)?.url ? (
                          <img loading="lazy" src={ricetta.foto_ricetta.find((foto: FotoRicetta) => foto.main)?.url} alt={ricetta.titolo} className="w-12 h-12 object-cover rounded-lg shadow-sm border border-slate-200" />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
                            <Lucide icon="ImageOff" className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed w-80 dark:bg-darkmode-600">
                      <div className="flex items-center">
                        <div className="ml-3.5">
                          <a href="" className="font-medium whitespace-nowrap">
                            {ricetta.titolo}
                          </a>
                          <div className="text-slate-500 text-xs whitespace-nowrap mt-0.5">
                            {ricetta.tipo?.replace("_", " ").toLowerCase()}
                          </div>
                        </div>
                      </div>
                    </Table.Td>

                    {/* Icona ricetta approfondita */}
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                      <Tippy content={isRicettaApprofondita(ricetta) ? "Ricetta completa" : "Ricetta incompleta"}>
                        <div className="flex justify-center">
                          {isRicettaApprofondita(ricetta) ? (
                            <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
                          ) : (
                            <Lucide icon="CircleAlert" className="w-5 h-5 text-warning" />
                          )}
                        </div>
                      </Tippy>
                    </Table.Td>

                    {/* Icona abbinamento vino */}
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                      <Tippy content={hasAbbinamentoVino(ricetta) ? "Abbinamento vino presente" : "Nessun abbinamento vino"}>
                        <div className="flex justify-center">
                          {hasAbbinamentoVino(ricetta) ? (
                            <Lucide icon="Wine" className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Lucide icon="Minus" className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </Tippy>
                    </Table.Td>

                    {/* Icona foto */}
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600 text-center">
                      <Tippy content={hasFoto(ricetta) ? "Foto presente" : "Nessuna foto"}>
                        <div className="flex justify-center">
                          {hasFoto(ricetta) ? (
                            <Lucide icon="Image" className="w-5 h-5 text-primary" />
                          ) : (
                            <Lucide icon="ImageOff" className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </Tippy>
                    </Table.Td>

                    {/* Completezza ricetta con progress bar */}
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="w-40">
                        <div className="text-xs text-slate-500">
                          {getCompletenessPercentage(ricetta)}%
                        </div>
                        <div className="flex h-1 border rounded-sm bg-slate-50 mt-1.5">
                          <div
                            className={clsx([
                              "first:rounded-l-sm last:rounded-r-sm border border-primary/20 -m-px bg-primary/40",
                              getCompletenessPercentage(ricetta) >= 80 ? "bg-success/40 border-success/20" :
                                getCompletenessPercentage(ricetta) >= 60 ? "bg-warning/40 border-warning/20" :
                                  "bg-danger/40 border-danger/20"
                            ])}
                            style={{ width: `${getCompletenessPercentage(ricetta)}%` }}
                          ></div>
                        </div>
                      </div>
                    </Table.Td>

                    {/* Stato */}
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="flex items-center justify-center">
                        <Lucide
                          icon="Database"
                          className={clsx([
                            "w-3.5 h-3.5 stroke-[1.7]",
                            ricetta.stato === STATO_RICETTA.PUBBLICARE ? "text-success" : "text-warning"
                          ])}
                        />
                        <div className={clsx([
                          "ml-1.5 whitespace-nowrap text-xs",
                          ricetta.stato === STATO_RICETTA.PUBBLICARE ? "text-success" : "text-warning"
                        ])}>
                          {ricetta.stato === STATO_RICETTA.REVISIONARE ? "Da revisionare" : "Pubblicata"}
                        </div>
                      </div>
                    </Table.Td>

                    {/* Data creazione */}
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="whitespace-nowrap">
                        {dayjs(ricetta.createdAt).format("DD/MM/YYYY")}
                      </div>
                    </Table.Td>

                    {/* Azioni */}
                    <Table.Td className="relative py-4 border-dashed dark:bg-darkmode-600">
                      <div className="flex items-center justify-center">
                        <Popover className="h-5">
                          <Popover.Button className="w-5 h-5 text-slate-500">
                            <Lucide
                              icon="EllipsisVertical"
                              className="w-5 h-5 stroke-slate-400/70 fill-slate-400/70"
                            />
                          </Popover.Button>
                          <Popover.Panel className="w-40">
                            <div className="flex flex-col">
                              <button
                                onClick={() => navigate(`/gestione-ricette/modifica?id=${ricetta.guid_id}`)}
                                className="flex items-center px-3 py-2 hover:bg-slate-100"
                              >
                                <Lucide icon="SquareCheck" className="w-4 h-4 mr-2" />
                                Modifica
                              </button>
                              <PermissionGate permission={PERMISSIONS.AI.GESTISCI_RICETTE}>
                                <button
                                  onClick={() => {
                                    setOpenDialogEliminazioneRicetta(true);
                                    setRicettaDaEliminare(ricetta);
                                  }}
                                  className="flex items-center px-3 py-2 text-danger hover:bg-slate-100"
                                >
                                  <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                                  Elimina
                                </button>
                              </PermissionGate>
                              {ricetta.stato === STATO_RICETTA.REVISIONARE ? (
                                <button
                                  onClick={() => {
                                    setOpenDialogPubblicazioneRicetta(true);
                                    setRicettaDaPubblicare(ricetta);
                                  }}
                                  className="flex items-center px-3 py-2 hover:bg-slate-100 text-success"
                                >
                                  <Lucide icon="SquareCheck" className="w-4 h-4 mr-2 " />
                                  Pubblica
                                </button>
                              ) : (
                                null
                              )}
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </Table.Td>
                  </Table.Tr>
                )
              )) : (
                <Table.Tr className="[&_td]:last:border-b-0">
                  <Table.Td colSpan={10} className="py-8 border-dashed dark:bg-darkmode-600 text-center">
                    <EmptyState
                      icon="Search"
                      title="Nessuna ricetta trovata"
                      description="Per favore, controlla i filtri e riprova"
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        {/* Informazioni paginazione */}
        {ricetteResponse?.pagination && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200/60">
            <div className="text-sm text-slate-600 mb-2 sm:mb-0">
              Mostrando {((filtri.pagina - 1) * filtri.pagina_size) + 1}-{Math.min(filtri.pagina * filtri.pagina_size, ricetteResponse.pagination.total)} di {ricetteResponse.pagination.total} ricette
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Risultati per pagina:</span>
              <FormSelect
                value={filtri.pagina_size}
                onChange={(e) => updateFiltri({ ...filtri, pagina_size: parseInt(e.target.value), pagina: 1 })}
                className="w-20 text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </FormSelect>
            </div>
          </div>
        )}

        <Pagination className="flex flex-wrap items-center w-full sm:w-auto sm:mr-auto m-2">
          <Pagination.Link
            onClick={() => updateFiltri({ ...filtri, pagina: 1 })}
            className={clsx(filtri.pagina === 1 && "opacity-50 pointer-events-none")}
          >
            <Lucide icon="ChevronsLeft" className="w-4 h-4" />
          </Pagination.Link>
          <Pagination.Link
            onClick={() => updateFiltri({ ...filtri, pagina: Math.max(1, filtri.pagina - 1) })}
            className={clsx(filtri.pagina === 1 && "opacity-50 pointer-events-none")}
          >
            <Lucide icon="ChevronLeft" className="w-4 h-4" />
          </Pagination.Link>

          {ricetteResponse?.pagination.totalPages && ricetteResponse.pagination.totalPages > 1 && (
            <>
              {/* Mostra sempre la prima pagina */}
              {filtri.pagina > 3 && (
                <>
                  <Pagination.Link
                    onClick={() => updateFiltri({ ...filtri, pagina: 1 })}
                    active={filtri.pagina === 1}
                  >
                    1
                  </Pagination.Link>
                  {filtri.pagina > 4 && <span className="px-3 py-2 text-slate-500">...</span>}
                </>
              )}

              {/* Mostra le pagine intorno a quella corrente */}
              {Array.from({ length: Math.min(5, ricetteResponse.pagination.totalPages) }, (_, index) => {
                const startPage = Math.max(1, Math.min(
                  ricetteResponse.pagination.totalPages - 4,
                  filtri.pagina - 2
                ));
                const pageNumber = startPage + index;

                if (pageNumber > ricetteResponse.pagination.totalPages) return null;
                if (filtri.pagina > 3 && pageNumber === 1) return null;
                if (filtri.pagina < ricetteResponse.pagination.totalPages - 2 && pageNumber === ricetteResponse.pagination.totalPages) return null;

                return (
                  <Pagination.Link
                    key={pageNumber}
                    onClick={() => updateFiltri({ ...filtri, pagina: pageNumber })}
                    active={filtri.pagina === pageNumber}
                  >
                    {pageNumber}
                  </Pagination.Link>
                );
              })}

              {/* Mostra sempre l'ultima pagina */}
              {filtri.pagina < ricetteResponse.pagination.totalPages - 2 && (
                <>
                  {filtri.pagina < ricetteResponse.pagination.totalPages - 3 && <span className="px-3 py-2 text-slate-500">...</span>}
                  <Pagination.Link
                    onClick={() => updateFiltri({ ...filtri, pagina: ricetteResponse.pagination.totalPages })}
                    active={filtri.pagina === ricetteResponse.pagination.totalPages}
                  >
                    {ricetteResponse.pagination.totalPages}
                  </Pagination.Link>
                </>
              )}
            </>
          )}

          <Pagination.Link
            onClick={() => updateFiltri({ ...filtri, pagina: Math.min(ricetteResponse?.pagination.totalPages || 1, filtri.pagina + 1) })}
            className={clsx(filtri.pagina >= (ricetteResponse?.pagination.totalPages || 1) && "opacity-50 pointer-events-none")}
          >
            <Lucide icon="ChevronRight" className="w-4 h-4" />
          </Pagination.Link>
          <Pagination.Link
            onClick={() => updateFiltri({ ...filtri, pagina: ricetteResponse?.pagination.totalPages || 1 })}
            className={clsx(filtri.pagina >= (ricetteResponse?.pagination.totalPages || 1) && "opacity-50 pointer-events-none")}
          >
            <Lucide icon="ChevronsRight" className="w-4 h-4" />
          </Pagination.Link>
        </Pagination>
      </div>
    </div>
  );
};

export default withSessionCheck(GestioneRicette);
