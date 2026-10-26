import Button from "@/components/Base/Button";
import { FormInput, FormSelect, FormTextarea } from "@/components/Base/Form";
import FormLabel from "@/components/Base/Form/FormLabel";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import clsx from "clsx";
import React, { FC, useMemo, useState } from "react";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
import { StatCard } from "../components";
import { EXPORT_DI_SISTEMA } from "../../../../lib/enums";

interface FileRevisionTableProps {
  filesData: FileItemKit[];
  tipiDiExportInKit: OggettoTipiDiExport[];
  isLoadingFiles?: boolean;
  // Accept/Reject state
  acceptedFiles: FileItemKit[];
  rejectedFiles: FileItemKit[];
  rejectionReasons?: Record<string, string>; // fileId -> reason
  // Callbacks
  onAccept?: (file: FileItemKit) => void;
  onReject?: (file: FileItemKit, reason: string) => void;
  onAcceptAll?: () => void;
  onAcceptPage?: (files: FileItemKit[]) => void;
  onUndoAll?: () => void;
  onUndo?: (file: FileItemKit) => void;
  onPreview?: (file: FileItemKit) => void;
  onDownloadZip?: () => void;
  // States
  isDownloading?: boolean;
}

const ITEMS_PER_PAGE = 20;

/**
 * FileRevisionTable - Tabella per la revisione dei file
 *
 * Permette di:
 * - Visualizzare lista file con filtri e paginazione
 * - Accettare/Rifiutare singoli file
 * - Accettare tutti i file in attesa
 * - Accettare solo i file della pagina corrente
 * - Annullare tutte le modifiche
 * - Scaricare ZIP dei file
 */
