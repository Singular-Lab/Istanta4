import Button from "@/components/Base/Button";
import FormSelect from "@/components/Base/Form/FormSelect";
import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import axios from "axios";
import clsx from "clsx";
import dayjs from "dayjs";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import { AreaResponseDTO, CanaleResponseDTO } from "../../../server/core/dto";
import PageHeader from "../../components/Base/PageHeader";
import EmptyState from "../../components/EmptyState";
import { PERMISSIONS } from "../../constants/permissions";
import { usePermission } from "../../context/PermissionContext";

interface FileAnteprima {
    id: string;
    nome: string;
    nome_originale?: string;
    tipo_export?: string;
    id_olimpo_cloud?: string;
    thumbnailUrl?: string;
    mime?: string;
    pages?: number;
    url?: string;
}

interface KitVolantino {
    id: string;
    titolo: string;
    nome_area?: string;
    nome_canale?: string;
    stato_lavorazione: string;
    nome_promo: string;
    id_promo?: string;
    validita_dal?: string;
    validita_al?: string;
    files: FileAnteprima[];
}

interface VolantiniInCorso {
    totale: number;
    inScadenza: number;
    kit: KitVolantino[];
}

interface VolantiniInLavorazione {
    totale: number;
    inAttesa: number;
    kit: KitVolantino[];
}

interface VolantiniPubblicatiInLavorazione {
    totale: number;
    kit: KitVolantino[];
}

interface StoricoVolantini {
    totale: number;
    kit: KitVolantino[];
}

export interface Dashboard3LoaderData {
    volantiniInCorsoPromise: Promise<VolantiniInCorso>;
    volantiniInLavorazionePromise: Promise<VolantiniInLavorazione>;
    volantiniPubblicatiInLavorazionePromise: Promise<VolantiniPubblicatiInLavorazione>;
    areePromise: Promise<AreaResponseDTO[]>;
    canaliPromise: Promise<CanaleResponseDTO[]>;
}

interface Dashboard3Props {
    embedded?: boolean;
    loaderDataOverride?: Dashboard3LoaderData | null;
}

// Filtro per singola card (stringa singola per semplicità UI)
interface CardFilter {
    id_area: string;
    id_canale: string;
}

const BATCH_SIZE = 12;


interface StatCompactCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone?: "primary" | "warning" | "info" | "danger";
}

const StatCompactCard: FC<StatCompactCardProps> = ({
    label,
    value,
    icon,
    tone = "primary",
}) => {
    const tones: Record<string, string> = {
        primary: "border-theme-1/30 text-theme-1 bg-theme-1/5",
        warning: "border-warning/30 text-warning bg-warning/10",
        info: "border-info/30 text-info bg-info/10",
        danger: "border-danger/30 text-danger bg-danger/10",
    };

    return (
        <div
            className={clsx(
                "flex items-center gap-4 rounded-[0.6rem] border px-4 py-3 bg-white/80",
                tones[tone]
            )}
        >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-current/10">
                {icon}
            </div>

            <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium text-slate-500">
                    {label}
                </span>
                <span className="text-xl font-bold text-slate-800">
                    {value}
                </span>
            </div>
        </div>
    );
};


const useInfiniteKitScroll = (kits: KitVolantino[], batchSize: number = BATCH_SIZE) => {
    const [visibleCount, setVisibleCount] = useState(batchSize);
    const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        setVisibleCount(batchSize);
    }, [kits, batchSize]);

    useEffect(() => {
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisibleCount((prev) => {
                        if (prev >= kits.length) return prev;
                        return Math.min(prev + batchSize, kits.length);
                    });
                }
            },
            { threshold: 0.25, rootMargin: "200px 0px 0px" }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [sentinel, kits.length, batchSize]);

    const items = useMemo(() => kits.slice(0, visibleCount), [kits, visibleCount]);

    return {
        items,
        hasMore: visibleCount < kits.length,
        registerSentinel: setSentinel,
    };
};



