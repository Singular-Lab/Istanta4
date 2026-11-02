import Skeleton from "@/components/Base/Skeleton";
import { useProductionTimer } from "@/hooks/useProductionTimer";
import { FC, useMemo, useState } from "react";
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_LAVORAZIONE } from "../../../lib/enums";
import { FileItemKit } from "../../../lib/types";
import ActionPanel from "./ActionPanel";
import FileSection from "./FileSection";
import {
  CorreggoCard,
  HeroBanner,
  InfoBadges,
  KitInfo,
  ReportStoricoBox,
  StatsGrid,
  Timeline,
  buildTimelineEvents
} from "./components";
import { getStateConfig } from "./config/stateConfig";
import { KitOverviewLayoutProps } from "./types";


/**
 * KitOverviewLayout - Layout unificato per tutti gli stati del Kit
 *
 * Questo componente gestisce la visualizzazione del kit in tutti i suoi stati:
 * - IN_LAVORAZIONE: Upload file
 * - IN_REVISIONE: Revisione file
 * - IN_LAVORAZIONE_CON_ERRORI: Correzione errori
 * - PUBBLICATO: Visualizzazione file pubblicati
 *
 * Il layout è lo stesso per tutti gli stati, cambia solo il contenuto interno
 * in base allo stato della lavorazione.
 *
 * Gli insight di consultazione del volantino vivono nel verticale Volantini, non in Produzione.
 * Qui restano esclusivamente file, stato, anomalie e azioni della lavorazione.
 */
