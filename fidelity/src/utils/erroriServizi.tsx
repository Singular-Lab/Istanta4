import Lucide from "@/components/Base/Lucide";
import type { ReactNode } from "react";

type Notifica = (content: ReactNode, options?: { variant?: 'success' | 'error' | 'warning' | 'info'; duration?: number }) => void;
type ErroreServizio = { code?: string; message?: string; details?: { service?: string } };

const NOMI_SERVIZI: Record<string, string> = { ISTANTA: 'Istanta', CORREGGO: 'Correggo' };

// ponytail: un solo NotificationProvider nell'app, basta un riferimento a livello di modulo
let notifica: Notifica | null = null;

/** Chiamata da NotificationProvider: rende showNotification usabile dai gestori globali di React Query. */
export const registraNotifica = (fn: Notifica | null) => {
    notifica = fn;
};

/** Errore che il server riporta quando Istanta o Correggo falliscono (ExternalApiError, INF_002). */
export const isErroreServizio = (error: unknown): boolean => {
    const e = error as ErroreServizio | undefined;
    return e?.code === 'INF_002' && Object.keys(NOMI_SERVIZI).includes(e.details?.service ?? '');
};

/** Toast d'errore con il motivo di Istanta/Correggo; gli altri errori li gestisce la pagina. */
export const notificaErroreServizio = (error: unknown) => {
    if (!isErroreServizio(error) || !notifica) return;
    const e = error as ErroreServizio;
    notifica(
        <div className="flex flex-row items-center">
            <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
            <div className="ml-4 mr-4">
                <div className="font-bold">Errore di {NOMI_SERVIZI[e.details?.service ?? '']}</div>
                <div className="mt-1 text-slate-500">{e.message}</div>
            </div>
        </div>,
        { variant: 'error', duration: 8000 }
    );
};
