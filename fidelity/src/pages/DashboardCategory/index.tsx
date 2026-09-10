import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import { FormInput } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import type { ChartOptions, TooltipItem } from "chart.js";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import React, { useCallback, useMemo, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import type {
    CategoryScoreboardTimeline,
    GlobalUserFilter,
} from "../../../lib/types";
import type { PromoResponseDTO } from "../../../server/core/dto";

dayjs.locale("it");

type KitVolantino = {
    id: string;
    titolo: string;
    nome_area?: string;
    nome_canale?: string;
    stato_lavorazione: string;
    nome_promo: string;
    id_promo?: string;
};

type VolantiniInCorso = {
    totale: number;
    inScadenza: number;
    kit: KitVolantino[];
};

const REPARTO_COLORS = [
    "#2563eb", "#059669", "#d97706", "#dc2626",
    "#0891b2", "#7c3aed", "#65a30d", "#be123c",
    "#0f766e", "#9333ea", "#ea580c", "#4f46e5",
];
const CANALE_AREA_COLORS = [
    "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
    "#6366f1", "#06b6d4", "#84cc16", "#f97316",
];

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function getScoreColor(score: number) {
    if (score >= 70) return { bg: "bg-success/10", text: "text-success" };
    if (score >= 40) return { bg: "bg-warning/10", text: "text-warning" };
    return { bg: "bg-danger/10", text: "text-danger" };
}

type RepartoSeries = CategoryScoreboardTimeline["series"][number];
type CanaleAreaSeries = CategoryScoreboardTimeline["canaleAreaSeries"][number];
type TimelinePromo = CategoryScoreboardTimeline["promos"][number];

function getPromoValidaDalSortKey(promo: TimelinePromo): number {
    if (promo.validaDal) {
        const validaDal = dayjs(promo.validaDal);
        if (validaDal.isValid()) return validaDal.valueOf();
    }

    const computedAt = dayjs(promo.computedAt);
    if (computedAt.isValid()) return computedAt.valueOf();

    return Number.MAX_SAFE_INTEGER;
}

function comparePromoByValidaDalAsc(a: TimelinePromo, b: TimelinePromo): number {
    const diff = getPromoValidaDalSortKey(a) - getPromoValidaDalSortKey(b);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id, "it");
}

function getRangeBounds(dateFrom: string, dateTo: string) {
    const from = dateFrom ? dayjs(dateFrom).startOf("day") : null;
    const to = dateTo ? dayjs(dateTo).endOf("day") : null;
    return {
        from: from && from.isValid() ? from : null,
        to: to && to.isValid() ? to : null,
    };
}

function promoOverlapsRange(
    promo: { validaDal?: string; validaAl?: string; computedAt?: string },
    dateFrom: string,
    dateTo: string,
): boolean {
    const { from, to } = getRangeBounds(dateFrom, dateTo);
    if (!from && !to) return true;

    const fallback = dayjs(promo.computedAt);
    const start = promo.validaDal
        ? dayjs(promo.validaDal).startOf("day")
        : (fallback.isValid() ? fallback.startOf("day") : null);
    const end = promo.validaAl
        ? dayjs(promo.validaAl).endOf("day")
        : (start ? start.endOf("day") : (fallback.isValid() ? fallback.endOf("day") : null));

    if (!start || !start.isValid() || !end || !end.isValid()) return false;
    if (from && end.isBefore(from)) return false;
    if (to && start.isAfter(to)) return false;
    return true;
}

const StatCard: React.FC<{
    label: string;
    value: string;
    icon: string;
    tone?: "primary" | "success" | "warning" | "info";
}> = ({ label, value, icon, tone = "primary" }) => {
    const tones = {
        primary: "bg-theme-1/10 text-theme-1",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        info: "bg-info/10 text-info",
    };
    return (
        <div className="box box--stacked p-5">
            <div className="flex items-center gap-4">
                <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", tones[tone])}>
                    <Lucide icon={icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-1 truncate text-2xl font-bold text-slate-800">{value}</div>
                </div>
            </div>
        </div>
    );
};

const CategorySkeleton: React.FC = () => (
    <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 grid grid-cols-1 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="box box--stacked p-5">
                    <Skeleton height="12px" width="90px" className="mb-3" />
                    <Skeleton height="34px" width="70px" />
                </div>
            ))}
        </div>
        <div className="col-span-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="box box--stacked p-5"><Skeleton height="200px" /></div>
            <div className="box box--stacked p-5"><Skeleton height="200px" /></div>
        </div>
        <div className="box box--stacked col-span-12 p-5"><Skeleton height="360px" /></div>
    </div>
);

