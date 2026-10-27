import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Dropzone, { DropzoneElement } from "@/components/Base/Dropzone";
import { FormSelect } from "@/components/Base/Form";
import Alert from "@/components/Base/Alert";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import Skeleton from "@/components/Base/Skeleton";
import clsx from "clsx";
import type { Dropzone as DropzoneJs, DropzoneOptions } from "dropzone";
import { FC, useCallback, useMemo, useRef, useState } from "react";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
import { StagedUploadFile, UploadFileData } from "../types";

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const ACCEPTED_FORMATS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"];
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// ============================================
// INTERFACES
// ============================================

interface FileUploaderProps {
  filesData: FileItemKit[];
  tipiDiExportInKit: OggettoTipiDiExport[];
  tipiExport?: Array<{ id_tipiexport: string; codice_tipiexport: string; nome_tipiexport?: string }>;
  isLoading?: boolean;
  isUploading?: boolean;
  isAutomatic?: boolean;
  onFileUpload: (files: UploadFileData[]) => void;
  onFileDelete?: (fileId: string) => void;
  onPreview?: (file: FileItemKit) => void;
}

interface FileUploadCardProps {
  file: FileItemKit;
  tipiExport: Array<{ id_tipiexport: string; codice_tipiexport: string; nome_tipiexport?: string }>;
  stagedFile?: StagedUploadFile;
  validationError?: string;
  progress?: number;
  selectedExportType: string;
  onExportTypeChange: (exportType: string) => void;
  onFileDrop: (file: File) => void;
  onRemove: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const validateFile = (file: File): string | null => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File troppo grande (max ${formatFileSize(MAX_FILE_SIZE)})`;
  }

  // Check file type
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (!ACCEPTED_FORMATS.includes(extension) && !ACCEPTED_MIME_TYPES.includes(file.type)) {
    return `Formato non supportato. Formati accettati: ${ACCEPTED_FORMATS.join(", ")}`;
  }

  return null;
};

const generateUniqueId = (): string => {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// FILE UPLOAD CARD COMPONENT
// ============================================

const FileUploadCard: FC<FileUploadCardProps> = ({
  file,
  tipiExport,
  stagedFile,
  validationError,
  progress,
  selectedExportType,
  onExportTypeChange,
  onFileDrop,
  onRemove,
}) => {
  const dropzoneRef = useRef<DropzoneElement | null>(null);

  const dropzoneOptions: DropzoneOptions = useMemo(
    () => ({
      url: "#",
      autoProcessQueue: false,
      maxFiles: 1,
      acceptedFiles: ACCEPTED_FORMATS.join(","),
      init(this: DropzoneJs) {
        this.on("addedfile", (addedFile) => {
          onFileDrop(addedFile);
          setTimeout(() => this.removeAllFiles(true), 100);
        });
      },
    }),
    [onFileDrop]
  );

  const isUploading = progress !== undefined && progress > 0 && progress < 100;
  const isSuccess = stagedFile?.status === "success";
  const isError = stagedFile?.status === "error" || !!validationError;

  return (
    <div
      className={clsx("rounded-card border p-4 transition-all", {
        "border-success/50 bg-success/5": stagedFile && !isError,
        "border-danger/50 bg-danger/5": isError,
        "border-primary/50 bg-primary/5": isUploading,
        "border-slate-200 hover:border-slate-300": !stagedFile && !isError && !isUploading,
      })}
    >
      {/* Header: Nome file + badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            aria-hidden="true"
            className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-control", {
              "bg-success/10": stagedFile && !isError,
              "bg-danger/10": isError,
              "bg-primary/10": isUploading,
              "bg-slate-100": !stagedFile && !isError && !isUploading,
            })}
          >
            <Lucide
              icon={stagedFile && !isError ? "FileCheck" : isError ? "FileX" : "FileText"}
              className={clsx("w-5 h-5", {
                "text-success": stagedFile && !isError,
                "text-danger": isError,
                "text-primary": isUploading,
                "text-slate-400": !stagedFile && !isError && !isUploading,
              })}
            />
          </div>
          <div>
            <h3 className="title-card">{file.nome}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={file.isOptional ? "warning" : "primary"} size="sm">
                {file.isOptional ? "Opzionale" : "Obbligatorio"}
              </Badge>
              {isSuccess && (
                <Badge variant="success" size="sm">
                  Pronto
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Direttive */}
      {file.direttive && <p className="text-sm text-slate-500 mb-4 pl-12">{file.direttive}</p>}

      {/* Select tipo export + Dropzone */}
      <div className="flex flex-col sm:flex-row gap-3">
        {tipiExport.length > 1 && (
          <div className="w-full sm:w-40">
            <FormSelect
              value={selectedExportType}
              onChange={(e) => onExportTypeChange(e.target.value)}
              className="w-full"
              disabled={!!stagedFile}
            >
              <option value="">Tipo export</option>
              {tipiExport.map((tipo) => (
                <option key={tipo.id_tipiexport} value={tipo.id_tipiexport}>
                  {tipo.codice_tipiexport}
                </option>
              ))}
            </FormSelect>
          </div>
        )}

        {!stagedFile && (
          <Dropzone
            options={dropzoneOptions}
            getRef={(el) => {
              dropzoneRef.current = el;
            }}
            className="dropzone flex-1 cursor-pointer rounded-card border-2 border-dashed border-slate-300 transition-colors hover:border-primary"
          >
            <div className="flex items-center justify-center gap-2 py-4 px-3">
              <Lucide icon="Upload" aria-hidden="true" className="h-5 w-5 text-slate-400" />
              <span className="text-sm text-slate-600">Trascina qui o clicca per selezionare</span>
            </div>
          </Dropzone>
        )}
      </div>

      {/* File staged preview */}
      {stagedFile && !isError && (
        <div className="mt-4 flex items-center justify-between rounded-control border border-success/20 bg-success/10 p-3">
          <div className="flex items-center gap-3">
            <Lucide icon="FileCheck" aria-hidden="true" className="h-5 w-5 text-success" />
            <div>
              <span className="font-medium text-success">{stagedFile.file.name}</span>
              <span className="text-sm text-slate-500 ml-2">({formatFileSize(stagedFile.file.size)})</span>
            </div>
          </div>
          <Button variant="outline-danger" size="sm" className="p-1.5" onClick={onRemove} aria-label="Rimuovi il file selezionato">
            <Lucide icon="X" aria-hidden="true" className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <Alert variant="soft-danger" icona="CircleAlert" className="mt-4 text-sm">
          {validationError}
        </Alert>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-primary">Caricamento in corso…</span>
            <span className="text-xs text-slate-500">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN FILEUPLOADER COMPONENT
// ============================================

const FileUploader: FC<FileUploaderProps> = ({
  filesData,
  tipiDiExportInKit,
  tipiExport = [],
  isLoading = false,
  isUploading = false,
  isAutomatic = false,
  onFileUpload,
  onFileDelete,
  onPreview,
}) => {
  // State
  const [stagedFiles, setStagedFiles] = useState<StagedUploadFile[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [selectedExportTypes, setSelectedExportTypes] = useState<Record<string, string>>({});

  // Files that need to be uploaded (not yet on server)
  const filesToUpload = useMemo(() => {
    return filesData.filter((f) => !f.id_olimpo_cloud);
  }, [filesData]);

  // Files already uploaded
  const uploadedFiles = useMemo(() => {
    return filesData.filter((f) => f.id_olimpo_cloud);
  }, [filesData]);

  // Stats
  const stats = useMemo(() => {
    const required = filesToUpload.filter((f) => !f.isOptional).length;
    const optional = filesToUpload.filter((f) => f.isOptional).length;
    const staged = stagedFiles.length;
    const uploaded = uploadedFiles.length;

    return { required, optional, staged, uploaded, total: filesToUpload.length };
  }, [filesToUpload, uploadedFiles, stagedFiles]);

  // Handlers
  const handleFileDrop = useCallback(
    (expectedFile: FileItemKit, file: File) => {
      // Clear previous error for this file
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[expectedFile.id || expectedFile.nome];
        return next;
      });

      // Validate file
      const error = validateFile(file);
      if (error) {
        setValidationErrors((prev) => ({
          ...prev,
          [expectedFile.id || expectedFile.nome]: error,
        }));
        return;
      }

      // Get selected export type or use first available
      const exportType =
        selectedExportTypes[expectedFile.id || expectedFile.nome] ||
        (tipiExport.length === 1 ? tipiExport[0].id_tipiexport : "");

      // Add to staged files
      const stagedFile: StagedUploadFile = {
        id: generateUniqueId(),
        file,
        expectedFileName: expectedFile.nome,
        exportType,
        direttive: expectedFile.direttive || "",
        isOptional: expectedFile.isOptional || false,
        status: "pending",
      };

      setStagedFiles((prev) => {
        // Remove any existing staged file for this expected file
        const filtered = prev.filter((sf) => sf.expectedFileName !== expectedFile.nome);
        return [...filtered, stagedFile];
      });
    },
    [selectedExportTypes, tipiExport]
  );

  const handleRemoveStaged = useCallback((expectedFileName: string) => {
    setStagedFiles((prev) => prev.filter((sf) => sf.expectedFileName !== expectedFileName));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[expectedFileName];
      return next;
    });
  }, []);

  const handleExportTypeChange = useCallback((fileId: string, exportType: string) => {
    setSelectedExportTypes((prev) => ({
      ...prev,
      [fileId]: exportType,
    }));

    // Update staged file if exists
    setStagedFiles((prev) =>
      prev.map((sf) => (sf.expectedFileName === fileId ? { ...sf, exportType } : sf))
    );
  }, []);

  const handleUploadAll = useCallback(() => {
    if (stagedFiles.length === 0) return;

    // Validate export types are selected
    const missingExportType = stagedFiles.some((sf) => !sf.exportType && tipiExport.length > 1);
    if (missingExportType) {
      // Set errors for files missing export type
      const errors: Record<string, string> = {};
      stagedFiles.forEach((sf) => {
        if (!sf.exportType && tipiExport.length > 1) {
          errors[sf.expectedFileName] = "Seleziona un tipo di export";
        }
      });
      setValidationErrors((prev) => ({ ...prev, ...errors }));
      return;
    }

    // Convert staged files to upload format
    const uploadData: UploadFileData[] = stagedFiles.map((sf) => ({
      file: sf.file,
      nome: sf.expectedFileName,
      direttive: sf.direttive,
      isOptional: sf.isOptional,
      tipo_export: sf.exportType || (tipiExport.length === 1 ? tipiExport[0].id_tipiexport : ""),
    }));

    onFileUpload(uploadData);

    // Clear staged files after upload initiated
    setStagedFiles([]);
    setValidationErrors({});
    setSelectedExportTypes({});
  }, [stagedFiles, tipiExport, onFileUpload]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="72px" className="rounded-control" />
          ))}
        </div>
        <Skeleton height="300px" className="rounded-card" />
      </div>
    );
  }

  // Automatic workflow - files are managed by the system
  if (isAutomatic) {
    return (
      <div className="flex flex-col gap-6">
        <StatCardGrid>
          <StatCard densita="compatta" icona="Files" tono="info" etichetta="File totali" valore={filesData.length} />
          <StatCard densita="compatta" icona="FileCheck" tono="success" etichetta="File generati" valore={uploadedFiles.length} />
          <StatCard densita="compatta" icona="Clock" tono="warning" etichetta="In attesa" valore={filesToUpload.length} />
          <StatCard densita="compatta" icona="Bot" tono="brand" etichetta="Gestione" valore="Auto" />
        </StatCardGrid>

        <Sezione icona="Bot" titolo="Lavorazione automatica" descrizione="I file vengono generati e caricati dal sistema">
          <p className="text-sm text-slate-500">
            I file per questa lavorazione vengono generati e caricati automaticamente dal sistema.
            Non è richiesto alcun intervento manuale.
          </p>
          {filesToUpload.length > 0 && (
            <Alert variant="soft-warning" icona="Clock" className="mt-4">
              {filesToUpload.length} file in attesa di generazione
            </Alert>
          )}
          {filesToUpload.length === 0 && uploadedFiles.length > 0 && (
            <Alert variant="soft-success" icona="CircleCheck" className="mt-4">
              Tutti i file sono stati generati ({uploadedFiles.length})
            </Alert>
          )}
        </Sezione>
      </div>
    );
  }

  // Check if all required files have been staged or uploaded
  const allRequiredStaged = filesToUpload
    .filter((f) => !f.isOptional)
    .every(
      (f) =>
        stagedFiles.some((sf) => sf.expectedFileName === f.nome) || uploadedFiles.some((uf) => uf.nome === f.nome)
    );

  return (
    <div className="flex flex-col gap-6">
      <StatCardGrid>
        <StatCard densita="compatta" icona="Files" tono="info" etichetta="File richiesti" valore={stats.total} />
        <StatCard densita="compatta" icona="FileCheck" tono="success" etichetta="Già caricati" valore={stats.uploaded} />
        <StatCard densita="compatta" icona="Clock" tono="warning" etichetta="Pronti per upload" valore={stats.staged} />
        <StatCard densita="compatta" icona="CircleAlert" tono="brand" etichetta="Obbligatori" valore={stats.required} />
      </StatCardGrid>

      {/* Main Upload Area */}
      {filesToUpload.length > 0 && (
        <Sezione
          icona="Upload"
          titolo="Carica file richiesti"
          descrizione="Seleziona i file uno per uno. Formati supportati: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (max 200MB)"
        >
          <div className="space-y-4">
            {filesToUpload.map((file) => {
              const fileKey = file.id || file.nome;
              const stagedFile = stagedFiles.find((sf) => sf.expectedFileName === file.nome);
              const validationError = validationErrors[fileKey];

              return (
                <FileUploadCard
                  key={fileKey}
                  file={file}
                  tipiExport={tipiExport}
                  stagedFile={stagedFile}
                  validationError={validationError}
                  progress={stagedFile?.progress}
                  selectedExportType={selectedExportTypes[fileKey] || ""}
                  onExportTypeChange={(exportType) => handleExportTypeChange(fileKey, exportType)}
                  onFileDrop={(droppedFile) => handleFileDrop(file, droppedFile)}
                  onRemove={() => handleRemoveStaged(file.nome)}
                />
              );
            })}
          </div>

          {/* Footer with batch upload action */}
          {stagedFiles.length > 0 && (
            <div className="mt-5 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row">
              <div className="flex items-center gap-2">
                <Lucide icon="Info" aria-hidden="true" className="h-4 w-4 text-info" />
                <span className="text-sm text-slate-600">
                  <span className="font-semibold text-info">{stagedFiles.length}</span> file pronti per il
                  caricamento
                </span>
                {!allRequiredStaged && (
                  <span className="ml-2 text-sm text-warning">(mancano alcuni file obbligatori)</span>
                )}
              </div>
              <PermissionGate permission={PERMISSIONS.FILE.UPLOAD_MATERIALE} mode="disable">
                <Button
                  variant="primary"
                  onClick={handleUploadAll}
                  disabled={stagedFiles.length === 0}
                  loading={isUploading}
                >
                  {!isUploading && <Lucide icon="Upload" aria-hidden="true" className="mr-2 h-4 w-4" />}
                  {isUploading ? "Caricamento in corso…" : `Carica tutti (${stagedFiles.length})`}
                </Button>
              </PermissionGate>
            </div>
          )}
        </Sezione>
      )}

      {/* Empty state when no files to upload */}
      {filesToUpload.length === 0 && uploadedFiles.length === 0 && (
        <Sezione>
          <EmptyState
            compatta
            icon="FileQuestionMark"
            title="Nessun file richiesto"
            description="Non ci sono file da caricare per questa lavorazione."
          />
        </Sezione>
      )}

      {/* All files uploaded */}
      {filesToUpload.length === 0 && uploadedFiles.length > 0 && (
        <Sezione>
          <EmptyState
            compatta
            icon="CircleCheck"
            iconColor="text-success"
            title="Tutti i file sono stati caricati"
            description={`${uploadedFiles.length} file caricati con successo`}
          />
        </Sezione>
      )}
    </div>
  );
};

export default FileUploader;
