import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import KitViewTabs from "@/components/KitViewTabs";
import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import clsx from "clsx";
import React, { Fragment, useEffect, useState } from "react";
import { useLoaderData, useParams, useRevalidator } from "react-router-dom";
import { EXPORT_DI_SISTEMA, STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { DESIGN_KIT_MONGO, FileItemKit, RUNTIME_KIT_MONGO } from "../../../lib/types";

// Import componenti condivisi da DettaglioSingolaLavorazione
import ComponentFooter from "../DettaglioSingolaLavorazione/components/ComponentFooter";
import { LavorazioneProvider, useLavorazione } from "../DettaglioSingolaLavorazione/context/LavorazioneContext";
import DeleteProcessingDialog from "../DettaglioSingolaLavorazione/dialogs/DeleteProcessingDialog";
import PubblicaKitRuntimeDialog from "../DettaglioSingolaLavorazione/dialogs/PubblicaKitRuntimeDialog";
import RilavoraDialog from "../DettaglioSingolaLavorazione/dialogs/RilavoraDialog";
import RiportaInLavorazioneDialog from "../DettaglioSingolaLavorazione/dialogs/RiportaInLavorazioneDialog";
import StartProcessingDialog from "../DettaglioSingolaLavorazione/dialogs/StartProcessingDialog";
import StartRevisionDialog from "../DettaglioSingolaLavorazione/dialogs/StartRevisionDialog";
import UploadErroriDialog from "../DettaglioSingolaLavorazione/dialogs/UploadErroriDialog";
import useAutomaticoLogic from "../DettaglioSingolaLavorazione/hooks/useAutomaticoLogic";
import { FileUpload, LavorazioneType, StagedFile } from "../DettaglioSingolaLavorazione/types";
import ManualeWorkflow from "../DettaglioSingolaLavorazione/workflows/ManualeWorkflow";

// Import KitOverviewPublished per la vista scheda (senza FlyerInsights)
import { KitOverviewPublished } from "@/components/KitOverviewPublished";

/**
 * KitPopDettaglio - Pagina dedicata per kit POP
 *
 * Differenze rispetto a DettaglioSingolaLavorazione per Volantini:
 * - NON include FlyerInsights
 * - NON include ReferenzeInVolantinoBox
 * - Usa lo stesso workflow completo (stati: IN_LAVORAZIONE, IN_REVISIONE, PUBBLICATO)
 * - Supporta sia kit MANUALE che AUTOMATICO
 */

const KitPopDettaglioContent: React.FC<{
  kit: LavorazioneType;
  filesData: FileItemKit[];
  isLoadingFiles: boolean;
  correggoExport: string | null;
  correggoFile: FileItemKit | undefined;
  abortController: AbortController;
}> = ({
  kit,
  filesData,
  isLoadingFiles,
  correggoExport,
  correggoFile,
  abortController,
}) => {
  const lavorazione = kit;
  const { state, dispatch } = useLavorazione();
  const isManuale = lavorazione.tipo === TIPO_KIT_DESIGN.MANUALE;

  // --- STATO PER TAB SCHEDA/LAVORAZIONE ---
  const [viewTab, setViewTab] = useState<'scheda' | 'lavorazione'>('lavorazione');

  // --- STATI E HOOKS COMUNI ---
  const [lavorazioneStarted, setLavorazioneStarted] = useState(lavorazione.lavorazioneStarted);
  const [dialogOpenInizioLavorazione, setDialogOpenInizioLavorazione] = useState(false);
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  useEffect(() => {
    setLavorazioneStarted(lavorazione.lavorazioneStarted);
  }, [lavorazione]);

  // --- MUTATIONS COMUNI ---
  const mutationStartLavorazione = useMutation<any, Error, string>({
    mutationKey: ["startLavorazione", lavorazione.guidId],
    mutationFn: async (idPromo: string) => {
      const response = await ServerCall.put("/getKitByPromo", {
        id: lavorazione.guidId,
        idPromo,
        idCanale: lavorazione.guidCanale,
        idArea: lavorazione.guidArea,
        idFormato: (lavorazione as DESIGN_KIT_MONGO).guidFormato,
        idPV: (lavorazione as DESIGN_KIT_MONGO).guidPv ?? null,
        lettura: false,
      });
      return response;
    },
    onSuccess: () => {
      showNotification("Lavorazione avviata con successo", { variant: "success" });
      revalidator.revalidate();
    },
    onError: () => {
      showNotification("Errore durante l'avvio della lavorazione", { variant: "error" });
    },
  });

  // --- STATI E HOOKS PER KIT ---
  const [dialogOpenRiportaInLavorazione, setDialogOpenRiportaInLavorazione] = useState(false);
  const [dialogOpenAvvioRevisione, setDialogOpenAvvioRevisione] = useState(false);
  const [dialogOpenRevisioneConErrori, setDialogOpenRevisioneConErrori] = useState(false);
  const [dialogOpenEliminaLavorazione, setDialogOpenEliminaLavorazione] = useState(false);
  const [dialogOpenPubblicaKitRuntime, setDialogOpenPubblicaKitRuntime] = useState(false);
  const [dialogOpenRilavora, setDialogOpenRilavora] = useState(false);

  const [selectedFile, setSelectedFile] = useState<FileItemKit | null>(null);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [managedFiles, setManagedFiles] = useState<FileItemKit[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedFileForHistory, setSelectedFileForHistory] = useState<FileItemKit | null>(null);

  const [exportTypes, setExportTypes] = useState<string[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Effetti specifici
  useEffect(() => {
    if (isManuale) {
      const placeholderFiles = lavorazione?.files || [];
      const uploadedFiles = filesData || [];
      const uploadedFilesMap = new Map(uploadedFiles.map(f => [f.nome, f]));

      const mergedFiles = placeholderFiles.map(placeholder => {
        const uploadedFile = uploadedFilesMap.get(placeholder.nome);
        return uploadedFile ? { ...placeholder, ...uploadedFile } : placeholder;
      }).map(f => ({
        ...f,
        tipo_export: f.tipo_export || '',
        log: f.log || undefined,
      }));

      setManagedFiles(mergedFiles);
    } else {
      if (lavorazione.tipiDiExportInKit) {
        setExportTypes(lavorazione.tipiDiExportInKit.map((tipo: any) => tipo.codice));
      }
    }
  }, [lavorazione, isManuale, filesData]);

  // Funzione per invalidare manualmente la query dei file
  const invalidateFilesQuery = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["getFilesPerGestioneLavorazione", lavorazione.guidId] });
  }, [queryClient, lavorazione.guidId]);

  // --- LOGICA PER KIT ---
  const { idPromo } = useParams();
  const kitLogic = useAutomaticoLogic({
    isManuale,
    revalidator,
    lavorazione,
    filesAccepted: state.accepted,
    filesRejected: state.rejected,
    rejectionReasons: state.rejectionReasons,
    dispatch,
    abortController,
    filesData,
    invalidateFilesQuery,
    correggoFile,
  });

  const badgeTipo = isManuale
    ? { text: "Manuale", icon: "FileDigit", className: "bg-orange-100 text-orange-700 border border-orange-200" }
    : { text: "Automatico", icon: "Zap", className: "bg-blue-100 text-blue-700 border border-blue-200" };

  const handleShowHistory = (file: FileItemKit) => {
    setSelectedFileForHistory(file);
    setHistoryModalOpen(true);
  };

  const mutationDownloadZip = useMutation<any, Error, { lavorazioneId: string; files: any[] }>({
    mutationKey: ["downloadKitZip", lavorazione.guidId],
    mutationFn: async (data: { lavorazioneId: string; files: any[] }) => {
      const url = `${ServerCall.getUrl()}/downloadKitZip`;
      const response = await axios.post(url, data, {
        responseType: 'blob',
        withCredentials: true,
      });
      return { data: response.data, fileCount: data.files.length };
    },
    onMutate: (variables) => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="Download" className="w-4 h-4 text-primary" />
          <span>Download avviato per kit_{lavorazione.titolo}.zip ({variables.files.length} file)</span>
        </div>,
        { variant: "info" }
      );
    },
    onSuccess: (result) => {
      const url = window.URL.createObjectURL(new Blob([result.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `kit_${lavorazione.titolo}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="FileCheck" className="w-4 h-4 text-success" />
          <span>Download completato per lo zip di kit_{lavorazione.titolo}.zip ({result.fileCount} file)</span>
        </div>,
        { variant: "success" }
      );
    },
    onError: () => {
      showNotification("Errore durante il download del kit.", { variant: "error" });
    },
  });

  // --- COMPONENTI UI ---
  const ProcessingOverlay = () =>
    !lavorazioneStarted && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-lg backdrop-blur-sm z-10">
        <div className="text-center text-slate-700 mb-4">
          <Lucide icon={isManuale ? "FileText" : "Zap"} className="w-16 h-16 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">Lavorazione non avviata</h3>
          <p className="text-sm mb-5 max-w-md">
            {isManuale
              ? "È necessario avviare la lavorazione prima di poter caricare o gestire i file per questo kit POP."
              : "È necessario avviare la lavorazione prima di poter procedere con questo kit POP automatico."}
          </p>
          {!isManuale && exportTypes && exportTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {exportTypes.map((exportType, index) => (
                <span key={index} className="bg-primary/20 text-primary px-2 py-1 rounded-md text-xs">
                  {exportType}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button variant="primary" onClick={() => setDialogOpenInizioLavorazione(true)}>
          <Lucide icon="Play" className="w-5 h-5 mr-2" />
          Avvia Lavorazione
        </Button>
      </div>
    );

  // Render del workflow (semplificato senza FlyerInsights)
  const RenderWorkflow = React.useCallback(() => {
    // Per POP usiamo sempre ManualeWorkflow per la gestione file
    // (anche per kit automatici, la differenza è nei file generati automaticamente)
    return (
      <div className="relative box p-5 h-full min-h-[500px] flex flex-col overflow-y-auto">
        {!lavorazioneStarted && <ProcessingOverlay />}
        <div className="flex-grow">
          <ManualeWorkflow
            lavorazione={lavorazione}
            manuale={kitLogic}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            managedFiles={managedFiles}
            uploads={uploads}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            isUpdating={isUpdating}
            handleShowHistory={handleShowHistory}
          />
        </div>
      </div>
    );
  }, [lavorazioneStarted, lavorazione, kitLogic, searchQuery, activeTab, managedFiles, uploads, selectedFile, isUpdating]);

  const groupedFilesForFooter = React.useMemo(() => {
    return {
      uploaded: managedFiles?.filter(f => f.id_olimpo_cloud) || [],
      pendingUpload: managedFiles?.filter(f => !f.id_olimpo_cloud) || [],
      notUploaded: [],
      allFilesUploaded: managedFiles?.every(f => f.id_olimpo_cloud) || false,
    };
  }, [managedFiles]);

  return (
    <div className="relative">
      <StartProcessingDialog
        dialogOpen={dialogOpenInizioLavorazione}
        setDialogOpen={setDialogOpenInizioLavorazione}
        lavorazione={lavorazione}
        mutationStartLavorazione={mutationStartLavorazione as any}
        idPromo={idPromo || ""}
        isManuale={isManuale}
      />

      <DeleteProcessingDialog
        mutationEliminaLavorazione={kitLogic.mutationEliminaLavorazione as any}
        dialogOpen={dialogOpenEliminaLavorazione}
        setDialogOpen={setDialogOpenEliminaLavorazione}
        lavorazione={lavorazione}
      />
      <StartRevisionDialog
        mutationAvvioRevisione={kitLogic.mutationAvvioRevisione as any}
        dialogOpen={dialogOpenAvvioRevisione}
        setDialogOpen={setDialogOpenAvvioRevisione}
        lavorazione={lavorazione}
      />
      <RiportaInLavorazioneDialog
        lavorazione={lavorazione}
        mutationRiportaInLavorazione={kitLogic.mutationRiportaInLavorazione as any}
        dialogOpen={dialogOpenRiportaInLavorazione}
        setDialogOpen={setDialogOpenRiportaInLavorazione}
        filesAccepted={state.accepted}
        filesRejected={state.rejected}
      />
      <PubblicaKitRuntimeDialog
        mutationPubblicaKitRuntime={kitLogic.mutationPubblicaKitRuntime as any}
        dialogOpen={dialogOpenPubblicaKitRuntime}
        setDialogOpen={setDialogOpenPubblicaKitRuntime}
        lavorazione={lavorazione}
      />
      <RilavoraDialog
        mutationRilavora={kitLogic.mutationRilavora as any}
        dialogOpen={dialogOpenRilavora}
        setDialogOpen={setDialogOpenRilavora}
        lavorazione={lavorazione}
      />
      <UploadErroriDialog
        dialogOpen={dialogOpenRevisioneConErrori}
        setDialogOpen={setDialogOpenRevisioneConErrori}
        lavorazione={lavorazione}
        filesRejected={state.rejected}
        mutationRiportaInLavorazione={kitLogic.mutationRiportaInLavorazione as any}
        stagedFiles={stagedFiles}
      />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <PageHeader title={lavorazione?.titolo || "N/D"} description="Kit POP - Gestione lavorazione" />
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium bg-amber-100 text-amber-700">
            <Lucide icon="Package" className="w-4 h-4" />
            POP
          </span>
        </div>
      </div>

      {/* Tab Scheda / Lavorazione */}
      <KitViewTabs activeTab={viewTab} onTabChange={setViewTab} tipoKit={lavorazione.tipo} />

      {/* Contenuto in base al tab selezionato */}
      {viewTab === 'scheda' ? (
        <KitOverviewPublished
          lavorazione={lavorazione as RUNTIME_KIT_MONGO}
          filesData={filesData}
          isLoadingFiles={isLoadingFiles}
          exportTypes={exportTypes}
          tipiDiExportInKit={lavorazione.tipiDiExportInKit || []}
          onDownloadZip={() =>
            mutationDownloadZip.mutate({
              lavorazioneId: lavorazione.guidId,
              files: filesData || [],
            })
          }
          isDownloading={mutationDownloadZip.isPending}
        />
      ) : (
        <RenderWorkflow />
      )}

      {viewTab === 'lavorazione' &&
        lavorazioneStarted &&
        (lavorazione as any).stato_lavorazione !== STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO && (
          <ComponentFooter
            lavorazioneStarted={lavorazioneStarted}
            lavorazione={lavorazione}
            filesData={filesData}
            groupedFiles={groupedFilesForFooter}
            setDialogOpenAvvioRevisione={setDialogOpenAvvioRevisione}
            setDialogOpenEliminaLavorazione={setDialogOpenEliminaLavorazione}
            setDialogOpenPubblicaKitRuntime={setDialogOpenPubblicaKitRuntime}
            setDialogOpenRiportaInLavorazione={setDialogOpenRiportaInLavorazione}
            setDialogOpenRilavora={setDialogOpenRilavora}
            setDialogOpenRevisioneConErrori={setDialogOpenRevisioneConErrori}
            correggoFile={state.correggoFile}
          />
        )}
    </div>
  );
};

const KitPopDettaglio: React.FC = () => {
  const { kit: lavorazione } = useLoaderData() as { kit: LavorazioneType };
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ["getFilesPerGestioneLavorazione", lavorazione.guidId],
    queryFn: async () => {
      const response = await ServerCall.get<FileItemKit[]>(`/getFilesPerGestioneLavorazione/${lavorazione.guidId}`);
      return response;
    },
    enabled: !!lavorazione.guidId,
    staleTime: 0,
  });

  useEffect(() => {
    const newController = new AbortController();
    setAbortController(newController);
    return () => {
      newController.abort();
    };
  }, []);

  // Gestione file "correggo"
  const correggoExport = React.useMemo(() => {
    return lavorazione?.tipiExport?.find((tipo) => tipo.codice_tipiexport === EXPORT_DI_SISTEMA.CORREGGO)?.id_tipiexport ?? null;
  }, [lavorazione?.tipiExport]);

  const correggoFiles = React.useMemo(() => {
    if (!filesData || !correggoExport) return undefined;
    const fileCorreggo = filesData.find(file => file.tipo_export === correggoExport);
    if (!fileCorreggo) return undefined;
    return fileCorreggo;
  }, [filesData, correggoExport]);

  const filesDataSenzaCorreggo = React.useMemo(() => {
    if (!filesData || !correggoExport) return filesData || [];
    return filesData.filter(file => file.tipo_export !== correggoExport);
  }, [filesData, correggoExport]);

  return (
    <LavorazioneProvider
      lavorazione={lavorazione}
      filesData={filesDataSenzaCorreggo}
      isLoading={isLoadingFiles}
      correggoFile={correggoFiles}
    >
      <KitPopDettaglioContent
        kit={lavorazione}
        filesData={filesDataSenzaCorreggo}
        isLoadingFiles={isLoadingFiles}
        correggoExport={correggoExport}
        correggoFile={correggoFiles}
        abortController={abortController as AbortController}
      />
    </LavorazioneProvider>
  );
};

export default withSessionCheck(KitPopDettaglio);
