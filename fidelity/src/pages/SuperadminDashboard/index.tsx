import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PageHeader from "@/components/Base/PageHeader";
import Skeleton from "@/components/Base/Skeleton";
import Spinner from "@/components/Base/Spinner";
import StatCard from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import { COLORI_SEMANTICI, coloreSemantico, opzioniBase, paletteColore } from "@/utils/chartTheme";
import { getColor } from "@/utils/colors";
import { formatData, formatDataOra } from "@/utils/format";
import type { ChartOptions, TooltipItem } from "chart.js";
import clsx from "clsx";
import dayjs from "dayjs";
import { FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import withSessionCheck from "../../components/SessionChecker";
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
    <div className="grid grid-cols-12 gap-5 mt-5">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-3">
                        {[1, 2].map((j) => (
                            <div key={j} className="flex items-center gap-3 rounded-control border px-4 py-3">
                                <Skeleton className="w-9 h-9 rounded-full" />
                                <div className="flex flex-col gap-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-5 w-10" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// ─── Severity Badge ─────────────────────────────────────────────────────────

const TONO_SEVERITA: Record<string, TonoStato> = {
    CRITICAL: "danger",
    HIGH: "warning",
    MEDIUM: "info",
    LOW: "neutral",
};

const SeverityBadge: FC<{ severity: string }> = ({ severity }) => (
    <StatusBadge tono={TONO_SEVERITA[severity] ?? "neutral"} etichetta={severity} />
);

const alertSourceLabels: Record<AlertSource, string> = {
    DATABASE: "Database",
    SICUREZZA: "Sicurezza",
    OPERATIVO: "Operativo",
    SESSIONI: "Sessioni",
};

const TONO_STATO_ALERT: Record<AlertStatus, TonoStato> = {
    NUOVO: "danger",
    ACK: "warning",
    RISOLTO: "success",
};

const alertActionButtonClass: Record<DashboardAlertAction["variant"], string> = {
    primary: "bg-theme-1/10 text-theme-1 hover:bg-theme-1/20",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-danger/10 text-danger hover:bg-danger/20",
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
                <div role="status" className="box box--stacked p-8 text-center mt-5">
                    <Spinner size="lg" decorativo className="mx-auto mb-3" />
                    <p className="text-slate-500">Caricamento dashboard GDO...</p>
                </div>
            );
        }

        return <Dashboard3 embedded loaderDataOverride={gdoLoaderData} />;
    }, [gdoLoaderData]);

    // ─── Chart data: Response Time Line ─────────────────────────────────────
    const responseTimeValue = data?.database.health.responseTimeMs ?? 0;

    if (loading) {
        return (
            <>
                <PageHeader title="Dashboard Superadmin" description="Panoramica dello stato del sistema." />
                <DashboardSkeleton />
            </>
        );
    }

    if (error || !data) {
        return (
            <>
                <PageHeader title="Dashboard Superadmin" description="Panoramica dello stato del sistema." />
                <PageError
                    titolo="Errore caricamento dashboard"
                    motivo={error ?? "Dati non disponibili."}
                    onRiprova={fetchOverview}
                    className="mt-5"
                />
            </>
        );
    }

    const { health, metrics, averages } = data.database;
    const dbStatus = statusConfig[health.status];

    return (
        <>
            <PageHeader title="Dashboard Superadmin" description="Panoramica dello stato del sistema." />

            <div className="box box--stacked p-3 mt-5">
                <div role="tablist" aria-label="Sezioni della dashboard" className="flex flex-wrap items-center gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={clsx(
                                "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm border transition-colors",
                                activeTab === tab.id
                                    ? "bg-theme-1/10 text-theme-1 border-theme-1/30"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <Lucide icon={tab.icon} aria-hidden="true" className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === "gdo" ? (
                <div className="mt-5">{gdoDashboardContent}</div>
            ) : activeTab === "audit" ? (
                <div className="mt-5">
                    <Suspense
                        fallback={
                            <div role="status" className="box box--stacked p-8 text-center">
                                <Spinner size="lg" decorativo className="mx-auto mb-3" />
                                <p className="text-slate-500">Caricamento registro audit...</p>
                            </div>
                        }
                    >
                        <AuditLogDashboard />
                    </Suspense>
                </div>
            ) : (
                <div className="grid grid-cols-12 gap-5 mt-5">
                    {/* ── Stato Database — KPI Cards ── */}
                    <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                                    <Lucide icon="Database" className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="title-card">Stato Database</h2>
                                    <div className="text-slate-500 text-sm">PostgreSQL — {health.message}</div>
                                </div>
                            </div>
                            <div className="text-2xs text-slate-400 pl-14">
                                Aggiornato {formatDataOra(metrics.timestamp)}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
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
                                valore={`${responseTimeValue} ms`}
                                icona="Clock"
                                tono={responseTimeValue > 1000 ? "danger" : responseTimeValue > 500 ? "warning" : "info"}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                densita="compatta"
                                etichetta="Connessioni attive"
                                valore={metrics.activeConnections}
                                icona="Zap"
                                tono="brand"
                            />
                            <StatCard
                                densita="compatta"
                                etichetta="In attesa"
                                valore={metrics.waitingRequests}
                                icona="Hourglass"
                                tono={metrics.waitingRequests > 0 ? "warning" : "info"}
                            />
                        </div>
                    </div>

                    {/* ── Grafici Database ── */}
                    <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-info/10">
                                    <Lucide icon="ChartBar" className="w-6 h-6 text-info" />
                                </div>
                                <div>
                                    <h2 className="title-card">Pool Connessioni</h2>
                                    <div className="text-slate-500 text-sm">
                                        Utilizzo: {metrics.utilizationPercent}% — Picco: {averages.peakUtilization}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Doughnut — Pool Utilization */}
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-medium text-slate-500 mb-2">Utilizzo pool</span>
                                <div className="relative w-full" style={{ height: 140 }}>
                                    {poolUtilizationChartData && (
                                        <Chart
                                            type="doughnut"
                                            data={poolUtilizationChartData.data}
                                            options={poolUtilizationChartData.options}
                                            className="w-full h-full"
                                        />
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-bold text-slate-800">
                                            {metrics.utilizationPercent}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Bar — Connections Breakdown */}
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-500 mb-2">Connessioni</span>
                                <div style={{ height: 140 }}>
                                    {connectionsBarChartData && (
                                        <Chart
                                            type="bar"
                                            data={connectionsBarChartData.data}
                                            options={connectionsBarChartData.options}
                                            className="w-full h-full"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Storico Connessioni (Line Chart) ── */}
                    <div className="flex flex-col col-span-12 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                                    <Lucide icon="TrendingUp" className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="title-card">Storico connessioni</h2>
                                    <div className="text-slate-500 text-sm">
                                        Media: {averages.avgActiveConnections} attive — Picco: {averages.peakActiveConnections}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {historyLineChartData ? (
                            <div style={{ height: 220 }}>
                                <Chart
                                    type="line"
                                    data={historyLineChartData.data}
                                    options={historyLineChartData.options}
                                    className="w-full h-full"
                                />
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400">
                                <Lucide icon="Clock" className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">Storico non ancora disponibile — i dati si accumulano nel tempo.</p>
                            </div>
                        )}
                    </div>

                    {/* ── Utenti Online ── */}
                    <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                                    <Lucide icon="Server" className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="title-card">Stato sistema</h2>
                                    <div className="text-slate-500 text-sm">Sessioni e connessioni attive</div>
                                </div>
                            </div>
                            <div className="text-2xs text-slate-400 pl-14">
                                Aggiornato {formatData(new Date())}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <StatCard
                                densita="compatta"
                                etichetta="Sessioni attive"
                                valore={data.onlineUsers.activeSessions}
                                icona="Users"
                                tono="brand"
                            />
                            <StatCard
                                densita="compatta"
                                etichetta="WebSocket"
                                valore={data.onlineUsers.wsConnections}
                                icona="Radio"
                                tono="info"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard
                                densita="compatta"
                                etichetta="Ultimo audit"
                                valore={
                                    data.audit.lastAuditTime
                                        ? dayjs(data.audit.lastAuditTime).format("HH:mm:ss")
                                        : null
                                }
                                icona="Clock"
                                tono="info"
                            />
                            <StatCard
                                densita="compatta"
                                etichetta="Pool idle"
                                valore={metrics.idleConnections}
                                icona="Pause"
                                tono="info"
                            />
                        </div>
                    </div>

                    {/* ── Audit & Sicurezza ── */}
                    <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warning/10">
                                    <Lucide icon="Shield" className="w-6 h-6 text-warning" />
                                </div>
                                <div>
                                    <h2 className="title-card">Audit & Sicurezza</h2>
                                    <div className="text-slate-500 text-sm">Metriche di sicurezza del sistema</div>
                                </div>
                            </div>
                            <div className="text-2xs text-slate-400 pl-14">
                                {data.audit.totalEvents} eventi totali registrati
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <StatCard
                                densita="compatta"
                                etichetta="Login falliti"
                                valore={data.audit.failedLogins}
                                icona="ShieldOff"
                                tono={data.audit.failedLogins > 0 ? "danger" : "brand"}
                            />
                            <StatCard
                                densita="compatta"
                                etichetta="Attività sospette"
                                valore={data.audit.suspiciousActivities}
                                icona="TriangleAlert"
                                tono={data.audit.suspiciousActivities > 0 ? "danger" : "brand"}
                            />
                        </div>

                        <div className="flex flex-col gap-2 px-1">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Per severità
                            </span>
                            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
                                <div key={sev} className="flex items-center justify-between text-sm">
                                    <SeverityBadge severity={sev} />
                                    <span className="font-semibold text-slate-700">
                                        {data.audit.eventsBySeverity[sev] ?? 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Centro Alert Azionabile ── */}
                    <div className="flex flex-col col-span-12 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger/10">
                                    <Lucide icon="BellRing" className="w-6 h-6 text-danger" />
                                </div>
                                <div>
                                    <h2 className="title-card">Centro alert azionabile</h2>
                                    <div className="text-slate-500 text-sm">
                                        Prioritizza criticità e intervieni con azioni rapide
                                    </div>
                                </div>
                            </div>
                            <div className="text-2xs text-slate-400 pl-14">
                                {data.alerts?.length ?? 0} alert attivi
                            </div>
                        </div>

                        {!data.alerts || data.alerts.length === 0 ? (
                            <div className="py-8 text-center text-slate-400">
                                <Lucide icon="ShieldCheck" className="w-10 h-10 mx-auto mb-2 text-success" />
                                <p>Nessun alert attivo al momento.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-12 gap-3">
                                {data.alerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className={clsx(
                                            "col-span-12 border rounded-lg px-4 py-3",
                                            alert.severity === "CRITICAL" && "border-danger/40 bg-danger/5",
                                            alert.severity === "HIGH" && "border-warning/40 bg-warning/5",
                                            alert.severity === "MEDIUM" && "border-info/40 bg-info/5",
                                            alert.severity === "LOW" && "border-slate-200 bg-slate-50/70"
                                        )}
                                    >
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <SeverityBadge severity={alert.severity} />
                                            <StatusBadge tono={TONO_STATO_ALERT[alert.status] ?? "neutral"} etichetta={alert.status} />
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                                {alertSourceLabels[alert.source]}
                                            </span>
                                            <span className="text-2xs text-slate-500">
                                                {formatDataOra(alert.createdAt)}
                                            </span>
                                        </div>

                                        <div className="font-semibold text-slate-800 mb-1">{alert.title}</div>
                                        <p className="text-sm text-slate-600 mb-2">{alert.description}</p>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {typeof alert.metricValue === "number" && (
                                                <span className="text-2xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
                                                    Valore: {alert.metricValue}
                                                </span>
                                            )}
                                            {typeof alert.threshold === "number" && (
                                                <span className="text-2xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
                                                    Soglia: {alert.threshold}
                                                </span>
                                            )}
                                        </div>

                                        {alert.actions.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {alert.actions.map((action, idx) => (
                                                    <Link
                                                        key={`${alert.id}-action-${idx}`}
                                                        to={action.href}
                                                        className={clsx(
                                                            "text-xs font-medium px-3 py-1.5 rounded transition-colors",
                                                            alertActionButtonClass[action.variant]
                                                        )}
                                                    >
                                                        {action.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Ultimi Errori ── */}
                    <div className="flex flex-col col-span-12 p-5 box box--stacked">
                        <div className="flex flex-col gap-1 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-danger/10">
                                    <Lucide icon="OctagonAlert" className="w-6 h-6 text-danger" />
                                </div>
                                <div>
                                    <h2 className="title-card">Ultimi errori</h2>
                                    <div className="text-slate-500 text-sm">
                                        Eventi CRITICAL e HIGH — ultimi 30
                                    </div>
                                </div>
                            </div>
                        </div>

                        {data.recentErrors.length === 0 ? (
                            <div className="py-8 text-center text-slate-400">
                                <Lucide icon="CircleCheck" className="w-10 h-10 mx-auto mb-2 text-success" />
                                <p>Nessun errore recente registrato.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto -mx-5">
                                <table className="table table-hover">
                                    <thead>
                                        <tr>
                                            <th className="whitespace-nowrap">Timestamp</th>
                                            <th className="whitespace-nowrap">Severità</th>
                                            <th className="whitespace-nowrap">Tipo evento</th>
                                            <th className="whitespace-nowrap">Utente</th>
                                            <th className="whitespace-nowrap">IP</th>
                                            <th>Dettagli</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recentErrors.map((evt, idx) => (
                                            <tr key={idx}>
                                                <td className="whitespace-nowrap text-xs">
                                                    {formatDataOra(evt.timestamp)}
                                                </td>
                                                <td>
                                                    <SeverityBadge severity={evt.severity} />
                                                </td>
                                                <td className="text-xs font-mono">
                                                    {evt.eventType}
                                                </td>
                                                <td className="text-xs">
                                                    {evt.userId ?? "—"}
                                                </td>
                                                <td className="text-xs font-mono">
                                                    {evt.ipAddress ?? "—"}
                                                </td>
                                                <td className="text-xs max-w-xs truncate">
                                                    {evt.details
                                                        ? JSON.stringify(evt.details).slice(0, 100)
                                                        : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default withSessionCheck(SuperadminDashboard);
