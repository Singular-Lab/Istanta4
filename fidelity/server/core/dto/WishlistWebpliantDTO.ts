/**
 * DTO per la creazione di una nuova wishlist webpliant
 */
export interface CreateWishlistWebpliantDTO {
  id_canale: string;
  id_area: string;
  id_pv?: string;
  meta?: any;
  id_workspace?: string;
  id_pagina?: string;
}

/**
 * DTO per l'aggiornamento di una wishlist webpliant esistente
 */
export interface UpdateWishlistWebpliantDTO {
  id_canale?: string;
  id_area?: string;
  id_pv?: string;
  meta?: any;
  id_workspace?: string;
  id_pagina?: string;
}

/**
 * DTO per la risposta con i dati della wishlist webpliant
 */
export interface WishlistWebpliantResponseDTO {
  id: string;
  id_canale: string;
  id_area: string;
  id_pv?: string;
  meta?: any;
  id_workspace?: string;
  id_pagina?: string;
}

/**
 * DTO per i filtri di ricerca wishlist webpliant
 */
export interface WishlistWebpliantFiltersDTO {
  id_canale?: string;
  id_area?: string;
  id_pv?: string;
  id_workspace?: string;
  id_pagina?: string;
  limit?: number;
  offset?: number;
  order_by?: 'id';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle wishlist webpliant
 */
export interface WishlistWebpliantPaginatedResponseDTO {
  wishlist_webpliant: WishlistWebpliantResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle wishlist webpliant
 */
export interface WishlistWebpliantStatsDTO {
  total: number;
  per_canale: Array<{ id_canale: string; count: number }>;
  per_area: Array<{ id_area: string; count: number }>;
  per_workspace: Array<{ id_workspace: string; count: number }>;
  per_pagina: Array<{ id_pagina: string; count: number }>;
}

/**
 * DTO per l'importazione di wishlist webpliant
 */
export interface ImportWishlistWebpliantDTO {
  wishlist_webpliant: CreateWishlistWebpliantDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportWishlistWebpliantResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di wishlist per workspace
 */
export interface SearchWishlistByWorkspaceDTO {
  id_workspace: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di wishlist per pagina
 */
export interface SearchWishlistByPaginaDTO {
  id_pagina: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di wishlist per punto vendita
 */
export interface SearchWishlistByPuntoVenditaDTO {
  id_pv: string;
  limit?: number;
  offset?: number;
} 