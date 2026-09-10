import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { FC, useMemo, useState } from "react";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
import { FileStats } from "../types";

interface FileListProps {
  filesData: FileItemKit[];
  tipiDiExportInKit: OggettoTipiDiExport[];
  showAllFiles?: boolean;
  onToggleShowAll?: () => void;
  onDownload?: (file: FileItemKit) => void;
  onDelete?: (fileId: string) => void;
  title?: string;
  subtitle?: string;
  showDeleteButton?: boolean;
}

/**
 * FileList - Visualizza i file in modalità view (read-only).
 * Usato per lo stato PUBBLICATO e per mostrare file in altri stati.
 */
const FileList: FC<FileListProps> = ({
  filesData,
  tipiDiExportInKit,
  showAllFiles = false,
  onToggleShowAll,
  onDownload,
  onDelete,
  title = "File Pubblicati",
  subtitle,
  showDeleteButton = false
}) => {
  const [previewState, setPreviewState] = useState<{
    imageUrl: string;
    totalPages: number;
    initialPage: number;
  } | null>(null);

  // Calcola statistiche file raggruppate per tipo export
  const fileStats: FileStats = useMemo(() => {
    const byExportType: FileStats["byExportType"] = {};

    filesData.forEach((file) => {
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
      total: filesData.length,
      totalPages: filesData.reduce((acc, f) => acc + (f.pages || 0), 0),
      byExportType
    };
  }, [filesData, tipiDiExportInKit]);

  const openPreview = (imageUrl: string, totalPages: number, initialPage: number = 1) => {
    setPreviewState({ imageUrl, totalPages, initialPage });
  };

  const closePreview = () => setPreviewState(null);

  return (
    <div className="box box--stacked p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-theme-1/10">
            <Lucide icon="FolderOpen" className="h-5 w-5 text-theme-1" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-500">
              {subtitle || `${fileStats.total} file totali`}
            </p>
          </div>
        </div>
        {fileStats.total > 3 && onToggleShowAll && (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onToggleShowAll}
          >
            {showAllFiles ? "Mostra meno" : "Mostra tutti"}
            <Lucide
              icon={showAllFiles ? "ChevronUp" : "ChevronDown"}
              className="h-4 w-4 ml-1"
            />
          </Button>
        )}
      </div>

      {/* File List by Export Type */}
      <div className="space-y-4">
        {Object.entries(fileStats.byExportType).map(([exportCode, stats]) => (
          <div key={exportCode} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Export Type Header */}
            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lucide icon="FileStack" className="h-4 w-4 text-theme-1" />
                <span className="text-sm font-semibold text-slate-800">{exportCode}</span>
                <span className="text-xs text-slate-500">
                  ({stats.count} file, {stats.pages} pagine)
                </span>
              </div>
            </div>

            {/* Files */}
            <div className="p-4 space-y-3">
              {(showAllFiles ? stats.files : stats.files.slice(0, 2)).map((file, idx) => {
                const hasPreview = file.url && file.pages && file.pages > 0;

                return (
                  <div
                    key={`${file.id}-${idx}`}
                    className="rounded-lg border border-slate-200 overflow-hidden"
                  >
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
                        {hasPreview && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="px-2"
                            onClick={() => openPreview(file.url!, file.pages!, 1)}
                            title="Anteprima"
                          >
                            <Lucide icon="Eye" className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {/* Download button - prioritize url_download, fallback to url or onDownload */}
                        {(file.url_download || file.url || onDownload) && (
                          <PermissionGate permission={PERMISSIONS.FILE.DOWNLOAD} mode="disable">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="px-2"
                              title="Scarica file"
                              onClick={() => {
                                if (file.url_download) {
                                  window.open(file.url_download, "_blank");
                                } else if (onDownload) {
                                  onDownload(file);
                                } else if (file.url) {
                                  // Fallback: open url in new tab
                                  window.open(file.url, "_blank");
                                }
                              }}
                            >
                              <Lucide icon="Download" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                        )}
                        {/* Delete button */}
                        {showDeleteButton && onDelete && file.id && (
                          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.ELIMINA_FILE}>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="px-2"
                              title="Elimina file"
                              onClick={() => onDelete(file.id!)}
                            >
                              <Lucide icon="Trash2" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Show more indicator */}
              {!showAllFiles && stats.files.length > 2 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  +{stats.files.length - 2} altri file
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {Object.keys(fileStats.byExportType).length === 0 && (
          <EmptyState
            icon="FileX"
            title="Nessun file"
            description="Non ci sono file disponibili per questo kit."
          />
        )}
      </div>

      {/* Preview Modal */}
      {previewState && (
        <PreviewImmaginePdf
          imageUrl={previewState.imageUrl}
          totalPages={previewState.totalPages}
          initialPage={previewState.initialPage}
          onClose={closePreview}
        />
      )}
    </div>
  );
};

export default FileList;
