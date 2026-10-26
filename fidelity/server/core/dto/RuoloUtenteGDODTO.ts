/**
 * DTO per la creazione di un nuovo ruolo utente GDO
 */
export interface CreateRuoloUtenteGDODTO {
  ruolo: string;
  api_key?: string;
}

/**
 * DTO per l'aggiornamento di un ruolo utente GDO esistente
 */
export interface UpdateRuoloUtenteGDODTO {
  ruolo?: string;
  api_key?: string;
}

/**
 * DTO per la risposta con i dati del ruolo utente GDO
 */
export interface RuoloUtenteGDOResponseDTO {
  id: string;
  ruolo: string;
  api_key?: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca ruoli utente GDO
 */
export interface RuoloUtenteGDOFiltersDTO {
  ruolo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'ruolo' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei ruoli utente GDO
 */
export interface RuoloUtenteGDOPaginatedResponseDTO {
  ruoli: RuoloUtenteGDOResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei ruoli utente GDO
 */
export interface RuoloUtenteGDOStatsDTO {
  total: number;
  con_api_key: number;
  senza_api_key: number;
  per_ruolo: Array<{ ruolo: string; count: number }>;
}

/**
 * DTO per l'importazione di ruoli utente GDO
 */
export interface ImportRuoloUtenteGDODTO {
  ruoli: CreateRuoloUtenteGDODTO[] | UpdateRuoloUtenteGDODTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportRuoloUtenteGDOResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}