const VolantiniSkeleton: FC = () => (
    <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
                <div key={i} className="p-4 rounded-[0.6rem] bg-theme-1/[0.06]">
                    <Skeleton height="12px" width="64px" className="mb-2" />
                    <Skeleton height="32px" className="mt-3" />
                </div>
            ))}
        </div>
        <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 rounded-[0.6rem] border border-dashed border-slate-200/70 bg-white/80 flex items-center gap-4">
                    <Skeleton height="80px" width="64px" />
                    <div className="flex-1 space-y-3">
                        <Skeleton height="12px" width="60%" />
                        <Skeleton height="12px" width="40%" />
                        <Skeleton height="12px" width="50%" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const KitCard: FC<{ kit: KitVolantino; showValidita?: boolean, routeClickable?: boolean }> = ({ kit, showValidita, routeClickable = false }) => {
    const canAccessPromo = usePermission(PERMISSIONS.PAGINA.PROMOZIONI_IN_CORSO);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const file = kit.files?.[0];
    const previewUrl = file?.url ?? file?.thumbnailUrl ?? "";
    const hasPreview = Boolean(previewUrl);
    const canDownload = Boolean(file?.id_olimpo_cloud);

    const handleDownload = useCallback(async () => {
        if (!file?.id_olimpo_cloud || isDownloading) return;
        setIsDownloading(true);
        try {
            const url = ServerCall.getUrl();
            const response = await axios.get(
                `${url}/getFileFromOlimpo?id=${file.id_olimpo_cloud}`,
                { responseType: "arraybuffer" }
            );
            const blob = new Blob([response.data], { type: "application/pdf" });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = file.nome || "volantino.pdf";
            link.click();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Errore durante il download del file:", error);
        } finally {
            setIsDownloading(false);
        }
    }, [file, isDownloading]);

    const BADGE_STYLES: Record<string, string> = {
        PUBBLICATO: "bg-success/10 text-success border-success/20",
        IN_LAVORAZIONE: "bg-info/10 text-info border-info/20",
        IN_LAVORAZIONE_CON_ERRORI: "bg-danger/10 text-danger border-danger/20",
        IN_REVISIONE: "bg-warning/10 text-warning border-warning/20",
    };

    const renderStatoBadge = (stato: string) => {
        const normalized = stato?.toUpperCase();
        const badgeClasses = BADGE_STYLES[normalized] ?? "bg-slate-100 text-slate-600 border-slate-200";
        return (
            <span className={clsx("px-2.5 py-0.5 text-[11px] font-semibold rounded-full border", badgeClasses)}>
                {normalized?.replace(/_/g, " ")}
            </span>
        );
    };

    return (
        <>
            <div className="relative p-4 rounded-[0.6rem] border border-dashed border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="flex gap-4">
                    <div className="relative shrink-0">
                        {hasPreview ? (
                            <button
                                type="button"
                                className="group/preview w-20 h-24 rounded-[0.6rem] overflow-hidden border border-theme-1/20 bg-slate-50 relative focus-visible:outline focus-visible:outline-theme-1/40"
                                onClick={() => setIsPreviewOpen(true)}
                            >
                                <img
                                    src={previewUrl}
                                    alt={kit.titolo}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                <span className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                                    <Lucide icon="Eye" className="w-4 h-4 mr-1" /> Anteprima
                                </span>
                            </button>
                        ) : (
                            <div className="w-20 h-24 rounded-[0.6rem] border border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                                <Lucide icon="FileText" className="w-5 h-5 text-slate-400" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                {routeClickable && canAccessPromo ? (
                                    <Link
                                        className="block text-sm font-semibold text-slate-800 truncate"
                                        to={kit.id_promo ? `/promozioni/in-corso/dettagli/${kit.id_promo}/kits/${kit.id}` : "#"}
                                    >
                                        {kit.titolo}
                                    </Link>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-800 truncate">{kit.titolo}</p>
                                )}
                                {canAccessPromo ? (
                                    <Link
                                        to={`/promozioni/in-corso/dettagli/${kit.id_promo}`}
                                        className="block text-xs text-theme-1 truncate hover:underline decoration-dotted decoration-theme-1/30"
                                    >
                                        Promo: {kit.nome_promo}
                                    </Link>
                                ) : (
                                    <p className="block text-xs text-slate-500 truncate">Promo: {kit.nome_promo}</p>
                                )}
                                {(kit.nome_area || kit.nome_canale) && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {kit.nome_area && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                <Lucide icon="MapPin" className="w-2.5 h-2.5" />
                                                {kit.nome_area}
                                            </span>
                                        )}
                                        {kit.nome_canale && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-theme-1/10 text-theme-1 border border-theme-1/20">
                                                <Lucide icon="Store" className="w-2.5 h-2.5" />
                                                {kit.nome_canale}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {renderStatoBadge(kit.stato_lavorazione)}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-500">
                            {showValidita && (kit.validita_dal || kit.validita_al) && (
                                <span className="inline-flex items-center gap-1 text-theme-1">
                                    <Lucide icon="Calendar" className="w-3 h-3" />
                                    {kit.validita_dal && kit.validita_al ? (
                                        <>
                                            {dayjs(kit.validita_dal).locale("it").format("D MMM")} - {dayjs(kit.validita_al).locale("it").format("D MMM YYYY")}
                                        </>
                                    ) : kit.validita_al ? (
                                        <>fino al {dayjs(kit.validita_al).locale("it").format("D MMM YYYY")}</>
                                    ) : kit.validita_dal ? (
                                        <>dal {dayjs(kit.validita_dal).locale("it").format("D MMM YYYY")}</>
                                    ) : null}
                                </span>
                            )}
                            {file?.mime && (
                                <span className="inline-flex items-center gap-1">
                                    <Lucide icon="File" className="w-3 h-3" />
                                    {file.mime}
                                </span>
                            )}
                            {file?.pages && file.pages > 0 && (
                                <span className="inline-flex items-center gap-1">
                                    <Lucide icon="Book" className="w-3 h-3" />
                                    {file.pages} pp
                                </span>
                            )}
                        </div>
                        <div className="flex items-center justify-end mt-4">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className={clsx(
                                        "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border",
                                        canDownload && !isDownloading
                                            ? "text-success border-success/30 bg-success/10 hover:bg-success/20"
                                            : "text-slate-400 border-slate-200 cursor-not-allowed"
                                    )}
                                    onClick={handleDownload}
                                    disabled={!canDownload || isDownloading}
                                >
                                    <Lucide icon={isDownloading ? "Loader" : "Download"} className={clsx("w-3.5 h-3.5", isDownloading && "animate-spin")} />
                                    {isDownloading ? "Download..." : "Scarica"}
                                </button>
                                <button
                                    type="button"
                                    className={clsx(
                                        "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border",
                                        hasPreview
                                            ? "text-theme-1 border-theme-1/30 bg-theme-1/10 hover:bg-theme-1/20"
                                            : "text-slate-400 border-slate-200 cursor-not-allowed"
                                    )}
                                    onClick={() => hasPreview && setIsPreviewOpen(true)}
                                    disabled={!hasPreview}
                                >
                                    <Lucide icon="Focus" className="w-3.5 h-3.5" />
                                    Anteprima
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isPreviewOpen && hasPreview && (
                <PreviewImmaginePdf
                    imageUrl={previewUrl}
                    totalPages={file?.pages ?? 1}
                    onClose={() => setIsPreviewOpen(false)}
                />
            )}
        </>
    );
};

