import type {
  BulkUpdateHubServicePatch,
  HubServiceDocumentAsset,
  HubServiceDTO,
  HubServiceVideoAsset,
} from '../../../lib/types';
import type { HubUserContext } from '../services/hubRoleUtils';

export interface CreateHubServiceInput {
  codice: string;
  nome: string;
  url: string;
  redirect_page?: string;
  documents?: HubServiceDocumentAsset[];
  videos?: HubServiceVideoAsset[];
  tipo_utente: string;
  ruolo_gdo?: string | null;
  descrizione?: string;
  icona?: string;
  colore?: string;
  tipo_url?: 'internal' | 'external' | 'external_fico';
  attivo?: boolean;
  in_manutenzione?: boolean;
  in_evidenza?: boolean;
  ordine?: number;
  meta?: Record<string, unknown>;
}

export interface BulkCreateHubServiceInput {
  codice: string;
  nome: string;
  url: string;
  redirect_page?: string;
  documents?: HubServiceDocumentAsset[];
  videos?: HubServiceVideoAsset[];
  descrizione?: string;
  icona?: string;
  colore?: string;
  tipo_url?: 'internal' | 'external' | 'external_fico';
  attivo?: boolean;
  in_manutenzione?: boolean;
  in_evidenza?: boolean;
  ordine?: number;
  meta?: Record<string, unknown>;
  tipi_utente: Array<{ tipo_utente: string; ruolo_gdo?: string | null }>;
}

export interface IHubServiceService {
  getServicesForRole(context: HubUserContext): Promise<HubServiceDTO[]>;
  getAllServices(): Promise<HubServiceDTO[]>;
  getAllServicesGrouped(): Promise<Record<string, HubServiceDTO[]>>;
  createService(data: CreateHubServiceInput): Promise<HubServiceDTO>;
  bulkCreateService(data: BulkCreateHubServiceInput): Promise<HubServiceDTO[]>;
  updateService(id: string, data: Partial<HubServiceDTO>): Promise<HubServiceDTO | null>;
  bulkUpdateServices(ids: string[], patch: BulkUpdateHubServicePatch): Promise<HubServiceDTO[]>;
  deleteService(id: string): Promise<boolean>;
  deleteServiceByCode(codice: string): Promise<number>;
}
