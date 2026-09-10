import Skeleton from "@/components/Base/Skeleton";
import { KitOverviewLayout, KitPreStartView } from "@/components/KitOverview";
import withSessionCheck from "@/components/SessionChecker";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useLoaderData, useParams } from "react-router-dom";
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN, TIPO_LAVORAZIONE } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { FileItemKit, RUNTIME_KIT_MONGO } from "../../../lib/types";
import { KitProvider, KitType, useKit } from "./context/KitContext";
import useKitLogic from "./hooks/useKitLogic";

// Import dialogs from existing page (will be reused)
import DeleteProcessingDialog from "../DettaglioSingolaLavorazione/dialogs/DeleteProcessingDialog";
import PubblicaKitRuntimeDialog from "../DettaglioSingolaLavorazione/dialogs/PubblicaKitRuntimeDialog";
import RilavoraDialog from "../DettaglioSingolaLavorazione/dialogs/RilavoraDialog";
import RiportaInLavorazioneDialog from "../DettaglioSingolaLavorazione/dialogs/RiportaInLavorazioneDialog";
import StartProcessingDialog from "../DettaglioSingolaLavorazione/dialogs/StartProcessingDialog";
import StartRevisionDialog from "../DettaglioSingolaLavorazione/dialogs/StartRevisionDialog";
import UploadErroriDialog from "../DettaglioSingolaLavorazione/dialogs/UploadErroriDialog";

/**
 * DettaglioKitContent - Contenuto principale della pagina
 *
 * Utilizza il nuovo KitOverviewLayout unificato che gestisce
 * tutti gli stati del kit con un'unica vista.
 */
