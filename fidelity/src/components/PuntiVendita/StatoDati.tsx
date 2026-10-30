import StatusBadge from "@/components/Base/StatusBadge";
import { codiciIdentificativi, haCoordinate, volantiniDi, type ConStoria, type PuntoVenditaInElenco } from "./elenco";

/** Che cosa manca nei dati di un punto vendita, per i badge della gestione. */
export interface ProblemiDati {
  senzaCoordinate: boolean;
  /** Solo per le GDO che usano i codici del loro sistema (es. id ANACAN). */
  senzaCodice: boolean;
  /** Solo se il server manda la storia con l'elenco. */
  maiNeiVolantini: boolean;
}

export interface ContestoDati {
  /** La GDO usa i codici del suo sistema: un punto vendita che non li ha è incompleto. */
  gdoConCodici: boolean;
  /** La storia dei volantini è nota: un punto vendita senza volantini lo si può dire. */
  storiaNota: boolean;
}

export const problemiDati = (
  pv: Pick<PuntoVenditaInElenco, "has_coordinate" | "coordinate" | "meta"> & ConStoria,
  { gdoConCodici, storiaNota }: ContestoDati
): ProblemiDati => ({
  senzaCoordinate: !haCoordinate(pv),
  senzaCodice: gdoConCodici && codiciIdentificativi(pv.meta).length === 0,
  maiNeiVolantini: storiaNota && volantiniDi(pv) === 0,
});

/** Badge dello stato dei dati: i problemi uno per uno, oppure "Completi". */
export function StatoDati({ problemi, completi = "Completi" }: { problemi: ProblemiDati; completi?: string }) {
  const nessuno = !problemi.senzaCoordinate && !problemi.senzaCodice && !problemi.maiNeiVolantini;
  if (nessuno) return <StatusBadge tono="success" etichetta={completi} />;
  return (
    <>
      {problemi.senzaCoordinate && <StatusBadge tono="warning" etichetta="Senza coordinate" />}
      {problemi.senzaCodice && <StatusBadge tono="warning" etichetta="Senza codice" />}
      {problemi.maiNeiVolantini && <StatusBadge tono="neutral" etichetta="Mai nei volantini" />}
    </>
  );
}

export default StatoDati;
