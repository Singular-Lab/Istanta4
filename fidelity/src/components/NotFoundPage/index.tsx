import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import SchermataStato from "@/components/SchermataStato";
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
        <SchermataStato
            simbolo={<span aria-hidden="true" className="text-4xl font-bold">404</span>}
            titolo={t("errors.not_found_title", { defaultValue: "Pagina non trovata" })}
            descrizione={t("errors.not_found", {
                defaultValue:
                    "La risorsa richiesta non è disponibile. Potrebbe essere stata rimossa, rinominata oppure non hai i permessi necessari per visualizzarla.",
            })}
            azioni={
                <>
                    <Button
                        type="button"
                        variant="outline-secondary"
                        rounded
                        onClick={() => window.history.back()}
                        className="w-full px-5 py-2.5 sm:w-auto"
                    >
                        {t("actions.go_back", { defaultValue: "Torna indietro" })}
                    </Button>
                    <Button
                        as={Link}
                        to={startPage || "/"}
                        variant="primary"
                        rounded
                        className="w-full px-5 py-2.5 sm:w-auto"
                    >
                        <Lucide icon="House" aria-hidden="true" className="mr-2 h-4 w-4" />
                        {t("actions.go_first_page")}
                    </Button>
                </>
            }
            nota={t("errors.not_found_hint", {
                defaultValue: "Se pensi si tratti di un errore, contatta l’amministratore o verifica l’URL.",
            })}
        />
    );
}
