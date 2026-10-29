import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { Link } from "react-router-dom";
import { ETICHETTA_PERIODO, percorsoPop, percorsoVolantini, periodoDellaPromo } from "../../../../lib/materiali/periodi";
import SezioneCollegamento from "./SezioneCollegamento";

interface CollegamentiMaterialiProps {
  idPromo: string;
  statoPromo: string | null | undefined;
}

/**
 * Dal dettaglio della promo alle viste Volantini e POP del suo periodo, già filtrate su di lei.
 * Una promo senza periodo (eliminata, stato sconosciuto) non ne ha.
 */
function CollegamentiMateriali({ idPromo, statoPromo }: CollegamentiMaterialiProps) {
  const puoVedereMateriali = usePermission(PERMISSIONS.MATERIALI.VISUALIZZA);
  const periodo = periodoDellaPromo(statoPromo);
  if (!periodo || !puoVedereMateriali) return null;

  return (
    <SezioneCollegamento
      icona="FolderOpen"
      titolo="Materiali della promozione"
      descrizione={`Kit volantino e file POP della promozione, nelle viste ${ETICHETTA_PERIODO[periodo]}.`}
      azione={
        <>
          <Button as={Link} to={percorsoVolantini(periodo, idPromo)} variant="outline-secondary" size="sm">
            <Lucide icon="Newspaper" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Volantini
          </Button>
          <Button as={Link} to={percorsoPop(periodo, idPromo)} variant="outline-secondary" size="sm">
            <Lucide icon="Presentation" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            POP
          </Button>
        </>
      }
    />
  );
}

export default CollegamentiMateriali;
