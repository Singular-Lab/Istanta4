import type { FlyerInsights, FlyerInsightsConfig, ReferenzaPosizione } from "@/types/flyerInsights";
import type { icons } from "lucide-react";
import { STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN, TIPO_LAVORAZIONE } from "../../../lib/enums";
import { FileItemKit, OggettoTipiDiExport, RUNTIME_KIT_MONGO } from "../../../lib/types";

// ============================================
// HERO BANNER TYPES
// ============================================

export type HeroBannerVariant =
  | "in_lavorazione"
  | "in_revisione"
  | "in_lavorazione_con_errori"
  | "pubblicato";

export interface HeroBannerConfig {
  variant: HeroBannerVariant;
  icon: string;
  title: string;
  subtitle: string;
  gradientClasses: string;
}

export interface HeroBannerAction {
  label: string;
  icon: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline" | "danger" | "success";
}

export interface HeroBannerProps {
  lavorazione: RUNTIME_KIT_MONGO;
  stato: STATO_LAVORAZIONE_KIT_RUNTIME;
  productionDuration?: string | null;
  isTimerLive?: boolean;
  primaryAction?: HeroBannerAction;
  secondaryActions?: HeroBannerAction[];
}

// ============================================
// STATS GRID TYPES
// ============================================

export interface StatCardProps {
  icon: keyof typeof icons;
  iconColor: string;
  iconBg: string;
  value: string | number;
  label: string;
  sublabel?: string;
  isLive?: boolean;
}

export interface StatsGridProps {
  filesCount: number;
  totalPages: number;
  exportTypesCount: number;
  exportTypesList: string[];
  referenzeCount?: number;
  paginAnalizzate?: number;
  productionDuration?: string | null;
  isTimerLive?: boolean;
  createdAt?: Date | string;
  // For IN_REVISIONE state
  acceptedCount?: number;
  rejectedCount?: number;
  pendingCount?: number;
  // For IN_LAVORAZIONE_CON_ERRORI state
  errorPercentage?: number;
  // State for conditional rendering
  stato: STATO_LAVORAZIONE_KIT_RUNTIME;
}

// ============================================
// INFO BADGES TYPES
// ============================================

export type InfoBadgeVariant = "default" | "primary" | "info" | "success" | "warning" | "danger";

export interface InfoBadgeProps {
  icon: string;
  label: string;
  value: string;
  variant?: InfoBadgeVariant;
}

export interface InfoBadgesProps {
  nomeArea?: string;
  nomeCanale?: string;
  tipoKit?: TIPO_KIT_DESIGN | string;
  tipoLavorazione?: TIPO_LAVORAZIONE;
}

// ============================================
// TIMELINE TYPES
// ============================================

export type TimelineEventType = "created" | "upload" | "accepted" | "rejected" | "published" | "revision" | "error";

export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: Date;
  title: string;
  description?: string;
}

export interface TimelineItemProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  isLast?: boolean;
}

export interface TimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
}

// ============================================
// KIT INFO TYPES
// ============================================

export interface KitInfoProps {
  lavorazione: RUNTIME_KIT_MONGO;
}

// ============================================
// KIT PRE-START VIEW TYPES
// ============================================

export interface KitPreStartViewProps {
  lavorazione: RUNTIME_KIT_MONGO;
  exportTypes: string[];
  tipiDiExportInKit: OggettoTipiDiExport[];
  isManuale: boolean;
  tipoLavorazione: TIPO_LAVORAZIONE;
  onStartLavorazione: () => void;
  isStarting?: boolean;
}

// ============================================
// FILE SECTION TYPES
// ============================================

export type FileSectionMode = "view" | "upload" | "revision" | "error-correction";

export interface StagedFile {
  originalFile: FileItemKit;
  newFile: File;
  id: string;
}

// Upload file data for batch upload
export interface UploadFileData {
  file: File;
  nome: string;
  direttive: string;
  isOptional: boolean;
  tipo_export: string;
}

// Staged upload file for FileUploader
export interface StagedUploadFile {
  id: string;
  file: File;
  expectedFileName: string;
  exportType: string;
  direttive: string;
  isOptional: boolean;
  status: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
}

export interface FileStats {
  total: number;
  totalPages: number;
  byExportType: Record<string, {
    count: number;
    pages: number;
    files: FileItemKit[];
  }>;
}

