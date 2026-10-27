import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { HUB_QUERY_KEYS, useFetchAllRuoliGDO, useFetchHubServicesAdmin } from "@/query/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ServerCall } from "../../../../lib/server_call";
import type { HubServiceDocumentAsset, HubServiceDTO, HubServiceVideoAsset } from "../../../../lib/types";
import type {
  ConfirmDialogState,
  HubServiceGroup,
  ServiceDialogState,
  ServiceDocumentFormValue,
  ServiceMutationPayload,
  ServiceStatusFilter,
  ServiceVideoFormValue,
} from "../types";
import {
  createServiceTargetKey,
  getServiceColorClasses,
  getServiceTargetLabel,
  getTipoUrlLabel,
  groupHubServices,
  isDataUriIcon,
} from "../utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import ServiceFormDialog from "./ServiceFormDialog";

const buildNotificationContent = (icon: string, title: string, message: string, colorClass: string) => (
  <div className="flex items-center gap-3">
    <Lucide icon={icon} className={`w-6 h-6 ${colorClass}`} />
    <div>
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-sm text-slate-500">{message}</div>
    </div>
  </div>
);

// Stesse regole del filtro per stato, per mostrare i conteggi accanto a ogni opzione
const corrispondeStato = (group: HubServiceGroup, stato: ServiceStatusFilter) => {
  if (stato === "attivo") return group.variants.some((v) => v.attivo && !v.in_manutenzione);
  if (stato === "manutenzione") return group.variants.some((v) => v.in_manutenzione);
  if (stato === "inattivo") return group.variants.every((v) => !v.attivo);
  return true;
};

