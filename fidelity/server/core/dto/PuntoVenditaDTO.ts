/**
 * DTO per la creazione di un nuovo punto vendita
 */
export interface CreatePuntoVenditaDTO {
  /** GUID gia assegnato, quando deve coincidere con quello inviato a Istanta */
  id?: string;
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
  /** Dati del sistema della GDO, per esempio la chiave con cui l'import riconosce il PV */
  meta?: Record<string, unknown>;
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
  meta?: Record<string, unknown>;
  createdat?: Date;
  updatedat: Date;
  indirizzo_completo: string;
  coordinate: { lat: number; lon: number };
  nome_display: string;
  has_coordinate: boolean;
  sigla_combinazione?: string;
  nome_canale?: string;
  nome_area?: string;
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
 * Una riga del file punti vendita tradotta dalla libreria agenzia nei campi FP.
 * Canale e area arrivano come sigla della combinazione (canaleArea) oppure come
 * dicitura della GDO (canale + area), che FP riconduce per codice o per nome.
 */
export interface PuntoVenditaDaImportareDTO {
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  canaleArea?: string;
  canale?: string;
  area?: string;
  ragioneSociale?: string;
  provincia?: string;
  regione?: string;
  telefono?: string;
  lat?: number;
  lon?: number;
  meta?: Record<string, unknown>;
}

/** Esito di una riga del file: riga e quella del foglio Excel, dove l'intestazione e la 1. */
export type EsitoRigaImportPuntoVenditaDTO =
  | { riga: number; azione: 'scarta'; errore: string; letto?: PuntoVenditaDaImportareDTO }
  | { riga: number; azione: 'crea' | 'aggiorna'; id?: string; letto: PuntoVenditaDaImportareDTO; dati: CreatePuntoVenditaDTO };

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
