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
  id_canale?: string;
  id_area?: string;
  nome_canale?: string;
  nome_area?: string;
  numero_utenti_collegati?: number;
}

/**
 * Volantino di una promo valida, da un kit runtime pubblicato della combinazione del punto vendita
 */
export interface VolantinoAttivoDTO {
  id_kit: string;
  titolo_kit?: string;
  promo: { id: string; nome: string; validita_dal: Date; validita_al: Date };
  files: { id: string; nome: string; url: string; url_download: string }[];
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
  /** Dubbi della libreria agenzia sul dato letto: ognuno toglie punti all'affidabilita della riga. */
  avvisi?: AvvisoImportPuntoVenditaDTO[];
}

/** Un motivo per cui il dato di una riga e meno affidabile, e quanti punti (su 100) toglie. */
export interface AvvisoImportPuntoVenditaDTO {
  motivo: string;
  penalita: number;
}

/** Dati di un PV letto dal file; la combinazione canale/area manca se la riga va decisa in revisione. */
export type DatiPuntoVenditaImportatoDTO = Omit<CreatePuntoVenditaDTO, 'id_combinazione_canale_area'> & {
  id_combinazione_canale_area?: string;
};

/**
 * Esito di una riga del file: riga e quella del foglio Excel, dove l'intestazione e la 1.
 * Le righe con punteggio di affidabilita sotto la soglia non si importano: vanno in revisione.
 */
export type EsitoRigaImportPuntoVenditaDTO =
  | { riga: number; azione: 'scarta'; errore: string; letto?: PuntoVenditaDaImportareDTO }
  | {
      riga: number;
      azione: 'crea' | 'aggiorna';
      id?: string;
      letto: PuntoVenditaDaImportareDTO;
      dati: CreatePuntoVenditaDTO;
      punteggio: number;
      motivi: string[];
    }
  | {
      riga: number;
      azione: 'revisiona';
      id?: string;
      letto: PuntoVenditaDaImportareDTO;
      dati: DatiPuntoVenditaImportatoDTO;
      punteggio: number;
      motivi: string[];
      chiave: string;
      /** Canale e area riconosciuti dal file, da proporre all'utente (se ci sono). */
      idCanale?: string;
      idArea?: string;
    };

/** Riga che l'import non sa decidere da solo: aspetta che l'utente la inserisca a mano o la scarti. */
export type RigaInAttesaImportDTO = Extract<EsitoRigaImportPuntoVenditaDTO, { azione: 'revisiona' }>;

/** Avanzamento di un import di punti vendita in background, inviato via socket all'utente che l'ha avviato. */
export interface StatoImportPuntiVenditaDTO {
  jobId: string;
  /** in_attesa: l'import e fermo su rigaInAttesa finche l'utente non decide. */
  stato: 'in_corso' | 'in_attesa' | 'completato' | 'annullato' | 'errore';
  totale: number;
  elaborate: number;
  creati: number;
  aggiornati: number;
  scartati: number;
  /** PV scritti dall'utente con l'inserimento manuale (contati anche in creati o aggiornati). */
  inseritiAMano: number;
  /** PV salvati solo in FP perche Istanta non rispondeva (solo in development). */
  soloFp: number;
  /** PV importati automaticamente a cui Nominatim ha dato le coordinate. */
  geolocalizzati: number;
  /** PV importati senza coordinate: Nominatim non ha trovato l'indirizzo o non ha risposto. */
  senzaCoordinate: number;
  /** Ricerche fallite perche Nominatim era in errore (HTTP, timeout, rete), contate anche in senzaCoordinate. */
  erroriNominatim: number;
  /** Motivo dell'ultimo errore di Nominatim, da mostrare durante l'import. */
  ultimoErroreNominatim?: string;
  /** Righe non elaborate perche l'import e stato annullato prima di arrivarci. */
  nonElaborate: number;
  errori: Array<{ row: number; error: string }>;
  rigaInAttesa?: RigaInAttesaImportDTO;
  avviatoIl: string;
  terminatoIl?: string;
}

/** Decisione dell'utente sulla riga in attesa: dati confermati dal modale, oppure scarto. */
export type DecisioneImportPuntoVenditaDTO =
  | { azione: 'inserisci'; dati: CreatePuntoVenditaDTO }
  | { azione: 'scarta' };

/** Un risultato della ricerca indirizzo (Nominatim), gia scomposto nei campi del PV. */
export interface IndirizzoTrovatoDTO {
  etichetta: string;
  lat: number;
  lon: number;
  indirizzo: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  regione?: string;
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
