/**
 * DTO per la creazione di una nuova naming convention
 */
export interface CreateNamingConventionDTO {
  nome: string;
  descrizione: string;
  fields: string[];
}

/**
 * DTO per l'aggiornamento di una naming convention esistente
 */
export interface UpdateNamingConventionDTO {
  nome?: string;
  descrizione?: string;
  fields?: string[];
}

/**
 * DTO per la risposta con i dati della naming convention
 */
export interface NamingConventionResponseDTO {
  id: string;
  nome: string;
  descrizione: string;
  fields: string[];
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca naming convention
 */
export interface NamingConventionFiltersDTO {
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle naming convention
 */
export interface NamingConventionPaginatedResponseDTO {
  naming_conventions: NamingConventionResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle naming convention
 */
export interface NamingConventionStatsDTO {
  total: number;
  per_numero_campi: Array<{ numero_campi: number; count: number }>;
  ultime_creazioni: NamingConventionResponseDTO[];
}

/**
 * DTO per l'importazione di naming convention
 */
export interface ImportNamingConventionDTO {
  naming_conventions: CreateNamingConventionDTO[] | UpdateNamingConventionDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportNamingConventionResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la validazione di una naming convention
 */
export interface ValidateNamingConventionDTO {
  nome: string;
  fields: string[];
  exclude_id?: string;
}

/**
 * DTO per la risposta della validazione
 */
export interface ValidateNamingConventionResponseDTO {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * DTO per la ricerca di naming convention per nome
 */
export interface SearchNamingConventionByNameDTO {
  nome: string;
  limit?: number;
  offset?: number;
} 