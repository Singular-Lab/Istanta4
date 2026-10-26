import iconaUtente from "@/assets/images/users/user_icon_profile.png";
import Button from "@/components/Base/Button";
import { Slideover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import {
  AttivitaResponse,
  useFetchAttivita,
  useFetchAttivitaCount,
} from "@/query/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidElement } from "react";
import { useMemo, useState } from "react";
import { TIPO_ATTIVITA } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";

interface MainProps {
  notificationsPanel: boolean;
  setNotificationsPanel: (val: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/*  CONFIG                                                                     */
/* -------------------------------------------------------------------------- */

const CATEGORIA_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  ACCOUNT: { label: "Account", icon: "Users", color: "text-primary", bgColor: "bg-primary/10" },
  PRODUZIONE: { label: "Produzione", icon: "Cog", color: "text-pending", bgColor: "bg-pending/10" },
  PUBBLICAZIONE: { label: "Pubblicazione", icon: "Rocket", color: "text-success", bgColor: "bg-success/10" },
  STAMPA: { label: "Stampa", icon: "Printer", color: "text-info", bgColor: "bg-info/10" },
  INTEGRAZIONI: { label: "Integrazioni", icon: "Link", color: "text-warning", bgColor: "bg-warning/10" },
};

/* -------------------------------------------------------------------------- */
/*  HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function groupByDate(items: AttivitaResponse[]): Record<string, AttivitaResponse[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, AttivitaResponse[]> = {
    Oggi: [],
    Ieri: [],
    "Questa settimana": [],
    Precedenti: [],
  };

  for (const item of items) {
    const d = new Date(item.data_creazione);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (day.getTime() === today.getTime()) groups.Oggi.push(item);
    else if (day.getTime() === yesterday.getTime()) groups.Ieri.push(item);
    else if (day >= weekAgo) groups["Questa settimana"].push(item);
    else groups.Precedenti.push(item);
  }

  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0));
}

function groupByCategory(items: AttivitaResponse[]) {
  return items.reduce<Record<string, AttivitaResponse[]>>((acc, item) => {
    const key = item.categoria || "SENZA_CATEGORIA";
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function formatRelativeTime(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);

  if (min < 1) return "Adesso";
  if (min < 60) return `${min} min fa`;
  if (h < 24) return `${h}h fa`;
  if (d < 7) return `${d}g fa`;

  return new Date(date).toLocaleDateString("it-IT");
}

type ViewMode = "time" | "category";

/* -------------------------------------------------------------------------- */
/*  MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

export default function NotificationPanel({
  notificationsPanel,
  setNotificationsPanel,
}: MainProps) {
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("time");
  const queryClient = useQueryClient();

  const attivita = useFetchAttivita({
    categoria: selectedCategoria || undefined,
  });

  const attivitaCount = useFetchAttivitaCount();

  const markAsRead = useMutation({
    mutationFn: (id: string) => ServerCall.put("/mark_as_read", { idAttivita: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attivita"] });
      queryClient.invalidateQueries({ queryKey: ["attivita-count"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => ServerCall.put("/mark_all_as_read", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attivita"] });
      queryClient.invalidateQueries({ queryKey: ["attivita-count"] });
    },
  });

  const groupedByDate = useMemo(
    () => (attivita.data ? groupByDate(attivita.data) : {}),
    [attivita.data]
  );

  const groupedByCategory = useMemo(
    () => (attivita.data ? groupByCategory(attivita.data) : {}),
    [attivita.data]
  );

  const unreadPerCategoria = attivitaCount.data?.per_categoria || {};
  const totalUnread = attivitaCount.data?.totale || 0;

  const categoryOrder = [
    "ACCOUNT",
    "PRODUZIONE",
    "PUBBLICAZIONE",
    "STAMPA",
    "INTEGRAZIONI",
    "SENZA_CATEGORIA",
  ];

  return (
    <Slideover open={notificationsPanel} onClose={() => setNotificationsPanel(false)}>
      <Slideover.Panel className="w-[420px] max-w-full">

        {/* HEADER */}
        <Slideover.Title className="px-5 py-4 border-b border-slate-200/60">
          <div className="flex items-center justify-between  w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lucide icon="Bell" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Notifiche</h2>
                <p className="text-xs text-slate-500">
                  {totalUnread > 0 ? `${totalUnread} non lette` : "Nessuna nuova notifica"}
                </p>
              </div>
            </div>

            {totalUnread > 0 && (
              <Button
                size="sm"
                variant="soft-secondary"
                onClick={() => markAllAsRead.mutate()}
              >
                <Lucide icon="CheckCheck" className="w-4 h-4 mr-1" />
                Segna tutte
              </Button>
            )}
          </div>
        </Slideover.Title>

        {/* FILTRI */}
        <div className="px-5 py-4 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Visualizzazione</span>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {(["time", "category"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === mode
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  {mode === "time" ? "Tempo" : "Categoria"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-500">Filtra per categoria</span>
            <div className="flex flex-wrap gap-2 pb-1">
              <button
                onClick={() => setSelectedCategoria(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${selectedCategoria === null
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600"
                  }`}
              >
                <Lucide icon="LayoutGrid" className="w-3.5 h-3.5" />
                Tutte
              </button>

              {Object.entries(CATEGORIA_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategoria(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${selectedCategoria === key
                    ? "bg-primary text-white"
                    : `${cfg.bgColor} ${cfg.color}`
                    }`}
                >
                  <Lucide icon={cfg.icon as any} className="w-3.5 h-3.5" />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LISTA */}
        <Slideover.Description className="p-0 overflow-y-auto">
          {attivita.isLoading && (
            <div className="py-20 text-center text-slate-500">Caricamento…</div>
          )}

          {!attivita.isLoading &&
            (viewMode === "time"
              ? Object.entries(groupedByDate).map(([label, items]) => (
                <div key={label}>
                  <div className="px-5 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
                    {label} ({items.length})
                  </div>
                  {items.map((item) => (
                    <NotificationItem
                      key={item.id}
                      item={item}
                      onMarkAsRead={() => markAsRead.mutate(item.id)}
                    />
                  ))}
                </div>
              ))
              : categoryOrder
                .filter((c) => groupedByCategory[c])
                .map((cat) => (
                  <div key={cat}>
                    <div className="px-5 py-2 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
                      {CATEGORIA_CONFIG[cat]?.label || "Altro"}
                    </div>
                    {groupedByCategory[cat].map((item) => (
                      <NotificationItem
                        key={item.id}
                        item={item}
                        onMarkAsRead={() => markAsRead.mutate(item.id)}
                        showCategory={false}
                      />
                    ))}
                  </div>
                )))}
        </Slideover.Description>
      </Slideover.Panel>
    </Slideover>
  );
}

