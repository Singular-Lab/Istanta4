import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { useNavigate, useRevalidator } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { FileItemKit } from "../../../../lib/types";
import { KitType, useKit } from "../context/KitContext";

interface UseKitLogicProps {
  kit: KitType;
  abortController?: AbortController;
}

/**
 * useKitLogic - Hook unificato per la logica del kit
 *
 * Gestisce tutte le operazioni del kit:
 * - Avvio lavorazione
 * - Avvio revisione
 * - Pubblicazione
 * - Riporto in lavorazione
 * - Eliminazione
 * - Rilavorazione
 * - Download ZIP
 * - Upload materiale
 */
function useKitLogic({ kit }: UseKitLogicProps) {
  const { showNotification } = useNotification();
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { state, dispatch } = useKit();

  const { accepted: filesAccepted, rejected: filesRejected, rejectionReasons, files: filesData } = state;

  // Invalidate files query
  const invalidateFilesQuery = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["getFilesPerGestioneLavorazione", kit.guidId]
    });
    queryClient.invalidateQueries({
      queryKey: ["getKitPerGestioneLavorazione", kit.guidId]
    });
  }, [queryClient, kit.guidId]);

  // Start lavorazione
  const mutationStartLavorazione = useMutation<any, Error, { idPromo: string }>({
    mutationKey: ["startLavorazione", kit.guidId],
    mutationFn: async ({ idPromo }) => {
      const response = await ServerCall.put("/getKitByPromo", {
        id: kit.guidId,
        idPromo,
        idCanale: kit.guidCanale,
        idArea: kit.guidArea,
        idFormato: (kit as any).guidFormato,
        idPV: (kit as any).guidPv ?? null,
        lettura: false,
      });
      return response;
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>Lavorazione avviata con successo</span>
        </div>,
        { variant: "success" }
      );
      revalidator.revalidate();
    },
    onError: () => {
      showNotification("Errore durante l'avvio della lavorazione", { variant: "error" });
    },
  });

  // Avvio revisione
  const mutationAvvioRevisione = useMutation<any, Error, void>({
    mutationKey: ["avvioRevisione", kit.guidId],
    mutationFn: async () => {
      return ServerCall.put("/avvioRevisioneKitAutomatico", {
        idLavorazione: kit.guidId
      });
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>Revisione avviata con successo</span>
        </div>,
        { variant: "success" }
      );
      revalidator.revalidate();
      invalidateFilesQuery();
    },
    onError: (error) => {
      console.error(error);
      showNotification("Errore durante l'avvio della revisione", { variant: "error" });
    },
  });

  // Pubblica kit runtime
  const mutationPubblicaKitRuntime = useMutation<any, Error, void>({
    mutationKey: ["pubblicaKitRuntime", kit.guidId],
    mutationFn: async () => {
      return ServerCall.put("/pubblicaKitRuntime", {
        idLavorazione: kit.guidId
      });
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>Kit pubblicato con successo</span>
        </div>,
        { variant: "success" }
      );
      revalidator.revalidate();
      invalidateFilesQuery();
    },
    onError: (error) => {
      console.error(error);
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="X" className="w-4 h-4 text-danger" />
          <span>Errore durante la pubblicazione del kit</span>
        </div>,
        { variant: "error" }
      );
    },
  });

  // Riporta in lavorazione con errori
  const mutationRiportaInLavorazione = useMutation<any, Error, void>({
    mutationKey: ["riportaInLavorazione", kit.guidId],
    mutationFn: async () => {
      const payload = {
        idLavorazione: kit.guidId,
        filesAccepted: filesAccepted.map((f: FileItemKit) => f.id),
        filesRejected: filesRejected.map((f: FileItemKit) => ({
          id: f.id,
          log: {
            messaggio: rejectionReasons[f.id] || "File rifiutato",
          },
        })),
      };
      return ServerCall.put("/riportaInLavorazioneConErroriAutomatico", payload);
    },
    onSuccess: () => {
      dispatch({ type: 'SET_ACCEPTED', payload: [] });
      dispatch({ type: 'SET_REJECTED', payload: [] });
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>Lavorazione riportata in lavorazione con errori</span>
        </div>,
        { variant: "success" }
      );
      revalidator.revalidate();
      invalidateFilesQuery();
    },
    onError: (error) => {
      console.error(error);
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="X" className="w-4 h-4 text-danger" />
          <span>Errore durante il riporto in lavorazione</span>
        </div>,
        { variant: "error" }
      );
    },
  });

  // Elimina lavorazione
  const mutationEliminaLavorazione = useMutation<any, Error, void>({
    mutationKey: ["eliminaLavorazione", kit.guidId],
    mutationFn: async () => {
      return ServerCall.delete(`/mettiInStatoDiEliminazione/${kit.guidId}`);
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>Lavorazione eliminata con successo</span>
        </div>,
        { variant: "success" }
      );
      navigate(-1);
    },
    onError: (error) => {
      console.error(error);
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="X" className="w-4 h-4 text-danger" />
          <span>Errore durante l'eliminazione della lavorazione</span>
        </div>,
        { variant: "error" }
      );
    },
  });

  // Rilavora
  const mutationRilavora = useMutation<any, Error, void>({
    mutationKey: ["rilavora", kit.guidId],
    mutationFn: async () => {
      return ServerCall.delete(`/eliminaKitRuntime/${kit.guidId}`);
    },
    onSuccess: () => {
      dispatch({ type: 'SET_ACCEPTED', payload: [] });
      dispatch({ type: 'SET_REJECTED', payload: [] });
      showNotification("Lavorazione rilavorata con successo", { variant: "success" });
      revalidator.revalidate();
      invalidateFilesQuery();
    },
    onError: (error: any) => {
      console.error(error);
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="X" className="w-4 h-4 text-danger" />
          <span>{error?.cause?.message}</span>
        </div>,
        { variant: "error" }
      );
    },
  });

  // Download ZIP
  const mutationDownloadZip = useMutation<
    { data: Blob; fileCount: number },
    Error,
    { lavorazioneId: string; files: FileItemKit[] }
  >({
    mutationKey: ["downloadKitZip", kit.guidId],
    mutationFn: async (data) => {
      const url = `${ServerCall.getUrl()}/downloadKitZip`;
      const response = await axios.post(url, data, {
        responseType: 'blob',
        withCredentials: true
      });
      return { data: response.data, fileCount: data.files.length };
    },
    onMutate: (variables) => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="Download" className="w-4 h-4 text-primary" />
          <span>Download avviato per kit_{kit.titolo}.zip ({variables.files.length} file)</span>
        </div>,
        { variant: "info" }
      );
    },
    onSuccess: (result) => {
      const url = window.URL.createObjectURL(new Blob([result.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `kit_${kit.titolo}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="FileCheck" className="w-4 h-4 text-success" />
          <span>Download completato ({result.fileCount} file)</span>
        </div>,
        { variant: "success" }
      );
    },
    onError: () => {
      showNotification("Errore durante il download del kit.", { variant: "error" });
    }
  });

  // Upload materiale
  const mutationUploadMateriale = useMutation<
    any,
    Error,
    { files: Array<{ id: string; nome: string; direttive: string; isOptional: boolean; file: File; tipo_export: string }> }
  >({
    mutationKey: ["uploadMateriale", kit.guidId],
    mutationFn: async ({ files }) => {
      const formData = new FormData();
      formData.append("idLavorazione", kit.guidId);

      files.forEach((fileData, index) => {
        formData.append(`files[${index}][id]`, fileData.id);
        formData.append(`files[${index}][nome]`, fileData.nome);
        formData.append(`files[${index}][direttive]`, fileData.direttive);
        formData.append(`files[${index}][isOptional]`, String(fileData.isOptional));
        formData.append(`files[${index}][tipo_export]`, fileData.tipo_export);
        formData.append(`file_${index}`, fileData.file);
      });

      const url = `${ServerCall.getUrl()}/uploadMaterialeKitManuale`;
      const response = await axios.post(url, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>File caricati con successo</span>
        </div>,
        { variant: "success" }
      );
      revalidator.revalidate();
      invalidateFilesQuery();
    },
    onError: (error) => {
      console.error(error);
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="X" className="w-4 h-4 text-danger" />
          <span>Errore durante il caricamento dei file</span>
        </div>,
        { variant: "error" }
      );
    }
  });

  // Elimina singolo file
  const mutationEliminaFile = useMutation<any, Error, string>({
    mutationKey: ["eliminaFileKitRuntime", kit.guidId],
    mutationFn: async (fileId: string) => {
      return ServerCall.delete(`/eliminaFileKitRuntime/${fileId}`);
    },
    onSuccess: () => {
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
          <span>File eliminato con successo</span>
        </div>,
        { variant: "success" }
      );
      revalidator.revalidate();
      invalidateFilesQuery();
    },
    onError: (error) => {
      console.error(error);
      showNotification(
        <div className="flex items-center gap-2">
          <Lucide icon="X" className="w-4 h-4 text-danger" />
          <span>Errore durante l'eliminazione del file</span>
        </div>,
        { variant: "error" }
      );
    }
  });

  // Handle download ZIP helper
  const handleDownloadZip = useCallback(() => {
    mutationDownloadZip.mutate({
      lavorazioneId: kit.guidId,
      files: filesData || []
    });
  }, [mutationDownloadZip, kit.guidId, filesData]);

  // Handle download singolo file
  const handleDownloadSingleFile = useCallback((file: FileItemKit) => {
    if (!file.url && !file.url_download) {
      showNotification("URL del file non disponibile", { variant: "error" });
      return;
    }

    const downloadUrl = file.url_download || file.url;
    const link = document.createElement('a');
    link.href = downloadUrl!;
    link.download = file.nome || 'file';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [showNotification]);

  return {
    mutationStartLavorazione,
    mutationAvvioRevisione,
    mutationPubblicaKitRuntime,
    mutationRiportaInLavorazione,
    mutationEliminaLavorazione,
    mutationRilavora,
    mutationDownloadZip,
    mutationUploadMateriale,
    mutationEliminaFile,
    invalidateFilesQuery,
    handleDownloadZip,
    handleDownloadSingleFile,
  };
}

export default useKitLogic;
