/**
 * DTO per la creazione di un nuovo punto vendita
 */
export interface CreatePuntoVenditaDTO {
  nome: string;
  citta: string;
  cap: string;
  indirizzo: string;
  lat?: number;
  lon?: number;
  id_combinazione_canale_area: string;
  id_gdo: string;
  ragionesociale?: string;
  provincia?: string;
  regione?: string;
  telefono?: string;
}

/**
 * DTO per l'aggiornamento di un punto vendita esistente
 */
export interface UpdatePuntoVenditaDTO {
  nome?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  lat?: number;
  lon?: number;
  id_combinazione_canale_area?: string;
  id_gdo?: string;
  ragionesociale?: string;
  provincia?: string;
  regione?: string;
  telefono?: string;
}

/**
 * DTO per la risposta con i dati del punto vendita
 */
export interface PuntoVenditaResponseDTO {
  id: string;
  nome: string;
  citta: string;
  cap: string;
  indirizzo: string;
  lat?: number;
  lon?: number;
  id_combinazione_canale_area: string;
  id_gdo: string;
  ragionesociale?: string;
  provincia?: string;
  regione?: string;
  telefono?: string;
  createdat?: Date;
  updatedat: Date;
  indirizzo_completo: string;
  coordinate: { lat: number; lon: number };
  nome_display: string;
  has_coordinate: boolean;
  sigla_combinazione?: string;
  numero_utenti_collegati?: number;
}

/**
 * DTO per la ricerca di punti vendita per città
 */
export interface SearchPuntiVenditaByCittaDTO {
  citta: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di punti vendita per GDO
 */
export interface SearchPuntiVenditaByGDODTO {
  id_gdo: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di punti vendita nelle vicinanze
 */
export interface SearchPuntiVenditaNearbyDTO {
  lat: number;
  lon: number;
  radius_km?: number;
  limit?: number;
}

/**
 * DTO per i filtri di ricerca punti vendita
 */
export interface PuntoVenditaFiltersDTO {
  citta?: string;
  regione?: string;
  provincia?: string;
  id_gdo?: string;
  search?: string;
  has_coordinate?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'nome_puntivendita' | 'citta_puntivendita' | 'createdat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei punti vendita
 */
export interface PuntiVenditaPaginatedResponseDTO {
  punti_vendita: PuntoVenditaResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei punti vendita
 */
export interface PuntoVenditaStatsDTO {
  total_punti_vendita: number;
  per_regione: Array<{ regione: string; count: number }>;
  per_citta: Array<{ citta: string; count: number }>;
  con_coordinate: number;
  senza_coordinate: number;
}

/**
 * DTO per l'importazione di punti vendita
 */
export interface ImportPuntiVenditaDTO {
  punti_vendita: CreatePuntoVenditaDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportPuntiVenditaResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/* ======================================================
 * DISPOSITIVI PUNTO VENDITA DTOs
 * ====================================================== */

export interface DispositivoPuntoVenditaResponseDTO {
  id: string;
  nome: string;
  descrizione?: string;
  is_active: boolean;
  last_seen_at?: Date;
  metadata?: import('../models/punto_vendita/dispositivi_punto_vendita').DispositivoMetadata;
  id_puntivendita: string;
  id_display_context?: string;
  token_display: string;
  display_url: string;
  is_online: boolean;
  createdat: Date;
  updatedat: Date;
  puntoVendita?: {
    id: string;
    nome: string;
    citta?: string;
  };
  displayContext?: import('./DisplayContextDTO').DisplayContextResponseDTO;
}

export interface CreateDispositivoPuntoVenditaDTO {
  nome: string;
  descrizione?: string;
  id_puntivendita: string;
  secret_dispositivo: string;
  id_display_context?: string;
  is_active?: boolean;
}

export interface UpdateDispositivoPuntoVenditaDTO {
  nome?: string;
  descrizione?: string;
  id_display_context?: string | null;
  is_active?: boolean;
}

export interface DeviceHeartbeatDTO {
  token: string;
  metadata?: import('../models/punto_vendita/dispositivi_punto_vendita').DispositivoMetadata;
}
