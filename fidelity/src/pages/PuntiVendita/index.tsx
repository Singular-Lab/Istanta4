import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Pagination from "@/components/Base/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import Table from "@/components/Base/Table";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import {
  useFetchAllCombinazioneForGDO,
  useFetchPuntiVenditaFromIdGDO,
} from "@/query/query";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import "leaflet/dist/leaflet.css";
import _ from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import * as yup from "yup";
import { ServerCall } from "../../../lib/server_call";
import { EsitoRigaImportPuntoVenditaDTO, PuntoVenditaResponseDTO, StatoImportPuntiVenditaDTO } from "../../../server/core/dto";
import { BADGE_PUNTEGGIO, classePunteggio, percentualeImport, riepilogoAnteprima, testoRiepilogoImport } from "../../utils/importPuntiVendita";
import { canaleArea, codiciGdo, contaPer, filtraPuntiVendita, indirizzoCompleto, valoriFormPuntoVendita } from "../../utils/puntoVendita";
import { InserimentoManualeImport } from "./InserimentoManualeImport";
import { useImportPuntiVendita } from "./useImportPuntiVendita";
// Tipi per le risposte aggiornate del server
interface ServerResponse<T> {
  esito: boolean;
  error: string;
  message?: string;
  isUpdate?: boolean;
  data?: T;
}

/* --------------------------------------------------
 * VALIDAZIONE FORM
 * ------------------------------------------------*/
const schema = yup.object().shape({
  nome: yup.string().required("Il nome è obbligatorio"),
  indirizzo: yup.string().required("L'indirizzo è obbligatorio"),
  canaleArea: yup.string().required("Il canale/area è obbligatorio"),
  citta: yup.string().required("La città è obbligatoria"),
  cap: yup
    .string()
    .required("Il cap è obbligatorio")
    .matches(/^[0-9]{5}$/, "Il CAP deve essere di 5 cifre"),
  // Facoltativi come nel modello: un PV importato spesso non ha coordinate o telefono
  lat: yup
    .number()
    .transform((valore, originale) => (originale === "" || originale === null ? undefined : valore))
    .typeError("La latitudine deve essere un numero")
    .optional(),
  lon: yup
    .number()
    .transform((valore, originale) => (originale === "" || originale === null ? undefined : valore))
    .typeError("La longitudine deve essere un numero")
    .optional(),
  ragioneSociale: yup.string(),
  provincia: yup.string(),
  regione: yup.string(),
  telefono: yup.string(),
});

/** Coordinata del form: vuota resta assente (null), non diventa 0. */
const coordinataDaForm = (valore: unknown) => {
  const numero = typeof valore === "number" ? valore : parseFloat(String(valore ?? ""));
  return Number.isFinite(numero) ? numero : null;
};

const hasValidCoordinates = (pv: PuntoVenditaResponseDTO) =>
  pv.has_coordinate &&
  pv.coordinate &&
  Number.isFinite(pv.coordinate.lat) &&
  Number.isFinite(pv.coordinate.lon);

// Un colore per canale, stabile anche filtrando (Tableau 10 senza il grigio)
const PALETTE_CANALI = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F"];
const COLORE_SENZA_CANALE = "#94A3B8";

/** Inquadra i punti mostrati ogni volta che cambiano ricerca o filtri. */
function AdattaVista({ punti }: { punti: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (punti.length > 0) map.fitBounds(punti, { padding: [32, 32], maxZoom: 15 });
  }, [map, punti]);
  return null;
}

interface MapPuntiVenditaProps {
  puntiVendita: PuntoVenditaResponseDTO[];
  coloreCanale: (pv: PuntoVenditaResponseDTO) => string;
  onDettagli: (pv: PuntoVenditaResponseDTO) => void;
}

function MapPuntiVendita({ puntiVendita, coloreCanale, onDettagli }: MapPuntiVenditaProps) {
  const posizionati = useMemo(() => puntiVendita.filter(hasValidCoordinates), [puntiVendita]);
  const punti = useMemo(
    () => posizionati.map(pv => [pv.coordinate.lat, pv.coordinate.lon] as [number, number]),
    [posizionati]
  );

  return (
    <MapContainer
      center={[41.8719, 12.5674]} // Italia
      zoom={6}
      preferCanvas
      scrollWheelZoom={false}
      className="absolute inset-0 rounded-md"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <AdattaVista punti={punti} />
      {posizionati.map(pv => (
        <CircleMarker
          key={pv.id}
          center={[pv.coordinate.lat, pv.coordinate.lon]}
          radius={7}
          pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: coloreCanale(pv), fillOpacity: 0.9 }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{pv.nome}</div>
              <div>{indirizzoCompleto(pv)}</div>
              <div className="text-slate-500">{canaleArea(pv)}</div>
              <button type="button" className="mt-2 text-primary underline" onClick={() => onDettagli(pv)}>
                Dettagli
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

interface FiltroChipProps {
  etichetta: string;
  tutti: string;
  voci: { id: string; nome: string; totale: number }[];
  attivo: string;
  onScegli: (id: string) => void;
  colore?: (id: string) => string;
}

/** Una riga di chip: "Tutti" e una voce per canale o area, ciascuna col numero di punti vendita. */
function FiltroChip({ etichetta, tutti, voci, attivo, onScegli, colore }: FiltroChipProps) {
  const chip = (id: string, testo: string, totale: number) => (
    <button
      key={id || "tutti"}
      type="button"
      aria-pressed={attivo === id}
      onClick={() => onScegli(id)}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        attivo === id
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-darkmode-400 dark:text-slate-300 dark:hover:bg-darkmode-400"
      )}
    >
      {id && colore && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colore(id) }} />}
      {testo}
      <span className="text-slate-400">{totale}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 text-xs uppercase text-slate-500">{etichetta}</span>
      {chip("", tutti, voci.reduce((somma, v) => somma + v.totale, 0))}
      {voci.map(v => chip(v.id, v.nome, v.totale))}
    </div>
  );
}

