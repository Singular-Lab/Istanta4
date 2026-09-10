import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Pagination from "@/components/Base/Pagination";
import { PermissionGate } from "@/components/PermissionGate";
import Table from "@/components/Base/Table";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import {
  useFetchAllCombinazioneForGDO,
  useFetchPuntiVenditaFromIdGDO,
  useFetchPuntiVenditaPaginated,
} from "@/query/query";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import * as yup from "yup";
import { ServerCall } from "../../../lib/server_call";
import { PuntoVenditaResponseDTO } from "../../../server/core/dto";
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
  lat: yup
    .number()
    .typeError("La latitudine deve essere un numero")
    .required("La latitudine è obbligatoria"),
  lon: yup
    .number()
    .typeError("La longitudine deve essere un numero")
    .required("La longitudine è obbligatoria"),
  ragioneSociale: yup.string().required("La ragione sociale è obbligatoria"),
  provincia: yup.string().required("La provincia è obbligatoria"),
  regione: yup.string().required("La regione è obbligatoria"),
  telefono: yup.string().required("Il telefono è obbligatorio"),
});

const normalizeText = (value: string) =>
  value
    ? value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim()
    : "";

const hasValidCoordinates = (pv: PuntoVenditaResponseDTO) =>
  pv.has_coordinate &&
  pv.coordinate &&
  Number.isFinite(pv.coordinate.lat) &&
  Number.isFinite(pv.coordinate.lon);