const ServicesTab = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { data: groupedServices = {}, isLoading, isError, refetch } = useFetchHubServicesAdmin();
  const { data: gdoRoles = [] } = useFetchAllRuoliGDO();

  const [dialogState, setDialogState] = useState<ServiceDialogState | null>(null);
  const [expandedCodes, setExpandedCodes] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [uploadingSharedAssets, setUploadingSharedAssets] = useState(false);

  const serviceGroups = useMemo(() => groupHubServices(groupedServices), [groupedServices]);

  const filteredGroups = useMemo(() => {
    let result = serviceGroups;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) => g.nome.toLowerCase().includes(q) || g.codice.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((g) => corrispondeStato(g, statusFilter));
    }
    return result;
  }, [serviceGroups, searchQuery, statusFilter]);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.servicesAdmin }),
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.services }),
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.news }),
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.newsAdmin }),
    ]);
  };

  const toPersistedDocument = (document: ServiceDocumentFormValue): HubServiceDocumentAsset => ({
    id: document.id,
    title: document.title.trim() || document.original_name,
    original_name: document.original_name,
    mime_type: document.mime_type,
    size: document.size,
    extension: document.extension,
    id_olimpo_cloud: document.id_olimpo_cloud,
    download_url: document.download_url,
    preview_url: document.preview_url,
    pages: document.pages,
  });

  const toPersistedVideo = (video: ServiceVideoFormValue): HubServiceVideoAsset => ({
    id: video.id,
    title: video.title.trim() || video.original_name,
    kind: video.kind,
    original_name: video.original_name,
    mime_type: video.mime_type,
    size: video.size,
    guid_id: video.guid_id,
    url: video.url,
  });

  const uploadDocumentAsset = async (document: ServiceDocumentFormValue): Promise<HubServiceDocumentAsset> => {
    if (!document.file) {
      return toPersistedDocument(document);
    }

    const formData = new FormData();
    formData.append("file", document.file);

    const uploaded = await ServerCall.post<HubServiceDocumentAsset>("/hub-services/assets/document", formData);
    return {
      ...uploaded,
      title: document.title.trim() || uploaded.title,
    };
  };

  const uploadVideoAsset = async (video: ServiceVideoFormValue): Promise<HubServiceVideoAsset> => {
    if (!video.file) {
      return toPersistedVideo(video);
    }

    const formData = new FormData();
    formData.append("file", video.file);

    const uploaded = await ServerCall.post<HubServiceVideoAsset>("/hub-services/assets/video", formData);
    return {
      ...uploaded,
      title: video.title.trim() || uploaded.title,
      kind: video.kind,
    };
  };

  const preparePayloadSharedAssets = async (payload: ServiceMutationPayload): Promise<ServiceMutationPayload | null> => {
    try {
      setUploadingSharedAssets(true);

      const [documents, videos] = await Promise.all([
        Promise.all(payload.values.documents.map((document) => uploadDocumentAsset(document))),
        Promise.all(payload.values.videos.map((video) => uploadVideoAsset(video))),
      ]);

      return {
        ...payload,
        values: {
          ...payload.values,
          documents,
          videos,
        },
      };
    } catch (error) {
      showNotification(
        buildNotificationContent(
          "CircleX",
          "Errore upload contenuti",
          error instanceof Error ? error.message : "Impossibile caricare documenti o video su Olimpo.",
          "text-danger"
        ),
        { variant: "error" }
      );
      return null;
    } finally {
      setUploadingSharedAssets(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      mode,
      variantId,
      values,
      targets,
    }: ServiceMutationPayload & { mode: ServiceDialogState["mode"]; variantId?: string }) => {
      const basePayload = {
        codice: values.codice,
        nome: values.nome,
        descrizione: values.descrizione || undefined,
        icona: values.icona,
        colore: values.colore,
        url: values.url,
        redirect_page: values.redirect_page || undefined,
        documents: values.documents,
        videos: values.videos,
        tipo_url: values.tipo_url,
        ordine: values.ordine,
        attivo: values.attivo,
        in_manutenzione: values.in_manutenzione,
        in_evidenza: values.in_evidenza,
      };

      if (targets.length === 1) {
        const [target] = targets;
        await ServerCall.post("/hub-services", {
          ...basePayload,
          tipo_utente: target.tipo_utente,
          ruolo_gdo: target.ruolo_gdo,
        });
        return;
      }

      await ServerCall.post("/hub-services/bulk", {
        ...basePayload,
        tipi_utente: targets.map((target) => ({
          tipo_utente: target.tipo_utente,
          ruolo_gdo: target.ruolo_gdo,
        })),
      });
    },
    onSuccess: async (_, variables) => {
      await invalidateAll();
      setDialogState(null);

      showNotification(
        buildNotificationContent(
          "CircleCheck",
          "Servizio salvato",
          variables.targets.length > 1
            ? "Le varianti selezionate sono state create correttamente."
            : "Il servizio Hub è stato creato correttamente.",
          "text-success"
        ),
        { variant: "success" }
      );
    },
    onError: (error) => {
      showNotification(
        buildNotificationContent(
          "CircleX",
          "Errore nel salvataggio",
          error instanceof Error ? error.message : "Impossibile salvare il servizio Hub.",
          "text-danger"
        ),
        { variant: "error" }
      );
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await ServerCall.delete(`/hub-services/${variantId}`);
    },
    onSuccess: async () => {
      await invalidateAll();
      showNotification(
        buildNotificationContent(
          "Trash2",
          "Variante eliminata",
          "La variante selezionata è stata rimossa correttamente.",
          "text-success"
        ),
        { variant: "success" }
      );
    },
    onError: (error) => {
      showNotification(
        buildNotificationContent(
          "CircleX",
          "Errore durante l'eliminazione",
          error instanceof Error ? error.message : "Impossibile eliminare la variante.",
          "text-danger"
        ),
        { variant: "error" }
      );
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (codice: string) => {
      await ServerCall.delete(`/hub-services/by-code/${encodeURIComponent(codice)}`);
    },
    onSuccess: async () => {
      await invalidateAll();
      showNotification(
        buildNotificationContent(
          "Trash2",
          "Servizio eliminato",
          "Tutte le varianti del gruppo sono state eliminate.",
          "text-success"
        ),
        { variant: "success" }
      );
    },
    onError: (error) => {
      showNotification(
        buildNotificationContent(
          "CircleX",
          "Errore durante l'eliminazione",
          error instanceof Error ? error.message : "Impossibile eliminare il gruppo servizio.",
          "text-danger"
        ),
        { variant: "error" }
      );
    },
  });

  const handleSave = async (payload: ServiceMutationPayload) => {
    if (dialogState?.mode === "edit-group" && dialogState.group) {
      const toDelete = payload.variantsToDelete ?? [];
      const runEdit = async () => {
        const preparedPayload = await preparePayloadSharedAssets(payload);
        if (!preparedPayload) return;
        await editGroupMutation.mutateAsync({ ...preparedPayload, group: dialogState.group! });
      };

      if (toDelete.length > 0) {
        const count = toDelete.length;
        setConfirmState({
          title: "Conferma eliminazione varianti",
          description: `Hai deselezionato ${count} ${count === 1 ? "variante che verrà eliminata" : "varianti che verranno eliminate"}. Vuoi procedere?`,
          confirmLabel: "Conferma e salva",
          variant: "danger",
          onConfirm: runEdit,
        });
      } else {
        await runEdit();
      }
      return;
    }

    const preparedPayload = await preparePayloadSharedAssets(payload);
    if (!preparedPayload) return;

    await saveMutation.mutateAsync({
      ...preparedPayload,
      mode: dialogState?.mode ?? "create",
      variantId: dialogState?.variant?.id,
    });
  };

  const handleConfirm = async () => {
    if (!confirmState) return;

    try {
      setConfirmLoading(true);
      await confirmState.onConfirm();
      setConfirmState(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const toggleExpanded = (codice: string) => {
    setExpandedCodes((current) =>
      current.includes(codice) ? current.filter((item) => item !== codice) : [...current, codice]
    );
  };

  const expandAll = () => setExpandedCodes(serviceGroups.map((g) => g.codice));
  const collapseAll = () => setExpandedCodes([]);

  const editGroupMutation = useMutation({
    mutationFn: async (payload: ServiceMutationPayload & { group: HubServiceGroup }) => {
      const { values, targets, variantsToDelete, group } = payload;
      const basePayload = {
        nome: values.nome,
        descrizione: values.descrizione,
        icona: values.icona,
        colore: values.colore,
        url: values.url,
        redirect_page: values.redirect_page || undefined,
        documents: values.documents,
        videos: values.videos,
        tipo_url: values.tipo_url,
        ordine: values.ordine,
        attivo: values.attivo,
        in_manutenzione: values.in_manutenzione,
        in_evidenza: values.in_evidenza,
      };
      const existingKeySet = new Set(
        group.variants.map((v) => createServiceTargetKey(v.tipo_utente, v.ruolo_gdo))
      );

      // 1. Aggiorna varianti esistenti mantenute (bulk PATCH)
      const keptVariants = group.variants.filter((v) =>
        targets.some((t) => t.key === createServiceTargetKey(v.tipo_utente, v.ruolo_gdo))
      );
      if (keptVariants.length > 0) {
        await ServerCall.patch("/hub-services/bulk", {
          ids: keptVariants.map((v) => v.id),
          patch: basePayload,
        });
      }

      // 2. Crea nuovi target selezionati
      const newTargets = targets.filter((t) => !existingKeySet.has(t.key));
      if (newTargets.length === 1) {
        const [t] = newTargets;
        await ServerCall.post("/hub-services", {
          ...basePayload,
          codice: values.codice,
          tipo_utente: t.tipo_utente,
          ruolo_gdo: t.ruolo_gdo,
        });
      } else if (newTargets.length > 1) {
        await ServerCall.post("/hub-services/bulk", {
          ...basePayload,
          codice: values.codice,
          tipi_utente: newTargets.map((t) => ({ tipo_utente: t.tipo_utente, ruolo_gdo: t.ruolo_gdo })),
        });
      }

      // 3. Elimina varianti deselezionate
      for (const v of variantsToDelete ?? []) {
        await ServerCall.delete(`/hub-services/${v.id}`);
      }
    },
    onSuccess: async () => {
      await invalidateAll();
      setDialogState(null);
      showNotification(
        buildNotificationContent(
          "CircleCheck",
          "Gruppo aggiornato",
          "Le modifiche al gruppo servizio sono state applicate correttamente.",
          "text-success"
        ),
        { variant: "success" }
      );
    },
    onError: (error) => {
      showNotification(
        buildNotificationContent(
          "CircleX",
          "Errore nel salvataggio",
          error instanceof Error ? error.message : "Impossibile aggiornare il gruppo servizio.",
          "text-danger"
        ),
        { variant: "error" }
      );
    },
  });

  const openCreateDialog = () => setDialogState({ mode: "create" });

  const openAddVariantDialog = (groupCode: string) => {
    const group = serviceGroups.find((item) => item.codice === groupCode);
    if (!group) return;
    setDialogState({ mode: "add-variant", group });
  };

  const openEditGroupDialog = (group: HubServiceGroup) => {
    setDialogState({ mode: "edit-group", group });
  };

  const requestVariantDeletion = (variant: HubServiceDTO) => {
    setConfirmState({
      title: "Eliminare la variante?",
      description: `Stai per eliminare la variante destinata a ${getServiceTargetLabel(variant)}.`,
      confirmLabel: "Elimina variante",
      variant: "danger",
      onConfirm: () => deleteVariantMutation.mutateAsync(variant.id),
    });
  };

  const requestGroupDeletion = (groupCode: string, groupName: string) => {
    setConfirmState({
      title: "Eliminare il servizio?",
      description: `Stai per eliminare il gruppo "${groupName}" e tutte le sue varianti target.`,
      confirmLabel: "Elimina servizio",
      variant: "danger",
      onConfirm: () => deleteGroupMutation.mutateAsync(groupCode),
    });
  };

  const renderGroupIcon = (group: ReturnType<typeof groupHubServices>[number]) => {
    const colors = getServiceColorClasses(group.colore);
    if (isDataUriIcon(group.icona)) {
      return (
        <div className={clsx("w-14 h-14 rounded-card flex items-center justify-center overflow-hidden shrink-0 border", colors.iconBg, "border-transparent")}>
          <img src={group.icona} alt="" className="w-full h-full object-contain" />
        </div>
      );
    }
    return (
      <div className={clsx("w-14 h-14 rounded-card flex items-center justify-center shrink-0", colors.iconBg)}>
        <Lucide icon={group.icona || "Box"} aria-hidden="true" className={clsx("w-6 h-6", colors.iconText)} />
      </div>
    );
  };

  const azzeraFiltri = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
          <Spinner size="sm" etichetta="Caricamento servizi Hub…" />
          <span aria-hidden="true">Caricamento servizi Hub…</span>
        </div>
      );
    }

    if (isError) {
      return (
        <PageError
          compatta
          titolo="Servizi non caricati"
          motivo="Il servizio non ha restituito l'elenco dei servizi Hub."
          onRiprova={() => refetch()}
        />
      );
    }

    if (serviceGroups.length === 0) {
      return (
        <EmptyState
          compatta
          icon="Blocks"
          title="Nessun servizio configurato"
          description="Crea il primo gruppo servizio e assegna uno o più target."
          buttonText="Crea servizio"
          buttonIcon="Plus"
          onButtonClick={openCreateDialog}
        />
      );
    }

    if (filteredGroups.length === 0) {
      return (
        <EmptyState
          compatta
          icon="SearchX"
          title="Nessun risultato"
          description="Nessun servizio corrisponde ai criteri di ricerca o al filtro selezionato."
          buttonText="Azzera filtri"
          buttonIcon="X"
          onButtonClick={azzeraFiltri}
        />
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {filteredGroups.map((group) => {
          const isExpanded = expandedCodes.includes(group.codice);
          const colors = getServiceColorClasses(group.colore);
          const existingTargetKeys = group.variants.map((v) =>
            createServiceTargetKey(v.tipo_utente, v.ruolo_gdo)
          );
          const activeCount = group.variants.filter((v) => v.attivo).length;
          const maintenanceCount = group.variants.filter((v) => v.in_manutenzione).length;
          const gestito = group.variants.some((v) => v.gestito);

          return (
            <div
              key={group.codice}
              className={clsx("overflow-hidden rounded-card border border-l-4 border-slate-200 bg-white", colors.accentBorder)}
            >
              {/* Group header */}
              <div className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    {renderGroupIcon(group)}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="title-card">{group.nome}</h3>
                        <Badge variant="secondary" size="sm" border className="font-mono">
                          {group.codice}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {group.descrizione || "Nessuna descrizione configurata."}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Badge variant="primary" size="sm">
                          <Lucide icon="Layers" aria-hidden="true" className="h-3 w-3" />
                          {group.variants.length} varianti
                        </Badge>
                        {group.documents.length > 0 && (
                          <Badge variant="primary" size="sm">
                            <Lucide icon="FileStack" aria-hidden="true" className="h-3 w-3" />
                            {group.documents.length} doc
                          </Badge>
                        )}
                        {group.videos.length > 0 && (
                          <Badge variant="info" size="sm">
                            <Lucide icon="Clapperboard" aria-hidden="true" className="h-3 w-3" />
                            {group.videos.length} video
                          </Badge>
                        )}
                        <StatusBadge tono={activeCount > 0 ? "success" : "neutral"} etichetta={`${activeCount} attivi`} />
                        {gestito && (
                          <StatusBadge tono="info" icon="ShieldCheck" etichetta="Gestito da Fidelity" />
                        )}
                        {group.variants.some((v) => v.url_non_configurato) && (
                          <StatusBadge tono="warning" icon="TriangleAlert" etichetta="Indirizzo non configurato: non visibile agli utenti" />
                        )}
                        {maintenanceCount > 0 && (
                          <StatusBadge tono="warning" icon="Wrench" etichetta={`${maintenanceCount} in manutenzione`} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(group.codice)}
                    >
                      <Lucide icon={isExpanded ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      {isExpanded ? "Nascondi" : "Varianti"}
                    </Button>
                    <Button variant="outline-secondary" size="sm" onClick={() => openEditGroupDialog(group)}>
                      <Lucide icon="PencilLine" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                      Modifica
                    </Button>
                    {/* Istanta e Correggo li gestisce Fidelity: varianti fisse, si disattivano invece di eliminarli */}
                    {!gestito && (
                      <Menu className="inline-block text-left">
                        <Menu.Button
                          as={Button}
                          variant="outline-secondary"
                          size="sm"
                          aria-label={`Altre azioni per ${group.nome}`}
                        >
                          <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-3.5 w-3.5" />
                        </Menu.Button>
                        <Menu.Items className="w-52">
                          <Menu.Item onClick={() => openAddVariantDialog(group.codice)}>
                            <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
                            Aggiungi variante
                          </Menu.Item>
                          <Menu.Item className="text-danger" onClick={() => requestGroupDeletion(group.codice, group.nome)}>
                            <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                            Elimina servizio
                          </Menu.Item>
                        </Menu.Items>
                      </Menu>
                    )}
                  </div>
                </div>
              </div>

              {/* Variants panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 p-5">
                  <h4 className="title-eyebrow mb-3">Varianti per target</h4>
                  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {group.variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {getServiceTargetLabel(variant)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                              <Lucide icon="Link" aria-hidden="true" className="h-3 w-3 shrink-0" />
                              <span className="truncate">{getTipoUrlLabel(variant.tipo_url)}</span>
                              <span aria-hidden="true">·</span>
                              <span>ord. {variant.ordine}</span>
                            </div>
                          </div>
                          {!variant.gestito && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="shrink-0"
                              onClick={() => requestVariantDeletion(variant)}
                              aria-label={`Elimina variante ${getServiceTargetLabel(variant)}`}
                            >
                              <Lucide aria-hidden="true" icon="Trash2" className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="break-all text-xs leading-relaxed text-slate-500">{variant.url}</div>
                        {variant.redirect_page && (
                          <div className="break-all text-xs leading-relaxed text-slate-500">
                            Redirect page: <span className="text-slate-600">{variant.redirect_page}</span>
                          </div>
                        )}
                        {(variant.documents.length > 0 || variant.videos.length > 0) && (
                          <div className="flex flex-wrap gap-1.5">
                            {variant.documents.length > 0 && (
                              <Badge variant="primary" size="sm">
                                <Lucide icon="FileText" aria-hidden="true" className="h-3 w-3" />
                                {variant.documents.length} documenti
                              </Badge>
                            )}
                            {variant.videos.length > 0 && (
                              <Badge variant="info" size="sm">
                                <Lucide icon="MonitorPlay" aria-hidden="true" className="h-3 w-3" />
                                {variant.videos.length} video
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge
                            tono={variant.attivo ? "success" : "neutral"}
                            etichetta={variant.attivo ? "Attivo" : "Disattivo"}
                          />
                          {variant.in_manutenzione && (
                            <StatusBadge tono="warning" icon="Wrench" etichetta="Manutenzione" />
                          )}
                          {variant.in_evidenza && (
                            <StatusBadge tono="brand" icon="Star" etichetta="In evidenza" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <ServiceFormDialog
                open={Boolean(
                  dialogState &&
                  dialogState.group?.codice === group.codice &&
                  dialogState.mode === "add-variant"
                )}
                mode="add-variant"
                group={dialogState?.group}
                existingTargetKeys={existingTargetKeys}
                gdoRoleOptions={gdoRoles}
                submitting={saveMutation.isPending || uploadingSharedAssets}
                onClose={() => setDialogState(null)}
                onSubmit={handleSave}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const conFiltri = !isLoading && !isError && serviceGroups.length > 0;

  return (
    <>
      <Sezione
        senzaPadding
        titolo="Servizi Hub"
        descrizione="Gestisci gruppi servizio e varianti per target. Servizi disponibili per tutti i tipi utente tranne Guest; il Superadmin vede sempre tutti i servizi."
        azioni={
          <Button variant="primary" size="sm" onClick={openCreateDialog}>
            <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Nuovo servizio
          </Button>
        }
      >
        {conFiltri && (
          <BarraFiltri
            destra={
              <>
                <Button variant="outline-secondary" size="sm" onClick={expandAll}>
                  <Lucide icon="ChevronsDown" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Espandi tutti
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={collapseAll}>
                  <Lucide icon="ChevronsUp" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Comprimi tutti
                </Button>
              </>
            }
          >
            <CampoRicerca
              etichetta="Cerca servizi"
              placeholder="Cerca per nome o codice…"
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <Segmenti<ServiceStatusFilter>
              etichetta="Stato dei servizi"
              valore={statusFilter}
              onChange={setStatusFilter}
              opzioni={[
                { valore: "all", etichetta: "Tutti", conteggio: serviceGroups.length },
                { valore: "attivo", etichetta: "Attivi", conteggio: serviceGroups.filter((g) => corrispondeStato(g, "attivo")).length },
                { valore: "manutenzione", etichetta: "In manutenzione", conteggio: serviceGroups.filter((g) => corrispondeStato(g, "manutenzione")).length },
                { valore: "inattivo", etichetta: "Inattivi", conteggio: serviceGroups.filter((g) => corrispondeStato(g, "inattivo")).length },
              ]}
            />
          </BarraFiltri>
        )}
        {/* Senza barra dei filtri il padding dell'intestazione basta: niente spazio doppio */}
        <div className={conFiltri ? "p-5" : "px-5 pb-5"}>{renderContent()}</div>
      </Sezione>

      <ServiceFormDialog
        open={dialogState?.mode === "create"}
        mode="create"
        gdoRoleOptions={gdoRoles}
        submitting={saveMutation.isPending || uploadingSharedAssets}
        onClose={() => setDialogState(null)}
        onSubmit={handleSave}
      />

      <ServiceFormDialog
        open={dialogState?.mode === "edit-group"}
        mode="edit-group"
        group={dialogState?.group}
        existingTargetKeys={[]}
        gdoRoleOptions={gdoRoles}
        submitting={editGroupMutation.isPending || uploadingSharedAssets}
        onClose={() => setDialogState(null)}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ""}
        description={confirmState?.description || ""}
        confirmLabel={confirmState?.confirmLabel}
        confirmVariant={confirmState?.variant}
        loading={confirmLoading}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default ServicesTab;
