import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Dropzone, { DropzoneElement } from "@/components/Base/Dropzone";
import Lucide from "@/components/Base/Lucide";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { formatDataOra } from "@/utils/format";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { useNotification } from "@/context/NotificationContext";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import type { Dropzone as DropzoneJs, DropzoneOptions } from "dropzone";
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ServerCall } from "../../../../lib/server_call";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
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
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className={clsx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
              isStaged ? "bg-warning/10" : isAccepted ? "bg-success/10" : isRejected ? "bg-danger/10" : "bg-slate-100"
            )}>
              <Lucide
                icon={isStaged ? "Clock" : isAccepted ? "CircleCheck" : isRejected ? "CircleX" : "FileText"}
                className={clsx("h-4 w-4",
                  isStaged ? "text-warning" : isAccepted ? "text-success" : isRejected ? "text-danger" : "text-slate-400"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 font-medium text-slate-800">
                <span className="truncate">{file.nome}</span>
                {isStaged && <StatusBadge tono="warning" etichetta="In staging" className="shrink-0" />}
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
          {exportType ? <Badge variant="primary" size="sm">{exportType.codice}</Badge> : "-"}
        </Table.Td>
        <Table.Td>
          <div className="flex justify-end gap-2">
            {file.url && (
              <Button variant="outline-secondary" size="sm" onClick={() => handleFilePreview(file)} aria-label={`Anteprima di ${file.nome}`} title="Anteprima">
                <Lucide icon="Eye" aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
            )}
            {isStaged && onRemoveStagedFile && stagedFile && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => onRemoveStagedFile(stagedFile.id)}
                title="Rimuovi dallo staging"
                aria-label="Rimuovi dallo staging"
              >
                <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </Table.Td>
      </Table.Tr>

      {/* Staged file details */}
      {isStaged && stagedFile && (
        <Table.Tr>
          <Table.Td colSpan={3} className="p-0">
            <div className="space-y-3 border-t border-info/20 bg-info/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-info">
                <Lucide icon="FileUp" aria-hidden="true" className="h-4 w-4" />
                File in staging — pronto per il caricamento
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-control border border-info/20 bg-white p-4">
                  <div className="title-eyebrow mb-1.5">Nuovo file</div>
                  <div className="text-sm font-semibold text-slate-800">{stagedFile.newFile.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatFileSize(stagedFile.newFile.size)} • {stagedFile.newFile.name.split(".").pop()?.toUpperCase()}
                  </div>
                  <div className="mt-1.5 text-2xs text-slate-500">
                    Caricato: {formatDataOra(stagedFile.newFile.lastModified)}
                  </div>
                </div>

                <div className="rounded-control border border-slate-200 bg-slate-50 p-4">
                  <div className="title-eyebrow mb-1.5">Sostituisce</div>
                  <div className="text-sm text-slate-700">{stagedFile.originalFile.nome}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    File originale rifiutato
                  </div>
                  <div className="mt-1.5 font-mono text-2xs text-slate-500">
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
                    <Alert variant="soft-warning" icona="CircleAlert" className="text-sm">
                      Attenzione: formato file diverso ({origExt} → {newExt})
                    </Alert>
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
            <div className="border-t border-danger/20 bg-danger/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
                <Lucide icon="MessageSquare" aria-hidden="true" className="h-4 w-4" />
                Motivo del rifiuto
              </p>
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
                          <div aria-hidden="true" className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-control", style.bg)}>
                            <Lucide icon={style.icon as any} className={clsx("h-3 w-3", style.color)} />
                          </div>
                          <span className={clsx("text-sm font-medium", style.color)}>
                            {logEntry.azione}
                          </span>
                          {logEntry.messaggio && (
                            <span className="text-sm text-slate-600 ml-1">— "{logEntry.messaggio}"</span>
                          )}
                        </div>
                        <div className="shrink-0 text-2xs tabular-nums text-slate-500">
                          {formatDataOra(logEntry.data_notifica)}
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
    init(this: DropzoneJs) {
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

  // Paginazione comune, sotto la tabella a filo
  const renderPagination = (currentPage: number, onChange: (page: number) => void, totalItems: number) => (
    <PaginazioneTabella
      totale={totalItems}
      pagina={currentPage + 1}
      dimensionePagina={ITEMS_PER_PAGE}
      onCambiaPagina={(pagina) => onChange(pagina - 1)}
    />
  );

  // Skeleton rows
  const renderSkeletonRows = () => (
    Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
      <Table.Tr key={i}>
        <Table.Td>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-control" />
            <div>
              <Skeleton width="100px" height="16px" className="mb-1" />
              <Skeleton width="60px" height="12px" />
            </div>
          </div>
        </Table.Td>
        <Table.Td>
          <Skeleton className="h-6 w-16 rounded-full" />
        </Table.Td>
        <Table.Td>
          <Skeleton className="ml-auto h-8 w-20 rounded-control" />
        </Table.Td>
      </Table.Tr>
    ))
  );

  const intestazioneTabella = (
    <Table.Thead>
      <Table.Tr>
        <Table.Th>File</Table.Th>
        <Table.Th>Tipo export</Table.Th>
        <Table.Th className="text-right">
          <span className="sr-only">Azioni</span>
        </Table.Th>
      </Table.Tr>
    </Table.Thead>
  );

  // Empty state
  if (filesData.length === 0 && !isLoadingFiles) {
    return (
      <Sezione>
        <EmptyState compatta icon="FileX" title="Nessun file presente" description="Non sono presenti file nella lavorazione." />
      </Sezione>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StatCardGrid>
        <StatCard densita="compatta" icona="Files" tono="info" etichetta="File totali" valore={filesData.length} />
        <StatCard densita="compatta" icona="CircleCheck" tono="success" etichetta="Accettati" valore={acceptedFiles.length} />
        <StatCard densita="compatta" icona="CircleX" tono="danger" etichetta="Rifiutati" valore={rejectedFiles.length} />
        <StatCard densita="compatta" icona="Clock" tono="warning" etichetta="In staging" valore={stagedFiles.length} />
      </StatCardGrid>

      {/* Accepted Files Section */}
      {(isLoadingFiles || acceptedFiles.length > 0) && (
        <Sezione
          senzaPadding
          icona="CircleCheck"
          titolo="File accettati"
          descrizione={isLoadingFiles ? "Caricamento…" : `${acceptedFiles.length} file approvati`}
        >
          <div className="overflow-x-auto">
            <Table>
              {intestazioneTabella}
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
          {!isLoadingFiles && renderPagination(acceptedPage, setAcceptedPage, acceptedFiles.length)}
        </Sezione>
      )}

      {/* Rejected Files Section */}
      {(isLoadingFiles || rejectedFiles.length > 0) && (
        <Sezione
          senzaPadding
          icona="CircleX"
          titolo="File rifiutati"
          descrizione={
            isLoadingFiles ? (
              "Caricamento…"
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {rejectedFiles.length} file da correggere
                {rejectedFiles.length > 0 && <StatusBadge tono="warning" etichetta="Richiede correzione" />}
              </span>
            )
          }
        >
          {/* Dropzone */}
          {!isLoadingFiles && setStagedFiles && !isLavorazioneAutomatica && (
            <div className="px-5 pb-5">
              <Dropzone
                options={dropzoneOptions}
                getRef={(el) => {
                  dropzoneRef.current = el;
                }}
                className="dropzone rounded-card border-2 border-dashed border-slate-300 transition-colors hover:border-theme-1"
              >
                <div className="flex flex-col items-center py-4">
                  <div aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-theme-1/10">
                    <Lucide icon="Archive" className="h-7 w-7 text-theme-1" />
                  </div>
                  <div className="title-card">Trascina qui il file ZIP o clicca per caricare</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Un singolo file ZIP contenente i file corretti ({rejectedFiles.length} file attesi)
                  </div>
                </div>
              </Dropzone>
            </div>
          )}

          {!isLoadingFiles && isLavorazioneAutomatica && (
            <div className="px-5 pb-5">
              <Alert variant="soft-info" icona="Info" titolo="Aggiornamento automatico" className="text-sm">
                Per i file automatici non è necessario caricare correzioni manuali: la problematica si risolverà
                quando il sistema riceverà una nuova pubblicazione.
              </Alert>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              {intestazioneTabella}
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
          {!isLoadingFiles && renderPagination(rejectedPage, setRejectedPage, rejectedFiles.length)}
        </Sezione>
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
