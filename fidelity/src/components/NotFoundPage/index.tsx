import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { fetchSideMenu, selectSideMenuStartPage } from "../../stores/sideMenuSlice_istanta";
import type { AppDispatch } from "../../stores/store";

export default function NotFoundPage() {
    const { t } = useTranslation();
    const dispatch: AppDispatch = useDispatch();
    const startPage = useSelector(selectSideMenuStartPage);

    useEffect(() => {
        if (!startPage) {
            dispatch(fetchSideMenu());
        }
    }, [dispatch, startPage]);

    return (
        <div className="box box--stacked min-h-[calc(100vh-12rem)] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-6">
            <div className="w-full max-w-lg text-center space-y-8">

                {/* Badge 404 */}
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl
                        bg-primary/10 text-primary text-4xl font-bold shadow-inner">
                    404
                </div>

                {/* Testo */}
                <div className="space-y-3">
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                        {t("errors.not_found_title", {
                            defaultValue: "Pagina non trovata",
                        })}
                    </h1>

                    <p className="text-slate-500 leading-relaxed">
                        {t("errors.not_found", {
                            defaultValue:
                                "La risorsa richiesta non è disponibile. Potrebbe essere stata rimossa, rinominata oppure non hai i permessi necessari per visualizzarla.",
                        })}
                    </p>
                </div>

                {/* Divider soft */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                {/* Azioni */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-full
                       border border-slate-200 text-slate-600
                       hover:bg-slate-50 hover:border-slate-300
                       transition focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {t("actions.go_back", { defaultValue: "Torna indietro" })}
                    </button>

                    <Link
                        to={startPage || "/"}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-full
                       bg-primary text-white font-semibold
                       shadow-sm hover:bg-primary/90
                       transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        {t("actions.go_first_page")}
                    </Link>
                </div>

                {/* Hint contestuale */}
                <p className="text-xs text-slate-400">
                    {t("errors.not_found_hint", {
                        defaultValue:
                            "Se pensi si tratti di un errore, contatta l’amministratore o verifica l’URL.",
                    })}
                </p>
            </div>
        </div>
    );
}
