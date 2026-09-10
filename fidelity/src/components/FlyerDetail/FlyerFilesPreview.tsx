import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import EmptyState from "@/components/EmptyState";
import { PdfMiniSlideshow } from "@/components/PdfMiniSlideshow";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { FlyerFilePreview } from "@/types/storicoVolantini";
import { FC, useState } from "react";

interface FlyerFilesPreviewProps {
    files: FlyerFilePreview[];
}

const badgeClass = "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600";

const FlyerFilesPreview: FC<FlyerFilesPreviewProps> = ({ files }) => {
    const [previewState, setPreviewState] = useState<{ imageUrl: string; totalPages: number; initialPage: number } | null>(null);

    const openPreview = (imageUrl: string, totalPages: number, initialPage: number) => {
        setPreviewState({ imageUrl, totalPages, initialPage });
    };

    const closePreview = () => setPreviewState(null);

    if (!files || files.length === 0) {
        return (
            <div className="rounded-[0.8rem] border border-dashed border-slate-200 bg-white/70">
                <EmptyState
                    icon="FileText"
                    title="Nessun file disponibile"
                    description="Quando i file saranno pronti, troverai qui le anteprime di tutte le pagine."
                />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                {files.map((file) => {
                    // Usa thumbnailUrl come base URL per PdfMiniSlideshow
                    // Il componente appenderà &page=X per ogni pagina
                    const hasPreview = file.thumbnailUrl && file.pages > 0;

                    return (
                        <div
                            key={file.id}
                            className="rounded-[0.8rem] border border-slate-200/70 bg-white/90 overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                        >
                            {/* Header file */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-theme-1/10">
                                        <Lucide icon="FileText" className="h-5 w-5 text-theme-1" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{file.nome}</p>
                                        {file.nomeOriginale && (
                                            <p className="text-[11px] text-slate-400 truncate">{file.nomeOriginale}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-slate-500">
                                        {file.tipoExport && (
                                            <span className={badgeClass}>
                                                <Lucide icon="Layers" className="w-3 h-3" />
                                                {file.tipoExportCodice || file.tipoExport}
                                            </span>
                                        )}
                                        {file.mime && (
                                            <span className={badgeClass}>
                                                <Lucide icon="File" className="w-3 h-3" />
                                                {file.mime}
                                            </span>
                                        )}
                                        <span className={badgeClass}>
                                            <Lucide icon="BookOpen" className="w-3 h-3" />
                                            {file.pages} pagine
                                        </span>
                                    </div>
                                    {file.downloadUrl && (
                                        <Button
                                            as="a"
                                            href={file.downloadUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outline-primary"
                                            size="sm"
                                            className="gap-1.5"
                                        >
                                            <Lucide icon="Download" className="w-3.5 h-3.5" />
                                            Scarica
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Anteprima file con PdfMiniSlideshow */}
                            <div className="p-4">
                                {hasPreview ? (
                                    <PdfMiniSlideshow
                                        imageUrl={file.thumbnailUrl!}
                                        totalPages={file.pages}
                                        variant="info"
                                        onPageClick={(currentPage) => openPreview(file.thumbnailUrl!, file.pages, currentPage)}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-slate-400">
                                        <Lucide icon="ImageOff" className="h-5 w-5 mr-2" />
                                        <span className="text-sm">Anteprime non disponibili per questo file</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Preview a schermo intero */}
            {previewState && (
                <PreviewImmaginePdf
                    imageUrl={previewState.imageUrl}
                    totalPages={previewState.totalPages}
                    initialPage={previewState.initialPage}
                    onClose={closePreview}
                />
            )}
        </>
    );
};

export default FlyerFilesPreview;
