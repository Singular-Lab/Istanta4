import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { HUB_QUERY_KEYS, useFetchAllRuoliGDO, useFetchHubNewsAdmin } from "@/query/query";
import { formatDataOra, valoreOAssente } from "@/utils/format";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import ConfirmDialog from "@/components/ConfirmDialog";
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

const STATUS_SORT_ORDER = { online: 0, scheduled: 1, draft: 2, expired: 3 } as const;

const NewsTab = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const { data: newsArchive = [], isLoading, isError, error, refetch } = useFetchHubNewsAdmin();
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

  const openCreateDialog = () => setDialogState({ mode: "create" });

  const renderContent = () => {
    if (isError) {
      return (
        <PageError
          compatta
          titolo="Impossibile caricare le news"
          motivo={error instanceof Error ? error.message : "Il servizio non ha restituito l'archivio delle news."}
          onRiprova={() => void refetch()}
        />
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
          <Spinner size="sm" etichetta="Caricamento archivio news…" />
          <span aria-hidden="true">Caricamento archivio news…</span>
        </div>
      );
    }

    if (sortedNews.length === 0) {
      return (
        <EmptyState
          compatta
          icon="Newspaper"
          title="Nessuna news presente"
          description="Crea la prima news Hub per iniziare a popolare l'archivio."
          buttonText="Crea news"
          buttonIcon="Plus"
          onButtonClick={openCreateDialog}
        />
      );
    }

    if (filteredNews.length === 0) {
      return (
        <EmptyState
          compatta
          icon="SearchX"
          title="Nessuna news corrisponde al filtro"
          description="Prova a selezionare uno stato diverso o torna a 'Tutti'."
          buttonText="Azzera filtro"
          buttonIcon="RotateCcw"
          onButtonClick={() => setNewsStatusFilter("all")}
        />
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {filteredNews.map((news) => {
          const status = deriveNewsStatus(news);
          const statusMeta = getNewsStatusMeta(status);
          const sanitizedContent = sanitizeHtml(news.contenuto);

          return (
            <article key={news.id} className="overflow-hidden rounded-card border border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-slate-50">
                    {isDataUriIcon(news.icona) ? (
                      <img src={news.icona} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <Lucide icon={news.icona || "Info"} aria-hidden="true" className="h-5 w-5 text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="title-card truncate">{news.titolo}</h3>
                      <StatusBadge tono={statusMeta.tono} etichetta={statusMeta.label} icon={statusMeta.icon} />
                      {news.in_evidenza && <StatusBadge tono="brand" etichetta="In evidenza" icon="Star" />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="capitalize">{news.tipo}</span>
                      {news.autore_nome && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{news.autore_nome}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDataOra(news.data_pubblicazione)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setDialogState({ mode: "edit", news })}
                    aria-label={`Modifica news ${news.titolo}`}
                  >
                    <Lucide aria-hidden="true" icon="PencilLine" className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => requestDeletion(news)}
                    aria-label={`Elimina news ${news.titolo}`}
                  >
                    <Lucide aria-hidden="true" icon="Trash2" className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Anteprima del contenuto */}
              <div
                className="max-h-20 overflow-hidden px-4 pb-4 text-sm leading-relaxed text-slate-500 [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />

              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="mb-0.5 font-medium text-slate-600">Scadenza</dt>
                  <dd className="tabular-nums">{formatDataOra(news.data_scadenza)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="mb-0.5 font-medium text-slate-600">Destinatari</dt>
                  <dd className="truncate">
                    {news.ruoli_destinatari.length > 0
                      ? news.ruoli_destinatari
                          .map((role) => (role.startsWith("GDO_") ? formatRoleLabel(role) : role))
                          .join(", ")
                      : "Tutti"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="mb-0.5 font-medium text-slate-600">URL</dt>
                  <dd className="truncate">{valoreOAssente(news.url)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Sezione
        senzaPadding
        titolo="News Hub"
        descrizione="Gestisci l'archivio completo delle news, gli stati di pubblicazione e i destinatari."
        azioni={
          <Button variant="primary" size="sm" onClick={openCreateDialog}>
            <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Nuova news
          </Button>
        }
      >
        {newsArchive.length > 0 && (
          <BarraFiltri>
            <Segmenti<NewsStatusFilter>
              etichetta="Stato delle news"
              valore={newsStatusFilter}
              onChange={setNewsStatusFilter}
              opzioni={[
                { valore: "all", etichetta: "Tutte", conteggio: newsArchive.length },
                { valore: "online", etichetta: "Online", conteggio: statusCounts.online },
                { valore: "scheduled", etichetta: "Programmate", conteggio: statusCounts.scheduled },
                { valore: "draft", etichetta: "Bozze", conteggio: statusCounts.draft },
                { valore: "expired", etichetta: "Scadute", conteggio: statusCounts.expired },
              ]}
            />
          </BarraFiltri>
        )}
        {/* Senza barra dei filtri il padding dell'intestazione basta: niente spazio doppio */}
        <div className={newsArchive.length > 0 ? "p-5" : "px-5 pb-5"}>{renderContent()}</div>
      </Sezione>

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