const FileRevisionTable: FC<FileRevisionTableProps> = ({
  filesData,
  tipiDiExportInKit,
  isLoadingFiles = false,
  acceptedFiles = [],
  rejectedFiles = [],
  rejectionReasons = {},
  onAccept,
  onReject,
  onAcceptAll,
  onAcceptPage,
  onUndoAll,
  onUndo,
  onPreview,
  onDownloadZip,
  isDownloading = false
}) => {
  // Local state for input values (temporary before confirmation)
  const [localRejectionReasons, setLocalRejectionReasons] = useState<Record<string, string>>({});
  const [showRejectionInput, setShowRejectionInput] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedExportType, setSelectedExportType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [previewFile, setPreviewFile] = useState<FileItemKit | null>(null);

  // Helpers
  const isAccepted = (f: FileItemKit) => acceptedFiles.some(a => a.id === f.id);
  const isRejected = (f: FileItemKit) => rejectedFiles.some(r => r.id === f.id);

  // Get rejection reason from state or from file logs
  const getRejectionReason = (file: FileItemKit): string | undefined => {
    // First check state (for newly rejected files in this session)
    if (rejectionReasons[file.id]) {
      return rejectionReasons[file.id];
    }
    // Then check file logs (for previously rejected files)
    const lastRejectionLog = file.log?.logs?.filter(l => l.azione === 'Rifiutato').pop();
    return lastRejectionLog?.messaggio;
  };

  // Filtered and paginated files
  const filteredFiles = useMemo(() => {
    let filtered = filesData;

    if (selectedExportType !== "all") {
      filtered = filtered.filter(file => {
        const exportType = tipiDiExportInKit.find(t => t.tipoDiExportGuidID === file.tipo_export);
        return exportType?.codice === selectedExportType;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.nome.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [filesData, selectedExportType, searchQuery, tipiDiExportInKit]);

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE);
  const paginatedFiles = filteredFiles.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  // Stats
  const stats = useMemo(() => {
    const total = filteredFiles.length;
    const acceptedCount = filteredFiles.filter(f => isAccepted(f)).length;
    const rejectedCount = filteredFiles.filter(f => isRejected(f)).length;
    const pendingCount = total - acceptedCount - rejectedCount;

    return { total, acceptedCount, rejectedCount, pendingCount };
  }, [filteredFiles, acceptedFiles, rejectedFiles]);

  const hasLocalChanges = useMemo(() => {
    return acceptedFiles.length > 0 || rejectedFiles.length > 0;
  }, [acceptedFiles, rejectedFiles]);

  // Handlers
  const handleAcceptAll = () => {
    onAcceptAll?.();
  };

  const handleAcceptPage = () => {
    const filesToAccept = paginatedFiles.filter(file => !isAccepted(file) && !isRejected(file));
    onAcceptPage?.(filesToAccept);
  };

  const handleUndoAll = () => {
    onUndoAll?.();
    setLocalRejectionReasons({});
    setShowRejectionInput({});
  };

  const handleAccept = (file: FileItemKit) => {
    onAccept?.(file);
  };

  const handleReject = (file: FileItemKit, reason: string) => {
    onReject?.(file, reason);
    setShowRejectionInput(prev => ({ ...prev, [file.id]: false }));
  };

  const handleUndo = (file: FileItemKit) => {
    onUndo?.(file);
    setLocalRejectionReasons(prev => ({ ...prev, [file.id]: "" }));
  };

  const toggleRejectionInput = (fileId: string) => {
    setShowRejectionInput(prev => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  const handleRejectionReasonChange = (fileId: string, reason: string) => {
    setLocalRejectionReasons(prev => ({ ...prev, [fileId]: reason }));
  };

  const handlePreview = (file: FileItemKit) => {
    setPreviewFile(file);
    onPreview?.(file);
  };

  // Get unique export types for filter (excluding WEB and CORREGGO)
  const availableExportTypes = useMemo(() => {
    return tipiDiExportInKit.filter(tipo =>
      tipo.codice !== "WEB" && tipo.codice !== EXPORT_DI_SISTEMA.CORREGGO
    );
  }, [tipiDiExportInKit]);

  // Loading skeleton
  if (isLoadingFiles) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height="80px" className="rounded-xl" />
          ))}
        </div>
        <Skeleton height="400px" className="rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="Files"
          iconBg="bg-info/10"
          iconColor="text-info"
          value={stats.total}
          label="File totali"
        />
        <StatCard
          icon="CircleCheck"
          iconBg="bg-success/10"
          iconColor="text-success"
          value={stats.acceptedCount}
          label="Approvati"
        />
        <StatCard
          icon="CircleX"
          iconBg="bg-danger/10"
          iconColor="text-danger"
          value={stats.rejectedCount}
          label="Rifiutati"
        />
        <StatCard
          icon="Clock"
          iconBg="bg-warning/10"
          iconColor="text-warning"
          value={stats.pendingCount}
          label="In attesa"
        />
      </div>

      {/* Main Table Box */}
      <div className="box box--stacked p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-gradient-to-br from-warning/10 to-warning/5 rounded-xl">
            <Lucide icon="ClipboardCheck" className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Revisione File</h3>
            <p className="text-xs text-slate-500">
              {stats.total} file da revisionare — {stats.pendingCount} in attesa di decisione
            </p>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 w-full">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button
              variant="primary"
              onClick={handleAcceptAll}
              disabled={stats.pendingCount === 0}
            >
              <Lucide
                icon={stats.pendingCount === 0 ? "CircleX" : "CircleCheck"}
                className="w-4 h-4 mr-2"
              />
              Accetta Tutti i Restanti ({stats.pendingCount})
            </Button>
            <Button
              variant="outline-primary"
              onClick={handleAcceptPage}
              disabled={paginatedFiles.every(f => isAccepted(f) || isRejected(f))}
            >
              <Lucide
                icon={paginatedFiles.every(f => isAccepted(f) || isRejected(f)) ? "X" : "Check"}
                className="w-4 h-4 mr-2"
              />
              Accetta Pagina Corrente
            </Button>
            <Button
              variant="outline-warning"
              onClick={handleUndoAll}
              disabled={!hasLocalChanges}
            >
              <Lucide
                icon={!hasLocalChanges ? "Minus" : "Undo2"}
                className="w-4 h-4 mr-2"
              />
              Annulla Modifiche
            </Button>
          </div>

          {onDownloadZip && (
            <Button
              variant="outline-secondary"
              onClick={onDownloadZip}
              disabled={filteredFiles.length === 0 || isDownloading}
            >
              {isDownloading ? (
                <>
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Preparazione ZIP...
                </>
              ) : (
                <>
                  <Lucide icon="Archive" className="w-4 h-4 mr-2" />
                  Scarica ZIP ({filteredFiles.length})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1">
            <FormInput
              type="text"
              placeholder="Cerca file per nome..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full"
            />
          </div>
          <div className="w-full sm:w-48">
            <FormSelect
              value={selectedExportType}
              onChange={(e) => {
                setSelectedExportType(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full"
            >
              <option value="all">Tutti i tipi</option>
              {availableExportTypes.map((tipo) => (
                <option key={tipo.tipoDiExportGuidID} value={tipo.codice}>
                  {tipo.codice}
                </option>
              ))}
            </FormSelect>
          </div>
        </div>

        {/* Table */}
        {paginatedFiles.length === 0 ? (
          <div className="text-center py-16 rounded-xl bg-slate-50 border border-dashed border-slate-200">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
              <Lucide icon="Inbox" className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">Nessun file da revisionare</h3>
            <p className="text-sm text-slate-500 mt-1">
              Tutti i documenti sono stati processati o prova a modificare i filtri di ricerca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table bordered striped>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">File</Table.Th>
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">Tipo Export</Table.Th>
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">Stato</Table.Th>
                  <Table.Th className="text-center whitespace-nowrap text-xs font-semibold text-slate-600">Azioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedFiles.map((file) => {
                  const isAcc = isAccepted(file);
                  const isRej = isRejected(file);
                  const showRejection = showRejectionInput[file.id];
                  const exportType = tipiDiExportInKit.find(t => t.tipoDiExportGuidID === file.tipo_export);
                  const rejectedFile = rejectedFiles.find(r => r.id === file.id);

                  return (
                    <React.Fragment key={file.id}>
                      <Table.Tr className={clsx({
                        "bg-success/5": isAcc,
                        "bg-danger/5": isRej,
                      })}>
                        <Table.Td className="max-w-xs">
                          <div className="flex items-center">
                            <div className={clsx(
                              "flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mr-3",
                              isAcc ? "bg-success/10" : isRej ? "bg-danger/10" : "bg-slate-100"
                            )}>
                              <Lucide icon="FileText" className={clsx("w-5 h-5",
                                isAcc ? "text-success" : isRej ? "text-danger" : "text-slate-400"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 truncate" title={file.nome}>
                                {file.nome}
                              </div>
                              {file.pages && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {file.pages} {file.pages > 1 ? "pagine" : "pagina"}
                                </div>
                              )}
                            </div>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          {exportType ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-theme-1/5 text-theme-1 border border-theme-1/20">
                              {exportType.codice}
                            </span>
                          ) : "-"}
                        </Table.Td>
                        <Table.Td>
                          {isAcc && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                              <Lucide icon="Check" className="w-3 h-3" /> Accettato
                            </span>
                          )}
                          {isRej && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
                              <Lucide icon="X" className="w-3 h-3" /> Rifiutato
                            </span>
                          )}
                          {!isAcc && !isRej && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                              <Lucide icon="Clock" className="w-3 h-3" /> In attesa
                            </span>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {file.url && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handlePreview(file)}
                              >
                                <Lucide icon="Eye" className="w-4 h-4" />
                              </Button>
                            )}
                            {!isAcc && !isRej && (
                              <>
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => handleAccept(file)}
                                >
                                  Accetta
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => toggleRejectionInput(file.id)}
                                >
                                  Rifiuta
                                </Button>
                              </>
                            )}
                            {(isAcc || isRej) && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleUndo(file)}
                              >
                                <Lucide icon="RotateCcw" className="w-4 h-4 mr-1" /> Annulla
                              </Button>
                            )}
                          </div>
                        </Table.Td>
                      </Table.Tr>

                      {/* Rejection reason input */}
                      {showRejection && !isAcc && !isRej && (
                        <Table.Tr>
                          <Table.Td colSpan={4} className="p-0">
                            <div className="p-5 bg-slate-50 border-t border-slate-200">
                              <FormLabel htmlFor={`rejection-reason-${file.id}`} className="font-semibold text-slate-800">
                                Motivo del rifiuto
                              </FormLabel>
                              <FormTextarea
                                id={`rejection-reason-${file.id}`}
                                rows={3}
                                value={localRejectionReasons[file.id] || ""}
                                onChange={(e) => handleRejectionReasonChange(file.id, e.target.value)}
                                placeholder="Es. L'immagine non è in alta risoluzione..."
                                className="w-full mt-2"
                              />
                              <div className="flex justify-end mt-3 gap-2">
                                <Button
                                  type="button"
                                  variant="outline-secondary"
                                  onClick={() => toggleRejectionInput(file.id)}
                                >
                                  Annulla
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  onClick={() => handleReject(file, localRejectionReasons[file.id] || "")}
                                  disabled={!localRejectionReasons[file.id]}
                                >
                                  Conferma Rifiuto
                                </Button>
                              </div>
                            </div>
                          </Table.Td>
                        </Table.Tr>
                      )}

                      {/* Rejection reason display */}
                      {isRej && getRejectionReason(file) && (
                        <Table.Tr>
                          <Table.Td colSpan={4} className="p-0">
                            <div className="p-4 bg-danger/5 border-t border-danger/20">
                              <div className="flex items-center gap-2 mb-1">
                                <Lucide icon="MessageSquare" className="w-4 h-4 text-danger" />
                                <h4 className="font-semibold text-sm text-danger">Motivo del rifiuto</h4>
                              </div>
                              <p className="text-sm text-slate-700">{getRejectionReason(file)}</p>
                            </div>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5">
            <div className="text-sm text-slate-500">
              Mostro {currentPage * ITEMS_PER_PAGE + 1}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredFiles.length)} di {filteredFiles.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                <Lucide icon="ChevronLeft" className="w-4 h-4" />
              </Button>
              <span className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg font-medium text-slate-600">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
              >
                <Lucide icon="ChevronRight" className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <PreviewImmaginePdf
          imageUrl={previewFile.url || ""}
          onClose={() => setPreviewFile(null)}
          totalPages={previewFile.pages || 1}
        />
      )}
    </div>
  );
};

export default FileRevisionTable;
