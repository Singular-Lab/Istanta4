import { TIPO_UTENTI } from "../../../lib/enums";
import { readHubServiceRedirectPage } from "../../../lib/hubServiceRedirect";
import type { HubNewsAdminDTO, HubServiceDTO } from "../../../lib/types";
import type { HubServiceColor, HubServiceGroup, NewsFormValues, NewsStatus, NewsStatusMeta, ServiceFormValues, ServiceTargetOption } from "./types";

export const SERVICE_COLOR_OPTIONS: Array<{ value: HubServiceColor; label: string }> = [
  { value: "primary", label: "Primary" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

export const SERVICE_TIPO_URL_OPTIONS: Array<{ value: HubServiceDTO["tipo_url"]; label: string }> = [
  { value: "internal", label: "Interno" },
  { value: "external", label: "Esterno" },
  { value: "external_fico", label: "Esterno FICO" },
];

export const NEWS_TYPE_OPTIONS: Array<{ value: HubNewsAdminDTO["tipo"]; label: string }> = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "success", label: "Success" },
  { value: "update", label: "Update" },
];

const ALL_SERVICE_USER_TYPES: Array<{ tipo_utente: string; label: string }> = [
  { tipo_utente: TIPO_UTENTI.SUPERADMIN, label: "Superadmin" },
  { tipo_utente: TIPO_UTENTI.AGENZIA, label: "Agenzia" },
  { tipo_utente: TIPO_UTENTI.CATEGORY, label: "Category" },
  { tipo_utente: TIPO_UTENTI.MARKETING, label: "Marketing" },
  { tipo_utente: TIPO_UTENTI.PUNTOVENDITA, label: "Punto Vendita" },
  { tipo_utente: TIPO_UTENTI.GDO, label: "GDO" },
  { tipo_utente: TIPO_UTENTI.IT, label: "Reparto IT" },
];

const NEWS_ROLE_TARGETS: Array<{ value: string; label: string }> = [
  { value: TIPO_UTENTI.AGENZIA, label: "Agenzia" },
  { value: TIPO_UTENTI.CATEGORY, label: "Category" },
  { value: TIPO_UTENTI.MARKETING, label: "Marketing" },
  { value: TIPO_UTENTI.PUNTOVENDITA, label: "Punto Vendita" },
  { value: TIPO_UTENTI.GDO, label: "GDO generico" },
  { value: TIPO_UTENTI.IT, label: "Reparto IT" },
];

export const SERVICE_COLOR_MAP: Record<string, { iconBg: string; iconText: string; accentBorder: string }> = {
  primary: { iconBg: "bg-primary/10", iconText: "text-primary", accentBorder: "border-l-primary" },
  info: { iconBg: "bg-sky-50", iconText: "text-sky-600", accentBorder: "border-l-sky-400" },
  success: { iconBg: "bg-emerald-50", iconText: "text-emerald-600", accentBorder: "border-l-emerald-400" },
  warning: { iconBg: "bg-amber-50", iconText: "text-amber-600", accentBorder: "border-l-amber-400" },
  danger: { iconBg: "bg-red-50", iconText: "text-red-600", accentBorder: "border-l-red-400" },
};

export function getServiceColorClasses(colore?: string | null) {
  return SERVICE_COLOR_MAP[colore ?? "primary"] ?? SERVICE_COLOR_MAP.primary;
}

export function createServiceTargetKey(tipo_utente: string, ruolo_gdo?: string | null): string {
  return `${tipo_utente}::${ruolo_gdo ?? "*"}`;
}

export function formatRoleLabel(value?: string | null): string {
  if (!value) return "";
  const withoutPrefix = value.replace(/^GDO_/, "");
  return withoutPrefix
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0) + chunk.slice(1).toLowerCase())
    .join(" ");
}

export function getServiceTargetLabel(service: Pick<HubServiceDTO, "tipo_utente" | "ruolo_gdo">): string {
  if (!service.ruolo_gdo) {
    return service.tipo_utente;
  }
  return `${service.tipo_utente} · ${formatRoleLabel(service.ruolo_gdo)}`;
}

export function buildServiceTargetOptions(gdoRoles: Array<{ ruolo: string }>): ServiceTargetOption[] {
  const normalizedRoles = gdoRoles.map((role) => {
    const key = role.ruolo.startsWith("GDO_") ? role.ruolo.toUpperCase() : `GDO_${role.ruolo.toUpperCase()}`;
    return { key, label: formatRoleLabel(key) };
  });

  return ALL_SERVICE_USER_TYPES.flatMap((type) => [
    {
      key: createServiceTargetKey(type.tipo_utente, null),
      label: "Nessun ruolo specifico",
      tipo_utente: type.tipo_utente,
      ruolo_gdo: null,
      category: "base" as const,
    },
    ...normalizedRoles.map((role) => ({
      key: createServiceTargetKey(type.tipo_utente, role.key),
      label: role.label,
      tipo_utente: type.tipo_utente,
      ruolo_gdo: role.key,
      category: "with_role" as const,
    })),
  ]);
}

