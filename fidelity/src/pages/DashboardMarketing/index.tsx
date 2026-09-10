import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import type { ChartOptions, TooltipItem } from "chart.js";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import React, { useMemo, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import type {
    SavedPromoScoreboard,
    TracciatoReportCanaleAreaView,
    TracciatoWidgetScoreboard,
} from "../../../lib/types";

dayjs.locale("it");

type ScoreboardPoint = {
    key: string;
    label: string;
    nomeCanale: string;
    nomeArea: string;
    score: number;
    referenze: number;
};

type AreaCanaleSeries = {
    key: string;
    label: string;
    nomeCanale: string;
    nomeArea: string;
    data: Array<number | null>;
    average: number;
    count: number;
    latestScore: number | null;
    latestPromo: string;
    referenze: number;
    trend: number | null;
};

type RepartoTrendSeries = {
    reparto: string;
    data: Array<number | null>;
    average: number;
};

type CanaleAreaRepartoSeries = {
    key: string;
    label: string;
    nomeCanale: string;
    nomeArea: string;
    average: number;
    series: RepartoTrendSeries[];
};

type SortKey = "label" | "average" | "latestScore" | "trend";
type SortDir = "asc" | "desc";

const SCORE_COLORS = [
    "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2",
    "#7c3aed", "#65a30d", "#be123c", "#0f766e", "#9333ea",
    "#ea580c", "#4f46e5",
];

const DIST_BUCKET_LABELS = ["0–20", "21–40", "41–60", "61–80", "81–100"];
const DIST_BUCKET_COLORS = ["#dc2626", "#f97316", "#d97706", "#84cc16", "#059669"];

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const scoreBarColor = (score: number): string =>
    score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#dc2626";

const scoreColorCls = (score: number): string =>
    score >= 70 ? "text-success font-semibold" : score >= 40 ? "text-warning font-semibold" : "text-danger font-semibold";

const getScoreboardWidget = (
    widgets: TracciatoReportCanaleAreaView["widgets"],
): TracciatoWidgetScoreboard | null =>
    widgets.find((w): w is TracciatoWidgetScoreboard => w.type === "scoreboard") ?? null;

const getScoreboardRows = (
    widgets: TracciatoReportCanaleAreaView["widgets"],
): TracciatoWidgetScoreboard["rows"] => getScoreboardWidget(widgets)?.rows ?? [];

const getFallbackLabel = (s: SavedPromoScoreboard): string =>
    s.promoNome || s.report.title || s.idPromo;

const extractScoreboardPoints = (scoreboard: SavedPromoScoreboard): ScoreboardPoint[] => {
    const views = scoreboard.report.viewsPerCanaleArea?.filter((v) => v.guidCanale !== "__all__") ?? [];

    if (views.length > 0) {
        return views.flatMap((view) => {
            const widget = getScoreboardWidget(view.widgets);
            if (!widget) return [];
            const label = view.label || [view.nomeCanale, view.nomeArea].filter(Boolean).join(" - ");
            const key = `${view.guidCanale}::${view.guidArea}`;
            return [{
                key,
                label: label || key,
                nomeCanale: view.nomeCanale || view.guidCanale,
                nomeArea: view.nomeArea || view.guidArea,
                score: clampScore(widget.totalScore),
                referenze: widget.rows.reduce((sum, row) => sum + row.totale, 0),
            }];
        });
    }

    const widget = getScoreboardWidget(scoreboard.report.widgets);
    if (!widget) return [];
    return [{
        key: "__global__",
        label: "Totale promo",
        nomeCanale: "Tutti i canali",
        nomeArea: "Tutte le aree",
        score: clampScore(widget.totalScore),
        referenze: widget.rows.reduce((sum, row) => sum + row.totale, 0),
    }];
};

const buildSeries = (scoreboards: SavedPromoScoreboard[]): AreaCanaleSeries[] => {
    const seriesMap = new Map<string, Omit<AreaCanaleSeries, "average" | "count" | "latestScore" | "latestPromo" | "trend">>();

    scoreboards.forEach((scoreboard, idx) => {
        extractScoreboardPoints(scoreboard).forEach((point) => {
            const existing = seriesMap.get(point.key) ?? {
                key: point.key,
                label: point.label,
                nomeCanale: point.nomeCanale,
                nomeArea: point.nomeArea,
                data: Array.from<number | null>({ length: scoreboards.length }).fill(null),
                referenze: 0,
            };
            existing.label = point.label;
            existing.nomeCanale = point.nomeCanale;
            existing.nomeArea = point.nomeArea;
            existing.data[idx] = point.score;
            existing.referenze += point.referenze;
            seriesMap.set(point.key, existing);
        });
    });

    return [...seriesMap.values()]
        .map((s) => {
            const values = s.data.filter((v): v is number => typeof v === "number");
            const filledIndices = s.data.reduce<number[]>(
                (acc, v, i) => { if (typeof v === "number") acc.push(i); return acc; },
                [],
            );
            const latestIndex = filledIndices.length > 0 ? filledIndices[filledIndices.length - 1] : -1;
            const latestScore = latestIndex !== -1 ? (s.data[latestIndex] as number) : null;
            let trend: number | null = null;
            if (filledIndices.length >= 2) {
                const last = s.data[filledIndices[filledIndices.length - 1]] as number;
                const prev = s.data[filledIndices[filledIndices.length - 2]] as number;
                trend = Math.round(last - prev);
            }
            return {
                ...s,
                average: values.length > 0
                    ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
                    : 0,
                count: values.length,
                latestScore,
                latestPromo: latestIndex !== -1 ? getFallbackLabel(scoreboards[latestIndex]) : "",
                trend,
            };
        })
        .sort((a, b) => b.average - a.average || a.label.localeCompare(b.label));
};

const buildCanaleAreaRepartoSeries = (scoreboards: SavedPromoScoreboard[]): CanaleAreaRepartoSeries[] => {
    const viewsMap = new Map<string, {
        key: string;
        label: string;
        nomeCanale: string;
        nomeArea: string;
        reparti: Map<string, Array<number | null>>;
    }>();

    scoreboards.forEach((scoreboard, idx) => {
        const views = scoreboard.report.viewsPerCanaleArea?.filter((view) => view.guidCanale !== "__all__") ?? [];
        views.forEach((view) => {
            const rows = getScoreboardRows(view.widgets);
            if (!rows.length) return;

            const key = `${view.guidCanale}::${view.guidArea}`;
            const fallbackLabel = [view.nomeCanale, view.nomeArea].filter(Boolean).join(" - ");
            const existing = viewsMap.get(key) ?? {
                key,
                label: view.label || fallbackLabel || key,
                nomeCanale: view.nomeCanale || view.guidCanale,
                nomeArea: view.nomeArea || view.guidArea,
                reparti: new Map<string, Array<number | null>>(),
            };

            existing.label = view.label || fallbackLabel || existing.label || key;
            existing.nomeCanale = view.nomeCanale || existing.nomeCanale;
            existing.nomeArea = view.nomeArea || existing.nomeArea;

            rows.forEach((row) => {
                const reparto = row.reparto?.trim();
                if (!reparto) return;

                const repartoData = existing.reparti.get(reparto)
                    ?? Array.from<number | null>({ length: scoreboards.length }).fill(null);
                repartoData[idx] = clampScore(row.score);
                existing.reparti.set(reparto, repartoData);
            });

            viewsMap.set(key, existing);
        });
    });

    return [...viewsMap.values()]
        .map((view) => {
            const series = [...view.reparti.entries()]
                .map(([reparto, data]) => {
                    const values = data.filter((v): v is number => typeof v === "number");
                    return {
                        reparto,
                        data,
                        average: values.length > 0
                            ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
                            : 0,
                    };
                })
                .filter((entry) => entry.data.some((value) => value !== null))
                .sort((a, b) => b.average - a.average || a.reparto.localeCompare(b.reparto));

            const allScores = series.flatMap((entry) => entry.data).filter((v): v is number => typeof v === "number");

            return {
                key: view.key,
                label: view.label || view.key,
                nomeCanale: view.nomeCanale,
                nomeArea: view.nomeArea,
                average: allScores.length > 0
                    ? Math.round(allScores.reduce((sum, value) => sum + value, 0) / allScores.length)
                    : 0,
                series,
            };
        })
        .filter((view) => view.series.length > 0)
        .sort((a, b) => b.average - a.average || a.label.localeCompare(b.label));
};

const MarketingSkeleton: React.FC = () => (
    <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="box box--stacked p-5">
                    <Skeleton height="12px" width="90px" className="mb-3" />
                    <Skeleton height="34px" width="70px" />
                </div>
            ))}
        </div>
        <div className="box box--stacked col-span-12 p-5">
            <Skeleton height="18px" width="220px" className="mb-5" />
            <Skeleton height="360px" />
        </div>
    </div>
);

