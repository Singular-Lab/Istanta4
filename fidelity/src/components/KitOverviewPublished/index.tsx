import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { FlyerInsights } from "@/components/FlyerInsights";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { useProductionTimer } from "@/hooks/useProductionTimer";
import { useFetchFlyerInsights, useFetchFlyerInsightsConfig } from "@/query/query";
import { resolveColor } from "@/utils/flyerInsightsHelpers";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { FC, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from "../../../lib/enums";
import { FileItemKit, OggettoTipiDiExport, RUNTIME_KIT_MONGO } from "../../../lib/types";
import ReferenzeInVolantinoBox from "../ReferenzeInVolantinoBox";

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.locale("it");

interface KitOverviewPublishedProps {
    lavorazione: RUNTIME_KIT_MONGO;
    filesData?: FileItemKit[];
    isLoadingFiles?: boolean;
    exportTypes: string[];
    tipiDiExportInKit: OggettoTipiDiExport[];
    onDownloadZip?: () => void;
    isDownloading?: boolean;
}

// Stat card component
interface StatCardProps {
    icon: string;
    iconColor: string;
    iconBg: string;
    value: string | number;
    label: string;
    sublabel?: string;
    isLive?: boolean;
}

const StatCard: FC<StatCardProps> = ({ icon, iconColor, iconBg, value, label, sublabel, isLive }) => (
    <div className={clsx(
        "flex items-center gap-3 p-4 rounded-xl border bg-white",
        isLive ? "border-theme-1/30 ring-2 ring-theme-1/10" : "border-slate-200"
    )}>
        <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", iconBg)}>
            <Lucide icon={icon as any} className={clsx("h-6 w-6", iconColor)} />
        </div>
        <div className="min-w-0">
            <p className={clsx(
                "text-2xl font-bold truncate",
                isLive ? "text-theme-1" : "text-slate-800"
            )}>{value}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
                {label}
                {isLive && (
                    <span className="relative flex h-2 w-2 ml-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-1 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-theme-1"></span>
                    </span>
                )}
            </p>
            {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
        </div>
    </div>
);

// Timeline item component
interface TimelineItemProps {
    icon: string;
    iconColor: string;
    iconBg: string;
    title: string;
    description?: string;
    timestamp: string | Date;
    isLast?: boolean;
}

const TimelineItem: FC<TimelineItemProps> = ({ icon, iconColor, iconBg, title, description, timestamp, isLast }) => (
    <div className="flex gap-3">
        <div className="flex flex-col items-center">
            <div className={clsx("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", iconBg)}>
                <Lucide icon={icon as any} className={clsx("h-4 w-4", iconColor)} />
            </div>
            {!isLast && <div className="w-px h-full bg-slate-200 my-1" />}
        </div>
        <div className={clsx("pb-4", isLast && "pb-0")}>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            <p className="text-[10px] text-slate-400 mt-1">
                {dayjs(timestamp).format("DD MMM YYYY, HH:mm")}
            </p>
        </div>
    </div>
);

// Badge component
interface InfoBadgeProps {
    icon: string;
    label: string;
    value: string;
    variant?: "default" | "primary" | "info" | "success";
}

const InfoBadge: FC<InfoBadgeProps> = ({ icon, label, value, variant = "default" }) => {
    const variants = {
        default: "border-slate-200 bg-white text-slate-600",
        primary: "border-theme-1/20 bg-theme-1/5 text-theme-1",
        info: "border-info/20 bg-info/5 text-info",
        success: "border-success/20 bg-success/5 text-success"
    };

    return (
        <div className={clsx(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
            variants[variant]
        )}>
            <Lucide icon={icon as any} className="h-4 w-4 opacity-70" />
            <div>
                <p className="text-[10px] uppercase tracking-wider opacity-60">{label}</p>
                <p className="text-sm font-semibold">{value}</p>
            </div>
        </div>
    );
};

const KitOverviewPublished: FC<KitOverviewPublishedProps> = ({
    lavorazione,
    filesData,
    isLoadingFiles = false,
    exportTypes,
    tipiDiExportInKit,
    onDownloadZip,
    isDownloading = false
}) => {
    const [previewState, setPreviewState] = useState<{
        imageUrl: string;
        totalPages: number;
        initialPage: number;
    } | null>(null);
    const [showAllFiles, setShowAllFiles] = useState(false);

    // Fetch flyer insights
    const { data: flyerInsights, isLoading: isLoadingInsights } = useFetchFlyerInsights(
        lavorazione.guidId
    );
    const { data: insightsConfig } = useFetchFlyerInsightsConfig();

    const isPromoFinalState = (stato?: STATO_PROMO | null) =>
        stato === STATO_PROMO.VALIDA ||
        stato === STATO_PROMO.VALIDA_CON_ERRORI ||
        stato === STATO_PROMO.ARCHIVIATA;

    // Group referenze by reparto
    const referenzePerReparto = useMemo(() => {
        if (!flyerInsights?.referenze || !flyerInsights?.riepilogoReparti) return [];

        const grouped = new Map<string, {
            sigla: string;
            descrizione: string;
            referenze: typeof flyerInsights.referenze;
        }>();

        // Initialize groups from reparti
        flyerInsights.riepilogoReparti.forEach(rep => {
            grouped.set(rep.sigla, {
                sigla: rep.sigla,
                descrizione: rep.descrizione,
                referenze: []
            });
        });

        // Group referenze
        flyerInsights.referenze.forEach(ref => {
            const reparto = ref.reparto || 'ALTRO';
            if (!grouped.has(reparto)) {
                grouped.set(reparto, {
                    sigla: reparto,
                    descrizione: ref.descrizioneReparto || reparto,
                    referenze: []
                });
            }
            grouped.get(reparto)!.referenze.push(ref);
        });

        // Filter out empty groups and sort by count
        return Array.from(grouped.values())
            .filter(g => g.referenze.length > 0)
            .sort((a, b) => b.referenze.length - a.referenze.length);
    }, [flyerInsights?.referenze, flyerInsights?.riepilogoReparti]);

    // Calculate production duration with live timer
    const { formattedDuration: productionDuration, isLive: isTimerLive } = useProductionTimer({
        createdAt: lavorazione.createdAt,
        updatedAt: lavorazione.updatedAt,
        statoLavorazione: lavorazione.stato_lavorazione || STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
    });

    // Calculate file stats by export type
    const fileStats = useMemo(() => {
        const files: FileItemKit[] = filesData || lavorazione.files || [];
        const byExportType: Record<string, { count: number; pages: number; files: FileItemKit[] }> = {};

        files.forEach((file: FileItemKit) => {
            const exportInfo = tipiDiExportInKit.find(t => t.tipoDiExportGuidID === file.tipo_export);
            const codice = exportInfo?.codice || file.tipo_export_codice || "ALTRO";

            if (!byExportType[codice]) {
                byExportType[codice] = { count: 0, pages: 0, files: [] };
            }
            byExportType[codice].count++;
            byExportType[codice].pages += file.pages || 0;
            byExportType[codice].files.push(file);
        });

        return {
            total: files.length,
            totalPages: files.reduce((acc: number, f: FileItemKit) => acc + (f.pages || 0), 0),
            byExportType
        };
    }, [filesData, lavorazione.files, tipiDiExportInKit]);

    // Build timeline from file logs
    const timeline = useMemo(() => {
        const events: Array<{
            type: "created" | "upload" | "accepted" | "rejected" | "published";
            timestamp: Date;
            title: string;
            description?: string;
        }> = [];

        // Kit creation
        if (lavorazione.createdAt) {
            events.push({
                type: "created",
                timestamp: new Date(lavorazione.createdAt),
                title: "Kit creato",
                description: "Inizio lavorazione"
            });
        }

        // File logs
        const files: FileItemKit[] = filesData || lavorazione.files || [];
        files.forEach((file: FileItemKit) => {
            if (file.log?.logs) {
                file.log.logs.forEach((log: { azione: string; data_notifica: Date; utente_notifica?: string, messaggio: string }) => {
                    let type: "upload" | "accepted" | "rejected" = "upload";
                    if (log.azione === "Accettato") type = "accepted";
                    else if (log.azione === "Rifiutato") type = "rejected";
                    else if (log.azione === "Upload") type = "upload";

                    events.push({
                        type,
                        timestamp: new Date(log.data_notifica),
                        title: log.azione,
                        description: `${log.messaggio}`
                    });
                });
            }
        });

        // Kit published
        if (lavorazione.updatedAt) {
            events.push({
                type: "published",
                timestamp: new Date(lavorazione.updatedAt),
                title: "Kit pubblicato",
                description: "Pubblicazione completata"
            });
        }

        // Sort by timestamp descending (most recent first)
        return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
    }, [lavorazione, filesData]);

    const getTimelineIcon = (type: string) => {
        switch (type) {
            case "created": return { icon: "Plus", color: "text-info", bg: "bg-info/10" };
            case "upload": return { icon: "Upload", color: "text-slate-600", bg: "bg-slate-100" };
            case "accepted": return { icon: "Check", color: "text-success", bg: "bg-success/10" };
            case "rejected": return { icon: "X", color: "text-danger", bg: "bg-danger/10" };
            case "published": return { icon: "Rocket", color: "text-theme-1", bg: "bg-theme-1/10" };
            default: return { icon: "Circle", color: "text-slate-400", bg: "bg-slate-100" };
        }
    };

    const openPreview = (imageUrl: string, totalPages: number, initialPage: number) => {
        setPreviewState({ imageUrl, totalPages, initialPage });
    };

    const closePreview = () => setPreviewState(null);

    // Get thumbnail URL for a file

    if (isLoadingFiles) {
        return (
            <div className="space-y-6">
                <Skeleton height="200px" className="rounded-xl" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} height="100px" className="rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-success via-success/90 to-success/80 p-8">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2Mkg0di0yaDMyem0wLTR2Mkg0di0yaDMyem0wLTR2Mkg0di0yaDMyem0wLTR2Mkg0VjhoMzJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />
                <div className="relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                                <Lucide icon="FileCheck" className="h-10 w-10 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">
                                    {lavorazione.titolo}
                                </h2>
                                <p className="text-white/80 text-sm">
                                    Kit pubblicato con successo
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                                        <Lucide icon="Calendar" className="h-3 w-3" />
                                        {dayjs(lavorazione.updatedAt).format("DD MMMM YYYY, HH:mm")}
                                    </span>
                                    {productionDuration && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                                            <Lucide icon="Clock" className="h-3 w-3" />
                                            Tempo produzione: {productionDuration}
                                            {isTimerLive && (
                                                <span className="relative flex h-2 w-2 ml-1">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {lavorazione.idPromo && (
                                <Link to={`/${isPromoFinalState(lavorazione.promo?.stato) ? 'promozioni/storico' : 'promozioni/in-corso'}/dettagli/${lavorazione.idPromo}`}>
                                    <Button
                                        variant="outline-secondary"
                                        className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                                    >
                                        <Lucide icon="ArrowLeft" className="h-4 w-4 mr-2" />
                                        Vai alla Promozione
                                    </Button>
                                </Link>
                            )}
                            {onDownloadZip && (
                                <Button
                                    variant="primary"
                                    className="bg-white text-success hover:bg-white/90 shadow-lg"
                                    onClick={onDownloadZip}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <Lucide icon="Loader" className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Lucide icon="Download" className="h-4 w-4 mr-2" />
                                    )}
                                    Scarica Tutto (ZIP)
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon="Files"
                    iconColor="text-theme-1"
                    iconBg="bg-theme-1/10"
                    value={fileStats.total}
                    label="File pubblicati"
                    sublabel={`${fileStats.totalPages} pagine totali`}
                />
                <StatCard
                    icon="Layers"
                    iconColor="text-info"
                    iconBg="bg-info/10"
                    value={exportTypes.length}
                    label="Tipi di export"
                    sublabel={exportTypes.join(", ")}
                />
                <StatCard
                    icon="Package"
                    iconColor="text-success"
                    iconBg="bg-success/10"
                    value={flyerInsights?.totaleReferenze || 0}
                    label="Referenze"
                    sublabel={flyerInsights ? `${flyerInsights.totalePagine} pagine analizzate` : undefined}
                />
                <StatCard
                    icon="Clock"
                    iconColor={isTimerLive ? "text-theme-1" : "text-warning"}
                    iconBg={isTimerLive ? "bg-theme-1/10" : "bg-warning/10"}
                    value={productionDuration || "-"}
                    label={isTimerLive ? "Tempo (in corso)" : "Tempo produzione"}
                    sublabel={lavorazione.createdAt ? `Dal ${dayjs(lavorazione.createdAt).format("DD/MM")}` : undefined}
                    isLive={isTimerLive}
                />
            </div>

            {/* Info Badges */}
            <div className="flex flex-wrap gap-3">
                {lavorazione.nomeArea && (
                    <InfoBadge icon="MapPin" label="Area" value={lavorazione.nomeArea} variant="primary" />
                )}
                {lavorazione.nomeCanale && (
                    <InfoBadge icon="Radio" label="Canale" value={lavorazione.nomeCanale} variant="info" />
                )}
                {lavorazione.tipo && (
                    <InfoBadge icon="Cpu" label="Tipo Kit" value={lavorazione.tipo} />
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Files and Insights */}
                <div className="lg:col-span-2 space-y-6">
                    {/* FlyerInsights */}
                    {(flyerInsights || isLoadingInsights) && (
                        <div className="box box--stacked p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                                    <Lucide icon="Activity" className="h-5 w-5 text-info" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800">Analisi Volantino</h3>
                                    <p className="text-xs text-slate-500">Statistiche referenze e distribuzione</p>
                                </div>
                            </div>
                            <FlyerInsights
                                insights={flyerInsights || null}
                                isLoading={isLoadingInsights}
                                exportCodes={exportTypes}
                            />
                        </div>
                    )}



                </div >
                {/* Right Column - Timeline */}
                < div className="space-y-6" >
                    {/* Activity Timeline */}
                    <div className="box box--stacked p-6" >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                                <Lucide icon="History" className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">Attività Recenti</h3>
                                <p className="text-xs text-slate-500">Cronologia lavorazione</p>
                            </div>
                        </div>

                        {
                            timeline.length > 0 ? (
                                <div className="space-y-0">
                                    {timeline.map((event, idx) => {
                                        const { icon, color, bg } = getTimelineIcon(event.type);
                                        return (
                                            <TimelineItem
                                                key={`${event.type}-${idx}`}
                                                icon={icon}
                                                iconColor={color}
                                                iconBg={bg}
                                                title={event.title}
                                                description={event.description}
                                                timestamp={event.timestamp}
                                                isLast={idx === timeline.length - 1}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <EmptyState
                                    icon="Clock"
                                    title="Nessuna attività"
                                    description="Non sono disponibili informazioni sulla cronologia."
                                />
                            )
                        }
                    </div >

                    {/* Quick Info */}
                    < div className="box box--stacked p-6" >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                                <Lucide icon="Info" className="h-5 w-5 text-info" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">Informazioni Kit</h3>
                                <p className="text-xs text-slate-500">Dettagli configurazione</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <span className="text-sm text-slate-500">ID Kit</span>
                                <span className="text-sm font-mono text-slate-700 truncate max-w-[150px]" title={lavorazione.guidId}>
                                    {lavorazione.guidId.slice(0, 8)}...
                                </span>
                            </div>
                            {lavorazione.codiceArea && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Codice Area</span>
                                    <span className="text-sm font-semibold text-slate-700">{lavorazione.codiceArea}</span>
                                </div>
                            )}
                            {lavorazione.codiceCanale && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Codice Canale</span>
                                    <span className="text-sm font-semibold text-slate-700">{lavorazione.codiceCanale}</span>
                                </div>
                            )}
                            {lavorazione.quantitaCopie && (
                                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-500">Quantità Copie</span>
                                    <span className="text-sm font-semibold text-slate-700">{lavorazione.quantitaCopie.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-500">Data Creazione</span>
                                <span className="text-sm font-semibold text-slate-700">
                                    {lavorazione.createdAt ? dayjs(lavorazione.createdAt).format("DD/MM/YYYY Alle HH:mm") : "-"}
                                </span>
                            </div>
                        </div>
                    </div >
                </div >
                <ReferenzeInVolantinoBox
                    exportTypes={exportTypes}
                    referenzePerReparto={referenzePerReparto}
                    flyerInsights={flyerInsights!}
                    insightsConfig={insightsConfig}
                    resolveColor={resolveColor}
                />
                <div className="box box--stacked p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme-1/10">
                                <Lucide icon="FolderOpen" className="h-5 w-5 text-theme-1" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-800">File Pubblicati</h3>
                                <p className="text-xs text-slate-500">{fileStats.total} file totali</p>
                            </div>
                        </div>
                        {fileStats.total > 3 && (
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => setShowAllFiles(!showAllFiles)}
                            >
                                {showAllFiles ? "Mostra meno" : "Mostra tutti"}
                                <Lucide
                                    icon={showAllFiles ? "ChevronUp" : "ChevronDown"}
                                    className="h-4 w-4 ml-1"
                                />
                            </Button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {Object.entries(fileStats.byExportType).map(([exportCode, stats]) => (
                            <div key={exportCode} className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Lucide icon="FileStack" className="h-4 w-4 text-theme-1" />
                                        <span className="text-sm font-semibold text-slate-800">{exportCode}</span>
                                        <span className="text-xs text-slate-500">
                                            ({stats.count} file, {stats.pages} pagine)
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    {(showAllFiles ? stats.files : stats.files.slice(0, 2)).map((file, idx) => {
                                        const thumbnailUrl = file.url
                                        const hasPreview = thumbnailUrl && file.pages && file.pages > 0;

                                        return (
                                            <div key={`${file.id}-${idx}`} className="rounded-lg border border-slate-200 overflow-hidden">
                                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Lucide icon="File" className="h-4 w-4 text-slate-400 shrink-0" />
                                                        <span className="text-sm font-medium text-slate-700 truncate">
                                                            {file.nome}
                                                        </span>
                                                        {file.pages && (
                                                            <span className="text-xs text-slate-500 shrink-0">
                                                                ({file.pages} pag)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {file.url && (
                                                            <Button
                                                                as="a"
                                                                href={file.url_download}
                                                                target="_blank"
                                                                variant="outline-primary"
                                                                size="sm"
                                                                className="px-2"
                                                            >
                                                                <Lucide icon="Download" className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!showAllFiles && stats.files.length > 2 && (
                                        <p className="text-xs text-slate-500 text-center py-2">
                                            +{stats.files.length - 2} altri file
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {Object.keys(fileStats.byExportType).length === 0 && (
                            <EmptyState
                                icon="FileX"
                                title="Nessun file"
                                description="Non ci sono file pubblicati per questo kit."
                            />
                        )}
                    </div>
                </div>
            </div >

            {
                previewState && (
                    <PreviewImmaginePdf
                        imageUrl={previewState.imageUrl}
                        totalPages={previewState.totalPages}
                        initialPage={previewState.initialPage}
                        onClose={closePreview}
                    />
                )
            }
        </div >
    );
};

export { KitOverviewPublished };
export default KitOverviewPublished;
