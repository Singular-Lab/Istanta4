/**
 * DTO per la creazione di un nuovo tipo utente punto vendita
 */
export interface CreateTipoUtentePuntoVenditaDTO {
  ruolo_tipo_utente: string;
  tipo_tipo_utente: string;
}

/**
 * DTO per l'aggiornamento di un tipo utente punto vendita esistente
 */
export interface UpdateTipoUtentePuntoVenditaDTO {
  ruolo_tipo_utente?: string;
  tipo_tipo_utente?: string;
}

/**
 * DTO per la risposta con i dati del tipo utente punto vendita
 */
export interface TipoUtentePuntoVenditaResponseDTO {
  id_tipo_utente: string;
  ruolo_tipo_utente: string;
  tipo_tipo_utente: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca tipi utente punto vendita
 */
export interface TipoUtentePuntoVenditaFiltersDTO {
  ruolo_tipo_utente?: string;
  tipo_tipo_utente?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'ruolo_tipo_utente' | 'tipo_tipo_utente' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei tipi utente punto vendita
 */
export interface TipoUtentePuntoVenditaPaginatedResponseDTO {
  tipi_utente: TipoUtentePuntoVenditaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei tipi utente punto vendita
 */
export interface TipoUtentePuntoVenditaStatsDTO {
  total_tipi: number;
  per_ruolo: Array<{ ruolo: string; count: number }>;
  per_tipo: Array<{ tipo: string; count: number }>;
}

/**
 * DTO per l'importazione di tipi utente punto vendita
 */
export interface ImportTipoUtentePuntoVenditaDTO {
  tipi_utente: CreateTipoUtentePuntoVenditaDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportTipoUtentePuntoVenditaResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di tipi utente punto vendita per ruolo
 */
export interface SearchTipoUtentePuntoVenditaByRuoloDTO {
  ruolo_tipo_utente: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tipi utente punto vendita per tipo
 */
export interface SearchTipoUtentePuntoVenditaByTipoDTO {
  tipo_tipo_utente: string;
  limit?: number;
  offset?: number;
} 