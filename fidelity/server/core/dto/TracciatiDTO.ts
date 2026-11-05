import type { ContextConfronto } from "../../../lib/types";

/**
 * DTO per la creazione di un nuovo tracciato
 */
export interface CreateTracciatiDTO {
  id_promo: string;
  context: any;
  filename: string;
  blobfile: Uint8Array;
}

/**
 * DTO per l'aggiornamento di un tracciato esistente
 */
export interface UpdateTracciatiDTO {
  id_promo?: string;
  context?: any;
  filename?: string;
  nome?: string;
  blobfile?: Uint8Array;
}

/**
 * Contenuto del file Excel del tracciato letto foglio per foglio (GET /api/tracciati/:id/parse)
 */
export interface FogliTracciatoDTO {
  sheets: { name: string; rows: (string | number | null)[][] }[];
}

/**
 * DTO per la risposta con i dati del tracciato
 */
export interface TracciatiResponseDTO {
  id: string;
  id_promo: string;
  context: any;
  /** Nome originale del file caricato: non cambia mai, e' quello usato al download */
  filename: string;
  /** Nome mostrato in FP, modificabile dall'operatore; se mai impostato coincide con filename */
  nome: string;
  stato: string;
  /**
   * File del tracciato (xlsx) con includeBlob. Nei tracciati della promo con includeJson e' invece il file JSON
   * dell'xlsx letto come fogli e righe (FogliTracciatoDTO), null senza file o se illeggibile.
   */
  blobfile?: Uint8Array | null;
  /** Dimensione in byte del file: con includeJson quella del file JSON */
  filesize?: number;
  createdat?: Date;
  updatedat: Date;
  /** Se Istanta ha il tracciato: in coda (in attesa o dopo un errore, col motivo) finche' non lo accetta. */
  istanta?: { stato: 'inviato' | 'in_attesa' | 'errore'; errore: string | null; tentativi: number };
}

/**
 * DTO per i filtri di ricerca tracciati
 */
export interface TracciatiFiltersDTO {
  id_promo?: string;
  filename?: string;
  data_creazione_da?: Date;
  data_creazione_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'filename';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei tracciati
 */
export interface TracciatiPaginatedResponseDTO {
  tracciati: TracciatiResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei tracciati
 */
export interface TracciatiStatsDTO {
  total: number;
  per_promo: Array<{ id_promo: string; count: number }>;
  per_filename: Array<{ filename: string; count: number }>;
  ultimi: TracciatiResponseDTO[];
}

/**
 * DTO per l'importazione di tracciati
 */
export interface ImportTracciatiDTO {
  tracciati: CreateTracciatiDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportTracciatiResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di tracciati per promozione
 */
export interface SearchTracciatiByPromoDTO {
  id_promo: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tracciati per filename
 */
export interface SearchTracciatiByFilenameDTO {
  filename: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per il download di un tracciato
 */
export interface DownloadTracciatoDTO {
  id: string;
}

/**
 * DTO per la risposta del download
 */
export interface DownloadTracciatoResponseDTO {
  filename: string;
  content_type: string;
  file_size: number;
  data: Uint8Array;
}

/**
 * DTO per la richiesta di confronto tracciati
 */
export interface CompareTracciatiRequestDTO {
  idPromo: string;
  tracciatiIds: string[];
  context: ContextConfronto[]
}

/**
 * DTO per la risposta del confronto tracciati.
 * Contiene la struttura del report dinamico con i widget da renderizzare.
 */
export type { TracciatoReport as CompareTracciatiResponseDTO } from '../../../lib/types';
