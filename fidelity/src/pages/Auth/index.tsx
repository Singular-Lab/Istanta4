import React, { startTransition, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router-dom";
import { Colorize } from "../../../lib/Colorize";


const Auth: React.FC = () => {

    const navigate = useNavigate();
    const { auth } = useLoaderData() as {
        auth: {
            publicKey: string;
            route: string;
            queryParams: {
                [key: string]: any;
            };
        }
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
        funzioneRedirect(auth);
    }, [auth]);

    return (
        <div className="min-h-screen bg-white"></div>
    );
};

export default Auth;
