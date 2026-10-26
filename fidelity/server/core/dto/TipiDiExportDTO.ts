import { MODALITA_TIPO_EXPORT } from '../../../lib/enums';
import { Filtro } from '../../../lib/types';

/**
 * DTO per la creazione di un nuovo tipo di export
 */
export interface CreateTipiDiExportDTO {
  id?: string;
  nome: string;
  codice: string;
  modalita: MODALITA_TIPO_EXPORT;
  guid_namingconvention?: string;
  filtri?: Filtro[];
}

/**
 * DTO per l'aggiornamento di un tipo di export esistente
 */
export interface UpdateTipiDiExportDTO {
  nome?: string;
  codice?: string;
  modalita?: MODALITA_TIPO_EXPORT;
  guid_namingconvention?: string;
  filtri?: Filtro[];
}

/**
 * DTO per la risposta con i dati del tipo di export
 */
export interface TipiDiExportResponseDTO {
  id: string;
  nome: string;
  codice: string;
  modalita: MODALITA_TIPO_EXPORT;
  guid_namingconvention?: string;
  filtri?: Filtro[];
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca tipi di export
 */
export interface TipiDiExportFiltersDTO {
  modalita?: MODALITA_TIPO_EXPORT;
  guid_namingconvention?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'codice' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei tipi di export
 */
export interface TipiDiExportPaginatedResponseDTO {
  tipi_di_export: TipiDiExportResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei tipi di export
 */
export interface TipiDiExportStatsDTO {
  total: number;
  per_modalita: Record<MODALITA_TIPO_EXPORT, number>;
  per_naming_convention: Array<{ guid_naming_convention: string; count: number }>;
  con_filtri: number;  
  senza_filtri: number;
}

/**
 * DTO per l'importazione di tipi di export
 */
export interface ImportTipiDiExportDTO {
  tipi_di_export: CreateTipiDiExportDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportTipiDiExportResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di tipi di export per modalità
 */
export interface SearchTipiDiExportByModalitaDTO {
  modalita: MODALITA_TIPO_EXPORT;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tipi di export per naming convention
 */
export interface SearchTipiDiExportByNamingConventionDTO {
  guid_namingconvention: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la validazione di un tipo di export
 */
export interface ValidateTipiDiExportDTO {
  nome: string;
  codice: string;
  modalita: MODALITA_TIPO_EXPORT;
  exclude_id?: string;
}

/**
 * DTO per la risposta della validazione
 */
export interface ValidateTipiDiExportResponseDTO {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
} 