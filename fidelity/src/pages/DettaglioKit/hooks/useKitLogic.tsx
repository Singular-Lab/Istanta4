import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback } from "react";
import { useNavigate, useRevalidator } from "react-router-dom";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../../lib/enums";
import { motivoFileNonAmmesso } from "../../../../lib/materiali/formatiCaricamento";
import { ServerCall } from "../../../../lib/server_call";
import { FileItemKit } from "../../../../lib/types";
import { KitType, useKit } from "../context/KitContext";

interface UseKitLogicProps {
  kit: KitType;
  abortController?: AbortController;
}

/** Esito di un caricamento di piu' file: nomi caricati e nomi rifiutati con il motivo. */
interface EsitoUploadMateriale {
  caricati: string[];
  falliti: Array<{ nome: string; motivo: string }>;
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
          <span>{error?.message || error?.cause?.message || "Errore durante la rilavorazione del kit"}</span>
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
      // Fuori da ServerCall: il token CSRF va aggiunto a mano, senza il server risponde 403
      const response = await axios.post(url, data, {
        responseType: 'blob',
        withCredentials: true,
        headers: { 'x-csrf-token': (await ServerCall.ensureCSRFToken()) ?? '' }
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

  // Upload materiale: POST /uploadMateriale accetta un file per richiesta, quindi si invia un file
  // alla volta (in sequenza, per non caricare Olimpo con piu' file grandi insieme) e l'esito di
  // ciascuno resta separato: un file rifiutato non blocca gli altri.
  const mutationUploadMateriale = useMutation<
    EsitoUploadMateriale,
    Error,
    { files: Array<{ id: string; nome: string; direttive: string; isOptional: boolean; file: File; tipo_export: string }> }
  >({
    mutationKey: ["uploadMateriale", kit.guidId],
    mutationFn: async ({ files }) => {
      const esito: EsitoUploadMateriale = { caricati: [], falliti: [] };
      // Le condizioni del server valgono anche qui: un file che verrebbe rifiutato non parte.
      // Senza stato la pagina tratta il kit come in lavorazione (vedi DettaglioKit e stateConfig).
      const kitInLavorazione = (kit.stato_lavorazione ?? STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE) === STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE;
      for (const fileData of files) {
        const codiceExport = kit.tipiExport?.find((tipo) => tipo.id_tipiexport === fileData.tipo_export)?.codice_tipiexport;
        const motivoLocale = !kitInLavorazione
          ? "il kit non è in lavorazione"
          : codiceExport ? motivoFileNonAmmesso(fileData.file.name, codiceExport) : null;
        if (motivoLocale) {
          esito.falliti.push({ nome: fileData.nome, motivo: motivoLocale });
          continue;
        }
        // Campi letti dal server (FileManagementService.uploadMateriale); il file per ultimo
        const formData = new FormData();
        formData.append("guidKitRuntime", kit.guidId);
        formData.append("tipoExport", fileData.tipo_export);
        formData.append("nomeFile", fileData.nome);
        // Nessun metadato aggiuntivo per il caricamento manuale dell'operatore
        formData.append("meta", "{}");
        formData.append("file", fileData.file);
        try {
          // ServerCall aggiunge il token CSRF e ripete la richiesta se il token e' scaduto
          await ServerCall.post("/uploadMateriale", formData);
          esito.caricati.push(fileData.nome);
        } catch (error) {
          esito.falliti.push({
            nome: fileData.nome,
            motivo: error instanceof Error && error.message ? error.message : "errore sconosciuto",
          });
        }
      }
      return esito;
    },
    onSuccess: ({ caricati, falliti }) => {
      if (falliti.length === 0) {
        showNotification(
          <div className="flex items-center gap-2">
            <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
            <span>File caricati con successo</span>
          </div>,
          { variant: "success" }
        );
      } else {
        showNotification(
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Lucide icon="X" className="w-4 h-4 text-danger" />
              <span>Errore durante il caricamento dei file</span>
            </div>
            <span>
              {caricati.length > 0
                ? `Caricati ${caricati.length} di ${caricati.length + falliti.length} file. Non caricati:`
                : "Non caricati:"}
            </span>
            <ul className="list-disc pl-5">
              {falliti.map((fallito) => (
                <li key={fallito.nome}>{fallito.nome}: {fallito.motivo}</li>
              ))}
            </ul>
          </div>,
          { variant: "error" }
        );
      }
      // Anche con qualche errore i file caricati vanno mostrati
      if (caricati.length > 0) {
        revalidator.revalidate();
        invalidateFilesQuery();
      }
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
