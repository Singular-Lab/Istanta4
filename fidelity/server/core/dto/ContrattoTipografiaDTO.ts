import type { RootFileTree } from "../../../lib/types";

/**
 * DTO per la creazione di un nuovo contratto tipografia
 */
export interface CreateContrattoTipografiaDTO {
  tipi_export: string[];
  nome: string;
  id_gdo: string;
  json?: any;
  host_ftp?: string | null;
  user_ftp?: string | null;
  pwd_ftp?: string | null;
  port_ftp?: number | null;
}

/**
 * DTO per l'aggiornamento di un contratto tipografia esistente
 */
export interface UpdateContrattoTipografiaDTO {
  tipi_export?: string[];
  nome?: string;
  id_gdo?: string;
  json?: any;
  host_ftp?: string | null;
  user_ftp?: string | null;
  pwd_ftp?: string | null;
  port_ftp?: number | null;
}

/**
 * DTO per la risposta con i dati del contratto tipografia
 */
export interface ContrattoTipografiaResponseDTO {
  id: string;
  tipi_export: string[];
  nome: string;
  id_gdo: string;
  json?: RootFileTree;
  host_ftp?: string;
  user_ftp?: string;
  pwd_ftp?: string;
  port_ftp?: number;
  createdat?: Date;
  updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca contratti tipografia
 */
export interface ContrattoTipografiaFiltersDTO {
  id_gdo?: string;
  tipi_export?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei contratti tipografia
 */
export interface ContrattoTipografiaPaginatedResponseDTO {
  contratti_tipografia: ContrattoTipografiaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei contratti tipografia
 */
export interface ContrattoTipografiaStatsDTO {
  total_contratti: number;
  per_gdo: Array<{ id_gdo: string; count: number }>;
  per_tipo_export: Array<{ tipo_export: string; count: number }>;
  con_json: number;
  senza_json: number;
}

/**
 * DTO per l'importazione di contratti tipografia
 */
export interface ImportContrattoTipografiaDTO {
  contratti_tipografia: CreateContrattoTipografiaDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportContrattoTipografiaResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di contratti tipografia per GDO
 */
export interface SearchContrattoTipografiaByGDODTO {
  id_gdo: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di contratti tipografia per tipo export
 */
export interface SearchContrattoTipografiaByTipoExportDTO {
  tipi_export: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la validazione di un contratto tipografia
 */
export interface ValidateContrattoTipografiaDTO {
  nome: string;
  id_gdo: string;
  tipi_export: string[];
  exclude_id?: string;
}

/**
 * DTO per la risposta della validazione
 */
export interface ValidateContrattoTipografiaResponseDTO {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}
