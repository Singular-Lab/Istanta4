import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { COLORI_ASSI, coloreScore, opzioniAssi, opzioniBase, paletteColore, tonoScore } from "@/utils/chartTheme";
import { formatData, formatNumero, VALORE_ASSENTE } from "@/utils/format";
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

const DIST_BUCKET_LABELS = ["0–20", "21–40", "41–60", "61–80", "81–100"];

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

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

const ETICHETTE_KPI = ["Promozioni", "Score medio", "Trend positivi", "Trend negativi"];

const MarketingSkeleton: React.FC = () => (
    <>
        <StatCardGrid>
            {ETICHETTE_KPI.map((etichetta) => (
                <StatCard key={etichetta} etichetta={etichetta} valore={null} densita="compatta" loading />
            ))}
        </StatCardGrid>
        <Sezione as="div">
            <Skeleton className="mb-5 h-5 w-56" />
            <Skeleton className="h-96" />
        </Sezione>
    </>
);

const PerformerCard: React.FC<{
    series: AreaCanaleSeries;
    rank: number;
    variant: "top" | "bottom";
}> = ({ series, rank, variant }) => (
    <li className={clsx(
        "flex items-center gap-3 rounded-card border p-3",
        variant === "top" ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5",
    )}>
        <div className={clsx(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
            variant === "top" ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
        )}>
            #{rank}
        </div>
        <div className="min-w-0 flex-1">
            <h3 className="title-card truncate">{series.label}</h3>
            <div className="text-xs text-slate-500">{series.nomeArea} · {series.nomeCanale}</div>
        </div>
        <div className="text-right">
            <div className={clsx("text-lg font-extrabold tabular-nums", scoreColorCls(series.average))}>{series.average}</div>
            <div className="text-xs text-slate-500">media</div>
        </div>
    </li>
);

