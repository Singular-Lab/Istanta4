import withSessionCheck from "@/components/SessionChecker";
import { useLoaderData } from "react-router-dom";
import {
  ETICHETTA_PERIODO_CONSULTAZIONE,
  isPeriodoConsultazione,
  type PeriodoConsultazione,
} from "../../../lib/consultazione/periodi";
import VolantiniPerPromozione from "./VolantiniPerPromozione";

export interface VolantiniKitLoaderData {
  periodo: PeriodoConsultazione;
}

const DESCRIZIONE: Readonly<Record<PeriodoConsultazione, string>> = {
  attivi:
    "Le promozioni valide adesso, con i loro volantini pubblicati. Apri una promozione per vedere i suoi volantini, dove arrivano e cosa promuovono.",
  prossimi:
    "Le promozioni che devono ancora iniziare e hanno già volantini pubblicati. Apri una promozione per vedere i suoi volantini, dove arrivano e cosa promuovono.",
  storico:
    "Le promozioni concluse con i loro volantini pubblicati, dalla più recente. Apri una promozione per vedere i suoi volantini, dove sono arrivati e cosa hanno promosso.",
};

/**
 * Volantini pubblicati di un periodo (attivi, prossimi, storico): il periodo arriva dal loader
 * della rotta. Solo promozioni con materiali pubblicati della GDO, dalle API di consultazione:
 * ognuna apre il suo dettaglio di consultazione, la lavorazione dei kit si segue da Avanzamento
 * produzione. I materiali POP sono una vista a parte.
 */
function VolantiniKit() {
  const letto = (useLoaderData() as Partial<VolantiniKitLoaderData> | undefined)?.periodo;
  const periodo = isPeriodoConsultazione(letto) ? letto : "attivi";
  return (
    // Cambiando periodo la vista riparte da zero: stesso componente, rotte diverse
    <VolantiniPerPromozione
      key={periodo}
      periodo={periodo}
      titolo={`Volantini ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo]}`}
      descrizione={DESCRIZIONE[periodo]}
    />
  );
}

export default withSessionCheck(VolantiniKit);
