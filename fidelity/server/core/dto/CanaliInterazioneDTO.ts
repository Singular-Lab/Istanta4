import { STATO_CANALI_INTERAZIONE, TIPI_CANALI_INTERAZIONE } from '../../../lib/enums';

/**
 * DTO per la creazione di un nuovo canale di interazione
 */
export interface CreateCanaliInterazioneDTO {
  id_utente: string;
  tipo: TIPI_CANALI_INTERAZIONE;
  stato: STATO_CANALI_INTERAZIONE;
}

/**
 * DTO per l'aggiornamento di un canale di interazione esistente
 */
export interface UpdateCanaliInterazioneDTO {
  id_utente?: string;
  tipo?: TIPI_CANALI_INTERAZIONE;
  stato?: STATO_CANALI_INTERAZIONE;
}

/**
 * DTO per la risposta con i dati del canale di interazione
 */
export interface CanaliInterazioneResponseDTO {
  id_canaliinterazione: string;
  id_utente: string;
  tipo: TIPI_CANALI_INTERAZIONE;
  stato: STATO_CANALI_INTERAZIONE;
}

/**
 * DTO per i filtri di ricerca canali di interazione
 */
export interface CanaliInterazioneFiltersDTO {
  id_utente?: string;
  tipo?: TIPI_CANALI_INTERAZIONE;
  stato?: STATO_CANALI_INTERAZIONE;
  limit?: number;
  offset?: number;
  order_by?: 'id_utente';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei canali di interazione
 */
export interface CanaliInterazionePaginatedResponseDTO {
  canali_interazione: CanaliInterazioneResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei canali di interazione
 */
export interface CanaliInterazioneStatsDTO {
  total_canali: number;
  per_tipo: Record<TIPI_CANALI_INTERAZIONE, number>;
  per_stato: Record<STATO_CANALI_INTERAZIONE, number>;
  per_utente: Array<{ id_utente: string; count: number }>;
}

/**
 * DTO per l'importazione di canali di interazione
 */
export interface ImportCanaliInterazioneDTO {
  canali_interazione: CreateCanaliInterazioneDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportCanaliInterazioneResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di canali di interazione per utente
 */
export interface SearchCanaliInterazioneByUtenteDTO {
  id_utente: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di canali di interazione per tipo
 */
export interface SearchCanaliInterazioneByTipoDTO {
  tipo: TIPI_CANALI_INTERAZIONE;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di canali di interazione per stato
 */
export interface SearchCanaliInterazioneByStatoDTO {
  stato: STATO_CANALI_INTERAZIONE;
  limit?: number;
  offset?: number;
} 