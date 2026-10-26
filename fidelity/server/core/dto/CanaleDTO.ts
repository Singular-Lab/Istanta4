/**
 * DTO per la creazione di un nuovo canale
 */
export interface CreateCanaleDTO {
  codice: string;
  nome: string;
  id_gdo: string;
}

/**
 * DTO per l'aggiornamento di un canale esistente
 */
export interface UpdateCanaleDTO {
  codice?: string;
  nome?: string;
  id_gdo?: string;
}

/**
 * DTO per la risposta con i dati del canale
 */
export interface CanaleResponseDTO {
  id: string;
  codice: string;
  nome: string;
  id_gdo: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca canali
 */
export interface CanaleFiltersDTO {
  id_gdo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome_canali' | 'codice_canali' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei canali
 */
export interface CanalePaginatedResponseDTO {
  canali: CanaleResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei canali
 */
export interface CanaleStatsDTO {
  total_canali: number;
  per_gdo: Array<{ id_gdo: string; count: number }>;
} 