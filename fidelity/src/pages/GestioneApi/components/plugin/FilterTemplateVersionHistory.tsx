import Button from "@/components/Base/Button";
import Dialog from "@/components/Base/Headless/Dialog";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import EmptyState from "@/components/EmptyState";
import { formatDataOra } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ServerCall } from "../../../../../lib/server_call";
import type {
    FilterTemplateDTO,
    FilterTemplateVersionDTO,
    FilterTemplateVersionHistoryDTO
} from "../../../../../server/core/dto";

interface FilterTemplateVersionHistoryProps {
    slug: string;
    isOpen: boolean;
    onClose: () => void;
    onRestore: (version: number) => Promise<void>;
    isRestoring: boolean;
}

interface HistoryResponse {
    success: boolean;
    data: FilterTemplateVersionHistoryDTO;
}

interface TemplateResponse {
    success: boolean;
    data: FilterTemplateDTO;
}

const TONO_BADGE: Record<string, TonoStato> = {
    current: "success",
    deleted: "danger",
    inactive: "warning"
};

export default function FilterTemplateVersionHistory({
    slug,
    isOpen,
    onClose,
    onRestore,
    isRestoring
}: FilterTemplateVersionHistoryProps) {
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
    const [previewData, setPreviewData] = useState<FilterTemplateDTO | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Solo rotte della sessione: la chiave API non è più disponibile nel browser
    const queryKey = useMemo(() => ["filter-template-history", slug], [slug]);

    const { data, isLoading, isError, isFetching, refetch } = useQuery({
        queryKey,
        enabled: isOpen && Boolean(slug),
        queryFn: async (): Promise<FilterTemplateVersionHistoryDTO> => {
            const response = await ServerCall.get<HistoryResponse>(
                `/external/filter-templates/slug/${slug}/versions`
            );
            return response.data;
        }
    });

    useEffect(() => {
        if (!isOpen) {
            setSelectedVersion(null);
            setPreviewData(null);
            setPreviewError(null);
        }
    }, [isOpen]);

    const handleViewVersion = async (versione: FilterTemplateVersionDTO) => {
        setSelectedVersion(versione.version);
        setIsPreviewLoading(true);
        setPreviewError(null);

        try {
            // Ogni versione è una riga a sé: la si legge per id con la sessione. La rotta
            // per slug è quella pubblica del plugin (token effimero o API key).
            const response = await ServerCall.get<TemplateResponse>(
                `/external/filter-templates/${versione.id_filter_template}`
            );
            setPreviewData(response.data);
        } catch (error: any) {
            setPreviewData(null);
            setPreviewError(error?.message || "Impossibile caricare la versione selezionata");
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleRestore = async (version: number) => {
        try {
            await onRestore(version);
            await refetch();
            setSelectedVersion(null);
            setPreviewData(null);
            setPreviewError(null);
        } catch (error) {
            // Le notifiche vengono gestite a livello superiore
            console.error('Errore durante il ripristino della versione', error);
        }
    };

    const versions = data?.versions || [];

    return (
        <Dialog open={isOpen} onClose={onClose} size="xl" centered>
            <Dialog.Panel>
                <Dialog.Title>
                    Cronologia versioni
                    <span className="truncate font-mono text-sm font-normal text-slate-500">{slug}</span>
                </Dialog.Title>

                <div className="grid gap-6 p-5 lg:grid-cols-2">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="title-card">Versioni disponibili</h3>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                type="button"
                                onClick={() => refetch()}
                                disabled={isLoading}
                                loading={isFetching && !isLoading}
                            >
                                {!(isFetching && !isLoading) && <Lucide icon="RefreshCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                                Aggiorna
                            </Button>
                        </div>

                        <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                            {isLoading && (
                                <div className="flex justify-center py-8">
                                    <Spinner etichetta="Caricamento cronologia…" />
                                </div>
                            )}

                            {!isLoading && isError && (
                                <PageError
                                    compatta
                                    titolo="Cronologia non caricata"
                                    motivo="Il servizio non ha restituito le versioni del template."
                                    onRiprova={() => refetch()}
                                />
                            )}

                            {!isLoading && !isError && versions.length === 0 && (
                                <EmptyState
                                    compatta
                                    icon="FileClock"
                                    title="Nessuna versione disponibile"
                                    description="Questo template non ha ancora versioni salvate."
                                />
                            )}

                            {versions.map((version: FilterTemplateVersionDTO) => {
                                const badges: Array<{ label: string; key: string }> = [];
                                if (version.is_latest && !version.deleted_at) {
                                    badges.push({ label: "Attuale", key: "current" });
                                }
                                if (version.deleted_at) {
                                    badges.push({ label: "Eliminato", key: "deleted" });
                                }
                                if (!version.is_active) {
                                    badges.push({ label: "Inattivo", key: "inactive" });
                                }

                                const createdAt = formatDataOra(version.createdat);
                                const disableRestore = version.is_latest && !version.deleted_at;
                                const isSelected = selectedVersion === version.version;

                                return (
                                    <div
                                        key={version.id_filter_template}
                                        className={`rounded-card border px-4 py-3 transition hover:border-primary/40 ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200'
                                            }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-sm font-semibold text-slate-800">Versione v{version.version}</h4>
                                                <p className="text-xs tabular-nums text-slate-500">Creata il {createdAt}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {badges.map((badge) => (
                                                    <StatusBadge key={badge.key} tono={TONO_BADGE[badge.key]} etichetta={badge.label} />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={isSelected ? "primary" : "outline-secondary"}
                                                onClick={() => handleViewVersion(version)}
                                            >
                                                <Lucide icon="Eye" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Visualizza
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline-secondary"
                                                disabled={disableRestore || isRestoring}
                                                onClick={() => handleRestore(version.version)}
                                            >
                                                <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Ripristina
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-card border border-slate-200 p-4">
                        <div className="border-b border-slate-100 pb-3">
                            <p className="title-eyebrow">Anteprima versione</p>
                            <h3 className="title-card">
                                {selectedVersion ? `v${selectedVersion}` : "Seleziona una versione"}
                            </h3>
                        </div>

                        <div className="mt-4 h-[22rem] rounded-card bg-slate-50 p-4">
                            {isPreviewLoading && (
                                <div className="flex h-full items-center justify-center">
                                    <Spinner etichetta="Caricamento versione selezionata…" />
                                </div>
                            )}

                            {!isPreviewLoading && previewError && (
                                <PageError compatta titolo="Versione non caricata" motivo={previewError} />
                            )}

                            {!isPreviewLoading && !previewError && previewData && (
                                <pre className="h-full overflow-y-auto rounded-control bg-white p-3 text-xs text-slate-700">
                                    {JSON.stringify(previewData, null, 2)}
                                </pre>
                            )}

                            {!isPreviewLoading && !previewError && !previewData && (
                                <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                                    Seleziona una versione per visualizzare i dettagli completi.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <Dialog.Footer>
                    <Button variant="outline-secondary" onClick={onClose} type="button">
                        Chiudi
                    </Button>
                </Dialog.Footer>
            </Dialog.Panel>
        </Dialog>
    );
}
