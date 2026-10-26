/**
 * DTO per la creazione di una nuova area
 */
export interface CreateAreaDTO {
  id?: string;
  codice: string;
  nome: string;
  id_gdo?: string;
}

/**
 * DTO per l'aggiornamento di un'area esistente
 */
export interface UpdateAreaDTO {
  id?: string;
  codice?: string;
  nome?: string;
  id_gdo?: string;
}

/**
 * DTO per la risposta con i dati dell'area
 */
export interface AreaResponseDTO {
  id: string;
  codice: string;
  nome: string;
  id_gdo: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca aree
 */
export interface AreaFiltersDTO {
  id_gdo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'codice' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle aree
 */
export interface AreaPaginatedResponseDTO {
  aree: AreaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