interface VolantiniInCorsoContentProps {
    data: VolantiniInCorso;
    isLoading: boolean;
    aree: AreaResponseDTO[];
    canali: CanaleResponseDTO[];
    filter: CardFilter;
    onFilterChange: (filter: CardFilter) => void;
}

const VolantiniInCorsoContent: FC<VolantiniInCorsoContentProps> = ({
    data,
    isLoading,
    aree,
    canali,
    filter: cardFilter,
    onFilterChange
}) => {
    const [quickFilter, setQuickFilter] = useState<"all" | "expiring">("all");

    const filteredKits = useMemo<KitVolantino[]>(() => {
        if (quickFilter === "expiring") {
            return data.kit.filter((kit: KitVolantino) => kit.validita_al && dayjs(kit.validita_al).diff(dayjs(), "day") <= 7);
        }
        return data.kit;
    }, [data.kit, quickFilter]);

    const { items, hasMore, registerSentinel } = useInfiniteKitScroll(filteredKits);

    return (
        <div className={clsx("flex flex-col gap-5 h-full transition-opacity duration-150", isLoading && "opacity-50 pointer-events-none")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={cardFilter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="in-corso"
            />

            <div className="flex flex-wrap items-center gap-3 p-3 rounded-[0.6rem] border border-dashed border-slate-200/80 bg-white/80">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Filtri rapidi</p>
                    <p className="text-sm font-semibold text-slate-700">{quickFilter === "all" ? "Tutti i volantini" : "Solo in scadenza"}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        className={clsx(
                            "px-4 py-2 rounded-[0.6rem] text-xs font-semibold border transition",
                            quickFilter === "all"
                                ? "bg-theme-1/10 text-theme-1 border-theme-1/30 shadow-sm"
                                : "text-slate-500 border-transparent hover:border-slate-200"
                        )}
                        onClick={() => setQuickFilter("all")}
                    >
                        Tutti
                    </button>
                    <button
                        type="button"
                        className={clsx(
                            "px-4 py-2 rounded-[0.6rem] text-xs font-semibold border transition",
                            quickFilter === "expiring"
                                ? "bg-warning/20 text-warning border-warning/30 shadow-sm"
                                : "text-slate-500 border-transparent hover:border-slate-200"
                        )}
                        onClick={() => setQuickFilter("expiring")}
                    >
                        In scadenza
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-[18rem]">
                {filteredKits.length > 0 ? (
                    <div className="space-y-3 pr-1 overflow-y-auto max-h-[32rem] pb-1">
                        {items.map((kit) => (
                            <KitCard key={kit.id} kit={kit} showValidita routeClickable />
                        ))}
                        <div ref={registerSentinel} />
                        {hasMore && (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                                <Lucide icon="Loader" className="w-4 h-4 animate-spin" /> Caricamento automatico...
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState icon="FolderOpen" title="Nessun volantino attivo" description="Modifica i filtri per vedere altri risultati" />
                )}
            </div>
        </div>
    );
};

interface VolantiniInLavorazioneContentProps {
    data: VolantiniInLavorazione;
    isLoading: boolean;
    aree: AreaResponseDTO[];
    canali: CanaleResponseDTO[];
    filter: CardFilter;
    onFilterChange: (filter: CardFilter) => void;
}

const VolantiniInLavorazioneContent: FC<VolantiniInLavorazioneContentProps> = ({
    data,
    isLoading,
    aree,
    canali,
    filter: cardFilter,
    onFilterChange
}) => {
    const [quickFilter, setQuickFilter] = useState<"all" | "review" | "error">("all");

    const filteredKits = useMemo<KitVolantino[]>(() => {
        switch (quickFilter) {
            case "review":
                return data.kit.filter((kit: KitVolantino) => kit.stato_lavorazione === "IN_REVISIONE");
            case "error":
                return data.kit.filter((kit: KitVolantino) => kit.stato_lavorazione?.includes("ERRORI"));
            default:
                return data.kit;
        }
    }, [data.kit, quickFilter]);

    const { items, hasMore, registerSentinel } = useInfiniteKitScroll(filteredKits);
    const getFilterClasses = (value: typeof quickFilter) => {
        if (value !== quickFilter) {
            return "text-slate-500 border-transparent hover:border-slate-200";
        }
        if (value === "error") {
            return "bg-danger/20 text-danger border-danger/30 shadow-sm";
        }
        if (value === "review") {
            return "bg-info/15 text-info border-info/25 shadow-sm";
        }
        return "bg-theme-1/10 text-theme-1 border-theme-1/30 shadow-sm";
    };

    return (
        <div className={clsx("flex flex-col gap-5 h-full transition-opacity duration-150", isLoading && "opacity-50 pointer-events-none")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={cardFilter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="in-lavorazione"
            />

            <div className="flex flex-wrap items-center gap-3 p-3 rounded-[0.6rem] border border-dashed border-slate-200/80 bg-white/80">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Stato processo</p>
                    <p className="text-sm font-semibold text-slate-700">
                        {quickFilter === "all" && "Tutti i kit in produzione"}
                        {quickFilter === "review" && "Solo kit in revisione"}
                        {quickFilter === "error" && "Kit con errori"}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {[
                        { value: "all", label: "Tutti" },
                        { value: "review", label: "In revisione" },
                        { value: "error", label: "Con errori" },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={clsx(
                                "px-4 py-2 rounded-[0.6rem] text-xs font-semibold border transition",
                                getFilterClasses(option.value as typeof quickFilter)
                            )}
                            onClick={() => setQuickFilter(option.value as typeof quickFilter)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-[18rem]">
                {filteredKits.length > 0 ? (
                    <div className="space-y-3 pr-1 overflow-y-auto max-h-[32rem] pb-1">
                        {items.map((kit) => (
                            <KitCard key={kit.id} kit={kit} routeClickable />
                        ))}
                        <div ref={registerSentinel} />
                        {hasMore && (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                                <Lucide icon="Loader" className="w-4 h-4 animate-spin" /> Caricamento automatico...
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState icon="Pencil" title="Nessun volantino disponibile" description="Modifica i filtri per vedere altri risultati" />
                )}
            </div>
        </div>
    );
};


interface VolantiniPubblicatiInLavorazioneContentProps {
    data: VolantiniPubblicatiInLavorazione;
    isLoading: boolean;
    aree: AreaResponseDTO[];
    canali: CanaleResponseDTO[];
    filter: CardFilter;
    onFilterChange: (filter: CardFilter) => void;
}

const VolantiniPubblicatiInLavorazioneContent: FC<VolantiniPubblicatiInLavorazioneContentProps> = ({
    data,
    isLoading,
    aree,
    canali,
    filter: cardFilter,
    onFilterChange
}) => {
    const { items, hasMore, registerSentinel } = useInfiniteKitScroll(data.kit);

    return (
        <div className={clsx("flex flex-col gap-5 h-full transition-opacity duration-150", isLoading && "opacity-50 pointer-events-none")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={cardFilter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="pubblicati-in-lavorazione"
            />

            <div className="flex-1 min-h-[18rem]">
                {data.kit.length > 0 ? (
                    <div className="space-y-3 pr-1 overflow-y-auto max-h-[32rem] pb-1">
                        {items.map((kit) => (
                            <KitCard key={kit.id} kit={kit} routeClickable />
                        ))}
                        <div ref={registerSentinel} />
                        {hasMore && (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                                <Lucide icon="Loader" className="w-4 h-4 animate-spin" /> Caricamento automatico...
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState icon="CircleCheck" title="Nessun volantino in attesa" description="Tutti i volantini pubblicati sono già nelle promozioni attive" />
                )}
            </div>
        </div>
    );
};

interface StoricoVolantiniContentProps {
    data: StoricoVolantini | null;
    isLoading: boolean;
    aree: AreaResponseDTO[];
    canali: CanaleResponseDTO[];
    filter: CardFilter;
    onFilterChange: (filter: CardFilter) => void;
}

const StoricoVolantiniContent: FC<StoricoVolantiniContentProps> = ({
    data,
    isLoading,
    aree,
    canali,
    filter,
    onFilterChange
}) => {
    const { items, hasMore, registerSentinel } = useInfiniteKitScroll(data?.kit || []);

    return (
        <div className={clsx("flex flex-col gap-5 h-full transition-opacity duration-150", isLoading && "opacity-50 pointer-events-none")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={filter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="storico"
            />

            <div className="flex-1 min-h-[18rem]">
                {data && data.kit.length > 0 ? (
                    <div className="space-y-3 pr-1 overflow-y-auto max-h-[32rem] pb-1">
                        {items.map((kit) => (
                            <KitCard key={kit.id} kit={kit} showValidita routeClickable />
                        ))}
                        <div ref={registerSentinel} />
                        {hasMore && (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                                <Lucide icon="Loader" className="w-4 h-4 animate-spin" /> Caricamento automatico...
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState icon="History" title="Nessun volantino nello storico" description="Lo storico dei volantini apparirà qui" />
                )}
            </div>

            <div className="flex items-center justify-between rounded-[0.6rem] border border-dashed border-slate-200/80 bg-white/70 p-4">
                <div>
                    <p className="text-sm font-semibold text-slate-700">Consulta lo storico completo</p>
                    <p className="text-xs text-slate-500">Accedi all'elenco dettagliato di tutti i volantini pubblicati.</p>
                </div>
                <Link
                    to="/storico-volantini"
                    className="inline-flex items-center gap-2 rounded-full border border-theme-1/30 bg-theme-1/10 px-4 py-2 text-xs font-semibold text-theme-1 hover:bg-theme-1/20"
                >
                    Vai al dettaglio
                    <Lucide icon="ArrowRight" className="h-3.5 w-3.5" />
                </Link>
            </div>
        </div>
    );
};

// Componente filtro compatto inline per ogni card
interface CardFilterSelectProps {
    aree: AreaResponseDTO[];
    canali: CanaleResponseDTO[];
    filter: CardFilter;
    onFilterChange: (filter: CardFilter) => void;
    isLoading?: boolean;
    cardId: string;
}

const CardFilterSelect: FC<CardFilterSelectProps> = ({
    aree,
    canali,
    filter,
    onFilterChange,
    isLoading,
    cardId
}) => {
    const hasActiveFilters = filter.id_area || filter.id_canale;

    return (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-[0.6rem] border border-dashed border-slate-200/80 bg-white/80 mb-4">
            <div className="flex items-center gap-2">
                <Lucide icon="Filter" className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500">Filtra:</span>
            </div>
            <div className="flex-1 flex flex-wrap items-center gap-2">
                <div className="min-w-[140px]">
                    <FormSelect
                        id={`filter-area-${cardId}`}
                        value={filter.id_area}
                        onChange={(e) => onFilterChange({ ...filter, id_area: e.target.value })}
                        disabled={isLoading}
                        className={clsx("text-xs", isLoading && "opacity-50")}
                    >
                        <option value="">Tutte le aree</option>
                        {aree.map((area) => (
                            <option key={area.id} value={area.id}>
                                {area.nome}
                            </option>
                        ))}
                    </FormSelect>
                </div>
                <div className="min-w-[140px]">
                    <FormSelect
                        id={`filter-canale-${cardId}`}
                        value={filter.id_canale}
                        onChange={(e) => onFilterChange({ ...filter, id_canale: e.target.value })}
                        disabled={isLoading}
                        className={clsx("text-xs", isLoading && "opacity-50")}
                    >
                        <option value="">Tutti i canali</option>
                        {canali.map((canale) => (
                            <option key={canale.id} value={canale.id}>
                                {canale.nome}
                            </option>
                        ))}
                    </FormSelect>
                </div>
            </div>
            {hasActiveFilters && (
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => onFilterChange({ id_area: "", id_canale: "" })}
                    disabled={isLoading}
                    className="ml-auto"
                >
                    <Lucide icon="X" className="w-3 h-3 mr-1" />
                    Reset
                </Button>
            )}
        </div>
    );
};

const Dashboard3: FC<Dashboard3Props> = ({ embedded = false, loaderDataOverride }) => {
    const routeLoaderData = useLoaderData() as Dashboard3LoaderData | null;
    const loaderData = loaderDataOverride ?? routeLoaderData;

    // Stato per aree e canali (shared)
    const [aree, setAree] = useState<AreaResponseDTO[]>([]);
    const [canali, setCanali] = useState<CanaleResponseDTO[]>([]);

    // Filtri indipendenti per ogni card
    const [filterInCorso, setFilterInCorso] = useState<CardFilter>({ id_area: "", id_canale: "" });
    const [filterInLavorazione, setFilterInLavorazione] = useState<CardFilter>({ id_area: "", id_canale: "" });
    const [filterPubblicatiInLavorazione, setFilterPubblicatiInLavorazione] = useState<CardFilter>({ id_area: "", id_canale: "" });
    const [filterStorico, setFilterStorico] = useState<CardFilter>({ id_area: "", id_canale: "" });

    // Stato per i dati di ogni card
    const [volantiniInCorso, setVolantiniInCorso] = useState<VolantiniInCorso | null>(null);
    const [volantiniInLavorazione, setVolantiniInLavorazione] = useState<VolantiniInLavorazione | null>(null);
    const [volantiniPubblicatiInLavorazione, setVolantiniPubblicatiInLavorazione] = useState<VolantiniPubblicatiInLavorazione | null>(null);
    const [storicoVolantini, setStoricoVolantini] = useState<StoricoVolantini | null>(null);

    // Loading states indipendenti per ogni card
    const [loadingInCorso, setLoadingInCorso] = useState(false);
    const [loadingInLavorazione, setLoadingInLavorazione] = useState(false);
    const [loadingPubblicatiInLavorazione, setLoadingPubblicatiInLavorazione] = useState(false);
    const [loadingStorico, setLoadingStorico] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Helper per costruire query string
    const buildQueryString = useCallback((filter: CardFilter, extraParams?: Record<string, string>) => {
        const params = new URLSearchParams();
        if (filter.id_area) params.set("id_area", filter.id_area);
        if (filter.id_canale) params.set("id_canale", filter.id_canale);
        if (extraParams) {
            Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));
        }
        const queryString = params.toString();
        return queryString ? `?${queryString}` : "";
    }, []);

    // Carica i dati iniziali dal loader
    useEffect(() => {
        const loadInitialData = async () => {
            if (!loaderData) return;

            try {
                const [inCorso, inLavorazione, pubblicatiInLavorazione, areeData, canaliData] = await Promise.all([
                    loaderData.volantiniInCorsoPromise,
                    loaderData.volantiniInLavorazionePromise,
                    loaderData.volantiniPubblicatiInLavorazionePromise,
                    loaderData.areePromise,
                    loaderData.canaliPromise
                ]);

                setVolantiniInCorso(inCorso);
                setVolantiniInLavorazione(inLavorazione);
                setVolantiniPubblicatiInLavorazione(pubblicatiInLavorazione);
                setAree(areeData || []);
                setCanali(canaliData || []);

                // Carica anche lo storico (ultimi 10)
                const storico = await ServerCall.get<StoricoVolantini>("/dashboard/storico-volantini?limit=10");
                setStoricoVolantini(storico);
            } catch (error) {
                console.error("Errore durante il caricamento iniziale:", error);
            } finally {
                setInitialLoading(false);
            }
        };

        loadInitialData();
    }, [loaderData]);

    // Funzioni fetch per ogni card
    const fetchVolantiniInCorso = useCallback(async (filter: CardFilter) => {
        setLoadingInCorso(true);
        try {
            const data = await ServerCall.get<VolantiniInCorso>(`/dashboard/volantini-in-corso${buildQueryString(filter)}`);
            setVolantiniInCorso(data);
        } catch (error) {
            console.error("Errore caricamento volantini in corso:", error);
        } finally {
            setLoadingInCorso(false);
        }
    }, [buildQueryString]);

    const fetchVolantiniInLavorazione = useCallback(async (filter: CardFilter) => {
        setLoadingInLavorazione(true);
        try {
            const data = await ServerCall.get<VolantiniInLavorazione>(`/dashboard/volantini-in-lavorazione${buildQueryString(filter)}`);
            setVolantiniInLavorazione(data);
        } catch (error) {
            console.error("Errore caricamento volantini in lavorazione:", error);
        } finally {
            setLoadingInLavorazione(false);
        }
    }, [buildQueryString]);

    const fetchVolantiniPubblicatiInLavorazione = useCallback(async (filter: CardFilter) => {
        setLoadingPubblicatiInLavorazione(true);
        try {
            const data = await ServerCall.get<VolantiniPubblicatiInLavorazione>(`/dashboard/volantini-pubblicati-in-lavorazione${buildQueryString(filter)}`);
            setVolantiniPubblicatiInLavorazione(data);
        } catch (error) {
            console.error("Errore caricamento volantini pubblicati in lavorazione:", error);
        } finally {
            setLoadingPubblicatiInLavorazione(false);
        }
    }, [buildQueryString]);

    const fetchStoricoVolantini = useCallback(async (filter: CardFilter) => {
        setLoadingStorico(true);
        try {
            const data = await ServerCall.get<StoricoVolantini>(`/dashboard/storico-volantini${buildQueryString(filter, { limit: "10" })}`);
            setStoricoVolantini(data);
        } catch (error) {
            console.error("Errore caricamento storico volantini:", error);
        } finally {
            setLoadingStorico(false);
        }
    }, [buildQueryString]);

    // Handler per cambio filtri per ogni card
    const handleFilterInCorsoChange = useCallback((filter: CardFilter) => {
        setFilterInCorso(filter);
        fetchVolantiniInCorso(filter);
    }, [fetchVolantiniInCorso]);

    const handleFilterInLavorazioneChange = useCallback((filter: CardFilter) => {
        setFilterInLavorazione(filter);
        fetchVolantiniInLavorazione(filter);
    }, [fetchVolantiniInLavorazione]);

    const handleFilterPubblicatiInLavorazioneChange = useCallback((filter: CardFilter) => {
        setFilterPubblicatiInLavorazione(filter);
        fetchVolantiniPubblicatiInLavorazione(filter);
    }, [fetchVolantiniPubblicatiInLavorazione]);

    const handleFilterStoricoChange = useCallback((filter: CardFilter) => {
        setFilterStorico(filter);
        fetchStoricoVolantini(filter);
    }, [fetchStoricoVolantini]);

    if (initialLoading) {
        return (
            <>
                {!embedded && (
                    <PageHeader title="Dashboard" description="Panoramica dei volantini attivi e in lavorazione." />
                )}
                <div className="grid grid-cols-12 gap-5 mt-5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                            <VolantiniSkeleton />
                        </div>
                    ))}
                </div>
            </>
        );
    }

    return (
        <>
            {!embedded && (
                <PageHeader title="Dashboard" description="Panoramica dei volantini attivi e in lavorazione." />
            )}

            <div className="grid grid-cols-12 gap-5 mt-5">
                <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                    <div className="flex flex-col gap-1 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                                <Lucide icon="BookOpen" className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <div className="text-base font-semibold">Volantini in validità</div>
                                <div className="text-slate-500 text-sm">Panoramica dei volantini pubblicati</div>
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-14">Aggiornato {dayjs().format("DD MMM YYYY")}</div>
                    </div>
                    {volantiniInCorso ? (
                        <VolantiniInCorsoContent
                            data={volantiniInCorso}
                            isLoading={loadingInCorso}
                            aree={aree}
                            canali={canali}
                            filter={filterInCorso}
                            onFilterChange={handleFilterInCorsoChange}
                        />
                    ) : (
                        <VolantiniSkeleton />
                    )}
                </div>

                <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                    <div className="flex flex-col gap-1 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
                                <Lucide icon="CircleCheck" className="w-6 h-6 text-success" />
                            </div>
                            <div>
                                <div className="text-base font-semibold">Prossimi volantini</div>
                                <div className="text-slate-500 text-sm">Pubblicati ma in attesa della promo ad entrare in validità</div>
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-14">Pronti per la pubblicazione</div>
                    </div>
                    {volantiniPubblicatiInLavorazione ? (
                        <VolantiniPubblicatiInLavorazioneContent
                            data={volantiniPubblicatiInLavorazione}
                            isLoading={loadingPubblicatiInLavorazione}
                            aree={aree}
                            canali={canali}
                            filter={filterPubblicatiInLavorazione}
                            onFilterChange={handleFilterPubblicatiInLavorazioneChange}
                        />
                    ) : (
                        <VolantiniSkeleton />
                    )}
                </div>
                <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                    <div className="flex flex-col gap-1 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warning/10">
                                <Lucide icon="Pencil" className="w-6 h-6 text-warning" />
                            </div>
                            <div>
                                <div className="text-base font-semibold">Volantini in Lavorazione</div>
                                <div className="text-slate-500 text-sm">Volantini in produzione e revisioni aperte</div>
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-14">Workflow creativo in tempo reale</div>
                    </div>
                    {volantiniInLavorazione ? (
                        <VolantiniInLavorazioneContent
                            data={volantiniInLavorazione}
                            isLoading={loadingInLavorazione}
                            aree={aree}
                            canali={canali}
                            filter={filterInLavorazione}
                            onFilterChange={handleFilterInLavorazioneChange}
                        />
                    ) : (
                        <VolantiniSkeleton />
                    )}
                </div>


                <div className="flex flex-col col-span-12 sm:col-span-6 p-5 box box--stacked">
                    <div className="flex flex-col gap-1 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-info/10">
                                <Lucide icon="History" className="w-6 h-6 text-info" />
                            </div>
                            <div>
                                <div className="text-base font-semibold">Storico volantini</div>
                                <div className="text-slate-500 text-sm">Ultimi 10 volantini pubblicati</div>
                            </div>
                        </div>
                    </div>
                    <StoricoVolantiniContent
                        data={storicoVolantini}
                        isLoading={loadingStorico}
                        aree={aree}
                        canali={canali}
                        filter={filterStorico}
                        onFilterChange={handleFilterStoricoChange}
                    />
                </div>

            </div>
        </>
    );
};

export default Dashboard3;
