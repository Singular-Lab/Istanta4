/**
 * DTO per la creazione di una nuova attività utente
 */
export interface CreateAttivitaUtenteDTO {
  id_utente: string;
  id_attivita: string;
  letto?: boolean;
  data_lettura?: Date;
}

/**
 * DTO per l'aggiornamento di un'attività utente esistente
 */
export interface UpdateAttivitaUtenteDTO {
  letto?: boolean;
  data_lettura?: Date;
}

/**
 * DTO per la risposta con i dati dell'attività utente
 */
export interface AttivitaUtenteResponseDTO {
  id_attivita_utente: string;
  id_utente: string;
  id_attivita: string;
  letto: boolean;
  data_lettura?: Date;
  createdat?: Date;
  updatedat?: Date;
  is_read?: boolean;
}

/**
 * DTO per marcare un'attività come letta
 */
export interface MarkAttivitaAsReadDTO {
  id_utente: string;
  id_attivita: string;
}

/**
 * DTO per marcare un'attività come non letta
 */
export interface MarkAttivitaAsUnreadDTO {
  id_utente: string;
  id_attivita: string;
}

/**
 * DTO per i filtri di ricerca attività utente
 */
export interface AttivitaUtenteFiltersDTO {
  id_utente?: string;
  id_attivita?: string;
  letto?: boolean;
  data_lettura_da?: Date;
  data_lettura_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'data_lettura' | 'letto';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle attività utente
 */
export interface AttivitaUtentePaginatedResponseDTO {
  attivita_utente: AttivitaUtenteResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle attività utente
 */
export interface AttivitaUtenteStatsDTO {
  total_attivita_utente: number;
  per_utente: Array<{ id_utente: string; count: number }>;
  ultime_letture: AttivitaUtenteResponseDTO[];
}

/**
 * DTO per marcare multiple attività come lette
 */
export interface MarkMultipleAttivitaAsReadDTO {
  id_utente: string;
  id_attivita: string[];
}

/**
 * DTO per la risposta del marking multiplo
 */
export interface MarkMultipleAttivitaAsReadResponseDTO {
  total_marked: number;
  errors: Array<{ id_attivita: string; error: string }>;
}
