/**
 * DTO per la creazione di una nuova GDO
 */
export interface CreateGDODTO {
  nome: string;
  id_parent?: string;
}

/**
 * DTO per l'aggiornamento di una GDO esistente
 */
export interface UpdateGDODTO {
  nome?: string;
  id_parent?: string;
}

/**
 * DTO per la risposta con i dati della GDO
 */
export interface GDOResponseDTO {
  id: string;
  nome: string;
  id_parent?: string;
  ragione_sociale?: string;
  createdat?: Date;
  updatedat: Date;
  is_parent?: boolean;
  has_children?: boolean;
}

/**
 * DTO per i filtri di ricerca GDO
 */
export interface GDOFiltersDTO {
  id_parent?: string;
  search?: string;
  is_parent?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle GDO
 */
export interface GDOPaginatedResponseDTO {
  gdo: GDOResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle GDO
 */
export interface GDOStatsDTO {
  total: number;
  parent: number;
  child: number;
  per_livello: Array<{ livello: number; count: number }>;
}

/**
 * DTO per la struttura gerarchica delle GDO
 */
export interface GDOHierarchyDTO {
  id: string;
  nome: string;
  livello: number;
  children?: GDOHierarchyDTO[];
}

/**
 * DTO per l'importazione di GDO
 */
export interface ImportGDODTO {
  gdo: CreateGDODTO[] | UpdateGDODTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportGDOResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}