// Intestazione di colonna che ordina la tabella; la freccia compare solo sulla colonna attiva
const IntestazioneOrdinabile: React.FC<{
    colonna: SortKey;
    attiva: SortKey;
    direzione: SortDir;
    onOrdina: (colonna: SortKey) => void;
    children: React.ReactNode;
}> = ({ colonna, attiva, direzione, onOrdina, children }) => {
    const selezionata = colonna === attiva;
    return (
        <Table.Th
            aria-sort={selezionata ? (direzione === "asc" ? "ascending" : "descending") : undefined}
            className={selezionata ? "text-slate-700" : undefined}
        >
            <button
                type="button"
                onClick={() => onOrdina(colonna)}
                className="inline-flex items-center gap-1 uppercase hover:text-slate-700"
            >
                {children}
                {selezionata && (
                    <Lucide
                        icon={direzione === "asc" ? "ChevronUp" : "ChevronDown"}
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                    />
                )}
            </button>
        </Table.Th>
    );
};

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
            backgroundColor: snapshotSeries.map((s) => coloreScore(s.latestScore ?? 0)),
            borderRadius: 4,
            borderSkipped: false,
        }],
    }), [snapshotSeries]);
    const snapshotOptions = useMemo<ChartOptions<"bar">>(() => opzioniBase("bar", {
        indexAxis: "y" as const,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (ctx: TooltipItem<"bar">) => ` ${Math.round(ctx.parsed.x as number)}/100` },
            },
        },
        scales: {
            x: { min: 0, max: 100 },
            y: { grid: { display: false }, ticks: { color: COLORI_ASSI.tickForte } },
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
            // Ogni fascia ha il colore del suo score minimo
            backgroundColor: DIST_BUCKET_LABELS.map((_, i) => coloreScore(i * 20)),
            borderRadius: 4,
            borderSkipped: false,
        }],
    }), [distBuckets]);
    const distOptions = useMemo<ChartOptions<"bar">>(() => opzioniBase("bar", {
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: TooltipItem<"bar">) => ` ${ctx.parsed.y} promo` } },
        },
        scales: opzioniAssi({ xGriglia: false, yMin: 0, stepSize: 1 }),
    }), []);

    const top3 = useMemo(() => [...series].sort((a, b) => b.average - a.average).slice(0, 3), [series]);
    const bottom3 = useMemo(() => [...series].sort((a, b) => a.average - b.average).slice(0, 3), [series]);

    const lineChartData = useMemo(() => ({
        labels,
        datasets: (activeCanaleArea?.series ?? []).map((s, i) => {
            const color = paletteColore(i);
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
    const lineOptions = useMemo<ChartOptions<"line">>(() => opzioniBase("line", {
        plugins: {
            legend: {
                position: "bottom",
                labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 16 },
            },
            tooltip: {
                callbacks: {
                    label: (ctx: TooltipItem<"line">) =>
                        `${ctx.dataset.label ?? ""}: ${typeof ctx.parsed.y === "number" ? Math.round(ctx.parsed.y) : 0}/100`,
                },
            },
        },
        scales: {
            x: { ticks: { maxRotation: 35 } },
            y: { min: 0, max: 100, ticks: { stepSize: 20 } },
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

    const isLoading = scoreboardsQuery.isLoading;
    const isError = scoreboardsQuery.isError;
    const isEmpty = scoreboards.length === 0 || series.length === 0;

    return (
        <Pagina
            titolo="Dashboard Marketing"
            descrizione="Analisi scoreboard promo con trend, distribuzione e confronto combinazioni area/canale"
            azioni={(
                <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => scoreboardsQuery.refetch()}
                    loading={scoreboardsQuery.isFetching}
                >
                    {!scoreboardsQuery.isFetching && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
                    Aggiorna
                </Button>
            )}
        >
            {isLoading ? (
                <MarketingSkeleton />
            ) : isError ? (
                <PageError
                    motivo="Impossibile caricare i dati marketing"
                    onRiprova={() => scoreboardsQuery.refetch()}
                />
            ) : isEmpty ? (
                <Sezione>
                    <EmptyState
                        compatta
                        icon="ChartBar"
                        title="Nessuno scoreboard calcolato"
                        description="Quando le promo avranno uno scoreboard salvato, il riepilogo marketing comparirà qui."
                    />
                </Sezione>
            ) : (
                <>
                    {/* A — Score Pulse */}
                    <StatCardGrid>
                        <StatCard
                            densita="compatta"
                            etichetta="Promozioni"
                            valore={formatNumero(scoreboards.length)}
                            icona="Megaphone"
                            sottotitolo={lastComputedAt ? `Ultimo: ${formatData(lastComputedAt.computedAt)}` : undefined}
                        />
                        <StatCard
                            densita="compatta"
                            etichetta="Score medio"
                            valore={`${averageScore}/100`}
                            icona="Gauge"
                            tono={tonoScore(averageScore)}
                            sottotitolo={`${formatNumero(series.length)} combinazioni area/canale`}
                        />
                        <StatCard
                            densita="compatta"
                            etichetta="Trend positivi"
                            valore={formatNumero(trendPositivi)}
                            icona="TrendingUp"
                            tono="success"
                            variazione={{ valore: "Ultima vs penultima promo", direzione: "su" }}
                        />
                        <StatCard
                            densita="compatta"
                            etichetta="Trend negativi"
                            valore={formatNumero(trendNegativi)}
                            icona="TrendingDown"
                            tono="danger"
                            variazione={{ valore: "Ultima vs penultima promo", direzione: "giu" }}
                        />
                    </StatCardGrid>

                    {/* B — Snapshot + Distribuzione */}
                    <div className="grid grid-cols-12 gap-6">
                        <Sezione
                            className="col-span-12 xl:col-span-8"
                            icona="ChartBar"
                            titolo="Snapshot ultimo score"
                            descrizione="Score più recente per ogni combinazione, ordinato decrescente"
                        >
                            <div style={{ height: snapshotChartHeight }}>
                                <Chart type="bar" data={snapshotChartData as any} options={snapshotOptions as any} height={snapshotChartHeight} />
                            </div>
                        </Sezione>
                        <Sezione
                            className="col-span-12 xl:col-span-4"
                            icona="ChartColumn"
                            titolo="Distribuzione score"
                            descrizione={`${formatNumero(allScoreValues.length)} punti score totali`}
                        >
                            <Chart type="bar" data={distChartData as any} options={distOptions as any} height={220} />
                        </Sezione>

                        {/* C — Top / Bottom performer */}
                        {series.length >= 2 && (
                            <>
                                <Sezione
                                    className="col-span-12 xl:col-span-6"
                                    icona="Trophy"
                                    titolo="Top performer"
                                    descrizione="Score medio più alto"
                                >
                                    <ol className="flex flex-col gap-2">
                                        {top3.map((s, i) => <PerformerCard key={s.key} series={s} rank={i + 1} variant="top" />)}
                                    </ol>
                                </Sezione>
                                <Sezione
                                    className="col-span-12 xl:col-span-6"
                                    icona="TriangleAlert"
                                    titolo="Da migliorare"
                                    descrizione="Score medio più basso"
                                >
                                    <ol className="flex flex-col gap-2">
                                        {bottom3.map((s, i) => <PerformerCard key={s.key} series={s} rank={i + 1} variant="bottom" />)}
                                    </ol>
                                </Sezione>
                            </>
                        )}
                    </div>

                    {/* D — Andamento nel tempo */}
                    <Sezione
                        icona="ChartLine"
                        titolo="Andamento nel tempo"
                        descrizione="Trend reparti per coppia canale/area con mappatura CoopFi da AgenziaLib"
                        azioni={(
                            <Badge variant="secondary" size="sm" className="tabular-nums">
                                {formatNumero(activeCanaleArea?.series.length ?? 0)} reparti
                            </Badge>
                        )}
                    >
                        {canaleAreaRepartoSeries.length === 0 ? (
                            <EmptyState
                                compatta
                                icon="Network"
                                title="Nessun dettaglio canale/area disponibile"
                                description="I trend per reparto appariranno qui appena presenti nei report scoreboard."
                            />
                        ) : (
                            <>
                                <Segmenti
                                    etichetta="Canale e area"
                                    valore={activeCanaleArea?.key ?? ""}
                                    onChange={setSelectedCanaleAreaKey}
                                    opzioni={canaleAreaRepartoSeries.map((view) => ({ valore: view.key, etichetta: view.label }))}
                                />
                                {activeCanaleArea && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {activeCanaleArea.series.map((serie) => (
                                            <Badge key={`${activeCanaleArea.key}-${serie.reparto}`} variant="secondary" size="sm">
                                                {serie.reparto}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-5 overflow-x-auto">
                                    <div className="min-w-[760px]">
                                        <Chart type="line" data={lineChartData as any} options={lineOptions as any} height={420} />
                                    </div>
                                </div>
                            </>
                        )}
                    </Sezione>

                    {/* E — Tabella dettaglio con trend */}
                    <Sezione
                        senzaPadding
                        icona="Table"
                        titolo="Dettaglio combinazioni"
                        descrizione="Clic sull'intestazione per ordinare · Δ trend = variazione rispetto alla penultima promo disponibile"
                    >
                        <div className="overflow-x-auto">
                            <Table>
                                <Table.Thead>
                                    <Table.Tr>
                                        <IntestazioneOrdinabile colonna="label" attiva={sortKey} direzione={sortDir} onOrdina={handleSort}>
                                            Area / Canale
                                        </IntestazioneOrdinabile>
                                        <IntestazioneOrdinabile colonna="average" attiva={sortKey} direzione={sortDir} onOrdina={handleSort}>
                                            Score medio
                                        </IntestazioneOrdinabile>
                                        <IntestazioneOrdinabile colonna="latestScore" attiva={sortKey} direzione={sortDir} onOrdina={handleSort}>
                                            Ultimo score
                                        </IntestazioneOrdinabile>
                                        <IntestazioneOrdinabile colonna="trend" attiva={sortKey} direzione={sortDir} onOrdina={handleSort}>
                                            Δ Trend
                                        </IntestazioneOrdinabile>
                                        <Table.Th>Promo con dato</Table.Th>
                                        <Table.Th className="text-right">Referenze</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {sortedSeries.map((s) => {
                                        const trendLabel = s.trend === null ? VALORE_ASSENTE
                                            : s.trend > 0 ? `↑ +${s.trend}`
                                                : s.trend < 0 ? `↓ ${s.trend}`
                                                    : "→ 0";
                                        const trendCls = s.trend === null || s.trend === 0
                                            ? "text-slate-400"
                                            : s.trend > 0 ? "text-success font-medium" : "text-danger font-medium";
                                        return (
                                            <Table.Tr key={s.key}>
                                                <Table.Td>
                                                    <div className="font-semibold text-slate-800">{s.label}</div>
                                                    <div className="mt-0.5 text-xs text-slate-500">{s.nomeArea} / {s.nomeCanale}</div>
                                                </Table.Td>
                                                <Table.Td className="tabular-nums">
                                                    <span className={scoreColorCls(s.average)}>{s.average}/100</span>
                                                </Table.Td>
                                                <Table.Td className="tabular-nums">
                                                    <div className={s.latestScore !== null ? scoreColorCls(s.latestScore) : "text-slate-400"}>
                                                        {s.latestScore === null ? VALORE_ASSENTE : `${s.latestScore}/100`}
                                                    </div>
                                                    {s.latestPromo && (
                                                        <div className="mt-0.5 max-w-56 truncate text-xs text-slate-500">{s.latestPromo}</div>
                                                    )}
                                                </Table.Td>
                                                <Table.Td className={clsx("tabular-nums", trendCls)}>{trendLabel}</Table.Td>
                                                <Table.Td className="tabular-nums text-slate-600">{s.count} / {scoreboards.length}</Table.Td>
                                                <Table.Td className="text-right tabular-nums text-slate-600">{formatNumero(s.referenze)}</Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        </div>
                    </Sezione>
                </>
            )}
        </Pagina>
    );
};

export default DashboardMarketing;
