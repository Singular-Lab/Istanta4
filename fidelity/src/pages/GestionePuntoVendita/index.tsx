import userIcon from "@/assets/images/users/user_icon_profile.png";
import Button from "@/components/Base/Button";
import withSessionCheck from "@/components/SessionChecker";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
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
import { operatorOptions } from "../../pages/GestioneApi/constants";
import type { FilterCondition } from "../../pages/GestioneApi/types";
import { createEmptyFilterCondition, createEmptyFilterGroup, formatFiltersForApi } from "../../pages/GestioneApi/utils/filterHelpers";
import { useFetchDisplayContextsByPuntoVendita, useFetchDispositiviPuntoVendita, useFetchFilesFieldValues, useFetchFilesMetadataFields } from "../../query/query";

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
    indirizzo,
    indirizzo_completo,
    citta,
    provincia,
    regione,
    cap,
    ragionesociale,
    telefono,
    sigla_combinazione,
    has_coordinate,
    coordinate,
    numero_utenti_collegati,
  } = puntoVendita;

  const displayName = nome_display || nome;

  const displayIndirizzoCompleto =
    indirizzo_completo ||
    [
      indirizzo,
      cap && citta ? `${cap} ${citta}` : citta || cap,
      provincia ? `(${provincia})` : "",
      regione,
    ]
      .filter(Boolean)
      .join(" - ");

  const displayLocationShort = [citta, provincia, regione].filter(Boolean).join(", ");

  const parseCoordinate = (value?: number | string | null) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const lat = parseCoordinate(coordinate?.lat);
  const lon = parseCoordinate(coordinate?.lon);

  const mapCenter: [number, number] =
    lat !== null && lon !== null ? [lat, lon] : [41.8719, 12.5674];

  const mapZoom = 21;

  const formatCoordinateValue = (value?: number | string) => {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue.toFixed(4);
    }
    return "N/D";
  };

  // ============================================================
  // DISPOSITIVI - DATI REALI DA API
  // ============================================================
  type DeviceStatus = "online" | "offline" | "warning";

  const queryClient = useQueryClient();
  const { data: dispositivi = [], isLoading: isLoadingDevices } = useFetchDispositiviPuntoVendita(puntoVendita.id);

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
    if (status === "online") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 border border-success/20 text-success">
          {isRealtimeConnected ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
          )}
          {isRealtimeConnected ? "Live" : "Online"}
        </span>
      );
    }
    if (status === "warning") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-warning/10 border border-warning/20 text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Warning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-danger/10 border border-danger/20 text-danger">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        Offline
      </span>
    );
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

  const handleDeleteDevice = useCallback(async (device: DispositivoPuntoVenditaResponseDTO) => {
    if (!confirm(`Eliminare il dispositivo "${device.nome}"?`)) return;
    try {
      await ServerCall.delete(`/dispositivi/${device.id}`);
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    } catch (error) {
      console.error("Errore nell'eliminazione del dispositivo:", error);
    }
  }, [puntoVendita.id, queryClient]);

  const handleRegenerateToken = useCallback(async (device: DispositivoPuntoVenditaResponseDTO) => {
    if (!confirm(`Rigenerare il token per "${device.nome}"? Il vecchio URL non funzionerà più.`)) return;
    try {
      await ServerCall.post(`/dispositivi/${device.id}/regenerate-token`, {});
      queryClient.invalidateQueries({ queryKey: ['dispositivi-pv', puntoVendita.id] });
    } catch (error) {
      console.error("Errore nella rigenerazione del token:", error);
    }
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
  const { data: displayContexts = [], isLoading: isLoadingContexts } = useFetchDisplayContextsByPuntoVendita(puntoVendita.id);
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

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* HEADER + AVATAR PUNTO VENDITA */}
        <div className="p-1.5 box flex flex-col box--stacked">
          <div className="h-48 relative w-full rounded-[0.6rem] bg-gradient-to-b from-theme-1/95 to-theme-2/95">
            <div
              className={clsx([
                "w-full h-full relative overflow-hidden",
                "before:content-[''] before:absolute before:inset-0 before:bg-texture-white before:-mt-[50rem]",
                "after:content-[''] after:absolute after:inset-0 after:bg-texture-white after:-mt-[50rem]",
              ])}
            ></div>
            <div className="absolute inset-x-0 top-0 w-32 h-32 mx-auto mt-24">
              <div className="w-full h-full overflow-hidden border-[6px] box border-white rounded-full image-fit">
                <img alt={displayName} src={userIcon} />
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 mb-2.5 mr-2.5 border-2 border-white rounded-full bg-success box"></div>
            </div>
          </div>

          {/* INFO PRINCIPALI PUNTO VENDITA */}
          <div className="rounded-[0.6rem] bg-slate-50 pt-12 pb-6">
            <div className="flex items-center justify-center text-xl font-medium">
              {displayName}
              <Lucide
                icon="BadgeCheck"
                className="w-5 h-5 ml-2 text-blue-500 fill-blue-500/30"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-y-2 gap-x-5 mt-2.5">
              {/* Ragione sociale / GDO / tipo */}
              <div className="flex items-center text-slate-500">
                <Lucide icon="Briefcase" className="w-3.5 h-3.5 mr-1.5 stroke-[1.3]" />
                <span className="text-[0.85rem]">{ragionesociale || "Punto vendita"}</span>
              </div>

              {/* Regione / Località */}
              <div className="flex items-center text-slate-500">
                <Lucide
                  icon="MountainSnow"
                  className="w-3.5 h-3.5 mr-1.5 stroke-[1.3]"
                />
                <span className="text-[0.85rem]">
                  {displayLocationShort || "Località non impostata"}
                </span>
              </div>

              {/* Sigla combinazione / coordinate */}
              <div className="flex items-center text-slate-500">
                <Lucide icon="Signal" className="w-3.5 h-3.5 mr-1.5 stroke-[1.3]" />
                <span className="text-[0.85rem]">
                  {sigla_combinazione
                    ? `Combinazione: ${sigla_combinazione}`
                    : has_coordinate && coordinate
                      ? `Lat: ${formatCoordinateValue(coordinate?.lat)}, Lon: ${formatCoordinateValue(
                        coordinate?.lon
                      )}`
                      : "Configurazione non impostata"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        {/* HEADER ACTIONS (ex area tab) */}
        <div className="mt-10 flex flex-col 2xl:items-center 2xl:flex-row gap-y-3">
          <div className="mr-auto" />
        </div>

        {/* PAGINA UNICA (ex Tab Profile) */}
        <div className="mt-3.5 grid grid-cols-12 gap-y-7 gap-x-6">
          {/* COLONNA SINISTRA */}
          <div className="col-span-12 xl:col-span-8">
            <div className="flex flex-col gap-y-7">
              {/* Activity Feed */}
              <div className="flex flex-col h-full p-5 box box--stacked">
                <div className="pb-5 mb-5 border-b border-dashed border-slate-300/70">
                  <h2>Gestione dispositivi</h2>
                </div>

                {/* ============================================================
                    MOCKUP UI DISPOSITIVI (SOLO STILE + COMPONENTI VISIVI)
                    ============================================================ */}
                <div className="flex flex-col gap-5">
                  {/* TOOLBAR */}
                  <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-3">
                    <div className="flex-1">
                      <div className="relative">
                        <Lucide
                          icon="Search"
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 stroke-[1.4] text-slate-500"
                        />
                        <FormInput
                          value={deviceQuery}
                          onChange={(e) => setDeviceQuery(e.target.value)}
                          placeholder="Cerca device (nome, posizione, pagina...)"
                          className="pl-10 py-3 rounded-[0.7rem] bg-white"
                          type="text"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* FILTER */}
                      <Menu>
                        <Menu.Button
                          as={Button}
                          variant="secondary"
                          className="rounded-[0.7rem] bg-white py-3"
                        >
                          <Lucide icon="Filter" className="stroke-[1.3] w-4 h-4 mr-2" />
                          Stato
                          <Lucide
                            icon="ChevronDown"
                            className="stroke-[1.3] w-4 h-4 ml-2"
                          />
                        </Menu.Button>
                        <Menu.Items className="w-52">
                          <Menu.Item onClick={() => setStatusFilter("all")}>
                            <Lucide icon="CircleDashed" className="w-4 h-4 mr-2" />
                            Tutti
                          </Menu.Item>
                          <Menu.Item onClick={() => setStatusFilter("online")}>
                            <Lucide icon="CircleCheck" className="w-4 h-4 mr-2" />
                            Online
                          </Menu.Item>
                          <Menu.Item onClick={() => setStatusFilter("warning")}>
                            <Lucide icon="TriangleAlert" className="w-4 h-4 mr-2" />
                            Warning
                          </Menu.Item>
                          <Menu.Item onClick={() => setStatusFilter("offline")}>
                            <Lucide icon="CircleX" className="w-4 h-4 mr-2" />
                            Offline
                          </Menu.Item>
                        </Menu.Items>
                      </Menu>

                      {/* PRIMARY ACTION */}
                      <Button
                        variant="primary"
                        className="rounded-[0.7rem] py-3"
                        onClick={() => setIsCreateDeviceOpen(true)}
                      >
                        <Lucide icon="Plus" className="stroke-[1.3] w-4 h-4 mr-2" />
                        Nuovo dispositivo
                      </Button>
                    </div>
                  </div>

                  {/* SUMMARY CARDS */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-4">
                      <div className="p-4 rounded-[0.9rem] bg-gradient-to-b from-slate-50 to-white border border-slate-200/70">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-500">Online</div>
                          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">
                          {dispositivi.filter((d) => getDeviceStatusValue(d) === "online").length}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Device attivi e con heartbeat recente
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <div className="p-4 rounded-[0.9rem] bg-gradient-to-b from-slate-50 to-white border border-slate-200/70">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-500">Warning</div>
                          <Lucide icon="TriangleAlert" className="w-4 h-4 text-warning" />
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">
                          {dispositivi.filter((d) => getDeviceStatusValue(d) === "warning").length}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Ritardi heartbeat o errori runtime
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <div className="p-4 rounded-[0.9rem] bg-gradient-to-b from-slate-50 to-white border border-slate-200/70">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-500">Offline</div>
                          <Lucide icon="CircleX" className="w-4 h-4 text-danger" />
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">
                          {dispositivi.filter((d) => getDeviceStatusValue(d) === "offline").length}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Nessun segnale oltre la soglia
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LOADING STATE */}
                  {isLoadingDevices ? (
                    <div className="p-8 text-center">
                      <div className="text-sm text-slate-500">Caricamento dispositivi...</div>
                    </div>
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
                                "p-4 rounded-[0.9rem] bg-white border border-slate-200/70",
                                "shadow-sm hover:shadow-md transition-shadow",
                                statusCardRing(status),
                              ])}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div
                                    className={clsx([
                                      "h-10 w-10 rounded-[0.9rem] flex items-center justify-center",
                                      "bg-slate-50 border border-slate-200/70",
                                    ])}
                                  >
                                    <Lucide
                                      icon="Monitor"
                                      className="w-5 h-5 stroke-[1.4] text-slate-700"
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div className="font-medium text-slate-900 truncate">
                                        {d.nome}
                                      </div>
                                      {statusBadge(status, isRealtimeConnected)}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-500 truncate">
                                      {d.descrizione || "Nessuna descrizione"} •{" "}
                                      <span className="text-slate-600">{lastSeenLabel}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* ACTIONS */}
                                <Menu>
                                  <Menu.Button
                                    as={Button}
                                    variant="secondary"
                                    className="rounded-[0.7rem] bg-white py-2 px-2"
                                  >
                                    <Lucide icon="EllipsisVertical" className="w-4 h-4" />
                                  </Menu.Button>
                                  <Menu.Items className="w-56">
                                    {d.display_url ? (
                                      <Menu.Item onClick={() => window.open(d.display_url, '_blank')}>
                                        <Lucide icon="Eye" className="w-4 h-4 mr-2" /> Apri preview
                                      </Menu.Item>
                                    ) : null}
                                    <Menu.Item onClick={() => openAssignDialog(d)}>
                                      <Lucide icon="LayoutDashboard" className="w-4 h-4 mr-2" /> Assegna contesto
                                    </Menu.Item>
                                    <Menu.Item onClick={() => handleCopyDisplayUrl(d)}>
                                      <Lucide icon="Link" className="w-4 h-4 mr-2" /> Copia URL display
                                    </Menu.Item>
                                    <Menu.Item onClick={() => handleRegenerateToken(d)}>
                                      <Lucide icon="RotateCw" className="w-4 h-4 mr-2" /> Rigenera token
                                    </Menu.Item>
                                    <Menu.Item onClick={() => handleToggleActive(d)}>
                                      <Lucide icon={d.is_active ? "Ban" : "CircleCheck"} className="w-4 h-4 mr-2" />
                                      {d.is_active ? "Disattiva" : "Attiva"}
                                    </Menu.Item>
                                    <Menu.Item className="text-danger" onClick={() => handleDeleteDevice(d)}>
                                      <Lucide icon="Trash2" className="w-4 h-4 mr-2" /> Elimina
                                    </Menu.Item>
                                  </Menu.Items>
                                </Menu>
                              </div>

                              {/* CONTENT STATUS */}
                              <div className="mt-4 grid grid-cols-12 gap-3">
                                <div className="col-span-12 sm:col-span-12">
                                  <div className="col-span-12 sm:col-span-12">
                                    <div className="p-3 w-full rounded-[0.8rem] bg-slate-50 border border-slate-200/70 h-full flex flex-col gap-3">

                                      {/* =========================
        CARD PREVIEW IMMAGINE (IN CIMA)
       ========================= */}
                                      <div className="p-3 rounded-[0.8rem] bg-white border border-slate-200/70">
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                          <span className="font-medium text-slate-700">
                                            {isRealtimeConnected ? "Monitoraggio live" : "Anteprima contenuto"}
                                          </span>
                                          {isRealtimeConnected &&
                                            realtimeStatus?.currentSlideIndex != null &&
                                            realtimeStatus?.totalSlides != null && (
                                              <span className="text-slate-700 font-medium">
                                                {realtimeStatus.currentSlideIndex + 1} / {realtimeStatus.totalSlides}
                                              </span>
                                            )}
                                        </div>

                                        {isRealtimeConnected && realtimeStatus?.slideUrl ? (
                                          <div className="relative w-full aspect-video rounded-md overflow-hidden border border-slate-200 bg-white">
                                            <img
                                              key={realtimeStatus.slideUrl}
                                              src={realtimeStatus.slideUrl}
                                              alt={realtimeStatus.slideName || "Slide corrente"}
                                              className="absolute inset-0 w-full h-full object-contain"
                                              loading="lazy"
                                              onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                              }}
                                            />

                                            {/* fallback */}
                                            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 pointer-events-none">
                                              Anteprima non disponibile
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center h-[120px] rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
                                            Nessun dato live disponibile
                                          </div>
                                        )}

                                        {realtimeStatus?.slideName && (
                                          <div
                                            className="mt-1 text-xs text-slate-500 truncate"
                                            title={realtimeStatus.slideName}
                                          >
                                            {realtimeStatus.slideName}
                                          </div>
                                        )}
                                      </div>

                                      {/* =========================
        CARD IMPOSTAZIONI / STATO PLAYBACK
       ========================= */}
                                      <div className="p-3 rounded-[0.8rem] bg-white border border-slate-200/70">
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

                                        <div className="mt-2 text-sm font-medium text-slate-900">
                                          {d.displayContext?.scroll_speed
                                            ? `${(d.displayContext.scroll_speed / 1000).toFixed(0)}s per slide`
                                            : "—"}
                                        </div>
                                      </div>

                                      {/* =========================
        CARD STATO CONNESSIONE / PING
       ========================= */}
                                      <div className="p-3 rounded-[0.8rem] bg-white border border-slate-200/70">
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                          {isRealtimeConnected ? (
                                            <span className="flex items-center gap-1">
                                              <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                              </span>
                                              Ping
                                            </span>
                                          ) : (
                                            <span>Heartbeat</span>
                                          )}

                                          <span className="text-slate-700 font-medium">
                                            {isRealtimeConnected
                                              ? realtimeStatus?.latencyMs != null
                                                ? `${realtimeStatus.latencyMs}ms`
                                                : "—"
                                              : lastSeenLabel}
                                          </span>
                                        </div>

                                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
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
                                          <div className="mt-1 text-[0.7rem] text-right text-slate-400">
                                            Ultimo segnale: {lastSeenLabel}
                                          </div>
                                        )}
                                      </div>

                                    </div>
                                  </div>
                                  <div className="p-3 rounded-[0.8rem] bg-slate-50 border border-slate-200/70 mt-2">
                                    <div className="text-xs text-slate-500">Display Context</div>
                                    <div className="mt-1 text-sm font-medium text-slate-900 truncate">
                                      {d.displayContext?.nome || "Nessun context assegnato"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Endpoint:{" "}
                                      <span className="text-slate-700 font-medium">
                                        {d.displayContext?.endpoint_type || "—"}
                                      </span>
                                    </div>
                                  </div>
                                </div>



                              </div>

                              {/* ALERT: dispositivo disattivato */}
                              {!d.is_active ? (
                                <div className="mt-3 p-3 rounded-[0.8rem] bg-danger/5 border border-danger/20">
                                  <div className="flex items-start gap-2">
                                    <Lucide
                                      icon="CircleX"
                                      className="w-4 h-4 mt-0.5 text-danger stroke-[1.4]"
                                    />
                                    <div className="text-xs text-slate-700">
                                      <span className="font-medium">Dispositivo disattivato</span>
                                    </div>
                                  </div>
                                </div>
                              ) : !d.displayContext ? (
                                <div className="mt-3 p-3 rounded-[0.8rem] bg-warning/5 border border-warning/20">
                                  <div className="flex items-start gap-2">
                                    <Lucide
                                      icon="TriangleAlert"
                                      className="w-4 h-4 mt-0.5 text-warning stroke-[1.4]"
                                    />
                                    <div className="text-xs text-slate-700">
                                      <span className="font-medium">Nessun display context assegnato</span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}

                              {/* FOOTER CTA */}
                              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                                <Button
                                  variant="secondary"
                                  className="rounded-[0.7rem] bg-white"
                                  onClick={() => handleCopyDisplayUrl(d)}
                                >
                                  <Lucide icon="Link" className="w-4 h-4 mr-2 stroke-[1.3]" />
                                  Copia link display
                                </Button>

                                <div className="sm:ml-auto text-xs text-slate-400">
                                  ID: <span className="text-slate-500">{d.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* EMPTY STATE */}
                  {!isLoadingDevices && filteredDevices.length === 0 ? (
                    <div className="p-8 rounded-[0.9rem] border border-dashed border-slate-300/70 bg-slate-50 text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-white border border-slate-200/70 flex items-center justify-center">
                        <Lucide icon="MonitorX" className="w-6 h-6 text-slate-500" />
                      </div>
                      <div className="mt-3 text-sm font-medium text-slate-900">
                        {dispositivi.length === 0
                          ? "Nessun dispositivo registrato"
                          : "Nessun dispositivo trovato"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {dispositivi.length === 0
                          ? "Aggiungi un nuovo dispositivo per iniziare."
                          : "Modifica i filtri o prova una ricerca diversa."}
                      </div>
                    </div>
                  ) : null}
                </div>
                {/* ============================================================
                    FINE MOCKUP UI DISPOSITIVI
                    ============================================================ */}
              </div>

              {/* ============================================================
                  SEZIONE DISPLAY CONTEXTS
                  ============================================================ */}
              <div className="flex flex-col h-full p-5 box box--stacked">
                <div className="pb-5 mb-5 border-b border-dashed border-slate-300/70 flex items-center justify-between">
                  <h2>Display Contexts</h2>
                  <Button
                    variant="primary"
                    className="rounded-[0.7rem]"
                    onClick={() => { resetContextForm(); setIsCreateContextOpen(true); }}
                  >
                    <Lucide icon="Plus" className="stroke-[1.3] w-4 h-4 mr-2" />
                    Nuovo contesto
                  </Button>
                </div>

                {isLoadingContexts ? (
                  <div className="p-8 text-center">
                    <div className="text-sm text-slate-500">Caricamento contesti...</div>
                  </div>
                ) : displayContexts.length === 0 ? (
                  <div className="p-8 rounded-[0.9rem] border border-dashed border-slate-300/70 bg-slate-50 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-white border border-slate-200/70 flex items-center justify-center">
                      <Lucide icon="LayoutDashboard" className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-900">
                      Nessun display context
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Crea un contesto per configurare cosa mostrare sui display.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-4">
                    {displayContexts.map((ctx) => (
                      <div key={ctx.id} className="col-span-12 md:col-span-6">
                        <div className="p-4 rounded-[0.9rem] bg-white border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow ring-1 ring-slate-200/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-slate-900 truncate">{ctx.nome}</div>
                                <span className={clsx(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                  ctx.is_active ? "bg-success/10 text-success border border-success/20" : "bg-slate-100 text-slate-500 border border-slate-200"
                                )}>
                                  {ctx.is_active ? "Attivo" : "Inattivo"}
                                </span>
                              </div>
                              {ctx.descrizione && (
                                <div className="mt-1 text-xs text-slate-500 truncate">{ctx.descrizione}</div>
                              )}
                            </div>
                            <Menu>
                              <Menu.Button as={Button} variant="secondary" className="rounded-[0.7rem] bg-white py-2 px-2">
                                <Lucide icon="EllipsisVertical" className="w-4 h-4" />
                              </Menu.Button>
                              <Menu.Items className="w-48">
                                <Menu.Item onClick={() => openEditContext(ctx)}>
                                  <Lucide icon="Pencil" className="w-4 h-4 mr-2" /> Modifica
                                </Menu.Item>
                                <Menu.Item
                                  className="text-danger"
                                  onClick={() => {
                                    if (confirm(`Eliminare il contesto "${ctx.nome}"?`)) {
                                      deleteContextMutation.mutate(ctx.id);
                                    }
                                  }}
                                >
                                  <Lucide icon="Trash2" className="w-4 h-4 mr-2" /> Elimina
                                </Menu.Item>
                              </Menu.Items>
                            </Menu>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                              <div className="text-xs text-slate-500">Endpoint</div>
                              <div className="mt-0.5 text-sm font-medium text-slate-900">{ctx.endpoint_type}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                              <div className="text-xs text-slate-500">Render</div>
                              <div className="mt-0.5 text-sm font-medium text-slate-900">{ctx.render_type || "carousel"}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                              <div className="text-xs text-slate-500">Filtri</div>
                              <div className="mt-0.5 text-sm font-medium text-slate-900">
                                {ctx.filters?.flat().length || 0}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                            <Lucide icon="Monitor" className="w-3.5 h-3.5" />
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
              </div>
            </div>
          </div>

          {/* SIDEBAR DESTRA (IDENTICA) */}
          <div className="relative col-span-12 row-start-1 xl:col-start-9 xl:col-span-4">
            <div className="relative col-span-12 row-start-1 xl:col-start-9 xl:col-span-4">
              <div className="sticky top-[6.2rem] flex flex-col gap-y-7">
                <div className="flex flex-col p-5 box box--stacked">
                  <h2 className="pb-5 mb-5 font-medium border-b border-dashed border-slate-300/70 text-[0.94rem]">
                    Dati punto vendita
                  </h2>

                  <div className="flex flex-col gap-8">
                    {/* MAPPA */}
                    <div className="relative w-full h-[220px] rounded-md overflow-hidden">
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        preferCanvas
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        dragging={false}
                        touchZoom={false}
                        keyboard={false}
                        zoomControl={false}
                        attributionControl={false}
                        className="absolute inset-0"
                      >
                        {typeof coordinate?.lat === "number" &&
                          typeof coordinate?.lon === "number" && (
                            <Marker
                              position={[coordinate.lat, coordinate.lon]}
                              icon={storeMarker}
                            />
                          )}
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution="&copy; OpenStreetMap contributors"
                        />
                        {/* <TileLayer
                          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                          attribution="&copy; OpenTopoMap contributors"
                        /> */}


                      </MapContainer>
                    </div>

                    {/* DATI GENERALI */}
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center">
                        <Lucide
                          icon="Clipboard"
                          className="w-4 h-4 mr-2 stroke-[1.3] text-slate-500"
                        />
                        <span className="text-[0.9rem]">
                          Ragione Sociale:
                          <span className="ml-1 font-medium">
                            {ragionesociale || "Non specificato"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center">
                        <Lucide
                          icon="Calendar"
                          className="w-4 h-4 mr-2 stroke-[1.3] text-slate-500"
                        />
                        <span className="text-[0.9rem]">
                          Indirizzo:
                          <span className="ml-1 font-medium">
                            {displayIndirizzoCompleto || "Indirizzo non disponibile"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center">
                        <Lucide
                          icon="Clock"
                          className="w-4 h-4 mr-2 stroke-[1.3] text-slate-500"
                        />
                        <span className="text-[0.9rem] mr-1">Manager:</span>
                        <span className="text-xs font-medium rounded-md px-1.5 py-px bg-success/10 border border-success/10 text-success">
                          N.D.
                        </span>
                      </div>

                      <div className="flex items-center">
                        <Lucide
                          icon="Map"
                          className="w-4 h-4 mr-2 stroke-[1.3] text-slate-500"
                        />
                        <span className="text-[0.9rem]">
                          Posizione:
                          <span className="ml-1 font-medium">
                            {sigla_combinazione || displayLocationShort || "Non definita"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* RECAPITI */}
                    <div>
                      <div className="text-xs uppercase text-slate-500">Recapiti</div>

                      <div className="mt-3">
                        <div className="flex items-center">
                          <Lucide
                            icon="Calendar"
                            className="w-4 h-4 mr-2 stroke-[1.3] text-slate-500"
                          />
                          <span className="text-[0.9rem]">
                            Recapito Telefonico:
                            {telefono ? (
                              <a
                                href={`tel:${telefono}`}
                                className="ml-1 text-primary underline decoration-dotted decoration-primary/30 underline-offset-[3px]"
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
                    <div>
                      <div className="flex items-center">
                        <Lucide
                          icon="Clock"
                          className="w-4 h-4 mr-2 stroke-[1.3] text-slate-500"
                        />
                        <span className="text-[0.9rem] mr-1">Dipendenti collegati:</span>
                        <span className="text-xs font-medium rounded-md px-1.5 py-px bg-success/10 border border-success/10 text-success">
                          {numero_utenti_collegati} dipendenti
                        </span>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* DIALOG: Creazione dispositivo */}
      <Dialog open={isCreateDeviceOpen} onClose={closeCreateDialog}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Nuovo dispositivo</h2>
          </Dialog.Title>
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
              variant="outline-danger"
              onClick={closeCreateDialog}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              className="w-20"
              disabled={createDeviceMutation.isPending || !newDeviceName.trim()}
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
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Dispositivo creato</h2>
          </Dialog.Title>
          <Dialog.Description className="flex flex-col gap-4">
            <div className="p-4 rounded-[0.8rem] bg-success/5 border border-success/20">
              <div className="flex items-center gap-2 text-success">
                <Lucide icon="CircleCheck" className="w-5 h-5" />
                <span className="font-medium">
                  &quot;{createdDevice?.nome}&quot; creato con successo
                </span>
              </div>
            </div>

            <div className="p-4 rounded-[0.8rem] bg-slate-50 border border-slate-200/70">
              <div className="text-xs text-slate-500 mb-1">Token display</div>
              <div className="text-sm font-mono text-slate-900 break-all">
                {createdDevice?.token_display}
              </div>
            </div>

            <div className="p-4 rounded-[0.8rem] bg-slate-50 border border-slate-200/70">
              <div className="text-xs text-slate-500 mb-1">URL display</div>
              <div className="text-sm font-mono text-slate-900 break-all">
                {createdDevice?.display_url}
              </div>
              <Button
                variant="secondary"
                className="mt-2 rounded-[0.7rem]"
                onClick={() => {
                  if (createdDevice?.display_url) {
                    navigator.clipboard.writeText(createdDevice.display_url);
                  }
                }}
              >
                <Lucide icon="Copy" className="w-4 h-4 mr-2" />
                Copia URL
              </Button>
            </div>

            <div className="p-3 rounded-[0.8rem] bg-warning/5 border border-warning/20">
              <div className="flex items-start gap-2">
                <Lucide icon="TriangleAlert" className="w-4 h-4 mt-0.5 text-warning" />
                <div className="text-xs text-slate-700">
                  Salva il token e l&apos;URL: il token non sarà più visibile dopo la chiusura.
                </div>
              </div>
            </div>
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
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              {editingContext ? "Modifica contesto" : "Nuovo display context"}
            </h2>
          </Dialog.Title>
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
              <div className="text-sm font-medium text-slate-700 mb-3">Opzioni display</div>
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
                <div className="text-sm font-medium text-slate-700">Filtri contenuto</div>
                <Button
                  variant="secondary"
                  className="rounded-[0.7rem] text-xs py-1.5"
                  onClick={addFilterGroup}
                >
                  <Lucide icon="Plus" className="w-3.5 h-3.5 mr-1" />
                  Gruppo OR
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                {ctxFilterGroups.map((group, gi) => (
                  <div key={gi} className="p-3 rounded-lg border border-slate-200/70 bg-slate-50">
                    {gi > 0 && (
                      <div className="flex items-center justify-center mb-2">
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700 border border-amber-200">
                          OR
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">
                        Gruppo {gi + 1} (condizioni AND)
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          className="rounded text-xs py-1 px-2"
                          onClick={() => addFilterToGroup(gi)}
                        >
                          <Lucide icon="Plus" className="w-3 h-3 mr-1" />
                          Condizione
                        </Button>
                        {ctxFilterGroups.length > 1 && (
                          <Button
                            variant="secondary"
                            className="rounded text-xs py-1 px-2 text-danger"
                            onClick={() => removeFilterGroup(gi)}
                          >
                            <Lucide icon="Trash2" className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {group.map((filter, fi) => (
                        <div key={fi} className="grid grid-cols-12 gap-2 items-center">
                          {fi > 0 && (
                            <div className="col-span-12 flex justify-center">
                              <span className="text-xs text-blue-600 font-medium">AND</span>
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
                            >
                              <Lucide icon="X" className="w-4 h-4" />
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
              variant="outline-danger"
              onClick={closeContextDialog}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={
                !ctxNome.trim() ||
                createContextMutation.isPending ||
                updateContextMutation.isPending
              }
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
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">Assegna display context</h2>
          </Dialog.Title>
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
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
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
              variant="outline-danger"
              onClick={() => { setAssignDeviceId(null); setSelectedContextId(""); }}
              className="w-20 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={assignContextMutation.isPending}
              onClick={() => assignContextMutation.mutate()}
            >
              Assegna
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
    </div>
  );
};

export default withSessionCheck(GestionePuntoVendita);
