import Button from "@/components/Base/Button";
import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormCheck, FormField, FormInput, FormSelect, FormTextarea } from "@/components/Base/Form";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import { PermissionGate } from "@/components/PermissionGate";
import ProgressBar from "@/components/Base/Progress";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import Table from "@/components/Base/Table";
import Tippy from "@/components/Base/Tippy";
import EmptyState from "@/components/EmptyState";
import { formatData } from "@/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { FotoRicetta, Ricette, STATO_RICETTA, TIPO_RICETTA } from "../../../../lib/types";

/** Colonne della tabella: selezione, anteprima, nome, approfondita, vino, foto, completezza, stato, data, azioni. */
const NUMERO_COLONNE = 10;

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

  // Ultimi filtri impostati: la paginazione può chiedere due aggiornamenti di fila (righe per pagina, poi pagina 1)
  const filtriCorrenti = useRef(filtri);

  // Funzione per aggiornare i filtri e sincronizzare con URL
  const updateFiltri = (newFiltri: typeof filtri) => {
    filtriCorrenti.current = newFiltri;
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
  const {
    data: ricetteResponse,
    isLoading: isLoadingRicette,
    isFetching: isFetchingRicette,
    isError: isErrorRicette,
    error: erroreRicette,
    refetch: refetchRicette,
  } = useQuery({
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

  // Riga segnaposto durante la generazione: stesse colonne, nello stesso ordine, delle righe vere
  const PlaceholderRow = () => (
    <Table.Tr>
      <Table.Td>
        <FormCheck.Input type="checkbox" disabled aria-label="Ricetta in generazione" />
      </Table.Td>
      <Table.Td className="text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-slate-200 bg-slate-100">
            <Lucide icon="ImageOff" aria-hidden="true" className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      </Table.Td>
      <Table.Td className="w-80">
        <div className="flex items-center gap-3">
          <Spinner size="sm" decorativo />
          <span className="font-medium text-slate-500">Generazione in corso...</span>
        </div>
      </Table.Td>
      <Table.Td className="text-center">
        <div className="flex justify-center">
          <Lucide icon="CircleAlert" aria-hidden="true" className="h-5 w-5 text-slate-400" />
        </div>
      </Table.Td>
      <Table.Td className="text-center">
        <div className="flex justify-center">
          <Lucide icon="Minus" aria-hidden="true" className="h-5 w-5 text-slate-400" />
        </div>
      </Table.Td>
      <Table.Td className="text-center">
        <div className="flex justify-center">
          <Lucide icon="ImageOff" aria-hidden="true" className="h-5 w-5 text-slate-400" />
        </div>
      </Table.Td>
      <Table.Td>
        <div className="w-40">
          <div className="text-xs tabular-nums text-slate-500">0%</div>
          <ProgressBar progress={5} showText={false} className="mt-1.5 h-1.5" classNameProgress="bg-primary/40" />
        </div>
      </Table.Td>
      <Table.Td className="text-center">
        <StatusBadge tono="neutral" icon="Clock" etichetta="In generazione" />
      </Table.Td>
      <Table.Td className="whitespace-nowrap tabular-nums text-slate-400">
        {formatData(new Date())}
      </Table.Td>
      <Table.Td className="text-right">
        <Button variant="outline-secondary" size="sm" disabled aria-label="Azioni non disponibili durante la generazione">
          <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
        </Button>
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
  const filtriAttivi = Boolean(filtri.titolo || filtri.stato || filtri.tipo || filtri.data_corrente);
  const azzeraFiltri = () =>
    updateFiltri({ titolo: "", stato: "", tipo: "", data_corrente: "", pagina: 1, pagina_size: filtri.pagina_size });

  return (
    <>
      <Dialog open={openDialogCreazioneQuantita} onClose={() => setOpenDialogCreazioneQuantita(false)}>
        <Dialog.Panel>
          <Dialog.Title>Genera ricette</Dialog.Title>
          <Dialog.Description className="flex flex-col gap-4">
            <FormField etichetta="Tipo di ricette">
              <FormTextarea
                maxLength={100}
                placeholder='Scrivi qua un tipo di ricetta che vuoi generare ("Ricette Vegane", "Ricette Vegetariane", "Primi", etc...)'
                value={messaggio ?? ''}
                onChange={(e) => {
                  setMessaggio(e.target.value)
                }}
              />
            </FormField>
            <FormField etichetta="Quantità" aiuto="Massimo 10 ricette per volta.">
              <FormInput
                type="number"
                max={10}
                placeholder="Quantità"
                value={quantita ?? ''}
                onChange={(e) => setQuantita(parseInt(e.target.value))}
              />
            </FormField>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-secondary"
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
              disabled={!quantita || quantita <= 0}
              loading={generaRicetteConQuantita.isPending}
            >
              Genera
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <ConfirmDialog
        open={openDialogEliminazioneRicetta}
        title="Elimina ricetta"
        description={`Sei sicuro di voler eliminare la ricetta ${ricettaDaEliminare?.titolo ?? ""}?`}
        confirmLabel="Elimina"
        loading={eliminaRicetta.isPending}
        onClose={() => setOpenDialogEliminazioneRicetta(false)}
        onConfirm={() => {
          setOpenDialogEliminazioneRicetta(false);
          eliminaRicetta.mutate(ricettaDaEliminare?.guid_id ?? "");
        }}
      />
      <ConfirmDialog
        open={openDialogPubblicazioneRicetta}
        title="Pubblica ricetta"
        subtitle="La ricetta diventerà pubblica"
        description={`Sei sicuro di voler pubblicare la ricetta ${ricettaDaPubblicare?.titolo ?? ""}?`}
        confirmLabel="Pubblica"
        confirmVariant="primary"
        loading={pubblicaRicetta.isPending}
        onClose={() => setOpenDialogPubblicazioneRicetta(false)}
        onConfirm={() => {
          pubblicaRicetta.mutate(ricettaDaPubblicare?.guid_id ?? "");
        }}
      />
      <ConfirmDialog
        open={openDialogEliminazioneMultipla}
        title="Elimina ricette selezionate"
        description={
          isDeletingMultiple ? (
            <>
              <p>Eliminazione di {selectedRicette.length} ricette in corso...</p>
              <ProgressBar progress={deletionProgress} className="mt-2 h-4" />
            </>
          ) : (
            <p>Sei sicuro di voler eliminare {selectedRicette.length} ricette selezionate?</p>
          )
        }
        confirmLabel="Elimina"
        loading={isDeletingMultiple}
        onClose={() => { if (!isDeletingMultiple) setOpenDialogEliminazioneMultipla(false) }}
        onConfirm={() => eliminaRicetteMultiple.mutate(selectedRicette)}
      />

    <Pagina
      titolo="Gestione Ricette"
      descrizione="Elenco ricette generate"
      azioni={
        <PermissionGate permission={PERMISSIONS.AI.GESTISCI_RICETTE} mode="disable">
          <Button
            variant="primary"
            onClick={() => setOpenDialogCreazioneQuantita(true)}
            disabled={generaRicetteConQuantita.isPending}
            loading={generaRicetteConQuantita.isPending}
          >
            {!generaRicetteConQuantita.isPending && (
              <Lucide icon="CookingPot" aria-hidden="true" className="mr-2 h-4 w-4" />
            )}
            Genera ricette
          </Button>
        </PermissionGate>
      }
    >
      <Sezione senzaPadding titolo="Ricette" descrizione="Ricette generate per le promozioni in corso">
        <BarraFiltri
          destra={
            selectedRicette.length > 0 ? (
              <PermissionGate permission={PERMISSIONS.AI.GESTISCI_RICETTE}>
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => setOpenDialogEliminazioneMultipla(true)}
                  disabled={eliminaRicetteMultiple.isPending}
                >
                  <Lucide icon="Trash2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Elimina selezionati ({selectedRicette.length})
                </Button>
              </PermissionGate>
            ) : undefined
          }
        >
          <CampoRicerca
            etichetta="Cerca ricette"
            placeholder="Cerca ricette"
            value={filtri.titolo}
            onChange={(valore) => updateFiltriConReset({ ...filtri, titolo: valore })}
          />
          <FormSelect
            formSelectSize="sm"
            aria-label="Stato"
            value={filtri.stato}
            onChange={(e) => updateFiltriConReset({ ...filtri, stato: e.target.value as STATO_RICETTA | "" })}
            className="sm:w-40"
          >
            <option value="">Tutti gli stati</option>
            {Object.values(STATO_RICETTA).map((stato) => (
              <option key={stato} value={stato}>
                {stato.replace("_", " ").toLowerCase()}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            formSelectSize="sm"
            aria-label="Tipo"
            value={filtri.tipo}
            onChange={(e) => updateFiltriConReset({ ...filtri, tipo: e.target.value as TIPO_RICETTA | "" })}
            className="sm:w-40"
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
            formInputSize="sm"
            aria-label="Data"
            className="sm:w-40"
            value={filtri.data_corrente}
            onChange={(e) => updateFiltriConReset({ ...filtri, data_corrente: e.target.value })}
          />
        </BarraFiltri>

        <div className="overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="w-5">
                  <FormCheck.Input type="checkbox" aria-label="Seleziona tutte le ricette" onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.checked) {
                      setSelectedRicette(ricette)
                    } else {
                      setSelectedRicette([]);
                    }
                  }} />
                </Table.Th>
                <Table.Th>Anteprima</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th className="text-center">Approfondita</Table.Th>
                <Table.Th className="text-center">Vino</Table.Th>
                <Table.Th className="text-center">Foto</Table.Th>
                <Table.Th className="w-52">Completezza Ricetta</Table.Th>
                <Table.Th className="text-center">Stato</Table.Th>
                <Table.Th>Data Creazione</Table.Th>
                <Table.Th className="w-20 text-right"><span className="sr-only">Azioni</span></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoadingRicette ? (
                <Table.Tr>
                  <Table.Td colSpan={NUMERO_COLONNE} className="py-8 text-center">
                    <div className="flex justify-center">
                      <Spinner size="lg" etichetta="Caricamento ricette..." />
                    </div>
                  </Table.Td>
                </Table.Tr>
              ) : isErrorRicette ? (
                <Table.Tr>
                  <Table.Td colSpan={NUMERO_COLONNE}>
                    <PageError
                      compatta
                      titolo="Ricette non caricate"
                      motivo={(erroreRicette as Error)?.message || "Errore durante il recupero delle ricette"}
                      onRiprova={() => refetchRicette()}
                    />
                  </Table.Td>
                </Table.Tr>
              ) : filteredRicette.length > 0 ? filteredRicette.map((ricetta) => (
                ricetta.guid_id.startsWith('placeholder-') ? (
                  <PlaceholderRow key={ricetta.guid_id} />
                ) : (
                  <Table.Tr key={ricetta.guid_id}>
                    <Table.Td>
                      <FormCheck.Input type="checkbox" aria-label={`Seleziona ${ricetta.titolo ?? "ricetta"}`} checked={selectedRicette.includes(ricetta) ? true : false} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (e.target.checked) {
                          setSelectedRicette([...selectedRicette, ricetta]);
                        } else {
                          setSelectedRicette(selectedRicette.filter(r => r.guid_id !== ricetta.guid_id));
                        }
                      }} />
                    </Table.Td>
                    <Table.Td className="text-center">
                      <div className="flex justify-center">
                        {ricetta.foto_ricetta?.length > 0 && ricetta.foto_ricetta.find((foto: FotoRicetta) => foto.main)?.url ? (
                          <img loading="lazy" src={ricetta.foto_ricetta.find((foto: FotoRicetta) => foto.main)?.url} alt={ricetta.titolo} className="h-12 w-12 rounded-control border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-slate-200 bg-slate-100">
                            <Lucide icon="ImageOff" aria-hidden="true" className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td className="w-80">
                      <div className="whitespace-nowrap font-medium text-slate-800">
                        {ricetta.titolo}
                      </div>
                      <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                        {ricetta.tipo?.replace("_", " ").toLowerCase()}
                      </div>
                    </Table.Td>

                    {/* Icona ricetta approfondita */}
                    <Table.Td className="text-center">
                      <Tippy content={isRicettaApprofondita(ricetta) ? "Ricetta completa" : "Ricetta incompleta"}>
                        <div className="flex justify-center">
                          {isRicettaApprofondita(ricetta) ? (
                            <Lucide icon="CircleCheck" role="img" aria-label="Ricetta completa" className="h-5 w-5 text-success" />
                          ) : (
                            <Lucide icon="CircleAlert" role="img" aria-label="Ricetta incompleta" className="h-5 w-5 text-warning" />
                          )}
                        </div>
                      </Tippy>
                    </Table.Td>

                    {/* Icona abbinamento vino */}
                    <Table.Td className="text-center">
                      <Tippy content={hasAbbinamentoVino(ricetta) ? "Abbinamento vino presente" : "Nessun abbinamento vino"}>
                        <div className="flex justify-center">
                          {hasAbbinamentoVino(ricetta) ? (
                            <Lucide icon="Wine" role="img" aria-label="Abbinamento vino presente" className="h-5 w-5 text-primary" />
                          ) : (
                            <Lucide icon="Minus" role="img" aria-label="Nessun abbinamento vino" className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                      </Tippy>
                    </Table.Td>

                    {/* Icona foto */}
                    <Table.Td className="text-center">
                      <Tippy content={hasFoto(ricetta) ? "Foto presente" : "Nessuna foto"}>
                        <div className="flex justify-center">
                          {hasFoto(ricetta) ? (
                            <Lucide icon="Image" role="img" aria-label="Foto presente" className="h-5 w-5 text-primary" />
                          ) : (
                            <Lucide icon="ImageOff" role="img" aria-label="Nessuna foto" className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                      </Tippy>
                    </Table.Td>

                    {/* Completezza ricetta con progress bar */}
                    <Table.Td>
                      <div className="w-40">
                        <div className="text-xs tabular-nums text-slate-500">
                          {getCompletenessPercentage(ricetta)}%
                        </div>
                        <ProgressBar
                          progress={getCompletenessPercentage(ricetta)}
                          showText={false}
                          className="mt-1.5 h-1.5"
                          classNameProgress={
                            getCompletenessPercentage(ricetta) >= 80 ? "bg-success" :
                              getCompletenessPercentage(ricetta) >= 60 ? "bg-warning" :
                                "bg-danger"
                          }
                        />
                      </div>
                    </Table.Td>

                    {/* Stato */}
                    <Table.Td className="text-center">
                      <StatusBadge
                        tono={ricetta.stato === STATO_RICETTA.PUBBLICARE ? "success" : "warning"}
                        etichetta={ricetta.stato === STATO_RICETTA.REVISIONARE ? "Da revisionare" : "Pubblicata"}
                      />
                    </Table.Td>

                    {/* Data creazione */}
                    <Table.Td className="whitespace-nowrap tabular-nums">
                      {formatData(ricetta.createdAt)}
                    </Table.Td>

                    {/* Azioni */}
                    <Table.Td className="text-right">
                      <Menu className="inline-block text-left">
                        <Menu.Button
                          as={Button}
                          size="sm"
                          variant="outline-secondary"
                          aria-label={`Azioni ricetta ${ricetta.titolo ?? ""}`.trim()}
                        >
                          <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
                        </Menu.Button>
                        <Menu.Items className="w-44">
                          <Menu.Item onClick={() => navigate(`/gestione-ricette/modifica?id=${ricetta.guid_id}`)}>
                            <Lucide icon="Pencil" aria-hidden="true" className="mr-2 h-4 w-4" />
                            Modifica
                          </Menu.Item>
                          {ricetta.stato === STATO_RICETTA.REVISIONARE ? (
                            <Menu.Item
                              onClick={() => {
                                setOpenDialogPubblicazioneRicetta(true);
                                setRicettaDaPubblicare(ricetta);
                              }}
                            >
                              <Lucide icon="SquareCheck" aria-hidden="true" className="mr-2 h-4 w-4" />
                              Pubblica
                            </Menu.Item>
                          ) : null}
                          <PermissionGate permission={PERMISSIONS.AI.GESTISCI_RICETTE}>
                            <Menu.Item
                              className="text-danger"
                              onClick={() => {
                                setOpenDialogEliminazioneRicetta(true);
                                setRicettaDaEliminare(ricetta);
                              }}
                            >
                              <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                              Elimina
                            </Menu.Item>
                          </PermissionGate>
                        </Menu.Items>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                )
              )) : (
                <Table.Tr>
                  <Table.Td colSpan={NUMERO_COLONNE} className="p-0">
                    {filtriAttivi ? (
                      <EmptyState
                        compatta
                        icon="SearchX"
                        title="Nessuna ricetta trovata"
                        description="Nessuna ricetta corrisponde alla ricerca o ai filtri."
                        buttonText="Azzera filtri"
                        buttonIcon="X"
                        onButtonClick={azzeraFiltri}
                      />
                    ) : (
                      <EmptyState
                        compatta
                        icon="CookingPot"
                        title="Nessuna ricetta"
                        description="Non ci sono ancora ricette: usa Genera ricette per crearne."
                      />
                    )}
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        {ricetteResponse?.pagination && (
          <PaginazioneTabella
            totale={ricetteResponse.pagination.total}
            pagina={filtri.pagina}
            dimensionePagina={filtri.pagina_size}
            opzioniDimensione={[5, 10, 25, 50]}
            // filtriCorrenti: dopo il cambio di righe per pagina arriva subito anche il ritorno a pagina 1
            onCambiaPagina={(pagina) => updateFiltri({ ...filtriCorrenti.current, pagina })}
            onCambiaDimensione={(dimensione) => updateFiltri({ ...filtriCorrenti.current, pagina_size: dimensione, pagina: 1 })}
          />
        )}
      </Sezione>
    </Pagina>
    </>
  );
};

export default withSessionCheck(GestioneRicette);
