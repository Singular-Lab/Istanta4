import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../../lib/enums";
import { FileSectionMode, StateConfig } from "../types";

/**
 * Configurazione per ogni stato della lavorazione.
 * Definisce come il layout deve comportarsi per ogni stato.
 */
export const STATE_CONFIG: Record<STATO_LAVORAZIONE_KIT_RUNTIME, StateConfig> = {
  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE]: {
    hero: {
      icon: "Loader",
      title: "Kit in Lavorazione",
      subtitle: "Gestisci i file e procedi con la revisione",
      gradient: "from-theme-1 via-theme-1/90 to-theme-1/80"
    },
    stats: {
      showRevisionStats: false,
      showErrorStats: false
    },
    fileSection: {
      mode: "upload" as FileSectionMode,
      showUploader: true,
      showAcceptReject: false,
      showStagingArea: false
    },
    actions: {
      primary: "Sottoponi a revisione",
      secondary: ["Elimina Lavorazione"]
    }
  },

  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE]: {
    hero: {
      icon: "ClipboardCheck",
      title: "Revisione in Corso",
      subtitle: "Approva o rifiuta i file per procedere",
      gradient: "from-warning via-warning/90 to-warning/80"
    },
    stats: {
      showRevisionStats: true,
      showErrorStats: false
    },
    fileSection: {
      mode: "revision" as FileSectionMode,
      showUploader: false,
      showAcceptReject: true,
      showStagingArea: false
    },
    actions: {
      primary: "Pubblica Kit",
      secondary: ["Riporta in Lavorazione", "Elimina", "Rilavora"]
    }
  },

  [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI]: {
    hero: {
      icon: "TriangleAlert",
      title: "File con Errori da Correggere",
      subtitle: "Carica i file corretti per procedere",
      gradient: "from-danger via-danger/90 to-warning/80"
    },
    stats: {
      showRevisionStats: true,
      showErrorStats: true
    },
    fileSection: {
      mode: "error-correction" as FileSectionMode,
      showUploader: true,
      showAcceptReject: false,
      showStagingArea: true
    },
    actions: {
      primary: "Carica e manda in revisione",
      secondary: ["Elimina", "Rilavora"]
    }
  },

  [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO]: {
    hero: {
      icon: "FileCheck",
      title: "Kit Pubblicato",
      subtitle: "Kit pubblicato con successo",
      gradient: "from-success via-success/90 to-success/80"
    },
    stats: {
      showRevisionStats: false,
      showErrorStats: false
    },
    fileSection: {
      mode: "view" as FileSectionMode,
      showUploader: false,
      showAcceptReject: false,
      showStagingArea: false
    },
    actions: {
      primary: "Scarica Tutto (ZIP)",
      secondary: ["Rilavora Kit"]
    }
  },

  // Stato ELIMINATO - fallback (non dovrebbe mai essere visualizzato)
  [STATO_LAVORAZIONE_KIT_RUNTIME.ELIMINATO]: {
    hero: {
      icon: "Trash2",
      title: "Kit Eliminato",
      subtitle: "Questo kit è stato eliminato",
      gradient: "from-slate-500 via-slate-400 to-slate-300"
    },
    stats: {
      showRevisionStats: false,
      showErrorStats: false
    },
    fileSection: {
      mode: "view" as FileSectionMode,
      showUploader: false,
      showAcceptReject: false,
      showStagingArea: false
    },
    actions: {
      primary: "",
      secondary: []
    }
  }
};

/**
 * Ottiene la configurazione per uno stato specifico.
 * Fallback a IN_LAVORAZIONE se lo stato non è riconosciuto.
 */
export const getStateConfig = (stato: STATO_LAVORAZIONE_KIT_RUNTIME): StateConfig => {
  return STATE_CONFIG[stato] || STATE_CONFIG[STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE];
};

/**
 * Mapping icone per gli eventi della timeline
 */
export const TIMELINE_ICON_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  created: { icon: "Plus", color: "text-info", bg: "bg-info/10" },
  upload: { icon: "Upload", color: "text-slate-600", bg: "bg-slate-100" },
  accepted: { icon: "Check", color: "text-success", bg: "bg-success/10" },
  rejected: { icon: "X", color: "text-danger", bg: "bg-danger/10" },
  published: { icon: "Rocket", color: "text-theme-1", bg: "bg-theme-1/10" },
  revision: { icon: "ClipboardCheck", color: "text-warning", bg: "bg-warning/10" },
  error: { icon: "AlertTriangle", color: "text-danger", bg: "bg-danger/10" },
  default: { icon: "Circle", color: "text-slate-400", bg: "bg-slate-100" }
};

/**
 * Ottiene la configurazione icona per un tipo di evento timeline
 */
export const getTimelineIconConfig = (type: string) => {
  return TIMELINE_ICON_CONFIG[type] || TIMELINE_ICON_CONFIG.default;
};

/**
 * Varianti colore per i badge info
 */
export const INFO_BADGE_VARIANTS = {
  default: "border-slate-200 bg-white text-slate-600",
  primary: "border-theme-1/20 bg-theme-1/5 text-theme-1",
  info: "border-info/20 bg-info/5 text-info",
  success: "border-success/20 bg-success/5 text-success",
  warning: "border-warning/20 bg-warning/5 text-warning",
  danger: "border-danger/20 bg-danger/5 text-danger"
};
