import Skeleton from "@/components/Base/Skeleton";
import { FlyerInsights as FlyerInsightsComponent } from "@/components/FlyerInsights";
import ReferenzeInVolantinoBox from "@/components/ReferenzeInVolantinoBox";
import { useProductionTimer } from "@/hooks/useProductionTimer";
import { useFetchFlyerInsights, useFetchFlyerInsightsConfig } from "@/query/query";
import { resolveColor } from "@/utils/flyerInsightsHelpers";
import dayjs from "dayjs";
import "dayjs/locale/it";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
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
  StatsGrid,
  Timeline,
  buildTimelineEvents
} from "./components";
import { getStateConfig } from "./config/stateConfig";
import { KitOverviewLayoutProps, RepartoGroup } from "./types";

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.locale("it");

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
 * Per VOLANTINO (tipo_lavorazione=1): mostra FlyerInsights e ReferenzeInVolantinoBox
 * Per POP (tipo_lavorazione=2): nasconde FlyerInsights e ReferenzeInVolantinoBox
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
  // Insights data (optional - for when we want to pass externally)
  flyerInsights: externalFlyerInsights,
  isLoadingInsights: externalIsLoadingInsights,
  insightsConfig: externalInsightsConfig,
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

  // Determine if we should show VOLANTINO-specific components
  const isVolantino = tipoLavorazione === TIPO_LAVORAZIONE.VOLANTINO;
  const hasVolExport = exportCodes.includes(EXPORT_DI_SISTEMA.VOL);
  const hasCorreggoExport = exportCodes.includes(EXPORT_DI_SISTEMA.CORREGGO);
  const showVolantinoComponents = isVolantino && hasVolExport;

  // Fetch flyer insights (only for VOLANTINO with VOL export)
  const { data: fetchedFlyerInsights, isLoading: isFetchingInsights } = useFetchFlyerInsights(
    showVolantinoComponents ? lavorazione.guidId : ""
  );
  const { data: fetchedInsightsConfig } = useFetchFlyerInsightsConfig();

  // Use external or fetched data
  const flyerInsights = externalFlyerInsights ?? fetchedFlyerInsights;
  const isLoadingInsights = externalIsLoadingInsights ?? isFetchingInsights;
  const insightsConfig = externalInsightsConfig ?? fetchedInsightsConfig;

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

  // Group referenze by reparto (for VOLANTINO)
  const referenzePerReparto = useMemo<RepartoGroup[]>(() => {
    if (!flyerInsights?.referenze || !flyerInsights?.riepilogoReparti) return [];

    const grouped = new Map<string, RepartoGroup>();

    // Initialize groups from reparti
    flyerInsights.riepilogoReparti.forEach(rep => {
      grouped.set(rep.sigla, {
        sigla: rep.sigla,
        descrizione: rep.descrizione,
        referenze: []
      });
    });

    // Group referenze
    flyerInsights.referenze.forEach(ref => {
      const reparto = ref.reparto || 'ALTRO';
      if (!grouped.has(reparto)) {
        grouped.set(reparto, {
          sigla: reparto,
          descrizione: ref.descrizioneReparto || reparto,
          referenze: []
        });
      }
      grouped.get(reparto)!.referenze.push(ref);
    });

    // Filter out empty groups and sort by count
    return Array.from(grouped.values())
      .filter(g => g.referenze.length > 0)
      .sort((a, b) => b.referenze.length - a.referenze.length);
  }, [flyerInsights?.referenze, flyerInsights?.riepilogoReparti]);

  // Build timeline events
  const timelineEvents = useMemo(() => {
    const files: FileItemKit[] = filesData || lavorazione.files || [];
    return buildTimelineEvents(lavorazione, files);
  }, [lavorazione, filesData]);

  // Loading state
  if (isLoadingFiles) {
    return (
      <div className="space-y-6">
        <Skeleton height="200px" className="rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height="100px" className="rounded-xl" />
          ))}
        </div>
        <Skeleton height="400px" className="rounded-xl" />
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
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner
        lavorazione={lavorazione}
        stato={stato}
        productionDuration={productionDuration}
        isTimerLive={isTimerLive}
        primaryAction={
          stato === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO && onDownloadZip
            ? {
              label: "Scarica Tutto (ZIP)",
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
        referenzeCount={flyerInsights?.totaleReferenze}
        paginAnalizzate={flyerInsights?.totalePagine}
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
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main content (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* FlyerInsights - Only for VOLANTINO with VOL export */}
          {showVolantinoComponents && (flyerInsights || isLoadingInsights) && (
            <div className="box box--stacked p-6">
              <FlyerInsightsComponent
                insights={flyerInsights || null}
                isLoading={isLoadingInsights}
                exportCodes={exportCodes}
              />
            </div>
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

          {/* ReferenzeInVolantinoBox - Only for VOLANTINO with VOL export */}
          {showVolantinoComponents && flyerInsights && referenzePerReparto.length > 0 && (
            <ReferenzeInVolantinoBox
              exportTypes={exportCodes}
              referenzePerReparto={referenzePerReparto}
              flyerInsights={flyerInsights}
              insightsConfig={insightsConfig}
              resolveColor={resolveColor}
            />
          )}
        </div>

        {/* Right Column - Sidebar (1/3) */}
        <div className="space-y-6">
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
