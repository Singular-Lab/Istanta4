import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatNumero } from "@/utils/format";

export interface MostraTuttiProps {
  aperto: boolean;
  totale: number;
  onCambia: (aperto: boolean) => void;
  /** Id dell'elenco che il pulsante allunga, per le tecnologie assistive. */
  controlla: string;
  /** "tutte" per gli elenchi al femminile (le differenze). */
  genere?: "tutti" | "tutte";
}

/** Apre e richiude un elenco lungo, di cui si mostrano all'inizio solo le prime voci. */
export function MostraTutti({ aperto, totale, onCambia, controlla, genere = "tutti" }: MostraTuttiProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline-secondary"
      className="mt-3"
      aria-expanded={aperto}
      aria-controls={controlla}
      onClick={() => onCambia(!aperto)}
    >
      <Lucide icon={aperto ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
      {aperto ? "Mostra meno" : `Mostra ${genere} (${formatNumero(totale)})`}
    </Button>
  );
}

export default MostraTutti;
