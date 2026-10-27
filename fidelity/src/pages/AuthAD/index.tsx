import SchermataErrore from "@/components/AppErrorFallback/SchermataErrore";
import React, { startTransition, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router-dom";
import { AppLoaderBridge } from "../../components/AppLoaderBridge";

type ISErrorCode = "token_expired" | "user_not_found" | "no_token" | "auth_failed";

type AuthADSuccess = { route: string; queryParams: Record<string, unknown> };
type AuthADError = { isError: true; errorCode: ISErrorCode };

const ERROR_CONFIG: Record<ISErrorCode, { icon: string; title: string; message: string }> = {
    token_expired: {
        icon: "Clock",
        title: "Token scaduto",
        message: "Il token di autenticazione è scaduto. Il link utilizzato non è più valido, richiedi un nuovo accesso.",
    },
    user_not_found: {
        icon: "UserX",
        title: "Utente non trovato",
        message: "L'account non è registrato nel sistema. Contatta l'amministratore per verificare la tua registrazione.",
    },
    no_token: {
        icon: "ShieldOff",
        title: "Token mancante",
        message: "Nessun token di autenticazione ricevuto. Riprovare il processo di accesso.",
    },
    auth_failed: {
        icon: "TriangleAlert",
        title: "Autenticazione fallita",
        message: "Si è verificato un errore durante il processo di autenticazione. Riprovare o contattare l'assistenza.",
    },
};

const ErrorView: React.FC<{ errorCode: ISErrorCode }> = ({ errorCode }) => {
    const config = ERROR_CONFIG[errorCode] ?? ERROR_CONFIG.auth_failed;

    return (
        <>
            <AppLoaderBridge />
            <SchermataErrore
                icona={config.icon}
                titolo={config.title}
                messaggio={config.message}
                azione={{ etichetta: "Torna al Login", onClick: () => { window.location.href = "/login"; } }}
            />
        </>
    );
};

const AuthAD: React.FC = () => {
    const navigate = useNavigate();
    const { auth } = useLoaderData() as {
        auth: AuthADSuccess | AuthADError | null;
    };

    useEffect(() => {
        if (auth && !("isError" in auth)) {
            startTransition(() => {
                navigate(auth.route || "/");
            });
        }
    }, [auth, navigate]);

    if (!auth || "isError" in auth) {
        const errorCode = (auth as AuthADError | null)?.errorCode ?? "auth_failed";
        return <ErrorView errorCode={errorCode} />;
    }

    return <div className="min-h-screen bg-white"></div>;
};

export default AuthAD;
