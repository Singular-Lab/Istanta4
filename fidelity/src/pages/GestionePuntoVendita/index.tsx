import userIcon from "@/assets/images/users/user_icon_profile.png";
import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import withSessionCheck from "@/components/SessionChecker";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti, { type OpzioneSegmento } from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import type { TonoStato } from "@/constants/stati";
import { formatData } from "@/utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useMemo, useRef, useState } from "react";
import { Marker, TileLayer } from "react-leaflet";
import { MapContainer } from "react-leaflet/MapContainer";
import { useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import type { CreateDisplayContextDTO, DisplayContextResponseDTO, DispositivoPuntoVenditaResponseDTO, PuntoVenditaResponseDTO } from "../../../server/core/dto";
import { Dialog, Menu } from "../../components/Base/Headless";
import { usePVDeviceStatus } from "../../hooks/usePVDeviceStatus";
import { canaleArea, codiciGdo, indirizzoCompleto } from "../../utils/puntoVendita";
import { operatorOptions } from "../../pages/GestioneApi/constants";
import type { FilterCondition } from "../../pages/GestioneApi/types";
import { createEmptyFilterCondition, createEmptyFilterGroup, formatFiltersForApi } from "../../pages/GestioneApi/utils/filterHelpers";
import { useFetchDisplayContextsByPuntoVendita, useFetchDispositiviPuntoVendita, useFetchFilesFieldValues, useFetchFilesMetadataFields, useFetchVolantiniAttiviPuntoVendita } from "../../query/query";

// Componente per input valore filtro con caricamento dinamico
interface ContextFilterValueInputProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
}

const ContextFilterValueInput: React.FC<ContextFilterValueInputProps> = ({
  field,
  value,
  onChange,
}) => {
  const { data: values = [], isLoading } = useFetchFilesFieldValues(field, !!field);

  if (!field || values.length === 0) {
    return (
      <FormInput
        type="text"
        placeholder="Valore"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      />
    );
  }

  return (
    <FormSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
    >
      <option value="">Seleziona valore</option>
      {values.map((val, i) => (
        <option key={i} value={val}>{val}</option>
      ))}
    </FormSelect>
  );
};

/** Stato di connessione del dispositivo: offline è un'assenza di segnale, non un errore. */
const STATO_DISPOSITIVO: Record<"online" | "offline" | "warning", { tono: TonoStato; etichetta: string }> = {
  online: { tono: "success", etichetta: "Online" },
  warning: { tono: "warning", etichetta: "Warning" },
  offline: { tono: "neutral", etichetta: "Offline" },
};