export interface FileSectionProps {
  stato: STATO_LAVORAZIONE_KIT_RUNTIME;
  filesData: FileItemKit[];
  isLoadingFiles: boolean;
  tipiDiExportInKit: OggettoTipiDiExport[];
  tipoLavorazione: TIPO_LAVORAZIONE;
  tipoKit?: TIPO_KIT_DESIGN;
  mode: FileSectionMode;
  // For upload functionality (IN_LAVORAZIONE)
  onFileUpload?: (files: UploadFileData[]) => void;
  onFileDelete?: (fileId: string) => void;
  onFileReplace?: (originalFile: FileItemKit, newFile: File) => void;
  onDownloadFile?: (file: FileItemKit) => void;
  // Tipi export disponibili per selezione
  tipiExport?: Array<{ id_tipiexport: string; codice_tipiexport: string; nome_tipiexport?: string }>;
  // For revision (IN_REVISIONE)
  onAccept?: (file: FileItemKit) => void;
  onReject?: (file: FileItemKit, reason: string) => void;
  onAcceptAll?: () => void;
  onUndoAll?: () => void;
  acceptedFiles?: FileItemKit[];
  rejectedFiles?: FileItemKit[];
  rejectionReasons?: Record<string, string>;
  // For staging (IN_LAVORAZIONE_CON_ERRORI)
  stagedFiles?: StagedFile[];
  setStagedFiles?: (files: StagedFile[]) => void;
  // Common
  showAllFiles?: boolean;
  onToggleShowAll?: () => void;
}

// ============================================
// ACTION PANEL TYPES
// ============================================

export interface ActionPanelProps {
  stato: STATO_LAVORAZIONE_KIT_RUNTIME;
  tipoKit: TIPO_KIT_DESIGN;
  lavorazione: RUNTIME_KIT_MONGO;
  // State-dependent props
  canProceed: boolean;
  hasAccepted: boolean;
  hasRejected: boolean;
  filesCount: number;
  acceptedCount: number;
  rejectedCount: number;
  // For error correction state
  stagedFilesCount?: number;
  // Callbacks
  onStartRevision: () => void;
  onPublish: () => void;
  onRejectAndRework: () => void;
  onDelete: () => void;
  onRework: () => void;
  onDownloadZip?: () => void;
  // Loading states
  isProcessing?: boolean;
  isDownloading?: boolean;
}

// ============================================
// MAIN LAYOUT TYPES
// ============================================

// Re-export FlyerInsights type from centralized types
export type { FlyerInsights, FlyerInsightsConfig, ReferenzaPosizione } from "@/types/flyerInsights";

export interface RepartoGroup {
  sigla: string;
  descrizione: string;
  referenze: ReferenzaPosizione[];
}

export interface KitOverviewLayoutProps {
  lavorazione: RUNTIME_KIT_MONGO;
  filesData?: FileItemKit[];
  isLoadingFiles?: boolean;
  exportTypes: string[];
  exportCodes: string[];
  tipiDiExportInKit: OggettoTipiDiExport[];
  correggoFile?: FileItemKit;
  tipoLavorazione: TIPO_LAVORAZIONE;
  // Insight data (only for VOLANTINO)
  flyerInsights?: FlyerInsights | null;
  isLoadingInsights?: boolean;
  insightsConfig?: FlyerInsightsConfig;
  // Actions
  onDownloadZip?: () => void;
  isDownloading?: boolean;
  // State management callbacks
  onStartRevision?: () => void;
  onPublish?: () => void;
  onRejectAndRework?: () => void;
  onDelete?: () => void;
  onRework?: () => void;
  onFileUpload?: (files: UploadFileData[]) => void;
  onFileDelete?: (fileId: string) => void;
  onDownloadFile?: (file: FileItemKit) => void;
  onAcceptFile?: (file: FileItemKit) => void;
  onRejectFile?: (file: FileItemKit, reason: string) => void;
  onAcceptAllFiles?: () => void;
  onUndoAllFiles?: () => void;
  // Tipi export disponibili per selezione
  tipiExport?: Array<{ id_tipiexport: string; codice_tipiexport: string; nome_tipiexport?: string }>;
  // State data
  acceptedFiles?: FileItemKit[];
  rejectedFiles?: FileItemKit[];
  rejectionReasons?: Record<string, string>;
  stagedFiles?: StagedFile[];
  setStagedFiles?: (files: StagedFile[]) => void;
  // Processing states
  isProcessing?: boolean;
}

// ============================================
// UTILITY FUNCTIONS TYPES
// ============================================

export interface StateConfig {
  hero: {
    icon: keyof typeof icons;
    title: string;
    subtitle: string;
    gradient: string;
  };
  stats: {
    showRevisionStats: boolean;
    showErrorStats: boolean;
  };
  fileSection: {
    mode: FileSectionMode;
    showUploader: boolean;
    showAcceptReject: boolean;
    showStagingArea: boolean;
  };
  actions: {
    primary: string;
    secondary: string[];
  };
}