const DettaglioKitContent: React.FC<{
  kit: KitType;
  filesData: FileItemKit[];
  isLoadingFiles: boolean;
  correggoFile?: FileItemKit;
  abortController: AbortController;
}> = ({ kit, filesData, isLoadingFiles, correggoFile, abortController }) => {
  const { state, toggleAccept, toggleReject, acceptAll, undoAll, setStagedFiles } = useKit();

  // Dialog states
  const [dialogOpenInizioLavorazione, setDialogOpenInizioLavorazione] = useState(false);
  const [dialogOpenAvvioRevisione, setDialogOpenAvvioRevisione] = useState(false);
  const [dialogOpenRevisioneConErrori, setDialogOpenRevisioneConErrori] = useState(false);
  const [dialogOpenEliminaLavorazione, setDialogOpenEliminaLavorazione] = useState(false);
  const [dialogOpenPubblicaKitRuntime, setDialogOpenPubblicaKitRuntime] = useState(false);
  const [dialogOpenRiportaInLavorazione, setDialogOpenRiportaInLavorazione] = useState(false);
  const [dialogOpenRilavora, setDialogOpenRilavora] = useState(false);

  // Kit logic hook
  const {
    mutationStartLavorazione,
    mutationAvvioRevisione,
    mutationPubblicaKitRuntime,
    mutationRiportaInLavorazione,
    mutationEliminaLavorazione,
    mutationRilavora,
    mutationDownloadZip,
    mutationUploadMateriale,
    mutationEliminaFile,
    handleDownloadZip,
    handleDownloadSingleFile,
  } = useKitLogic({ kit, abortController });

  // Lavorazione state
  const [lavorazioneStarted, setLavorazioneStarted] = useState(kit.lavorazioneStarted ?? false);
  const { idPromo } = useParams();

  useEffect(() => {
    setLavorazioneStarted(kit.lavorazioneStarted ?? false);
  }, [kit]);

  // Determine kit type
  const isManuale = kit.tipo === TIPO_KIT_DESIGN.MANUALE;
  const stato = (kit as any).stato_lavorazione || STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE;

  // Nomi per la visualizzazione
  const exportTypes = useMemo(() => {
    return kit.tipiExport?.map((tipo) => tipo.nome_tipiexport) ?? [];
  }, [kit.tipiExport]);

  // Codici per i controlli di sistema (VOL, CORREGGO, ecc.)
  const exportCodes = useMemo(() => {
    return kit.tipiExport?.map((tipo) => tipo.codice_tipiexport) ?? [];
  }, [kit.tipiExport]);

  // Determine tipo lavorazione (VOLANTINO vs POP) — usa i codici, non i nomi
  const tipoLavorazione = useMemo(() => {
    const hasVol = kit.tipiExport?.some((tipo) => tipo.codice_tipiexport === EXPORT_DI_SISTEMA.VOL) ?? false;
    return hasVol ? TIPO_LAVORAZIONE.VOLANTINO : TIPO_LAVORAZIONE.POP;
  }, [kit.tipiExport]);

  // Badge for kit type (kept for potential future use)
  const badgeTipo = isManuale
    ? { text: "Manuale", icon: "FileDigit", className: "bg-orange-100 text-orange-700 border border-orange-200" }
    : { text: "Automatico", icon: "Zap", className: "bg-blue-100 text-blue-700 border border-blue-200" };

  // Handlers for actions
  const handleStartRevision = () => setDialogOpenAvvioRevisione(true);
  const handlePublish = () => setDialogOpenPubblicaKitRuntime(true);
  const handleRejectAndRework = () => setDialogOpenRiportaInLavorazione(true);
  const handleDelete = () => setDialogOpenEliminaLavorazione(true);
  const handleRework = () => setDialogOpenRilavora(true);

  // Handler per upload file batch
  const handleFileUpload = async (files: Array<{ file: File; nome: string; direttive: string; isOptional: boolean; tipo_export: string }>) => {
    if (!files || files.length === 0) return;

    // Creo gli oggetti con ID temporanei per la mutation
    const filesWithIds = files.map((f, index) => ({
      ...f,
      id: `temp_${Date.now()}_${index}`,
    }));

    await mutationUploadMateriale.mutateAsync({ files: filesWithIds });
  };

  // Handler per eliminare un singolo file
  const handleFileDelete = async (fileId: string) => {
    if (!fileId) return;
    await mutationEliminaFile.mutateAsync(fileId);
  };

  // Handler per download singolo file
  const handleDownloadFile = (file: FileItemKit) => {
    handleDownloadSingleFile(file);
  };

  const handleAcceptFile = (file: FileItemKit) => {
    toggleAccept(file);
  };

  const handleRejectFile = (file: FileItemKit, reason: string) => {
    toggleReject(file, reason);
  };

  const handleAcceptAllFiles = () => {
    acceptAll(filesData || []);
  };

  const handleUndoAllFiles = () => {
    undoAll();
  };

  // Loading state
  if (isLoadingFiles && !filesData) {
    return (
      <div className="space-y-6">
        <Skeleton height="80px" className="rounded-xl" />
        <Skeleton height="200px" className="rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} height="100px" className="rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Dialogs */}
      <StartProcessingDialog
        dialogOpen={dialogOpenInizioLavorazione}
        setDialogOpen={setDialogOpenInizioLavorazione}
        lavorazione={kit as any}
        mutationStartLavorazione={mutationStartLavorazione as any}
        idPromo={idPromo || ""}
        isManuale={isManuale}
      />
      <DeleteProcessingDialog
        mutationEliminaLavorazione={mutationEliminaLavorazione as any}
        dialogOpen={dialogOpenEliminaLavorazione}
        setDialogOpen={setDialogOpenEliminaLavorazione}
        lavorazione={kit as any}
      />
      <StartRevisionDialog
        mutationAvvioRevisione={mutationAvvioRevisione as any}
        dialogOpen={dialogOpenAvvioRevisione}
        setDialogOpen={setDialogOpenAvvioRevisione}
        lavorazione={kit as any}
      />
      <RiportaInLavorazioneDialog
        lavorazione={kit as any}
        mutationRiportaInLavorazione={mutationRiportaInLavorazione as any}
        dialogOpen={dialogOpenRiportaInLavorazione}
        setDialogOpen={setDialogOpenRiportaInLavorazione}
        filesAccepted={state.accepted}
        filesRejected={state.rejected}
      />
      <PubblicaKitRuntimeDialog
        mutationPubblicaKitRuntime={mutationPubblicaKitRuntime as any}
        dialogOpen={dialogOpenPubblicaKitRuntime}
        setDialogOpen={setDialogOpenPubblicaKitRuntime}
        lavorazione={kit as any}
      />
      <RilavoraDialog
        mutationRilavora={mutationRilavora as any}
        dialogOpen={dialogOpenRilavora}
        setDialogOpen={setDialogOpenRilavora}
        lavorazione={kit as any}
      />
      <UploadErroriDialog
        dialogOpen={dialogOpenRevisioneConErrori}
        setDialogOpen={setDialogOpenRevisioneConErrori}
        lavorazione={kit as any}
        filesRejected={state.rejected}
        mutationRiportaInLavorazione={mutationRiportaInLavorazione as any}
        stagedFiles={state.staged}
      />

      {/* Main Content */}
      {!lavorazioneStarted ? (
        <KitPreStartView
          lavorazione={kit as RUNTIME_KIT_MONGO}
          exportTypes={exportTypes}
          tipiDiExportInKit={kit.tipiDiExportInKit || []}
          isManuale={isManuale}
          tipoLavorazione={tipoLavorazione}
          onStartLavorazione={() => setDialogOpenInizioLavorazione(true)}
          isStarting={mutationStartLavorazione.isPending}
        />
      ) : (
        <KitOverviewLayout
          lavorazione={kit as RUNTIME_KIT_MONGO}
          filesData={filesData}
          isLoadingFiles={isLoadingFiles}
          exportTypes={exportTypes}
          exportCodes={exportCodes}
          tipiDiExportInKit={kit.tipiDiExportInKit || []}
          correggoFile={correggoFile}
          tipoLavorazione={tipoLavorazione}
          onDownloadZip={handleDownloadZip}
          isDownloading={mutationDownloadZip.isPending}
          onStartRevision={handleStartRevision}
          onPublish={handlePublish}
          onRejectAndRework={handleRejectAndRework}
          onDelete={handleDelete}
          onRework={handleRework}
          onFileUpload={handleFileUpload}
          onFileDelete={handleFileDelete}
          onDownloadFile={handleDownloadFile}
          tipiExport={kit.tipiExport}
          onAcceptFile={handleAcceptFile}
          onRejectFile={handleRejectFile}
          onAcceptAllFiles={handleAcceptAllFiles}
          onUndoAllFiles={handleUndoAllFiles}
          acceptedFiles={state.accepted}
          rejectedFiles={state.rejected}
          rejectionReasons={state.rejectionReasons}
          stagedFiles={state.staged}
          setStagedFiles={setStagedFiles}
          isProcessing={
            mutationAvvioRevisione.isPending ||
            mutationPubblicaKitRuntime.isPending ||
            mutationRiportaInLavorazione.isPending ||
            mutationEliminaLavorazione.isPending ||
            mutationRilavora.isPending
          }
        />
      )}
    </div>
  );
};

