import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import React, { startTransition, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router-dom";
import { Colorize } from "../../../lib/Colorize";
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
    useEffect(() => {
        console.log(Colorize.bgBrightCyan("CIAO DA AUTH"));
    }, [])
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
            <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center p-4">
                <AppLoaderBridge />
                <Lucide icon="CircleAlert" className="w-16 h-16 text-danger" />
                <h1 className="mt-4 text-xl font-bold">Autenticazione fallita</h1>
                <p className="mt-2 text-sm text-slate-500 max-w-md">
                    {errore || "Si è verificato un errore durante l'autenticazione."}
                </p>
                <Button type="button" variant="primary" className="mt-6" onClick={() => navigate("/login")}>
                    Torna al Login
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white"></div>
    );
};

export default Auth;
