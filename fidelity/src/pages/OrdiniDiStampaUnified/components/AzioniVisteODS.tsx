import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";

export type VistaODS = "nuovo" | "in-corso" | "completati";

interface AzioniVisteODSProps {
  vista: VistaODS;
  onNaviga: (percorso: string) => void;
}

// Viste sorelle degli ordini di stampa, con lo stesso permesso delle rotte (lib/accessi/pagine.ts)
const VISTE_SORELLE: { vista: Exclude<VistaODS, "nuovo">; percorso: string; etichetta: string }[] = [
  { vista: "in-corso", percorso: "/ods-in-corso", etichetta: "Ordini in corso" },
  { vista: "completati", percorso: "/ods-completati", etichetta: "Ordini completati" },
];

/** Azioni dell'intestazione: le viste sorelle (secondarie) e, dove si può creare, "Nuovo ordine". */
function AzioniVisteODS({ vista, onNaviga }: AzioniVisteODSProps) {
  return (
    <>
      {VISTE_SORELLE.filter((sorella) => sorella.vista !== vista).map((sorella) => (
        <PermissionGate key={sorella.vista} permission={PERMISSIONS.ORDINI_STAMPA.VISUALIZZA}>
          <Button type="button" variant="outline-secondary" onClick={() => onNaviga(sorella.percorso)}>
            {sorella.etichetta}
          </Button>
        </PermissionGate>
      ))}
      {vista !== "nuovo" && (
        <PermissionGate permission={PERMISSIONS.ORDINI_STAMPA.CREA}>
          <Button type="button" variant="primary" onClick={() => onNaviga("/nuovo-ods")}>
            <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
            Nuovo ordine
          </Button>
        </PermissionGate>
      )}
    </>
  );
}

export default AzioniVisteODS;
