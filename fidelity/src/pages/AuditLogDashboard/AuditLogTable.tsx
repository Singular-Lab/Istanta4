import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import dayjs from "dayjs";
import { FC, Fragment, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AuditLogRecord } from "../../../lib/auditTypes";
import {
  AUDIT_EVENT_LABELS,
  AUDIT_SEVERITY_LABELS,
  AuditEventType,
  AuditSeverity,
} from "../../../lib/auditTypes";

interface AuditLogTableProps {
  items: AuditLogRecord[];
  sortBy: string;
  sortOrder: "ASC" | "DESC";
  onSort: (field: string) => void;
}

// ── Event categories with icons & colors ──

type EventCategory = "auth" | "user" | "security" | "system" | "data";

const EVENT_CATEGORY_MAP: Record<string, EventCategory> = {
  LOGIN_SUCCESS: "auth",
  LOGIN_FAILED: "auth",
  LOGOUT: "auth",
  SESSION_EXPIRED: "auth",
  ACCESS_GRANTED: "auth",
  ACCESS_DENIED: "security",
  PERMISSION_ESCALATION: "security",
  USER_CREATED: "user",
  USER_UPDATED: "user",
  USER_DELETED: "user",
  USER_ROLE_CHANGED: "user",
  SUSPICIOUS_ACTIVITY: "security",
  RATE_LIMIT_EXCEEDED: "security",
  CSRF_TOKEN_INVALID: "security",
  SECURITY_VIOLATION: "security",
  SYSTEM_ERROR: "system",
  CONFIGURATION_CHANGED: "system",
  DATA_EXPORT: "data",
  SENSITIVE_DATA_ACCESS: "data",
  BULK_OPERATION: "data",
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  auth: "Autenticazione",
  user: "Utente",
  security: "Sicurezza",
  system: "Sistema",
  data: "Dati",
};

const CATEGORY_STYLES: Record<
  EventCategory,
  { icon: string; bg: string; text: string; border: string; stripe: string }
> = {
  auth: {
    icon: "KeyRound",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    stripe: "bg-blue-400",
  },
  user: {
    icon: "UserCog",
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    stripe: "bg-violet-400",
  },
  security: {
    icon: "ShieldAlert",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    stripe: "bg-rose-400",
  },
  system: {
    icon: "Settings",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    stripe: "bg-amber-400",
  },
  data: {
    icon: "Database",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    stripe: "bg-emerald-400",
  },
};

// ── Event-specific icons ──

const EVENT_ICONS: Partial<Record<string, string>> = {
  LOGIN_SUCCESS: "LogIn",
  LOGIN_FAILED: "LogIn",
  LOGOUT: "LogOut",
  SESSION_EXPIRED: "Clock",
  ACCESS_GRANTED: "LockOpen",
  ACCESS_DENIED: "Lock",
  PERMISSION_ESCALATION: "CircleArrowUp",
  USER_CREATED: "UserPlus",
  USER_UPDATED: "UserPen",
  USER_DELETED: "UserMinus",
  USER_ROLE_CHANGED: "UserCog",
  SUSPICIOUS_ACTIVITY: "Eye",
  RATE_LIMIT_EXCEEDED: "Gauge",
  CSRF_TOKEN_INVALID: "ShieldOff",
  SECURITY_VIOLATION: "ShieldAlert",
  SYSTEM_ERROR: "OctagonAlert",
  CONFIGURATION_CHANGED: "Settings",
  DATA_EXPORT: "Download",
  SENSITIVE_DATA_ACCESS: "FileKey",
  BULK_OPERATION: "Layers",

};

// ── Severity styles — stripe colora il bordo sinistro, row tinge lo sfondo ──

const SEVERITY_STYLES: Record<
  string,
  { dot: string; bg: string; text: string; stripe: string; rowTint: string }
> = {
  CRITICAL: {
    dot: "bg-red-500 animate-pulse",
    bg: "bg-red-50",
    text: "text-red-700",
    stripe: "bg-red-500",
    rowTint: "bg-red-50/60",
  },
  HIGH: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    stripe: "bg-amber-400",
    rowTint: "bg-amber-50/40",
  },
  MEDIUM: {
    dot: "bg-sky-400",
    bg: "bg-sky-50",
    text: "text-sky-700",
    stripe: "bg-sky-400",
    rowTint: "",
  },
  LOW: {
    dot: "bg-slate-300",
    bg: "bg-slate-100",
    text: "text-slate-500",
    stripe: "bg-slate-300",
    rowTint: "",
  },
};

// ── Result styles ──

const RESULT_CONFIG: Record<
  string,
  { icon: string; label: string; bg: string; text: string }
