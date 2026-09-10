/**
 * DTO per la creazione di un nuovo utente anonimo
 */
export interface CreateUtentiAnonimiDTO {
  meta: object;
}

/**
 * DTO per l'aggiornamento di un utente anonimo esistente
 */
export interface UpdateUtentiAnonimiDTO {
  meta?: object;
}

/**
 * DTO per la risposta con i dati dell'utente anonimo
 */
export interface UtentiAnonimiResponseDTO {
  id: string;
  meta: object;
  createdat: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca utenti anonimi
 */
export interface UtentiAnonimiFiltersDTO {
  data_creazione_da?: Date;
  data_creazione_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata degli utenti anonimi
 */
export interface UtentiAnonimiPaginatedResponseDTO {
  utenti_anonimi: UtentiAnonimiResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche degli utenti anonimi
 */
export interface UtentiAnonimiStatsDTO {
  total: number;
  nuovi_oggi: number;
  nuovi_settimana: number;
  nuovi_mese: number;
  per_periodo: Array<{ periodo: string; count: number }>;
}

/**
 * DTO per l'importazione di utenti anonimi
 */
export interface ImportUtentiAnonimiDTO {
  utenti_anonimi: CreateUtentiAnonimiDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportUtentiAnonimiResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
} 