const createMarkerIcon = (className: string, size: number) =>
  L.divIcon({
    className,
    html: `<span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const defaultStoreMarker = createMarkerIcon("pv-marker", 12);
const highlightStoreMarker = createMarkerIcon("pv-marker pv-marker--highlight", 18);
const dimmedStoreMarker = createMarkerIcon("pv-marker pv-marker--dimmed", 10);

interface MapPuntiVenditaProps {
  puntiVendita: PuntoVenditaResponseDTO[];
  highlightedIds?: Set<string>;
  filtersActive?: boolean;
}
const resolvePuntoVenditaId = (pv: PuntoVenditaResponseDTO) =>
  pv.id ?? (pv as any).guidID ?? (pv as any).guidid ?? `${pv.nome ?? "pv"}-${pv.cap ?? ""}`;

function MapPuntiVendita({ puntiVendita, highlightedIds, filtersActive = false }: MapPuntiVenditaProps) {
  const validPoints = puntiVendita.filter(hasValidCoordinates);
  const shouldDimOthers = Boolean(filtersActive && highlightedIds && highlightedIds.size > 0);

  return (
    <MapContainer
      center={[41.8719, 12.5674]} // Italia
      zoom={6}
      preferCanvas
      scrollWheelZoom={false}
      doubleClickZoom={false}
      dragging
      zoomControl={true}
      attributionControl={false}
      className="absolute inset-0 rounded-md"
    >
      {/* CartoDB Positron */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {/* Marker */}
      {validPoints.map(pv => (
        <Marker
          key={resolvePuntoVenditaId(pv)}
          position={[pv.coordinate!.lat, pv.coordinate!.lon]}
          icon={(() => {
            const pointId = resolvePuntoVenditaId(pv);
            const isHighlighted = highlightedIds?.has(pointId);
            if (isHighlighted) return highlightStoreMarker;
            if (shouldDimOthers) return dimmedStoreMarker;
            return defaultStoreMarker;
          })()}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold">{pv.nome_display}</div>
              <div>{pv.indirizzo_completo}</div>
              <div>
                {pv.cap} {pv.citta}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function Main() {
  /* --------------------------------------------------
   * REFS E FORM
   * ------------------------------------------------*/
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showNotification } = useNotification();
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

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  /* --------------------------------------------------
   * QUERY
   * ------------------------------------------------*/
  const queryClient = useQueryClient();
  const combinazioniDisponibili = useFetchAllCombinazioneForGDO();
  const puntiVenditaMapQuery = useFetchPuntiVenditaFromIdGDO();
  const puntiVenditaMap = puntiVenditaMapQuery.data ?? [];
  const hasMappablePoints = puntiVenditaMap.some(
    pv =>
      pv.has_coordinate &&
      pv.coordinate &&
      Number.isFinite(pv.coordinate.lat) &&
      Number.isFinite(pv.coordinate.lon)
  );
  const isMapLoading = puntiVenditaMapQuery.isLoading;
  const filtersActive = Boolean(debouncedSearch.trim());

  const puntiVenditaQueryParams = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim();
    return {
      page,
      pageSize,
      search: normalizedSearch ? normalizedSearch : undefined,
    };
  }, [page, pageSize, debouncedSearch]);

  const puntiVenditaPaginatedQuery =
    useFetchPuntiVenditaPaginated(puntiVenditaQueryParams);
  const paginatedData = puntiVenditaPaginatedQuery.data;
  const puntiVendita = paginatedData?.punti_vendita ?? [];
  const highlightedMapIds = useMemo(() => {
    if (!filtersActive || !puntiVendita.length) {
      return undefined;
    }
    return puntiVendita.reduce<Set<string>>((acc, pv) => {
      const pointId = resolvePuntoVenditaId(pv);
      if (pointId) {
        acc.add(pointId);
      }
      return acc;
    }, new Set());
  }, [puntiVendita, filtersActive]);
  const totalItems = paginatedData?.total ?? 0;
  const totalPages = paginatedData?.total_pages ?? 0;
  const pageLimit = paginatedData?.limit ?? pageSize;
  const isTableLoading = puntiVenditaPaginatedQuery.isLoading;
  const isTableFetching = puntiVenditaPaginatedQuery.isFetching;
  const pageSizeOptions = [10, 25, 50];

  useEffect(() => {
    if (!paginatedData) {
      return;
    }

    const metaTotalPages = paginatedData.total_pages ?? 0;
    const metaTotalItems = paginatedData.total ?? 0;

    if (metaTotalPages === 0 && metaTotalItems === 0) {
      if (page !== 1) {
        setPage(1);
      }
      return;
    }

    if (metaTotalPages > 0 && page > metaTotalPages) {
      setPage(metaTotalPages);
    }
  }, [paginatedData, page]);

  const showingFrom = totalItems === 0 ? 0 : (page - 1) * pageLimit + 1;
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
    queryClient.invalidateQueries({ queryKey: ["dataPuntiVenditaPaginated"] });
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
  const [excelData, setExcelData] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const didSetDefaultCanaleRef = useRef(false);

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
        lat: parseFloat(data.lat) || 0,
        lon: parseFloat(data.lon) || 0,
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
        e?.response?.data?.message ||
        "Errore durante la creazione del punto vendita",
        { variant: "error" }
      ),
  });

  const mutationUpdate = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        lat: parseFloat(data.lat) || 0,
        lon: parseFloat(data.lon) || 0,
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
        e?.response?.data?.message ||
        "Errore durante la modifica del punto vendita",
        { variant: "error" }
      ),
  });

  const mutationDelete = useMutation({
    mutationFn: async (id: string) =>
      await ServerCall.delete(`/ACPV/eliminaPV/${id}`),
    onSuccess: () => invalidatePuntiVendita(),
  });

  const mutationBulkImport = useMutation({
    mutationFn: async (list: any[]) =>
      await ServerCall.post("/ACPV/importaPV", { puntiVendita: list }),
    onSuccess: () => {
      invalidatePuntiVendita();
      setIsExcelImportDialogOpen(false);
      setExcelData([]);
      setValidationResults([]);
      showNotification("Importazione completata con successo", {
        variant: "success",
      });
    },
    onError: () =>
      showNotification("Errore durante l'importazione dei punti vendita", {
        variant: "error",
      }),
  });

  /* --------------------------------------------------
   * HANDLERS CRUD
   * ------------------------------------------------*/
  const handleDelete = (id: string) => mutationDelete.mutate(id);

  const handleModify = (pv: PuntoVenditaResponseDTO) => {
    setIsEditMode(true);
    setCurrentPuntoVendita(pv);
    reset({
      nome: pv.nome,
      citta: pv.citta,
      indirizzo: pv.indirizzo,
      cap: pv.cap,
      canaleArea: pv.id_combinazione_canale_area,
      lat: pv.lat,
      lon: pv.lon,
      provincia: pv.provincia,
      regione: pv.regione,
      telefono: pv.telefono,
      ragioneSociale: pv.ragionesociale,
    });
    setIsPuntoVenditaDialogOpen(true);
  };

  const openNewPuntoVenditaDialog = () => {
    reset({
      nome: "",
      citta: "",
      indirizzo: "",
      cap: "",
      lat: 0,
      lon: 0,
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
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        setExcelData(json);
        validateExcelData(json as any[]);
      } catch {
        showNotification("Errore durante la lettura del file Excel", {
          variant: "error",
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const validateExcelData = (rows: any[]) => {
    const results = rows.map((row, idx) => {
      const errs: string[] = [];
      if (!row.nome) errs.push("Nome mancante");
      if (!row.citta) errs.push("Città mancante");
      if (!row.indirizzo) errs.push("Indirizzo mancante");
      if (!row.cap) errs.push("CAP mancante");
      if (!row.canaleArea) errs.push("Canale/Area mancante");
      const validCA = combinazioniDisponibili.data?.some(
        c => c.sigla_combinazione === row.canaleArea || c.id === row.canaleArea
      );
      if (row.canaleArea && !validCA) errs.push("Canale/Area non valido");
      if (row.cap && !/^[0-9]{5}$/.test(row.cap.toString()))
        errs.push("Formato CAP non valido");
      return { row: idx + 1, data: row, isValid: errs.length === 0, errors: errs };
    });
    setValidationResults(results);
  };

  const prepareDataForImport = () =>
    validationResults
      .filter(r => r.isValid)
      .map(r => {
        const comb = combinazioniDisponibili.data?.find(
          c => c.sigla_combinazione === r.data.canaleArea || c.id === r.data.canaleArea
        );
        return {
          nome: r.data.nome,
          indirizzo: r.data.indirizzo,
          guidID: "",
          guidIDCombinazione: comb?.id || "",
          citta: r.data.citta,
          cap: r.data.cap.toString(),
          lat: 0,
          lon: 0,
        };
      });

  const importValidData = () => {
    const list = prepareDataForImport();
    if (!list.length) {
      showNotification("Nessun dato valido da importare", { variant: "warning" });
      return;
    }
    mutationBulkImport.mutate(list);
  };

  const openFileSelector = () => fileInputRef.current?.click();

  /* --------------------------------------------------
   * RENDER
   * (tutto il markup resta identico all'originale)
   * ------------------------------------------------*/
  return (
    <>
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
                  {combinazioniDisponibili.data?.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.sigla_combinazione}
                    </option>
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

      {/* Dialog importazione Excel */}
      <Dialog
        size="xl"
        open={isExcelImportDialogOpen}
        onClose={() => setIsExcelImportDialogOpen(false)}
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
                >
                  <Lucide
                    icon="Upload"
                    className="stroke-[1.3] w-4 h-4 mr-2"
                  />
                  Seleziona file Excel
                </Button>
                <div className="mt-2 text-xs text-gray-500">
                  Formato richiesto: colonne "nome", "citta", "indirizzo", "cap", "canaleArea"
                </div>
              </div>

              {excelData.length > 0 && (
                <div className="col-span-12 mt-4">
                  <h3 className="text-sm font-medium mb-2">
                    Validazione dati ({excelData.length} record)
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
                          <Table.Th>Stato</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {validationResults.map(r => (
                          <Table.Tr
                            key={r.row}
                            className={
                              !r.isValid ? "bg-danger/5 dark:bg-danger/10" : ""
                            }
                          >
                            <Table.Td>{r.row}</Table.Td>
                            <Table.Td>{r.data.nome || "-"}</Table.Td>
                            <Table.Td>{r.data.citta || "-"}</Table.Td>
                            <Table.Td>{r.data.indirizzo || "-"}</Table.Td>
                            <Table.Td>{r.data.cap || "-"}</Table.Td>
                            <Table.Td>{r.data.canaleArea || "-"}</Table.Td>
                            <Table.Td>
                              {r.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-success/10 text-success border border-success/20">
                                  <Lucide
                                    icon="CircleCheck"
                                    className="w-3.5 h-3.5"
                                  />
                                  Valido
                                </span>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-danger/10 text-danger border border-danger/20">
                                    <Lucide
                                      icon="CircleAlert"
                                      className="w-3.5 h-3.5"
                                    />
                                    Errori
                                  </span>
                                  <ul className="text-xs ml-5 mt-1 text-danger">
                                    {r.errors.map((e: string, i: number) => (
                                      <li key={i} className="list-disc">
                                        {e}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                  <div className="mt-4 text-sm">
                    Record validi:{" "}
                    {validationResults.filter(r => r.isValid).length} /{" "}
                    {validationResults.length}
                  </div>
                </div>
              )}
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-danger"
              className="w-20 mr-1"
              onClick={() => setIsExcelImportDialogOpen(false)}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              className="w-auto"
              onClick={importValidData}
              disabled={
                excelData.length === 0 ||
                validationResults.filter(r => r.isValid).length === 0
              }
            >
              Importa {validationResults.filter(r => r.isValid).length} record
              validi
            </Button>
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
              <div className="relative h-[400px] w-full p-4">
                <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-darkmode-500 dark:bg-darkmode-600">
                  {isMapLoading && (
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

                  {!isMapLoading && hasMappablePoints && (
                    <MapPuntiVendita
                      puntiVendita={puntiVenditaMap}
                      highlightedIds={highlightedMapIds}
                      filtersActive={filtersActive}
                    />
                  )}

                  {!isMapLoading && !hasMappablePoints && (
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
                  <Button
                    variant="outline-secondary"
                    className="w-full sm:w-auto"
                    onClick={() => setIsExcelImportDialogOpen(true)}
                  >
                    <Lucide
                      icon="FileSpreadsheet"
                      className="stroke-[1.3] w-4 h-4 mr-2"
                    />{" "}
                    Importa Excel
                  </Button>
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
                              <Table.Th>Città</Table.Th>
                              <Table.Th>Indirizzo</Table.Th>
                              <Table.Th>Cap</Table.Th>
                              <Table.Th>Canale/Area</Table.Th>
                              <Table.Th className="text-center">Azioni</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {isTableLoading ? (
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
                            ) : puntiVendita.length === 0 ? (
                              <Table.Tr>
                                <Table.Td colSpan={12} className="text-center text-slate-500 dark:text-slate-400">
                                  {debouncedSearch.trim()
                                    ? "Nessun punto vendita corrisponde alla ricerca"
                                    : "Nessun punto vendita disponibile"}
                                </Table.Td>
                              </Table.Tr>
                            ) : (
                              puntiVendita.map((pv, idx) => (
                                <Table.Tr key={pv.id}>
                                  <Table.Td>{baseIndex + idx + 1}</Table.Td>
                                  <Table.Td>{pv.nome}</Table.Td>
                                  <Table.Td>{pv.citta}</Table.Td>
                                  <Table.Td>{pv.indirizzo}</Table.Td>
                                  <Table.Td>{pv.cap}</Table.Td>
                                  <Table.Td>{pv.sigla_combinazione ?? "-"}</Table.Td>
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
                                          onClick={() => handleDelete(pv.id as string)}
                                        >
                                          Elimina
                                        </Button>
                                      </PermissionGate>
                                      <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() =>
                                          navigate(`/punti-vendita/${pv.id}`)
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
                  {isTableLoading ? (
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