> = {
  SUCCESS: {
    icon: "Check",
    label: "OK",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
  },
  FAILURE: {
    icon: "X",
    label: "Fallito",
    bg: "bg-red-50",
    text: "text-red-600",
  },
  PARTIAL: {
    icon: "AlertTriangle",
    label: "Parziale",
    bg: "bg-amber-50",
    text: "text-amber-600",
  },
};

// ── User role styles ──

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  Superadmin: { bg: "bg-purple-100", text: "text-purple-700" },
  Agenzia: { bg: "bg-blue-100", text: "text-blue-700" },
  GDO: { bg: "bg-teal-100", text: "text-teal-700" },
  AdminGDO: { bg: "bg-cyan-100", text: "text-cyan-700" },
  PuntoVendita: { bg: "bg-orange-100", text: "text-orange-700" },
  Guest: { bg: "bg-slate-100", text: "text-slate-500" },
};

// ── User-Agent parser ──

interface ParsedUA {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  device: "desktop" | "mobile" | "tablet" | "bot";
  browserIcon: string;
  osIcon: string;
}

function parseUserAgent(ua: string): ParsedUA {
  const result: ParsedUA = {
    browser: null,
    browserVersion: null,
    os: null,
    osVersion: null,
    device: "desktop",
    browserIcon: "Globe",
    osIcon: "Monitor",
  };

  // Device type
  if (/bot|crawl|spider|slurp|googlebot/i.test(ua)) {
    result.device = "bot";
  } else if (/tablet|ipad/i.test(ua)) {
    result.device = "tablet";
  } else if (/mobile|iphone|android.*mobile|opera mini|iemobile/i.test(ua)) {
    result.device = "mobile";
  }

  // OS detection
  const osPatterns: [RegExp, string, string][] = [
    [/Windows NT 10\.0/i, "Windows", "10/11"],
    [/Windows NT 6\.3/i, "Windows", "8.1"],
    [/Windows NT 6\.2/i, "Windows", "8"],
    [/Windows NT 6\.1/i, "Windows", "7"],
    [/Mac OS X ([\d._]+)/i, "macOS", ""],
    [/Android ([\d.]+)/i, "Android", ""],
    [/iPhone OS ([\d_]+)/i, "iOS", ""],
    [/iPad.*OS ([\d_]+)/i, "iPadOS", ""],
    [/Linux/i, "Linux", ""],
    [/CrOS/i, "ChromeOS", ""],
  ];
  for (const [re, name, fallbackVer] of osPatterns) {
    const m = ua.match(re);
    if (m) {
      result.os = name;
      if (m[1]) {
        result.osVersion = m[1].replace(/_/g, ".");
      } else if (fallbackVer) {
        result.osVersion = fallbackVer;
      }
      break;
    }
  }

  // OS icons
  if (result.os === "Windows") result.osIcon = "Monitor";
  else if (result.os === "macOS") result.osIcon = "Laptop";
  else if (result.os === "Android") result.osIcon = "Smartphone";
  else if (result.os === "iOS" || result.os === "iPadOS") result.osIcon = "Smartphone";
  else if (result.os === "Linux") result.osIcon = "Terminal";

  // Browser detection (order matters — check specific before generic)
  const browserPatterns: [RegExp, string, string][] = [
    [/Edg(?:e|A)?\/([\d.]+)/i, "Edge", ""],
    [/OPR\/([\d.]+)/i, "Opera", ""],
    [/Vivaldi\/([\d.]+)/i, "Vivaldi", ""],
    [/Brave/i, "Brave", ""],
    [/SamsungBrowser\/([\d.]+)/i, "Samsung Internet", ""],
    [/Firefox\/([\d.]+)/i, "Firefox", ""],
    [/Chrome\/([\d.]+)/i, "Chrome", ""],
    [/Safari\/([\d.]+)/i, "Safari", ""],
    [/MSIE ([\d.]+)/i, "Internet Explorer", ""],
    [/Trident\/.*rv:([\d.]+)/i, "Internet Explorer", ""],
  ];
  for (const [re, name] of browserPatterns) {
    const m = ua.match(re);
    if (m) {
      result.browser = name;
      if (m[1]) {
        // Show only major.minor
        const parts = m[1].split(".");
        result.browserVersion = parts.slice(0, 2).join(".");
      }
      break;
    }
  }

  // Browser icons
  if (result.browser === "Chrome") result.browserIcon = "Globe";
  else if (result.browser === "Firefox") result.browserIcon = "Globe";
  else if (result.browser === "Safari") result.browserIcon = "Compass";
  else if (result.browser === "Edge") result.browserIcon = "Globe";

  return result;
}