const KitOverviewLayout: FC<KitOverviewLayoutProps> = ({
  lavorazione,
  filesData,
  isLoadingFiles = false,
  exportTypes,
  exportCodes,
  tipiDiExportInKit,
  correggoFile,
  tipoLavorazione,
  // Actions
  onDownloadZip,
  isDownloading = false,
  // State management
  onStartRevision,
  onPublish,
  onRejectAndRework,
  onDelete,
  onRework,
  onFileUpload,
  onFileDelete,
  onDownloadFile,
  onAcceptFile,
  onRejectFile,
  onAcceptAllFiles,
  onUndoAllFiles,
  tipiExport,
  // State data
  acceptedFiles = [],
  rejectedFiles = [],
  rejectionReasons = {},
  stagedFiles = [],
  setStagedFiles,
  // Processing states
  isProcessing = false
}) => {
  const [showAllFiles, setShowAllFiles] = useState(false);

  // Get state from lavorazione
  const stato = lavorazione.stato_lavorazione || STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE;

  // Get configuration for current state
  const stateConfig = getStateConfig(stato);

  // Il report dello storico è un'anomalia operativa della lavorazione, non un insight Marketing.
  const isVolantino = tipoLavorazione === TIPO_LAVORAZIONE.VOLANTINO;
  const hasVolExport = exportCodes.includes(EXPORT_DI_SISTEMA.VOL);
  const hasCorreggoExport = exportCodes.includes(EXPORT_DI_SISTEMA.CORREGGO);
  const origineStoricoReport = isVolantino && hasVolExport ? lavorazione.origineStorico : undefined;

  // Calculate production duration with live timer
  const { formattedDuration: productionDuration, isLive: isTimerLive } = useProductionTimer({
    createdAt: lavorazione.createdAt,
    updatedAt: lavorazione.updatedAt,
    statoLavorazione: stato,
  });

  // Calculate file stats
  const fileStats = useMemo(() => {
    const files: FileItemKit[] = filesData || lavorazione.files || [];
    const byExportType: Record<string, { count: number; pages: number; files: FileItemKit[] }> = {};

    files.forEach((file: FileItemKit) => {
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
      total: files.length,
      totalPages: files.reduce((acc: number, f: FileItemKit) => acc + (f.pages || 0), 0),
      byExportType
    };
  }, [filesData, lavorazione.files, tipiDiExportInKit]);

  // Build timeline events
  const timelineEvents = useMemo(() => {
    const files: FileItemKit[] = filesData || lavorazione.files || [];
    return buildTimelineEvents(lavorazione, files);
  }, [lavorazione, filesData]);

  // Loading state
  if (isLoadingFiles) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton height="200px" className="rounded-card" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height="72px" className="rounded-control" />
          ))}
        </div>
        <Skeleton height="400px" className="rounded-card" />
      </div>
    );
  }

  // Get pending files count for stats
  const pendingCount = (filesData || []).length - acceptedFiles.length - rejectedFiles.length;

  // Calculate error percentage
  const errorPercentage = fileStats.total > 0
    ? Math.round((rejectedFiles.length / fileStats.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Banner */}
      <HeroBanner
        lavorazione={lavorazione}
        stato={stato}
        productionDuration={productionDuration}
        isTimerLive={isTimerLive}
        primaryAction={
          stato === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO && onDownloadZip
            ? {
              label: "Scarica tutto (ZIP)",
              icon: "Download",
              onClick: onDownloadZip,
              loading: isDownloading,
              variant: "primary"
            }
            : undefined
        }
      />

      {/* Stats Grid */}
      <StatsGrid
        filesCount={fileStats.total}
        totalPages={fileStats.totalPages}
        exportTypesCount={exportTypes.length}
        exportTypesList={exportTypes}
        productionDuration={productionDuration}
        isTimerLive={isTimerLive}
        createdAt={lavorazione.createdAt}
        stato={stato}
        acceptedCount={acceptedFiles.length}
        rejectedCount={rejectedFiles.length}
        pendingCount={pendingCount}
        errorPercentage={errorPercentage}
      />

      {/* Info Badges */}
      <InfoBadges
        nomeArea={lavorazione.nomeArea}
        nomeCanale={lavorazione.nomeCanale}
        tipoKit={lavorazione.tipo}
        tipoLavorazione={tipoLavorazione}
        origineStorico={lavorazione.origineStorico}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Main content (2/3) */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {/* Report operativo dell'import, prima dei file da verificare. */}
          {origineStoricoReport && (
            <ReportStoricoBox origineStorico={origineStoricoReport} />
          )}

          {/* File Section */}
          <FileSection
            stato={stato}
            filesData={filesData || []}
            isLoadingFiles={isLoadingFiles}
            tipiDiExportInKit={tipiDiExportInKit}
            tipoLavorazione={tipoLavorazione}
            tipoKit={lavorazione.tipo}
            mode={stateConfig.fileSection.mode}
            onFileUpload={onFileUpload}
            onFileDelete={onFileDelete}
            onDownloadFile={onDownloadFile}
            tipiExport={tipiExport}
            onAccept={onAcceptFile}
            onReject={onRejectFile}
            onAcceptAll={onAcceptAllFiles}
            onUndoAll={onUndoAllFiles}
            acceptedFiles={acceptedFiles}
            rejectedFiles={rejectedFiles}
            rejectionReasons={rejectionReasons}
            stagedFiles={stagedFiles}
            setStagedFiles={setStagedFiles}
            showAllFiles={showAllFiles}
            onToggleShowAll={() => setShowAllFiles(!showAllFiles)}
          />
        </div>

        {/* Right Column - Sidebar (1/3) */}
        <div className="flex flex-col gap-6">
          {/* Correggo Card - Only when CORREGGO export is present */}
          {hasCorreggoExport && (
            <CorreggoCard
              correggoFile={correggoFile}
              filesData={filesData || lavorazione.files || []}
              tipiDiExportInKit={tipiDiExportInKit}
            />
          )}

          {/* Timeline */}
          <Timeline events={timelineEvents} maxItems={5} />

          {/* Kit Info */}
          <KitInfo lavorazione={lavorazione} />

          {/* Action Panel */}
          <ActionPanel
            stato={stato}
            tipoKit={lavorazione.tipo}
            lavorazione={lavorazione}
            canProceed={fileStats.total > 0}
            hasAccepted={acceptedFiles.length > 0}
            hasRejected={rejectedFiles.length > 0}
            filesCount={fileStats.total}
            acceptedCount={acceptedFiles.length}
            rejectedCount={rejectedFiles.length}
            stagedFilesCount={stagedFiles.length}
            onStartRevision={onStartRevision || (() => { })}
            onPublish={onPublish || (() => { })}
            onRejectAndRework={onRejectAndRework || (() => { })}
            onDelete={onDelete || (() => { })}
            onRework={onRework || (() => { })}
            onDownloadZip={onDownloadZip}
            isProcessing={isProcessing}
            isDownloading={isDownloading}
          />
        </div>
      </div>
    </div>
  );
};

export default KitOverviewLayout;
