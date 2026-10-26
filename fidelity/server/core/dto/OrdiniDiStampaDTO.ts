import { STATO_ORDINI_STAMPA } from '../../../lib/enums';

/**
 * DTO per la creazione di un nuovo ordine di stampa
 */
export interface CreateOrdiniDiStampaDTO {
  id_utente: string;
  id_promo: string;
  stato?: STATO_ORDINI_STAMPA;
  data_di_conferma: string;
}

/**
 * DTO per l'aggiornamento di un ordine di stampa esistente
 */
export interface UpdateOrdiniDiStampaDTO {
  id_utente?: string;
  id_promo?: string;
  stato?: STATO_ORDINI_STAMPA;
  data_di_conferma?: string;
}

/**
 * DTO per la risposta con i dati dell'ordine di stampa
 */
export interface OrdiniDiStampaResponseDTO {
  id: string;
  id_utente: string;
  id_promo: string;
  stato: STATO_ORDINI_STAMPA;
  data_di_conferma: string;
  createdat?: Date;
  updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca ordini di stampa
 */
export interface OrdiniDiStampaFiltersDTO {
  id_utente?: string;
  id_promo?: string;
  stato?: STATO_ORDINI_STAMPA;
  data_di_conferma_da?: string;
  data_di_conferma_a?: string;
  limit?: number;
  offset?: number;
  order_by?: 'data_di_conferma' | 'createdat' | 'stato';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata degli ordini di stampa
 */
export interface OrdiniDiStampaPaginatedResponseDTO {
  ordini_di_stampa: OrdiniDiStampaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche degli ordini di stampa
 */
export interface OrdiniDiStampaStatsDTO {
  total: number;
  per_stato: Record<STATO_ORDINI_STAMPA, number>;
  per_utente: Array<{ id_utente: string; count: number }>;
  per_promo: Array<{ id_promo: string; count: number }>;
  ultimi_ordini: OrdiniDiStampaResponseDTO[];
}

/**
 * DTO per il cambio stato di un ordine di stampa
 */
export interface ChangeStatoOrdineDTO {
  id: string;
  nuovo_stato: STATO_ORDINI_STAMPA;
  note?: string;
}

/**
 * DTO per la risposta del cambio stato
 */
export interface ChangeStatoOrdineResponseDTO {
  success: boolean;
  nuovo_stato: STATO_ORDINI_STAMPA;
  data_aggiornamento: Date;
  note?: string;
}

/**
 * DTO per l'importazione di ordini di stampa
 */
export interface ImportOrdiniDiStampaDTO {
  ordini_di_stampa: CreateOrdiniDiStampaDTO[] | UpdateOrdiniDiStampaDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportOrdiniDiStampaResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per l'esportazione di ordini di stampa
 */
export interface ExportOrdiniDiStampaDTO {
  formato: 'csv' | 'xlsx' | 'json';
  filtri?: OrdiniDiStampaFiltersDTO;
  campi?: string[];
}

/**
 * DTO per la risposta dell'esportazione
 */
export interface ExportOrdiniDiStampaResponseDTO {
  file_url: string;
  file_name: string;
  file_size: number;
  total_records: number;
}
