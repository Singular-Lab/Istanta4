import Skeleton from "@/components/Base/Skeleton";
import { FC, useMemo } from "react";
import { TIPO_KIT_DESIGN } from "../../../../lib/enums";
import { FileSectionProps } from "../types";
import FileErrorsTable from "./FileErrorsTable";
import FileList from "./FileList";
import FileRevisionTable from "./FileRevisionTable";
import FileUploader from "./FileUploader";

/**
 * FileSection - Orchestratore che sceglie quale componente renderizzare
 * in base alla modalità (stato della lavorazione).
 *
 * Modalità:
 * - "view": FileList (read-only, per PUBBLICATO)
 * - "upload": FileUploader + FileList (per IN_LAVORAZIONE)
 * - "revision": FileRevisionTable (per IN_REVISIONE)
 * - "error-correction": FileErrorsTable + FileUploader (per IN_LAVORAZIONE_CON_ERRORI)
 */
const FileSection: FC<FileSectionProps> = ({
  filesData,
  isLoadingFiles,
  tipiDiExportInKit,
  tipoKit,
  mode,
  // Upload props
  onFileUpload,
  onFileDelete,
  onDownloadFile,
  tipiExport,
  // Revision props
  onAccept,
  onReject,
  onAcceptAll,
  onUndoAll,
  acceptedFiles,
  rejectedFiles,
  rejectionReasons,
  // Staging props
  stagedFiles,
  setStagedFiles,
  // Common props
  showAllFiles = false,
  onToggleShowAll
}) => {
  // Separate files by upload status
  const { filesToUpload, uploadedFiles } = useMemo(() => {
    const toUpload = filesData.filter(f => !f.id_olimpo_cloud);
    const uploaded = filesData.filter(f => f.id_olimpo_cloud);
    return { filesToUpload: toUpload, uploadedFiles: uploaded };
  }, [filesData]);
  // Loading state
  if (isLoadingFiles) {
    return (
      <div className="box box--stacked p-6">
        <div className="space-y-4">
          <Skeleton height="40px" className="rounded-lg" />
          <Skeleton height="100px" className="rounded-lg" />
          <Skeleton height="100px" className="rounded-lg" />
        </div>
      </div>
    );
  }

  // Render based on mode
  switch (mode) {
    case "view":
      return (
        <FileList
          filesData={filesData}
          tipiDiExportInKit={tipiDiExportInKit}
          showAllFiles={showAllFiles}
          onToggleShowAll={onToggleShowAll}
          title="File Pubblicati"
        />
      );

    case "upload":
      return (
        <div className="space-y-6">
          {/* FileUploader per file non ancora caricati */}
          <FileUploader
            filesData={filesToUpload}
            tipiDiExportInKit={tipiDiExportInKit}
            tipiExport={tipiExport}
            onFileUpload={onFileUpload || (() => { })}
            onFileDelete={onFileDelete}
            isLoading={isLoadingFiles}
            isAutomatic={tipoKit === TIPO_KIT_DESIGN.AUTOMATICO}
          />

          {/* FileList per file già caricati */}
          {uploadedFiles.length > 0 && (
            <FileList
              filesData={uploadedFiles}
              tipiDiExportInKit={tipiDiExportInKit}
              showAllFiles={showAllFiles}
              onToggleShowAll={onToggleShowAll}
              onDownload={onDownloadFile}
              onDelete={onFileDelete}
              showDeleteButton={true}
              title="File Già Caricati"
              subtitle={`${uploadedFiles.length} file caricati con successo`}
            />
          )}
        </div>
      );

    case "revision":
      return (
        <FileRevisionTable
          filesData={filesData}
          tipiDiExportInKit={tipiDiExportInKit}
          isLoadingFiles={isLoadingFiles}
          acceptedFiles={acceptedFiles || []}
          rejectedFiles={rejectedFiles || []}
          rejectionReasons={rejectionReasons || {}}
          onAccept={onAccept}
          onReject={onReject}
          onAcceptAll={onAcceptAll}
          onAcceptPage={onAcceptAll ? (files) => files.forEach(f => onAccept?.(f)) : undefined}
          onUndoAll={onUndoAll}
          onUndo={onAccept} // Undo re-toggles the accept state
        />
      );

    case "error-correction":
      return (
        <FileErrorsTable
          isLavorazioneAutomatica={tipoKit == TIPO_KIT_DESIGN.AUTOMATICO}
          filesData={filesData}
          tipiDiExportInKit={tipiDiExportInKit}
          isLoadingFiles={isLoadingFiles}
          acceptedFiles={acceptedFiles || []}
          rejectedFiles={rejectedFiles || []}
          stagedFiles={stagedFiles || []}
          setStagedFiles={setStagedFiles}
          onRemoveStagedFile={(stagedFileId) => {
            if (setStagedFiles && stagedFiles) {
              const updatedStaged = stagedFiles.filter(sf => sf.id !== stagedFileId);
              setStagedFiles(updatedStaged);
            }
          }}
        />
      );

    default:
      return (
        <FileList
          filesData={filesData}
          tipiDiExportInKit={tipiDiExportInKit}
          showAllFiles={showAllFiles}
          onToggleShowAll={onToggleShowAll}
        />
      );
  }
};

export default FileSection;
export { default as FileErrorsTable } from "./FileErrorsTable";
export { default as FileList } from "./FileList";
export { default as FileRevisionTable } from "./FileRevisionTable";
export { default as FileUploader } from "./FileUploader";
