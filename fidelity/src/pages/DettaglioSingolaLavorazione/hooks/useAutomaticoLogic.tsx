import Lucide from "@/components/Base/Lucide";
import { useNotification } from "@/context/NotificationContext";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE } from "../../../../lib/enums";
import { ServerCall } from "../../../../lib/server_call";
import { FileItemKit } from "../../../../lib/types";

function useAutomaticoLogic({
    isManuale,
    revalidator,
    lavorazione,
    filesAccepted,
    filesRejected,
    rejectionReasons,
    dispatch,
    abortController,
    filesData,
    invalidateFilesQuery,
    correggoFile
}: {
    isManuale: boolean;
    revalidator: any;
    lavorazione: any;
    filesAccepted: FileItemKit[];
    filesRejected: FileItemKit[];
    rejectionReasons: Record<string, string>;
    dispatch: any;
    abortController: AbortController;
    filesData: FileItemKit[];
    invalidateFilesQuery: any;
    correggoFile: FileItemKit | undefined;
}) {
    const { showNotification } = useNotification();
    // Usa useRef per tracciare se è la prima inizializzazione
    const isInitializedRef = useRef(false);
    useEffect(() => {
        const filesToProcess = filesData || lavorazione?.files
        if (!isManuale
            && filesToProcess
            && filesToProcess.length > 0
            && !isInitializedRef.current
            && lavorazione?.stato_lavorazione !== STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE) {
            // Inizializza gli stati solo se non sono mai stati inizializzati
            const accepted = filesToProcess.filter((f: FileItemKit) => f.log?.stato == STATO_LOG_FILE.ACCETTATO && f.id !== correggoFile?.id);
            const rejected = filesToProcess.filter((f: FileItemKit) => f.log?.stato == STATO_LOG_FILE.ERRORE && f.id !== correggoFile?.id);
            const correggo = correggoFile;
            dispatch({ type: 'SET_ACCEPTED', payload: accepted });
            dispatch({ type: 'SET_REJECTED', payload: rejected });
            dispatch({ type: 'SET_CORREGGO_FILE', payload: correggo });
            isInitializedRef.current = true;
        }
    }, [filesData, lavorazione, isManuale, dispatch]);

    const mutationDati = useMutation<any, Error, string>({
        mutationKey: ["richiediDatiLavorazione", lavorazione?.guidId],
        mutationFn: async (idLavorazione: string) => {
            const response = await ServerCall.get(`/getFilesPerGestioneLavorazione/${idLavorazione}`, abortController.signal);
            return response;
        },
        onSuccess: () => {
            if (!isManuale) {
                revalidator.revalidate();
                // Invalida anche la query principale per assicurare dati freschi
                invalidateFilesQuery();
                dispatch({ type: 'SET_ACCEPTED', payload: [] });
                dispatch({ type: 'SET_REJECTED', payload: [] });
                showNotification(<div className="flex items-center gap-2">
                    <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                    <span>Referenze richieste con successo</span>
                </div>, { variant: "success" });
            }
        },
        onError: (error: any) => {
            if (!isManuale) {
                if (error.name === 'AbortError') {
                    showNotification(<div className="flex items-center gap-2">
                        <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                        <span>Richiesta referenze annullata.</span>
                    </div>, { variant: "info" });
                } else {
                    showNotification(<div className="flex items-center gap-2">
                        <Lucide icon="X" className="w-4 h-4 text-danger" />
                        <span>Errore durante la richiesta dei dati</span>
                    </div>, { variant: "error" });
                }
            }
        },
    });
    const mutationReferenze = useMutation<any, Error, { idLavorazione: string, dataFieldsRequest: any }>({
        mutationKey: ["richiediReferenzeWebpliant", lavorazione.guidId],
        mutationFn: async (data: { idLavorazione: string, dataFieldsRequest: any }) => {
            // Chiamata al controller ImpostazioniController -> richiediReferenzeWebpliant
            return ServerCall.get(`/richiediReferenzeWebpliant?id=${data.idLavorazione}`, abortController.signal);
        },
        onSuccess: () => {
            showNotification(
                <div className="flex items-center gap-2">
                    <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                    <span>Referenze richieste con successo</span>
                </div>,
                { variant: "success" }
            );
            revalidator.revalidate();
        },
        onError: (error) => {
            console.error(error);
            showNotification(
                <div className="flex items-center gap-2">
                    <Lucide icon="X" className="w-4 h-4 text-danger" />
                    <span>Si è verificato un errore durante la richiesta delle referenze</span>
                </div>,
                { variant: "error" }
            );
        },
    });

    const toggleAccept = (file: FileItemKit) => {
        dispatch({ type: 'TOGGLE_ACCEPT', payload: file });
    };

    const toggleReject = (file: FileItemKit, reason: string) => {
        dispatch({ type: 'TOGGLE_REJECT', payload: { file, reason } });
    };

    const mutationAvvioRevisione = useMutation<any, Error, void>({
        mutationKey: ["avvioRevisioneKitAutomatico", lavorazione.guidId],
        mutationFn: async () => ServerCall.put("/avvioRevisioneKitAutomatico", { idLavorazione: lavorazione.guidId }),
        onSuccess: () => {
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                <span>Revisione avviata con successo</span>
            </div>, { variant: "success" });
            revalidator.revalidate();
        },
        onError: (error) => {
            console.error(error);
            showNotification("Errore durante l'avvio della revisione", { variant: "error" });
        },
    });

    const mutationRiportaInLavorazione = useMutation<any, Error, void>({
        mutationKey: ["riportaInLavorazione", lavorazione.guidId],
        mutationFn: async () => {
            const payload = {
                idLavorazione: lavorazione.guidId,
                filesAccepted: filesAccepted.map((f: any) => f.id),
                filesRejected: filesRejected.map((f: any) => ({
                    id: f.id,
                    log: {
                        messaggio: rejectionReasons[f.id] || "File rifiutato",
                    },
                })),
            };
            return ServerCall.put("/riportaInLavorazioneConErroriAutomatico", payload);
        },
        onSuccess: () => {
            // Reset del flag di inizializzazione per permettere una nuova inizializzazione
            isInitializedRef.current = false;
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                <span>Lavorazione riportata in lavorazione con successo</span>
            </div>, { variant: "success" });
            revalidator.revalidate();
        },
        onError: (error) => {
            console.error(error);
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="X" className="w-4 h-4 text-danger" />
                <span>Errore durante il riporto in lavorazione</span>
            </div>, { variant: "error" });
        },
    });

    const mutationPubblicaKitRuntime = useMutation<any, Error, void>({
        mutationKey: ["pubblicaKitRuntime", lavorazione.guidId],
        mutationFn: async () => ServerCall.put("/pubblicaKitRuntime", { idLavorazione: lavorazione.guidId }),
        onSuccess: () => {
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                <span>Kit pubblicato con successo</span>
            </div>, { variant: "success" });
            revalidator.revalidate();
        },
        onError: (error) => {
            console.error(error);
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="X" className="w-4 h-4 text-danger" />
                <span>Errore durante la pubblicazione del kit</span>
            </div>, { variant: "error" });
        },
    });

    const mutationEliminaLavorazione = useMutation<any, Error, void>({
        mutationKey: ["eliminaLavorazione", lavorazione.guidId],
        mutationFn: async () => ServerCall.delete(`/mettiInStatoDiEliminazione/${lavorazione.guidId}`),
        onSuccess: () => {
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="CircleCheck" className="w-4 h-4 text-success" />
                <span>Lavorazione eliminata con successo</span>
            </div>, { variant: "success" });
            revalidator.revalidate();
        },
        onError: (error) => {
            console.error(error);
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="X" className="w-4 h-4 text-danger" />
                <span>Errore durante l'eliminazione della lavorazione</span>
            </div>, { variant: "error" });
        },
    });

    const mutationRilavora = useMutation<any, Error, void>({
        mutationKey: ["rilavora", lavorazione.guidId],
        mutationFn: async () => ServerCall.delete(`/eliminaKitRuntime/${lavorazione.guidId}`),
        onSuccess: () => {
            // Reset del flag di inizializzazione per permettere una nuova inizializzazione
            isInitializedRef.current = false;
            dispatch({ type: 'SET_ACCEPTED', payload: [] });
            dispatch({ type: 'SET_REJECTED', payload: [] });
            showNotification("Lavorazione rilavorata con successo", { variant: "success" });
            revalidator.revalidate();
        },
        onError: (error) => {
            console.error(error);
            showNotification(<div className="flex items-center gap-2">
                <Lucide icon="X" className="w-4 h-4 text-danger" />
                <span>Errore durante la rilavorazione</span>
            </div>, { variant: "error" });
        },
    });

    return {
        mutationDati,
        mutationReferenze,
        toggleAccept,
        toggleReject,
        mutationAvvioRevisione,
        mutationRiportaInLavorazione,
        mutationPubblicaKitRuntime,
        mutationEliminaLavorazione,
        mutationRilavora,
        setAccepted: (accepted: FileItemKit[]) => dispatch({ type: 'SET_ACCEPTED', payload: accepted }),
        setRejected: (rejected: FileItemKit[]) => dispatch({ type: 'SET_REJECTED', payload: rejected }),
    };
}

export default useAutomaticoLogic;