/* -------------------------------------------------------------------------- */
/*  ITEM                                                                       */
/* -------------------------------------------------------------------------- */

function NotificationItem({
  item,
  onMarkAsRead,
  showCategory = true,
}: {
  item: AttivitaResponse;
  onMarkAsRead: () => void;
  showCategory?: boolean;
}) {
  const config = item.categoria ? CATEGORIA_CONFIG[item.categoria] : null;

  function renderActivityTitle(tipo: TIPO_ATTIVITA): string {
    const titleMap: Record<TIPO_ATTIVITA, string> = {
      [TIPO_ATTIVITA.CREAZIONE_UTENTE]: "Nuovo utente creato",
      [TIPO_ATTIVITA.ELIMINAZIONE_UTENTE]: "Utente eliminato",
      [TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO]: "Kit automatico creato",
      [TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_MANUALE]: "Kit manuale creato",
      [TIPO_ATTIVITA.UPLOAD_FILE_MANUALE]: "File caricato",
      [TIPO_ATTIVITA.MODIFICA_WORKSPACE_WEBPLIANT]: "Workspace modificato",
      [TIPO_ATTIVITA.CREAZIONE_DESIGN_KIT]: "Design kit creato",
      [TIPO_ATTIVITA.IMPORT_TRACCIATO]: "Tracciato importato",
      [TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE]: "Lavorazione creata",
      [TIPO_ATTIVITA.PUBBLICAZIONE_WEBPLIANT]: "WebPliant pubblicato",
      [TIPO_ATTIVITA.RICHIESTA_WEBPLIANT]: "Richiesta WebPliant",
      [TIPO_ATTIVITA.CREAZIONE_ORDINE_DI_STAMPA]: "Ordine di stampa creato",
      [TIPO_ATTIVITA.INVIO_FILES_FTP]: "File inviati via FTP",
      [TIPO_ATTIVITA.INVIO_FILE_CORREGGO]: "File inviati a Correggo",
      [TIPO_ATTIVITA.PUBBLICAZIONE_FILE_CORREGGO]: "File Correggo pubblicato",
    };

    return titleMap[tipo] || "Attività completata";
  }

  function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
    if (value == null || value === "") return null;
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-slate-400 shrink-0">{label}:</span>
        <span className="truncate">{renderMetaValue(value)}</span>
      </div>
    );
  }

  function formatContextEntry(entry: unknown): string {
    if (!entry || typeof entry !== "object") {
      return String(entry ?? "");
    }

    const ctx = entry as {
      titolo_field?: unknown;
      nome_field?: unknown;
      user_value?: unknown;
    };

    const label = ctx.titolo_field ?? ctx.nome_field ?? "Campo";
    const rawValue = ctx.user_value;
    const value =
      rawValue == null
        ? "-"
        : typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : JSON.stringify(rawValue);

    return `${String(label)}: ${value}`;
  }

  function renderMetaValue(value: unknown): React.ReactNode {
    if (value == null) return null;
    if (isValidElement(value)) return value;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return null;

      return (
        <span className="break-words">
          {value.map((entry, index) => (
            <span key={index}>
              {index > 0 ? ", " : ""}
              {typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"
                ? String(entry)
                : formatContextEntry(entry)}
            </span>
          ))}
        </span>
      );
    }

    if (typeof value === "object") {
      return (
        <span className="break-words">
          {formatContextEntry(value)}
        </span>
      );
    }

    return String(value);
  }

  function MetaBadge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "pending" }) {
    const variantClass = {
      default: "bg-slate-100 text-slate-600",
      success: "bg-success/10 text-success",
      warning: "bg-warning/10 text-warning",
      pending: "bg-pending/10 text-pending",
    }[variant];
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${variantClass}`}>
        {children}
      </span>
    );
  }

  function renderActivityDetails(item: AttivitaResponse): React.ReactNode {
    const meta = item.meta;
    if (!meta) return null;

    switch (item.tipo) {
      case TIPO_ATTIVITA.CREAZIONE_UTENTE: {
        const nomeUtente = [
          meta.cognome_utenti ?? meta.cognome_Utenti,
          meta.nome_utenti ?? meta.nome_Utenti,
        ].filter(Boolean).join(" ");

        return (
          <div className="space-y-0.5">
            <MetaRow label="Utente" value={nomeUtente || "N/D"} />
            <MetaRow label="Email" value={meta.email_utenti} />
            <MetaRow label="Ruolo" value={meta.tipo_utenti} />
          </div>
        );
      }

      case TIPO_ATTIVITA.ELIMINAZIONE_UTENTE: {
        const nomeUtente = [
          meta.cognome_Utenti ?? meta.cognome_utenti,
          meta.nome_Utenti ?? meta.nome_utenti,
        ].filter(Boolean).join(" ");

        return (
          <div className="space-y-0.5">
            <MetaRow label="Utente" value={nomeUtente || meta.nome || "N/D"} />
            <MetaRow label="Email" value={meta.email_utenti} />
          </div>
        );
      }

      case TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_AUTOMATICO:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Kit" value={meta.titolo || meta.nome || "N/D"} />
            <div className="flex items-center gap-2 mt-1">
              <MetaBadge>{meta.tipo || "Automatico"}</MetaBadge>
              {meta.quantita != null && <MetaBadge variant="pending">{meta.quantita} {meta.quantita === 1 ? "copia" : "copie"}</MetaBadge>}
            </div>
          </div>
        );

      case TIPO_ATTIVITA.CREAZIONE_RUNTIME_KIT_MANUALE:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Kit" value={meta.nome_kit || meta.titolo || "Kit manuale"} />
            <div className="flex items-center gap-2 mt-1">
              <MetaBadge>Manuale</MetaBadge>
              {meta.quantita != null && <MetaBadge variant="pending">{meta.quantita} {meta.quantita === 1 ? "kit" : "kit"}</MetaBadge>}
            </div>
          </div>
        );

      case TIPO_ATTIVITA.CREAZIONE_DESIGN_KIT:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Nome" value={meta.nome || meta.titolo || "Design kit"} />
            <div className="flex items-center gap-2 mt-1">
              {meta.tipo && <MetaBadge>{meta.tipo}</MetaBadge>}
              {meta.quantita != null && <MetaBadge variant="pending">{meta.quantita} {meta.quantita === 1 ? "combinazione" : "combinazioni"}</MetaBadge>}
            </div>
          </div>
        );

      case TIPO_ATTIVITA.UPLOAD_FILE_MANUALE:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Kit" value={meta.titolo || meta.nome || "Kit"} />
            {meta.fileName && <MetaRow label="File" value={<span className="break-all">{meta.fileName}</span>} />}
            {meta.dimensione && <MetaRow label="Dimensione" value={meta.dimensione} />}
          </div>
        );

      case TIPO_ATTIVITA.IMPORT_TRACCIATO:
        return (
          <div className="space-y-0.5">
            <MetaRow label="File" value={<span className="break-all">{meta.fileName || meta.nome || "Tracciato"}</span>} />
            {meta.context && <MetaRow label="Contesto" value={meta.context} />}
          </div>
        );

      case TIPO_ATTIVITA.MODIFICA_WORKSPACE_WEBPLIANT:
      case TIPO_ATTIVITA.PUBBLICAZIONE_WEBPLIANT:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Workspace" value={meta.nomeWorkspace || meta.workspace_name || meta.nome_workspace || "Workspace"} />
          </div>
        );

      case TIPO_ATTIVITA.CREAZIONE_LAVORAZIONE:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Promozione" value={meta.nomePromo || meta.nome_lavorazione || meta.lavorazione_name || "Nuova lavorazione"} />
          </div>
        );

      case TIPO_ATTIVITA.CREAZIONE_ORDINE_DI_STAMPA: {
        const statoLabel: Record<string, string> = {
          IN_REVISIONE: "In revisione",
          CONFERMATO: "Confermato",
          IN_LAVORAZIONE: "In lavorazione",
          COMPLETATO: "Completato",
          ANNULLATO: "Annullato",
        };
        const statoBadgeVariant = (stato: string): "default" | "success" | "warning" | "pending" => {
          if (stato === "COMPLETATO") return "success";
          if (stato === "ANNULLATO") return "warning";
          if (stato === "IN_LAVORAZIONE" || stato === "IN_REVISIONE") return "pending";
          return "default";
        };

        return (
          <div className="space-y-0.5">
            {meta.id_ordinistampa && <MetaRow label="Ordine" value={meta.id_ordinistampa} />}
            {meta.numero_ordine && <MetaRow label="N°" value={meta.numero_ordine} />}
            {meta.stato_ordinistampa && (
              <div className="mt-1">
                <MetaBadge variant={statoBadgeVariant(meta.stato_ordinistampa)}>
                  {statoLabel[meta.stato_ordinistampa] || meta.stato_ordinistampa}
                </MetaBadge>
              </div>
            )}
            {meta.data_di_conferma_ordinistampa && (
              <MetaRow label="Conferma" value={new Date(meta.data_di_conferma_ordinistampa).toLocaleDateString("it-IT")} />
            )}
          </div>
        );
      }

      case TIPO_ATTIVITA.INVIO_FILES_FTP:
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {meta.file_totali != null && <MetaBadge variant="success">{meta.file_totali} file</MetaBadge>}
              {meta.kit_totali != null && <MetaBadge variant="pending">{meta.kit_totali} kit</MetaBadge>}
            </div>
          </div>
        );

      case TIPO_ATTIVITA.RICHIESTA_WEBPLIANT:
        return (
          <div className="space-y-0.5">
            <MetaRow label="Tipo" value={meta.tipo_richiesta || "Richiesta generica"} />
          </div>
        );

      case TIPO_ATTIVITA.INVIO_FILE_CORREGGO:
      case TIPO_ATTIVITA.PUBBLICAZIONE_FILE_CORREGGO:
        return (
          <span>
            {meta.dettagli || "File correzione"}
            {meta.versione && (
              <span className="text-slate-400 ml-1">(v{meta.versione})</span>
            )}
          </span>
        );

      default:
        return meta.dettagli ? <span>{meta.dettagli}</span> : null;
    }
  }


  return (
    <div
      onClick={() => !item.is_read && onMarkAsRead()}
      className={`flex px-5 py-4 gap-3 border-b cursor-pointer ${!item.is_read ? "bg-primary/5" : ""
        }`}
    >
      <img
        src={item.photo ? `data:image/png;base64,${item.photo}` : iconaUtente}
        className="w-11 h-11 rounded-full border"
      />

      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">
          {renderActivityTitle(item.tipo)}
        </div>
        <div className="text-xs text-slate-600 mt-1">
          {renderActivityDetails(item)}
        </div>
        <div className="text-xs text-slate-400 mt-2 flex gap-2">
          <span>
            {item.nome_assegnato} {item.cognome_assegnato}
          </span>
          <span>·</span>
          <span>{formatRelativeTime(item.data_creazione)}</span>
          {showCategory && config && (
            <>
              <span>·</span>
              <span className={`${config.bgColor} ${config.color} px-1.5 rounded`}>
                {config.label}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
