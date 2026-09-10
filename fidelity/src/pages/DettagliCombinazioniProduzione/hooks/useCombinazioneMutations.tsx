import Lucide from "@/components/Base/Lucide";
import { useNotification } from '@/context/NotificationContext';
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TIPO_KIT_DESIGN } from "../../../../lib/enums";
import { ServerCall } from "../../../../lib/server_call";
import { OggettoTipiDiExport } from "../../../../lib/types";

interface DeclinazioneData {
    declinazioni: {
        titolo: string;
        proprieta: { chiave: string; valore: string }[];
        filtri: {
            titoloFiltro: string;
            condizioni: { nome_field: string; operatore: string; valore: string }[];
        }[];
        chiavi: string[];
    }[];
}

interface FiltroContextData {
    idCombinazione: string;
    filtroContesto: {
        condizioni: {
            schemaScelto: string;
            nome_field: string;
            operatore: string;
            colonna: string;
        }[];
        titoloFiltro: string;
    }[];
}

interface FiltriData {
    filtri?: {
        condizioni?: {
            nome_field: string;
            operatore: string;
            valore: string;
            idAddestramento: string;
        }[];
        titoloFiltro: string;
    }[];
    idCombinazione?: string;
}

interface RaccoglitoreData {
    id: string;
    titolo: string;
    quantita: number;
    guidAree: string[];
    guidCanali: string[];
    guidIdPv?: (string | undefined)[];
    guidFormato: string;
    tags?: string[];
    tipiDiExportInKit: OggettoTipiDiExport[];
    tipo: TIPO_KIT_DESIGN;
    files?: any[];
}

export const useCombinazioneMutations = (idCombinazione: string, refetchCombinazione?: () => void) => {
    const { showNotification } = useNotification();
    const navigate = useNavigate();
    const showSuccessNotification = (message: string) => {
        showNotification(
            <div className="flex flex-row items-center">
                <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
                <div className="ml-4 mr-4">
                    <div className="font-bold">{message}</div>
                </div>
            </div>
        );
    };

    const showErrorNotification = (title: string, error: Error) => {
        showNotification(
            <div className="flex flex-row items-center">
                <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
                <div className="ml-4 mr-4">
                    <div className="font-bold">{title}</div>
                    <div className="mt-1 text-slate-500">{error.message}</div>
                </div>
            </div>
        );
    };

    const mutationCreazioneDeclinazioni = useMutation({
        mutationFn: async ({ idCombinazione, data }: { idCombinazione: string; data: DeclinazioneData }) => {
            return await ServerCall.put('/creaDeclinazioniPerRaccoglitoreById', { data, idCombinazione });
        },
        onError: (error: Error) => showErrorNotification("Errore durante l'attivazione della combinazione", error),
        onSuccess: () => showSuccessNotification("Attivazione combinazione avvenuta con successo"),
    });

    const mutateCreazioneFiltroContext = useMutation({
        mutationFn: async (data: FiltroContextData) => {
            const filtroContextCondizioniFix = data.filtroContesto.map(filtro => ({
                ...filtro,
                condizioni: filtro.condizioni.map(cond => ({
                    ...cond,
                    nome_field: `${cond.schemaScelto}.${cond.colonna}`,
                })),
            }));
            return await ServerCall.put("/creaFiltroContestoPerRaccoglitoreById", {
                ...data,
                filtroContesto: filtroContextCondizioniFix,
                idCombinazione: data.idCombinazione || idCombinazione,
            });
        },
        mutationKey: ["creaFiltroContestoPerRaccoglitoreById"],
        onSuccess: () => showSuccessNotification("Filtro di contesto creato con successo"),
    });

    const mutateCreazioneFiltro = useMutation({
        mutationFn: async (data: FiltriData) => {
            return await ServerCall.put("/creaFiltroPerRaccoglitoreById", {
                ...data,
                idCombinazione: data.idCombinazione || idCombinazione,
            });
        },
        mutationKey: ["creaFiltroPerRaccoglitoreById"],
        onSuccess: () => showSuccessNotification("Filtro creato con successo"),
    });

    const mutateUpdateRaccoglitoreKit = useMutation({
        mutationFn: async (data: RaccoglitoreData) => {
            return await ServerCall.put("/updateRaccoglitoreKit", data);
        },
        mutationKey: ["updateRaccoglitoreKit"],
        onSuccess: () => {
            refetchCombinazione?.();
            showSuccessNotification("Raccoglitore aggiornato con successo");
            navigate("/impostazioni-di-produzione", { replace: true });
        },
        onError: (error: Error) => showErrorNotification("Errore durante l'aggiornamento del raccoglitore", error),
    });

    return {
        mutationCreazioneDeclinazioni,
        mutateCreazioneFiltroContext,
        mutateCreazioneFiltro,
        mutateUpdateRaccoglitoreKit,
    };
};
