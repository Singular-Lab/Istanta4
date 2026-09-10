import Button from "@/components/Base/Button";
import Dropzone, { DropzoneElement } from "@/components/Base/Dropzone";
import Lucide from "@/components/Base/Lucide";
import Skeleton from "@/components/Base/Skeleton";
import Table from "@/components/Base/Table";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { useNotification } from "@/context/NotificationContext";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { DropzoneOptions } from "dropzone";
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ServerCall } from "../../../../lib/server_call";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
import { StatCard } from "../components";
import { StagedFile } from "../types";

interface FileErrorsTableProps {
  filesData: FileItemKit[];
  isLavorazioneAutomatica: boolean;
  tipiDiExportInKit: OggettoTipiDiExport[];
  isLoadingFiles?: boolean;
  // Accept/Reject state
  acceptedFiles: FileItemKit[];
  rejectedFiles: FileItemKit[];
  // Staged files for upload
  stagedFiles: StagedFile[];
  setStagedFiles?: (files: StagedFile[]) => void;
  // Callbacks
  onRemoveStagedFile?: (stagedFileId: string) => void;
  onPreview?: (file: FileItemKit) => void;
}

interface BackendFileMatch {
  originalFile: FileItemKit;
  newFile: {
    name: string;
    content: string; // base64
    type: string;
  };
}

const ITEMS_PER_PAGE = 10;

/**
 * FileRow - Riga singola della tabella file
 */
interface FileRowProps {
  file: FileItemKit;
  tipiDiExportInKit: OggettoTipiDiExport[];
  isAccepted: boolean;
  isRejected: boolean;
  isStaged: boolean;
  handleFilePreview: (file: FileItemKit) => void;
  stagedFile?: StagedFile;
  onRemoveStagedFile?: (stagedFileId: string) => void;
}