/** Volantini delle promo valide, dai kit pubblicati con la stessa area e lo stesso canale del punto vendita. */
const VolantiniAttivi: React.FC<{ idPv: string; canaleArea: string }> = ({ idPv, canaleArea }) => {
  const { data: volantini = [], isLoading, isError, error, refetch } = useFetchVolantiniAttiviPuntoVendita(idPv);

  return (
    <Sezione titolo="Volantini attivi" descrizione={canaleArea}>
      {isLoading ? (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" decorativo /> Caricamento volantini...
        </div>
      ) : isError ? (
        <PageError
          compatta
          titolo="Volantini non caricati"
          motivo={(error as Error)?.message || "Errore durante il recupero dei volantini"}
          onRiprova={() => refetch()}
        />
      ) : volantini.length === 0 ? (
        <EmptyState
          compatta
          icon="FileSearch"
          title="Nessun volantino attivo"
          description="Nessun volantino attivo per questo canale e quest'area."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {volantini.map(v => (
            <div key={v.id_kit}>
              <div className="flex flex-wrap items-baseline gap-x-2 mb-3">
                <h3 className="title-card">{v.promo.nome}</h3>
                <span className="text-xs tabular-nums text-slate-500">
                  dal {formatData(v.promo.validita_dal)} al {formatData(v.promo.validita_al)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {v.files.map(f => (
                  <div key={f.id} className="overflow-hidden rounded-card border border-slate-200 dark:border-darkmode-400">
                    <img src={f.url} alt={f.nome} loading="lazy" className="h-40 w-full object-cover object-top bg-slate-50" />
                    <div className="flex items-center gap-2 p-3">
                      <span className="truncate text-sm" title={f.nome}>{f.nome}</span>
                      <a href={f.url_download} download={f.nome_download} className="ml-auto flex flex-none items-center text-sm text-primary">
                        <Lucide icon="Download" aria-hidden="true" className="mr-1 h-4 w-4 stroke-[1.3]" /> PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Sezione>
  );
};

const GestionePuntoVendita: React.FC = () => {
  const { puntoVendita } = useLoaderData() as {
    puntoVendita: PuntoVenditaResponseDTO;
  };
  const refMap = useRef<LeafletMap | null>(null);
  const storeMarker = L.divIcon({
    className: "pv-marker",
    html: `<span></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  // ✅ Destrutturo i campi del DTO così è tutto tipato e chiaro
  const {
    nome,
    nome_display,
    citta,
    provincia,
    regione,
    ragionesociale,
    telefono,
    has_coordinate,
    coordinate,
    numero_utenti_collegati,
    meta,
  } = puntoVendita;

  const displayName = nome_display || nome;

  const displayIndirizzoCompleto = [indirizzoCompleto(puntoVendita), regione].filter(Boolean).join(" - ");

  const displayLocationShort = [citta, provincia, regione].filter(Boolean).join(", ");

  const displayCanaleArea = canaleArea(puntoVendita);

  const codici = codiciGdo(meta);

  const parseCoordinate = (value?: number | string | null) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  // Senza coordinate il DTO porta 0,0: niente mappa, invece di una mappa centrata in mare
  const lat = has_coordinate ? parseCoordinate(coordinate?.lat) : null;
  const lon = has_coordinate ? parseCoordinate(coordinate?.lon) : null;
  const posizione: [number, number] | null = lat !== null && lon !== null ? [lat, lon] : null;

  const mapZoom = 17;

  // ============================================================
  // DISPOSITIVI - DATI REALI DA API
  // ============================================================
  type DeviceStatus = "online" | "offline" | "warning";

  const queryClient = useQueryClient();
  const {
    data: dispositivi = [],
    isLoading: isLoadingDevices,
    isError: isErrorDevices,
    error: erroreDevices,
    refetch: refetchDevices,
  } = useFetchDispositiviPuntoVendita(puntoVendita.id);

  // Real-time device status via WebSocket
  const { deviceStatuses, getDeviceStatus } = usePVDeviceStatus(puntoVendita.id);

  const [deviceQuery, setDeviceQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | "all">("all");

  const getDeviceStatusValue = (device: DispositivoPuntoVenditaResponseDTO): DeviceStatus => {
    if (!device.is_active) return "offline";

    const realtimeStatus = getDeviceStatus(device.id);

    // 🔥 PRIORITÀ ASSOLUTA AL REALTIME
    if (realtimeStatus) {
      if (realtimeStatus.isConnected === true) return "online";
      if (realtimeStatus.isConnected === false) return "offline";
    }

    // Fallback HTTP
    if (device.is_online) return "online";

    if (device.last_seen_at) {
      const lastSeen = new Date(device.last_seen_at).getTime();
      const diffMinutes = (Date.now() - lastSeen) / 60000;
      if (diffMinutes < 15) return "warning";
    }

    return "offline";
  };


  const getLastSeenLabel = (device: DispositivoPuntoVenditaResponseDTO): string => {
    if (!device.last_seen_at) return "Mai connesso";
    const lastSeen = new Date(device.last_seen_at).getTime();
    const now = Date.now();
    const diffMs = now - lastSeen;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 30) return "Adesso";
    if (diffSeconds < 60) return `${diffSeconds}s fa`;
    if (diffMinutes < 60) return `${diffMinutes} min fa`;
    if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m fa`;
    return `${diffDays}g fa`;
  };

  const filteredDevices = useMemo(() => {
    const q = deviceQuery.trim().toLowerCase();
    return dispositivi
      .filter((d) => {
        if (statusFilter === "all") return true;
        return getDeviceStatusValue(d) === statusFilter;
      })
      .filter((d) => {
        if (!q) return true;
        return (
          d.nome.toLowerCase().includes(q) ||
          (d.descrizione || "").toLowerCase().includes(q) ||
          (d.displayContext?.nome || "").toLowerCase().includes(q)
        );
      });
  }, [deviceQuery, statusFilter, dispositivi]);

  const statusBadge = (status: DeviceStatus, isRealtimeConnected: boolean = false) => {
    const { tono, etichetta } = STATO_DISPOSITIVO[status];
    return <StatusBadge tono={tono} etichetta={status === "online" && isRealtimeConnected ? "Live" : etichetta} />;
  };

  const statusCardRing = (status: DeviceStatus) => {
    if (status === "online") return "ring-1 ring-success/15";
    if (status === "warning") return "ring-1 ring-warning/15";
    return "ring-1 ring-danger/15";
  };

  const handleCopyDisplayUrl = useCallback((device: DispositivoPuntoVenditaResponseDTO) => {
    if (device.display_url) {
      navigator.clipboard.writeText(device.display_url);
    }
  }, []);

  const handleToggleActive = useCallback(async (device: DispositivoPuntoVenditaResponseDTO) => {
    try {
      await ServerCall.put(`/dispositivi/${device.id}`, {
        is_active: !device.is_active,
      });
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    } catch (error) {
      console.error("Errore nel toggle attivazione dispositivo:", error);
    }
  }, [puntoVendita.id, queryClient]);

  // Conferma delle azioni distruttive (elimina dispositivo/contesto, rigenera token)
  const [conferma, setConferma] = useState<{ title: string; description: string; confirmLabel: string; azione: () => Promise<unknown> } | null>(null);
  const [confermaLoading, setConfermaLoading] = useState(false);

  const eseguiConferma = async () => {
    if (!conferma) return;
    setConfermaLoading(true);
    try {
      await conferma.azione();
    } catch (error) {
      console.error("Errore nell'azione confermata:", error);
    } finally {
      setConfermaLoading(false);
      setConferma(null);
    }
  };

  const handleDeleteDevice = useCallback((device: DispositivoPuntoVenditaResponseDTO) => {
    setConferma({
      title: "Eliminare il dispositivo?",
      description: `Il dispositivo "${device.nome}" verrà eliminato e il suo URL display smetterà di funzionare.`,
      confirmLabel: "Elimina dispositivo",
      azione: async () => {
        await ServerCall.delete(`/dispositivi/${device.id}`);
        queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
      },
    });
  }, [puntoVendita.id, queryClient]);

  const handleRegenerateToken = useCallback((device: DispositivoPuntoVenditaResponseDTO) => {
    setConferma({
      title: "Rigenerare il token?",
      description: `Verrà generato un nuovo token per "${device.nome}": il vecchio URL display non funzionerà più e andrà aggiornato sul dispositivo.`,
      confirmLabel: "Rigenera token",
      azione: async () => {
        await ServerCall.post(`/dispositivi/${device.id}/regenerate-token`, {});
        queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
      },
    });
  }, [puntoVendita.id, queryClient]);

  // ============================================================
  // MODALE CREAZIONE DISPOSITIVO
  // ============================================================
  const [isCreateDeviceOpen, setIsCreateDeviceOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceDescription, setNewDeviceDescription] = useState("");
  const [createdDevice, setCreatedDevice] = useState<DispositivoPuntoVenditaResponseDTO | null>(null);

  const createDeviceMutation = useMutation({
    mutationFn: async () => {
      const result = await ServerCall.post<DispositivoPuntoVenditaResponseDTO>('/dispositivi', {
        nome: newDeviceName.trim(),
        descrizione: newDeviceDescription.trim() || undefined,
        id_puntivendita: puntoVendita.id,
        secret_dispositivo: crypto.randomUUID(),
      });
      return result;
    },
    onSuccess: (data) => {
      setCreatedDevice(data);
      setIsCreateDeviceOpen(false);
      setNewDeviceName("");
      setNewDeviceDescription("");
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    },
  });

  const closeCreateDialog = () => {
    setIsCreateDeviceOpen(false);
    setNewDeviceName("");
    setNewDeviceDescription("");
  };

  const closeSuccessDialog = () => {
    setCreatedDevice(null);
  };

  // ============================================================
  // DISPLAY CONTEXTS
  // ============================================================
  const {
    data: displayContexts = [],
    isLoading: isLoadingContexts,
    isError: isErrorContexts,
    error: erroreContexts,
    refetch: refetchContexts,
  } = useFetchDisplayContextsByPuntoVendita(puntoVendita.id);
  const { data: metadataFields = [] } = useFetchFilesMetadataFields();

  // Opzioni campi per i filtri del display context
  const fileFieldOptions = useMemo(() => {
    return metadataFields.map(field => {
      const parts = field.split('.');
      const label = parts.length > 1
        ? parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' -> ')
        : field.charAt(0).toUpperCase() + field.slice(1);
      return { value: field, label };
    });
  }, [metadataFields]);

  const [isCreateContextOpen, setIsCreateContextOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<DisplayContextResponseDTO | null>(null);

  // Form state for context creation/editing
  const [ctxNome, setCtxNome] = useState("");
  const [ctxDescrizione, setCtxDescrizione] = useState("");
  const [ctxEndpointType, setCtxEndpointType] = useState<"files">("files");
  const [ctxAutoScroll, setCtxAutoScroll] = useState(true);
  const [ctxScrollSpeed, setCtxScrollSpeed] = useState(5000);
  const [ctxShowIndicators, setCtxShowIndicators] = useState(true);
  const [ctxShowNavButtons, setCtxShowNavButtons] = useState(false);
  const [ctxRenderType, setCtxRenderType] = useState<"carousel" | "grid">("carousel");
  const [ctxFilterGroups, setCtxFilterGroups] = useState<FilterCondition[][]>([createEmptyFilterGroup()]);

  const resetContextForm = () => {
    setCtxNome("");
    setCtxDescrizione("");
    setCtxEndpointType("files");
    setCtxAutoScroll(true);
    setCtxScrollSpeed(5000);
    setCtxShowIndicators(true);
    setCtxShowNavButtons(false);
    setCtxRenderType("carousel");
    setCtxFilterGroups([createEmptyFilterGroup()]);
  };

  const openEditContext = (ctx: DisplayContextResponseDTO) => {
    setEditingContext(ctx);
    setCtxNome(ctx.nome);
    setCtxDescrizione(ctx.descrizione || "");
    setCtxEndpointType(ctx.endpoint_type);
    setCtxAutoScroll(ctx.auto_scroll);
    setCtxScrollSpeed(ctx.scroll_speed);
    setCtxShowIndicators(ctx.show_indicators);
    setCtxShowNavButtons(ctx.show_nav_buttons);
    setCtxRenderType(ctx.render_type || "carousel");
    setCtxFilterGroups(ctx.filters?.length ? ctx.filters : [createEmptyFilterGroup()]);
    setIsCreateContextOpen(true);
  };

  const closeContextDialog = () => {
    setIsCreateContextOpen(false);
    setEditingContext(null);
    resetContextForm();
  };

  const createContextMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateDisplayContextDTO = {
        nome: ctxNome.trim(),
        descrizione: ctxDescrizione.trim() || undefined,
        endpoint_type: ctxEndpointType,
        auto_scroll: ctxAutoScroll,
        scroll_speed: ctxScrollSpeed,
        show_indicators: ctxShowIndicators,
        show_nav_buttons: ctxShowNavButtons,
        render_type: ctxRenderType,
        filters: formatFiltersForApi(ctxFilterGroups) as CreateDisplayContextDTO['filters'],
        id_gdo: puntoVendita.id_gdo,
        id_puntivendita: puntoVendita.id,
      };
      return ServerCall.post<DisplayContextResponseDTO>('/display-contexts', payload);
    },
    onSuccess: () => {
      closeContextDialog();
      queryClient.invalidateQueries({ queryKey: ['display-contexts-pv', puntoVendita.id] });
    },
  });

  const updateContextMutation = useMutation({
    mutationFn: async () => {
      if (!editingContext) return;
      return ServerCall.put<DisplayContextResponseDTO>(`/display-contexts/${editingContext.id}`, {
        nome: ctxNome.trim(),
        descrizione: ctxDescrizione.trim() || undefined,
        endpoint_type: ctxEndpointType,
        auto_scroll: ctxAutoScroll,
        scroll_speed: ctxScrollSpeed,
        show_indicators: ctxShowIndicators,
        show_nav_buttons: ctxShowNavButtons,
        render_type: ctxRenderType,
        filters: formatFiltersForApi(ctxFilterGroups) as CreateDisplayContextDTO['filters'],
      });
    },
    onSuccess: () => {
      closeContextDialog();
      queryClient.invalidateQueries({ queryKey: ['display-contexts-pv', puntoVendita.id] });
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    },
  });

  const deleteContextMutation = useMutation({
    mutationFn: async (id: string) => {
      return ServerCall.delete(`/display-contexts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['display-contexts-pv', puntoVendita.id] });
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    },
  });

  const handleSaveContext = () => {
    if (editingContext) {
      updateContextMutation.mutate();
    } else {
      createContextMutation.mutate();
    }
  };

  // Filter builder helpers
  const addFilterGroup = () => setCtxFilterGroups([...ctxFilterGroups, createEmptyFilterGroup()]);
  const removeFilterGroup = (gi: number) => setCtxFilterGroups(ctxFilterGroups.filter((_, i) => i !== gi));
  const addFilterToGroup = (gi: number) => {
    const updated = [...ctxFilterGroups];
    updated[gi] = [...updated[gi], createEmptyFilterCondition()];
    setCtxFilterGroups(updated);
  };
  const removeFilterFromGroup = (gi: number, fi: number) => {
    const updated = [...ctxFilterGroups];
    updated[gi] = updated[gi].filter((_, i) => i !== fi);
    if (updated[gi].length === 0) updated.splice(gi, 1);
    setCtxFilterGroups(updated.length ? updated : [createEmptyFilterGroup()]);
  };
  const updateFilter = (gi: number, fi: number, key: keyof FilterCondition, value: string) => {
    const updated = ctxFilterGroups.map((g, gIdx) =>
      gIdx === gi ? g.map((f, fIdx) => {
        if (fIdx !== fi) return f;
        // Se cambia il campo, resetta anche il valore
        if (key === 'field') {
          return { ...f, field: value, value: '' };
        }
        return { ...f, [key]: value };
      }) : g
    );
    setCtxFilterGroups(updated);
  };

  // ============================================================
  // ASSEGNAZIONE DISPLAY CONTEXT A DISPOSITIVO
  // ============================================================
  const [assignDeviceId, setAssignDeviceId] = useState<string | null>(null);
  const [selectedContextId, setSelectedContextId] = useState<string>("");

  const assignContextMutation = useMutation({
    mutationFn: async () => {
      if (!assignDeviceId) return;
      return ServerCall.put(`/dispositivi/${assignDeviceId}`, {
        id_display_context: selectedContextId || null,
      });
    },
    onSuccess: () => {
      setAssignDeviceId(null);
      setSelectedContextId("");
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    },
  });

  const openAssignDialog = (device: DispositivoPuntoVenditaResponseDTO) => {
    setAssignDeviceId(device.id);
    setSelectedContextId(device.id_display_context || "");
  };

  const conteggiStato = {
    online: dispositivi.filter((d) => getDeviceStatusValue(d) === "online").length,
    warning: dispositivi.filter((d) => getDeviceStatusValue(d) === "warning").length,
    offline: dispositivi.filter((d) => getDeviceStatusValue(d) === "offline").length,
  };
  const opzioniStato: OpzioneSegmento<DeviceStatus | "all">[] = [
    { valore: "all", etichetta: "Tutti", conteggio: dispositivi.length },
    { valore: "online", etichetta: "Online", conteggio: conteggiStato.online },
    { valore: "warning", etichetta: "Warning", conteggio: conteggiStato.warning },
    { valore: "offline", etichetta: "Offline", conteggio: conteggiStato.offline },
  ];

  return (
    <>
      <Pagina
        titolo={displayName}
        indietro={{ to: "/gestione-interna/punti-vendita", etichetta: "Torna ai punti vendita" }}
      >
        {/* HEADER + AVATAR PUNTO VENDITA: fascia del profilo, il nome è già nell'intestazione */}
        <div className="box box--stacked flex flex-col p-1.5">
          <div className="relative h-48 w-full rounded-card bg-gradient-to-b from-theme-1/95 to-theme-2/95">
            <div
              className={clsx([
                "w-full h-full relative overflow-hidden",
                "before:content-[''] before:absolute before:inset-0 before:bg-texture-white before:-mt-[50rem]",
                "after:content-[''] after:absolute after:inset-0 after:bg-texture-white after:-mt-[50rem]",
              ])}
            ></div>
            <div className="absolute inset-x-0 top-0 mx-auto mt-24 h-32 w-32">
              <div className="box image-fit h-full w-full overflow-hidden rounded-full border-[6px] border-white">
                <img alt={displayName} src={userIcon} />
              </div>
            </div>
          </div>

          {/* INFO PRINCIPALI PUNTO VENDITA */}
          <div className="rounded-card bg-slate-50 pb-6 pt-12">
            <div className="mt-2.5 flex flex-col items-center justify-center gap-x-5 gap-y-2 sm:flex-row">
              {/* Ragione sociale / GDO / tipo */}
              <div className="flex items-center text-slate-500">
                <Lucide icon="Briefcase" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 stroke-[1.3]" />
                <span className="text-sm">{ragionesociale || "Punto vendita"}</span>
              </div>

              {/* Regione / Località */}
              <div className="flex items-center text-slate-500">
                <Lucide icon="MountainSnow" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 stroke-[1.3]" />
                <span className="text-sm">
                  {displayLocationShort || "Località non impostata"}
                </span>
              </div>

              {/* Canale e area */}
              <div className="flex items-center text-slate-500">
                <Lucide icon="Signal" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 stroke-[1.3]" />
                <span className="text-sm">{displayCanaleArea}</span>
              </div>

              {/* Codici del sistema della GDO (es. id ANACAN) */}
              {codici.map(c => (
                <div key={c.etichetta} className="flex items-center text-slate-500">
                  <Lucide icon="Hash" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 stroke-[1.3]" />
                  <span className="text-sm">
                    {c.etichetta}: {c.valore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PAGINA UNICA: contenuto a sinistra, dati del punto vendita a destra */}
        <div className="grid grid-cols-12 gap-6">
          {/* COLONNA SINISTRA */}
          <div className="col-span-12 flex flex-col gap-6 xl:col-span-8">
            <VolantiniAttivi idPv={puntoVendita.id} canaleArea={displayCanaleArea} />

            {/* DISPOSITIVI */}
            <Sezione
              titolo="Gestione dispositivi"
              azioni={
                <Button size="sm" variant="primary" onClick={() => setIsCreateDeviceOpen(true)}>
                  <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Nuovo dispositivo
                </Button>
              }
            >
              <BarraFiltri variante="interna">
                <CampoRicerca
                  etichetta="Cerca dispositivi"
                  placeholder="Cerca device (nome, posizione, pagina...)"
                  value={deviceQuery}
                  onChange={setDeviceQuery}
                />
                <Segmenti etichetta="Stato" opzioni={opzioniStato} valore={statusFilter} onChange={setStatusFilter} />
              </BarraFiltri>

              {/* RIEPILOGO */}
              <StatCardGrid className="mb-5 lg:grid-cols-3">
                <StatCard
                  densita="compatta"
                  etichetta="Online"
                  valore={conteggiStato.online}
                  icona="CircleCheck"
                  tono="success"
                  sottotitolo="Device attivi e con heartbeat recente"
                />
                <StatCard
                  densita="compatta"
                  etichetta="Warning"
                  valore={conteggiStato.warning}
                  icona="TriangleAlert"
                  tono="warning"
                  sottotitolo="Ritardi heartbeat o errori runtime"
                />
                <StatCard
                  densita="compatta"
                  etichetta="Offline"
                  valore={conteggiStato.offline}
                  icona="CircleX"
                  tono="neutral"
                  sottotitolo="Nessun segnale oltre la soglia"
                />
              </StatCardGrid>

              {isLoadingDevices ? (
                <div className="flex justify-center p-8">
                  <Spinner etichetta="Caricamento dispositivi…" />
                </div>
              ) : isErrorDevices ? (
                <PageError
                  compatta
                  titolo="Dispositivi non caricati"
                  motivo={(erroreDevices as Error)?.message || "Errore durante il recupero dei dispositivi"}
                  onRiprova={() => refetchDevices()}
                />
              ) : filteredDevices.length === 0 ? (
                dispositivi.length === 0 ? (
                  <EmptyState
                    compatta
                    icon="MonitorX"
                    title="Nessun dispositivo registrato"
                    description="Aggiungi un nuovo dispositivo per iniziare."
                  />
                ) : (
                  <EmptyState
                    compatta
                    icon="SearchX"
                    title="Nessun dispositivo trovato"
                    description="Modifica i filtri o prova una ricerca diversa."
                    buttonText="Azzera filtri"
                    buttonIcon="X"
                    onButtonClick={() => {
                      setDeviceQuery("");
                      setStatusFilter("all");
                    }}
                  />
                )
              ) : (
                /* DEVICE GRID */
                <div className="grid grid-cols-12 gap-4">
                  {filteredDevices.map((d) => {
                    const status = getDeviceStatusValue(d);
                    const lastSeenLabel = getLastSeenLabel(d);
                    const realtimeStatus = getDeviceStatus(d.id);
                    const isRealtimeConnected = realtimeStatus?.isConnected ?? false;
                    return (
                      <div key={d.id} className="col-span-12 md:col-span-6">
                        <div
                          className={clsx([
                            "rounded-card border border-slate-200 bg-white p-4",
                            statusCardRing(status),
                          ])}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div aria-hidden="true" className="flex h-10 w-10 flex-none items-center justify-center rounded-control border border-slate-200 bg-slate-50">
                                <Lucide icon="Monitor" className="h-5 w-5 stroke-[1.4] text-slate-700" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="title-card truncate">{d.nome}</h3>
                                  {statusBadge(status, isRealtimeConnected)}
                                </div>

                                <div className="mt-1 truncate text-xs text-slate-500">
                                  {d.descrizione || "Nessuna descrizione"} •{" "}
                                  <span className="text-slate-600">{lastSeenLabel}</span>
                                </div>
                              </div>
                            </div>

                            {/* ACTIONS */}
                            <Menu className="inline-block text-left">
                              <Menu.Button
                                as={Button}
                                size="sm"
                                variant="outline-secondary"
                                aria-label={`Azioni dispositivo ${d.nome}`}
                              >
                                <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
                              </Menu.Button>
                              <Menu.Items className="w-56">
                                {d.display_url ? (
                                  <Menu.Item onClick={() => window.open(d.display_url, '_blank')}>
                                    <Lucide icon="Eye" aria-hidden="true" className="mr-2 h-4 w-4" /> Apri preview
                                  </Menu.Item>
                                ) : null}
                                <Menu.Item onClick={() => openAssignDialog(d)}>
                                  <Lucide icon="LayoutDashboard" aria-hidden="true" className="mr-2 h-4 w-4" /> Assegna contesto
                                </Menu.Item>
                                <Menu.Item onClick={() => handleCopyDisplayUrl(d)}>
                                  <Lucide icon="Link" aria-hidden="true" className="mr-2 h-4 w-4" /> Copia URL display
                                </Menu.Item>
                                <Menu.Item onClick={() => handleRegenerateToken(d)}>
                                  <Lucide icon="RotateCw" aria-hidden="true" className="mr-2 h-4 w-4" /> Rigenera token
                                </Menu.Item>
                                <Menu.Item onClick={() => handleToggleActive(d)}>
                                  <Lucide icon={d.is_active ? "Ban" : "CircleCheck"} aria-hidden="true" className="mr-2 h-4 w-4" />
                                  {d.is_active ? "Disattiva" : "Attiva"}
                                </Menu.Item>
                                <Menu.Item className="text-danger" onClick={() => handleDeleteDevice(d)}>
                                  <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" /> Elimina
                                </Menu.Item>
                              </Menu.Items>
                            </Menu>
                          </div>

                          {/* CONTENT STATUS */}
                          <div className="mt-4 flex flex-col gap-2">
                            <div className="flex h-full w-full flex-col gap-3 rounded-card border border-slate-200 bg-slate-50 p-3">
                              {/* Anteprima del contenuto (in cima) */}
                              <div className="rounded-card border border-slate-200 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                                  <span className="font-medium text-slate-700">
                                    {isRealtimeConnected ? "Monitoraggio live" : "Anteprima contenuto"}
                                  </span>
                                  {isRealtimeConnected &&
                                    realtimeStatus?.currentSlideIndex != null &&
                                    realtimeStatus?.totalSlides != null && (
                                      <span className="font-medium tabular-nums text-slate-700">
                                        {realtimeStatus.currentSlideIndex + 1} / {realtimeStatus.totalSlides}
                                      </span>
                                    )}
                                </div>

                                {isRealtimeConnected && realtimeStatus?.slideUrl ? (
                                  <div className="relative aspect-video w-full overflow-hidden rounded-control border border-slate-200 bg-white">
                                    <img
                                      key={realtimeStatus.slideUrl}
                                      src={realtimeStatus.slideUrl}
                                      alt={realtimeStatus.slideName || "Slide corrente"}
                                      className="absolute inset-0 h-full w-full object-contain"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                      }}
                                    />

                                    {/* fallback */}
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                                      Anteprima non disponibile
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex h-28 items-center justify-center rounded-control border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                                    Nessun dato live disponibile
                                  </div>
                                )}

                                {realtimeStatus?.slideName && (
                                  <div
                                    className="mt-1 truncate text-xs text-slate-500"
                                    title={realtimeStatus.slideName}
                                  >
                                    {realtimeStatus.slideName}
                                  </div>
                                )}
                              </div>

                              {/* Impostazioni / stato del playback */}
                              <div className="rounded-card border border-slate-200 bg-white p-3">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span className="font-medium text-slate-700">
                                    {isRealtimeConnected ? "Playback attivo" : "Impostazioni playback"}
                                  </span>
                                  <span className="text-slate-600">
                                    {d.displayContext?.auto_scroll ? "Auto-scroll" : "Manuale"}
                                    {d.displayContext?.scroll_speed
                                      ? ` • ${(d.displayContext.scroll_speed / 1000).toFixed(0)}s`
                                      : ""}
                                  </span>
                                </div>

                                <div className="mt-2 text-sm font-medium text-slate-800">
                                  {d.displayContext?.scroll_speed
                                    ? `${(d.displayContext.scroll_speed / 1000).toFixed(0)}s per slide`
                                    : "—"}
                                </div>
                              </div>

                              {/* Stato della connessione / ping */}
                              <div className="rounded-card border border-slate-200 bg-white p-3">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  {isRealtimeConnected ? (
                                    <span className="flex items-center gap-1">
                                      <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75"></span>
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
                                      </span>
                                      Ping
                                    </span>
                                  ) : (
                                    <span>Heartbeat</span>
                                  )}

                                  <span className="font-medium tabular-nums text-slate-700">
                                    {isRealtimeConnected
                                      ? realtimeStatus?.latencyMs != null
                                        ? `${realtimeStatus.latencyMs}ms`
                                        : "—"
                                      : lastSeenLabel}
                                  </span>
                                </div>

                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={clsx([
                                      "h-full rounded-full transition-all duration-300",
                                      isRealtimeConnected
                                        ? "bg-success"
                                        : status === "online"
                                          ? "bg-success"
                                          : status === "warning"
                                            ? "bg-warning"
                                            : "bg-danger",
                                    ])}
                                    style={{
                                      width: isRealtimeConnected
                                        ? "100%"
                                        : status === "online"
                                          ? "82%"
                                          : status === "warning"
                                            ? "48%"
                                            : "12%",
                                    }}
                                  />
                                </div>

                                {!isRealtimeConnected && (
                                  <div className="mt-1 text-right text-2xs text-slate-400">
                                    Ultimo segnale: {lastSeenLabel}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="rounded-card border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs text-slate-500">Display Context</div>
                              <div className="mt-1 truncate text-sm font-medium text-slate-800">
                                {d.displayContext?.nome || "Nessun context assegnato"}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Endpoint:{" "}
                                <span className="font-medium text-slate-700">
                                  {d.displayContext?.endpoint_type || "—"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* AVVISO: dispositivo disattivato o senza contesto */}
                          {!d.is_active ? (
                            <Alert variant="soft-danger" icona="CircleX" className="mt-3 px-3 py-2 text-xs">
                              <span className="font-medium">Dispositivo disattivato</span>
                            </Alert>
                          ) : !d.displayContext ? (
                            <Alert variant="soft-warning" icona="TriangleAlert" className="mt-3 px-3 py-2 text-xs">
                              <span className="font-medium">Nessun display context assegnato</span>
                            </Alert>
                          ) : null}

                          {/* FOOTER CTA */}
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => handleCopyDisplayUrl(d)}
                            >
                              <Lucide icon="Link" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                              Copia link display
                            </Button>

                            <div className="text-xs text-slate-400 sm:ml-auto">
                              ID: <span className="text-slate-500">{d.id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Sezione>

            {/* DISPLAY CONTEXTS */}
            <Sezione
              titolo="Display Contexts"
              azioni={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => { resetContextForm(); setIsCreateContextOpen(true); }}
                >
                  <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Nuovo contesto
                </Button>
              }
            >
              {isLoadingContexts ? (
                <div className="flex justify-center p-8">
                  <Spinner etichetta="Caricamento contesti…" />
                </div>
              ) : isErrorContexts ? (
                <PageError
                  compatta
                  titolo="Contesti non caricati"
                  motivo={(erroreContexts as Error)?.message || "Errore durante il recupero dei contesti"}
                  onRiprova={() => refetchContexts()}
                />
              ) : displayContexts.length === 0 ? (
                <EmptyState
                  compatta
                  icon="LayoutDashboard"
                  title="Nessun display context"
                  description="Crea un contesto per configurare cosa mostrare sui display."
                />
              ) : (
                <div className="grid grid-cols-12 gap-4">
                  {displayContexts.map((ctx) => (
                    <div key={ctx.id} className="col-span-12 md:col-span-6">
                      <div className="rounded-card border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="title-card truncate">{ctx.nome}</h3>
                              <StatusBadge
                                tono={ctx.is_active ? "success" : "neutral"}
                                etichetta={ctx.is_active ? "Attivo" : "Inattivo"}
                              />
                            </div>
                            {ctx.descrizione && (
                              <div className="mt-1 truncate text-xs text-slate-500">{ctx.descrizione}</div>
                            )}
                          </div>
                          <Menu className="inline-block text-left">
                            <Menu.Button
                              as={Button}
                              size="sm"
                              variant="outline-secondary"
                              aria-label={`Azioni contesto ${ctx.nome}`}
                            >
                              <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
                            </Menu.Button>
                            <Menu.Items className="w-48">
                              <Menu.Item onClick={() => openEditContext(ctx)}>
                                <Lucide icon="Pencil" aria-hidden="true" className="mr-2 h-4 w-4" /> Modifica
                              </Menu.Item>
                              <Menu.Item
                                className="text-danger"
                                onClick={() => setConferma({
                                  title: "Eliminare il contesto?",
                                  description: `Il contesto "${ctx.nome}" verrà eliminato e i dispositivi che lo usano resteranno senza contesto assegnato.`,
                                  confirmLabel: "Elimina contesto",
                                  azione: () => deleteContextMutation.mutateAsync(ctx.id),
                                })}
                              >
                                <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" /> Elimina
                              </Menu.Item>
                            </Menu.Items>
                          </Menu>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-control border border-slate-200 bg-slate-50 p-2">
                            <div className="text-xs text-slate-500">Endpoint</div>
                            <div className="mt-0.5 text-sm font-medium text-slate-800">{ctx.endpoint_type}</div>
                          </div>
                          <div className="rounded-control border border-slate-200 bg-slate-50 p-2">
                            <div className="text-xs text-slate-500">Render</div>
                            <div className="mt-0.5 text-sm font-medium text-slate-800">{ctx.render_type || "carousel"}</div>
                          </div>
                          <div className="rounded-control border border-slate-200 bg-slate-50 p-2">
                            <div className="text-xs text-slate-500">Filtri</div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums text-slate-800">
                              {ctx.filters?.flat().length || 0}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                          <Lucide icon="Monitor" aria-hidden="true" className="h-3.5 w-3.5" />
                          <span>{ctx.dispositivi_count ?? 0} dispositivi collegati</span>
                          {ctx.auto_scroll && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span>{(ctx.scroll_speed / 1000).toFixed(0)}s / slide</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Sezione>
          </div>

          {/* SIDEBAR DESTRA: su mobile viene prima del contenuto */}
          <div className="col-span-12 row-start-1 xl:col-span-4 xl:col-start-9">
            <div className="sticky top-24 flex flex-col gap-6">
              <Sezione titolo="Dati punto vendita">
                <div className="flex flex-col gap-8">
                  {/* MAPPA */}
                  {posizione ? (
                    <div className="relative h-56 w-full overflow-hidden rounded-control">
                      <MapContainer
                        center={posizione}
                        zoom={mapZoom}
                        preferCanvas
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                        keyboard={false}
                        zoomControl={false}
                        className="absolute inset-0"
                      >
                        <Marker position={posizione} icon={storeMarker} />
                        <TileLayer
                          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          maxZoom={19}
                        />
                      </MapContainer>
                    </div>
                  ) : (
                    <EmptyState compatta icon="MapPin" title="Coordinate non disponibili" description="" />
                  )}

                  {/* DATI GENERALI */}
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-center">
                      <Lucide icon="Briefcase" aria-hidden="true" className="mr-2 h-4 w-4 stroke-[1.3] text-slate-500" />
                      <span className="text-sm">
                        Ragione Sociale:
                        <span className="ml-1 font-medium">
                          {ragionesociale || "Non specificata"}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center">
                      <Lucide icon="MapPin" aria-hidden="true" className="mr-2 h-4 w-4 stroke-[1.3] text-slate-500" />
                      <span className="text-sm">
                        Indirizzo:
                        <span className="ml-1 font-medium">
                          {displayIndirizzoCompleto || "Indirizzo non disponibile"}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center">
                      <Lucide icon="Signal" aria-hidden="true" className="mr-2 h-4 w-4 stroke-[1.3] text-slate-500" />
                      <span className="text-sm">
                        Canale / Area:
                        <span className="ml-1 font-medium">{displayCanaleArea}</span>
                      </span>
                    </div>
                  </div>

                  {/* DATI DEL SISTEMA DELLA GDO */}
                  {codici.length > 0 && (
                    <div>
                      <h3 className="title-eyebrow">Dati GDO</h3>
                      <div className="mt-3 flex flex-col gap-2">
                        {codici.map(c => (
                          <div key={c.etichetta} className="flex items-center">
                            <Lucide icon="Hash" aria-hidden="true" className="mr-2 h-4 w-4 stroke-[1.3] text-slate-500" />
                            <span className="text-sm">
                              {c.etichetta}:
                              <span className="ml-1 font-medium">{c.valore}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RECAPITI */}
                  <div>
                    <h3 className="title-eyebrow">Recapiti</h3>

                    <div className="mt-3">
                      <div className="flex items-center">
                        <Lucide icon="Phone" aria-hidden="true" className="mr-2 h-4 w-4 stroke-[1.3] text-slate-500" />
                        <span className="text-sm">
                          Recapito Telefonico:
                          {telefono ? (
                            <a
                              href={`tel:${telefono}`}
                              className="ml-1 text-primary underline decoration-primary/30 decoration-dotted underline-offset-2"
                            >
                              {telefono}
                            </a>
                          ) : (
                            <span className="ml-1 text-slate-500">Non disponibile</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* STATISTICHE */}
                  <div className="flex items-center">
                    <Lucide icon="Users" aria-hidden="true" className="mr-2 h-4 w-4 stroke-[1.3] text-slate-500" />
                    <span className="mr-1 text-sm">Dipendenti collegati:</span>
                    <StatusBadge tono="success" etichetta={`${numero_utenti_collegati} dipendenti`} />
                  </div>
                </div>
              </Sezione>
            </div>
          </div>
        </div>
      </Pagina>

      {/* DIALOG: Creazione dispositivo */}
      <Dialog open={isCreateDeviceOpen} onClose={closeCreateDialog}>
        <Dialog.Panel>
          <Dialog.Title>Nuovo dispositivo</Dialog.Title>
          <Dialog.Description className="grid grid-cols-12 gap-4 gap-y-3">
            <div className="col-span-12">
              <FormLabel htmlFor="device-name">Nome dispositivo *</FormLabel>
              <FormInput
                id="device-name"
                type="text"
                placeholder="Es. TV - Ingresso"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>
            <div className="col-span-12">
              <FormLabel htmlFor="device-desc">Descrizione</FormLabel>
              <FormInput
                id="device-desc"
                type="text"
                placeholder="Es. Schermo ingresso principale"
                value={newDeviceDescription}
                onChange={(e) => setNewDeviceDescription(e.target.value)}
              />
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={closeCreateDialog}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!newDeviceName.trim()}
              loading={createDeviceMutation.isPending}
              onClick={() => createDeviceMutation.mutate()}
            >
              Crea
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* DIALOG: Successo creazione - mostra token */}
      <Dialog open={!!createdDevice} onClose={closeSuccessDialog}>
        <Dialog.Panel>
          <Dialog.Title>Dispositivo creato</Dialog.Title>
          <Dialog.Description className="flex flex-col gap-4">
            <Alert variant="soft-success" icona="CircleCheck">
              <span className="font-medium">
                &quot;{createdDevice?.nome}&quot; creato con successo
              </span>
            </Alert>

            <div className="rounded-card border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500 mb-1">Token display</div>
              <div className="text-sm font-mono text-slate-900 break-all">
                {createdDevice?.token_display}
              </div>
            </div>

            <div className="rounded-card border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500 mb-1">URL display</div>
              <div className="text-sm font-mono text-slate-900 break-all">
                {createdDevice?.display_url}
              </div>
              <Button
                size="sm"
                variant="outline-secondary"
                className="mt-2"
                onClick={() => {
                  if (createdDevice?.display_url) {
                    navigator.clipboard.writeText(createdDevice.display_url);
                  }
                }}
              >
                <Lucide icon="Copy" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Copia URL
              </Button>
            </div>

            <Alert variant="soft-warning" icona="TriangleAlert" className="px-3 py-2 text-xs">
              Salva il token e l&apos;URL: il token non sarà più visibile dopo la chiusura.
            </Alert>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="primary"
              type="button"
              onClick={closeSuccessDialog}
            >
              Chiudi
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* DIALOG: Creazione / Modifica Display Context */}
      <Dialog open={isCreateContextOpen} onClose={closeContextDialog} size="xl">
        <Dialog.Panel>
          <Dialog.Title>{editingContext ? "Modifica contesto" : "Nuovo display context"}</Dialog.Title>
          <Dialog.Description className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
            {/* INFO BASE */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="ctx-nome">Nome *</FormLabel>
                <FormInput
                  id="ctx-nome"
                  type="text"
                  placeholder="Es. Volantino Ingresso"
                  value={ctxNome}
                  onChange={(e) => setCtxNome(e.target.value)}
                />
              </div>
              <div className="col-span-12 sm:col-span-6">
                <FormLabel htmlFor="ctx-endpoint">Tipo endpoint *</FormLabel>
                <FormSelect
                  id="ctx-endpoint"
                  value={ctxEndpointType}
                  onChange={(e) => setCtxEndpointType(e.target.value as "files")}
                >
                  <option value="files">Files (PDF / immagini)</option>
                </FormSelect>
              </div>
              <div className="col-span-12">
                <FormLabel htmlFor="ctx-desc">Descrizione</FormLabel>
                <FormInput
                  id="ctx-desc"
                  type="text"
                  placeholder="Descrizione opzionale"
                  value={ctxDescrizione}
                  onChange={(e) => setCtxDescrizione(e.target.value)}
                />
              </div>
            </div>

            {/* OPZIONI DISPLAY */}
            <div>
              <h3 className="title-card mb-3">Opzioni display</h3>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 sm:col-span-3">
                  <FormLabel htmlFor="ctx-render">Render</FormLabel>
                  <FormSelect
                    id="ctx-render"
                    value={ctxRenderType}
                    onChange={(e) => setCtxRenderType(e.target.value as "carousel" | "grid")}
                  >
                    <option value="carousel">Carousel</option>
                    <option value="grid">Grid</option>
                  </FormSelect>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <FormLabel htmlFor="ctx-speed">Velocita (ms)</FormLabel>
                  <FormInput
                    id="ctx-speed"
                    type="number"
                    min={1000}
                    max={60000}
                    step={500}
                    value={ctxScrollSpeed}
                    onChange={(e) => setCtxScrollSpeed(Number(e.target.value))}
                  />
                </div>
                <div className="col-span-12 sm:col-span-6 flex items-end gap-5 pb-1">
                  <FormCheck>
                    <FormCheck.Input
                      id="ctx-autoscroll"
                      type="checkbox"
                      checked={ctxAutoScroll}
                      onChange={(e) => setCtxAutoScroll(e.target.checked)}
                    />
                    <FormCheck.Label htmlFor="ctx-autoscroll">Auto-scroll</FormCheck.Label>
                  </FormCheck>
                  <FormCheck>
                    <FormCheck.Input
                      id="ctx-indicators"
                      type="checkbox"
                      checked={ctxShowIndicators}
                      onChange={(e) => setCtxShowIndicators(e.target.checked)}
                    />
                    <FormCheck.Label htmlFor="ctx-indicators">Indicatori</FormCheck.Label>
                  </FormCheck>
                  <FormCheck>
                    <FormCheck.Input
                      id="ctx-navbuttons"
                      type="checkbox"
                      checked={ctxShowNavButtons}
                      onChange={(e) => setCtxShowNavButtons(e.target.checked)}
                    />
                    <FormCheck.Label htmlFor="ctx-navbuttons">Pulsanti nav</FormCheck.Label>
                  </FormCheck>
                </div>
              </div>
            </div>

            {/* FILTRI */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="title-card">Filtri contenuto</h3>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={addFilterGroup}
                >
                  <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Gruppo OR
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                {ctxFilterGroups.map((group, gi) => (
                  <div key={gi} className="rounded-card border border-slate-200 bg-slate-50 p-3">
                    {gi > 0 && (
                      <div className="flex items-center justify-center mb-2">
                        <Badge variant="warning" size="sm" border>
                          OR
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">
                        Gruppo {gi + 1} (condizioni AND)
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => addFilterToGroup(gi)}
                        >
                          <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                          Condizione
                        </Button>
                        {ctxFilterGroups.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => removeFilterGroup(gi)}
                            aria-label={`Rimuovi gruppo ${gi + 1}`}
                          >
                            <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {group.map((filter, fi) => (
                        <div key={fi} className="grid grid-cols-12 gap-2 items-center">
                          {fi > 0 && (
                            <div className="col-span-12 flex justify-center">
                              <span className="text-xs font-medium text-info">AND</span>
                            </div>
                          )}
                          <div className="col-span-4">
                            <FormSelect
                              value={filter.field}
                              onChange={(e) => updateFilter(gi, fi, 'field', e.target.value)}
                            >
                              <option value="">Seleziona campo</option>
                              {fileFieldOptions.map((field, i) => (
                                <option key={i} value={field.value}>{field.label}</option>
                              ))}
                            </FormSelect>
                          </div>
                          <div className="col-span-3">
                            <FormSelect
                              value={filter.operator}
                              onChange={(e) => updateFilter(gi, fi, 'operator', e.target.value)}
                            >
                              {operatorOptions.map((op) => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </FormSelect>
                          </div>
                          <div className="col-span-4">
                            <ContextFilterValueInput
                              field={filter.field}
                              value={filter.value}
                              onChange={(val) => updateFilter(gi, fi, 'value', val)}
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              className="text-danger hover:text-danger/80"
                              onClick={() => removeFilterFromGroup(gi, fi)}
                              aria-label="Rimuovi condizione"
                            >
                              <Lucide icon="X" aria-hidden="true" className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={closeContextDialog}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={!ctxNome.trim()}
              loading={createContextMutation.isPending || updateContextMutation.isPending}
              onClick={handleSaveContext}
            >
              {editingContext ? "Salva modifiche" : "Crea contesto"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* DIALOG: Assegna Display Context a Dispositivo */}
      <Dialog open={!!assignDeviceId} onClose={() => { setAssignDeviceId(null); setSelectedContextId(""); }}>
        <Dialog.Panel>
          <Dialog.Title>Assegna display context</Dialog.Title>
          <Dialog.Description className="flex flex-col gap-4">
            <div>
              <FormLabel htmlFor="assign-ctx">Seleziona contesto</FormLabel>
              <FormSelect
                id="assign-ctx"
                value={selectedContextId}
                onChange={(e) => setSelectedContextId(e.target.value)}
              >
                <option value="">Nessun contesto</option>
                {displayContexts.filter((c) => c.is_active).map((ctx) => (
                  <option key={ctx.id} value={ctx.id}>
                    {ctx.nome} ({ctx.endpoint_type})
                  </option>
                ))}
              </FormSelect>
            </div>

            {selectedContextId && (() => {
              const sel = displayContexts.find((c) => c.id === selectedContextId);
              if (!sel) return null;
              return (
                <div className="rounded-card border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500 mb-1">Preview contesto</div>
                  <div className="text-sm font-medium text-slate-900">{sel.nome}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Endpoint: <span className="font-medium text-slate-700">{sel.endpoint_type}</span>
                    {" | "}Filtri: <span className="font-medium text-slate-700">{sel.filters?.flat().length || 0}</span>
                    {" | "}Render: <span className="font-medium text-slate-700">{sel.render_type || "carousel"}</span>
                  </div>
                </div>
              );
            })()}
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              onClick={() => { setAssignDeviceId(null); setSelectedContextId(""); }}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              loading={assignContextMutation.isPending}
              onClick={() => assignContextMutation.mutate()}
            >
              Assegna
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <ConfirmDialog
        open={!!conferma}
        title={conferma?.title ?? ""}
        description={conferma?.description ?? ""}
        confirmLabel={conferma?.confirmLabel}
        loading={confermaLoading}
        onClose={() => !confermaLoading && setConferma(null)}
        onConfirm={eseguiConferma}
      />
    </>
  );
};

export default withSessionCheck(GestionePuntoVendita);
