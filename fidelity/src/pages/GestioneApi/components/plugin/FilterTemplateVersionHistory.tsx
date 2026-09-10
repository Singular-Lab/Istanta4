import Button from "@/components/Base/Button";
import Dialog from "@/components/Base/Headless/Dialog";
import Lucide from "@/components/Base/Lucide";
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
    apiKey?: string | null;
}

interface HistoryResponse {
    success: boolean;
    data: FilterTemplateVersionHistoryDTO;
}

interface TemplateResponse {
    success: boolean;
    data: FilterTemplateDTO;
}

const badgeStyles: Record<string, string> = {
    current: "bg-emerald-100 text-emerald-700",
    deleted: "bg-rose-100 text-rose-700",
    inactive: "bg-amber-100 text-amber-700"
};

export default function FilterTemplateVersionHistory({
    slug,
    isOpen,
    onClose,
    onRestore,
    isRestoring,
    apiKey
}: FilterTemplateVersionHistoryProps) {
    const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
    const [previewData, setPreviewData] = useState<FilterTemplateDTO | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const authHeaders = useMemo(() => (apiKey ? { 'x-api-key': apiKey } : undefined), [apiKey]);
    const queryKey = useMemo(() => ["filter-template-history", slug, apiKey], [slug, apiKey]);

    const { data, isLoading, refetch } = useQuery({
        queryKey,
        enabled: isOpen && Boolean(slug),
        queryFn: async (): Promise<FilterTemplateVersionHistoryDTO> => {
            const response = await ServerCall.get<HistoryResponse>(
                `/external/filter-templates/slug/${slug}/versions`,
                undefined,
                authHeaders
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

    const handleViewVersion = async (version: number) => {
        setSelectedVersion(version);
        setIsPreviewLoading(true);
        setPreviewError(null);

        try {
            const response = await ServerCall.get<TemplateResponse>(
                `/external/filter-templates/slug/${slug}?version=${version}`,
                undefined,
                authHeaders
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
            <Dialog.Panel className="bg-white shadow-2xl">
                <Dialog.Title>
                    <div className="flex w-full items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Cronologia versioni</p>
                            <h3 className="text-lg font-semibold text-slate-900">{slug}</h3>
                        </div>
                        <Button variant="outline-secondary" onClick={onClose} type="button">
                            <Lucide icon="X" className="mr-2 h-4 w-4" /> Chiudi
                        </Button>
                    </div>
                </Dialog.Title>

                <div className="grid gap-6 p-6 lg:grid-cols-2">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-600">Versioni disponibili</h4>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                type="button"
                                onClick={() => refetch()}
                                disabled={isLoading}
                            >
                                <Lucide icon="RefreshCcw" className="mr-2 h-4 w-4" /> Aggiorna
                            </Button>
                        </div>

                        <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                            {isLoading && (
                                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                                    Caricamento cronologia...
                                </div>
                            )}

                            {!isLoading && versions.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                                    Nessuna versione disponibile per questo template.
                                </div>
                            )}

                            {versions.map((version: FilterTemplateVersionDTO) => {
                                const badges: Array<{ label: string; key: string }> = [];
                                if (version.is_latest && !version.deleted_at) {
                                    badges.push({ label: "ATTUALE", key: "current" });
                                }
                                if (version.deleted_at) {
                                    badges.push({ label: "ELIMINATO", key: "deleted" });
                                }
                                if (!version.is_active) {
                                    badges.push({ label: "INATTIVO", key: "inactive" });
                                }

                                const createdAt = new Date(version.createdat).toLocaleString('it-IT');
                                const disableRestore = version.is_latest && !version.deleted_at;
                                const isSelected = selectedVersion === version.version;

                                return (
                                    <div
                                        key={version.id_filter_template}
                                        className={`rounded-xl border px-4 py-3 transition hover:border-primary/40 ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200'
                                            }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">Versione v{version.version}</p>
                                                <p className="text-xs text-slate-500">Creata il {createdAt}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {badges.map((badge) => (
                                                    <span
                                                        key={badge.key}
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeStyles[badge.key]}`}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={isSelected ? "primary" : "outline-secondary"}
                                                onClick={() => handleViewVersion(version.version)}
                                            >
                                                <Lucide icon="Eye" className="mr-2 h-4 w-4" /> Visualizza
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline-primary"
                                                disabled={disableRestore || isRestoring}
                                                onClick={() => handleRestore(version.version)}
                                            >
                                                <Lucide icon="RotateCcw" className="mr-2 h-4 w-4" /> Ripristina
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">Anteprima versione</p>
                                {selectedVersion ? (
                                    <h4 className="text-sm font-semibold text-slate-700">v{selectedVersion}</h4>
                                ) : (
                                    <h4 className="text-sm font-semibold text-slate-500">Seleziona una versione</h4>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 h-[22rem] rounded-xl bg-slate-50 p-4">
                            {isPreviewLoading && (
                                <p className="text-sm text-slate-500">Caricamento versione selezionata...</p>
                            )}

                            {!isPreviewLoading && previewError && (
                                <p className="text-sm text-rose-600">{previewError}</p>
                            )}

                            {!isPreviewLoading && !previewError && previewData && (
                                <pre className="h-full overflow-y-auto rounded-lg bg-white p-3 text-xs text-slate-700">
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
            </Dialog.Panel>
        </Dialog>
    );
}
