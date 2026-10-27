import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { formatDataOraSecondi, formatRelativo, VALORE_ASSENTE } from "@/utils/format";
import clsx from "clsx";
import { FC, Fragment, useCallback, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { AuditLogRecord } from "../../../lib/auditTypes";
import { AUDIT_EVENT_LABELS, AuditEventType } from "../../../lib/auditTypes";
import { EsitoBadge, SeverityBadge } from "./statiAudit";

interface AuditLogTableProps {
  items: AuditLogRecord[];
  sortBy: string;
  sortOrder: "ASC" | "DESC";
  onSort: (field: string) => void;
  /** Ci sono filtri attivi: un elenco vuoto è "nessun risultato", non "nessun dato". */
  filtriAttivi?: boolean;
  onAzzeraFiltri?: () => void;
}

/** Colonne della tabella: il pannello dei dettagli le occupa tutte. */
const NUMERO_COLONNE = 8;

// ── Categorie degli eventi ──

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

const CATEGORY_ICONS: Record<EventCategory, string> = {
  auth: "KeyRound",
  user: "UserCog",
  security: "ShieldAlert",
  system: "Settings",
  data: "Database",
};

// ── Icone dei singoli eventi ──

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

const DEVICE_CONFIG: Record<ParsedUA["device"], { label: string; icon: string }> = {
  desktop: { label: "Desktop", icon: "Monitor" },
  mobile: { label: "Mobile", icon: "Smartphone" },
  tablet: { label: "Tablet", icon: "Tablet" },
  bot: { label: "Bot", icon: "Bot" },
};

const CLASSE_CHIP = "inline-flex items-center gap-1.5 rounded-control border border-slate-200 bg-white px-2.5 py-1.5";

// ── Parsed UA display component ──

const UserAgentDisplay: FC<{ raw: string }> = ({ raw }) => {
  const parsed = parseUserAgent(raw);
  const deviceCfg = DEVICE_CONFIG[parsed.device];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {parsed.browser && (
          <div className={CLASSE_CHIP}>
            <Lucide icon={parsed.browserIcon} aria-hidden="true" className="h-3.5 w-3.5 flex-none text-slate-500" />
            <span className="text-xs font-medium text-slate-700">{parsed.browser}</span>
            {parsed.browserVersion && (
              <span className="font-mono text-2xs text-slate-500">v{parsed.browserVersion}</span>
            )}
          </div>
        )}

        {parsed.os && (
          <div className={CLASSE_CHIP}>
            <Lucide icon={parsed.osIcon} aria-hidden="true" className="h-3.5 w-3.5 flex-none text-slate-500" />
            <span className="text-xs font-medium text-slate-700">{parsed.os}</span>
            {parsed.osVersion && <span className="font-mono text-2xs text-slate-500">{parsed.osVersion}</span>}
          </div>
        )}

        <div className={clsx(CLASSE_CHIP, "bg-slate-100")}>
          <Lucide icon={deviceCfg.icon} aria-hidden="true" className="h-3.5 w-3.5 flex-none text-slate-600" />
          <span className="text-xs font-medium text-slate-700">{deviceCfg.label}</span>
        </div>
      </div>

      <details>
        <summary className="w-fit cursor-pointer select-none text-2xs text-slate-500 transition-colors hover:text-slate-700">
          Mostra stringa completa
        </summary>
        <div className="mt-1.5 max-w-lg break-all rounded-control bg-slate-900 px-2.5 py-2 font-mono text-2xs leading-relaxed text-slate-300">
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

// ── Intestazione ordinabile ──

const SortHeader: FC<{
  label: string;
  field: string;
  currentSort: string;
  currentOrder: "ASC" | "DESC";
  onSort: (field: string) => void;
}> = ({ label, field, currentSort, currentOrder, onSort }) => {
  const attivo = currentSort === field;
  return (
    <Table.Th aria-sort={attivo ? (currentOrder === "ASC" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={clsx(
          "group/sort inline-flex items-center gap-1 uppercase transition-colors hover:text-slate-700",
          attivo && "text-slate-700"
        )}
      >
        {label}
        <Lucide
          icon={attivo && currentOrder === "ASC" ? "ChevronUp" : "ChevronDown"}
          aria-hidden="true"
          className={clsx(
            "h-3.5 w-3.5 transition-opacity",
            attivo ? "opacity-100" : "opacity-0 group-hover/sort:opacity-40"
          )}
        />
      </button>
    </Table.Th>
  );
};

// ── Valore di un dettaglio ──

const DetailValue: FC<{ value: unknown }> = ({ value }) => {
  if (value === null || value === undefined)
    return <span className="italic text-slate-400">null</span>;
  if (typeof value === "boolean")
    return (
      <Badge variant={value ? "success" : "error"} size="sm">
        {value ? "true" : "false"}
      </Badge>
    );
  if (typeof value === "number")
    return <span className="font-mono tabular-nums text-slate-700">{value}</span>;
  if (typeof value === "object")
    return (
      <pre className="mt-1 max-h-40 overflow-x-auto rounded-control bg-slate-900 p-2.5 font-mono text-2xs leading-relaxed text-slate-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  return <span className="break-all text-slate-700">{String(value)}</span>;
};

const Assente = () => <span className="text-xs text-slate-400">{VALORE_ASSENTE}</span>;

// ── Main component ──

const AuditLogTable: FC<AuditLogTableProps> = ({
  items,
  sortBy,
  sortOrder,
  onSort,
  filtriAttivi = false,
  onAzzeraFiltri,
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = useCallback(
    (id: string) => setExpandedRow((prev) => (prev === id ? null : id)),
    []
  );

  if (items.length === 0) {
    return filtriAttivi ? (
      <EmptyState
        compatta
        icon="FileSearch"
        title="Nessun evento per i filtri scelti"
        description="Modifica i filtri o il periodo selezionato per vedere altri eventi."
        buttonText={onAzzeraFiltri ? "Azzera filtri" : undefined}
        buttonIcon="X"
        onButtonClick={onAzzeraFiltri}
      />
    ) : (
      <EmptyState
        compatta
        icon="FileSearch"
        title="Nessun evento registrato"
        description="Gli eventi di audit compariranno qui non appena il sistema li registra."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-sm">
        <Table.Thead>
          <Table.Tr>
            <SortHeader label="Quando" field="createdat" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <SortHeader label="Evento" field="event_type" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <SortHeader label="Severità" field="severity" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <Table.Th>Utente</Table.Th>
            <Table.Th>Azione</Table.Th>
            <Table.Th>Risorsa</Table.Th>
            <SortHeader label="Esito" field="result" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <Table.Th className="w-10">
              <span className="sr-only">Dettagli</span>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((row) => {
            const isExpanded = expandedRow === row.id_audit_log;
            const eventLabel =
              AUDIT_EVENT_LABELS[row.event_type as AuditEventType] ??
              row.event_type;
            const category =
              EVENT_CATEGORY_MAP[row.event_type] ?? "system";
            const catLabel = CATEGORY_LABELS[category];
            const eventIcon = EVENT_ICONS[row.event_type] ?? CATEGORY_ICONS[category];
            const userName = (
              (row.user_name ?? "") +
              " " +
              (row.user_surname ?? "")
            ).trim();

            const hasDetails =
              (row.details && Object.keys(row.details).length > 0) ||
              row.target_entity_type ||
              row.user_agent;

            const dataCompleta = formatDataOraSecondi(row.createdat);

            return (
              <Fragment key={row.id_audit_log}>
                <Table.Tr
                  className={clsx(hasDetails && "cursor-pointer", isExpanded && "[&_td]:bg-slate-50")}
                  onClick={() => hasDetails && toggleRow(row.id_audit_log)}
                >
                  {/* Quando: distanza da adesso, sotto la data completa */}
                  <Table.Td className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span title={dataCompleta} className="text-sm font-medium text-slate-700">
                        {formatRelativo(row.createdat)}
                      </span>
                      <span className="mt-0.5 text-xs tabular-nums text-slate-500">{dataCompleta}</span>
                    </div>
                  </Table.Td>

                  {/* Evento: icona, nome e categoria */}
                  <Table.Td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-control bg-slate-100 text-slate-600">
                        <Lucide icon={eventIcon} aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium leading-tight text-slate-700">
                          {eventLabel}
                        </span>
                        <span className="mt-0.5 text-xs text-slate-500">{catLabel}</span>
                      </div>
                    </div>
                  </Table.Td>

                  <Table.Td>
                    <SeverityBadge severity={row.severity} />
                  </Table.Td>

                  {/* Utente: nome e ruolo, con il collegamento alla scheda */}
                  <Table.Td>
                    {row.user_id ? (
                      <Link
                        to={`/gestione-interna/gestione-utenti?userId=${encodeURIComponent(row.user_id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="-mx-2 -my-1 inline-flex flex-col gap-0.5 rounded-control px-2 py-1 transition-colors hover:bg-theme-1/5"
                        title={`Apri scheda utente (${row.user_id})`}
                      >
                        <span className="max-w-40 truncate text-sm font-medium text-slate-700">
                          {userName || "Utente non trovato"}
                        </span>
                        {row.user_type && (
                          <Badge variant="secondary" size="sm" className="w-fit">
                            {row.user_type}
                          </Badge>
                        )}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Lucide icon="Monitor" aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs italic text-slate-500">Sistema</span>
                      </div>
                    )}
                  </Table.Td>

                  <Table.Td>
                    {row.action ? (
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-600">
                        {row.action}
                      </span>
                    ) : (
                      <Assente />
                    )}
                  </Table.Td>

                  <Table.Td>
                    {row.resource ? (
                      <span className="inline-block max-w-52 truncate rounded-control border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
                        {row.resource}
                      </span>
                    ) : (
                      <Assente />
                    )}
                  </Table.Td>

                  <Table.Td>
                    <EsitoBadge result={row.result} />
                  </Table.Td>

                  <Table.Td className="text-right">
                    {hasDetails && (
                      <Button
                        type="button"
                        variant="outline-secondary"
                        size="sm"
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          toggleRow(row.id_audit_log);
                        }}
                        title="Dettagli"
                        aria-label={isExpanded ? "Nascondi dettagli" : "Mostra dettagli"}
                        aria-expanded={isExpanded}
                      >
                        <Lucide
                          icon="ChevronDown"
                          aria-hidden="true"
                          className={clsx("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                        />
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>

                {/* ── Pannello dei dettagli ── */}
                {isExpanded && hasDetails && (
                  <Table.Tr className="[&:hover_td]:bg-slate-50">
                    <Table.Td colSpan={NUMERO_COLONNE} className="bg-slate-50 p-0">
                      <div className="space-y-4 px-5 py-5">
                        {(row.target_entity_type || row.user_agent) && (
                          <div className="flex flex-wrap gap-4">
                            {row.target_entity_type && (
                              <div className="flex items-center gap-2 rounded-card border border-slate-200 bg-white px-3 py-2">
                                <Lucide icon="Target" aria-hidden="true" className="h-4 w-4 flex-none text-slate-400" />
                                <div className="flex flex-col">
                                  <span className="title-eyebrow">Entità target</span>
                                  <span className="font-mono text-xs text-slate-700">
                                    {row.target_entity_type}
                                    {row.target_entity_id && (
                                      <span className="ml-1 text-slate-400">
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
                              <div className="flex max-w-xl items-start gap-2.5 rounded-card border border-slate-200 bg-white px-4 py-3">
                                <Lucide icon="Globe" aria-hidden="true" className="mt-1 h-4 w-4 flex-none text-slate-400" />
                                <div className="flex min-w-0 flex-col gap-1">
                                  <span className="title-eyebrow">Dispositivo</span>
                                  <UserAgentDisplay raw={row.user_agent} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {row.details && Object.keys(row.details).length > 0 && (
                          <div>
                            <div className="mb-3 flex items-center gap-2">
                              <Lucide icon="List" aria-hidden="true" className="h-4 w-4 text-slate-400" />
                              <span className="title-eyebrow">Dettagli evento</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                              {Object.entries(row.details).map(([key, value]) => {
                                const isComplex = typeof value === "object" && value !== null;
                                const isError = key === "error" || key === "reason";
                                return (
                                  <div
                                    key={key}
                                    className={clsx(
                                      "rounded-card border p-3",
                                      isError ? "border-danger/20 bg-danger/5" : "border-slate-200 bg-white",
                                      isComplex && "sm:col-span-2 lg:col-span-3"
                                    )}
                                  >
                                    <div className={clsx("title-eyebrow mb-1.5", isError && "text-danger")}>
                                      {DETAIL_LABELS[key] ?? key}
                                    </div>
                                    <div className="text-xs">
                                      <DetailValue value={value} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
};

export default AuditLogTable;
