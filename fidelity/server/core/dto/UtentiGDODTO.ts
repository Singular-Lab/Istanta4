/**
 * DTO per la creazione di una nuova associazione utente-GDO
 */
export interface CreateUtentiGDODTO {
  id_utente: string;
  id_gdo: string;
}

/**
 * DTO per l'aggiornamento di un'associazione utente-GDO esistente
 */
export interface UpdateUtentiGDODTO {
  id_utente?: string;
  id_gdo?: string;
}

/**
 * DTO per la risposta con i dati dell'associazione utente-GDO
 */
export interface UtentiGDOResponseDTO {
  id: string;
  id_utente: string;
  id_gdo: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca associazioni utente-GDO
 */
export interface UtentiGDOFiltersDTO {
  id_utente?: string;
  id_gdo?: string;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle associazioni utente-GDO
 */
export interface UtentiGDOPaginatedResponseDTO {
  utenti_gdo: UtentiGDOResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle associazioni utente-GDO
 */
export interface UtentiGDOStatsDTO {
  total_associazioni: number;
  per_utente: Array<{ id_utente: string; count: number }>;
  per_gdo: Array<{ id_gdo: string; count: number }>;
  utenti_con_piu_gdo: Array<{ id_utente: string; count: number }>;
}

/**
 * DTO per l'importazione di associazioni utente-GDO
 */
export interface ImportUtentiGDODTO {
  utenti_gdo: CreateUtentiGDODTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportUtentiGDOResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di GDO per utente
 */
export interface SearchGDOByUtenteDTO {
  id_utente: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di utenti per GDO
 */
export interface SearchUtentiByGDODTO {
  id_gdo: string;
  limit?: number;
  offset?: number;
} 