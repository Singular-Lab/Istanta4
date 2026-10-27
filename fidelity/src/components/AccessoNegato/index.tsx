import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import SchermataStato from "@/components/SchermataStato";
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
    <SchermataStato
      aSchermoIntero={intero}
      icona="ShieldX"
      tono="warning"
      titolo="Accesso negato"
      descrizione="Il tuo ruolo non ha il permesso di aprire questa pagina. Se ti serve, chiedi all'amministratore di abilitarlo."
      azioni={
        <Button
          type="button"
          variant="primary"
          onClick={() => navigate(startPage || "/", { replace: true })}
          rounded
          className="px-5 py-2.5"
        >
          <Lucide icon="House" aria-hidden="true" className="mr-2 h-4 w-4" />
          Torna alla pagina iniziale
        </Button>
      }
    />
  );
};

export default AccessoNegato;
