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
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import { coloreDaTinta } from "@/components/PuntiVendita/elenco";
import { problemiDati, StatoDati } from "@/components/PuntiVendita/StatoDati";
import { PERMISSIONS } from "@/constants/permissions";
import type { TonoStato } from "@/constants/stati";
import { useNotification } from "@/context/NotificationContext";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { formatDataOra, formatNumero, formatRelativo } from "@/utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Marker, TileLayer } from "react-leaflet";
import { MapContainer } from "react-leaflet/MapContainer";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import type { CreateDisplayContextDTO, DisplayContextResponseDTO, DispositivoPuntoVenditaResponseDTO, PuntoVenditaResponseDTO } from "../../../server/core/dto";
import { Dialog, Menu } from "../../components/Base/Headless";
import { usePVDeviceStatus } from "../../hooks/usePVDeviceStatus";
import { codiciGdo, indirizzoCompleto, valoriFormPuntoVendita } from "../../utils/puntoVendita";
import { operatorOptions } from "../../pages/GestioneApi/constants";
import type { FilterCondition } from "../../pages/GestioneApi/types";
import { createEmptyFilterCondition, createEmptyFilterGroup, formatFiltersForApi } from "../../pages/GestioneApi/utils/filterHelpers";
import {
  useFetchDisplayContextsByPuntoVendita,
  useFetchDispositiviPuntoVendita,
  useFetchFilesFieldValues,
  useFetchFilesMetadataFields,
  useFetchPuntoVenditaGestione,
  useFetchStoriaPuntoVendita,
} from "../../query/query";
import {
  CampiCoordinate,
  CampiPuntoVendita,
  corpoSalvataggio,
  useCombinazioniPerCanale,
  useFormPuntoVendita,
  type DatiFormPuntoVendita,
  type RispostaSalvataggioPuntoVendita,
} from "../PuntiVendita/formPuntoVendita";
import { useTinteCanali } from "../PuntiVenditaConsultazione/analisi";

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
  warning: { tono: "warning", etichetta: "In ritardo" },
  offline: { tono: "neutral", etichetta: "Offline" },
};

/** Le aree di lavoro della gestione del punto vendita, ciascuna una scheda nell'URL (?scheda=). */
type SchedaGestione = "anagrafica" | "dispositivi" | "display";

const SCHEDE_GESTIONE: readonly SchedaGestione[] = ["anagrafica", "dispositivi", "display"];

const schedaDaUrl = (valore: string | null): SchedaGestione =>
  SCHEDE_GESTIONE.find(scheda => scheda === valore) ?? "anagrafica";

const PERCORSO_ELENCO = "/gestione-interna/punti-vendita";