const PulseCard: React.FC<{
    label: string;
    value: string;
    icon: string;
    accentClass: string;
    sub?: string;
}> = ({ label, value, icon, accentClass, sub }) => (
    <div className="box box--stacked overflow-hidden p-5">
        <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl", accentClass)}>
            <Lucide icon={icon} className="h-5 w-5" />
        </div>
        <div className="mt-3">
            <div className="text-3xl font-extrabold tracking-tight text-slate-800">{value}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</div>
            {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
    </div>
);

const PerformerCard: React.FC<{
    series: AreaCanaleSeries;
    rank: number;
    variant: "top" | "bottom";
}> = ({ series, rank, variant }) => (
    <div className={clsx(
        "flex items-center gap-3 rounded-lg border p-3",
        variant === "top" ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5",
    )}>
        <div className={clsx(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold",
            variant === "top" ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
        )}>
            #{rank}
        </div>
        <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">{series.label}</div>
            <div className="text-xs text-slate-500">{series.nomeArea} · {series.nomeCanale}</div>
        </div>
        <div className="text-right">
            <div className={clsx("text-lg font-extrabold", scoreColorCls(series.average))}>{series.average}</div>
            <div className="text-xs text-slate-400">media</div>
        </div>
    </div>
);

const DashboardMarketing: React.FC = () => {
    const [sortKey, setSortKey] = useState<SortKey>("average");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [selectedCanaleAreaKey, setSelectedCanaleAreaKey] = useState<string | null>(null);

    const scoreboardsQuery = useQuery({
        queryKey: ["marketingPromoScoreboards"],
        queryFn: () => ServerCall.get<SavedPromoScoreboard[]>("/scoreboard"),
        placeholderData: (previous) => previous ?? [],
    });

    const scoreboards = useMemo(
        () => scoreboardsQuery.data ?? [],
        [scoreboardsQuery.data],
    );

    const labels = useMemo(() => scoreboards.map(getFallbackLabel), [scoreboards]);
    const series = useMemo(() => buildSeries(scoreboards), [scoreboards]);
    const canaleAreaRepartoSeries = useMemo(
        () => buildCanaleAreaRepartoSeries(scoreboards),
        [scoreboards],
    );
    const activeCanaleArea = useMemo<CanaleAreaRepartoSeries | null>(() => {
        if (!canaleAreaRepartoSeries.length) return null;
        if (!selectedCanaleAreaKey) return canaleAreaRepartoSeries[0];
        return canaleAreaRepartoSeries.find((view) => view.key === selectedCanaleAreaKey) ?? canaleAreaRepartoSeries[0];
    }, [canaleAreaRepartoSeries, selectedCanaleAreaKey]);

    const allScoreValues = useMemo(
        () => series.flatMap((s) => s.data).filter((v): v is number => typeof v === "number"),
        [series],
    );

    const averageScore = allScoreValues.length > 0
        ? Math.round(allScoreValues.reduce((sum, v) => sum + v, 0) / allScoreValues.length)
        : 0;
    const trendPositivi = useMemo(() => series.filter((s) => s.trend !== null && s.trend > 0).length, [series]);
    const trendNegativi = useMemo(() => series.filter((s) => s.trend !== null && s.trend < 0).length, [series]);
    const lastComputedAt = scoreboards.length > 0
        ? scoreboards.reduce((latest, s) => dayjs(s.computedAt).isAfter(dayjs(latest.computedAt)) ? s : latest, scoreboards[0])
        : null;

    const snapshotSeries = useMemo(
        () => [...series].filter((s) => s.latestScore !== null).sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0)),
        [series],
    );
    const snapshotChartHeight = Math.max(200, snapshotSeries.length * 34);
    const snapshotChartData = useMemo(() => ({
        labels: snapshotSeries.map((s) => s.label),
        datasets: [{
            label: "Ultimo score",
            data: snapshotSeries.map((s) => s.latestScore),
            backgroundColor: snapshotSeries.map((s) => scoreBarColor(s.latestScore ?? 0)),
            borderRadius: 4,
            borderSkipped: false,
        }],
    }), [snapshotSeries]);
    const snapshotOptions = useMemo<ChartOptions<"bar">>(() => ({
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "#0f172a",
                callbacks: { label: (ctx: TooltipItem<"bar">) => ` ${Math.round(ctx.parsed.x as number)}/100` },
            },
        },
        scales: {
            x: { min: 0, max: 100, grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { color: "#475569", font: { size: 11 } } },
        },
    }), []);

    const distBuckets = useMemo(() => {
        const counts = [0, 0, 0, 0, 0];
        for (const v of allScoreValues) counts[Math.min(Math.floor(v / 20), 4)]++;
        return counts;
    }, [allScoreValues]);
    const distChartData = useMemo(() => ({
        labels: DIST_BUCKET_LABELS,
        datasets: [{
            label: "Promo",
            data: distBuckets,
            backgroundColor: DIST_BUCKET_COLORS,
            borderRadius: 4,
            borderSkipped: false,
        }],
    }), [distBuckets]);
    const distOptions = useMemo<ChartOptions<"bar">>(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: "#0f172a", callbacks: { label: (ctx: TooltipItem<"bar">) => ` ${ctx.parsed.y} promo` } },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#94a3b8", font: { size: 11 }, stepSize: 1 } },
        },
    }), []);

    const top3 = useMemo(() => [...series].sort((a, b) => b.average - a.average).slice(0, 3), [series]);
    const bottom3 = useMemo(() => [...series].sort((a, b) => a.average - b.average).slice(0, 3), [series]);

    const lineChartData = useMemo(() => ({
        labels,
        datasets: (activeCanaleArea?.series ?? []).map((s, i) => {
            const color = SCORE_COLORS[i % SCORE_COLORS.length];
            return {
                label: s.reparto,
                data: s.data,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.32,
                spanGaps: false,
                fill: false,
            };
        }),
    }), [activeCanaleArea, labels]);
    const lineOptions = useMemo<ChartOptions<"line">>(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom",
                labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 16, color: "#64748b", font: { size: 11 } },
            },
            tooltip: {
                backgroundColor: "#0f172a",
                titleColor: "#f8fafc",
                bodyColor: "#e2e8f0",
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                    label: (ctx: TooltipItem<"line">) =>
                        `${ctx.dataset.label ?? ""}: ${typeof ctx.parsed.y === "number" ? Math.round(ctx.parsed.y) : 0}/100`,
                },
            },
        },
        scales: {
            x: { grid: { color: "rgba(148,163,184,0.08)" }, ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 35 } },
            y: { min: 0, max: 100, grid: { color: "rgba(148,163,184,0.15)" }, ticks: { stepSize: 20, color: "#94a3b8", font: { size: 11 } } },
        },
    }), []);

    const handleSort = (key: SortKey) => {
        if (key === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("desc"); }
    };

    const sortedSeries = useMemo(() => {
        const dir = sortDir === "asc" ? 1 : -1;
        return [...series].sort((a, b) => {
            if (sortKey === "label") return dir * a.label.localeCompare(b.label);
            if (sortKey === "average") return dir * (a.average - b.average);
            if (sortKey === "latestScore") return dir * ((a.latestScore ?? -1) - (b.latestScore ?? -1));
            if (sortKey === "trend") return dir * ((a.trend ?? 0) - (b.trend ?? 0));
            return 0;
        });
    }, [series, sortKey, sortDir]);

    const sortArrow = (col: SortKey) => {
        if (col !== sortKey) return <Lucide icon="ChevronsUpDown" className="ml-1 inline h-3.5 w-3.5 text-slate-300" />;
        return sortDir === "asc"
            ? <Lucide icon="ChevronUp" className="ml-1 inline h-3.5 w-3.5 text-theme-1" />
            : <Lucide icon="ChevronDown" className="ml-1 inline h-3.5 w-3.5 text-theme-1" />;
    };

    const isLoading = scoreboardsQuery.isLoading;
    const isError = scoreboardsQuery.isError;
    const isEmpty = scoreboards.length === 0 || series.length === 0;

    return (
        <>
            <PageHeader
                title="Dashboard Marketing"
                description="Analisi scoreboard promo con trend, distribuzione e confronto combinazioni area/canale"
                actions={(
                    <Button
                        type="button"
                        variant="outline-primary"
                        onClick={() => scoreboardsQuery.refetch()}
                        disabled={scoreboardsQuery.isFetching}
                    >
                        <Lucide icon="RefreshCw" className={clsx("mr-2 h-4 w-4", scoreboardsQuery.isFetching && "animate-spin")} />
                        Aggiorna
                    </Button>
                )}
            />

            {isLoading ? (
                <MarketingSkeleton />
            ) : isError ? (
                <div className="box box--stacked p-8">
                    <EmptyState
                        icon="CircleAlert"
                        iconColor="text-danger"
                        title="Scoreboard non disponibili"
                        description="Non riesco a caricare i dati marketing in questo momento."
                        buttonText="Riprova"
                        onButtonClick={() => scoreboardsQuery.refetch()}
                    />
                </div>
            ) : isEmpty ? (
                <div className="box box--stacked p-8">
                    <EmptyState
                        icon="ChartBar"
                        title="Nessuno scoreboard calcolato"
                        description="Quando le promo avranno uno scoreboard salvato, il riepilogo marketing comparirà qui."
                    />
                </div>
            ) : (
                <div className="grid grid-cols-12 gap-5">

                    {/* A — Score Pulse */}
                    <div className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <PulseCard
                            label="Promozioni"
                            value={scoreboards.length.toLocaleString("it-IT")}
                            icon="Megaphone"
                            accentClass="bg-theme-1/10 text-theme-1"
                            sub={lastComputedAt ? `Ultimo: ${dayjs(lastComputedAt.computedAt).format("DD MMM")}` : undefined}
                        />
                        <PulseCard
                            label="Score medio"
                            value={`${averageScore}/100`}
                            icon="Gauge"
                            accentClass={clsx(
                                averageScore >= 70 ? "bg-success/15 text-success" :
                                    averageScore >= 40 ? "bg-warning/15 text-warning" :
                                        "bg-danger/15 text-danger",
                            )}
                            sub={`${series.length} combinazioni area/canale`}
                        />
                        <PulseCard
                            label="Trend positivi"
                            value={`↑ ${trendPositivi}`}
                            icon="TrendingUp"
                            accentClass="bg-success/15 text-success"
                            sub="Ultima vs penultima promo"
                        />
                        <PulseCard
                            label="Trend negativi"
                            value={`↓ ${trendNegativi}`}
                            icon="TrendingDown"
                            accentClass="bg-danger/15 text-danger"
                            sub="Ultima vs penultima promo"
                        />
                    </div>

                    {/* B — Snapshot + Distribuzione */}
                    <div className="col-span-12 grid grid-cols-12 gap-5">
                        <div className="col-span-12 box box--stacked lg:col-span-8">
                            <div className="flex items-center gap-3 border-b border-slate-200/70 p-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-theme-1/10">
                                    <Lucide icon="ChartBar" className="h-4 w-4 text-theme-1" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">Snapshot ultimo score</h2>
                                    <p className="text-xs text-slate-500">Score più recente per ogni combinazione, ordinato decrescente</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <div style={{ height: snapshotChartHeight }}>
                                    <Chart type="bar" data={snapshotChartData as any} options={snapshotOptions as any} height={snapshotChartHeight} />
                                </div>
                            </div>
                        </div>
                        <div className="col-span-12 box box--stacked lg:col-span-4">
                            <div className="flex items-center gap-3 border-b border-slate-200/70 p-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-info/10">
                                    <Lucide icon="ChartColumn" className="h-4 w-4 text-info" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">Distribuzione score</h2>
                                    <p className="text-xs text-slate-500">{allScoreValues.length} punti score totali</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <Chart type="bar" data={distChartData as any} options={distOptions as any} height={220} />
                            </div>
                        </div>
                    </div>

                    {/* C — Top / Bottom performer */}
                    {series.length >= 2 && (
                        <div className="col-span-12 grid grid-cols-12 gap-5">
                            <div className="col-span-12 box box--stacked lg:col-span-6">
                                <div className="flex items-center gap-3 border-b border-slate-200/70 p-5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
                                        <Lucide icon="Trophy" className="h-4 w-4 text-success" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold text-slate-800">Top performer</h2>
                                        <p className="text-xs text-slate-500">Score medio più alto</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 p-5">
                                    {top3.map((s, i) => <PerformerCard key={s.key} series={s} rank={i + 1} variant="top" />)}
                                </div>
                            </div>
                            <div className="col-span-12 box box--stacked lg:col-span-6">
                                <div className="flex items-center gap-3 border-b border-slate-200/70 p-5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10">
                                        <Lucide icon="TriangleAlert" className=" h-4 w-4 text-danger" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold text-slate-800">Da migliorare</h2>
                                        <p className="text-xs text-slate-500">Score medio più basso</p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 p-5">
                                    {bottom3.map((s, i) => <PerformerCard key={s.key} series={s} rank={i + 1} variant="bottom" />)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* D — Andamento nel tempo */}
                    <div className="box box--stacked col-span-12">
                        <div className="flex flex-col gap-3 border-b border-slate-200/70 p-5 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-theme-1/10">
                                    <Lucide icon="ChartLine" className="h-4 w-4 text-theme-1" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-800">Andamento nel tempo</h2>
                                    <p className="text-xs text-slate-500">Trend reparti per coppia canale/area con mappatura CoopFi da AgenziaLib</p>
                                </div>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                                {(activeCanaleArea?.series.length ?? 0).toLocaleString("it-IT")} reparti
                            </div>
                        </div>

                        {canaleAreaRepartoSeries.length === 0 ? (
                            <div className="p-5">
                                <EmptyState
                                    icon="Network"
                                    title="Nessun dettaglio canale/area disponibile"
                                    description="I trend per reparto appariranno qui appena presenti nei report scoreboard."
                                />
                            </div>
                        ) : (
                            <>
                                <div className="border-b border-slate-100 px-5 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        {canaleAreaRepartoSeries.map((view) => (
                                            <button
                                                key={view.key}
                                                type="button"
                                                onClick={() => setSelectedCanaleAreaKey(view.key)}
                                                className={clsx(
                                                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                                    activeCanaleArea?.key === view.key
                                                        ? "border-theme-1 bg-theme-1 text-white shadow-sm"
                                                        : "border-slate-300 bg-white text-slate-600 hover:border-theme-1/50 hover:text-theme-1",
                                                )}
                                            >
                                                {view.label}
                                            </button>
                                        ))}
                                    </div>
                                    {activeCanaleArea && (
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {activeCanaleArea.series.map((serie) => (
                                                <span
                                                    key={`${activeCanaleArea.key}-${serie.reparto}`}
                                                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                                                >
                                                    {serie.reparto}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-x-auto p-5">
                                    <div className="min-w-[760px]">
                                        <Chart type="line" data={lineChartData as any} options={lineOptions as any} height={420} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* E — Tabella dettaglio con trend */}
                    <div className="box box--stacked col-span-12">
                        <div className="border-b border-slate-200/70 p-5">
                            <h2 className="text-sm font-semibold text-slate-800">Dettaglio combinazioni</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Click sull'intestazione per ordinare · Δ trend = variazione rispetto alla penultima promo disponibile
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                                    <tr>
                                        <th
                                            className="cursor-pointer select-none px-5 py-3 font-semibold hover:text-slate-600"
                                            onClick={() => handleSort("label")}
                                        >
                                            Area / Canale {sortArrow("label")}
                                        </th>
                                        <th
                                            className="cursor-pointer select-none px-5 py-3 font-semibold hover:text-slate-600"
                                            onClick={() => handleSort("average")}
                                        >
                                            Score medio {sortArrow("average")}
                                        </th>
                                        <th
                                            className="cursor-pointer select-none px-5 py-3 font-semibold hover:text-slate-600"
                                            onClick={() => handleSort("latestScore")}
                                        >
                                            Ultimo score {sortArrow("latestScore")}
                                        </th>
                                        <th
                                            className="cursor-pointer select-none px-5 py-3 font-semibold hover:text-slate-600"
                                            onClick={() => handleSort("trend")}
                                        >
                                            Δ Trend {sortArrow("trend")}
                                        </th>
                                        <th className="px-5 py-3 font-semibold">Promo con dato</th>
                                        <th className="px-5 py-3 font-semibold">Referenze</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedSeries.map((s) => {
                                        const trendLabel = s.trend === null ? "—"
                                            : s.trend > 0 ? `↑ +${s.trend}`
                                                : s.trend < 0 ? `↓ ${s.trend}`
                                                    : "→ 0";
                                        const trendCls = s.trend === null || s.trend === 0
                                            ? "text-slate-400"
                                            : s.trend > 0 ? "text-success font-medium" : "text-danger font-medium";
                                        return (
                                            <tr key={s.key} className="bg-white hover:bg-slate-50/50">
                                                <td className="px-5 py-4">
                                                    <div className="font-semibold text-slate-800">{s.label}</div>
                                                    <div className="mt-0.5 text-xs text-slate-400">{s.nomeArea} / {s.nomeCanale}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={scoreColorCls(s.average)}>{s.average}/100</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className={s.latestScore !== null ? scoreColorCls(s.latestScore) : "text-slate-400"}>
                                                        {s.latestScore === null ? "—" : `${s.latestScore}/100`}
                                                    </div>
                                                    {s.latestPromo && (
                                                        <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">{s.latestPromo}</div>
                                                    )}
                                                </td>
                                                <td className={clsx("px-5 py-4", trendCls)}>{trendLabel}</td>
                                                <td className="px-5 py-4 text-slate-600">{s.count} / {scoreboards.length}</td>
                                                <td className="px-5 py-4 text-slate-600">{s.referenze.toLocaleString("it-IT")}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </>
    );
};

export default DashboardMarketing;
