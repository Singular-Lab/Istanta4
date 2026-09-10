import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Dropzone, { DropzoneElement } from "@/components/Base/Dropzone";
import { FormSelect } from "@/components/Base/Form";
import LoadingIcon from "@/components/Base/LoadingIcon";
import Lucide from "@/components/Base/Lucide";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import Skeleton from "@/components/Base/Skeleton";
import clsx from "clsx";
import { DropzoneOptions } from "dropzone";
import { FC, useCallback, useMemo, useRef, useState } from "react";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";
import { StatCard } from "../components";
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
      init() {
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
      className={clsx("border rounded-xl p-4 transition-all", {
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
            className={clsx("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", {
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
            <span className="font-medium text-slate-800">{file.nome}</span>
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
            className="flex-1 dropzone border-2 border-dashed border-slate-300 rounded-xl hover:border-primary transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2 py-4 px-3">
              <Lucide icon="Upload" className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-600">Trascina qui o clicca per selezionare</span>
            </div>
          </Dropzone>
        )}
      </div>

      {/* File staged preview */}
      {stagedFile && !isError && (
        <div className="mt-4 flex items-center justify-between bg-success/10 p-3 rounded-lg border border-success/20">
          <div className="flex items-center gap-3">
            <Lucide icon="FileCheck" className="w-5 h-5 text-success" />
            <div>
              <span className="font-medium text-success">{stagedFile.file.name}</span>
              <span className="text-sm text-slate-500 ml-2">({formatFileSize(stagedFile.file.size)})</span>
            </div>
          </div>
          <Button variant="soft-danger" size="sm" className="p-1.5" onClick={onRemove}>
            <Lucide icon="X" className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="mt-4 flex items-center gap-2 text-danger text-sm bg-danger/5 p-3 rounded-lg border border-danger/20">
          <Lucide icon="CircleAlert" className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-primary font-medium">Caricamento in corso...</span>
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
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="80px" className="rounded-xl" />
          ))}
        </div>
        <Skeleton height="300px" className="rounded-xl" />
      </div>
    );
  }

  // Automatic workflow - files are managed by the system
  if (isAutomatic) {
    return (
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon="Files"
            iconBg="bg-info/10"
            iconColor="text-info"
            value={filesData.length}
            label="File totali"
          />
          <StatCard
            icon="FileCheck"
            iconBg="bg-success/10"
            iconColor="text-success"
            value={uploadedFiles.length}
            label="File generati"
          />
          <StatCard
            icon="Clock"
            iconBg="bg-warning/10"
            iconColor="text-warning"
            value={filesToUpload.length}
            label="In attesa"
          />
          <StatCard
            icon="Bot"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            value="Auto"
            label="Gestione"
          />
        </div>

        {/* Automatic workflow info box */}
        <div className="box box--stacked p-6">
          <div className="text-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
              <Lucide icon="Bot" className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Lavorazione Automatica</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              I file per questa lavorazione vengono generati e caricati automaticamente dal sistema.
              Non è richiesto alcun intervento manuale.
            </p>
            {filesToUpload.length > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warning/10 text-warning">
                <Lucide icon="Clock" className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {filesToUpload.length} file in attesa di generazione
                </span>
              </div>
            )}
            {filesToUpload.length === 0 && uploadedFiles.length > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success/10 text-success">
                <Lucide icon="CircleCheck" className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Tutti i file sono stati generati ({uploadedFiles.length})
                </span>
              </div>
            )}
          </div>
        </div>
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
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon="Files"
          iconBg="bg-info/10"
          iconColor="text-info"
          value={stats.total}
          label="File richiesti"
        />
        <StatCard
          icon="FileCheck"
          iconBg="bg-success/10"
          iconColor="text-success"
          value={stats.uploaded}
          label="Già caricati"
        />
        <StatCard
          icon="Clock"
          iconBg="bg-warning/10"
          iconColor="text-warning"
          value={stats.staged}
          label="Pronti per upload"
        />
        <StatCard
          icon="CircleAlert"
          iconBg="bg-primary/10"
          iconColor="text-primary"
          value={stats.required}
          label="Obbligatori"
        />
      </div>

      {/* Main Upload Area */}
      {filesToUpload.length > 0 && (
        <div className="box box--stacked p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
              <Lucide icon="Upload" className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Carica File Richiesti</h3>
              <p className="text-xs text-slate-500">
                Seleziona i file uno per uno. Formati supportati: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (max 200MB)
              </p>
            </div>
          </div>

          {/* File Cards */}
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
            <div className="border-t border-slate-200 pt-5 mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lucide icon="Info" className="w-4 h-4 text-info" />
                <span className="text-sm text-slate-600">
                  <span className="font-semibold text-info">{stagedFiles.length}</span> file pronti per il
                  caricamento
                </span>
                {!allRequiredStaged && (
                  <span className="text-sm text-warning ml-2">
                    (mancano alcuni file obbligatori)
                  </span>
                )}
              </div>
              <PermissionGate permission={PERMISSIONS.FILE.UPLOAD_MATERIALE} mode="disable">
                <Button
                  variant="primary"
                  onClick={handleUploadAll}
                  disabled={isUploading || stagedFiles.length === 0}
                >
                  {isUploading ? (
                    <>
                      <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                      Caricamento in corso...
                    </>
                  ) : (
                    <>
                      <Lucide icon="Upload" className="w-4 h-4 mr-2" />
                      Carica Tutti ({stagedFiles.length})
                    </>
                  )}
                </Button>
              </PermissionGate>
            </div>
          )}
        </div>
      )}

      {/* Empty state when no files to upload */}
      {filesToUpload.length === 0 && uploadedFiles.length === 0 && (
        <div className="box box--stacked p-6">
          <div className="text-center py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 mx-auto mb-4">
              <Lucide icon="FileQuestion" className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">Nessun file richiesto</h3>
            <p className="text-sm text-slate-500 mt-1">
              Non ci sono file da caricare per questa lavorazione.
            </p>
          </div>
        </div>
      )}

      {/* All files uploaded */}
      {filesToUpload.length === 0 && uploadedFiles.length > 0 && (
        <div className="box box--stacked p-6">
          <div className="text-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 mx-auto mb-4">
              <Lucide icon="CircleCheck" className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-base font-semibold text-success">Tutti i file sono stati caricati</h3>
            <p className="text-sm text-slate-500 mt-1">
              {uploadedFiles.length} file caricati con successo
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