/** "Android TV 12 · Chrome 120": sistema e browser che il dispositivo ha mandato con l'ultimo segnale. */
const tipoDispositivo = (d: DispositivoPuntoVenditaResponseDTO) => {
  const os = d.metadata?.os;
  const browser = d.metadata?.browser;
  return [
    os?.name && [os.name, os.version].filter(Boolean).join(" "),
    browser?.name && [browser.name, browser.version?.split(".")[0]].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
};

/** Una coordinata del form leggibile come numero, oppure null. */
const numeroCoordinata = (valore: unknown) => {
  const numero = typeof valore === "number" ? valore : typeof valore === "string" && valore.trim() !== "" ? Number(valore) : NaN;
  return Number.isFinite(numero) ? numero : null;
};

const ZOOM_MINIMAPPA = 16;

/** Il loader può non trovare il punto vendita (eliminato, o di un'altra GDO). */
const GestionePuntoVendita: React.FC = () => {
  const { puntoVendita } = useLoaderData() as { puntoVendita: PuntoVenditaResponseDTO | null };
  if (!puntoVendita) {
    return (
      <Pagina titolo="Punto vendita" indietro={{ to: PERCORSO_ELENCO, etichetta: "Torna ai punti vendita" }}>
        <PageError titolo="Punto vendita non trovato" motivo="Il punto vendita non esiste più o non è della tua GDO." />
      </Pagina>
    );
  }
  return <GestioneDelPuntoVendita iniziale={puntoVendita} />;
};

/**
 * Gestione di un punto vendita (/gestione-interna/punti-vendita/:id): intestazione compatta con
 * insegna, area e stato dei dati, poi tre schede con la scelta nell'URL. Anagrafica modificabile
 * nella pagina con la posizione accanto (stesso salvataggio dell'elenco: prima Istanta, poi
 * Fidelity); dispositivi filtrati per stato con l'ultimo segnale; display context.
 */
function GestioneDelPuntoVendita({ iniziale }: { iniziale: PuntoVenditaResponseDTO }) {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [parametri, aggiornaParametri] = useParametriUrl();
  const scheda = schedaDaUrl(parametri.get("scheda"));
  const vaiA = (nuova: SchedaGestione) => aggiornaParametri({ scheda: nuova === "anagrafica" ? null : nuova });

  // Il punto vendita del loader, riletto dopo ogni salvataggio
  const { data: puntoVendita = iniziale } = useFetchPuntoVenditaGestione(iniziale);
  const storiaQuery = useFetchStoriaPuntoVendita(puntoVendita.id);
  const storeMarker = useMemo(
    () => L.divIcon({ className: "pv-marker", html: "<span></span>", iconSize: [12, 12], iconAnchor: [6, 6] }),
    []
  );

  const nomeVisibile = puntoVendita.nome_display || puntoVendita.nome;
  const codici = codiciGdo(puntoVendita.meta);
  const canaleLocale = useMemo(
    () => (puntoVendita.id_canale ? [{ id: puntoVendita.id_canale, nome: puntoVendita.nome_canale ?? puntoVendita.id_canale }] : []),
    [puntoVendita.id_canale, puntoVendita.nome_canale]
  );
  const tintaCanale = useTinteCanali(canaleLocale);
  const coloreInsegna = coloreDaTinta(tintaCanale(puntoVendita.id_canale ?? ""));
  // "Mai nei volantini" solo quando la storia è arrivata e non ha volantini
  const storia = storiaQuery.data;
  const problemi = problemiDati(
    {
      ...puntoVendita,
      storia: storia ? { volantini: storia.sintesi?.numeroVolantini ?? 0, insegnePerAnno: [], cambioInsegna: false } : undefined,
    },
    { gdoConCodici: false, storiaNota: storia !== undefined }
  );

  // ============================================================
  // ANAGRAFICA: il form dell'elenco, nella pagina
  // ============================================================
  const form = useFormPuntoVendita(valoriFormPuntoVendita(iniziale));
  const {
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { isDirty },
  } = form;
  const { perCanale: combinazioniPerCanale } = useCombinazioniPerCanale();
  const [correzione, setCorrezione] = useState(false);

  // Il punto vendita riletto entra nel form, mai sopra le modifiche in corso
  useEffect(() => {
    if (!form.formState.isDirty) reset(valoriFormPuntoVendita(puntoVendita));
  }, [puntoVendita, form, reset]);

  const invalidaPuntiVendita = (refetchType: "active" | "none" = "active") => {
    queryClient.invalidateQueries({ queryKey: ["dataPuntiVendita"], refetchType });
    // Consultazione, rete per insegna e qualità dei dati contano gli stessi punti vendita
    queryClient.invalidateQueries({ queryKey: ["puntiVendita"], refetchType });
  };

  // modificaPV scrive prima su Istanta e poi in Fidelity, con lo stesso GUID: come il modale dell'elenco
  const salvaAnagrafica = useMutation({
    mutationFn: (dati: DatiFormPuntoVendita) =>
      ServerCall.put<RispostaSalvataggioPuntoVendita>("/ACPV/modificaPV", corpoSalvataggio(dati, puntoVendita.id)),
    onSuccess: (risposta) => {
      if (!risposta.esito) {
        showNotification(risposta.error || "Errore durante la modifica del punto vendita", { variant: "error" });
        return;
      }
      showNotification("Punto vendita aggiornato con successo", { variant: "success" });
      // I valori salvati diventano quelli di partenza: niente più modifiche in sospeso
      reset(getValues());
      setCorrezione(false);
      invalidaPuntiVendita();
    },
    onError: (e: Error) =>
      showNotification(e?.message || "Errore durante la modifica del punto vendita", { variant: "error" }),
  });

  const annullaModifiche = () => {
    reset(valoriFormPuntoVendita(puntoVendita));
    setCorrezione(false);
  };

  // La mini-mappa segue le coordinate del form: correggendole si vede dove finisce il punto
  const latitudine = numeroCoordinata(watch("lat"));
  const longitudine = numeroCoordinata(watch("lon"));
  const posizione: [number, number] | null = latitudine !== null && longitudine !== null ? [latitudine, longitudine] : null;

  const [eliminazioneAperta, setEliminazioneAperta] = useState(false);
  const eliminaPuntoVendita = useMutation({
    mutationFn: () => ServerCall.delete(`/ACPV/eliminaPV/${puntoVendita.id}`),
    onSuccess: () => {
      // Si torna all'elenco: le letture del punto vendita eliminato non vanno ripetute
      invalidaPuntiVendita("none");
      showNotification("Punto vendita eliminato", { variant: "success" });
      navigate(PERCORSO_ELENCO);
    },
    onError: (e: Error) =>
      showNotification(e?.message || "Errore durante l'eliminazione del punto vendita", { variant: "error" }),
  });

  // ============================================================
  // DISPOSITIVI - DATI REALI DA API
  // ============================================================
  type DeviceStatus = "online" | "offline" | "warning";

  const {
    data: dispositivi = [],
    isLoading: isLoadingDevices,
    isError: isErrorDevices,
    error: erroreDevices,
    refetch: refetchDevices,
  } = useFetchDispositiviPuntoVendita(puntoVendita.id);

  // Real-time device status via WebSocket
  const { getDeviceStatus } = usePVDeviceStatus(puntoVendita.id);

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


  /** Ultimo segnale in parole ("5 minuti fa"), con la data completa per il title. */
  const ultimoSegnale = (device: DispositivoPuntoVenditaResponseDTO) =>
    device.last_seen_at
      ? { testo: formatRelativo(device.last_seen_at), titolo: formatDataOra(device.last_seen_at) }
      : { testo: "Mai connesso", titolo: undefined };

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
    { valore: "warning", etichetta: "In ritardo", conteggio: conteggiStato.warning },
    { valore: "offline", etichetta: "Offline", conteggio: conteggiStato.offline },
  ];
  // Il numero accanto alla scheda solo quando è noto
  const opzioniScheda: OpzioneSegmento<SchedaGestione>[] = [
    { valore: "anagrafica", etichetta: "Anagrafica" },
    { valore: "dispositivi", etichetta: "Dispositivi", conteggio: isLoadingDevices || isErrorDevices ? undefined : dispositivi.length },
    { valore: "display", etichetta: "Display context", conteggio: isLoadingContexts || isErrorContexts ? undefined : displayContexts.length },
  ];

  const righeInCaricamento = (colonne: number, etichetta: string) => (
    <div aria-busy="true" aria-label={etichetta} className="flex flex-col gap-3 p-5">
      {Array.from({ length: 3 }, (_, indice) => (
        <div key={indice} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${colonne}, minmax(0, 1fr))` }}>
          {Array.from({ length: colonne }, (_, colonna) => (
            <Skeleton key={colonna} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Pagina
        titolo={nomeVisibile}
        indietro={{ to: PERCORSO_ELENCO, etichetta: "Torna ai punti vendita" }}
        badges={
          <>
            {puntoVendita.nome_canale && (
              // Pastiglia piena e chiara come gli altri badge: leggibile sulla fascia scura dell'intestazione
              <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700">
                {/* Il colore dell'insegna è quello di tutte le pagine dei punti vendita */}
                <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: coloreInsegna }} />
                <span className="truncate">{puntoVendita.nome_canale}</span>
              </span>
            )}
            {puntoVendita.nome_area && <StatusBadge tono="neutral" icon="MapPin" etichetta={puntoVendita.nome_area} />}
            <StatoDati problemi={problemi} completi="Dati completi" />
          </>
        }
        azioni={
          <>
            {/* Volantini attivi e storia del punto vendita sono nella scheda di consultazione */}
            <Button as={Link} to={`/punti-vendita/${puntoVendita.id}`} variant="outline-secondary">
              <Lucide icon="Store" aria-hidden="true" className="mr-2 h-4 w-4" />
              Apri scheda
            </Button>
            {/* Elimina non resta in vista sulla fascia: sta nel menu "⋯", come nelle righe dell'elenco */}
            <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA}>
              <Menu className="inline-block text-left">
                <Menu.Button as={Button} variant="outline-secondary" aria-label="Altre azioni sul punto vendita">
                  {/* Icona da 20px: il pulsante è alto come "Apri scheda" */}
                  <Lucide icon="Ellipsis" aria-hidden="true" className="h-5 w-5" />
                </Menu.Button>
                {/* Stretto: su mobile il pulsante non è sul bordo destro e il menu si apre verso sinistra */}
                <Menu.Items className="w-40">
                  <Menu.Item className="text-danger" onClick={() => setEliminazioneAperta(true)}>
                    <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                    Elimina
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            </PermissionGate>
          </>
        }
      >
        <Segmenti etichetta="Aree di gestione" opzioni={opzioniScheda} valore={scheda} onChange={vaiA} className="self-start" />

        {/* ANAGRAFICA: il form nella pagina, la posizione accanto */}
        {scheda === "anagrafica" && (
          <div className="grid grid-cols-12 gap-6">
            <Sezione
              className="col-span-12 xl:col-span-8"
              titolo="Anagrafica"
              descrizione="Le modifiche vanno prima in Istanta, poi in Fidelity."
              azioni={
                <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline-secondary" onClick={annullaModifiche} disabled={!isDirty || salvaAnagrafica.isPending}>
                      Annulla
                    </Button>
                    <Button
                      size="sm"
                      type="submit"
                      variant="primary"
                      form="form-anagrafica"
                      disabled={!isDirty}
                      loading={salvaAnagrafica.isPending}
                    >
                      Salva modifiche
                    </Button>
                  </div>
                </PermissionGate>
              }
            >
              <form id="form-anagrafica" onSubmit={handleSubmit(dati => salvaAnagrafica.mutate(dati))} noValidate>
                <CampiPuntoVendita form={form} combinazioniPerCanale={combinazioniPerCanale} conCoordinate={false} />
              </form>
              {(codici.length > 0 || puntoVendita.numero_utenti_collegati !== undefined) && (
                <div className="mt-5 border-t border-dashed border-slate-200 pt-4 dark:border-darkmode-400">
                  <h3 className="title-eyebrow">Dati di sistema</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums sm:grid-cols-[auto_1fr]">
                    {/* I codici del sistema della GDO arrivano dall'import Excel: qui si leggono e basta */}
                    {codici.map(c => (
                      <div key={c.etichetta} className="contents">
                        <dt className="text-slate-500">{c.etichetta}</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">{c.valore}</dd>
                      </div>
                    ))}
                    {puntoVendita.numero_utenti_collegati !== undefined && (
                      <div className="contents">
                        <dt className="text-slate-500">Dipendenti collegati</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">{formatNumero(puntoVendita.numero_utenti_collegati)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </Sezione>

            <div className="col-span-12 flex flex-col gap-6 xl:col-span-4">
              <Sezione
                compatta
                titolo="Posizione"
                descrizione={
                  posizione ? (
                    <span className="tabular-nums">
                      {posizione[0].toFixed(5)}, {posizione[1].toFixed(5)}
                    </span>
                  ) : (
                    "Senza coordinate: non compare sulla mappa"
                  )
                }
                azioni={
                  <PermissionGate permission={PERMISSIONS.GDO.GESTISCI_PUNTI_VENDITA} mode="disable">
                    <Button size="sm" variant="outline-secondary" aria-expanded={correzione} onClick={() => setCorrezione(aperta => !aperta)}>
                      <Lucide icon={correzione ? "X" : "Crosshair"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      {correzione ? "Chiudi" : "Correggi"}
                    </Button>
                  </PermissionGate>
                }
              >
                {posizione ? (
                  <div className="relative h-44 w-full overflow-hidden rounded-control border border-slate-200 dark:border-darkmode-400">
                    {/* La chiave ridisegna la mappa sulle coordinate nuove mentre si correggono */}
                    <MapContainer
                      key={posizione.join(",")}
                      center={posizione}
                      zoom={ZOOM_MINIMAPPA}
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
                  <EmptyState
                    compatta
                    icon="MapPinOff"
                    title="Coordinate non disponibili"
                    description="Con Correggi si inseriscono latitudine e longitudine."
                  />
                )}
                {correzione && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <CampiCoordinate form={form} className="col-span-2 sm:col-span-1" />
                    <p className="col-span-2 text-xs text-slate-500">
                      Vuote, il punto vendita resta senza coordinate. Si salvano con &quot;Salva modifiche&quot;.
                    </p>
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">{indirizzoCompleto(puntoVendita) || "Indirizzo non impostato"}</div>
              </Sezione>

              <Sezione
                compatta
                titolo="Dispositivi"
                descrizione="Display e totem del punto vendita"
                azioni={
                  <Button size="sm" variant="outline-secondary" onClick={() => vaiA("dispositivi")}>
                    Apri
                  </Button>
                }
              >
                {isLoadingDevices ? (
                  <Skeleton className="h-5 w-2/3" />
                ) : isErrorDevices ? (
                  <p className="text-sm text-slate-500">Stato dei dispositivi non disponibile.</p>
                ) : dispositivi.length === 0 ? (
                  <p className="text-sm text-slate-500">Nessun dispositivo registrato.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 tabular-nums">
                    <StatusBadge tono="success" etichetta={`${formatNumero(conteggiStato.online)} online`} />
                    <StatusBadge tono="warning" etichetta={`${formatNumero(conteggiStato.warning)} in ritardo`} />
                    <StatusBadge tono="neutral" etichetta={`${formatNumero(conteggiStato.offline)} offline`} />
                  </div>
                )}
              </Sezione>
            </div>
          </div>
        )}

        {/* DISPOSITIVI: filtro per stato, tabella con l'ultimo segnale */}
        {scheda === "dispositivi" && (
          <Sezione
            senzaPadding
            titolo="Dispositivi"
            descrizione="Display e totem del negozio, con l'ultimo segnale ricevuto."
            azioni={
              <Button size="sm" variant="primary" onClick={() => setIsCreateDeviceOpen(true)}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Nuovo dispositivo
              </Button>
            }
          >
            <BarraFiltri>
              <Segmenti etichetta="Stato" opzioni={opzioniStato} valore={statusFilter} onChange={setStatusFilter} />
              <CampoRicerca
                etichetta="Cerca dispositivi"
                placeholder="Nome, descrizione o contesto"
                value={deviceQuery}
                onChange={setDeviceQuery}
              />
            </BarraFiltri>
            {isLoadingDevices ? (
              righeInCaricamento(4, "Caricamento dei dispositivi")
            ) : isErrorDevices ? (
              <div className="p-5">
                <PageError
                  compatta
                  titolo="Dispositivi non caricati"
                  motivo={(erroreDevices as Error)?.message || "Errore durante il recupero dei dispositivi"}
                  onRiprova={() => refetchDevices()}
                />
              </div>
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
              <div className="overflow-x-auto">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Dispositivo</Table.Th>
                      <Table.Th>Stato</Table.Th>
                      <Table.Th>Ultimo segnale</Table.Th>
                      <Table.Th>Display context</Table.Th>
                      <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredDevices.map((d) => {
                      const status = getDeviceStatusValue(d);
                      const realtimeStatus = getDeviceStatus(d.id);
                      const isRealtimeConnected = realtimeStatus?.isConnected ?? false;
                      const segnale = ultimoSegnale(d);
                      const dettaglio = [d.descrizione, tipoDispositivo(d)].filter(Boolean).join(" · ");
                      return (
                        <Table.Tr key={d.id}>
                          <Table.Td>
                            <div className="font-medium text-slate-800 dark:text-slate-200">{d.nome}</div>
                            <div className="text-xs text-slate-500">{dettaglio || "Tipo non ancora noto"}</div>
                          </Table.Td>
                          <Table.Td>
                            <div className="flex flex-wrap gap-1">
                              {statusBadge(status, isRealtimeConnected)}
                              {!d.is_active && <StatusBadge tono="danger" etichetta="Disattivato" />}
                            </div>
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap tabular-nums">
                            {isRealtimeConnected ? (
                              <>
                                <div>
                                  Adesso
                                  {realtimeStatus?.latencyMs != null && <span className="text-slate-500"> · {realtimeStatus.latencyMs} ms</span>}
                                </div>
                                {realtimeStatus?.currentSlideIndex != null && realtimeStatus?.totalSlides != null && (
                                  <div className="max-w-48 truncate text-xs text-slate-500" title={realtimeStatus.slideName ?? undefined}>
                                    Slide {realtimeStatus.currentSlideIndex + 1} di {realtimeStatus.totalSlides}
                                    {realtimeStatus.slideName ? ` · ${realtimeStatus.slideName}` : ""}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span title={segnale.titolo}>{segnale.testo}</span>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {d.displayContext ? (
                              <span className="text-slate-700 dark:text-slate-300">{d.displayContext.nome}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-warning">
                                <Lucide icon="TriangleAlert" aria-hidden="true" className="h-3.5 w-3.5" />
                                Nessuno
                              </span>
                            )}
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button size="sm" variant="outline-secondary" onClick={() => openAssignDialog(d)} aria-label={`Assegna contesto a ${d.nome}`}>
                                <Lucide icon="LayoutDashboard" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Assegna
                              </Button>
                              <Menu className="inline-block text-left">
                                <Menu.Button as={Button} size="sm" variant="outline-secondary" aria-label={`Azioni dispositivo ${d.nome}`}>
                                  <Lucide icon="Ellipsis" aria-hidden="true" className="h-4 w-4" />
                                </Menu.Button>
                                <Menu.Items className="w-56">
                                  {d.display_url ? (
                                    <Menu.Item onClick={() => window.open(d.display_url, "_blank")}>
                                      <Lucide icon="Eye" aria-hidden="true" className="mr-2 h-4 w-4" /> Apri preview
                                    </Menu.Item>
                                  ) : null}
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
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Sezione>
        )}

        {/* DISPLAY CONTEXT */}
        {scheda === "display" && (
          <Sezione
            senzaPadding
            titolo="Display context"
            descrizione="Che cosa mostrano i display: contenuti, filtri e scorrimento."
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
              righeInCaricamento(5, "Caricamento dei contesti")
            ) : isErrorContexts ? (
              <div className="p-5">
                <PageError
                  compatta
                  titolo="Contesti non caricati"
                  motivo={(erroreContexts as Error)?.message || "Errore durante il recupero dei contesti"}
                  onRiprova={() => refetchContexts()}
                />
              </div>
            ) : displayContexts.length === 0 ? (
              <EmptyState
                compatta
                icon="LayoutDashboard"
                title="Nessun display context"
                description="Crea un contesto per configurare cosa mostrare sui display."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Contesto</Table.Th>
                      <Table.Th>Stato</Table.Th>
                      <Table.Th>Contenuto</Table.Th>
                      <Table.Th className="text-right">Dispositivi</Table.Th>
                      <Table.Th>Scorrimento</Table.Th>
                      <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {displayContexts.map((ctx) => {
                      const filtri = ctx.filters?.flat().length || 0;
                      return (
                        <Table.Tr key={ctx.id}>
                          <Table.Td>
                            <div className="font-medium text-slate-800 dark:text-slate-200">{ctx.nome}</div>
                            {ctx.descrizione && <div className="max-w-xs truncate text-xs text-slate-500">{ctx.descrizione}</div>}
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge tono={ctx.is_active ? "success" : "neutral"} etichetta={ctx.is_active ? "Attivo" : "Inattivo"} />
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                            {ctx.endpoint_type} · {ctx.render_type || "carousel"} · {filtri === 1 ? "1 filtro" : `${filtri} filtri`}
                          </Table.Td>
                          <Table.Td className="text-right tabular-nums">{formatNumero(ctx.dispositivi_count ?? 0)}</Table.Td>
                          <Table.Td className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                            {ctx.auto_scroll ? `${(ctx.scroll_speed / 1000).toFixed(0)} s per slide` : "Manuale"}
                          </Table.Td>
                          <Table.Td className="whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button size="sm" variant="outline-secondary" onClick={() => openEditContext(ctx)} aria-label={`Modifica ${ctx.nome}`}>
                                <Lucide icon="Pencil" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Modifica
                              </Button>
                              <Menu className="inline-block text-left">
                                <Menu.Button as={Button} size="sm" variant="outline-secondary" aria-label={`Azioni contesto ${ctx.nome}`}>
                                  <Lucide icon="Ellipsis" aria-hidden="true" className="h-4 w-4" />
                                </Menu.Button>
                                <Menu.Items className="w-48">
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
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Sezione>
        )}

        <ConfirmDialog
          open={eliminazioneAperta}
          title="Eliminare il punto vendita?"
          description={<>Il punto vendita <strong>{nomeVisibile}</strong> verrà eliminato, prima in Istanta e poi in Fidelity.</>}
          confirmLabel="Elimina"
          loading={eliminaPuntoVendita.isPending}
          onClose={() => !eliminaPuntoVendita.isPending && setEliminazioneAperta(false)}
          onConfirm={() => eliminaPuntoVendita.mutate()}
        />
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
}

export default withSessionCheck(GestionePuntoVendita);
