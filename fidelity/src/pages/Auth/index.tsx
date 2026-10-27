import SchermataErrore from "@/components/AppErrorFallback/SchermataErrore";
import React, { startTransition, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router-dom";
import { AppLoaderBridge } from "../../components/AppLoaderBridge";


const Auth: React.FC = () => {

    const navigate = useNavigate();
    const { auth, errore } = useLoaderData() as {
        auth: {
            publicKey: string;
            route: string;
            queryParams: {
                [key: string]: any;
            };
        } | null;
        errore?: string;
    };
    const funzioneRedirect = (auth: {
        publicKey: string;
        route: string;
        queryParams: {
            [key: string]: any;
        };
    }) => {
        startTransition(() => {
            if (auth.route === "/") {
                navigate("/");
            } else {
                switch (auth.route) {
                    case "/promozioni/in-corso/dettagli":
                        if (auth.queryParams.guidId) {
                            navigate(`/promozioni/in-corso/dettagli/${auth.queryParams.guidId}`);
                        } else {
                            navigate("/promozioni/in-corso/dettagli");
                        }
                        break;
                    case "/lavorazioni-in-corso/dettagli":
                        if (auth.queryParams.guidId) {
                            navigate(`/promozioni/in-corso/dettagli/${auth.queryParams.guidId}`);
                        } else {
                            navigate("/promozioni/in-corso/dettagli");
                        }
                        break;
                }
            }
        });
    }

    useEffect(() => {
        // fai il redirect alla pagina usata in route
        if (auth) funzioneRedirect(auth);
    }, [auth]);

    if (!auth) {
        return (
            <>
                <AppLoaderBridge />
                <SchermataErrore
                    icona="CircleAlert"
                    titolo="Autenticazione fallita"
                    messaggio={errore || "Si è verificato un errore durante l'autenticazione."}
                    azione={{ etichetta: "Torna al Login", onClick: () => navigate("/login") }}
                />
            </>
        );
    }

    return (
        <div className="min-h-screen bg-white"></div>
    );
};

export default Auth;
