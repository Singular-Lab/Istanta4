/**
 * DTO per la creazione di una nuova associazione punto vendita-utente
 */
export interface CreatePuntiVenditaUtentiDTO {
  id_utente: string;
  id_punto_vendita: string;
}

/**
 * DTO per l'aggiornamento di un'associazione punto vendita-utente esistente
 */
export interface UpdatePuntiVenditaUtentiDTO {
  id_utente?: string;
  id_punto_vendita?: string;
}

/**
 * DTO per la risposta con i dati dell'associazione punto vendita-utente
 */
export interface PuntiVenditaUtentiResponseDTO {
  id: string;
  id_utente: string;
  id_punto_vendita: string;
  createdat?: Date;
  updatedat: Date;
}

/**
 * DTO per i filtri di ricerca associazioni punto vendita-utente
 */
export interface PuntiVenditaUtentiFiltersDTO {
  id_utente?: string;
  id_punto_vendita?: string;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle associazioni punto vendita-utente
 */
export interface PuntiVenditaUtentiPaginatedResponseDTO {
  punti_vendita_utenti: PuntiVenditaUtentiResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche delle associazioni punto vendita-utente
 */
export interface PuntiVenditaUtentiStatsDTO {
  total_associazioni: number;
  per_utente: Array<{ id_utente: string; count: number }>;
  per_punto_vendita: Array<{ id_punto_vendita: string; count: number }>;
  utenti_con_piu_punti_vendita: Array<{ id_utente: string; count: number }>;
}

/**
 * DTO per l'importazione di associazioni punto vendita-utente
 */
export interface ImportPuntiVenditaUtentiDTO {
  punti_vendita_utenti: CreatePuntiVenditaUtentiDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportPuntiVenditaUtentiResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di punti vendita per utente
 */
export interface SearchPuntiVenditaByUtenteDTO {
  idutenti_puntivenditautenti: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di utenti per punto vendita
 */
export interface SearchUtentiByPuntoVenditaDTO {
  idpuntivendita_puntivenditautenti: string;
  limit?: number;
  offset?: number;
} 