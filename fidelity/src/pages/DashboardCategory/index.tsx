import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import Chart from "@/components/Base/Chart";
import { FormInput, FormLabel } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { opzioniBase, paletteColore, tonoScore } from "@/utils/chartTheme";
import { formatData, formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import type { ChartOptions, TooltipItem } from "chart.js";
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

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Score 0-100 nel colore della sua fascia (positivo, attenzione, negativo). */
const PunteggioScore: React.FC<{ score: number | null }> = ({ score }) =>
    score === null ? (
        <span className="text-slate-400">{VALORE_ASSENTE}</span>
    ) : (
        <StatusBadge tono={tonoScore(score)} etichetta={`${score}/100`} className="tabular-nums" />
    );

const PERIODI_RAPIDI = [7, 30, 90] as const;

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

const ETICHETTE_KPI = ["Score medio reparti", "Promozioni", "Reparti monitorati"];

const CategorySkeleton: React.FC = () => (
    <>
        <StatCardGrid className="lg:grid-cols-3">
            {ETICHETTE_KPI.map(etichetta => (
                <StatCard key={etichetta} etichetta={etichetta} valore={null} densita="compatta" loading />
            ))}
        </StatCardGrid>
        <div className="grid grid-cols-12 gap-6">
            <Sezione as="div" className="col-span-12 xl:col-span-6"><Skeleton className="h-52" /></Sezione>
            <Sezione as="div" className="col-span-12 xl:col-span-6"><Skeleton className="h-52" /></Sezione>
            <Sezione as="div" className="col-span-12"><Skeleton className="h-96" /></Sezione>
        </div>
    </>
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

    // Periodo rapido che corrisponde all'intervallo scelto (0 se l'intervallo è personalizzato)
    const periodoRapido = useMemo<number>(() => {
        if (dateTo !== dayjs().format("YYYY-MM-DD")) return 0;
        return PERIODI_RAPIDI.find(
            giorni => dayjs().subtract(giorni - 1, "day").format("YYYY-MM-DD") === dateFrom,
        ) ?? 0;
    }, [dateFrom, dateTo]);

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
                const color = paletteColore(idx);
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
                    backgroundColor: paletteColore(idx, 0.2),
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

    const canaleAreaChartOptions = useMemo<ChartOptions<"line">>(() => opzioniBase("line", {
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",
                    boxWidth: 8,
                    padding: 12,
                },
            },
            tooltip: {
                callbacks: {
                    label(context: TooltipItem<"line">) {
                        const v = typeof context.parsed.y === "number" ? Math.round(context.parsed.y) : 0;
                        return `${context.dataset.label}: ${v}/100`;
                    },
                },
            },
        },
        scales: {
            x: { ticks: { maxRotation: 35 } },
            y: {
                min: 0,
                max: 100,
                ticks: {
                    stepSize: 20,
                    callback: (v: number | string) => `${v}`,
                },
            },
        },
    }), []);
    const titolo = "Dashboard Category";
    const descrizione = "Andamento scoreboard per i reparti assegnati";

    if (filtersQuery.isLoading || categoryTimelineQuery.isLoading) {
        return (
            <Pagina titolo={titolo} descrizione={descrizione}>
                <CategorySkeleton />
            </Pagina>
        );
    }

    if (filtersQuery.isError || categoryTimelineQuery.isError || !filters) {
        return (
            <Pagina titolo={titolo} descrizione={descrizione}>
                <PageError
                    motivo={filtersQuery.isError || !filters
                        ? "Impossibile caricare i filtri utente."
                        : "Impossibile caricare l'andamento dei reparti."}
                    onRiprova={() => {
                        filtersQuery.refetch();
                        categoryTimelineQuery.refetch();
                    }}
                />
            </Pagina>
        );
    }

    if (!settoriNomi.length) {
        return (
            <Pagina titolo={titolo} descrizione={descrizione}>
                <Sezione>
                    <EmptyState
                        compatta
                        icon="ShieldOff"
                        title="Nessun reparto assegnato"
                        description="Il profilo non ha reparti configurati. Contatta l'amministratore."
                    />
                </Sezione>
            </Pagina>
        );
    }

    return (
        <Pagina
            titolo={titolo}
            descrizione={descrizione}
            azioni={
                <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => {
                        categoryTimelineQuery.refetch();
                        volantiniQuery.refetch();
                        promoQuery.refetch();
                    }}
                    loading={categoryTimelineQuery.isFetching}
                >
                    {!categoryTimelineQuery.isFetching && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-2 h-4 w-4" />}
                    Aggiorna
                </Button>
            }
        >
            {/* Periodo e reparti assegnati: valgono per tutta la pagina */}
            <Sezione compatta aria-label="Periodo e reparti">
                <BarraFiltri
                    variante="libera"
                    destra={
                        <span className="text-xs text-slate-500" aria-live="polite">
                            {isDateRangeActive
                                ? `Filtro attivo: ${formatNumero(timelinePromos.length)} promo nel periodo`
                                : "Nessun filtro data attivo"}
                        </span>
                    }
                >
                    <div className="flex items-center gap-2">
                        <FormLabel htmlFor="category-date-from" className="mb-0 text-sm">Da</FormLabel>
                        <FormInput
                            id="category-date-from"
                            type="date"
                            formInputSize="sm"
                            className="sm:w-40"
                            value={dateFrom}
                            onChange={(e) => handleDateFromChange(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <FormLabel htmlFor="category-date-to" className="mb-0 text-sm">A</FormLabel>
                        <FormInput
                            id="category-date-to"
                            type="date"
                            formInputSize="sm"
                            className="sm:w-40"
                            value={dateTo}
                            onChange={(e) => handleDateToChange(e.target.value)}
                        />
                    </div>
                    <Segmenti
                        etichetta="Periodo rapido"
                        valore={periodoRapido}
                        onChange={applyPresetDays}
                        opzioni={PERIODI_RAPIDI.map(giorni => ({ valore: giorni, etichetta: `${giorni} giorni` }))}
                    />
                    <Button type="button" variant="outline-secondary" size="sm" onClick={clearDateRange} disabled={!isDateRangeActive}>
                        <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Azzera
                    </Button>
                </BarraFiltri>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-4">
                    {filters.ruolo && <Badge variant="primary" size="sm">{filters.ruolo}</Badge>}
                    {settoriNomi.map(nome => (
                        <Badge key={nome} variant="secondary" size="sm">{nome}</Badge>
                    ))}
                    <span className="ml-auto text-xs text-slate-500">
                        {settoriNomi.length === 1 ? "1 reparto assegnato" : `${formatNumero(settoriNomi.length)} reparti assegnati`}
                    </span>
                </div>
            </Sezione>

            {/* KPI */}
            <StatCardGrid className="lg:grid-cols-3">
                <StatCard
                    densita="compatta"
                    etichetta="Score medio reparti"
                    valore={timelinePromos.length ? `${averageScore}/100` : null}
                    icona="Gauge"
                    tono={averageScore >= 70 ? "success" : averageScore >= 40 ? "warning" : "brand"}
                />
                <StatCard
                    densita="compatta"
                    etichetta="Promozioni"
                    valore={formatNumero(timelinePromos.length)}
                    icona="Megaphone"
                />
                <StatCard
                    densita="compatta"
                    etichetta="Reparti monitorati"
                    valore={formatNumero(settoriNomi.length)}
                    icona="Package"
                    tono="info"
                />
            </StatCardGrid>

            <div className="grid grid-cols-12 gap-6">
                {/* Volantini in corso */}
                <Sezione
                    className="col-span-12 xl:col-span-6"
                    icona="FileText"
                    titolo="Volantini in corso"
                    descrizione="Pubblicazioni attive nel sistema"
                    azioni={volantiniQuery.data != null && (
                        <Badge variant="info" size="sm" className="tabular-nums">
                            {formatNumero(isDateRangeActive ? filteredVolantini.length : volantiniQuery.data.totale)}
                        </Badge>
                    )}
                >
                    {volantiniQuery.isLoading ? (
                        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-9" />)}</div>
                    ) : volantiniQuery.isError ? (
                        <PageError
                            compatta
                            titolo="Volantini non caricati"
                            motivo="Il servizio non ha restituito i volantini in corso."
                            onRiprova={() => volantiniQuery.refetch()}
                        />
                    ) : !filteredVolantini.length ? (
                        <EmptyState
                            compatta
                            icon="FileText"
                            title={isDateRangeActive ? "Nessun volantino nel periodo" : "Nessun volantino in corso"}
                            description={isDateRangeActive ? "Modifica l'intervallo date per vedere altri volantini." : ""}
                        />
                    ) : (
                        <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                            {filteredVolantini.slice(0, 10).map(kit => (
                                <li key={kit.id} className="flex items-center gap-3 rounded-control border border-slate-100 bg-slate-50 px-3 py-2">
                                    <Lucide icon="FileImage" aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-medium text-slate-700">{kit.titolo || kit.nome_promo}</div>
                                        <div className="text-xs text-slate-500">{[kit.nome_area, kit.nome_canale].filter(Boolean).join(" / ")}</div>
                                    </div>
                                    <StatusBadge dominio="kitRuntime" stato={kit.stato_lavorazione} className="shrink-0" />
                                </li>
                            ))}
                            {filteredVolantini.length > 10 && (
                                <li className="text-center text-xs text-slate-500">+{formatNumero(filteredVolantini.length - 10)} altri</li>
                            )}
                        </ul>
                    )}
                </Sezione>

                {/* Promozioni in corso */}
                <Sezione
                    className="col-span-12 xl:col-span-6"
                    icona="Megaphone"
                    titolo="Promozioni in corso"
                    descrizione="Campagne attive non archiviate"
                    azioni={promoQuery.data && (
                        <Badge variant="primary" size="sm" className="tabular-nums">
                            {formatNumero(filteredPromozioniInCorso.length)}
                        </Badge>
                    )}
                >
                    {promoQuery.isLoading ? (
                        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-9" />)}</div>
                    ) : promoQuery.isError ? (
                        <PageError
                            compatta
                            titolo="Promozioni non caricate"
                            motivo="Il servizio non ha restituito le promozioni in corso."
                            onRiprova={() => promoQuery.refetch()}
                        />
                    ) : !filteredPromozioniInCorso.length ? (
                        <EmptyState
                            compatta
                            icon="Megaphone"
                            title={isDateRangeActive ? "Nessuna promozione nel periodo" : "Nessuna promozione in corso"}
                            description={isDateRangeActive ? "Modifica l'intervallo date per vedere altre promozioni." : ""}
                        />
                    ) : (
                        <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                            {filteredPromozioniInCorso.slice(0, 10).map(promo => (
                                <li key={promo.id} className="flex items-center gap-3 rounded-control border border-slate-100 bg-slate-50 px-3 py-2">
                                    <Lucide icon="CalendarRange" aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-medium text-slate-700">
                                            {promo.nome || VALORE_ASSENTE}
                                        </div>
                                        <div className="text-xs tabular-nums text-slate-500">
                                            {formatData(promo.validita_dal)} — {formatData(promo.validita_al)}
                                        </div>
                                    </div>
                                </li>
                            ))}
                            {filteredPromozioniInCorso.length > 10 && (
                                <li className="text-center text-xs text-slate-500">+{formatNumero(filteredPromozioniInCorso.length - 10)} altre</li>
                            )}
                        </ul>
                    )}
                </Sezione>

                {/* Grafico andamento + tabella + dettaglio */}
                {timelinePromos.length === 0 ? (
                    <Sezione className="col-span-12" icona="ChartLine" titolo="Andamento dei reparti">
                        <EmptyState
                            compatta
                            icon="ChartLine"
                            title={isDateRangeActive ? "Nessun dato nel periodo selezionato" : "Nessuno scoreboard disponibile"}
                            description={isDateRangeActive
                                ? "Modifica l'intervallo date per visualizzare dati disponibili."
                                : "Quando le promozioni avranno uno scoreboard calcolato per i tuoi reparti, il grafico apparirà qui."}
                            buttonText={isDateRangeActive ? "Azzera periodo" : undefined}
                            buttonIcon="X"
                            onButtonClick={clearDateRange}
                        />
                    </Sezione>
                ) : (
                    <>
                        {/* Canale/Area focus */}
                        {canaleAreaSeries.length > 0 && (
                            <Sezione
                                className="col-span-12"
                                icona="Network"
                                titolo="Focus per canale / area"
                                descrizione="Seleziona una coppia canale-area per vedere il trend dei tuoi reparti."
                                azioni={activeCanaleArea && (
                                    <span className="flex items-center gap-2 text-sm text-slate-500">
                                        Media <PunteggioScore score={activeCanaleArea.average} />
                                    </span>
                                )}
                            >
                                <Segmenti
                                    etichetta="Canale e area"
                                    valore={activeCanaleArea?.key ?? ""}
                                    onChange={setSelectedCanaleAreaKey}
                                    opzioni={canaleAreaSeries.map(ca => ({ valore: ca.key, etichetta: ca.label }))}
                                />
                                {activeCanaleArea && (
                                    <div className="mt-5 overflow-x-auto">
                                        <div className="min-w-[640px]">
                                            <Chart type="line" data={canaleAreaChartData as any} options={canaleAreaChartOptions as any} height={320} />
                                        </div>
                                        <div className="mt-5 overflow-x-auto rounded-card border border-slate-200">
                                            <Table>
                                                <Table.Thead>
                                                    <Table.Tr>
                                                        <Table.Th>Promozione</Table.Th>
                                                        <Table.Th>Data</Table.Th>
                                                        {settoriNomi.map(n => (
                                                            <Table.Th key={`${activeCanaleArea.key}-${n}`}>{n}</Table.Th>
                                                        ))}
                                                    </Table.Tr>
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    {activeCanaleAreaRowsAsc.map(({ promo, scoreByReparto }) => (
                                                        <Table.Tr key={`${activeCanaleArea.key}-${promo.id}`}>
                                                            <Table.Td>
                                                                <div className="max-w-60 truncate font-medium text-slate-800">
                                                                    {promo.nome || promo.id}
                                                                </div>
                                                            </Table.Td>
                                                            <Table.Td className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                                                                {formatData(promo.validaDal)}
                                                                {promo.validaAl ? ` — ${formatData(promo.validaAl)}` : ""}
                                                            </Table.Td>
                                                            {settoriNomi.map(reparto => {
                                                                const raw = scoreByReparto.get(reparto);
                                                                return (
                                                                    <Table.Td key={`${promo.id}-${reparto}`}>
                                                                        <PunteggioScore score={typeof raw === "number" ? clampScore(raw) : null} />
                                                                    </Table.Td>
                                                                );
                                                            })}
                                                        </Table.Tr>
                                                    ))}
                                                </Table.Tbody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </Sezione>
                        )}

                        {/* Promo × Reparto table */}
                        <Sezione
                            className="col-span-12"
                            senzaPadding
                            icona="Table"
                            titolo="Score per promo per reparto"
                            descrizione="Ogni riga è una promozione; le colonne mostrano lo score per ciascun reparto assegnato."
                        >
                            <div className="overflow-x-auto">
                                <Table>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Promozione</Table.Th>
                                            <Table.Th>Data</Table.Th>
                                            {settoriNomi.map(n => (
                                                <Table.Th key={n}>{n}</Table.Th>
                                            ))}
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {[...timelineRows].reverse().map(({ promo, scoreByReparto }) => (
                                            <Table.Tr key={promo.id}>
                                                <Table.Td>
                                                    <div className="max-w-56 truncate font-medium text-slate-800">
                                                        {promo.nome || promo.id}
                                                    </div>
                                                </Table.Td>
                                                <Table.Td className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                                                    {formatData(promo.validaDal)}
                                                    {promo.validaAl ? ` — ${formatData(promo.validaAl)}` : ""}
                                                </Table.Td>
                                                {settoriNomi.map(nome => {
                                                    const raw = scoreByReparto.get(nome);
                                                    return (
                                                        <Table.Td key={nome}>
                                                            <PunteggioScore score={typeof raw === "number" ? clampScore(raw) : null} />
                                                        </Table.Td>
                                                    );
                                                })}
                                            </Table.Tr>
                                        ))}
                                        <Table.Tr className="[&_td]:bg-slate-50">
                                            <Table.Td colSpan={2}>
                                                <span className="title-eyebrow">Media totale</span>
                                            </Table.Td>
                                            {repartoSeries.map(s => (
                                                <Table.Td key={s.reparto}>
                                                    <PunteggioScore score={s.average} />
                                                </Table.Td>
                                            ))}
                                        </Table.Tr>
                                    </Table.Tbody>
                                </Table>
                            </div>
                        </Sezione>
                    </>
                )}
            </div>
        </Pagina>
    );
};

export default DashboardCategory;
