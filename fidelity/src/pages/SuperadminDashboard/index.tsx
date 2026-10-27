import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import { Tab } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import Spinner from "@/components/Base/Spinner";
import StatCard from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import type { TonoStato } from "@/constants/stati";
import { COLORI_SEMANTICI, coloreSemantico, opzioniBase, paletteColore } from "@/utils/chartTheme";
import { getColor } from "@/utils/colors";
import {
    formatData,
    formatDataOra,
    formatDataOraSecondi,
    formatNumero,
    formatRelativo,
    VALORE_ASSENTE,
} from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import type { ChartOptions, TooltipItem } from "chart.js";
import dayjs from "dayjs";
import { FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import withSessionCheck from "../../components/SessionChecker";
import { SeverityBadge } from "../AuditLogDashboard/statiAudit";
import Dashboard3, { Dashboard3LoaderData } from "../Dashboard3";

const AuditLogDashboard = lazy(() => import("../AuditLogDashboard"));

// ─── Types ───────────────────────────────────────────────────────────────────

interface PoolMetrics {
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalConnections: number;
    utilizationPercent: number;
    timestamp: string;
}

interface HealthCheckResult {
    status: "healthy" | "degraded" | "critical";
    poolUtilization: number;
    activeConnections: number;
    waitingRequests: number;
    responseTimeMs: number;
    message: string;
}

interface AverageMetrics {
    avgActiveConnections: number;
    avgUtilization: number;
    peakActiveConnections: number;
    peakUtilization: number;
}

interface DatabaseData {
    health: HealthCheckResult;
    metrics: PoolMetrics;
    averages: AverageMetrics;
    history: PoolMetrics[];
}

interface AuditMetrics {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    failedLogins: number;
    suspiciousActivities: number;
    lastAuditTime: string | null;
}

interface AuditEvent {
    eventType: string;
    severity: string;
    userId?: string;
    userType?: string;
    ipAddress?: string;
    action?: string;
    details?: Record<string, any>;
    result?: string;
    timestamp: string;
}

type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type AlertStatus = "NUOVO" | "ACK" | "RISOLTO";
type AlertSource = "DATABASE" | "SICUREZZA" | "OPERATIVO" | "SESSIONI";

interface DashboardAlertAction {
    label: string;
    href: string;
    variant: "primary" | "secondary" | "danger";
}

interface DashboardAlert {
    id: string;
    title: string;
    description: string;
    severity: AlertSeverity;
    status: AlertStatus;
    source: AlertSource;
    metricValue?: number;
    threshold?: number;
    createdAt: string;
    actions: DashboardAlertAction[];
}

interface SuperadminOverviewResponse {
    database: DatabaseData;
    audit: AuditMetrics;
    onlineUsers: { activeSessions: number; wsConnections: number };
    recentErrors: AuditEvent[];
    alerts?: DashboardAlert[];
}

interface SuperadminDashboardLoaderData {
    overviewPromise: Promise<SuperadminOverviewResponse>;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

const DashboardSkeleton: FC = () => (
    <div role="status" className="grid grid-cols-12 gap-6">
        <span className="sr-only">Caricamento della dashboard…</span>
        {[1, 2, 3, 4].map((i) => (
            <div key={i} aria-hidden="true" className="col-span-12 box box--stacked p-5 xl:col-span-6">
                <Skeleton className="mb-5 h-6 w-48" />
                <div className="grid grid-cols-2 gap-3">
                    {[1, 2].map((j) => (
                        <div key={j} className="flex items-center gap-3 rounded-control border border-slate-200 px-4 py-3">
                            <div className="flex flex-col gap-1">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-5 w-10" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

// ─── Alert ──────────────────────────────────────────────────────────────────

const alertSourceLabels: Record<AlertSource, string> = {
    DATABASE: "Database",
    SICUREZZA: "Sicurezza",
    OPERATIVO: "Operativo",
    SESSIONI: "Sessioni",
};

const STATI_ALERT: Record<AlertStatus, { etichetta: string; tono: TonoStato }> = {
    NUOVO: { etichetta: "Nuovo", tono: "danger" },
    ACK: { etichetta: "Preso in carico", tono: "warning" },
    RISOLTO: { etichetta: "Risolto", tono: "success" },
};

// Bordo e sfondo della card dell'alert secondo la severità
const CLASSI_SEVERITA_ALERT: Record<AlertSeverity, string> = {
    CRITICAL: "border-danger/40 bg-danger/5",
    HIGH: "border-warning/40 bg-warning/5",
    MEDIUM: "border-info/40 bg-info/5",
    LOW: "border-slate-200 bg-slate-50",
};

const VARIANTE_AZIONE_ALERT: Record<DashboardAlertAction["variant"], "primary" | "outline-secondary" | "outline-danger"> = {
    primary: "primary",
    secondary: "outline-secondary",
    danger: "outline-danger",
};

// ─── Status helpers ─────────────────────────────────────────────────────────

const statusConfig = {
    healthy: { label: "Operativo", tone: "success" as const, color: "text-success" },
    degraded: { label: "Degradato", tone: "warning" as const, color: "text-warning" },
    critical: { label: "Critico", tone: "danger" as const, color: "text-danger" },
};

// ─── Main Component ──────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30 secondi

type DashboardTabId = "superadmin" | "gdo" | "audit";
const DASHBOARD_TAB_QUERY_KEY = "tab";
const DASHBOARD_TAB_IDS: DashboardTabId[] = ["superadmin", "gdo", "audit"];

const isDashboardTabId = (value: string | null): value is DashboardTabId =>
    value !== null && DASHBOARD_TAB_IDS.includes(value as DashboardTabId);

const SuperadminDashboard: FC = () => {
    const loaderData = useLoaderData() as SuperadminDashboardLoaderData | null;
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState<SuperadminOverviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aggiornando, setAggiornando] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const gdoLoaderDataRef = useRef<Dashboard3LoaderData | null>(null);
    const tabFromQuery = searchParams.get(DASHBOARD_TAB_QUERY_KEY);
    const activeTab: DashboardTabId = isDashboardTabId(tabFromQuery)
        ? tabFromQuery
        : "superadmin";

    const tabs = useMemo(
        () => [
            { id: "superadmin" as const, label: "Controllo Superadmin", icon: "Shield" },
            { id: "audit" as const, label: "Registro Audit", icon: "FileText" },
            { id: "gdo" as const, label: "Dashboard GDO", icon: "LayoutDashboard" },
        ],
        []
    );

    useEffect(() => {
        if (isDashboardTabId(tabFromQuery)) return;

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(DASHBOARD_TAB_QUERY_KEY, "superadmin");
            return next;
        }, { replace: true });
    }, [setSearchParams, tabFromQuery]);

    const handleTabChange = useCallback((tabId: DashboardTabId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(DASHBOARD_TAB_QUERY_KEY, tabId);
            return next;
        });
    }, [setSearchParams]);

    const fetchOverview = useCallback(async () => {
        try {
            const result = await ServerCall.get<SuperadminOverviewResponse>("/superadmin-dashboard/overview");
            setData(result);
            setError(null);
        } catch {
            setError("Errore nel caricamento dei dati della dashboard.");
        }
    }, []);

    // Caricamento iniziale dal loader, poi polling periodico
    useEffect(() => {
        const init = async () => {
            if (loaderData) {
                try {
                    const result = await loaderData.overviewPromise;
                    setData(result);
                } catch {
                    setError("Errore nel caricamento dei dati della dashboard.");
                }
            }
            setLoading(false);

            // Avvia polling
            intervalRef.current = setInterval(fetchOverview, POLL_INTERVAL_MS);
        };
        init();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loaderData, fetchOverview]);

    // ─── Chart data: Pool Utilization Doughnut ──────────────────────────────
    const poolUtilizationChartData = useMemo(() => {
        if (!data) return null;
        const used = data.database.metrics.utilizationPercent;
        const free = 100 - used;
        return {
            data: {
                labels: ["Utilizzato", "Disponibile"],
                datasets: [
                    {
                        data: [used, free],
                        backgroundColor: [
                            used >= 80 ? COLORI_SEMANTICI.negativo : paletteColore(0),
                            getColor("slate.200", 0.5),
                        ],
                        borderWidth: 0,
                        cutout: "75%",
                    },
                ],
            },
            options: opzioniBase("doughnut", {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx: TooltipItem<"doughnut">) => `${ctx.label}: ${ctx.raw}%`,
                        },
                    },
                },
            }) as ChartOptions,
        };
    }, [data]);

    // ─── Chart data: Connections Bar ────────────────────────────────────────
    const connectionsBarChartData = useMemo(() => {
        if (!data) return null;
        const { metrics, averages } = data.database;
        // Attive, idle, in attesa, totali
        const colori = (alpha: number) => [
            paletteColore(0, alpha),
            coloreSemantico("positivo", alpha),
            coloreSemantico("attenzione", alpha),
            coloreSemantico("neutro", alpha),
        ];
        return {
            data: {
                labels: ["Attive", "Idle", "In attesa", "Totali"],
                datasets: [
                    {
                        label: "Corrente",
                        data: [
                            metrics.activeConnections,
                            metrics.idleConnections,
                            metrics.waitingRequests,
                            metrics.totalConnections,
                        ],
                        backgroundColor: colori(0.7),
                        borderRadius: 4,
                    },
                    {
                        label: "Media",
                        data: [
                            averages.avgActiveConnections,
                            0,
                            0,
                            0,
                        ],
                        backgroundColor: colori(0.3),
                        borderRadius: 4,
                    },
                ],
            },
            options: opzioniBase("bar", {
                plugins: {
                    legend: { display: true, position: "bottom", labels: { boxWidth: 12 } },
                },
                scales: {
                    y: { beginAtZero: true },
                    x: { grid: { display: false } },
                },
            }) as ChartOptions,
        };
    }, [data]);

    // ─── Chart data: History Line ───────────────────────────────────────────
    const historyLineChartData = useMemo(() => {
        if (!data || !data.database.history?.length) return null;
        const history = data.database.history.slice(-30);
        const labels = history.map((m) => dayjs(m.timestamp).format("HH:mm"));
        return {
            data: {
                labels,
                datasets: [
                    {
                        label: "Connessioni attive",
                        data: history.map((m) => m.activeConnections),
                        borderColor: paletteColore(0),
                        backgroundColor: paletteColore(0, 0.1),
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                    },
                    {
                        label: "Utilizzo pool %",
                        data: history.map((m) => m.utilizationPercent),
                        borderColor: COLORI_SEMANTICI.attenzione,
                        backgroundColor: coloreSemantico("attenzione", 0.1),
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                    },
                ],
            },
            options: opzioniBase("line", {
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: true, position: "bottom", labels: { boxWidth: 12 } },
                },
                scales: {
                    y: { beginAtZero: true },
                    x: { grid: { display: false }, ticks: { maxRotation: 45 } },
                },
            }) as ChartOptions,
        };
    }, [data]);

    const gdoLoaderData = useMemo(() => {
        if (activeTab !== "gdo") return gdoLoaderDataRef.current;

        if (!gdoLoaderDataRef.current) {
            gdoLoaderDataRef.current = {
                volantiniInCorsoPromise: ServerCall.get("/dashboard/volantini-in-corso"),
                volantiniInLavorazionePromise: ServerCall.get("/dashboard/volantini-in-lavorazione"),
                volantiniPubblicatiInLavorazionePromise: ServerCall.get("/dashboard/volantini-pubblicati-in-lavorazione"),
                areePromise: ServerCall.get("/allAreeForGDO"),
                canaliPromise: ServerCall.get("/allCanaliForGDO"),
            } as Dashboard3LoaderData;
        }

        return gdoLoaderDataRef.current;
    }, [activeTab]);

    const gdoDashboardContent = useMemo(() => {
        if (!gdoLoaderData) {
            return (
                <Sezione>
                    <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
                        <Spinner size="lg" etichetta="Caricamento dashboard GDO…" />
                        <p aria-hidden="true">Caricamento dashboard GDO…</p>
                    </div>
                </Sezione>
            );
        }

        return <Dashboard3 embedded loaderDataOverride={gdoLoaderData} />;
    }, [gdoLoaderData]);

    // ─── Chart data: Response Time Line ─────────────────────────────────────
    const responseTimeValue = data?.database.health.responseTimeMs ?? 0;

    const aggiorna = useCallback(async () => {
        setAggiornando(true);
        try {
            await fetchOverview();
        } finally {
            setAggiornando(false);
        }
    }, [fetchOverview]);

    const titolo = "Dashboard Superadmin";
    const descrizione = "Panoramica dello stato del sistema.";

    if (loading) {
        return (
            <Pagina titolo={titolo} descrizione={descrizione}>
                <DashboardSkeleton />
            </Pagina>
        );
    }

    if (error || !data) {
        return (
            <Pagina titolo={titolo} descrizione={descrizione}>
                <PageError
                    titolo="Errore caricamento dashboard"
                    motivo={error ?? "Dati non disponibili."}
                    onRiprova={fetchOverview}
                />
            </Pagina>
        );
    }

    const { health, metrics, averages } = data.database;
    const dbStatus = statusConfig[health.status];
    const indiceTab = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));

    return (
        <Pagina
            titolo={titolo}
            descrizione={descrizione}
            azioni={
                activeTab === "superadmin" && (
                    <Button variant="outline-secondary" onClick={aggiorna} loading={aggiornando} disabled={aggiornando}>
                        {!aggiornando && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
                        Aggiorna
                    </Button>
                )
            }
        >
            <Tab.Group
                className="flex flex-col gap-6"
                selectedIndex={indiceTab}
                onChange={(indice: number) => handleTabChange(tabs[indice].id)}
            >
                <Tab.List variant="boxed-tabs" aria-label="Sezioni della dashboard" className="bg-white shadow-card">
                    {tabs.map((tab) => (
                        <Tab key={tab.id}>
                            <Tab.Button
                                as="button"
                                className="flex w-full items-center justify-center gap-2 whitespace-nowrap py-2"
                            >
                                <Lucide icon={tab.icon} aria-hidden="true" className="h-4 w-4" />
                                {tab.label}
                            </Tab.Button>
                        </Tab>
                    ))}
                </Tab.List>

                <Tab.Panels>
                    {/* L'ordine dei pannelli segue quello di tabs */}
                    <Tab.Panel>
                        <div className="grid grid-cols-12 gap-6">
                            {/* ── Stato Database — KPI Cards ── */}
                            <Sezione
                                className="col-span-12 xl:col-span-6"
                                icona="Database"
                                titolo="Stato Database"
                                descrizione={
                                    <>
                                        PostgreSQL — {health.message}
                                        <span className="block text-xs text-slate-400">
                                            Aggiornato {formatDataOra(metrics.timestamp)}
                                        </span>
                                    </>
                                }
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Stato"
                                        valore={dbStatus.label}
                                        icona="Activity"
                                        tono={dbStatus.tone}
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Tempo risposta"
                                        valore={`${formatNumero(responseTimeValue)} ms`}
                                        icona="Clock"
                                        tono={responseTimeValue > 1000 ? "danger" : responseTimeValue > 500 ? "warning" : "info"}
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Connessioni attive"
                                        valore={formatNumero(metrics.activeConnections)}
                                        icona="Zap"
                                        tono="brand"
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="In attesa"
                                        valore={formatNumero(metrics.waitingRequests)}
                                        icona="Hourglass"
                                        tono={metrics.waitingRequests > 0 ? "warning" : "info"}
                                    />
                                </div>
                            </Sezione>

                            {/* ── Grafici Database ── */}
                            <Sezione
                                className="col-span-12 xl:col-span-6"
                                icona="ChartBar"
                                titolo="Pool connessioni"
                                descrizione={`Utilizzo: ${metrics.utilizationPercent}% — Picco: ${averages.peakUtilization}%`}
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Doughnut — Pool Utilization */}
                                    <div className="flex flex-col items-center">
                                        <span className="title-eyebrow mb-2">Utilizzo pool</span>
                                        <div className="relative w-full" style={{ height: 140 }}>
                                            {poolUtilizationChartData && (
                                                <Chart
                                                    type="doughnut"
                                                    data={poolUtilizationChartData.data}
                                                    options={poolUtilizationChartData.options}
                                                    className="h-full w-full"
                                                />
                                            )}
                                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                                <span className="text-2xl font-bold tabular-nums text-slate-800">
                                                    {metrics.utilizationPercent}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bar — Connections Breakdown */}
                                    <div className="flex flex-col">
                                        <span className="title-eyebrow mb-2">Connessioni</span>
                                        <div style={{ height: 140 }}>
                                            {connectionsBarChartData && (
                                                <Chart
                                                    type="bar"
                                                    data={connectionsBarChartData.data}
                                                    options={connectionsBarChartData.options}
                                                    className="h-full w-full"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Sezione>

                            {/* ── Storico Connessioni (Line Chart) ── */}
                            <Sezione
                                className="col-span-12"
                                icona="TrendingUp"
                                titolo="Storico connessioni"
                                descrizione={`Media: ${averages.avgActiveConnections} attive — Picco: ${averages.peakActiveConnections}`}
                            >
                                {historyLineChartData ? (
                                    <div style={{ height: 220 }}>
                                        <Chart
                                            type="line"
                                            data={historyLineChartData.data}
                                            options={historyLineChartData.options}
                                            className="h-full w-full"
                                        />
                                    </div>
                                ) : (
                                    <EmptyState
                                        compatta
                                        icon="Clock"
                                        title="Storico non ancora disponibile"
                                        description="I dati si accumulano nel tempo."
                                    />
                                )}
                            </Sezione>

                            {/* ── Utenti Online ── */}
                            <Sezione
                                className="col-span-12 xl:col-span-6"
                                icona="Server"
                                titolo="Stato sistema"
                                descrizione={
                                    <>
                                        Sessioni e connessioni attive
                                        <span className="block text-xs text-slate-400">
                                            Aggiornato {formatData(new Date())}
                                        </span>
                                    </>
                                }
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Sessioni attive"
                                        valore={formatNumero(data.onlineUsers.activeSessions)}
                                        icona="Users"
                                        tono="brand"
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="WebSocket"
                                        valore={formatNumero(data.onlineUsers.wsConnections)}
                                        icona="Radio"
                                        tono="info"
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Ultimo audit"
                                        valore={
                                            data.audit.lastAuditTime ? (
                                                <span title={formatDataOraSecondi(data.audit.lastAuditTime)}>
                                                    {formatRelativo(data.audit.lastAuditTime)}
                                                </span>
                                            ) : null
                                        }
                                        icona="Clock"
                                        tono="info"
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Pool idle"
                                        valore={formatNumero(metrics.idleConnections)}
                                        icona="Pause"
                                        tono="info"
                                    />
                                </div>
                            </Sezione>

                            {/* ── Audit & Sicurezza ── */}
                            <Sezione
                                className="col-span-12 xl:col-span-6"
                                icona="Shield"
                                titolo="Audit & Sicurezza"
                                descrizione={
                                    <>
                                        Metriche di sicurezza del sistema
                                        <span className="block text-xs text-slate-400">
                                            {formatNumero(data.audit.totalEvents)} eventi totali registrati
                                        </span>
                                    </>
                                }
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Login falliti"
                                        valore={formatNumero(data.audit.failedLogins)}
                                        icona="ShieldOff"
                                        tono={data.audit.failedLogins > 0 ? "danger" : "brand"}
                                    />
                                    <StatCard
                                        densita="compatta"
                                        etichetta="Attività sospette"
                                        valore={formatNumero(data.audit.suspiciousActivities)}
                                        icona="TriangleAlert"
                                        tono={data.audit.suspiciousActivities > 0 ? "danger" : "brand"}
                                    />
                                </div>

                                <h3 className="title-eyebrow mb-2 mt-5">Per severità</h3>
                                <dl className="flex flex-col gap-2">
                                    {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
                                        <div key={sev} className="flex items-center justify-between text-sm">
                                            <dt>
                                                <SeverityBadge severity={sev} />
                                            </dt>
                                            <dd className="font-semibold tabular-nums text-slate-700">
                                                {formatNumero(data.audit.eventsBySeverity[sev] ?? 0)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </Sezione>

                            {/* ── Centro Alert Azionabile ── */}
                            <Sezione
                                className="col-span-12"
                                icona="BellRing"
                                titolo="Centro alert azionabile"
                                descrizione={
                                    <>
                                        Prioritizza criticità e intervieni con azioni rapide
                                        <span className="block text-xs text-slate-400">
                                            {formatNumero(data.alerts?.length ?? 0)} alert attivi
                                        </span>
                                    </>
                                }
                            >
                                {!data.alerts || data.alerts.length === 0 ? (
                                    <EmptyState
                                        compatta
                                        icon="ShieldCheck"
                                        iconColor="text-success"
                                        title="Nessun alert attivo"
                                        description="Al momento non ci sono criticità da gestire."
                                    />
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {data.alerts.map((alert) => (
                                            <div
                                                key={alert.id}
                                                className={twMerge(
                                                    "rounded-card border p-4",
                                                    CLASSI_SEVERITA_ALERT[alert.severity] ?? CLASSI_SEVERITA_ALERT.LOW
                                                )}
                                            >
                                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                                    <SeverityBadge severity={alert.severity} />
                                                    <StatusBadge
                                                        tono={STATI_ALERT[alert.status]?.tono ?? "neutral"}
                                                        etichetta={STATI_ALERT[alert.status]?.etichetta ?? alert.status}
                                                    />
                                                    <Badge variant="secondary" size="sm">
                                                        {alertSourceLabels[alert.source] ?? alert.source}
                                                    </Badge>
                                                    <span className="text-xs text-slate-500">
                                                        {formatDataOra(alert.createdAt)}
                                                    </span>
                                                </div>

                                                <h3 className="title-card mb-1">{alert.title}</h3>
                                                <p className="mb-2 text-sm text-slate-600">{alert.description}</p>

                                                {(typeof alert.metricValue === "number" || typeof alert.threshold === "number") && (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {typeof alert.metricValue === "number" && (
                                                            <Badge variant="secondary" size="sm" border className="bg-white tabular-nums">
                                                                Valore: {formatNumero(alert.metricValue)}
                                                            </Badge>
                                                        )}
                                                        {typeof alert.threshold === "number" && (
                                                            <Badge variant="secondary" size="sm" border className="bg-white tabular-nums">
                                                                Soglia: {formatNumero(alert.threshold)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}

                                                {alert.actions.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {alert.actions.map((action, idx) => (
                                                            <Button
                                                                key={`${alert.id}-action-${idx}`}
                                                                as={Link}
                                                                to={action.href}
                                                                size="sm"
                                                                variant={VARIANTE_AZIONE_ALERT[action.variant] ?? "outline-secondary"}
                                                            >
                                                                {action.label}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Sezione>

                            {/* ── Ultimi Errori ── */}
                            <Sezione
                                className="col-span-12"
                                senzaPadding
                                icona="OctagonAlert"
                                titolo="Ultimi errori"
                                descrizione="Eventi critici e alti — ultimi 30"
                            >
                                {data.recentErrors.length === 0 ? (
                                    <div className="px-5 pb-5">
                                        <EmptyState
                                            compatta
                                            icon="CircleCheck"
                                            iconColor="text-success"
                                            title="Nessun errore recente"
                                            description="Non sono stati registrati eventi critici o alti."
                                        />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th>Data e ora</Table.Th>
                                                    <Table.Th>Severità</Table.Th>
                                                    <Table.Th>Tipo evento</Table.Th>
                                                    <Table.Th>Utente</Table.Th>
                                                    <Table.Th>IP</Table.Th>
                                                    <Table.Th>Dettagli</Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {data.recentErrors.map((evt, idx) => (
                                                    <Table.Tr key={idx}>
                                                        <Table.Td className="whitespace-nowrap text-xs tabular-nums">
                                                            {formatDataOraSecondi(evt.timestamp)}
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <SeverityBadge severity={evt.severity} />
                                                        </Table.Td>
                                                        <Table.Td className="font-mono text-xs">{evt.eventType}</Table.Td>
                                                        <Table.Td className="text-xs">{evt.userId ?? VALORE_ASSENTE}</Table.Td>
                                                        <Table.Td className="font-mono text-xs">
                                                            {evt.ipAddress ?? VALORE_ASSENTE}
                                                        </Table.Td>
                                                        <Table.Td className="max-w-xs truncate text-xs">
                                                            {evt.details
                                                                ? JSON.stringify(evt.details).slice(0, 100)
                                                                : VALORE_ASSENTE}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </div>
                                )}
                            </Sezione>
                        </div>
                    </Tab.Panel>

                    <Tab.Panel>
                        <Suspense
                            fallback={
                                <Sezione>
                                    <div className="flex flex-col items-center gap-3 py-8 text-slate-500">
                                        <Spinner size="lg" etichetta="Caricamento registro audit…" />
                                        <p aria-hidden="true">Caricamento registro audit…</p>
                                    </div>
                                </Sezione>
                            }
                        >
                            <AuditLogDashboard />
                        </Suspense>
                    </Tab.Panel>

                    <Tab.Panel>{gdoDashboardContent}</Tab.Panel>
                </Tab.Panels>
            </Tab.Group>
        </Pagina>
    );
};

export default withSessionCheck(SuperadminDashboard);
