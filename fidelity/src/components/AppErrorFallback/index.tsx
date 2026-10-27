// src/components/AppErrorFallback.tsx
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import SchermataErrore from "./SchermataErrore";

interface AppErrorFallbackProps {
    error?: Error;
    /** Titolo fisso della schermata; il messaggio d'errore va sotto, mai nel titolo. */
    titolo?: string;
    message?: string;
}

const AppErrorFallback = ({ error, titolo = "Errore imprevisto", message: messaggio }: AppErrorFallbackProps) => {
    const message =
        messaggio || error?.message || "Si è verificato un errore imprevisto nell'applicazione.";

    return (
        <SchermataErrore
            titolo={titolo}
            messaggio={message}
            azione={{ etichetta: "Ricarica la pagina", onClick: () => window.location.reload() }}
        >
            {process.env.NODE_ENV === "development" && error?.stack && (
                <p className="mt-2 max-w-sm whitespace-pre-wrap text-left text-xs text-slate-300">
                    {error.stack}
                </p>
            )}
        </SchermataErrore>
    );
};

/**
 * errorElement delle route di primo livello. A differenza di ErrorPage non chiama /menu/me:
 * nelle pagine pubbliche (es. webpliant) il 401 porterebbe l'utente a /login.
 */
export const RouteErrorFallback = () => {
    const error = useRouteError();
    if (isRouteErrorResponse(error)) {
        return error.status === 404 ? (
            <AppErrorFallback
                titolo="Pagina non trovata"
                message="L'indirizzo richiesto non esiste o non è più disponibile."
            />
        ) : (
            <AppErrorFallback
                titolo="Impossibile caricare la pagina"
                message="Si è verificato un errore durante il caricamento. Ricarica la pagina per riprovare."
            />
        );
    }
    return <AppErrorFallback error={error instanceof Error ? error : undefined} />;
};

export default AppErrorFallback;
