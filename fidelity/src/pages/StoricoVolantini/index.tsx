import Button from "@/components/Base/Button";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Pagination from "@/components/Base/Pagination";
import TomSelect from "@/components/Base/TomSelect";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import withSessionCheck from "@/components/SessionChecker";
import axios from "axios";
import clsx from "clsx";
import dayjs from "dayjs";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import { AreaResponseDTO, CanaleResponseDTO } from "../../../server/core/dto";
import { PERMISSIONS } from "../../constants/permissions";
import { usePermission } from "../../context/PermissionContext";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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

interface StoricoVolantiniResponse {
    totale: number;
    kit: KitVolantino[];
}

interface CardFilter {
    id_area: string;
    id_canale: string;
}

// Badge classes per stati kit
const BADGE_STYLES: Record<string, string> = {
    PUBBLICATO: "bg-success/10 text-success border-success/20",
    IN_LAVORAZIONE: "bg-info/10 text-info border-info/20",
    IN_LAVORAZIONE_CON_ERRORI: "bg-danger/10 text-danger border-danger/20",
    IN_REVISIONE: "bg-warning/10 text-warning border-warning/20",
};

// Componente stat card compatta
interface StatCompactCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone?: "primary" | "warning" | "info" | "success";
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
        success: "border-success/30 text-success bg-success/10",
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

// Componente KitCard (uguale a Dashboard3)
const KitCard: FC<{ kit: KitVolantino; showValidita?: boolean }> = ({ kit, showValidita }) => {
    const canAccessPromo = usePermission(PERMISSIONS.PAGINA.LAVORAZIONI_IN_CORSO);
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
                                {canAccessPromo && kit.id_promo ? (
                                    <Link
                                        className="block text-sm font-semibold text-slate-800 truncate hover:text-theme-1"
                                        to={`/promozioni/in-corso/dettagli/${kit.id_promo}/kits/${kit.id}`}
                                    >
                                        {kit.titolo}
                                    </Link>
                                ) : (
                                    <p className="block text-sm font-semibold text-slate-800 truncate hover:text-theme-1">{kit.titolo}</p>
                                )}
                                {canAccessPromo ? (
                                    <Link
                                        to={`/promozioni/in-corso/dettagli/${kit.id_promo}`}
                                        className="block text-xs text-theme-1 truncate hover:underline decoration-dotted decoration-theme-1/30"
                                    >
                                        Promo: {kit.nome_promo}
                                    </Link>
                                ) : (
                                    <p className="block text-xs text-theme-1 truncate hover:underline decoration-dotted decoration-theme-1/30">Promo: {kit.nome_promo}</p>
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
                                            {dayjs(kit.validita_dal).locale("it").format("D MMM YYYY")} - {dayjs(kit.validita_al).locale("it").format("D MMM YYYY")}
                                        </>
                                    ) : kit.validita_al ? (
                                        <>fino al {dayjs(kit.validita_al).locale("it").format("D MMM YYYY")}</>
                                    ) : kit.validita_dal ? (
                                        <>dal {dayjs(kit.validita_dal).locale("it").format("D MMM YYYY")}</>
                                    ) : null}
                                </span>
                            )}
                            {file?.tipo_export && (
                                <span className="inline-flex items-center gap-1">
                                    <Lucide icon="Layers" className="w-3 h-3" />
                                    {file.tipo_export}
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

// Skeleton per il caricamento
const VolantiniSkeleton: FC = () => (
    <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-[0.6rem] border border-dashed border-slate-200/70 bg-white/80 flex items-center gap-4">
                <div className="w-20 h-24 rounded-[0.6rem] bg-slate-200/60" />
                <div className="flex-1 space-y-3">
                    <div className="h-3 bg-slate-200/70 rounded w-3/5" />
                    <div className="h-3 bg-slate-200/70 rounded w-2/5" />
                    <div className="h-3 bg-slate-200/70 rounded w-1/2" />
                </div>
            </div>
        ))}
    </div>
);