export function buildNewsRecipientOptions(gdoRoles: Array<{ ruolo: string }>): Array<{ value: string; label: string }> {
  return [
    ...NEWS_ROLE_TARGETS,
    ...gdoRoles.map((role) => {
      const normalizedRole = role.ruolo.startsWith("GDO_") ? role.ruolo.toUpperCase() : `GDO_${role.ruolo.toUpperCase()}`;
      return {
        value: normalizedRole,
        label: `GDO · ${formatRoleLabel(normalizedRole)}`,
      };
    }),
  ];
}

export function groupHubServices(grouped: Record<string, HubServiceDTO[]>): HubServiceGroup[] {
  return Object.entries(grouped)
    .map(([codice, variants]) => {
      const sortedVariants = [...variants].sort((left, right) => {
        return (
          left.ordine - right.ordine ||
          left.tipo_utente.localeCompare(right.tipo_utente) ||
          (left.ruolo_gdo || "").localeCompare(right.ruolo_gdo || "")
        );
      });

      const firstVariant = sortedVariants[0];

      return {
        codice,
        nome: firstVariant?.nome ?? codice,
        descrizione: firstVariant?.descrizione ?? "",
        icona: firstVariant?.icona ?? "Box",
        colore: firstVariant?.colore ?? "primary",
        documents: firstVariant?.documents ?? [],
        videos: firstVariant?.videos ?? [],
        variants: sortedVariants,
      };
    })
    .sort((left, right) => {
      const leftOrder = left.variants[0]?.ordine ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.variants[0]?.ordine ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.codice.localeCompare(right.codice);
    });
}

export function getInitialServiceFormValues(service?: Partial<HubServiceDTO>): ServiceFormValues {
  return {
    codice: service?.codice ?? "",
    nome: service?.nome ?? "",
    descrizione: service?.descrizione ?? "",
    icona: service?.icona ?? "Box",
    colore: (service?.colore as HubServiceColor) ?? "primary",
    url: service?.url ?? "",
    redirect_page: service?.redirect_page ?? readHubServiceRedirectPage(service?.meta, service?.url) ?? "",
    tipo_url: service?.tipo_url ?? "internal",
    ordine: service?.ordine ?? 0,
    attivo: service?.attivo ?? true,
    in_manutenzione: service?.in_manutenzione ?? false,
    in_evidenza: service?.in_evidenza ?? false,
    documents: (service?.documents ?? []).map((document) => ({ ...document })),
    videos: (service?.videos ?? []).map((video) => ({ ...video })),
  };
}

function toDateTimeLocal(value?: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getInitialNewsFormValues(news?: HubNewsAdminDTO): NewsFormValues {
  return {
    titolo: news?.titolo ?? "",
    contenuto: news?.contenuto ?? "",
    tipo: news?.tipo ?? "info",
    icona: news?.icona ?? "Info",
    url: news?.url ?? "",
    in_evidenza: news?.in_evidenza ?? false,
    attivo: news?.attivo ?? true,
    data_pubblicazione: toDateTimeLocal(news?.data_pubblicazione) || toDateTimeLocal(new Date().toISOString()),
    data_scadenza: toDateTimeLocal(news?.data_scadenza),
    autore_nome: news?.autore_nome ?? "",
    ruoli_destinatari: news?.ruoli_destinatari ?? [],
  };
}

export function toIsoString(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export function deriveNewsStatus(news: Pick<HubNewsAdminDTO, "attivo" | "data_pubblicazione" | "data_scadenza">): NewsStatus {
  if (!news.attivo) {
    return "draft";
  }

  const now = new Date();
  const publicationDate = new Date(news.data_pubblicazione);
  const expirationDate = news.data_scadenza ? new Date(news.data_scadenza) : null;

  if (publicationDate.getTime() > now.getTime()) {
    return "scheduled";
  }

  if (expirationDate && expirationDate.getTime() <= now.getTime()) {
    return "expired";
  }

  return "online";
}

export function getNewsStatusMeta(status: NewsStatus): NewsStatusMeta {
  switch (status) {
    case "draft":
      return {
        label: "Bozza / Disattiva",
        className: "bg-slate-100 text-slate-600 border-slate-200",
        icon: "FileText",
      };
    case "scheduled":
      return {
        label: "Programmata",
        className: "bg-sky-50 text-sky-700 border-sky-200",
        icon: "CalendarClock",
      };
    case "expired":
      return {
        label: "Scaduta",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: "Clock3",
      };
    case "online":
    default:
      return {
        label: "Online",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: "BadgeCheck",
      };
  }
}

export function getTipoUrlLabel(tipoUrl: HubServiceDTO["tipo_url"]): string {
  return SERVICE_TIPO_URL_OPTIONS.find((option) => option.value === tipoUrl)?.label ?? tipoUrl;
}

export function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Impossibile convertire il file selezionato."));
    };

    reader.onerror = () => {
      reject(new Error("Impossibile leggere il file selezionato."));
    };

    reader.readAsDataURL(file);
  });
}

export function isDataUriIcon(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith("data:");
}
