import Segmenti from "@/components/Base/Segmenti";
import { useNavigate } from "react-router-dom";
import {
  ETICHETTA_PERIODO,
  PERIODI_MATERIALI,
  percorsoPop,
  percorsoVolantini,
  type PeriodoMateriali,
} from "../../../lib/materiali/periodi";

export interface SchedePeriodoProps {
  vista: "volantini" | "pop";
  periodo: PeriodoMateriali;
  className?: string;
}

/**
 * Periodi di una vista (In corso, Attivi, Storico) come schede: ogni periodo è una rotta.
 * Cambiando periodo i filtri non si portano dietro, perché le promo di un periodo non sono negli altri.
 */
function SchedePeriodo({ vista, periodo, className }: SchedePeriodoProps) {
  const navigate = useNavigate();
  const percorso = vista === "volantini" ? percorsoVolantini : percorsoPop;
  return (
    <Segmenti
      etichetta="Periodo"
      className={className}
      valore={periodo}
      opzioni={PERIODI_MATERIALI.map((valore) => ({ valore, etichetta: ETICHETTA_PERIODO[valore] }))}
      onChange={(nuovo) => navigate(percorso(nuovo))}
    />
  );
}

export default SchedePeriodo;
