import { STATO_UTENTI } from "../../../lib/enums";

// Etichetta, icona e colore dello stato utente, uguali in tabella e nelle schede mobile
export const statoUtente = (stato?: string) => {
  switch (stato) {
    case STATO_UTENTI.ATTIVO:
      return { etichetta: "Attivo", icona: "CircleCheck", colore: "text-success" };
    case STATO_UTENTI.DISATTIVO:
      return { etichetta: "Disattivo", icona: "CircleX", colore: "text-danger" };
    case STATO_UTENTI.BLOCCATO:
      return { etichetta: "Bloccato", icona: "Lock", colore: "text-danger" };
    case STATO_UTENTI.SOSPESO:
      return { etichetta: "Sospeso", icona: "CirclePause", colore: "" };
    case STATO_UTENTI.ELIMINATO:
      return { etichetta: "Eliminato", icona: "Trash", colore: "" };
    default:
      return { etichetta: stato || "Non definito", icona: "CircleX", colore: "" };
  }
};