const DEVICE_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  desktop: { label: "Desktop", icon: "Monitor", bg: "bg-slate-100", text: "text-slate-600" },
  mobile: { label: "Mobile", icon: "Smartphone", bg: "bg-sky-50", text: "text-sky-600" },
  tablet: { label: "Tablet", icon: "Tablet", bg: "bg-violet-50", text: "text-violet-600" },
  bot: { label: "Bot", icon: "Bot", bg: "bg-amber-50", text: "text-amber-600" },
};

// ── Parsed UA display component ──

const UserAgentDisplay: FC<{ raw: string }> = ({ raw }) => {
  const parsed = parseUserAgent(raw);
  const deviceCfg = DEVICE_CONFIG[parsed.device];

  return (
    <div className="flex flex-col gap-2.5">
      {/* Chip row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Browser chip */}
        {parsed.browser && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
            <Lucide icon={parsed.browserIcon} className="w-3.5 h-3.5 text-slate-500 flex-none" />
            <span className="text-xs font-semibold text-slate-700">
              {parsed.browser}
            </span>
            {parsed.browserVersion && (
              <span className="text-[10px] text-slate-400 font-mono">
                v{parsed.browserVersion}
              </span>
            )}
          </div>
        )}

        {/* OS chip */}
        {parsed.os && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200">
            <Lucide icon={parsed.osIcon} className="w-3.5 h-3.5 text-slate-500 flex-none" />
            <span className="text-xs font-semibold text-slate-700">
              {parsed.os}
            </span>
            {parsed.osVersion && (
              <span className="text-[10px] text-slate-400 font-mono">
                {parsed.osVersion}
              </span>
            )}
          </div>
        )}

        {/* Device chip */}
        <div className={clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border",
          deviceCfg.bg,
          "border-transparent"
        )}>
          <Lucide icon={deviceCfg.icon} className={clsx("w-3.5 h-3.5 flex-none", deviceCfg.text)} />
          <span className={clsx("text-xs font-semibold", deviceCfg.text)}>
            {deviceCfg.label}
          </span>
        </div>
      </div>

      {/* Raw UA collapsed */}
      <details className="group/ua">
        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-500 transition-colors select-none w-fit">
          Mostra stringa completa
        </summary>
        <div className="mt-1.5 px-2.5 py-2 rounded-md bg-slate-900 text-slate-300 text-[11px] font-mono break-all leading-relaxed max-w-lg">
          {raw}
        </div>
      </details>
    </div>
  );
};

// ── Detail labels (Italian) ──

const DETAIL_LABELS: Record<string, string> = {
  reason: "Motivo",
  message: "Messaggio",
  error: "Errore",
  method: "Metodo",
  path: "Percorso",
  statusCode: "Codice stato",
  duration: "Durata",
  requestId: "ID richiesta",
  oldValue: "Vecchio valore",
  newValue: "Nuovo valore",
  field: "Campo",
  changes: "Modifiche",
  count: "Conteggio",
  email: "Email",
  role: "Ruolo",
  username: "Username",
  browser: "Browser",
  os: "Sistema operativo",
};

// ── Sort header ──

const SortHeader: FC<{
  label: string;
  field: string;
  currentSort: string;
  currentOrder: "ASC" | "DESC";
  onSort: (field: string) => void;
}> = ({ label, field, currentSort, currentOrder, onSort }) => (
  <th
    className="whitespace-nowrap cursor-pointer select-none group/sort px-4 py-3 text-left first:pl-8"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1.5">
      {label}
      <span
        className={clsx(
          "transition-opacity",
          currentSort === field
            ? "opacity-100"
            : "opacity-0 group-hover/sort:opacity-40"
        )}
      >
        <Lucide
          icon={
            currentSort === field && currentOrder === "ASC"
              ? "ChevronUp"
              : "ChevronDown"
          }
          className="w-3.5 h-3.5"
        />
      </span>
    </div>
  </th>
);

// ── Detail value renderer ──