const FileRow: FC<FileRowProps> = ({
  file,
  tipiDiExportInKit,
  isAccepted,
  isRejected,
  isStaged,
  handleFilePreview,
  stagedFile,
  onRemoveStagedFile,
}) => {
  const exportType = tipiDiExportInKit.find(t => t.tipoDiExportGuidID === file.tipo_export);

  const formatFileSize = (size: number) => {
    if (size > 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(size / 1024).toFixed(1)} KB`;
  };

  return (
    <React.Fragment>
      <Table.Tr className={clsx({
        "bg-warning/5": isStaged && !isAccepted && !isRejected,
        "bg-success/5": isAccepted && !isStaged && !isRejected,
        "bg-danger/5": isRejected && !isStaged && !isAccepted,
      })}>
        <Table.Td>
          <div className="flex items-center">
            <div className={clsx(
              "flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mr-3",
              isStaged ? "bg-warning/10" : isAccepted ? "bg-success/10" : isRejected ? "bg-danger/10" : "bg-slate-100"
            )}>
              <Lucide
                icon={isStaged ? "Clock" : isAccepted ? "CircleCheck" : isRejected ? "CircleX" : "FileText"}
                className={clsx("w-5 h-5",
                  isStaged ? "text-warning" : isAccepted ? "text-success" : isRejected ? "text-danger" : "text-slate-400"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-800 flex items-center gap-2">
                <span className="truncate">{file.nome}</span>
                {isStaged && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning border border-warning/20 shrink-0">
                    In Staging
                  </span>
                )}
              </div>
              {exportType && file.pages && (
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
        <Table.Td className="text-center">
          <div className="flex justify-center gap-2">
            {file.url && (
              <Button variant="outline-secondary" size="sm" onClick={() => handleFilePreview(file)}>
                <Lucide icon="Eye" className="w-4 h-4" />
              </Button>
            )}
            {isStaged && onRemoveStagedFile && stagedFile && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => onRemoveStagedFile(stagedFile.id)}
                title="Rimuovi dallo staging"
              >
                <Lucide icon="X" className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Table.Td>
      </Table.Tr>

      {/* Staged file details */}
      {isStaged && stagedFile && (
        <Table.Tr>
          <Table.Td colSpan={3} className="p-0">
            <div className="p-4 border-t border-info/20 bg-info/5 space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                  <Lucide icon="FileUp" className="w-4 h-4 text-info" />
                </div>
                <div className="font-semibold text-sm text-info">
                  File in Staging — Pronto per il caricamento
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-info/20">
                  <div className="text-[10px] uppercase font-semibold text-info mb-1.5">Nuovo file</div>
                  <div className="text-sm font-semibold text-slate-800">{stagedFile.newFile.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatFileSize(stagedFile.newFile.size)} • {stagedFile.newFile.name.split(".").pop()?.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Caricato: {new Date(stagedFile.newFile.lastModified).toLocaleString("it-IT")}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1.5">Sostituisce</div>
                  <div className="text-sm text-slate-700">{stagedFile.originalFile.nome}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    File originale rifiutato
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                    ID: {stagedFile.originalFile.id.slice(0, 8)}...
                  </div>
                </div>
              </div>

              {/* File extension mismatch warning */}
              {(() => {
                const newExt = stagedFile.newFile.name.split(".").pop()?.toLowerCase();
                const origExt = stagedFile.originalFile.nome.split(".").pop()?.toLowerCase();
                const isCompatible = newExt === origExt;

                if (!isCompatible) {
                  return (
                    <div className="flex items-center gap-2 p-3 bg-warning/5 border border-warning/20 rounded-xl text-warning">
                      <Lucide icon="CircleAlert" className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">
                        Attenzione: Formato file diverso ({origExt} → {newExt})
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </Table.Td>
        </Table.Tr>
      )}

      {/* Rejected file logs */}
      {isRejected && !isStaged && (
        <Table.Tr>
          <Table.Td colSpan={3} className="p-0">
            <div className="p-4 bg-danger/5 border-t border-danger/20">
              <div className="flex items-center gap-2 mb-2">
                <Lucide icon="MessageSquare" className="w-4 h-4 text-danger" />
                <h4 className="font-semibold text-sm text-danger">Motivo del rifiuto</h4>
              </div>
              {file.log && file.log.logs && file.log.logs.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {file.log.logs.map((logEntry, i: number) => {
                    const getLogStyle = (azione: string) => {
                      switch (azione) {
                        case "Accettato": return { icon: "CircleCheck", color: "text-success", bg: "bg-success/10" };
                        case "Rifiutato": return { icon: "CircleX", color: "text-danger", bg: "bg-danger/10" };
                        case "Upload": return { icon: "FileUp", color: "text-info", bg: "bg-info/10" };
                        case "Download": return { icon: "FileDown", color: "text-slate-500", bg: "bg-slate-100" };
                        default: return { icon: "FileText", color: "text-slate-500", bg: "bg-slate-100" };
                      }
                    };
                    const style = getLogStyle(logEntry.azione);

                    return (
                      <div key={i} className="flex items-start justify-between gap-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className={clsx("flex h-6 w-6 items-center justify-center rounded-md shrink-0", style.bg)}>
                            <Lucide icon={style.icon as any} className={clsx("w-3 h-3", style.color)} />
                          </div>
                          <span className={clsx("text-sm font-medium", style.color)}>
                            {logEntry.azione}
                          </span>
                          {logEntry.messaggio && (
                            <span className="text-sm text-slate-600 ml-1">— "{logEntry.messaggio}"</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 shrink-0">
                          {logEntry.data_notifica instanceof Date
                            ? logEntry.data_notifica.toLocaleString("it-IT")
                            : new Date(logEntry.data_notifica).toLocaleString("it-IT")
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nessun log disponibile</p>
              )}
            </div>
          </Table.Td>
        </Table.Tr>
      )}
    </React.Fragment>
  );
};

/**
 * FileErrorsTable - Tabella per la correzione errori
 *
 * Permette di:
 * - Visualizzare file accettati e rifiutati
 * - Caricare ZIP con file di correzione
 * - Vedere file in staging pronti per upload
 * - Rimuovere file dallo staging
 */
const FileErrorsTable: FC<FileErrorsTableProps> = ({
  filesData,
  tipiDiExportInKit,
  isLavorazioneAutomatica = false,
  isLoadingFiles = false,
  acceptedFiles = [],
  rejectedFiles = [],
  stagedFiles = [],
  setStagedFiles,
  onRemoveStagedFile,
  onPreview,
}) => {
  // Refs
  const dropzoneRef = useRef<DropzoneElement | null>(null);
  const rejectedFilesRef = useRef(rejectedFiles);

  // State
  const [acceptedPage, setAcceptedPage] = useState(0);
  const [rejectedPage, setRejectedPage] = useState(0);
  const [previewFile, setPreviewFile] = useState<FileItemKit | null>(null);

  // Hooks
  const { showNotification } = useNotification();

  // Keep ref updated
  useEffect(() => {
    rejectedFilesRef.current = rejectedFiles;
  }, [rejectedFiles]);

  // Utility function for unique IDs
  const generateUniqueId = useCallback(() => {
    return `staged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Notification helpers
  const showSuccessNotification = useCallback((message: string) => {
    showNotification(
      <div className="flex items-center gap-2">
        <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
        <span>{message}</span>
      </div>,
      { variant: "success" }
    );
  }, [showNotification]);

  const showErrorNotification = useCallback((message: string) => {
    showNotification(
      <div className="flex items-center gap-2">
        <Lucide icon="CircleX" className="w-5 h-5 text-danger" />
        <span>{message}</span>
      </div>,
      { variant: "error" }
    );
  }, [showNotification]);

  const showInfoNotification = useCallback((message: string) => {
    showNotification(
      <div className="flex items-center gap-2">
        <Lucide icon="Info" className="w-5 h-5 text-slate-500" />
        <span>{message}</span>
      </div>,
      { variant: "info" }
    );
  }, [showNotification]);

  // Mutation for processing ZIP
  const processZipFileMutation = useMutation({
    mutationFn: ({ file, rejectedFilesData }: { file: File; rejectedFilesData: FileItemKit[] }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("rejectedFiles", JSON.stringify(rejectedFilesData));
      return ServerCall.post<BackendFileMatch[]>("/process-rejected-zip", formData, true);
    },
    onSuccess: (data) => {
      if (!data || !Array.isArray(data)) {
        showErrorNotification("Risposta del server non valida");
        return;
      }

      if (data.length === 0) {
        showInfoNotification("Nessun file corrispondente trovato nello ZIP.");
        return;
      }

      try {
        const processedFiles: StagedFile[] = [];

        for (const match of data) {
          if (!match.originalFile || !match.newFile || !match.newFile.content) {
            continue;
          }

          try {
            const cleanBase64 = match.newFile.content.replace(/^data:[^;]+;base64,/, "");

            let byteCharacters;
            try {
              byteCharacters = atob(cleanBase64);
            } catch {
              continue;
            }

            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
              byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);

            const blob = new Blob([byteArray], { type: match.newFile.type });
            const file = new File([blob], match.newFile.name, {
              type: match.newFile.type,
              lastModified: Date.now()
            });

            processedFiles.push({
              originalFile: match.originalFile,
              newFile: file,
              id: generateUniqueId()
            });
          } catch (fileError) {
            console.error("Error processing file:", fileError);
          }
        }

        if (processedFiles.length === 0) {
          showErrorNotification("Nessun file è stato processato correttamente");
          return;
        }

        if (setStagedFiles) {
          // Filtra i file esistenti per evitare duplicati e aggiungi i nuovi
          const filteredCurrent = stagedFiles.filter(existing =>
            !processedFiles.some(newFile => newFile.originalFile.id === existing.originalFile.id)
          );
          const newStagedFiles = [...filteredCurrent, ...processedFiles];
          flushSync(() => {
            setStagedFiles(newStagedFiles);
          });
        }

        showSuccessNotification(`${processedFiles.length} file pronti per il caricamento`);
      } catch (error) {
        console.error("Error during conversion:", error);
        showErrorNotification("Errore durante la conversione dei file dal ZIP");
      }
    },
    onError: () => {
      showErrorNotification("Errore durante l'elaborazione del ZIP");
    }
  });

  // Computed values
  const totalAcceptedPages = Math.ceil(acceptedFiles.length / ITEMS_PER_PAGE);
  const totalRejectedPages = Math.ceil(rejectedFiles.length / ITEMS_PER_PAGE);
  const paginatedAccepted = acceptedFiles.slice(acceptedPage * ITEMS_PER_PAGE, (acceptedPage + 1) * ITEMS_PER_PAGE);
  const paginatedRejected = rejectedFiles.slice(rejectedPage * ITEMS_PER_PAGE, (rejectedPage + 1) * ITEMS_PER_PAGE);

  // Utility functions
  const isAccepted = useCallback((f: FileItemKit) =>
    acceptedFiles.some(a => a.id === f.id), [acceptedFiles]
  );

  const isRejected = useCallback((f: FileItemKit) =>
    rejectedFiles.some(r => r.id === f.id), [rejectedFiles]
  );

  const isStaged = useCallback((f: FileItemKit) =>
    stagedFiles?.some(sf => sf.originalFile.id === f.id), [stagedFiles]
  );

  // Handlers
  const handleRemoveStagedFile = useCallback((stagedFileId: string) => {
    if (onRemoveStagedFile) {
      onRemoveStagedFile(stagedFileId);
    } else if (setStagedFiles) {
      const updatedFiles = stagedFiles.filter(sf => sf.id !== stagedFileId);
      setStagedFiles(updatedFiles);
    }
  }, [onRemoveStagedFile, setStagedFiles, stagedFiles]);

  const handleFilePreview = useCallback((file: FileItemKit) => {
    setPreviewFile(file);
    onPreview?.(file);
  }, [onPreview]);

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  // Dropzone options
  const dropzoneOptions: DropzoneOptions = useMemo(() => ({
    url: "#",
    autoProcessQueue: false,
    maxFiles: 1,
    acceptedFiles: ".zip",
    init() {
      this.on("addedfile", (file) => {
        if (processZipFileMutation.isPending) {
          showInfoNotification("Attendi il completamento dell'upload corrente.");
          this.removeFile(file);
          return;
        }

        processZipFileMutation.mutate({ file, rejectedFilesData: rejectedFilesRef.current });
        setTimeout(() => this.removeAllFiles(true), 100);
      });
    }
  }), [processZipFileMutation, showInfoNotification]);

  // Pagination renderer
  const renderPagination = (currentPage: number, totalPages: number, onChange: (page: number) => void, totalItems: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-5">
        <div className="text-sm text-slate-500">
          Mostro {currentPage * ITEMS_PER_PAGE + 1}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalItems)} di {totalItems}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => onChange(Math.max(0, currentPage - 1))}
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
            onClick={() => onChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            <Lucide icon="ChevronRight" className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Skeleton rows
  const renderSkeletonRows = () => (
    Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
      <Table.Tr key={i}>
        <Table.Td>
          <div className="flex items-center">
            <Skeleton width="40px" height="40px" borderRadius="12px" className="mr-3" />
            <div>
              <Skeleton width="100px" height="16px" className="mb-1" />
              <Skeleton width="60px" height="12px" />
            </div>
          </div>
        </Table.Td>
        <Table.Td>
          <Skeleton width="60px" height="24px" borderRadius="9999px" />
        </Table.Td>
        <Table.Td className="text-center">
          <Skeleton width="80px" height="32px" borderRadius="8px" />
        </Table.Td>
      </Table.Tr>
    ))
  );

  // Empty state
  if (filesData.length === 0 && !isLoadingFiles) {
    return (
      <div className="text-center py-16 rounded-xl bg-slate-50 border border-dashed border-slate-200">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
          <Lucide icon="FileX" className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-700">Nessun file presente</h3>
        <p className="text-sm text-slate-500 mt-1">Non sono presenti file nella lavorazione.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="Files" iconBg="bg-info/10" iconColor="text-info" value={filesData.length} label="File totali" />
        <StatCard icon="CircleCheck" iconBg="bg-success/10" iconColor="text-success" value={acceptedFiles.length} label="Accettati" />
        <StatCard icon="CircleX" iconBg="bg-danger/10" iconColor="text-danger" value={rejectedFiles.length} label="Rifiutati" />
        <StatCard icon="Clock" iconBg="bg-warning/10" iconColor="text-warning" value={stagedFiles.length} label="In staging" />
      </div>

      {/* Accepted Files Section */}
      {(isLoadingFiles || acceptedFiles.length > 0) && (
        <div className="box box--stacked p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-gradient-to-br from-success/10 to-success/5 rounded-xl">
              <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">File Accettati</h3>
              <p className="text-xs text-slate-500">
                {isLoadingFiles ? "Caricamento..." : `${acceptedFiles.length} file approvati`}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table bordered striped>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">File</Table.Th>
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">Tipo Export</Table.Th>
                  <Table.Th className="text-center whitespace-nowrap text-xs font-semibold text-slate-600">Azioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoadingFiles ? renderSkeletonRows() : (
                  paginatedAccepted.map(file => (
                    <FileRow
                      key={file.id}
                      file={file}
                      tipiDiExportInKit={tipiDiExportInKit}
                      isAccepted={isAccepted(file)}
                      isRejected={isRejected(file)}
                      isStaged={isStaged(file)}
                      handleFilePreview={handleFilePreview}
                      stagedFile={stagedFiles.find(sf => sf.originalFile.id === file.id)}
                      onRemoveStagedFile={handleRemoveStagedFile}
                    />
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
          {!isLoadingFiles && renderPagination(acceptedPage, totalAcceptedPages, setAcceptedPage, acceptedFiles.length)}
        </div>
      )}

      {/* Rejected Files Section */}
      {(isLoadingFiles || rejectedFiles.length > 0) && (
        <div className="box box--stacked p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-danger/10 to-danger/5 rounded-xl">
                <Lucide icon="CircleX" className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">File Rifiutati</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {isLoadingFiles ? "Caricamento..." : `${rejectedFiles.length} file da correggere`}
                  </span>
                  {!isLoadingFiles && rejectedFiles.length > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 text-warning font-medium">
                        <Lucide icon="CircleAlert" className="w-3 h-3" />
                        Richiede correzione
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dropzone */}
          {!isLoadingFiles && setStagedFiles && !isLavorazioneAutomatica && (
            <div className="mb-5">
              <Dropzone
                options={dropzoneOptions}
                getRef={(el) => {
                  dropzoneRef.current = el;
                }}
                className="dropzone border-2 border-dashed border-slate-300 rounded-2xl hover:border-theme-1 transition-colors"
              >
                <div className="flex flex-col items-center py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-theme-1/10 mb-4">
                    <Lucide icon="Archive" className="w-8 h-8 text-theme-1" />
                  </div>
                  <div className="text-base font-semibold text-slate-800">
                    Trascina qui il file ZIP o clicca per caricare
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Un singolo file ZIP contenente i file corretti ({rejectedFiles.length} file attesi)
                  </div>
                </div>
              </Dropzone>
            </div>
          )}

          {!isLoadingFiles && isLavorazioneAutomatica && (
            <div className="mb-5">
              <div className="flex items-start gap-3 rounded-xl border border-info/20 bg-info/5 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 shrink-0">
                  <Lucide icon="Info" className="w-4 h-4 text-info" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-info">Aggiornamento automatico</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Per i file automatici non è necessario caricare correzioni manuali: la problematica si risolverà
                    quando il sistema riceverà una nuova pubblicazione.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table bordered striped>
              <Table.Thead>
                <Table.Tr className="bg-slate-50">
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">File</Table.Th>
                  <Table.Th className="whitespace-nowrap text-xs font-semibold text-slate-600">Tipo Export</Table.Th>
                  <Table.Th className="text-center whitespace-nowrap text-xs font-semibold text-slate-600">Azioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoadingFiles ? renderSkeletonRows() : (
                  paginatedRejected.map(file => (
                    <FileRow
                      key={file.id}
                      file={file}
                      tipiDiExportInKit={tipiDiExportInKit}
                      isAccepted={isAccepted(file)}
                      isRejected={isRejected(file)}
                      isStaged={isStaged(file)}
                      handleFilePreview={handleFilePreview}
                      stagedFile={stagedFiles.find(sf => sf.originalFile.id === file.id)}
                      onRemoveStagedFile={handleRemoveStagedFile}
                    />
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
          {!isLoadingFiles && renderPagination(rejectedPage, totalRejectedPages, setRejectedPage, rejectedFiles.length)}
        </div>
      )}

      {/* PDF Preview */}
      {previewFile && (
        <PreviewImmaginePdf
          imageUrl={previewFile.url!}
          onClose={handleClosePreview}
          totalPages={previewFile.pages!}
        />
      )}
    </div>
  );
};

export default FileErrorsTable;