// Componente principale
const StoricoVolantiniPage = () => {
    // Stato per i dati
    const [data, setData] = useState<StoricoVolantiniResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    // Stato per aree e canali
    const [aree, setAree] = useState<AreaResponseDTO[]>([]);
    const [canali, setCanali] = useState<CanaleResponseDTO[]>([]);

    // Filtri
    const [filter, setFilter] = useState<CardFilter>({ id_area: "", id_canale: "" });
    const [isFiltering, setIsFiltering] = useState(false);

    // Stato paginazione
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Helper per costruire query string
    const buildQueryString = useCallback((filter: CardFilter) => {
        const params = new URLSearchParams();
        if (filter.id_area) params.set("id_area", filter.id_area);
        if (filter.id_canale) params.set("id_canale", filter.id_canale);
        const queryString = params.toString();
        return queryString ? `?${queryString}` : "";
    }, []);

    // Carica i dati iniziali
    const fetchData = useCallback(async (currentFilter: CardFilter) => {
        setIsFiltering(true);
        try {
            const response = await ServerCall.get<StoricoVolantiniResponse>(
                `/dashboard/storico-volantini${buildQueryString(currentFilter)}`
            );
            setData(response);
            setIsError(false);
        } catch (error) {
            console.error("Errore caricamento storico volantini:", error);
            setIsError(true);
        } finally {
            setIsFiltering(false);
            setIsLoading(false);
        }
    }, [buildQueryString]);

    // Carica aree e canali
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [areeData, canaliData] = await Promise.all([
                    ServerCall.get<AreaResponseDTO[]>("/aree"),
                    ServerCall.get<CanaleResponseDTO[]>("/canali")
                ]);
                setAree(areeData || []);
                setCanali(canaliData || []);
            } catch (error) {
                console.error("Errore caricamento aree/canali:", error);
            }
        };

        loadInitialData();
        fetchData(filter);
    }, []);

    // Handler per cambio filtri
    const handleFilterChange = useCallback((newFilter: CardFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        fetchData(newFilter);
    }, [fetchData]);

    // Refetch
    const refetch = useCallback(() => {
        setIsLoading(true);
        fetchData(filter);
    }, [filter, fetchData]);

    // Paginazione client-side sui dati già ricevuti
    const paginatedKits = useMemo(() => {
        if (!data?.kit) return [];
        const startIndex = (currentPage - 1) * pageSize;
        return data.kit.slice(startIndex, startIndex + pageSize);
    }, [data?.kit, currentPage, pageSize]);

    const totalPages = useMemo(() => {
        if (!data?.kit) return 0;
        return Math.ceil(data.kit.length / pageSize);
    }, [data?.kit, pageSize]);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
    };

    // Genera i numeri di pagina da mostrare
    const getPageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('ellipsis');

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) pages.push(i);

            if (currentPage < totalPages - 2) pages.push('ellipsis');
            pages.push(totalPages);
        }
        return pages;
    };

    const hasActiveFilters = filter.id_area || filter.id_canale;

    if (isLoading) {
        return (
            <div className="p-6">
                <PageHeader title="Storico volantini" description="Consulta tutti i volantini pubblicati con i relativi file." />
                <div className="mt-16 flex justify-center">
                    <LoadingSpinner />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="space-y-6 p-6">
                <PageHeader
                    title="Storico volantini"
                    description="Consulta tutti i volantini pubblicati con i relativi file."
                    actions={
                        <Button variant="outline-secondary" onClick={refetch}>
                            <Lucide icon="RefreshCcw" className="h-4 w-4 mr-2" />
                            Riprova
                        </Button>
                    }
                />
                <EmptyState
                    icon="TriangleAlert"
                    title="Impossibile recuperare i dati"
                    description="Si è verificato un errore. Riprova a caricare lo storico."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <PageHeader
                title="Storico volantini"
                description="Panoramica completa di tutti i volantini pubblicati dalle promozioni scadute."
            />

            <div className="box box--stacked">
                {/* Header con stats e filtri */}
                <div className="p-5 border-b border-slate-200/60">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                        <StatCompactCard
                            label="Volantini totali"
                            value={data?.totale || 0}
                            tone="info"
                            icon={<Lucide icon="History" className="w-4 h-4" />}
                        />
                        <StatCompactCard
                            label="In questa pagina"
                            value={paginatedKits.length}
                            tone="primary"
                            icon={<Lucide icon="FileStack" className="w-4 h-4" />}
                        />
                        <StatCompactCard
                            label="Pagine totali"
                            value={totalPages}
                            tone="success"
                            icon={<Lucide icon="BookOpen" className="w-4 h-4" />}
                        />
                    </div>

                    {/* Filtri */}
                    <div className="flex flex-wrap items-center gap-3 p-3 rounded-[0.6rem] border border-dashed border-slate-200/80 bg-white/80">
                        <div className="flex items-center gap-2">
                            <Lucide icon="Filter" className="w-4 h-4 text-slate-400" />
                            <span className="text-xs text-slate-500">Filtra:</span>
                        </div>
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                            <div className="min-w-[160px]">
                                <TomSelect
                                    id="filter-area-storico"
                                    value={filter.id_area}
                                    onChange={(e) => handleFilterChange({ ...filter, id_area: e.target.value })}
                                    disabled={isFiltering}
                                    options={{
                                        placeholder: "Area",
                                        allowEmptyOption: true
                                    }}
                                    className={clsx("text-xs", isFiltering && "opacity-50")}
                                >
                                    <option value="">Tutte le aree</option>
                                    {aree.map((area) => (
                                        <option key={area.id} value={area.id}>
                                            {area.nome}
                                        </option>
                                    ))}
                                </TomSelect>
                            </div>
                            <div className="min-w-[160px]">
                                <TomSelect
                                    id="filter-canale-storico"
                                    value={filter.id_canale}
                                    onChange={(e) => handleFilterChange({ ...filter, id_canale: e.target.value })}
                                    disabled={isFiltering}
                                    options={{
                                        placeholder: "Canale",
                                        allowEmptyOption: true
                                    }}
                                    className={clsx("text-xs", isFiltering && "opacity-50")}
                                >
                                    <option value="">Tutti i canali</option>
                                    {canali.map((canale) => (
                                        <option key={canale.id} value={canale.id}>
                                            {canale.nome}
                                        </option>
                                    ))}
                                </TomSelect>
                            </div>
                        </div>
                        {hasActiveFilters && (
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleFilterChange({ id_area: "", id_canale: "" })}
                                disabled={isFiltering}
                                className="ml-auto"
                            >
                                <Lucide icon="X" className="w-3 h-3 mr-1" />
                                Reset filtri
                            </Button>
                        )}
                    </div>
                </div>

                {/* Lista volantini */}
                <div className={clsx("p-5 transition-opacity duration-150", isFiltering && "opacity-50 pointer-events-none")}>
                    {!data?.kit || data.kit.length === 0 ? (
                        <EmptyState
                            icon="Archive"
                            title="Non ci sono volantini archiviati"
                            description={hasActiveFilters
                                ? "Nessun volantino trovato con i filtri selezionati. Prova a modificare i filtri."
                                : "Appena pubblicherai un kit troverai qui i file e le anteprime."
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            {paginatedKits.map((kit) => (
                                <KitCard key={kit.id} kit={kit} showValidita />
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-5 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                        {/* Info e page size */}
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-500">
                                Pagina <strong>{currentPage}</strong> di <strong>{totalPages}</strong>
                                <span className="hidden sm:inline"> ({data?.totale || 0} volantini totali)</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Mostra</span>
                                <FormSelect
                                    className="w-16 text-xs py-1.5"
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                >
                                    {PAGE_SIZE_OPTIONS.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </FormSelect>
                            </div>
                        </div>

                        {/* Pagination controls */}
                        <Pagination className="rounded-lg bg-slate-100 p-1">
                            <Pagination.Link
                                onClick={() => goToPage(currentPage - 1)}
                                className={clsx(currentPage === 1 && "opacity-50 pointer-events-none")}
                            >
                                <Lucide icon="ChevronLeft" className="h-4 w-4" />
                            </Pagination.Link>

                            {getPageNumbers().map((page, idx) =>
                                page === 'ellipsis' ? (
                                    <Pagination.Link key={`ellipsis-${idx}`} className="pointer-events-none">
                                        ...
                                    </Pagination.Link>
                                ) : (
                                    <Pagination.Link
                                        key={page}
                                        active={page === currentPage}
                                        onClick={() => goToPage(page)}
                                    >
                                        {page}
                                    </Pagination.Link>
                                )
                            )}

                            <Pagination.Link
                                onClick={() => goToPage(currentPage + 1)}
                                className={clsx(currentPage === totalPages && "opacity-50 pointer-events-none")}
                            >
                                <Lucide icon="ChevronRight" className="h-4 w-4" />
                            </Pagination.Link>
                        </Pagination>
                    </div>
                )}
            </div>
        </div>
    );
};

export default withSessionCheck(StoricoVolantiniPage);
