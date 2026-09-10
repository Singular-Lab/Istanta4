/**
 * DTO per la creazione di un nuovo formato
 */
export interface CreateFormatiDTO {
  id?: string;
  nome: string;
  codice: string;
  descrizione: string;
  tipo_lavorazione: number;
}

/**
 * DTO per l'aggiornamento di un formato esistente
 */
export interface UpdateFormatiDTO {
  nome?: string;
  codice?: string;
  descrizione?: string;
  tipo_lavorazione?: number;
}

/**
 * DTO per la risposta con i dati del formato
 */
export interface FormatiResponseDTO {
  id?: string;
  nome: string;
  codice: string;
  descrizione: string;
  tipo_lavorazione: number;
  createdat?: Date;
  updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca formati
 */
export interface FormatiFiltersDTO {
  tipo_lavorazione?: number;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'codice' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei formati
 */
export interface FormatiPaginatedResponseDTO {
  formati: FormatiResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei formati
 */
export interface FormatiStatsDTO {
  total: number;
  per_tipo_lavorazione: Array<{ tipo_lavorazione: number; count: number }>;
}

/**
 * DTO per l'importazione di formati
 */
export interface ImportFormatiDTO {
  formati: CreateFormatiDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportFormatiResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}