const DetailValue: FC<{ value: unknown }> = ({ value }) => {
  if (value === null || value === undefined)
    return <span className="text-slate-400 italic">null</span>;
  if (typeof value === "boolean")
    return (
      <span
        className={clsx(
          "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
          value ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}
      >
        {value ? "true" : "false"}
      </span>
    );
  if (typeof value === "number")
    return <span className="font-mono text-slate-700">{value}</span>;
  if (typeof value === "object")
    return (
      <pre className="mt-1 p-2.5 rounded-md bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-40 leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  return <span className="text-slate-700 break-all">{String(value)}</span>;
};

// ── Main component ──

const AuditLogTable: FC<AuditLogTableProps> = ({
  items,
  sortBy,
  sortOrder,
  onSort,
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const detailRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleRow = useCallback(
    (id: string) => setExpandedRow((prev) => (prev === id ? null : id)),
    []
  );

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
          <Lucide icon="FileSearch" className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">
          Nessun evento trovato
        </p>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
          Prova a modificare i filtri di ricerca o il periodo selezionato
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200">
            <SortHeader
              label="Quando"
              field="createdat"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={onSort}
            />
            <SortHeader
              label="Evento"
              field="event_type"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={onSort}
            />
            <SortHeader
              label="Severità"
              field="severity"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={onSort}
            />
            <th className="whitespace-nowrap px-4 py-3 text-left">Utente</th>
            <th className="whitespace-nowrap px-4 py-3 text-left">Azione</th>
            <th className="whitespace-nowrap px-4 py-3 text-left">Risorsa</th>
            <SortHeader
              label="Esito"
              field="result"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={onSort}
            />
            <th className="whitespace-nowrap w-10 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((row) => {
            const isExpanded = expandedRow === row.id_audit_log;
            const eventLabel =
              AUDIT_EVENT_LABELS[row.event_type as AuditEventType] ??
              row.event_type;
            const sevLabel =
              AUDIT_SEVERITY_LABELS[row.severity as AuditSeverity] ??
              row.severity;
            const category =
              EVENT_CATEGORY_MAP[row.event_type] ?? "system";
            const catStyle = CATEGORY_STYLES[category];
            const catLabel = CATEGORY_LABELS[category];
            const eventIcon = EVENT_ICONS[row.event_type] ?? catStyle.icon;
            const sevStyle =
              SEVERITY_STYLES[row.severity] ?? SEVERITY_STYLES.LOW;
            const resultCfg = RESULT_CONFIG[row.result] ?? {
              icon: "Minus",
              label: row.result,
              bg: "bg-slate-100",
              text: "text-slate-500",
            };
            const userName = (
              (row.user_name ?? "") +
              " " +
              (row.user_surname ?? "")
            ).trim();
            const roleStyle = row.user_type
              ? ROLE_STYLES[row.user_type] ?? {
                bg: "bg-slate-100",
                text: "text-slate-500",
              }
              : null;

            const hasDetails =
              (row.details && Object.keys(row.details).length > 0) ||
              row.target_entity_type ||
              row.user_agent;

            const ts = dayjs(row.createdat);
            const relative = ts.fromNow();
            const isCriticalOrHigh =
              row.severity === "CRITICAL" || row.severity === "HIGH";

            return (
              <Fragment key={row.id_audit_log}>
                <tr
                  className={clsx(
                    "group transition-colors relative",
                    hasDetails && "cursor-pointer",
                    isExpanded
                      ? "bg-slate-50"
                      : isCriticalOrHigh
                        ? sevStyle.rowTint
                        : "hover:bg-slate-50/70"
                  )}
                  onClick={() => hasDetails && toggleRow(row.id_audit_log)}
                >
                  {/* Quando — relative time primary, absolute secondary */}
                  <td className="whitespace-nowrap px-4 py-3 first:pl-8">
                    {/* Severity stripe */}
                    <div
                      className={clsx(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-r-full",
                        sevStyle.stripe
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-700">
                        {relative}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                        {ts.format("DD MMM YYYY · HH:mm:ss")}
                      </span>
                    </div>
                  </td>

                  {/* Evento — icon + label + subtle category */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={clsx(
                          "flex items-center justify-center w-8 h-8 rounded-lg flex-none",
                          catStyle.bg,
                          catStyle.border,
                          "border"
                        )}
                      >
                        <Lucide
                          icon={eventIcon}
                          className={clsx("w-4 h-4", catStyle.text)}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-700 leading-tight truncate">
                          {eventLabel}
                        </span>
                        <span
                          className={clsx(
                            "text-[10px] font-medium mt-0.5",
                            catStyle.text
                          )}
                        >
                          {catLabel}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Severità — dot + label */}
                  <td className="px-4 py-3">
                    <div
                      className={clsx(
                        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full",
                        sevStyle.bg
                      )}
                    >
                      <span
                        className={clsx(
                          "w-2 h-2 rounded-full flex-none",
                          sevStyle.dot
                        )}
                      />
                      <span
                        className={clsx(
                          "text-[11px] font-bold uppercase tracking-wide",
                          sevStyle.text
                        )}
                      >
                        {sevLabel}
                      </span>
                    </div>
                  </td>

                  {/* Utente — name + role */}
                  <td className="px-4 py-3">
                    {row.user_id ? (
                      <Link
                        to={`/gestione-utenti?userId=${encodeURIComponent(row.user_id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex flex-col gap-0.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-theme-1/5"
                        title={`Apri scheda utente (${row.user_id})`}
                      >
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">
                          {userName || "Utente non trovato"}
                        </span>
                        {roleStyle && row.user_type && (
                          <span
                            className={clsx(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit",
                              roleStyle.bg,
                              roleStyle.text
                            )}
                          >
                            {row.user_type}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Lucide
                          icon="Monitor"
                          className="w-3.5 h-3.5 text-slate-300"
                        />
                        <span className="text-xs text-slate-400 italic">
                          Sistema
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Azione */}
                  <td className="px-4 py-3">
                    {row.action ? (
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                        {row.action}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Risorsa */}
                  <td className="px-4 py-3">
                    {row.resource ? (
                      <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-150 inline-block max-w-[200px] truncate">
                        {row.resource}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Esito */}
                  <td className="px-4 py-3">
                    <div
                      className={clsx(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                        resultCfg.bg,
                        resultCfg.text
                      )}
                    >
                      <Lucide icon={resultCfg.icon} className="w-3 h-3" />
                      <span className="text-[11px] font-bold uppercase tracking-wide">
                        {resultCfg.label}
                      </span>
                    </div>
                  </td>

                  {/* Expand */}
                  <td className="px-4 py-3">
                    {hasDetails && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(row.id_audit_log);
                        }}
                        className={clsx(
                          "p-1.5 rounded-lg transition-all",
                          isExpanded
                            ? "bg-theme-1/10 text-theme-1 rotate-180"
                            : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        )}
                        title="Dettagli"
                      >
                        <Lucide icon="ChevronDown" className="w-4 h-4 transition-transform" />
                      </button>
                    )}
                  </td>
                </tr>

                {/* ── Expanded detail panel ── */}
                {isExpanded && hasDetails && (
                  <tr>
                    <td colSpan={8} className="!p-0">
                      <div
                        ref={(el) => {
                          detailRefs.current[row.id_audit_log] = el;
                        }}
                        className="bg-gradient-to-br from-slate-50 via-white to-slate-50/50 border-b border-slate-200"
                      >
                        <div className="px-8 py-5 space-y-4">
                          {/* ── Meta info bar ── */}
                          {(row.target_entity_type || row.user_agent) && (
                            <div className="flex flex-wrap gap-4">
                              {row.target_entity_type && (
                                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                                  <Lucide
                                    icon="Target"
                                    className="w-4 h-4 text-slate-400 flex-none"
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Entità target
                                    </span>
                                    <span className="text-xs font-mono text-slate-700">
                                      {row.target_entity_type}
                                      {row.target_entity_id && (
                                        <span className="text-slate-400 ml-1">
                                          ·{" "}
                                          {row.target_entity_id.length > 24
                                            ? `${row.target_entity_id.slice(0, 24)}...`
                                            : row.target_entity_id}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {row.user_agent && (
                                <div className="flex items-start gap-2.5 bg-white rounded-lg border border-slate-200 px-4 py-3 max-w-xl">
                                  <Lucide
                                    icon="Globe"
                                    className="w-4 h-4 text-slate-400 flex-none mt-1"
                                  />
                                  <div className="flex flex-col min-w-0 gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                      Dispositivo
                                    </span>
                                    <UserAgentDisplay raw={row.user_agent} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Detail key-value cards ── */}
                          {row.details &&
                            Object.keys(row.details).length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Lucide
                                    icon="List"
                                    className="w-4 h-4 text-slate-400"
                                  />
                                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Dettagli evento
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {Object.entries(row.details).map(
                                    ([key, value]) => {
                                      const isComplex =
                                        typeof value === "object" &&
                                        value !== null;
                                      const isError =
                                        key === "error" || key === "reason";
                                      return (
                                        <div
                                          key={key}
                                          className={clsx(
                                            "rounded-lg border p-3",
                                            isError
                                              ? "border-red-200 bg-red-50/50"
                                              : "border-slate-200 bg-white",
                                            isComplex &&
                                            "sm:col-span-2 lg:col-span-3"
                                          )}
                                        >
                                          <div
                                            className={clsx(
                                              "text-[10px] font-bold uppercase tracking-wider mb-1.5",
                                              isError
                                                ? "text-red-400"
                                                : "text-slate-400"
                                            )}
                                          >
                                            {DETAIL_LABELS[key] ?? key}
                                          </div>
                                          <div className="text-xs">
                                            <DetailValue value={value} />
                                          </div>
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLogTable;
