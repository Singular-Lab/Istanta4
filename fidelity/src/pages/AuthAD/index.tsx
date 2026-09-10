import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
// @ts-ignore
import lottieAnimation from "@/assets/animations/animazione_loading_session.lottie?url";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
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
        <div className="fixed inset-0 flex items-center justify-center bg-[#03045e] bg-opacity-90 backdrop-blur-md z-[100000] transition-opacity duration-300">
            <AppLoaderBridge />
            <div className="text-center flex flex-col items-center">
                <Lucide
                    icon={config.icon}
                    className="w-20 h-20 text-warning animate-pulse"
                />
                <h1 className="mt-6 text-white text-2xl font-bold">
                    {config.title}
                </h1>
                <p className="mt-2 text-gray-300 text-sm max-w-sm">
                    {config.message}
                </p>
                <Button
                    type="button"
                    variant="primary"
                    onClick={() => { window.location.href = "/login"; }}
                    className="mt-6 px-6 py-2 bg-white text-[#03045e] font-semibold rounded-full hover:bg-gray-100"
                >
                    Torna al Login
                </Button>
                <div className="mt-10">
                    <DotLottieReact
                        autoplay
                        loop
                        data={lottieAnimation}
                        style={{ height: "150px", width: "150px" }}
                    />
                </div>
            </div>
        </div>
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
