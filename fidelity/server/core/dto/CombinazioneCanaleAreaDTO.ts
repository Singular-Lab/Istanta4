/**
 * DTO per la creazione di una nuova combinazione canale-area
 */
export interface CreateCombinazioneCanaleAreaDTO {
  id_gdo: string;
  id_canale: string;
  id_area: string;
  stato: 'ATTIVO' | 'DISATTIVO';
}

/**
 * DTO per l'aggiornamento di una combinazione canale-area esistente
 */
export interface UpdateCombinazioneCanaleAreaDTO {
  id_gdo?: string;
  id_canale?: string;
  id_area?: string;
  stato?: 'ATTIVO' | 'DISATTIVO';
}

/**
 * DTO per la risposta con i dati della combinazione canale-area
 */
export interface CombinazioneCanaleAreaResponseDTO {
  id: string;
  id_gdo: string;
  id_canale: string;
  id_area: string;
  stato: 'ATTIVO' | 'DISATTIVO';
  sigla: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca combinazioni canale-area
 */
export interface CombinazioneCanaleAreaFiltersDTO {
  id_gdo?: string;
  id_canale?: string;
  id_area?: string;
  stato?: 'ATTIVO' | 'DISATTIVO';
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle combinazioni canale-area
 */
export interface CombinazioneCanaleAreaPaginatedResponseDTO {
  combinazioni_canale_area: CombinazioneCanaleAreaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle combinazioni canale-area
 */
export interface CombinazioneCanaleAreaStatsDTO {
  total_combinazioni: number;
  per_gdo: Array<{ id_gdo: string; count: number }>;
  per_canale: Array<{ id_canale: string; count: number }>;
  per_area: Array<{ id_area: string; count: number }>;
  per_stato: Array<{ stato: string; count: number }>;
}

/**
 * DTO per l'importazione di combinazioni canale-area
 */
export interface ImportCombinazioneCanaleAreaDTO {
  combinazioni_canale_area: CreateCombinazioneCanaleAreaDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportCombinazioneCanaleAreaResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di combinazioni per GDO
 */
export interface SearchCombinazioneByGDODTO {
  id_gdo: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di combinazioni per canale
 */
export interface SearchCombinazioneByCanaleDTO {
  id_canale: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di combinazioni per area
 */
export interface SearchCombinazioneByAreaDTO {
  id_area: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di combinazioni per stato
 */
export interface SearchCombinazioneByStatoDTO {
  stato: 'ATTIVO' | 'DISATTIVO';
  limit?: number;
  offset?: number;
}

/**
 * DTO per l'attivazione/disattivazione di una combinazione
 */
export interface ToggleCombinazioneStatoDTO {
  id: string;
  nuovo_stato: 'ATTIVO' | 'DISATTIVO';
}
