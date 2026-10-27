import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect, FormTextarea } from "@/components/Base/Form";
import FormLabel from "@/components/Base/Form/FormLabel";
import Lucide from "@/components/Base/Lucide";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import clsx from "clsx";
import React, { FC, useMemo, useState } from "react";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
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
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height="72px" className="rounded-control" />
          ))}
        </div>
        <Skeleton height="400px" className="rounded-card" />
      </div>
    );
  }

  const paginaGiaDecisa = paginatedFiles.every(f => isAccepted(f) || isRejected(f));

  return (
    <div className="flex flex-col gap-6">
      <StatCardGrid>
        <StatCard densita="compatta" icona="Files" tono="info" etichetta="File totali" valore={stats.total} />
        <StatCard densita="compatta" icona="CircleCheck" tono="success" etichetta="Approvati" valore={stats.acceptedCount} />
        <StatCard densita="compatta" icona="CircleX" tono="danger" etichetta="Rifiutati" valore={stats.rejectedCount} />
        <StatCard densita="compatta" icona="Clock" tono="warning" etichetta="In attesa" valore={stats.pendingCount} />
      </StatCardGrid>

      <Sezione
        senzaPadding
        icona="ClipboardCheck"
        titolo="Revisione file"
        descrizione={`${stats.total} file da revisionare — ${stats.pendingCount} in attesa di decisione`}
        azioni={
          onDownloadZip && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onDownloadZip}
              disabled={filteredFiles.length === 0}
              loading={isDownloading}
            >
              {!isDownloading && <Lucide icon="Archive" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
              {isDownloading ? "Preparazione ZIP…" : `Scarica ZIP (${filteredFiles.length})`}
            </Button>
          )
        }
      >
        <BarraFiltri
          destra={
            <>
              <Button variant="outline-secondary" size="sm" onClick={handleUndoAll} disabled={!hasLocalChanges}>
                <Lucide icon="Undo2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Annulla modifiche
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={handleAcceptPage} disabled={paginaGiaDecisa}>
                <Lucide icon="Check" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Accetta pagina corrente
              </Button>
              <Button variant="primary" size="sm" onClick={handleAcceptAll} disabled={stats.pendingCount === 0}>
                <Lucide icon="CircleCheck" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Accetta tutti i restanti ({stats.pendingCount})
              </Button>
            </>
          }
        >
          <CampoRicerca
            etichetta="Cerca file"
            placeholder="Cerca file per nome…"
            value={searchQuery}
            onChange={(valore) => {
              setSearchQuery(valore);
              setCurrentPage(0);
            }}
          />
          <FormSelect
            formSelectSize="sm"
            aria-label="Tipo di export"
            className="sm:w-48"
            value={selectedExportType}
            onChange={(e) => {
              setSelectedExportType(e.target.value);
              setCurrentPage(0);
            }}
          >
            <option value="all">Tutti i tipi</option>
            {availableExportTypes.map((tipo) => (
              <option key={tipo.tipoDiExportGuidID} value={tipo.codice}>
                {tipo.codice}
              </option>
            ))}
          </FormSelect>
        </BarraFiltri>

        {paginatedFiles.length === 0 ? (
          <EmptyState
            compatta
            icon="Inbox"
            title="Nessun file da revisionare"
            description="Tutti i documenti sono stati processati o prova a modificare i filtri di ricerca."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Tipo export</Table.Th>
                  <Table.Th>Stato</Table.Th>
                  <Table.Th className="text-right">
                    <span className="sr-only">Azioni</span>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedFiles.map((file) => {
                  const isAcc = isAccepted(file);
                  const isRej = isRejected(file);
                  const showRejection = showRejectionInput[file.id];
                  const exportType = tipiDiExportInKit.find(t => t.tipoDiExportGuidID === file.tipo_export);

                  return (
                    <React.Fragment key={file.id}>
                      <Table.Tr className={clsx({
                        "bg-success/5": isAcc,
                        "bg-danger/5": isRej,
                      })}>
                        <Table.Td className="max-w-xs">
                          <div className="flex items-center gap-3">
                            <div
                              aria-hidden="true"
                              className={clsx(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
                                isAcc ? "bg-success/10" : isRej ? "bg-danger/10" : "bg-slate-100"
                              )}
                            >
                              <Lucide icon="FileText" className={clsx("h-4 w-4",
                                isAcc ? "text-success" : isRej ? "text-danger" : "text-slate-400"
                              )} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-slate-800" title={file.nome}>
                                {file.nome}
                              </div>
                              {file.pages && (
                                <div className="mt-0.5 text-xs text-slate-500">
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
                          {isAcc && <StatusBadge tono="success" icon="Check" etichetta="Accettato" />}
                          {isRej && <StatusBadge tono="danger" icon="X" etichetta="Rifiutato" />}
                          {!isAcc && !isRej && <StatusBadge tono="warning" icon="Clock" etichetta="In attesa" />}
                        </Table.Td>
                        <Table.Td>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {file.url && (
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handlePreview(file)}
                                aria-label={`Anteprima di ${file.nome}`}
                                title="Anteprima"
                              >
                                <Lucide icon="Eye" aria-hidden="true" className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {!isAcc && !isRej && (
                              <>
                                <Button variant="outline-success" size="sm" onClick={() => handleAccept(file)}>
                                  Accetta
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => toggleRejectionInput(file.id)}
                                  aria-expanded={Boolean(showRejection)}
                                >
                                  Rifiuta
                                </Button>
                              </>
                            )}
                            {(isAcc || isRej) && (
                              <Button variant="outline-secondary" size="sm" onClick={() => handleUndo(file)}>
                                <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" /> Annulla
                              </Button>
                            )}
                          </div>
                        </Table.Td>
                      </Table.Tr>

                      {/* Rejection reason input */}
                      {showRejection && !isAcc && !isRej && (
                        <Table.Tr>
                          <Table.Td colSpan={4} className="bg-slate-50 p-5">
                            <FormLabel htmlFor={`rejection-reason-${file.id}`} className="font-medium text-slate-800">
                              Motivo del rifiuto
                            </FormLabel>
                            <FormTextarea
                              id={`rejection-reason-${file.id}`}
                              rows={3}
                              value={localRejectionReasons[file.id] || ""}
                              onChange={(e) => handleRejectionReasonChange(file.id, e.target.value)}
                              placeholder="Es. L'immagine non è in alta risoluzione…"
                              className="mt-2 w-full"
                            />
                            <div className="mt-3 flex justify-end gap-2">
                              <Button type="button" variant="outline-secondary" size="sm" onClick={() => toggleRejectionInput(file.id)}>
                                Annulla
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => handleReject(file, localRejectionReasons[file.id] || "")}
                                disabled={!localRejectionReasons[file.id]}
                              >
                                Conferma rifiuto
                              </Button>
                            </div>
                          </Table.Td>
                        </Table.Tr>
                      )}

                      {/* Rejection reason display */}
                      {isRej && getRejectionReason(file) && (
                        <Table.Tr>
                          <Table.Td colSpan={4} className="px-5 py-3">
                            <Alert variant="soft-danger" icona="MessageSquare" titolo="Motivo del rifiuto" className="text-sm">
                              {getRejectionReason(file)}
                            </Alert>
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

        <PaginazioneTabella
          totale={filteredFiles.length}
          pagina={currentPage + 1}
          dimensionePagina={ITEMS_PER_PAGE}
          onCambiaPagina={(pagina) => setCurrentPage(pagina - 1)}
        />
      </Sezione>

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
