import Button from "@/components/Base/Button";
import EmptyState from "@/components/EmptyState";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
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
import ConfirmDialog from "./ConfirmDialog";
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

const ServicesTab = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { data: groupedServices = {}, isLoading } = useFetchHubServicesAdmin();
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
      result = result.filter((g) => {
        if (statusFilter === "attivo") return g.variants.some((v) => v.attivo && !v.in_manutenzione);
        if (statusFilter === "manutenzione") return g.variants.some((v) => v.in_manutenzione);
        if (statusFilter === "inattivo") return g.variants.every((v) => !v.attivo);
        return true;
      });
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
        <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border", colors.iconBg, "border-transparent")}>
          <img src={group.icona} alt="" className="w-full h-full object-contain" />
        </div>
      );
    }
    return (
      <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", colors.iconBg)}>
        <Lucide icon={group.icona || "Box"} className={clsx("w-6 h-6", colors.iconText)} />
      </div>
    );
  };

  const activeGroupCount = serviceGroups.filter((g) => g.variants.some((v) => v.attivo)).length;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="box box--stacked p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-800">Servizi Hub</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Gestisci gruppi servizio e varianti per target. Servizi disponibili per tutti i tipi utente eccetto Superadmin e Guest.
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-3">
                {serviceGroups.length > 0 && (
                  <div className="hidden lg:flex items-center gap-4 mr-2 text-sm">
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-800 leading-none">{serviceGroups.length}</div>
                      <div className="text-xs text-slate-500 mt-0.5">gruppi</div>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600 leading-none">{activeGroupCount}</div>
                      <div className="text-xs text-slate-500 mt-0.5">attivi</div>
                    </div>
                  </div>
                )}
                <Button variant="primary" onClick={openCreateDialog}>
                  <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                  Nuovo servizio
                </Button>
              </div>
              {serviceGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline-secondary" size="sm" onClick={expandAll}>
                    <Lucide icon="ChevronsDown" className="w-4 h-4 mr-1.5" />
                    Espandi tutti
                  </Button>
                  <Button variant="outline-secondary" size="sm" onClick={collapseAll}>
                    <Lucide icon="ChevronsUp" className="w-4 h-4 mr-1.5" />
                    Comprimi tutti
                  </Button>
                  <div className="w-px h-5 bg-slate-200 hidden sm:block" />
                  <div className="relative">
                    <Lucide icon="Search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cerca per nome o codice..."
                      className="h-8 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-52"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {serviceGroups.length > 0 && (
          <div className="box box--stacked px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Stato:</span>
              {([
                { value: "all", label: "Tutti" },
                { value: "attivo", label: "Attivi" },
                { value: "manutenzione", label: "In manutenzione" },
                { value: "inattivo", label: "Inattivi" },
              ] as const).map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  className={clsx(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                    statusFilter === pill.value
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="box box--stacked p-10 flex items-center justify-center gap-3 text-slate-500">
            <LoadingIcon icon="oval" className="w-5 h-5" />
            Caricamento servizi Hub...
          </div>
        ) : serviceGroups.length === 0 ? (
          <div className="box box--stacked p-6">
            <EmptyState
              icon="Blocks"
              title="Nessun servizio configurato"
              description="Crea il primo gruppo servizio e assegna uno o più target."
              buttonText="Crea servizio"
              onButtonClick={openCreateDialog}
            />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="box box--stacked p-6">
            <EmptyState
              icon="SearchX"
              title="Nessun risultato"
              description="Nessun servizio corrisponde ai criteri di ricerca o al filtro selezionato."
              buttonText="Azzera filtri"
              onButtonClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
            />
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = expandedCodes.includes(group.codice);
            const colors = getServiceColorClasses(group.colore);
            const existingTargetKeys = group.variants.map((v) =>
              createServiceTargetKey(v.tipo_utente, v.ruolo_gdo)
            );
            const activeCount = group.variants.filter((v) => v.attivo).length;
            const maintenanceCount = group.variants.filter((v) => v.in_manutenzione).length;
            const activeCountClass = activeCount > 0
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-slate-100 border-slate-200 text-slate-500";
            const activeDotClass = activeCount > 0 ? "bg-emerald-500" : "bg-slate-400";

            return (
              <div
                key={group.codice}
                className={clsx(
                  "box box--stacked overflow-hidden border-l-4",
                  colors.accentBorder
                )}
              >
                {/* Group header */}
                <div className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      {renderGroupIcon(group)}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-800">{group.nome}</h3>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-mono text-slate-500">
                            {group.codice}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                          {group.descrizione || "Nessuna descrizione configurata."}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                            <Lucide icon="Layers" className="w-3 h-3" />
                            {group.variants.length} varianti
                          </span>
                          {group.documents.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-1/15 bg-theme-1/[0.08] px-2.5 py-1 text-xs font-medium text-theme-1">
                              <Lucide icon="FileStack" className="w-3 h-3" />
                              {group.documents.length} doc
                            </span>
                          )}
                          {group.videos.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-2/15 bg-theme-2/[0.08] px-2.5 py-1 text-xs font-medium text-theme-2">
                              <Lucide icon="Clapperboard" className="w-3 h-3" />
                              {group.videos.length} video
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${activeCountClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${activeDotClass}`} />
                            {activeCount} attivi
                          </span>
                          {maintenanceCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <Lucide icon="Wrench" className="w-3 h-3" />
                              {maintenanceCount} in manutenzione
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="outline-secondary" size="sm" onClick={() => toggleExpanded(group.codice)}>
                        <Lucide icon={isExpanded ? "ChevronUp" : "ChevronDown"} className="w-4 h-4 mr-1.5" />
                        {isExpanded ? "Nascondi" : "Varianti"}
                      </Button>
                      <Button variant="soft-primary" size="sm" onClick={() => openEditGroupDialog(group)}>
                        <Lucide icon="PencilLine" className="w-4 h-4 mr-1.5" />
                        Modifica
                      </Button>
                      <Button variant="soft-primary" size="sm" onClick={() => openAddVariantDialog(group.codice)}>
                        <Lucide icon="Plus" className="w-4 h-4 mr-1.5" />
                        Variante
                      </Button>
                      <Button variant="soft-danger" size="sm" onClick={() => requestGroupDeletion(group.codice, group.nome)}>
                        <Lucide icon="Trash2" className="w-4 h-4 mr-1.5" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Variants panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Varianti per target
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                      {group.variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">
                                {getServiceTargetLabel(variant)}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                <Lucide icon="Link" className="w-3 h-3 shrink-0" />
                                <span className="truncate">{getTipoUrlLabel(variant.tipo_url)}</span>
                                <span>·</span>
                                <span>ord. {variant.ordine}</span>
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <Button variant="soft-danger" size="sm" onClick={() => requestVariantDeletion(variant)}>
                                <Lucide icon="Trash2" className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400 break-all leading-relaxed">{variant.url}</div>
                          {variant.redirect_page && (
                            <div className="text-xs text-slate-400 break-all leading-relaxed">
                              Redirect page: <span className="text-slate-500">{variant.redirect_page}</span>
                            </div>
                          )}
                          {(variant.documents.length > 0 || variant.videos.length > 0) && (
                            <div className="flex flex-wrap gap-1.5">
                              {variant.documents.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-theme-1/[0.08] px-2 py-0.5 text-xs font-medium text-theme-1">
                                  <Lucide icon="FileText" className="w-3 h-3" />
                                  {variant.documents.length} documenti
                                </span>
                              )}
                              {variant.videos.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-theme-2/[0.08] px-2 py-0.5 text-xs font-medium text-theme-2">
                                  <Lucide icon="MonitorPlay" className="w-3 h-3" />
                                  {variant.videos.length} video
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {variant.attivo ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Attivo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Disattivo
                              </span>
                            )}
                            {variant.in_manutenzione && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <Lucide icon="Wrench" className="w-3 h-3" />
                                Manutenzione
                              </span>
                            )}
                            {variant.in_evidenza && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                                <Lucide icon="Star" className="w-3 h-3" />
                                In evidenza
                              </span>
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
          })
        )}
      </div>

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
