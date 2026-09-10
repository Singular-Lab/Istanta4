import type {
  HubNewsAdminDTO,
  HubNewsType,
  HubServiceDocumentAsset,
  HubServiceDTO,
  HubServiceVideoAsset,
} from "../../../lib/types";

export type HubServiceColor = "primary" | "info" | "success" | "warning" | "danger";

export interface ServiceTargetOption {
  key: string;
  label: string;
  tipo_utente: string;
  ruolo_gdo: string | null;
  category: "base" | "with_role";
}

export interface HubServiceGroup {
  codice: string;
  nome: string;
  descrizione: string;
  icona: string;
  colore: string;
  documents: HubServiceDocumentAsset[];
  videos: HubServiceVideoAsset[];
  variants: HubServiceDTO[];
}

export interface ServiceDocumentFormValue extends HubServiceDocumentAsset {
  file?: File;
}

export interface ServiceVideoFormValue extends HubServiceVideoAsset {
  file?: File;
}

export interface ServiceFormValues {
  codice: string;
  nome: string;
  descrizione: string;
  icona: string;
  colore: HubServiceColor;
  url: string;
  redirect_page: string;
  tipo_url: HubServiceDTO["tipo_url"];
  ordine: number;
  attivo: boolean;
  in_manutenzione: boolean;
  in_evidenza: boolean;
  documents: ServiceDocumentFormValue[];
  videos: ServiceVideoFormValue[];
}

export interface NewsFormValues {
  titolo: string;
  contenuto: string;
  tipo: HubNewsType;
  icona: string;
  url: string;
  in_evidenza: boolean;
  attivo: boolean;
  data_pubblicazione: string;
  data_scadenza: string;
  autore_nome: string;
  ruoli_destinatari: string[];
}

export type NewsStatus = "draft" | "scheduled" | "online" | "expired";

export interface NewsStatusMeta {
  label: string;
  className: string;
  icon: string;
}

export type ServiceDialogMode = "create" | "add-variant" | "edit-group";
export type NewsDialogMode = "create" | "edit";

export interface ServiceMutationPayload {
  values: ServiceFormValues;
  targets: ServiceTargetOption[];
  variantsToDelete?: HubServiceDTO[];
}

export interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
}

export interface ServiceDialogState {
  mode: ServiceDialogMode;
  group?: HubServiceGroup;
  variant?: HubServiceDTO;
}

export interface NewsDialogState {
  mode: NewsDialogMode;
  news?: HubNewsAdminDTO;
}

export type ServiceStatusFilter = "all" | "attivo" | "manutenzione" | "inattivo";
export type NewsStatusFilter = "all" | NewsStatus;

