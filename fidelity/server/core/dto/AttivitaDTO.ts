import { CATEGORIA_ATTIVITA, PRIORITA_ATTIVITA, TIPO_ATTIVITA } from '../../../lib/enums';

/**
 * DTO per la creazione di una nuova attività
 */
export interface CreateAttivitaDTO {
  id_utente?: string;
  tipo: TIPO_ATTIVITA;
  meta?: any;
  categoria?: CATEGORIA_ATTIVITA;
  priorita?: PRIORITA_ATTIVITA;
}

/**
 * DTO per l'aggiornamento di un'attività esistente
 */
export interface UpdateAttivitaDTO {
  id_utente?: string;
  tipo?: TIPO_ATTIVITA;
  meta?: any;
  categoria?: CATEGORIA_ATTIVITA;
  priorita?: PRIORITA_ATTIVITA;
}

/**
 * DTO per la risposta con i dati dell'attività
 */
export interface AttivitaResponseDTO {
  id: string;
  data_creazione: Date;
  assegnato_a_id: string;
  nome_assegnato: string;
  cognome_assegnato: string;
  tipo: TIPO_ATTIVITA;
  meta: any;
  categoria?: CATEGORIA_ATTIVITA;
  priorita?: PRIORITA_ATTIVITA;
  tipo_utente_assegnato?: string;
  stato_utente_assegnato?: string;
  email_assegnato?: string;
  data_aggiornamento?: Date;
  is_aggiornata?: boolean;
  photo?: string;
  photo_privacy?: string;
  is_read: boolean;
  expires_at?: Date;
}

/**
 * DTO per i filtri di ricerca attività
 */
export interface AttivitaFiltersDTO {
  id_utente?: string;
  tipo?: TIPO_ATTIVITA;
  data_da?: Date;
  data_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'tipo';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle attività
 */
export interface AttivitaPaginatedResponseDTO {
  attivita: AttivitaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle attività
 */
export interface AttivitaStatsDTO {
  total_attivita: number;
  per_tipo: Record<TIPO_ATTIVITA, number>;
  per_utente: Array<{ id_gdo: string; count: number }>;
  ultime_attivita: AttivitaResponseDTO[];
}

/**
 * DTO per l'importazione di attività
 */
export interface ImportAttivitaDTO {
  attivita: CreateAttivitaDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportAttivitaResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}
