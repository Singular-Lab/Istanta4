import { FICO_ORIGIN } from '../../../lib/enums';

/**
 * DTO per la creazione di un nuovo utente guest
 */
export interface CreateUtentiGuestDTO {
  dettagli_utente: string;
  origine: FICO_ORIGIN;
  email: string;
}

/**
 * DTO per l'aggiornamento di un utente guest esistente
 */
export interface UpdateUtentiGuestDTO {
  dettagli_utente?: string;
  origine?: FICO_ORIGIN;
  email?: string;
}

/**
 * DTO per la risposta con i dati dell'utente guest
 */
export interface UtentiGuestResponseDTO {
  id: string;
  dettagli_utente: string;
  origine: FICO_ORIGIN;
  email: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca utenti guest
 */
export interface UtentiGuestFiltersDTO {
  origine?: FICO_ORIGIN;
  email?: string;
  data_creazione_da?: Date;
  data_creazione_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'email' | 'origine';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata degli utenti guest
 */
export interface UtentiGuestPaginatedResponseDTO {
  utenti_guest: UtentiGuestResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche degli utenti guest
 */
export interface UtentiGuestStatsDTO {
  total: number;
  per_origine: Record<FICO_ORIGIN, number>;
  nuovi_oggi: number;
  nuovi_settimana: number;
  nuovi_mese: number;
  per_periodo: Array<{ periodo: string; count: number }>;
}

/**
 * DTO per l'importazione di utenti guest
 */
export interface ImportUtentiGuestDTO {
  utenti_guest: CreateUtentiGuestDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportUtentiGuestResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di utenti guest per origine
 */
export interface SearchUtentiGuestByOrigineDTO {
  origine: FICO_ORIGIN;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di utenti guest per email
 */
export interface SearchUtentiGuestByEmailDTO {
  email: string;
  limit?: number;
  offset?: number;
} 