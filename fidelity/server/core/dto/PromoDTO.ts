import { STATO_PROMO } from '../../../lib/enums';
import type { ContextLavorazione } from '../../../lib/types';

export type PromoContextValue = string | number | boolean | null | Array<string | number | boolean>;

export type PromoContextItem = ContextLavorazione & {
  user_value?: PromoContextValue;
};

/**
 * DTO per la creazione di una nuova promozione
 */
export interface CreatePromoDTO {
  nome: string;
  data_registrazione?: Date;
  validita_dal: Date;
  validita_al: Date;
  data_scadenza: Date;
  offset_visibilita: number;
  stato?: STATO_PROMO;
  context: PromoContextItem[];
  gdo: string;
}

/**
 * DTO per l'aggiornamento di una promozione esistente
 */
export interface UpdatePromoDTO {
  nome?: string;
  data_registrazione?: Date;
  validita_dal?: Date | string;
  validita_al?: Date | string;
  data_scadenza?: Date | string;
  offset_visibilita?: number;
  stato?: STATO_PROMO;
  context?: PromoContextItem[];
  gdo?: string;
}

/**
 * DTO per la risposta con i dati della promozione
 */
export interface PromoResponseDTO {
  id: string;
  nome: string;
  data_registrazione: Date;
  validita_dal: Date | string;
  validita_al: Date | string;
  data_scadenza: Date;
  offset_visibilita: number;
  stato: STATO_PROMO;
  context: PromoContextItem[];
  gdo: string;
  is_deletable?: boolean;
  numero_kit_collegati?: number;
  is_active?: boolean;
  is_expired?: boolean;
  days_until_expiry?: number;
  days_since_start?: number;
}

/**
 * DTO per i filtri di ricerca promozioni
 */
export interface PromoFiltersDTO {
  stato?: STATO_PROMO;
  gdo?: string;
  search?: string;
  validita_dal?: Date;
  validita_al?: Date;
  is_active?: boolean;
  is_expired?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'data_registrazione' | 'validita_dal' | 'validita_al';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle promozioni
 */
export interface PromoPaginatedResponseDTO {
  promozioni: PromoResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle promozioni
 */
export interface PromoStatsDTO {
  total: number;
  promozioni_attive: number;
  promozioni_scadute: number;
  promozioni_in_scadenza: number;
  per_stato: Record<STATO_PROMO, number>;
  per_gdo: Array<{ gdo: string; count: number }>;
  prossime_scadenze: PromoResponseDTO[];
}

/**
 * DTO per la validazione delle date di una promozione
 */
export interface ValidatePromoDatesDTO {
  validita_dal: Date;
  validita_al: Date;
  data_scadenza: Date;
  exclude_id?: string;
}

/**
 * DTO per la risposta della validazione
 */
export interface ValidatePromoDatesResponseDTO {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * DTO per la duplicazione di una promozione
 */
export interface DuplicatePromoDTO {
  id: string;
  nuovo_nome?: string;
  nuova_validita_dal?: Date;
  nuova_validita_al?: Date;
  nuova_data_scadenza?: Date;
}

/**
 * DTO per l'importazione di promozioni
 */
export interface ImportPromoDTO {
  promozioni: CreatePromoDTO[] | UpdatePromoDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportPromoResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per l'esportazione di promozioni
 */
export interface ExportPromoDTO {
  formato: 'csv' | 'xlsx' | 'json';
  filtri?: PromoFiltersDTO;
  campi?: string[];
}

/**
 * DTO per la risposta dell'esportazione
 */
export interface ExportPromoResponseDTO {
  file_url: string;
  file_name: string;
  file_size: number;
  total_records: number;
}