/**
 * DettaglioKit - Pagina principale per la gestione del kit
 *
 * Questa pagina unifica la visualizzazione di tutti gli stati del kit
 * (IN_LAVORAZIONE, IN_REVISIONE, IN_LAVORAZIONE_CON_ERRORI, PUBBLICATO)
 * usando il nuovo KitOverviewLayout.
 */
const DettaglioKit: React.FC = () => {
  const { kit } = useLoaderData() as { kit: KitType };
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Fetch files (only for runtime kits - when lavorazione has started)
  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ["getFilesPerGestioneLavorazione", kit.guidId],
    queryFn: async () => {
      const response = await ServerCall.get<FileItemKit[]>(
        `/getFilesPerGestioneLavorazione/${kit.guidId}`
      );
      return response;
    },
    enabled: !!kit.guidId && kit.lavorazioneStarted === true,
    staleTime: 0,
  });

  useEffect(() => {
    const newController = new AbortController();
    setAbortController(newController);
    return () => {
      newController.abort();
    };
  }, []);

  // Find correggo export type
  const correggoExport = useMemo(() => {
    return kit?.tipiExport?.find(
      (tipo) => tipo.codice_tipiexport === EXPORT_DI_SISTEMA.CORREGGO
    )?.id_tipiexport ?? null;
  }, [kit?.tipiExport]);

  // Find correggo file
  const correggoFile = useMemo(() => {
    if (!filesData || !correggoExport) return undefined;
    return filesData.find(file => file.tipo_export === correggoExport);
  }, [filesData, correggoExport]);

  // Filter out correggo file from main files
  const filesDataSenzaCorreggo = useMemo(() => {
    if (!filesData || !correggoExport) return filesData || [];
    return filesData.filter(file => file.tipo_export !== correggoExport);
  }, [filesData, correggoExport]);

  if (!abortController) {
    return (
      <div className="flex items-center justify-center h-64">
        <Skeleton height="100%" className="rounded-xl" />
      </div>
    );
  }

  return (
    <KitProvider
      kit={kit}
      filesData={filesDataSenzaCorreggo}
      isLoadingFiles={isLoadingFiles}
      correggoFile={correggoFile}
      autoInitializeFromLogs={true}
    >
      <DettaglioKitContent
        kit={kit}
        filesData={filesDataSenzaCorreggo}
        isLoadingFiles={isLoadingFiles}
        correggoFile={correggoFile}
        abortController={abortController}
      />
    </KitProvider>
  );
};

export default withSessionCheck(DettaglioKit);