function Main() {
  /* --------------------------------------------------
   * REFS E FORM
   * ------------------------------------------------*/
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
  const [pvDaEliminare, setPvDaEliminare] = useState<PuntoVenditaResponseDTO | null>(null);
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
    getValues,
  } = useForm({ resolver: yupResolver(schema) });

  /* --------------------------------------------------
   * LISTA PUNTI VENDITA - STATE
   * ------------------------------------------------*/
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [filtroCanale, setFiltroCanale] = useState("");
  const [filtroArea, setFiltroArea] = useState("");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, filtroCanale, filtroArea]);

  /* --------------------------------------------------
   * QUERY
   * ------------------------------------------------*/
  const queryClient = useQueryClient();
  const combinazioniDisponibili = useFetchAllCombinazioneForGDO();
  // Combinazioni per nome nella tendina del form, raggruppate per canale
  const combinazioniPerCanale = useMemo(
    () => Object.entries(_.groupBy(
      _.sortBy(combinazioniDisponibili.data ?? [], ["nome_canale", "nome_area"]),
      c => c.nome_canale ?? c.sigla_combinazione
    )),
    [combinazioniDisponibili.data]
  );
  const puntiVenditaQuery = useFetchPuntiVenditaFromIdGDO();
  const tuttiPuntiVendita = useMemo(() => puntiVenditaQuery.data ?? [], [puntiVenditaQuery.data]);
  const hasMappablePoints = tuttiPuntiVendita.some(hasValidCoordinates);

  // ponytail: ricerca, filtri e pagine nel browser sull'elenco completo, già scaricato per la mappa;
  // regge qualche migliaio di PV, oltre si torna a /getAllPVFromIdGDO_paginated con i filtri lato server
  const filtrati = useMemo(
    () => filtraPuntiVendita(tuttiPuntiVendita, { testo: debouncedSearch, idCanale: filtroCanale, idArea: filtroArea }),
    [tuttiPuntiVendita, debouncedSearch, filtroCanale, filtroArea]
  );
  // Ogni dimensione conta i PV rispettando gli altri filtri, non il proprio
  const perCanale = useMemo(
    () => contaPer(filtraPuntiVendita(tuttiPuntiVendita, { testo: debouncedSearch, idArea: filtroArea }), "canale"),
    [tuttiPuntiVendita, debouncedSearch, filtroArea]
  );
  const perArea = useMemo(
    () => contaPer(filtraPuntiVendita(tuttiPuntiVendita, { testo: debouncedSearch, idCanale: filtroCanale }), "area"),
    [tuttiPuntiVendita, debouncedSearch, filtroCanale]
  );
  const coloriCanale = useMemo(
    () => new Map(contaPer(tuttiPuntiVendita, "canale").map((c, i) => [c.id, PALETTE_CANALI[i % PALETTE_CANALI.length]])),
    [tuttiPuntiVendita]
  );
  const coloreCanale = useCallback(
    (pv: PuntoVenditaResponseDTO) => coloriCanale.get(pv.id_canale ?? "") ?? COLORE_SENZA_CANALE,
    [coloriCanale]
  );
  const senzaCoordinate = filtrati.filter(pv => !hasValidCoordinates(pv)).length;

  const totalItems = filtrati.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const puntiVendita = filtrati.slice((page - 1) * pageSize, page * pageSize);
  // La colonna dei codici GDO serve solo alle GDO che li hanno (es. id ANACAN di CONAD CNO)
  const mostraCodiciGdo = puntiVendita.some(pv => codiciGdo(pv.meta).length > 0);
  const isLoading = puntiVenditaQuery.isLoading;
  const isTableFetching = puntiVenditaQuery.isFetching;
  const pageSizeOptions = [10, 25, 50];

  // Dopo un'eliminazione l'ultima pagina può sparire
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const showingFrom = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = totalItems === 0 ? 0 : showingFrom + puntiVendita.length - 1;
  const baseIndex = showingFrom === 0 ? 0 : showingFrom - 1;
  const paginationRange = useMemo<(number | string)[]>(() => {
    if (totalPages <= 1) {
      return [];
    }
    const range: (number | string)[] = [];
    const delta = 1;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    range.push(1);
    if (left > 2) {
      range.push("left-ellipsis");
    }

    for (let i = left; i <= right; i += 1) {
      range.push(i);
    }

    if (right < totalPages - 1) {
      range.push("right-ellipsis");
    }

    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range.filter((value, index, self) => self.indexOf(value) === index);
  }, [page, totalPages]);

  const canGoPrev = page > 1;
  const canGoNext = totalPages > 0 && page < totalPages;

  const invalidatePuntiVendita = () => {
    queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"] });
  };

  /* --------------------------------------------------
   * STATE UI & DIALOG
   * ------------------------------------------------*/
  const [isPuntoVenditaDialogOpen, setIsPuntoVenditaDialogOpen] =
    useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPuntoVendita, setCurrentPuntoVendita] =
    useState<PuntoVenditaResponseDTO | null>(null);
  const [isExcelImportDialogOpen, setIsExcelImportDialogOpen] = useState(false);
  const [fileImport, setFileImport] = useState<File | null>(null);
  const [anteprimaImport, setAnteprimaImport] = useState<EsitoRigaImportPuntoVenditaDTO[]>([]);
  // Il modale della riga in attesa si apre da solo; "Più tardi" lo nasconde fino alla riga successiva
  const [rigaRidotta, setRigaRidotta] = useState<number | null>(null);
  const didSetDefaultCanaleRef = useRef(false);

  // L'import gira in background: l'avanzamento arriva via socket, anche dopo aver ricaricato la pagina
  const alTermineImport = useCallback((stato: StatoImportPuntiVenditaDTO) => {
    queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"] });
    const riepilogo = testoRiepilogoImport(stato);
    if (stato.stato === "annullato") showNotification(`Importazione annullata: ${riepilogo}`, { variant: "warning" });
    else if (stato.stato === "errore") showNotification(`Importazione interrotta per un errore: ${riepilogo}`, { variant: "error" });
    else showNotification(`Importazione completata: ${riepilogo}`, { variant: stato.errori.length ? "warning" : "success" });
  }, [queryClient, showNotification]);
  const importJob = useImportPuntiVendita(alTermineImport);
  const statoImport = importJob.stato;
  const rigaInAttesa = statoImport?.stato === "in_attesa" ? statoImport.rigaInAttesa : undefined;
  const combinazioniOrdinate = useMemo(
    () => _.sortBy(combinazioniDisponibili.data ?? [], ["nome_canale", "nome_area"]),
    [combinazioniDisponibili.data]
  );

  // Un import in corso trovato riaprendo la pagina si mostra subito
  useEffect(() => {
    if (importJob.inCorso) setIsExcelImportDialogOpen(true);
  }, [importJob.inCorso]);

  const chiudiImport = () => {
    setIsExcelImportDialogOpen(false);
    // Chiudere la finestra non ferma l'import: si riapre col pulsante e si vede l'avanzamento
    if (importJob.inCorso) return;
    setFileImport(null);
    setAnteprimaImport([]);
    importJob.azzera();
  };

  /* --------------------------------------------------
   * FIX LOOP INFINITO:
   * imposto canaleArea una sola volta (solo se il campo è vuoto/diverso)
   * ------------------------------------------------*/
  useEffect(() => {
    if (
      isPuntoVenditaDialogOpen &&          // dialog aperto
      !isEditMode &&                       // nuova creazione
      !didSetDefaultCanaleRef.current &&   // non l'abbiamo già fatto
      (combinazioniDisponibili.data ?? []).length
    ) {
      const defaultId = combinazioniDisponibili.data![0].id;
      reset({                               // un unico reset, nessun loop
        ...getValues(),                     // preserva eventuali altri campi
        canaleArea: defaultId,
      });
      didSetDefaultCanaleRef.current = true;
    }

    /* quando il dialog si chiude, azzera il flag
       così al prossimo open torneremo a impostare il default una sola volta */
    if (!isPuntoVenditaDialogOpen) {
      didSetDefaultCanaleRef.current = false;
    }
  }, [
    isPuntoVenditaDialogOpen,
    isEditMode,
    combinazioniDisponibili.data,
    reset,
    getValues,
  ]);

  /* --------------------------------------------------
   * MUTAZIONI
   * ------------------------------------------------*/
  const mutationCreate = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        guidID: "",
        guidIDCombinazione: data.canaleArea,
        lat: coordinataDaForm(data.lat),
        lon: coordinataDaForm(data.lon),
      };
      return await ServerCall.put<ServerResponse<PuntoVenditaResponseDTO>>("/ACPV/salvaPV", payload);
    },
    onSuccess: (result) => {
      if (result.esito && result.data) {
        const message = result.isUpdate
          ? "Punto vendita aggiornato con successo"
          : "Punto vendita creato con successo";
        showNotification(message, { variant: "success" });
        invalidatePuntiVendita();
        reset();
        setIsPuntoVenditaDialogOpen(false);
      }
    },
    onError: (e: any) =>
      showNotification(
        e?.message ||
        "Errore durante la creazione del punto vendita",
        { variant: "error" }
      ),
  });

  const mutationUpdate = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        guidIDCombinazione: data.canaleArea,
        lat: coordinataDaForm(data.lat),
        lon: coordinataDaForm(data.lon),
      };
      return await ServerCall.put<ServerResponse<PuntoVenditaResponseDTO>>("/ACPV/modificaPV", payload);
    },
    onSuccess: (result) => {
      if (result.esito && result.data) {
        const message = result.isUpdate
          ? "Punto vendita aggiornato con successo"
          : "Punto vendita creato con successo";
        showNotification(message, { variant: "success" });
        invalidatePuntiVendita();
        reset();
        setIsPuntoVenditaDialogOpen(false);
      }
    },
    onError: (e: any) =>
      showNotification(
        e?.message ||
        "Errore durante la modifica del punto vendita",
        { variant: "error" }
      ),
  });

  const mutationDelete = useMutation({
    mutationFn: async (id: string) =>
      await ServerCall.delete(`/ACPV/eliminaPV/${id}`),
    onSuccess: () => {
      invalidatePuntiVendita();
      setPvDaEliminare(null);
      showNotification("Punto vendita eliminato", { variant: "success" });
    },
    onError: (e) =>
      showNotification(
        e?.message ||
        "Errore durante l'eliminazione del punto vendita",
        { variant: "error" }
      ),
  });

  // Il server legge il file col tracciato della GDO: con anteprima dice solo cosa farebbe di ogni riga
  const inviaFileImport = <T,>(file: File, anteprima: boolean) => {
    const formData = new FormData();
    formData.append("file", file);
    return ServerCall.post<T>(`/ACPV/importaPV${anteprima ? "?anteprima=true" : ""}`, formData, true);
  };

  const mutationAnteprimaImport = useMutation({
    mutationFn: (file: File) => inviaFileImport<{ righe: EsitoRigaImportPuntoVenditaDTO[] }>(file, true),
    onSuccess: (data) => setAnteprimaImport(data.righe),
    onError: (e: any) => {
      setFileImport(null);
      showNotification(e?.message || "Errore durante la lettura del file Excel", {
        variant: "error",
      });
    },
  });

  const avviaImport = async () => {
    if (!fileImport) return;
    try {
      await importJob.avvia(fileImport);
    } catch (e: any) {
      showNotification(e?.message || "Errore durante l'importazione dei punti vendita", { variant: "error" });
    }
  };

  const annullaImport = async () => {
    try {
      await importJob.annulla();
    } catch (e: any) {
      showNotification(e?.message || "Impossibile annullare l'importazione", { variant: "error" });
    }
  };

  /* --------------------------------------------------
   * HANDLERS CRUD
   * ------------------------------------------------*/

  const handleModify = (pv: PuntoVenditaResponseDTO) => {
    setIsEditMode(true);
    setCurrentPuntoVendita(pv);
    reset(valoriFormPuntoVendita(pv));
    setIsPuntoVenditaDialogOpen(true);
  };

  const openNewPuntoVenditaDialog = () => {
    reset({
      nome: "",
      citta: "",
      indirizzo: "",
      cap: "",
      lat: undefined,
      lon: undefined,
      provincia: "",
      regione: "",
      telefono: "",
      ragioneSociale: "",
      canaleArea: combinazioniDisponibili.data?.[0]?.id || "",
    });
    setIsEditMode(false);
    setCurrentPuntoVendita(null);
    setIsPuntoVenditaDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    if (isEditMode) {
      mutationUpdate.mutate({ ...data, guidID: currentPuntoVendita?.id });
    } else {
      mutationCreate.mutate({
        ...data,
        guidID: "",
        guidIDCombinazione: data.canaleArea,
      });
    }
  };

  /* --------------------------------------------------
   * HANDLER EXCEL
   * ------------------------------------------------*/
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // per poter riscegliere lo stesso file dopo averlo corretto
    if (!file) return;
    setFileImport(file);
    setAnteprimaImport([]);
    importJob.azzera();
    mutationAnteprimaImport.mutate(file);
  };

  const conteggiAnteprima = riepilogoAnteprima(anteprimaImport);
  const righeDaElaborare = conteggiAnteprima.importabili + conteggiAnteprima.daInserireAMano;

  const openFileSelector = () => fileInputRef.current?.click();

  /* --------------------------------------------------
   * RENDER
   * (tutto il markup resta identico all'originale)
   * ------------------------------------------------*/
  return (
    <>
      <ConfirmDialog
        open={!!pvDaEliminare}
        title="Eliminare il punto vendita?"
        description={<>Il punto vendita <strong>{pvDaEliminare?.nome}</strong> verrà eliminato.</>}
        confirmLabel="Elimina"
        loading={mutationDelete.isPending}
        onClose={() => setPvDaEliminare(null)}
        onConfirm={() => pvDaEliminare && mutationDelete.mutate(pvDaEliminare.id as string)}
      />
      {/* Dialog creazione/modifica punto vendita */}
      <Dialog
        size="lg"
        open={isPuntoVenditaDialogOpen}
        onClose={() => setIsPuntoVenditaDialogOpen(false)}
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              {isEditMode ? "Modifica Punto Vendita" : "Crea Punto Vendita"}
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <form
              ref={formRef}
              id="punto-vendita-form"
              className="grid grid-cols-12 gap-4 gap-y-3"
              onSubmit={handleSubmit(onSubmit)}
            >
              {/* --- CAMPI --- */}
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="nome">Nome</FormLabel>
                <FormInput
                  id="nome"
                  {...register("nome")}
                  className={errors.nome ? "border-danger" : ""}
                />
                {errors.nome && (
                  <p className="text-danger text-xs mt-1">{errors.nome.message}</p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="citta">Città</FormLabel>
                <FormInput
                  id="citta"
                  {...register("citta")}
                  className={errors.citta ? "border-danger" : ""}
                />
                {errors.citta && (
                  <p className="text-danger text-xs mt-1">{errors.citta.message}</p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="indirizzo">Indirizzo</FormLabel>
                <FormInput
                  id="indirizzo"
                  {...register("indirizzo")}
                  className={errors.indirizzo ? "border-danger" : ""}
                />
                {errors.indirizzo && (
                  <p className="text-danger text-xs mt-1">
                    {errors.indirizzo.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="cap">Cap</FormLabel>
                <FormInput
                  id="cap"
                  maxLength={5}
                  {...register("cap")}
                  className={errors.cap ? "border-danger" : ""}
                />
                {errors.cap && (
                  <p className="text-danger text-xs mt-1">{errors.cap.message}</p>
                )}
              </div>
              <div className="col-span-12">
                <FormLabel htmlFor="canaleArea">Canale e Area</FormLabel>
                <FormSelect
                  id="canaleArea"
                  value={watch("canaleArea")}
                  onChange={e => setValue("canaleArea", e.target.value)}
                  className={errors.canaleArea ? "border-danger" : ""}
                >
                  <option value="">Seleziona</option>
                  {combinazioniPerCanale.map(([canale, combinazioni]) => (
                    <optgroup key={canale} label={canale}>
                      {combinazioni.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome_area ? `${c.nome_area} (${c.sigla_combinazione})` : c.sigla_combinazione}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </FormSelect>
                {errors.canaleArea && (
                  <p className="text-danger text-xs mt-1">
                    {errors.canaleArea.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="lat">Latitudine</FormLabel>
                <FormInput
                  id="lat"
                  type="number"
                  step="0.000000000001"
                  {...register("lat")}
                  className={errors.lat ? "border-danger" : ""}
                />
                {errors.lat && (
                  <p className="text-danger text-xs mt-1">{errors.lat.message}</p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="lon">Longitudine</FormLabel>
                <FormInput
                  id="lon"
                  type="number"
                  step="0.000000000001"
                  {...register("lon")}
                  className={errors.lon ? "border-danger" : ""}
                />
                {errors.lon && (
                  <p className="text-danger text-xs mt-1">{errors.lon.message}</p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="provincia">Provincia</FormLabel>
                <FormInput
                  id="provincia"
                  {...register("provincia")}
                  className={errors.provincia ? "border-danger" : ""}
                />
                {errors.provincia && (
                  <p className="text-danger text-xs mt-1">
                    {errors.provincia.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="regione">Regione</FormLabel>
                <FormInput
                  id="regione"
                  {...register("regione")}
                  className={errors.regione ? "border-danger" : ""}
                />
                {errors.regione && (
                  <p className="text-danger text-xs mt-1">
                    {errors.regione.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="ragioneSociale">Ragione Sociale</FormLabel>
                <FormInput
                  id="ragioneSociale"
                  {...register("ragioneSociale")}
                  className={errors.ragioneSociale ? "border-danger" : ""}
                />
                {errors.ragioneSociale && (
                  <p className="text-danger text-xs mt-1">
                    {errors.ragioneSociale.message}
                  </p>
                )}
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="telefono">Telefono</FormLabel>
                <FormInput
                  id="telefono"
                  {...register("telefono")}
                  className={errors.telefono ? "border-danger" : ""}
                />
                {errors.telefono && (
                  <p className="text-danger text-xs mt-1">
                    {errors.telefono.message}
                  </p>
                )}
              </div>
            </form>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline-danger"
              onClick={() => setIsPuntoVenditaDialogOpen(false)}
              className="w-20 mr-1"
              disabled={mutationCreate.isPending || mutationUpdate.isPending}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit(onSubmit)}
              form="punto-vendita-form"
              className="w-20"
              disabled={mutationCreate.isPending || mutationUpdate.isPending}
            >
              {mutationCreate.isPending || mutationUpdate.isPending ? (
                <div className="flex items-center">
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? "Modifica" : "Crea"}
                </div>
              ) : isEditMode ? (
                "Modifica"
              ) : (
                "Crea"
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {rigaInAttesa && rigaRidotta !== rigaInAttesa.riga && (
        <InserimentoManualeImport
          riga={rigaInAttesa}
          combinazioni={combinazioniOrdinate}
          onDecidi={async decisione => {
            await importJob.decidi(decisione);
            queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"] });
          }}
          onAnnullaImport={annullaImport}
          onRiduci={() => setRigaRidotta(rigaInAttesa.riga)}
          annullamentoInCorso={importJob.annullamentoInCorso}
        />
      )}

      {/* Dialog importazione Excel */}
      <Dialog
        size="xl"
        open={isExcelImportDialogOpen}
        onClose={chiudiImport}
      >
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              Importa Punti Vendita da Excel
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <div className="grid grid-cols-12 gap-4 gap-y-3">
              <div className="col-span-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline-secondary"
                  className="w-full"
                  onClick={openFileSelector}
                  disabled={mutationAnteprimaImport.isPending || importJob.inCorso || importJob.avvioInCorso}
                >
                  {mutationAnteprimaImport.isPending ? (
                    <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  ) : (
                    <Lucide
                      icon="Upload"
                      className="stroke-[1.3] w-4 h-4 mr-2"
                    />
                  )}
                  {fileImport ? fileImport.name : "Seleziona file Excel"}
                </Button>
                <div className="mt-2 text-xs text-gray-500">
                  Il file viene letto con il tracciato previsto per la tua GDO.
                </div>
              </div>

              {statoImport && (
                <div className="col-span-12 mt-4">
                  <div className="flex items-center justify-between text-sm font-medium mb-2">
                    <span>
                      {importJob.inCorso
                        ? importJob.annullamentoInCorso
                          ? "Annullamento in corso…"
                          : statoImport.stato === "in_attesa"
                            ? "Importazione in pausa"
                            : "Importazione in corso…"
                        : statoImport.stato === "annullato"
                          ? "Importazione annullata"
                          : statoImport.stato === "errore"
                            ? "Importazione interrotta"
                            : "Importazione completata"}
                    </span>
                    <span>
                      {statoImport.elaborate} / {statoImport.totale} righe
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-slate-200 dark:bg-darkmode-400 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentualeImport(statoImport)}
                  >
                    <div
                      className={clsx(
                        "h-full transition-all",
                        statoImport.stato === "annullato" || statoImport.stato === "errore" ? "bg-warning" : "bg-primary"
                      )}
                      style={{ width: `${percentualeImport(statoImport)}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>Creati: <strong>{statoImport.creati}</strong></div>
                    <div>Aggiornati: <strong>{statoImport.aggiornati}</strong></div>
                    <div>Scartati: <strong>{statoImport.scartati}</strong></div>
                    <div>Inseriti a mano: <strong>{statoImport.inseritiAMano}</strong></div>
                    <div>Geolocalizzati: <strong>{statoImport.geolocalizzati}</strong></div>
                    <div>Senza coordinate: <strong>{statoImport.senzaCoordinate}</strong></div>
                    {(statoImport.stato === "annullato" || statoImport.stato === "errore") && (
                      <div>Non elaborati: <strong>{statoImport.nonElaborate}</strong></div>
                    )}
                  </div>
                  {statoImport.erroriNominatim > 0 && (
                    <div className="mt-3 rounded border border-danger/30 bg-danger/5 p-2 text-xs text-danger flex items-start">
                      <Lucide icon="CircleAlert" className="w-4 h-4 mr-1 shrink-0" />
                      <span>
                        Nominatim in errore ({statoImport.erroriNominatim} righe senza coordinate): {statoImport.ultimoErroreNominatim}
                      </span>
                    </div>
                  )}
                  {statoImport.soloFp > 0 && (
                    <div className="mt-3 text-xs text-warning flex items-center">
                      <Lucide icon="TriangleAlert" className="w-4 h-4 mr-1" />
                      {statoImport.soloFp} punti vendita salvati solo in FP: Istanta non era raggiungibile, i due sistemi non sono allineati
                    </div>
                  )}
                  {rigaInAttesa && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-warning">In pausa sulla riga {rigaInAttesa.riga}: serve il tuo inserimento manuale.</span>
                      {rigaRidotta === rigaInAttesa.riga && (
                        <Button variant="outline-warning" size="sm" onClick={() => setRigaRidotta(null)}>
                          Apri la riga in attesa
                        </Button>
                      )}
                    </div>
                  )}
                  {!importJob.inCorso && statoImport.errori.length > 0 && (
                    <ul className="mt-3 max-h-64 overflow-y-auto border rounded p-3 text-xs text-danger">
                      {statoImport.errori.map((e, i) => (
                        <li key={`${e.row}-${i}`}>
                          Riga {e.row}: {e.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {!statoImport && anteprimaImport.length > 0 && (
                <div className="col-span-12 mt-4">
                  <h3 className="text-sm font-medium mb-2">
                    Anteprima ({anteprimaImport.length} righe)
                  </h3>
                  <div className="max-h-64 overflow-y-auto border rounded">
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Riga</Table.Th>
                          <Table.Th>Nome</Table.Th>
                          <Table.Th>Città</Table.Th>
                          <Table.Th>Indirizzo</Table.Th>
                          <Table.Th>Cap</Table.Th>
                          <Table.Th>Canale/Area</Table.Th>
                          <Table.Th>Affidabilità</Table.Th>
                          <Table.Th>Esito</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {anteprimaImport.map(r => (
                          <Table.Tr
                            key={r.riga}
                            className={clsx(
                              r.azione === "scarta" && "bg-danger/5 dark:bg-danger/10",
                              r.azione === "revisiona" && "bg-warning/5 dark:bg-warning/10"
                            )}
                          >
                            <Table.Td>{r.riga}</Table.Td>
                            <Table.Td>{r.letto?.nome || "-"}</Table.Td>
                            <Table.Td>{r.letto?.citta || "-"}</Table.Td>
                            <Table.Td>{r.letto?.indirizzo || "-"}</Table.Td>
                            <Table.Td>{r.letto?.cap || "-"}</Table.Td>
                            <Table.Td>
                              {r.letto?.canaleArea ||
                                [r.letto?.canale, r.letto?.area].filter(Boolean).join(" / ") ||
                                "-"}
                            </Table.Td>
                            <Table.Td>
                              {r.azione === "scarta" ? (
                                "-"
                              ) : (
                                <div>
                                  <span
                                    className={clsx(
                                      "px-2 py-0.5 text-[11px] font-semibold rounded-full border",
                                      BADGE_PUNTEGGIO[classePunteggio(r.punteggio)]
                                    )}
                                  >
                                    {r.punteggio}
                                  </span>
                                  {r.motivi.length > 0 && (
                                    <div className="text-[11px] mt-1 text-slate-500">{r.motivi.join(" · ")}</div>
                                  )}
                                </div>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {r.azione === "scarta" ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-danger/10 text-danger border border-danger/20">
                                    <Lucide
                                      icon="CircleAlert"
                                      className="w-3.5 h-3.5"
                                    />
                                    Scartata
                                  </span>
                                  <div className="text-xs mt-1 text-danger">
                                    {r.errore}
                                  </div>
                                </div>
                              ) : r.azione === "revisiona" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-warning/10 text-warning border border-warning/20">
                                  <Lucide icon="ClipboardCheck" className="w-3.5 h-3.5" />
                                  Da inserire a mano
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-success/10 text-success border border-success/20">
                                  <Lucide
                                    icon="CircleCheck"
                                    className="w-3.5 h-3.5"
                                  />
                                  {r.azione === "crea" ? "Nuovo" : "Aggiorna"}
                                </span>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                  <div className="mt-4 text-sm">
                    Importabili: {conteggiAnteprima.importabili} · Da inserire a mano: {conteggiAnteprima.daInserireAMano} ·
                    Scartate: {conteggiAnteprima.scartate} (su {anteprimaImport.length} righe)
                  </div>
                </div>
              )}
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            {importJob.inCorso ? (
              <>
                <Button variant="outline-secondary" className="mr-1" onClick={chiudiImport}>
                  Nascondi
                </Button>
                <Button
                  variant="danger"
                  onClick={annullaImport}
                  disabled={importJob.annullamentoInCorso}
                >
                  {importJob.annullamentoInCorso && <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />}
                  Annulla importazione
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline-danger"
                  className="w-20 mr-1"
                  onClick={chiudiImport}
                >
                  {statoImport ? "Chiudi" : "Annulla"}
                </Button>
                {!statoImport && (
                  <Button
                    variant="primary"
                    className="w-auto"
                    onClick={avviaImport}
                    disabled={!fileImport || righeDaElaborare === 0 || importJob.avvioInCorso}
                  >
                    {importJob.avvioInCorso && (
                      <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                    )}
                    Importa {righeDaElaborare} righe
                  </Button>
                )}
              </>
            )}
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Tabella punti vendita */}
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title="Punti Vendita"
            description="Gestione punti vendita"
          />
          <div className="mt-3.5">
            <div className="flex flex-col box box--stacked">
              <div className="relative h-[440px] w-full p-4">
                <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-darkmode-500 dark:bg-darkmode-600">
                  {isLoading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center bg-white/80 dark:bg-darkmode-600/80 backdrop-blur-sm">
                      <LoadingIcon icon="tail-spin" color="#1d4ed8" className="w-10 h-10" />
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Caricamento punti vendita
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Recupero i dati dal server...
                      </div>
                    </div>
                  )}

                  {puntiVenditaQuery.isError && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
                      <Lucide icon="TriangleAlert" className="w-8 h-8 text-danger" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-200">
                        Punti vendita non caricati
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(puntiVenditaQuery.error as Error)?.message || "Errore durante il recupero dei punti vendita"}
                      </p>
                      <Button variant="outline-secondary" size="sm" onClick={() => puntiVenditaQuery.refetch()}>
                        Riprova
                      </Button>
                    </div>
                  )}

                  {!isLoading && hasMappablePoints && (
                    <MapPuntiVendita
                      puntiVendita={filtrati}
                      coloreCanale={coloreCanale}
                      onDettagli={pv => navigate(`/gestione-interna/punti-vendita/${pv.id}`)}
                    />
                  )}

                  {!isLoading && !puntiVenditaQuery.isError && !hasMappablePoints && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
                      <Lucide icon="MapPin" className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-200">
                        Nessun punto vendita geolocalizzato
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Inserisci latitudine e longitudine per visualizzarli sulla mappa.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {tuttiPuntiVendita.length > 0 && (
                <div className="flex flex-col gap-3 px-5 pb-5">
                  <FiltroChip
                    etichetta="Canale"
                    tutti="Tutti"
                    voci={perCanale}
                    attivo={filtroCanale}
                    onScegli={setFiltroCanale}
                    colore={id => coloriCanale.get(id) ?? COLORE_SENZA_CANALE}
                  />
                  <FiltroChip
                    etichetta="Area"
                    tutti="Tutte"
                    voci={perArea}
                    attivo={filtroArea}
                    onScegli={setFiltroArea}
                  />
                  {senzaCoordinate > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Lucide icon="MapPinOff" className="w-3.5 h-3.5" />
                      {senzaCoordinate === 1
                        ? "1 punto vendita filtrato non ha coordinate e non compare sulla mappa."
                        : `${senzaCoordinate} punti vendita filtrati non hanno coordinate e non compaiono sulla mappa.`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3.5">
            <div className="flex flex-col box box--stacked">
              <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Lucide
                      icon="Search"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                    />
                    <FormInput
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Cerca punto vendita"
                      className="pl-9 pr-9 rounded-[0.5rem]"
                    />
                    {isTableFetching ? (
                      <Lucide
                        icon="Loader"
                        className="absolute inset-y-0 right-0 my-auto mr-3 w-4 h-4 animate-spin text-primary"
                      />
                    ) : (
                      searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          className="absolute inset-y-0 right-0 my-auto mr-3 text-slate-400 hover:text-slate-600"
                          aria-label="Pulisci ricerca"
                        >
                          <Lucide icon="X" className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-slate-500">Mostra</span>
                    <FormSelect
                      value={pageSize.toString()}
                      onChange={e => setPageSize(Number(e.target.value))}
                      className="sm:w-36 rounded-[0.5rem]"
                    >
                      {pageSizeOptions.map(size => (
                        <option key={size} value={size}>
                          {size} / pagina
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">
                  <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
                    <Button
                      variant="outline-secondary"
                      className="w-full sm:w-auto"
                      onClick={() => setIsExcelImportDialogOpen(true)}
                    >
                      <Lucide
                        icon="FileSpreadsheet"
                        className="stroke-[1.3] w-4 h-4 mr-2"
                      />{" "}
                      {importJob.inCorso ? `Import in corso (${percentualeImport(importJob.stato!)}%)` : "Importa Excel"}
                    </Button>
                  </PermissionGate>
                  <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
                    <Button
                      variant="outline-secondary"
                      className="w-full sm:w-auto"
                      onClick={openNewPuntoVenditaDialog}
                    >
                      <Lucide icon="Plus" className="stroke-[1.3] w-4 h-4 mr-2" />{" "}
                      Crea
                    </Button>
                  </PermissionGate>
                </div>
              </div>
              <div className="overflow-hidden">
                <div className="grid grid-cols-12 gap-6 px-5 -mx-5 border-dashed border-y">
                  <div className="overflow-x-auto col-span-12 px-5">
                    <div className="px-5 border rounded-[0.6rem] dark:border-darkmode-400 relative mt-7 mb-4 border-slate-200/80">
                      <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white text-slate-500">
                        <div className="-mt-px">Punti Vendita</div>
                      </div>
                      <div className="py-2 mt-4 flex flex-col gap-3.5 overflow-x-auto">
                        <Table>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>#</Table.Th>
                              <Table.Th>Nome</Table.Th>
                              <Table.Th>Indirizzo</Table.Th>
                              <Table.Th>Canale</Table.Th>
                              <Table.Th>Area</Table.Th>
                              {mostraCodiciGdo && <Table.Th>Codice GDO</Table.Th>}
                              <Table.Th className="text-center">Azioni</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {isLoading ? (
                              <Table.Tr>
                                <Table.Td colSpan={12}>
                                  <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <LoadingIcon icon="tail-spin" color="#1d4ed8" className="w-8 h-8" />
                                    <div className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-200">
                                      Caricamento punti vendita...
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      Attendere qualche istante
                                    </div>
                                  </div>
                                </Table.Td>
                              </Table.Tr>
                            ) : puntiVenditaQuery.isError ? (
                              <Table.Tr>
                                <Table.Td colSpan={12} className="text-center text-danger">
                                  Punti vendita non caricati: {(puntiVenditaQuery.error as Error)?.message || "errore durante il recupero"}
                                </Table.Td>
                              </Table.Tr>
                            ) : puntiVendita.length === 0 ? (
                              <Table.Tr>
                                <Table.Td colSpan={12} className="text-center text-slate-500 dark:text-slate-400">
                                  {debouncedSearch.trim() || filtroCanale || filtroArea
                                    ? "Nessun punto vendita corrisponde alla ricerca o ai filtri"
                                    : "Nessun punto vendita disponibile"}
                                </Table.Td>
                              </Table.Tr>
                            ) : (
                              puntiVendita.map((pv, idx) => (
                                <Table.Tr key={pv.id}>
                                  <Table.Td>{baseIndex + idx + 1}</Table.Td>
                                  <Table.Td>
                                    <div className="font-medium">{pv.nome}</div>
                                    {pv.ragionesociale && (
                                      <div className="text-xs text-slate-500">{pv.ragionesociale}</div>
                                    )}
                                  </Table.Td>
                                  <Table.Td>{indirizzoCompleto(pv)}</Table.Td>
                                  <Table.Td>
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: coloreCanale(pv) }} />
                                      {pv.nome_canale || "-"}
                                    </span>
                                  </Table.Td>
                                  <Table.Td>{pv.nome_area || "-"}</Table.Td>
                                  {mostraCodiciGdo && (
                                    <Table.Td>
                                      {codiciGdo(pv.meta).map(c => (
                                        <div key={c.etichetta} className="text-xs">
                                          <span className="text-slate-500">{c.etichetta}:</span> {c.valore}
                                        </div>
                                      ))}
                                    </Table.Td>
                                  )}
                                  <Table.Td className="flex justify-center">
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleModify(pv)}
                                      >
                                        Modifica
                                      </Button>
                                      <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA}>
                                        <Button
                                          variant="outline-danger"
                                          size="sm"
                                          onClick={() => setPvDaEliminare(pv)}
                                        >
                                          Elimina
                                        </Button>
                                      </PermissionGate>
                                      <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() =>
                                          navigate(`/gestione-interna/punti-vendita/${pv.id}`)
                                        }
                                      >
                                        Dettagli
                                      </Button>
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
              </div>
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  {isLoading ? (
                    "Caricamento dei punti vendita..."
                  ) : totalItems > 0 ? (
                    <>
                      Mostrati
                      <span className="mx-1 font-semibold text-slate-700 dark:text-slate-200">
                        {showingFrom}
                      </span>
                      -
                      <span className="mx-1 font-semibold text-slate-700 dark:text-slate-200">
                        {showingTo}
                      </span>
                      di
                      <span className="ml-1 font-semibold text-slate-700 dark:text-slate-200">
                        {totalItems}
                      </span>
                      &nbsp;
                      punti vendita
                    </>
                  ) : (
                    "Nessun punto vendita da mostrare"
                  )}
                </div>
                {totalPages > 1 && (
                  <Pagination className="flex w-full justify-end sm:w-auto">
                    <Pagination.Link
                      onClick={() => canGoPrev && setPage(prev => Math.max(1, prev - 1))}
                      className={!canGoPrev ? "opacity-40 pointer-events-none" : ""}
                    >
                      <Lucide icon="ChevronLeft" className="w-4 h-4" />
                    </Pagination.Link>
                    {paginationRange.map(item =>
                      typeof item === "number" ? (
                        <Pagination.Link
                          key={`page-${item}`}
                          active={item === page}
                          onClick={() => setPage(item)}
                        >
                          {item}
                        </Pagination.Link>
                      ) : (
                        <Pagination.Link
                          key={item}
                          className="pointer-events-none select-none text-slate-400"
                        >
                          ...
                        </Pagination.Link>
                      )
                    )}
                    <Pagination.Link
                      onClick={() => canGoNext && setPage(prev => prev + 1)}
                      className={!canGoNext ? "opacity-40 pointer-events-none" : ""}
                    >
                      <Lucide icon="ChevronRight" className="w-4 h-4" />
                    </Pagination.Link>
                  </Pagination>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default withSessionCheck(Main);
