import Pagina from "@/components/Base/Pagina";
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
    "Volantini pubblicati nelle promozioni ancora valide, una scheda per promozione con le varianti per canale e area. Ogni variante apre i suoi insight.",
  prossimi:
    "Volantini già pubblicati delle promozioni non ancora valide, una scheda per promozione con le varianti per canale e area. Ogni variante apre i suoi insight.",
  storico:
    "Volantini pubblicati nelle promozioni concluse, una scheda per promozione con le varianti per canale e area. Ogni variante apre i suoi insight.",
};

/**
 * Volantini pubblicati di un periodo (attivi, prossimi, storico): il periodo arriva dal loader
 * della rotta. Solo materiali pubblicati della GDO, dalle API di consultazione: la lavorazione dei
 * kit si segue da Avanzamento produzione. I materiali POP sono una vista a parte.
 */
function VolantiniKit() {
  const letto = (useLoaderData() as Partial<VolantiniKitLoaderData> | undefined)?.periodo;
  const periodo = isPeriodoConsultazione(letto) ? letto : "attivi";
  return (
    <Pagina titolo={`Volantini ${ETICHETTA_PERIODO_CONSULTAZIONE[periodo]}`} descrizione={DESCRIZIONE[periodo]}>
      {/* Cambiando periodo la vista riparte da zero: stesso componente, rotte diverse */}
      <VolantiniPerPromozione key={periodo} periodo={periodo} />
    </Pagina>
  );
}

export default withSessionCheck(VolantiniKit);
