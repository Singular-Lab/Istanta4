import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { createContext, useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchSideMenu, selectSideMenuStartPage } from "../../stores/sideMenuSlice_istanta";
import type { AppDispatch } from "../../stores/store";

/**
 * True quando il componente è reso dentro il layout principale (Echo), con il menu
 * visibile: l'accesso negato occupa allora solo l'area della pagina.
 */
export const DentroLayoutContext = createContext(false);

/**
 * L'unica schermata di accesso negato. Non chiude la sessione e non disconnette le
 * altre schede: porta alla pagina iniziale dell'utente.
 */
const AccessoNegato = ({ aSchermoIntero }: { aSchermoIntero?: boolean }) => {
  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();
  const startPage = useSelector(selectSideMenuStartPage);
  const dentroLayout = useContext(DentroLayoutContext);
  const intero = aSchermoIntero ?? !dentroLayout;

  useEffect(() => {
    if (!startPage) {
      dispatch(fetchSideMenu());
    }
  }, [dispatch, startPage]);

  return (
    <div
      className={clsx(
        "flex items-center justify-center px-6",
        intero
          ? "fixed inset-0 z-[60] bg-slate-100 dark:bg-darkmode-800"
          : "box box--stacked min-h-[calc(100vh-12rem)]"
      )}
    >
      <div className={clsx("w-full max-w-lg text-center space-y-6", intero && "box box--stacked p-10")}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-card bg-warning/10 text-warning">
          <Lucide icon="ShieldX" aria-hidden="true" className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="title-page text-slate-900 dark:text-slate-100">
            Accesso negato
          </h1>
          <p className="text-slate-500 leading-relaxed">
            Il tuo ruolo non ha il permesso di aprire questa pagina. Se ti serve,
            chiedi all'amministratore di abilitarlo.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => navigate(startPage || "/", { replace: true })}
          rounded
          className="px-5 py-2.5"
        >
          <Lucide icon="House" aria-hidden="true" className="w-4 h-4 mr-2" />
          Torna alla pagina iniziale
        </Button>
      </div>
    </div>
  );
};

export default AccessoNegato;
