import Button from "@/components/Base/Button";
import EmptyState from "@/components/EmptyState";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import { HUB_QUERY_KEYS, useFetchAllRuoliGDO, useFetchHubNewsAdmin } from "@/query/query";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { ServerCall } from "../../../../lib/server_call";
import type { HubNewsAdminDTO } from "../../../../lib/types";
import type { ConfirmDialogState, NewsDialogState, NewsFormValues, NewsStatusFilter } from "../types";
import {
  buildNewsRecipientOptions,
  deriveNewsStatus,
  formatRoleLabel,
  getNewsStatusMeta,
  isDataUriIcon,
  toIsoString,
} from "../utils";
import ConfirmDialog from "./ConfirmDialog";
import NewsFormDialog from "./NewsFormDialog";

const buildNotificationContent = (icon: string, title: string, message: string, colorClass: string) => (
  <div className="flex items-center gap-3">
    <Lucide icon={icon} className={`w-6 h-6 ${colorClass}`} />
    <div>
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-sm text-slate-500">{message}</div>
    </div>
  </div>
);

const formatDate = (value?: string) => {
  if (!value) return "Non impostata";
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_SORT_ORDER = { online: 0, scheduled: 1, draft: 2, expired: 3 } as const;

const NewsTab = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { data: newsArchive = [], isLoading } = useFetchHubNewsAdmin();
  const { data: gdoRoles = [] } = useFetchAllRuoliGDO();

  const [dialogState, setDialogState] = useState<NewsDialogState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmDialogState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [newsStatusFilter, setNewsStatusFilter] = useState<NewsStatusFilter>("all");

  const recipientOptions = useMemo(() => buildNewsRecipientOptions(gdoRoles), [gdoRoles]);

  const sortedNews = useMemo(() => {
    return [...newsArchive].sort((a, b) => {
      const statusA = deriveNewsStatus(a);
      const statusB = deriveNewsStatus(b);
      const orderDiff = STATUS_SORT_ORDER[statusA] - STATUS_SORT_ORDER[statusB];
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.data_pubblicazione).getTime() - new Date(a.data_pubblicazione).getTime();
    });
  }, [newsArchive]);

  const statusCounts = useMemo(() => {
    const counts = { online: 0, scheduled: 0, draft: 0, expired: 0 };
    for (const item of newsArchive) {
      counts[deriveNewsStatus(item)]++;
    }
    return counts;
  }, [newsArchive]);

  const filteredNews = useMemo(() => {
    if (newsStatusFilter === "all") return sortedNews;
    return sortedNews.filter((item) => deriveNewsStatus(item) === newsStatusFilter);
  }, [sortedNews, newsStatusFilter]);

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.newsAdmin }),
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.news }),
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.servicesAdmin }),
      queryClient.invalidateQueries({ queryKey: HUB_QUERY_KEYS.services }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      mode,
      newsId,
      values,
    }: {
      mode: NewsDialogState["mode"];
      newsId?: string;
      values: NewsFormValues;
    }) => {
      const payload = {
        titolo: values.titolo,
        contenuto: values.contenuto,
        tipo: values.tipo,
        icona: values.icona || undefined,
        url: values.url || undefined,
        in_evidenza: values.in_evidenza,
        attivo: values.attivo,
        data_pubblicazione: toIsoString(values.data_pubblicazione),
        data_scadenza: toIsoString(values.data_scadenza),
        autore_nome: values.autore_nome || undefined,
        ruoli_destinatari: values.ruoli_destinatari,
      };

      if (mode === "edit") {
        if (!newsId) throw new Error("ID news mancante per l'aggiornamento.");
        await ServerCall.put(`/hub-news/${newsId}`, payload);
        return;
      }

      await ServerCall.post("/hub-news", payload);
    },
    onSuccess: async (_, variables) => {
      await invalidateAll();
      setDialogState(null);
      showNotification(
        buildNotificationContent(
          "CircleCheck",
          variables.mode === "edit" ? "News aggiornata" : "News creata",
          variables.mode === "edit"
            ? "La news è stata aggiornata correttamente."
            : "La nuova news è stata salvata correttamente.",
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
          error instanceof Error ? error.message : "Impossibile salvare la news.",
          "text-danger"
        ),
        { variant: "error" }
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (newsId: string) => {
      await ServerCall.delete(`/hub-news/${newsId}`);
    },
    onSuccess: async () => {
      await invalidateAll();
      showNotification(
        buildNotificationContent(
          "Trash2",
          "News eliminata",
          "La news selezionata è stata rimossa correttamente.",
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
          error instanceof Error ? error.message : "Impossibile eliminare la news.",
          "text-danger"
        ),
        { variant: "error" }
      );
    },
  });

  const handleSave = async (values: NewsFormValues) => {
    await saveMutation.mutateAsync({
      mode: dialogState?.mode ?? "create",
      newsId: dialogState?.news?.id,
      values,
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

  const requestDeletion = (news: HubNewsAdminDTO) => {
    setConfirmState({
      title: "Eliminare la news?",
      description: `Stai per eliminare "${news.titolo}". L'operazione non può essere annullata.`,
      confirmLabel: "Elimina news",
      variant: "danger",
      onConfirm: () => deleteMutation.mutateAsync(news.id),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="box box--stacked p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-800">News Hub</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Gestisci l'archivio completo delle news, gli stati di pubblicazione e i destinatari.
              </div>
            </div>
            <div className="flex items-center gap-3">
              {newsArchive.length > 0 && (
                <div className="hidden lg:flex items-center gap-3 mr-2">
                  {statusCounts.online > 0 && (
                    <div className="text-center">
                      <div className="text-xl font-bold text-emerald-600 leading-none">{statusCounts.online}</div>
                      <div className="text-xs text-slate-500 mt-0.5">online</div>
                    </div>
                  )}
                  {statusCounts.scheduled > 0 && (
                    <>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className="text-xl font-bold text-sky-600 leading-none">{statusCounts.scheduled}</div>
                        <div className="text-xs text-slate-500 mt-0.5">progr.</div>
                      </div>
                    </>
                  )}
                  {statusCounts.draft > 0 && (
                    <>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className="text-xl font-bold text-slate-500 leading-none">{statusCounts.draft}</div>
                        <div className="text-xs text-slate-500 mt-0.5">bozze</div>
                      </div>
                    </>
                  )}
                  {statusCounts.expired > 0 && (
                    <>
                      <div className="w-px h-8 bg-slate-200" />
                      <div className="text-center">
                        <div className="text-xl font-bold text-amber-600 leading-none">{statusCounts.expired}</div>
                        <div className="text-xs text-slate-500 mt-0.5">scadute</div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <Button variant="primary" onClick={() => setDialogState({ mode: "create" })}>
                <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                Nuova news
              </Button>
            </div>
          </div>
        </div>

        {newsArchive.length > 0 && (
          <div className="box box--stacked px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mr-1">Stato:</span>
              {([
                { value: "all", label: "Tutti", count: newsArchive.length },
                { value: "online", label: "Online", count: statusCounts.online },
                { value: "scheduled", label: "Programmata", count: statusCounts.scheduled },
                { value: "draft", label: "Bozza", count: statusCounts.draft },
                { value: "expired", label: "Scaduta", count: statusCounts.expired },
              ] as const).map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setNewsStatusFilter(pill.value)}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                    newsStatusFilter === pill.value
                      ? "bg-primary border-primary text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
                  )}
                >
                  {pill.label}
                  {pill.count > 0 && (
                    <span
                      className={clsx(
                        "inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px] font-semibold",
                        newsStatusFilter === pill.value
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {pill.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="box box--stacked p-10 flex items-center justify-center gap-3 text-slate-500">
            <LoadingIcon icon="oval" className="w-5 h-5" />
            Caricamento archivio news...
          </div>
        ) : sortedNews.length === 0 ? (
          <div className="box box--stacked p-6">
            <EmptyState
              icon="Newspaper"
              title="Nessuna news presente"
              description="Crea la prima news Hub per iniziare a popolare l'archivio."
              buttonText="Crea news"
              onButtonClick={() => setDialogState({ mode: "create" })}
            />
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="box box--stacked p-6">
            <EmptyState
              icon="SearchX"
              title="Nessuna news corrisponde al filtro"
              description="Prova a selezionare uno stato diverso o torna a 'Tutti'."
              buttonText="Azzera filtro"
              onButtonClick={() => setNewsStatusFilter("all")}
            />
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredNews.map((news) => {
              const status = deriveNewsStatus(news);
              const statusMeta = getNewsStatusMeta(status);
              const sanitizedContent = sanitizeHtml(news.contenuto);

              return (
                <div key={news.id} className="box box--stacked overflow-hidden">
                  {/* Card header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {isDataUriIcon(news.icona) ? (
                            <img src={news.icona} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Lucide icon={news.icona || "Info"} className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800 truncate">{news.titolo}</h3>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}>
                              <Lucide icon={statusMeta.icon} className="w-3 h-3" />
                              {statusMeta.label}
                            </span>
                            {news.in_evidenza && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <Lucide icon="Star" className="w-3 h-3" />
                                In evidenza
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="capitalize">{news.tipo}</span>
                            {news.autore_nome && (
                              <>
                                <span>·</span>
                                <span>{news.autore_nome}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{formatDate(news.data_pubblicazione)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="outline-secondary" size="sm" onClick={() => setDialogState({ mode: "edit", news })}>
                          <Lucide icon="PencilLine" className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="soft-danger" size="sm" onClick={() => requestDeletion(news)}>
                          <Lucide icon="Trash2" className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Content preview */}
                  <div
                    className="px-5 pb-4 max-h-[5rem] overflow-hidden text-sm leading-relaxed text-slate-500 [&_a]:text-primary [&_a]:underline [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                  />

                  {/* Footer meta */}
                  <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 sm:grid-cols-4">
                    <div>
                      <div className="font-medium text-slate-600 mb-0.5">Scadenza</div>
                      <div>{news.data_scadenza ? formatDate(news.data_scadenza) : "—"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-600 mb-0.5">Destinatari</div>
                      <div className="truncate">
                        {news.ruoli_destinatari.length > 0
                          ? news.ruoli_destinatari
                              .map((role) => (role.startsWith("GDO_") ? formatRoleLabel(role) : role))
                              .join(", ")
                          : "Tutti"}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-slate-600 mb-0.5">URL</div>
                      <div className="truncate">{news.url || "—"}</div>
                    </div>
                    <div className="flex items-end justify-end gap-2 sm:col-auto">
                      <Button variant="outline-secondary" size="sm" onClick={() => setDialogState({ mode: "edit", news })}>
                        <Lucide icon="PencilLine" className="w-3.5 h-3.5 mr-1" />
                        Modifica
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewsFormDialog
        open={Boolean(dialogState)}
        mode={dialogState?.mode ?? "create"}
        news={dialogState?.news}
        recipientOptions={recipientOptions}
        submitting={saveMutation.isPending}
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

export default NewsTab;
