import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import FormSelect from "@/components/Base/Form/FormSelect";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Segmenti from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import axios from "axios";
import clsx from "clsx";
import dayjs from "dayjs";
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import { AreaResponseDTO, CanaleResponseDTO } from "../../../server/core/dto";
import EmptyState from "../../components/EmptyState";
import { PERMISSIONS } from "../../constants/permissions";
import { usePermission } from "../../context/PermissionContext";
import { useNotification } from "@/context/NotificationContext";
import { formatData } from "@/utils/format";

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
    <div aria-hidden="true" className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
                <div key={i} className="rounded-card bg-slate-50 p-4">
                    <Skeleton className="mb-2 h-3 w-16" />
                    <Skeleton className="mt-3 h-8" />
                </div>
            ))}
        </div>
        <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4">
                    <Skeleton className="h-20 w-16 flex-none" />
                    <div className="flex-1 space-y-3">
                        <Skeleton className="h-3 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const KitCard: FC<{ kit: KitVolantino; showValidita?: boolean, routeClickable?: boolean }> = ({ kit, showValidita, routeClickable = false }) => {
    const canAccessPromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
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

    return (
        <>
            <div className="relative rounded-card border border-slate-200 bg-white p-4">
                <div className="flex gap-4">
                    <div className="relative shrink-0">
                        {hasPreview ? (
                            <button
                                type="button"
                                aria-label={`Anteprima di ${kit.titolo}`}
                                className="group/preview relative h-24 w-20 overflow-hidden rounded-card border border-theme-1/20 bg-slate-50 focus-visible:outline focus-visible:outline-theme-1/40"
                                onClick={() => setIsPreviewOpen(true)}
                            >
                                <img
                                    src={previewUrl}
                                    alt={kit.titolo}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-xs font-medium text-white opacity-0 transition-opacity group-hover/preview:opacity-100">
                                    <Lucide icon="Eye" aria-hidden="true" className="mr-1 h-4 w-4" /> Anteprima
                                </span>
                            </button>
                        ) : (
                            <div className="flex h-24 w-20 items-center justify-center rounded-card border border-dashed border-slate-300 bg-slate-50">
                                <Lucide icon="FileText" aria-hidden="true" className="h-5 w-5 text-slate-400" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="title-card truncate">
                                    {routeClickable && canAccessPromo ? (
                                        <Link
                                            className="hover:text-primary"
                                            to={kit.id_promo ? `/promozioni/in-corso/dettagli/${kit.id_promo}/kits/${kit.id}` : "#"}
                                        >
                                            {kit.titolo}
                                        </Link>
                                    ) : (
                                        kit.titolo
                                    )}
                                </h3>
                                {canAccessPromo ? (
                                    <Link
                                        to={`/promozioni/in-corso/dettagli/${kit.id_promo}`}
                                        className="block truncate text-xs text-theme-1 decoration-theme-1/30 decoration-dotted hover:underline"
                                    >
                                        Promo: {kit.nome_promo}
                                    </Link>
                                ) : (
                                    <p className="block truncate text-xs text-slate-500">Promo: {kit.nome_promo}</p>
                                )}
                                {(kit.nome_area || kit.nome_canale) && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        {kit.nome_area && (
                                            <Badge variant="secondary" size="sm">
                                                <Lucide icon="MapPin" aria-hidden="true" className="h-3 w-3" />
                                                {kit.nome_area}
                                            </Badge>
                                        )}
                                        {kit.nome_canale && (
                                            <Badge variant="primary" size="sm">
                                                <Lucide icon="Store" aria-hidden="true" className="h-3 w-3" />
                                                {kit.nome_canale}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                            <StatusBadge dominio="kitRuntime" stato={kit.stato_lavorazione?.toUpperCase()} className="shrink-0" />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            {showValidita && (kit.validita_dal || kit.validita_al) && (
                                <span className="inline-flex items-center gap-1 tabular-nums text-theme-1">
                                    <Lucide icon="Calendar" aria-hidden="true" className="h-3 w-3" />
                                    {kit.validita_dal && kit.validita_al ? (
                                        <>
                                            {formatData(kit.validita_dal)} - {formatData(kit.validita_al)}
                                        </>
                                    ) : kit.validita_al ? (
                                        <>fino al {formatData(kit.validita_al)}</>
                                    ) : kit.validita_dal ? (
                                        <>dal {formatData(kit.validita_dal)}</>
                                    ) : null}
                                </span>
                            )}
                            {file?.mime && (
                                <span className="inline-flex items-center gap-1">
                                    <Lucide icon="File" aria-hidden="true" className="h-3 w-3" />
                                    {file.mime}
                                </span>
                            )}
                            {file?.pages && file.pages > 0 && (
                                <span className="inline-flex items-center gap-1">
                                    <Lucide icon="Book" aria-hidden="true" className="h-3 w-3" />
                                    {file.pages} pp
                                </span>
                            )}
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={handleDownload}
                                disabled={!canDownload || isDownloading}
                                loading={isDownloading}
                            >
                                {!isDownloading && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                                Scarica
                            </Button>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => hasPreview && setIsPreviewOpen(true)}
                                disabled={!hasPreview}
                            >
                                <Lucide icon="Focus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Anteprima
                            </Button>
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

const FILTRO_VUOTO: CardFilter = { id_area: "", id_canale: "" };

// Elenco dei kit con caricamento progressivo, oppure lo stato vuoto
const ElencoKit: FC<{
    kits: KitVolantino[];
    showValidita?: boolean;
    vuoto: ReactNode;
}> = ({ kits, showValidita, vuoto }) => {
    const { items, hasMore, registerSentinel } = useInfiniteKitScroll(kits);

    return (
        <div className="min-h-[18rem] flex-1">
            {kits.length > 0 ? (
                <div className="max-h-[32rem] space-y-3 overflow-y-auto pb-1 pr-1">
                    {items.map((kit) => (
                        <KitCard key={kit.id} kit={kit} showValidita={showValidita} routeClickable />
                    ))}
                    <div ref={registerSentinel} />
                    {hasMore && (
                        <div role="status" className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                            <Spinner size="sm" decorativo /> Caricamento automatico…
                        </div>
                    )}
                </div>
            ) : (
                vuoto
            )}
        </div>
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

    const kitInScadenza = useMemo<KitVolantino[]>(
        () => data.kit.filter((kit: KitVolantino) => kit.validita_al && dayjs(kit.validita_al).diff(dayjs(), "day") <= 7),
        [data.kit]
    );
    const filteredKits = quickFilter === "expiring" ? kitInScadenza : data.kit;
    const filtriAttivi = Boolean(cardFilter.id_area || cardFilter.id_canale) || quickFilter !== "all";

    const azzeraFiltri = () => {
        setQuickFilter("all");
        if (cardFilter.id_area || cardFilter.id_canale) onFilterChange(FILTRO_VUOTO);
    };

    return (
        <div className={clsx("flex h-full flex-col transition-opacity duration-150", isLoading && "pointer-events-none opacity-50")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={cardFilter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="in-corso"
                filtriRapidi={
                    <Segmenti
                        etichetta="Filtri rapidi"
                        valore={quickFilter}
                        onChange={setQuickFilter}
                        opzioni={[
                            { valore: "all", etichetta: "Tutti", conteggio: data.kit.length },
                            { valore: "expiring", etichetta: "In scadenza", conteggio: kitInScadenza.length },
                        ]}
                    />
                }
            />

            <ElencoKit
                kits={filteredKits}
                showValidita
                vuoto={
                    filtriAttivi ? (
                        <EmptyState
                            compatta
                            icon="SearchX"
                            title="Nessun volantino per questi filtri"
                            description="Modifica i filtri per vedere altri risultati."
                            buttonText="Azzera filtri"
                            buttonIcon="X"
                            onButtonClick={azzeraFiltri}
                        />
                    ) : (
                        <EmptyState compatta icon="FolderOpen" title="Nessun volantino attivo" description="Non ci sono volantini in validità." />
                    )
                }
            />
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

    const kitInRevisione = useMemo<KitVolantino[]>(
        () => data.kit.filter((kit: KitVolantino) => kit.stato_lavorazione === "IN_REVISIONE"),
        [data.kit]
    );
    const kitConErrori = useMemo<KitVolantino[]>(
        () => data.kit.filter((kit: KitVolantino) => kit.stato_lavorazione?.includes("ERRORI")),
        [data.kit]
    );
    const filteredKits = quickFilter === "review" ? kitInRevisione : quickFilter === "error" ? kitConErrori : data.kit;
    const filtriAttivi = Boolean(cardFilter.id_area || cardFilter.id_canale) || quickFilter !== "all";

    const azzeraFiltri = () => {
        setQuickFilter("all");
        if (cardFilter.id_area || cardFilter.id_canale) onFilterChange(FILTRO_VUOTO);
    };

    return (
        <div className={clsx("flex h-full flex-col transition-opacity duration-150", isLoading && "pointer-events-none opacity-50")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={cardFilter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="in-lavorazione"
                filtriRapidi={
                    <Segmenti
                        etichetta="Stato processo"
                        valore={quickFilter}
                        onChange={setQuickFilter}
                        opzioni={[
                            { valore: "all", etichetta: "Tutti", conteggio: data.kit.length },
                            { valore: "review", etichetta: "In revisione", conteggio: kitInRevisione.length },
                            { valore: "error", etichetta: "Con errori", conteggio: kitConErrori.length },
                        ]}
                    />
                }
            />

            <ElencoKit
                kits={filteredKits}
                vuoto={
                    filtriAttivi ? (
                        <EmptyState
                            compatta
                            icon="SearchX"
                            title="Nessun volantino per questi filtri"
                            description="Modifica i filtri per vedere altri risultati."
                            buttonText="Azzera filtri"
                            buttonIcon="X"
                            onButtonClick={azzeraFiltri}
                        />
                    ) : (
                        <EmptyState compatta icon="Pencil" title="Nessun volantino in lavorazione" description="Non ci sono volantini in produzione o in revisione." />
                    )
                }
            />
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
    const filtriAttivi = Boolean(cardFilter.id_area || cardFilter.id_canale);

    return (
        <div className={clsx("flex h-full flex-col transition-opacity duration-150", isLoading && "pointer-events-none opacity-50")}>
            <CardFilterSelect
                aree={aree}
                canali={canali}
                filter={cardFilter}
                onFilterChange={onFilterChange}
                isLoading={isLoading}
                cardId="pubblicati-in-lavorazione"
            />

            <ElencoKit
                kits={data.kit}
                vuoto={
                    filtriAttivi ? (
                        <EmptyState
                            compatta
                            icon="SearchX"
                            title="Nessun volantino per questi filtri"
                            description="Modifica i filtri per vedere altri risultati."
                            buttonText="Azzera filtri"
                            buttonIcon="X"
                            onButtonClick={() => onFilterChange(FILTRO_VUOTO)}
                        />
                    ) : (
                        <EmptyState compatta icon="CircleCheck" title="Nessun volantino in attesa" description="Tutti i volantini pubblicati sono già nelle promozioni attive." />
                    )
                }
            />
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
    const filtriAttivi = Boolean(filter.id_area || filter.id_canale);

    return (
        <div className={clsx("flex h-full flex-col gap-5 transition-opacity duration-150", isLoading && "pointer-events-none opacity-50")}>
            <div className="flex flex-1 flex-col">
                <CardFilterSelect
                    aree={aree}
                    canali={canali}
                    filter={filter}
                    onFilterChange={onFilterChange}
                    isLoading={isLoading}
                    cardId="storico"
                />

                <ElencoKit
                    kits={data?.kit || []}
                    showValidita
                    vuoto={
                        filtriAttivi ? (
                            <EmptyState
                                compatta
                                icon="SearchX"
                                title="Nessun volantino per questi filtri"
                                description="Modifica i filtri per vedere altri risultati."
                                buttonText="Azzera filtri"
                                buttonIcon="X"
                                onButtonClick={() => onFilterChange(FILTRO_VUOTO)}
                            />
                        ) : (
                            <EmptyState compatta icon="RotateCcwClock" title="Nessun volantino nello storico" description="Lo storico dei volantini apparirà qui." />
                        )
                    }
                />
            </div>

            <div className="flex flex-col gap-3 rounded-card border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="title-card">Consulta lo storico completo</h3>
                    <p className="text-xs text-slate-500">Accedi all'elenco dettagliato di tutti i volantini pubblicati.</p>
                </div>
                <Button as={Link} to="/storico-volantini" variant="outline-secondary" size="sm" className="flex-none">
                    Vai al dettaglio
                    <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
};

// Filtri area/canale di ogni card, con gli eventuali filtri rapidi accanto
interface CardFilterSelectProps {
    aree: AreaResponseDTO[];
    canali: CanaleResponseDTO[];
    filter: CardFilter;
    onFilterChange: (filter: CardFilter) => void;
    isLoading?: boolean;
    cardId: string;
    filtriRapidi?: ReactNode;
}

const CardFilterSelect: FC<CardFilterSelectProps> = ({
    aree,
    canali,
    filter,
    onFilterChange,
    isLoading,
    cardId,
    filtriRapidi
}) => {
    const hasActiveFilters = filter.id_area || filter.id_canale;

    return (
        <BarraFiltri
            variante="interna"
            destra={
                hasActiveFilters && (
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => onFilterChange(FILTRO_VUOTO)}
                        disabled={isLoading}
                    >
                        <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                        Azzera filtri
                    </Button>
                )
            }
        >
            <FormSelect
                id={`filter-area-${cardId}`}
                aria-label="Area"
                formSelectSize="sm"
                value={filter.id_area}
                onChange={(e) => onFilterChange({ ...filter, id_area: e.target.value })}
                disabled={isLoading}
                className="sm:w-44"
            >
                <option value="">Tutte le aree</option>
                {aree.map((area) => (
                    <option key={area.id} value={area.id}>
                        {area.nome}
                    </option>
                ))}
            </FormSelect>
            <FormSelect
                id={`filter-canale-${cardId}`}
                aria-label="Canale"
                formSelectSize="sm"
                value={filter.id_canale}
                onChange={(e) => onFilterChange({ ...filter, id_canale: e.target.value })}
                disabled={isLoading}
                className="sm:w-44"
            >
                <option value="">Tutti i canali</option>
                {canali.map((canale) => (
                    <option key={canale.id} value={canale.id}>
                        {canale.nome}
                    </option>
                ))}
            </FormSelect>
            {filtriRapidi}
        </BarraFiltri>
    );
};

type IdCard = "inCorso" | "inLavorazione" | "pubblicatiInLavorazione" | "storico";

const MOTIVO_ERRORE = "Il servizio non ha restituito i volantini. Riprova tra qualche istante.";

const TITOLO_PAGINA = "Dashboard";
const DESCRIZIONE_PAGINA = "Panoramica dei volantini attivi e in lavorazione.";

const Dashboard3: FC<Dashboard3Props> = ({ embedded = false, loaderDataOverride }) => {
    const routeLoaderData = useLoaderData() as Dashboard3LoaderData | null;
    const { showNotification } = useNotification();
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

    // Card il cui ultimo caricamento è fallito: mostrano l'errore invece di dati vuoti o vecchi
    const [errori, setErrori] = useState<Partial<Record<IdCard, boolean>>>({});
    const segnaErrore = useCallback((id: IdCard, inErrore: boolean) => {
        setErrori((prev) => (prev[id] === inErrore ? prev : { ...prev, [id]: inErrore }));
    }, []);

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

            // allSettled: un endpoint che fallisce non deve svuotare le altre card
            const risultati = await Promise.allSettled([
                loaderData.volantiniInCorsoPromise,
                loaderData.volantiniInLavorazionePromise,
                loaderData.volantiniPubblicatiInLavorazionePromise,
                loaderData.areePromise,
                loaderData.canaliPromise,
                // Storico (ultimi 10)
                ServerCall.get<StoricoVolantini>("/dashboard/storico-volantini?limit=10"),
            ]);
            const [inCorso, inLavorazione, pubblicatiInLavorazione, areeData, canaliData, storico] = risultati;

            if (inCorso.status === "fulfilled") setVolantiniInCorso(inCorso.value);
            if (inLavorazione.status === "fulfilled") setVolantiniInLavorazione(inLavorazione.value);
            if (pubblicatiInLavorazione.status === "fulfilled") setVolantiniPubblicatiInLavorazione(pubblicatiInLavorazione.value);
            if (areeData.status === "fulfilled") setAree(areeData.value || []);
            if (canaliData.status === "fulfilled") setCanali(canaliData.value || []);
            if (storico.status === "fulfilled") setStoricoVolantini(storico.value);
            setErrori({
                inCorso: inCorso.status === "rejected",
                inLavorazione: inLavorazione.status === "rejected",
                pubblicatiInLavorazione: pubblicatiInLavorazione.status === "rejected",
                storico: storico.status === "rejected",
            });

            const rifiutati = risultati.filter((r): r is PromiseRejectedResult => r.status === "rejected");
            if (rifiutati.length > 0) {
                console.error("Errore durante il caricamento iniziale:", rifiutati.map((e) => e.reason));
                showNotification("Alcuni dati della dashboard non sono stati caricati. Riprova più tardi.", { variant: "error" });
            }
            setInitialLoading(false);
        };

        loadInitialData();
    }, [loaderData, showNotification]);

    // Funzioni fetch per ogni card
    const fetchVolantiniInCorso = useCallback(async (filter: CardFilter) => {
        setLoadingInCorso(true);
        try {
            const data = await ServerCall.get<VolantiniInCorso>(`/dashboard/volantini-in-corso${buildQueryString(filter)}`);
            setVolantiniInCorso(data);
            segnaErrore("inCorso", false);
        } catch (error) {
            console.error("Errore caricamento volantini in corso:", error);
            segnaErrore("inCorso", true);
        } finally {
            setLoadingInCorso(false);
        }
    }, [buildQueryString, segnaErrore]);

    const fetchVolantiniInLavorazione = useCallback(async (filter: CardFilter) => {
        setLoadingInLavorazione(true);
        try {
            const data = await ServerCall.get<VolantiniInLavorazione>(`/dashboard/volantini-in-lavorazione${buildQueryString(filter)}`);
            setVolantiniInLavorazione(data);
            segnaErrore("inLavorazione", false);
        } catch (error) {
            console.error("Errore caricamento volantini in lavorazione:", error);
            segnaErrore("inLavorazione", true);
        } finally {
            setLoadingInLavorazione(false);
        }
    }, [buildQueryString, segnaErrore]);

    const fetchVolantiniPubblicatiInLavorazione = useCallback(async (filter: CardFilter) => {
        setLoadingPubblicatiInLavorazione(true);
        try {
            const data = await ServerCall.get<VolantiniPubblicatiInLavorazione>(`/dashboard/volantini-pubblicati-in-lavorazione${buildQueryString(filter)}`);
            setVolantiniPubblicatiInLavorazione(data);
            segnaErrore("pubblicatiInLavorazione", false);
        } catch (error) {
            console.error("Errore caricamento volantini pubblicati in lavorazione:", error);
            segnaErrore("pubblicatiInLavorazione", true);
        } finally {
            setLoadingPubblicatiInLavorazione(false);
        }
    }, [buildQueryString, segnaErrore]);

    const fetchStoricoVolantini = useCallback(async (filter: CardFilter) => {
        setLoadingStorico(true);
        try {
            const data = await ServerCall.get<StoricoVolantini>(`/dashboard/storico-volantini${buildQueryString(filter, { limit: "10" })}`);
            setStoricoVolantini(data);
            segnaErrore("storico", false);
        } catch (error) {
            console.error("Errore caricamento storico volantini:", error);
            segnaErrore("storico", true);
        } finally {
            setLoadingStorico(false);
        }
    }, [buildQueryString, segnaErrore]);

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

    // Incorporata (Superadmin) la dashboard non ha intestazione propria
    const contenitore = (contenuto: ReactNode) =>
        embedded ? (
            contenuto
        ) : (
            <Pagina titolo={TITOLO_PAGINA} descrizione={DESCRIZIONE_PAGINA}>
                {contenuto}
            </Pagina>
        );

    const errore = (onRiprova: () => void, inCaricamento: boolean) => (
        <PageError
            compatta
            titolo="Volantini non caricati"
            motivo={MOTIVO_ERRORE}
            onRiprova={inCaricamento ? undefined : onRiprova}
        />
    );

    if (initialLoading) {
        return contenitore(
            <div role="status" className="grid grid-cols-12 gap-6">
                <span className="sr-only">Caricamento dei volantini…</span>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="col-span-12 box box--stacked p-5 xl:col-span-6">
                        <VolantiniSkeleton />
                    </div>
                ))}
            </div>
        );
    }

    return contenitore(
        <div className="grid grid-cols-12 gap-6">
            <Sezione
                className="col-span-12 xl:col-span-6"
                icona="BookOpen"
                titolo="Volantini in validità"
                descrizione={
                    <>
                        Panoramica dei volantini pubblicati
                        <span className="block text-xs text-slate-400">Aggiornato {formatData(new Date())}</span>
                    </>
                }
            >
                {errori.inCorso ? (
                    errore(() => fetchVolantiniInCorso(filterInCorso), loadingInCorso)
                ) : volantiniInCorso ? (
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
            </Sezione>

            <Sezione
                className="col-span-12 xl:col-span-6"
                icona="CircleCheck"
                titolo="Prossimi volantini"
                descrizione={
                    <>
                        Pubblicati ma in attesa della promo ad entrare in validità
                        <span className="block text-xs text-slate-400">Pronti per la pubblicazione</span>
                    </>
                }
            >
                {errori.pubblicatiInLavorazione ? (
                    errore(
                        () => fetchVolantiniPubblicatiInLavorazione(filterPubblicatiInLavorazione),
                        loadingPubblicatiInLavorazione
                    )
                ) : volantiniPubblicatiInLavorazione ? (
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
            </Sezione>

            <Sezione
                className="col-span-12 xl:col-span-6"
                icona="Pencil"
                titolo="Volantini in lavorazione"
                descrizione={
                    <>
                        Volantini in produzione e revisioni aperte
                        <span className="block text-xs text-slate-400">Workflow creativo in tempo reale</span>
                    </>
                }
            >
                {errori.inLavorazione ? (
                    errore(() => fetchVolantiniInLavorazione(filterInLavorazione), loadingInLavorazione)
                ) : volantiniInLavorazione ? (
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
            </Sezione>

            <Sezione
                className="col-span-12 xl:col-span-6"
                icona="History"
                titolo="Storico volantini"
                descrizione="Ultimi 10 volantini pubblicati"
            >
                {errori.storico ? (
                    errore(() => fetchStoricoVolantini(filterStorico), loadingStorico)
                ) : (
                    <StoricoVolantiniContent
                        data={storicoVolantini}
                        isLoading={loadingStorico}
                        aree={aree}
                        canali={canali}
                        filter={filterStorico}
                        onFilterChange={handleFilterStoricoChange}
                    />
                )}
            </Sezione>
        </div>
    );
};

export default Dashboard3;
