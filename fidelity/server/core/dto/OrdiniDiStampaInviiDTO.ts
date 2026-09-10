/**
 * DTO per la creazione di un nuovo invio ordine di stampa
 */
export interface CreateOrdiniDiStampaInviiDTO {
  id_utente: string;
  id_ordine: string;
  excel: Uint8Array;
  report: any;
  segnalazione: string;
}

/**
 * DTO per l'aggiornamento di un invio ordine di stampa esistente
 */
export interface UpdateOrdiniDiStampaInviiDTO {
  id_utente?: string;
  id_ordine?: string;
  excel?: Uint8Array;
  report?: any;
  segnalazione?: string;
}

/**
 * DTO per la risposta con i dati dell'invio ordine di stampa
 */
export interface OrdiniDiStampaInviiResponseDTO {
  id: string;
  id_utente: string;
  id_ordine: string;
  excel: Uint8Array;
  report: any;
  segnalazione: string;
  createdat?: Date;
  updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca invii ordini di stampa
 */
export interface OrdiniDiStampaInviiFiltersDTO {
  id_utente?: string;
  id_ordine?: string;
  segnalazione?: string;
  data_creazione_da?: Date;
  data_creazione_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'segnalazione';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata degli invii ordini di stampa
 */
export interface OrdiniDiStampaInviiPaginatedResponseDTO {
  ordini_di_stampa_invii: OrdiniDiStampaInviiResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche degli invii ordini di stampa
 */
export interface OrdiniDiStampaInviiStatsDTO {
  total: number;
  per_utente: Array<{ id_utente: string; count: number }>;
  per_ordine: Array<{ id_ordine: string; count: number }>;
  per_segnalazione: Array<{ segnalazione: string; count: number }>;
  ultimi_invii: OrdiniDiStampaInviiResponseDTO[];
}

/**
 * DTO per l'importazione di invii ordini di stampa
 */
export interface ImportOrdiniDiStampaInviiDTO {
  ordini_di_stampa_invii: CreateOrdiniDiStampaInviiDTO[] | UpdateOrdiniDiStampaInviiDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportOrdiniDiStampaInviiResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di invii per utente
 */
export interface SearchInviiByUtenteDTO {
  id_utente: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di invii per ordine di stampa
 */
export interface SearchInviiByOrdineDTO {
  id_ordine: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di invii per segnalazione
 */
export interface SearchInviiBySegnalazioneDTO {
  segnalazione: string;
  limit?: number;
  offset?: number;
} 