const DashboardCategory: React.FC = () => {
    const [selectedCanaleAreaKey, setSelectedCanaleAreaKey] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");

    const filtersQuery = useQuery({
        queryKey: ["categoryGlobalFilters"],
        queryFn: () => ServerCall.get<GlobalUserFilter>("/utenti/me/global-filters"),
    });

    const categoryTimelineQuery = useQuery({
        queryKey: ["categoryScoreboardTimeline"],
        queryFn: () => ServerCall.get<CategoryScoreboardTimeline>("/scoreboard/category-timeline"),
    });

    const volantiniQuery = useQuery({
        queryKey: ["categoryVolantiniInCorso"],
        queryFn: () => ServerCall.get<VolantiniInCorso>("/dashboard/volantini-in-corso"),
    });

    const promoQuery = useQuery({
        queryKey: ["categoryPromoInCorso"],
        queryFn: () => ServerCall.get<PromoResponseDTO[]>("/promo/in-corso"),
        placeholderData: (p) => p ?? [],
    });

    const filters = filtersQuery.data;
    const settoriNomi = useMemo(() => filters?.settoriNomi ?? [], [filters]);
    const rawTimelinePromos = useMemo(
        () => [...(categoryTimelineQuery.data?.promos ?? [])].sort(
            (a, b) => dayjs(a.computedAt).valueOf() - dayjs(b.computedAt).valueOf(),
        ),
        [categoryTimelineQuery.data],
    );
    const rawRepartoSeries = useMemo<RepartoSeries[]>(
        () => categoryTimelineQuery.data?.series ?? [],
        [categoryTimelineQuery.data],
    );
    const rawCanaleAreaSeries = useMemo<CanaleAreaSeries[]>(
        () => categoryTimelineQuery.data?.canaleAreaSeries ?? [],
        [categoryTimelineQuery.data],
    );
    const selectedTimelineEntries = useMemo(
        () => rawTimelinePromos
            .map((promo, index) => ({ promo, index }))
            .filter(({ promo }) => promoOverlapsRange(promo, dateFrom, dateTo)),
        [dateFrom, dateTo, rawTimelinePromos],
    );
    const timelinePromos = useMemo(
        () => selectedTimelineEntries.map(entry => entry.promo),
        [selectedTimelineEntries],
    );
    const repartoSeries = useMemo<RepartoSeries[]>(
        () => rawRepartoSeries.map(series => {
            const data = selectedTimelineEntries.map(({ index }) => series.data[index] ?? null);
            const nums = data.filter((v): v is number => v !== null);
            return {
                ...series,
                data,
                average: nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0,
            };
        }),
        [rawRepartoSeries, selectedTimelineEntries],
    );
    const canaleAreaSeries = useMemo<CanaleAreaSeries[]>(
        () => rawCanaleAreaSeries
            .map(ca => {
                const series = ca.series.map(repartoSeriesItem => {
                    const data = selectedTimelineEntries.map(({ index }) => repartoSeriesItem.data[index] ?? null);
                    const nums = data.filter((v): v is number => v !== null);
                    return {
                        ...repartoSeriesItem,
                        data,
                        average: nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0,
                    };
                });
                const allScores = series.flatMap(s => s.data).filter((v): v is number => v !== null);
                return {
                    ...ca,
                    series,
                    average: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
                };
            })
            .filter(ca => ca.series.some(s => s.data.some(value => value !== null))),
        [rawCanaleAreaSeries, selectedTimelineEntries],
    );
    const activeCanaleArea = useMemo<CanaleAreaSeries | null>(() => {
        if (!canaleAreaSeries.length) return null;
        if (!selectedCanaleAreaKey) return canaleAreaSeries[0];
        return canaleAreaSeries.find(ca => ca.key === selectedCanaleAreaKey) ?? canaleAreaSeries[0];
    }, [canaleAreaSeries, selectedCanaleAreaKey]);
    const isDateRangeActive = Boolean(dateFrom || dateTo);

    const handleDateFromChange = useCallback((value: string) => {
        setDateFrom(value);
        if (value && dateTo && dayjs(value).isAfter(dayjs(dateTo), "day")) {
            setDateTo(value);
        }
    }, [dateTo]);

    const handleDateToChange = useCallback((value: string) => {
        setDateTo(value);
        if (value && dateFrom && dayjs(value).isBefore(dayjs(dateFrom), "day")) {
            setDateFrom(value);
        }
    }, [dateFrom]);

    const clearDateRange = useCallback(() => {
        setDateFrom("");
        setDateTo("");
    }, []);

    const applyPresetDays = useCallback((days: number) => {
        const to = dayjs().format("YYYY-MM-DD");
        const from = dayjs().subtract(days - 1, "day").format("YYYY-MM-DD");
        setDateFrom(from);
        setDateTo(to);
    }, []);

    const timelineRows = useMemo(
        () => timelinePromos.map((promo, index) => ({
            promo,
            scoreByReparto: new Map(
                repartoSeries.map(series => [series.reparto, series.data[index] ?? null]),
            ),
        })),
        [timelinePromos, repartoSeries],
    );

    // Raggruppa promos per validaDal (fallback: computedAt) e ordina sempre cronologicamente (asc)
    const groupedByDate = useMemo(() => {
        const dateGroups = new Map<string, number[]>();
        timelinePromos.forEach((promo, idx) => {
            const key = promo.validaDal ?? dayjs(promo.computedAt).format("YYYY-MM-DD");
            if (!dateGroups.has(key)) dateGroups.set(key, []);
            dateGroups.get(key)!.push(idx);
        });
        return [...dateGroups.entries()]
            .map(([date, indices]) => ({ date, indices }))
            .sort((a, b) => {
                const aDate = dayjs(a.date);
                const bDate = dayjs(b.date);
                const aTime = aDate.isValid() ? aDate.valueOf() : Number.MAX_SAFE_INTEGER;
                const bTime = bDate.isValid() ? bDate.valueOf() : Number.MAX_SAFE_INTEGER;
                if (aTime !== bTime) return aTime - bTime;
                return a.date.localeCompare(b.date, "it");
            });
    }, [timelinePromos]);

    const groupedChartLabels = useMemo(
        () =>
            groupedByDate.map(({ indices }) =>
                indices
                    .map(i => timelinePromos[i]?.nome ?? timelinePromos[i]?.id ?? "")
                    .filter(Boolean)
                    .join(" / "),
            ),
        [groupedByDate, timelinePromos],
    );

    const allScores = useMemo(
        () => repartoSeries.flatMap(s => s.data).filter((v): v is number => v !== null),
        [repartoSeries],
    );
    const averageScore = allScores.length
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

    const latestTimelinePromo = timelinePromos.length > 0
        ? timelinePromos[timelinePromos.length - 1]
        : null;
    const chartLabels = useMemo(
        () => timelinePromos.map(promo => promo.nome || promo.id),
        [timelinePromos],
    );
    const filteredPromozioniInCorso = useMemo(
        () => (promoQuery.data ?? []).filter(promo =>
            promoOverlapsRange(
                {
                    validaDal: String(promo.validita_dal ?? ""),
                    validaAl: String(promo.validita_al ?? ""),
                },
                dateFrom,
                dateTo,
            ),
        ),
        [dateFrom, dateTo, promoQuery.data],
    );
    const filteredPromoIds = useMemo(
        () => new Set(filteredPromozioniInCorso.map(promo => promo.id)),
        [filteredPromozioniInCorso],
    );
    const filteredVolantini = useMemo(() => {
        const kit = volantiniQuery.data?.kit ?? [];
        if (!isDateRangeActive || promoQuery.isLoading) return kit;
        return kit.filter(item => (item.id_promo ? filteredPromoIds.has(item.id_promo) : true));
    }, [filteredPromoIds, isDateRangeActive, promoQuery.isLoading, volantiniQuery.data]);

    const canaleAreaChartData = useMemo(() => {
        if (!activeCanaleArea) return { labels: groupedChartLabels, datasets: [] };
        return {
            labels: groupedChartLabels,
            datasets: activeCanaleArea.series.map((s, idx) => {
                const color = CANALE_AREA_COLORS[idx % CANALE_AREA_COLORS.length];
                const data = groupedByDate.map(({ indices }) => {
                    const scores = indices
                        .map(i => s.data[i])
                        .filter((v): v is number => v !== null);
                    return scores.length
                        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                        : null;
                });
                return {
                    label: s.reparto,
                    data,
                    borderColor: color,
                    backgroundColor: `${color}33`,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    spanGaps: true,
                    fill: true,
                };
            }),
        };
    }, [activeCanaleArea, groupedChartLabels, groupedByDate]);

    const activeCanaleAreaRows = useMemo(() => {
        if (!activeCanaleArea) return [];
        return timelinePromos.map((promo, index) => ({
            promo,
            scoreByReparto: new Map(
                activeCanaleArea.series.map(series => [series.reparto, series.data[index] ?? null]),
            ),
        }));
    }, [activeCanaleArea, timelinePromos]);
    const activeCanaleAreaRowsAsc = useMemo(() => {
        const sortedRows = [...activeCanaleAreaRows].sort((a, b) =>
            comparePromoByValidaDalAsc(a.promo, b.promo),
        );

        const isSortedAsc = sortedRows.every((row, index, rows) => {
            if (index === 0) return true;
            return comparePromoByValidaDalAsc(rows[index - 1].promo, row.promo) <= 0;
        });

        if (!isSortedAsc) {
            return [...sortedRows].sort((a, b) => comparePromoByValidaDalAsc(a.promo, b.promo));
        }

        return sortedRows;
    }, [activeCanaleAreaRows]);

    const chartOptions = useMemo<ChartOptions<"line">>(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",
                    boxWidth: 8,
                    padding: 14,
                    color: "#64748b",
                    font: { size: 11 },
                },
            },
            tooltip: {
                backgroundColor: "#0f172a",
                titleColor: "#f8fafc",
                bodyColor: "#e2e8f0",
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                    label(context: TooltipItem<"line">) {
                        const v = typeof context.parsed.y === "number" ? Math.round(context.parsed.y) : 0;
                        return `${context.dataset.label}: ${v}/100`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { color: "rgba(148,163,184,0.08)" },
                ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 35 },
            },
            y: {
                min: 0,
                max: 100,
                grid: { color: "rgba(148,163,184,0.15)" },
                ticks: {
                    stepSize: 20,
                    color: "#94a3b8",
                    font: { size: 11 },
                    callback: (v: number | string) => `${v}`,
                },
            },
        },
    }), []);
    const canaleAreaChartOptions = useMemo<ChartOptions<"line">>(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",
                    boxWidth: 8,
                    padding: 12,
                    color: "#64748b",
                    font: { size: 11 },
                },
            },
            tooltip: {
                backgroundColor: "#0f172a",
                titleColor: "#f8fafc",
                bodyColor: "#e2e8f0",
                cornerRadius: 8,
                padding: 10,
                callbacks: {
                    label(context: TooltipItem<"line">) {
                        const v = typeof context.parsed.y === "number" ? Math.round(context.parsed.y) : 0;
                        return `${context.dataset.label}: ${v}/100`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { color: "rgba(148,163,184,0.08)" },
                ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 35 },
            },
            y: {
                min: 0,
                max: 100,
                grid: { color: "rgba(148,163,184,0.15)" },
                ticks: {
                    stepSize: 20,
                    color: "#94a3b8",
                    font: { size: 11 },
                    callback: (v: number | string) => `${v}`,
                },
            },
        },
    }), []);
    if (filtersQuery.isLoading || categoryTimelineQuery.isLoading) {
        return (
            <>
                <PageHeader title="Dashboard Category" description="Caricamento in corso..." />
                <CategorySkeleton />
            </>
        );
    }

    if (filtersQuery.isError || categoryTimelineQuery.isError || !filters) {
        return (
            <>
                <PageHeader title="Dashboard Category" description="" />
                <div className="box box--stacked p-8">
                    <EmptyState
                        icon="CircleAlert"
                        iconColor="text-danger"
                        title="Dati non disponibili"
                        description="Impossibile caricare i filtri utente."
                        buttonText="Riprova"
                        onButtonClick={() => {
                            filtersQuery.refetch();
                            categoryTimelineQuery.refetch();
                        }}
                    />
                </div>
            </>
        );
    }

    if (!settoriNomi.length) {
        return (
            <>
                <PageHeader title="Dashboard Category" description="" />
                <div className="box box--stacked p-8">
                    <EmptyState
                        icon="ShieldOff"
                        title="Nessun reparto assegnato"
                        description="Il profilo non ha reparti configurati. Contatta l'amministratore."
                    />
                </div>
            </>
        );
    }

    const scoreColor = getScoreColor(averageScore);

    return (
        <>
            <PageHeader
                title="Dashboard Category"
                description="Andamento scoreboard per i reparti assegnati"
                actions={
                    <Button
                        type="button"
                        variant="outline-primary"
                        onClick={() => {
                            categoryTimelineQuery.refetch();
                            volantiniQuery.refetch();
                            promoQuery.refetch();
                        }}
                        disabled={categoryTimelineQuery.isFetching}
                    >
                        <Lucide icon="RefreshCw" className={clsx("mr-2 h-4 w-4", categoryTimelineQuery.isFetching && "animate-spin")} />
                        Aggiorna
                    </Button>
                }
            />

            {/* Banner reparti assegnati */}
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-theme-1/20 bg-theme-1/5 px-4 py-3">
                {filters.ruolo && (
                    <span className="rounded-full bg-theme-1 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                        {filters.ruolo}
                    </span>
                )}
                {settoriNomi.map(nome => (
                    <span key={nome} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {nome}
                    </span>
                ))}
                <span className="ml-auto text-xs text-slate-400">
                    {settoriNomi.length === 1 ? "1 reparto assegnato" : `${settoriNomi.length} reparti assegnati`}
                </span>
            </div>

            <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex min-w-[180px] flex-col gap-1">
                        <label htmlFor="category-date-from" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Da</label>
                        <FormInput
                            id="category-date-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => handleDateFromChange(e.target.value)}
                        />
                    </div>
                    <div className="flex min-w-[180px] flex-col gap-1">
                        <label htmlFor="category-date-to" className="text-xs font-semibold uppercase tracking-wide text-slate-500">A</label>
                        <FormInput
                            id="category-date-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => handleDateToChange(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline-secondary" onClick={() => applyPresetDays(7)}>7g</Button>
                        <Button type="button" variant="outline-secondary" onClick={() => applyPresetDays(30)}>30g</Button>
                        <Button type="button" variant="outline-secondary" onClick={() => applyPresetDays(90)}>90g</Button>
                        <Button type="button" variant="outline-secondary" onClick={clearDateRange} disabled={!isDateRangeActive}>
                            Reset
                        </Button>
                    </div>
                    <div className="ml-auto text-xs text-slate-500">
                        {isDateRangeActive
                            ? `Filtro attivo: ${timelinePromos.length} promo nel periodo`
                            : "Nessun filtro data attivo"}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-5">
                {/* KPI */}
                <div className="col-span-12 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StatCard
                        label="Score medio reparti"
                        value={timelinePromos.length ? `${averageScore}/100` : "—"}
                        icon="Gauge"
                        tone={averageScore >= 70 ? "success" : averageScore >= 40 ? "warning" : "primary"}
                    />
                    <StatCard
                        label="Promozioni"
                        value={timelinePromos.length.toLocaleString("it-IT")}
                        icon="Megaphone"
                    />
                    <StatCard
                        label="Reparti monitorati"
                        value={settoriNomi.length.toLocaleString("it-IT")}
                        icon="Package"
                        tone="info"
                    />

                </div>

                {/* Volantini in corso */}
                <div className="col-span-12 lg:col-span-6">
                    <div className="box box--stacked h-full">
                        <div className="flex items-center gap-3 border-b border-slate-200/70 p-5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info/10">
                                <Lucide icon="FileText" className="h-4 w-4 text-info" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">Volantini in corso</h2>
                                <p className="text-xs text-slate-500">Pubblicazioni attive nel sistema</p>
                            </div>
                            {volantiniQuery.data != null && (
                                <span className="ml-auto rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-semibold text-info">
                                    {isDateRangeActive ? filteredVolantini.length : volantiniQuery.data.totale}
                                </span>
                            )}
                        </div>
                        <div className="p-5">
                            {volantiniQuery.isLoading ? (
                                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} height="36px" />)}</div>
                            ) : !filteredVolantini.length ? (
                                <p className="text-center text-sm text-slate-400">Nessun volantino in corso</p>
                            ) : (
                                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                                    {filteredVolantini.slice(0, 10).map(kit => (
                                        <div key={kit.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                            <Lucide icon="FileImage" className="h-4 w-4 shrink-0 text-slate-400" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-xs font-medium text-slate-700">{kit.titolo || kit.nome_promo}</div>
                                                <div className="text-xs text-slate-400">{[kit.nome_area, kit.nome_canale].filter(Boolean).join(" / ")}</div>
                                            </div>
                                            <span className={clsx(
                                                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                                                kit.stato_lavorazione === "completata" ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                                            )}>
                                                {kit.stato_lavorazione}
                                            </span>
                                        </div>
                                    ))}
                                    {filteredVolantini.length > 10 && (
                                        <p className="text-center text-xs text-slate-400">+{filteredVolantini.length - 10} altri</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Promozioni in corso */}
                <div className="col-span-12 lg:col-span-6">
                    <div className="box box--stacked h-full">
                        <div className="flex items-center gap-3 border-b border-slate-200/70 p-5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-theme-1/10">
                                <Lucide icon="Megaphone" className="h-4 w-4 text-theme-1" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-slate-800">Promozioni in corso</h2>
                                <p className="text-xs text-slate-500">Campagne attive non archiviate</p>
                            </div>
                            {promoQuery.data && (
                                <span className="ml-auto rounded-full bg-theme-1/10 px-2.5 py-0.5 text-xs font-semibold text-theme-1">
                                    {filteredPromozioniInCorso.length}
                                </span>
                            )}
                        </div>
                        <div className="p-5">
                            {promoQuery.isLoading ? (
                                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} height="36px" />)}</div>
                            ) : !filteredPromozioniInCorso.length ? (
                                <p className="text-center text-sm text-slate-400">Nessuna promozione in corso</p>
                            ) : (
                                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                                    {filteredPromozioniInCorso.slice(0, 10).map(promo => (
                                        <div key={promo.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                            <Lucide icon="CalendarRange" className="h-4 w-4 shrink-0 text-slate-400" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-xs font-medium text-slate-700">
                                                    {promo.nome || "—"}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {dayjs(promo.validita_dal).format("DD MMM YYYY")} — {dayjs(promo.validita_al).format("DD MMM YYYY")}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(filteredPromozioniInCorso.length ?? 0) > 10 && (
                                        <p className="text-center text-xs text-slate-400">+{(filteredPromozioniInCorso.length ?? 0) - 10} altre</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grafico andamento + tabella + dettaglio */}
                {timelinePromos.length === 0 ? (
                    <div className="box box--stacked col-span-12 p-8">
                        <EmptyState
                            icon="ChartLine"
                            title={isDateRangeActive ? "Nessun dato nel range selezionato" : "Nessun scoreboard disponibile"}
                            description={isDateRangeActive
                                ? "Modifica l'intervallo date per visualizzare dati disponibili."
                                : "Quando le promozioni avranno uno scoreboard calcolato per i tuoi reparti, il grafico apparirà qui."}
                        />
                    </div>
                ) : (
                    <>
                        {/* Canale/Area focus */}
                        {canaleAreaSeries.length > 0 && (
                            <div className="box box--stacked col-span-12">
                                <div className="border-b border-slate-200/70 p-5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info/10">
                                            <Lucide icon="Network" className="h-4 w-4 text-info" />
                                        </div>
                                        <div className="flex-1">
                                            <h2 className="text-base font-semibold text-slate-800">Focus per canale / area</h2>
                                            <p className="text-sm text-slate-500">Seleziona una coppia canale-area per vedere il trend dei tuoi reparti.</p>
                                        </div>
                                        {activeCanaleArea && (
                                            <span className={clsx("rounded-full px-3 py-1 text-sm font-bold", getScoreColor(activeCanaleArea.average).bg, getScoreColor(activeCanaleArea.average).text)}>
                                                Media {activeCanaleArea.average}/100
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {canaleAreaSeries.map(ca => (
                                            <button
                                                key={ca.key}
                                                type="button"
                                                onClick={() => setSelectedCanaleAreaKey(ca.key)}
                                                className={clsx(
                                                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                                    activeCanaleArea?.key === ca.key
                                                        ? "border-theme-1 bg-theme-1 text-white shadow-sm"
                                                        : "border-slate-300 bg-white text-slate-600 hover:border-theme-1/50 hover:text-theme-1",
                                                )}
                                            >
                                                {ca.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {activeCanaleArea && (
                                    <div className="p-5">
                                        <div className="min-w-[640px]">
                                            <Chart type="line" data={canaleAreaChartData as any} options={canaleAreaChartOptions as any} height={320} />
                                        </div>
                                        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold">Promozione</th>
                                                        <th className="px-4 py-3 font-semibold">Data</th>
                                                        {settoriNomi.map(n => (
                                                            <th key={`${activeCanaleArea.key}-${n}`} className="px-4 py-3 font-semibold">{n}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {activeCanaleAreaRowsAsc.map(({ promo, scoreByReparto }) => (
                                                        <tr key={`${activeCanaleArea.key}-${promo.id}`} className="bg-white hover:bg-slate-50/40">
                                                            <td className="px-4 py-3">
                                                                <div className="max-w-[240px] truncate font-medium text-slate-800">
                                                                    {promo.nome || promo.id}
                                                                </div>
                                                            </td>
                                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                                                                {promo.validaDal ? dayjs(promo.validaDal).format("DD MMM YYYY") : "—"}
                                                                {promo.validaAl ? ` — ${dayjs(promo.validaAl).format("DD MMM YYYY")}` : ""}
                                                            </td>
                                                            {settoriNomi.map(reparto => {
                                                                const raw = scoreByReparto.get(reparto);
                                                                const score = typeof raw === "number" ? clampScore(raw) : null;
                                                                const color = score !== null ? getScoreColor(score) : null;
                                                                return (
                                                                    <td key={`${promo.id}-${reparto}`} className="px-4 py-3">
                                                                        {score !== null && color ? (
                                                                            <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", color.bg, color.text)}>
                                                                                {score}/100
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-300">—</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Promo × Reparto table */}
                        <div className="box box--stacked col-span-12">
                            <div className="border-b border-slate-200/70 p-5">
                                <h2 className="text-base font-semibold text-slate-800">Score per promo per reparto</h2>
                                <p className="mt-1 text-sm text-slate-500">Ogni riga è una promozione; le colonne mostrano lo score per ciascun reparto assegnato.</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                                        <tr>
                                            <th className="px-5 py-3 font-semibold">Promozione</th>
                                            <th className="px-5 py-3 font-semibold">Data</th>
                                            {settoriNomi.map(n => (
                                                <th key={n} className="px-4 py-3 font-semibold">{n}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {[...timelineRows].reverse().map(({ promo, scoreByReparto }) => {
                                            return (
                                                <tr key={promo.id} className="bg-white hover:bg-slate-50/50">
                                                    <td className="px-5 py-3">
                                                        <div className="max-w-[220px] truncate font-medium text-slate-800">
                                                            {promo.nome || promo.id}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-400">
                                                        {promo.validaDal ? dayjs(promo.validaDal).format("DD MMM YYYY") : "—"}
                                                        {promo.validaAl ? ` — ${dayjs(promo.validaAl).format("DD MMM YYYY")}` : ""}
                                                    </td>
                                                    {settoriNomi.map(nome => {
                                                        const raw = scoreByReparto.get(nome);
                                                        const s = typeof raw === "number" ? clampScore(raw) : null;
                                                        const c = s !== null ? getScoreColor(s) : null;
                                                        return (
                                                            <td key={nome} className="px-4 py-3">
                                                                {s !== null && c ? (
                                                                    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", c.bg, c.text)}>
                                                                        {s}/100
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-slate-50 font-semibold">
                                            <td className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500" colSpan={2}>Media totale</td>
                                            {repartoSeries.map(s => {
                                                const c = getScoreColor(s.average);
                                                return (
                                                    <td key={s.reparto} className="px-4 py-3">
                                                        <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", c.bg, c.text)}>
                                                            {s.average}/100
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </>
                )}
            </div>
        </>
    );
};

export default DashboardCategory;
