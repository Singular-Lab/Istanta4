import dayjs from "dayjs";
import { TIPO_KIT_DESIGN, TIPO_LAVORAZIONE } from "../../../../lib/enums";
import { FC } from "react";
import { InfoBadgesProps } from "../types";
import InfoBadge from "./InfoBadge";

/**
 * InfoBadges - Gruppo di badge informativi per Area, Canale e Tipo Kit.
 */
const InfoBadges: FC<InfoBadgesProps> = ({
  nomeArea,
  nomeCanale,
  tipoKit,
  tipoLavorazione,
  origineStorico
}) => {
  // Formatta il tipo kit per la visualizzazione
  const formatTipoKit = (tipo?: TIPO_KIT_DESIGN | string) => {
    if (!tipo) return null;
    if (tipo === TIPO_KIT_DESIGN.AUTOMATICO || tipo === "AUTOMATICO") return "Automatico";
    if (tipo === TIPO_KIT_DESIGN.MANUALE || tipo === "MANUALE") return "Manuale";
    return String(tipo);
  };

  // Formatta il tipo lavorazione per la visualizzazione
  const formatTipoLavorazione = (tipo?: TIPO_LAVORAZIONE) => {
    if (!tipo) return null;
    if (tipo === TIPO_LAVORAZIONE.VOLANTINO) return "Volantino";
    if (tipo === TIPO_LAVORAZIONE.POP) return "POP";
    return null;
  };

  const tipoKitLabel = formatTipoKit(tipoKit);
  const tipoLavorazioneLabel = formatTipoLavorazione(tipoLavorazione);

  return (
    <div className="flex flex-wrap gap-3">
      {/* Il kit viene dallo storico: da qui lo ereditano tutte le sue referenze. */}
      {origineStorico && (
        <InfoBadge
          icon="History"
          label="Recuperato dallo storico"
          value={dayjs(origineStorico.importatoIl).format("DD/MM/YYYY HH:mm")}
          variant="info"
        />
      )}
      {nomeArea && (
        <InfoBadge
          icon="MapPin"
          label="Area"
          value={nomeArea}
          variant="primary"
        />
      )}
      {nomeCanale && (
        <InfoBadge
          icon="Radio"
          label="Canale"
          value={nomeCanale}
          variant="info"
        />
      )}
      {tipoKitLabel && (
        <InfoBadge
          icon="Cpu"
          label="Tipo Kit"
          value={tipoKitLabel}
        />
      )}
      {tipoLavorazioneLabel && (
        <InfoBadge
          icon={tipoLavorazione === TIPO_LAVORAZIONE.VOLANTINO ? "BookOpen" : "Package"}
          label="Tipo"
          value={tipoLavorazioneLabel}
          variant={tipoLavorazione === TIPO_LAVORAZIONE.VOLANTINO ? "success" : "warning"}
        />
      )}
    </div>
  );
};

export default InfoBadges;
