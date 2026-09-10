
import { CATEGORIA_ATTIVITA, EVENTI_WEBHOOK, FieldType, InteractionType, MODALITA_TIPO_EXPORT, PRIORITA_ATTIVITA, STATO_CANALI_INTERAZIONE, STATO_COMBINAZIONI, STATO_LAVORAZIONE_KIT_RUNTIME, STATO_LOG_FILE, STATO_ORDINI_STAMPA, STATO_PROMO, STATO_UTENTI, STATO_WEBHOOK, TIPI_CANALI_INTERAZIONE, TIPO_ATTIVITA, TIPO_COMANDO_CONTRATTO_TIPOGRAFIA, TIPO_KIT_DESIGN, TIPO_PAGINA, TIPO_UTENTI, UTENTE_GENERE, type CATEGORIA_TEMPLATE_WHATSAPP, type GDOWhatsappQueueJobStatus, type PROVIDER_WHATSAPP, type STATO_GDO_WHATSAPP_NUMBER, type STATO_GDO_WHATSAPP_TEMPLATE } from "../lib/enums";

// ===========================
// SISTEMA NOTIFICHE
// ===========================

/**
 * Tipologia delle notifiche Socket.IO
 */
export type NotificationType = 'info' | 'success' | 'error' | 'warning';

/**
 * Interfaccia standard per le notifiche del sistema
 */
export interface SystemNotification {
  titolo: string;
  messaggio: string;
  tipo: NotificationType;
}

export interface KeyframeModificationBase {
  id: string;
  elementId: string;
  elementType: string;
  modificationType: 'content' | 'position';
  timestamp: string;
  content?: unknown;
}
export interface KeyFramePositionModification extends KeyframeModificationBase {
  modificationType: "position";
  oldIndex: number;
  newIndex: number;
}
export interface KeyFrameContentModification extends KeyframeModificationBase {
  modificationType: "content";
  content: unknown; // Solo il contenuto specifico del componente, non tutto l'oggetto PageLayoutItem
}

export type KeyframeModification = KeyFramePositionModification | KeyFrameContentModification;


export interface Keyframe {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
  isActive: boolean;
  promoId?: string;
  targetComponentId?: string;
  newComponent?: PageLayoutItem;
  modification: KeyframeModification;
}

// ===========================
// HUB - AUTH PROVIDERS & SERVICES
// ===========================

export interface AuthProviderDTO {
  id: string;
  codice: string;
  nome: string;
  descrizione?: string;
  icona: string;
  tipo: 'internal' | 'oidc' | 'saml' | 'custom';
  ordine: number;
  attivo: boolean;
  config_client?: {
    authorize_url?: string;
    client_id?: string;
    scope?: string;
    redirect_uri?: string;
    password_reset_url?: string;
  };
}

export interface HubServiceDocumentAsset {
  id: string;
  title: string;
  original_name: string;
  mime_type: string;
  size: number;
  extension?: string;
  id_olimpo_cloud: string;
  download_url: string;
  preview_url?: string;
  pages?: number;
}

export type HubServiceVideoKind = "trailer" | "guide";

export interface HubServiceVideoAsset {
  id: string;
  title: string;
  kind: HubServiceVideoKind;
  original_name: string;
  mime_type: string;
  size: number;
  guid_id: string;
  url: string;
}

export interface HubServiceDTO {
  id: string;
  codice: string;
  nome: string;
  descrizione: string;
  icona: string;
  colore: string;
  url: string;
  tipo_url: 'internal' | 'external' | "external_fico";
  attivo: boolean;
  in_manutenzione: boolean;
  in_evidenza: boolean;
  ordine: number;
  tipo_utente: string;
  ruolo_gdo?: string | null;
  redirect_page?: string;
  documents: HubServiceDocumentAsset[];
  videos: HubServiceVideoAsset[];
  meta?: Record<string, unknown>;
}

export type HubNewsType = 'info' | 'warning' | 'success' | 'update';

export interface HubNewsDTO {
  id: string;
  titolo: string;
  contenuto: string;
  tipo: HubNewsType;
  icona?: string;
  url?: string;
  in_evidenza: boolean;
  data_pubblicazione: string;
  data_scadenza?: string;
  autore_nome?: string;
  meta?: Record<string, unknown>;
}

export interface HubNewsAdminDTO extends HubNewsDTO {
  attivo: boolean;
  ruoli_destinatari: string[];
}

export interface BulkUpdateHubServicePatch {
  nome?: string;
  descrizione?: string;
  icona?: string;
  colore?: string;
  url?: string;
  redirect_page?: string;
  documents?: HubServiceDocumentAsset[];
  videos?: HubServiceVideoAsset[];
  tipo_url?: 'internal' | 'external' | 'external_fico';
  ordine?: number;
  attivo?: boolean;
  in_manutenzione?: boolean;
  in_evidenza?: boolean;
}

// ===========================
// CONFIGURAZIONI SISTEMA
// ===========================

export interface AvvisoManutenzione {
  attivo: boolean;
  giorno: string;           // YYYY-MM-DD
  oraInizio: string;        // HH:mm
  oraFine: string;          // HH:mm
  minutiRimanenti?: number; // se impostato, countdown dal momento della creazione
  creatoIl: string;         // ISO timestamp della creazione (per calcolare il countdown)
  messaggioExtra?: string;  // testo libero opzionale
}

export interface RegolaMenaboPagina {
  etichetta?: string;
  referenzePerPagina: number;
}

export interface RegolaMenaboDivisione {
  id: string;   // guidCanale, guidArea o id combinazione
  pagine: RegolaMenaboPagina[];
}

export interface RegoleMenabo {
  tipoDivisione: 'canale' | 'area' | 'area_e_canale';
  divisioni: RegolaMenaboDivisione[];
}

export interface Config {
  webpliant: ConfigWebpliant;
  color: string;
  dashboard: Dashboard;
  // Nuova struttura: dashboard separate per ogni ruolo
  dashboardsByRole?: DashboardsByRole;
  maintenanceAlert?: AvvisoManutenzione;
  regoleMenabo?: RegoleMenabo;
}

// Dashboard per singolo ruolo
export interface Dashboard {
  version: number;
  lastUpdated: Date;
  plugins: DashboardPlugin[];
}

// Mappa delle dashboard per ruolo (chiave = valore di TIPO_UTENTI)
export type DashboardsByRole = Partial<Record<TIPO_UTENTI, Dashboard>>;

export interface GridPosition {
  colStart: number; // x
  rowStart: number; // y
  colSpan: number;  // w
  rowSpan: number;  // h
}

export interface WidgetRoleConfig {
  tipo: TIPO_UTENTI;
  options: {
    positions: {
      default: GridPosition;
      custom?: {
        [key: string]: GridPosition;
      };
    };
  };
}

export interface DashboardPluginBase {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  isDraggable?: boolean;
  isResizable?: boolean;
  minColSpan?: number;
  minRowSpan?: number;
  isDeletable?: boolean;
  showPagination?: boolean;
  showFilter?: boolean;
  baseFilter?: any[][];
  position?: 'grid';
  order?: number;
  gridColSpan?: number;
  gridRowSpan?: number;
  gridPosition?: GridPosition;
}

export interface DashboardPlugin extends DashboardPluginBase {
  allowedRoles: WidgetRoleConfig[];
}

export interface GridWidget extends DashboardPluginBase {
  Component: React.ComponentType<any>;
  data: any;
  allowedRoles: WidgetRoleConfig[];
  isBlue: boolean;
  title: string;
  gridPosition?: GridPosition; // <-- aggiungi questa proprietà per react-grid-layout
}

// Definizione di PromoDB
export interface PromoDB {
  _id?: string;
  GDO: string;
  nomePromo: string;
  dataRegistrazione: string;
  validitaDal: Date;
  validitaAl: Date;
  dataScadenza: Date;
  stato: number;
  promoTracciatis: ITracciato[]; // Utilizza l'interfaccia ITracciato per coerenza
}




export interface CanaliInterazioneAttributes {
  id_canaliinterazione?: string;
  tipo_canaliinterazione: TIPI_CANALI_INTERAZIONE;
  idutente_canaliinterazione: string;
  stato_canaliinterazione: STATO_CANALI_INTERAZIONE;

}

export interface UtentiCanaliInterazioneAttributes {
  id_UtentiCanaliInterazione: string;
  idUtente_UtentiCanaliInterazione: string;
  idCanaleInterazione_UtentiCanaliInterazione: string;
  createdat?: Date;
  updatedat?: Date;
}

// Definizione di ITracciato per gestire i dettagli del tracciato
export interface ITracciato {
  area: string;
  canale: string;
  meta?: any;
  id?: string;
  idPromo?: string;
  promoTracciatiRecords: any[]; // Consentito qualsiasi tipo di dati nei records
}

// Interfaccia per la gestione del contratto (ContrattoInterpreter)


export interface IChangeValue {
  valoreDaRicercare: string;
  nuovoValore: string;
}

// Interfaccia per la gestione delle credenziali di login dell'utente
export interface IUtenteValueLogin {
  email?: string;
  username?: string;
  password?: string;
}

export type UtentiMeta = {
  photo?: string;
  photoPrivacy?: string;
  citta?: string;
  cap?: string;
  provincia?: string;
  residenza2?: string;
  need_ad?: boolean;
  gruppi_ad?: string[],
  filtri_utente?: Array<FilterCondition[]>;
  codice_posizione?: string;
};

export type GlobalUserFilter = {
  isRestricted: boolean;
  settoriFinali: string[];
  settori: string[];
  /** Nomi canonici COOPFI_REPARTO_MAP corrispondenti a settoriFinali, usati per filtrare row.reparto negli scoreboard */
  settoriNomi: string[];
  aree: string[];
  ruolo: string | null;
};

// Definizione degli attributi utente (UtenteAttributes)
export type UtenteAttributes = {
  id_utenti: string;
  outsider_utenti: boolean
  nome_utenti?: string;
  cognome_utenti?: string;
  email_utenti?: string;
  password_utenti?: string;
  datadinascita_utenti?: Date;
  residenza_utenti?: string;
  tipo_utenti: TIPO_UTENTI;
  stato_utenti?: STATO_UTENTI;
  sesso_utenti?: UTENTE_GENERE;
  privatekey_utenti?: string;
  telefono_utenti?: string;
  lat_utenti?: number;
  lon_utenti?: number;
  geom_utenti?: any;
  createdat?: Date;
  updatedat?: Date;
  meta_utenti?: UtentiMeta;
};


//tipo_utenti

// Definizione degli attributi delle foto di riferimento
export type FotoReferenzeAttributes = {
  id_FotoReferenze?: string;
  hash_FotoReferenze: string;
  pathFoto_FotoReferenze: string | null;
  nomeFile_FotoReferenze: string | null;
  createdat?: Date;
  updatedat?: Date;
};
export type UtentiGDOAttributes = {
  id_utentegdo?: string;
  id_utente_utentegdo: string;
  id_gdo_utentegdo: string;
  id_ruolo_utente_gdo?: string;
  createdat?: Date;
  updatedat?: Date;
};
export type TracciatiAttributes = {
  id_tracciati?: string;
  id_promo_tracciati: string;
  context_tracciati: any;
  stato_tracciati?: string;
  filename_tracciati: string;
  blobfile_tracciati: Uint8Array;
  createdat?: Date;
  updatedat?: Date;
};

// ─── Schema Momenti ──────────────────────────────────────────────────────────

export type TipoSchema = 'BUSINESS' | 'AGENZIA';

export type TracciatiSchemaItem = {
  nome: string;
  snapshot: boolean;
  ordine: number;
};

export type TracciatiSchemaConfronto = {
  a: number;  // ordine item A
  b: number;  // ordine item B
  terremotoDegradoMassimo?: number | null;
};

export interface TracciatiSchemaResponseDTO {
  id: string;
  nome: string;
  tipo: TipoSchema[];
  items: TracciatiSchemaItem[];
  confronti: TracciatiSchemaConfronto[];
  createdat?: string;
  updatedat?: string;
}


export type AnalisiMomentoTracciato = {
  guidCanale: string;
  guidArea: string;
  context: string;
  records: DataFields[];
};

/** Tracciato arricchito con i delta restituiti da Istanta `/FicoProcess/analisiConfronto` */
export type ConfrontoTracciato = AnalisiMomentoTracciato & {
  uscenti?: number;
  entranti?: number;
  inalterati?: number;
  alterati?: number;
};

/** Struttura completa del risultato di un confronto tra due momenti */
export interface RisultatoConfrontoMomento {
  primario: {
    guidId: string;
    nomeMomento: string;
    tracciati: ConfrontoTracciato[];
  };
  secondario: {
    guidId: string;
    nomeMomento: string;
    tracciati: ConfrontoTracciato[];
  };
}

export type AnalisiMomentoResponse = {
  tracciati: AnalisiMomentoTracciato[];
  esito: boolean;
  errors: string;
  warnings: string;
};

export type TracciatiMomentoAttributes = {
  id?: string;
  id_promo: string;
  nome: string;
  tracciati_ids: string[];
  confronti_ids: string[];
  ordine: number;
  snapshot: boolean;
  risultato?: AnalisiMomentoTracciato[] | null;
  createdat?: Date;
  updatedat?: Date;
};

export interface TracciatiMomentoResponseDTO {
  id: string;
  id_promo: string;
  nome: string;
  tracciati_ids: string[];
  confronti_ids: string[];
  /** ID dei momenti con cui questo momento ha un confronto con risultato già calcolato */
  confronti_con_risultato: string[];
  /** Mappa confronto: per ogni altro momento, l'id del record confronto e il suo degrado terremoto (solo per confronti lineari) */
  confronti_con_id: Array<{ momentoId: string; confrontoId: string; terremotoDegradoMassimo?: number | null }>;
  ordine: number;
  snapshot: boolean;
  risultato?: AnalisiMomentoTracciato[] | null;
  hasRisultato: boolean;
  createdat?: string;
  updatedat?: string;
};

export type TracciatiMomentoConfrontoAttributes = {
  id?: string;
  primario: string;
  secondario: string;
  tipo: 'lineare' | 'non_lineare';
  risultato?: unknown | null;
  report?: unknown | null;
  terremoto_degrado_massimo?: number | null;
  createdat?: Date;
  updatedat?: Date;
};

export interface TracciatiMomentoConfrontoResponseDTO {
  id: string;
  primario: string;
  secondario: string;
  tipo: 'lineare' | 'non_lineare';
  risultato?: unknown | null;
  report?: TracciatoReport | null;
  hasRisultato: boolean;
  terremoto_degrado_massimo?: number | null;
  createdat?: string;
  updatedat?: string;
};

// Definizione degli attributi per il tipo di utente del punto vendita
export type RuoloPuntoVenditaAttributes = {
  id_ruolo_punto_vendita?: string;
  ruolo_ruolo_punto_vendita: string;
  createdat?: Date;
  updatedat?: Date;
};

export type RuoloUtenteGDOAttributes = {
  id_ruolo_utente_gdo?: string;
  ruolo_ruolo_utente_gdo: string;
  api_key_ruolo_utente_gdo?: string;
  createdat?: Date;
  updatedat?: Date;
}

// Attributi per il sistema permessi
export type PermessoAttributes = {
  id_permesso?: string;
  codice: string;
  nome: string;
  descrizione?: string;
  categoria: string;
  risorsa: string;
  createdat?: Date;
  updatedat?: Date;
};

export type PermessoRuoloAttributes = {
  id_permesso_ruolo?: string;
  tipo_utente: string;
  id_permesso: string;
  id_ruolo_utente_gdo?: string;
  abilitato: boolean;
  createdat?: Date;
  updatedat?: Date;
};

export type PermessoRuoloGdoAttributes = {
  id_permesso_ruolo_gdo?: string;
  id_gdo: string;
  tipo_utente: string;
  id_permesso: string;
  id_ruolo_utente_gdo?: string;
  abilitato: boolean;
  createdat?: Date;
  updatedat?: Date;
};

export type MenuItemAttributes = {
  id_menu_item?: string;
  tipo_utente: TIPO_UTENTI;
  ruolo_gdo?: string | null;
  titolo: string;
  tipo: string;
  icona?: string | null;
  pathname?: string | null;
  codice_permesso?: string | null;
  disabilitato?: boolean;
  start_page?: boolean;
  ordinamento: number;
  id_parent?: string | null;
  createdat?: Date;
  updatedat?: Date;
};

// Definizione degli attributi dei punti vendita (PuntiVenditaAttributes)
export type PuntiVenditaAttributes = {
  id_puntivendita?: string;
  nome_puntivendita: string;
  citta_puntivendita: string;
  cap_puntivendita: string;
  indirizzo_puntivendita: string;
  lat_puntivendita: number;
  lon_puntivendita: number;
  id_combinazione_canale_area_puntivendita: string;
  id_gdo_puntivendita: string;
  siglaCombinazione?: string; // Campo opzionale per la gestione dell'interfaccia
  ragionesociale_puntivendita?: string; // Nuovo campo opzionale
  provincia_puntivendita?: string; // Nuovo campo opzionale
  regione_puntivendita?: string; // Nuovo campo opzionale
  telefono_puntivendita?: string; // Nuovo campo opzionale aggiunto
  createdat?: Date;
  updatedat?: Date;
  idCanale_puntiVendita?: string; // Nuovo campo opzionale
  idArea_PuntiVendita?: string; // Nuovo campo opzionale
  idWorkspace_PuntiVendita?: string; // Nuovo campo opzionale
};

// Definizione degli attributi per l'associazione utenti-punti vendita
export type PuntiVenditaUtentiAttributes = {
  id_puntivenditautenti?: string;
  idutenti_puntivenditautenti: string;
  idpuntivendita_puntivenditautenti: string;
  // tipoUtentiPuntoVendita_PuntiVenditaUtenti: string;
  createdat?: Date;
  updatedat?: Date;
};

// Definizione degli attributi GDO (GDOAttributes)
export type GDOAttributes = {
  id_gdo?: string;
  nome_gdo: string;
  ragione_sociale_gdo?: string;
  idparent_gdo: string;
  createdat?: Date;
  updatedat?: Date;
  icona_gdo?: Buffer; // <-- CORRETTO
};


export type GDOWhatsappAttributes = {
  id_gdowhatsapp?: string;
  id_gdo_gdowhatsapp: string;
  numero_whatsapp_gdowhatsapp: string;
  email_whatsapp_gdowhatsapp?: string;
  createdat?: Date;
  updatedat?: Date;
}

// 🔥 Attributi della tabella campagne WhatsApp
export interface GDOWhatsappCampagneAttributes {
  id_whatsapp_campagna: string;
  titolo_whatsapp_campagna: string;
  template_id_whatsapp_campagna: string;

  createdat?: Date;
  updatedat?: Date;
}

// 🔥 Attributi del record
export interface GDOWhatsappQueueJobAttributes {
  id_whatsapp_queue_job: string;
  bulk_id_whatsapp_queue_job: string;
  campagna_id_whatsapp_queue_job: string;
  index_whatsapp_queue_job: number;
  total_whatsapp_queue_job: number;

  to_whatsapp_queue_job: string;
  body_whatsapp_queue_job: string;

  attempts_whatsapp_queue_job: number;
  max_attempts_whatsapp_queue_job: number;

  status_whatsapp_queue_job: GDOWhatsappQueueJobStatus;

  run_at_whatsapp_queue_job: Date;
  last_error_whatsapp_queue_job?: string | null;

  createdat?: Date;
  updatedat?: Date;
}





// Definizione degli attributi dei canali (CanaliAttributes)
export type CanaliAttributes = {
  id_canali?: string;
  codice_canali: string;
  nome_canali: string;
  id_gdo_canali: string;
  createdat?: Date;
  updatedat?: Date;
};

// Definizione degli attributi delle aree (AreeAttributes)
export type AreeAttributes = {
  id_aree?: string;
  codice_aree: string;
  nome_aree: string;
  id_gdo_aree: string;
  createdat?: Date;
  updatedat?: Date;
};

// Definizione degli attributi per la combinazione canale-area
export type CombinazioneCanaleAreaAttributes = {
  id_combinazione_canale_area?: string;
  id_gdo_combinazione_canale_area: string;
  id_canale_combinazione_canale_area: string;
  id_area_combinazione_canale_area: string;
  stato_combinazione_canale_area: string;
  createdat?: Date;
  updatedat?: Date;
};

export type FormatiAttributes = {
  id_formati?: string;
  nome_formati: string;
  codice_formati: string;
  descrizione_formati: string;
  tipo_lavorazione_formati: number;
  createdat?: Date;
  updatedat?: Date;
};


export type NamingConventionAttributes = {
  id_naming_convention?: string;
  nome_naming_convention: string;
  descrizione_naming_convention: string;
  fields_naming_convention: string[];
  createdat?: Date;
  updatedat?: Date;
}

export type TipiDiExportAttributes = {
  id_tipiexport?: string;
  nome_tipiexport: string;
  codice_tipiexport: string;
  modalita_tipiexport?: MODALITA_TIPO_EXPORT;
  guid_namingconvention_tipiexport?: string;
  filtri_tipiexport?: Filtro[];
  createdat?: Date;
  updatedat?: Date;
};


export type ContrattoTipografiaAttributes = {
  id_contrattotipografia?: string;
  nome_contrattotipografia: string;
  tipiexport_contrattotipografia: string[];
  id_gdo_contrattotipografia: string;
  json_contrattotipografia?: any;
  user_ftp_contrattotipografia?: string;
  host_ftp_contrattotipografia?: string;
  pwd_ftp_contrattotipografia?: string;
  port_ftp_contrattotipografia?: number;
  createdat?: Date;
  updatedat?: Date;
};


export type OrdiniDiStampaAttributes = {
  id_ordinistampa?: string;
  idutente_ordinistampa: string;
  id_promo_ordinistampa: string;
  stato_ordinistampa: STATO_ORDINI_STAMPA;
  data_di_conferma_ordinistampa?: string;
  createdat?: Date;
  updatedat?: Date;
};

export type OrdiniDiStampaInviiAttributes = {
  id_ordinistampainvii: string;
  idutente_ordinistampainvii: string;
  idordinestampa_ordinistampainvii: string;
  excel_ordinistampainvii: Uint8Array;
  report_ordinistampainvii: any;
  segnalazione_ordinistampainvii: string;
  createdat?: Date;
  updatedat?: Date;
}

export type AttivitaAttributes = {
  id_attivita?: string;
  idutente_attivita: string | null;
  tipo_attivita: TIPO_ATTIVITA;
  meta_attivita: any;
  categoria_attivita?: CATEGORIA_ATTIVITA;
  priorita_attivita?: PRIORITA_ATTIVITA;
  expires_at?: Date;
  createdat?: Date;
  updatedat?: Date;
};


export type UtentiAnonimiAttributes = {
  id_utenti_anonimi?: string;
  meta_utenti_anonimi: object;
  createdat?: Date;
  updatedat?: Date;
}

export type FileTreeCondition = {
  field: string;
  operator: string;
  value: string;
};

export type FilterConstruzioneCarosello = {
  field: string;
  operator: OperatorOption["value"];
  value: string;
};

export interface IPromo {
  guid_id: string;
  nomePromo: string;
  dataRegistrazione: Date | string;
  validitaDal: Date | string;
  validitaAl: Date | string;
  dataScadenza: Date | string;
  offsetVisibilita: number;
  stato: STATO_PROMO;
  context: ContextLavorazione & { user_value: any };
  GDO: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PromoPerDashboard extends IPromo {
  numero_kit_completati: number;
  numero_kit_totali: number;
  stato_singole_lavorazioni: {
    nome: string;
    files_totali: number;
    files_completati: number;
    files_in_lavorazione: number;
    tipo: TIPO_KIT_DESIGN;
    hasRefs: boolean;
  }[];
}

export interface KitStatusBase {
  nome: string;
  files_totali: number;
  files_completati: number;
  files_in_lavorazione: number;
  tipo: TIPO_KIT_DESIGN;
  hasRefs: boolean;
}

export interface KitStatusRunTime extends KitStatusBase {
  tipo: TIPO_KIT_DESIGN.AUTOMATICO;
  files_totali: number;
  files_completati: number;
  files_in_lavorazione: number;
  numero_referenze: number;
}

export interface KitStatusDesign extends KitStatusBase {
  tipo: TIPO_KIT_DESIGN.MANUALE;
  files_totali: number;
  files_completati: number;
  files_in_lavorazione: number;
  files_in_revisione: number;
}


export interface NuovaPromoPerDashboard extends IPromo {
  kit_pubblicati: KitStatusDesign[] | KitStatusRunTime[];
  kit_in_lavorazione: KitStatusRunTime[] | KitStatusDesign[];
  kit_in_revisione: KitStatusDesign[] | KitStatusRunTime[];
  statistiche: {
    totale_kit: number;
    kit_completati: number;
    kit_in_corso: number;
    kit_in_revisione: number;
    percentuale_completamento: number;
  };
  ultimo_aggiornamento: Date;
}
export interface WebhookAttributes {
  id_webhook: string;
  nome_webhook: string;
  descrizione_webhook?: string;
  url_webhook: string;
  eventi_webhook: EVENTI_WEBHOOK[];
  stato_webhook: STATO_WEBHOOK;
  secret_webhook?: string;

  // Configurazioni
  timeout_webhook: number;
  retry_count_webhook: number;
  retry_delay_webhook: number;
  headers_personalizzati_webhook?: Record<string, string>;

  // Metadata
  createdat_webhook: Date;
  updatedat_webhook: Date;
  createdby_webhook: string;
}

// Interfaccia per le statistiche calcolate dinamicamente
export interface WebhookStatistiche {
  chiamate_totali: number;
  chiamate_successo: number;
  chiamate_fallite: number;
  ultima_chiamata?: Date;
  ultimo_successo?: Date;
  ultimo_errore?: Date;
  ultimo_messaggio_errore?: string;
}

export interface PaylodKitPubblicato {
  area: {
    nome: string;
    codice: string;
  };
  canale: {
    nome: string;
    codice: string;
  };
  gdo: string;
  tipo: TIPO_KIT_DESIGN;
  titolo: string;
  quantita: number;
  files?: {
    id: string;
    nome: string;
    url: string;
    tipo_export: string;
  }[];
  filtri?: Filtro[];
  filtriContesto?: any[];
  promo: {
    nome: string;
    id: string;
  },

}


// Definizione per ComboBox
export type ComboBox = {
  tipo_field: "cmb";
  valore: Array<{ titolo: string; valore: string }>;
};

// Definizione per RadioButton
export type RadioButton = {
  tipo_field: "radio";
  valore: Array<{ titolo: string; valore: string }>;
};

// Definizione per TextField
export type TextField = {
  tipo_field: "text";
  valore: string;
};

// Definizione per il contesto di lavorazione
export type ContextLavorazione = {
  nome_field: string;
  titolo_field: string;
  dipendenze: { nome_field: string, valore: string }[];
  nullable: boolean;
} & (ComboBox | RadioButton | TextField);
//NOTE è uguale al context in lavorazione ma lo seperiamo per CAPIBILITA
export type ContextConfronto = {
  nome_field: string;
  titolo_field: string;
  dipendenze: { nome_field: string, valore: string }[];
  nullable: boolean;
} & (ComboBox | RadioButton | TextField);

export type ContextDinamico = {
  chiamata_runtime?: { metodo: string, url: string, body?: any } | false;
} & ContextLavorazione

export type RaccoglitoreKit = {
  guidId: string;
  guidAree: string[];
  guidCanali: string[];
  guidFormato: string;
  guidIdPv: (string | undefined)[];
  titolo: string;
  filtro: Filtro[];
  declinazioni: Declinazione[];
  tipiDiExportInKit: OggettoTipiDiExport[];
  quantita: number;
  tipo: TIPO_KIT_DESIGN;
  filtroContesto: {
    titoloFiltro: string;
    condizioni: { valore: string, schemaScelto: string }[];
  }[];
  tags?: string[];
  // agggiungi files solo se tipo = MANUALE
  files?: FileItemKit[];
}

export interface RaccoglitoreKitMongo extends RaccoglitoreKit, Document { }


export type RUNTIME_KIT_MONGO = {
  _id?: string;
  guidId: string;
  guidArea: string;
  filtro?: Filtro[];
  filtroContesto: any[]
  guidIdDesign: string;
  guidCanale: string;
  guidFormato: string;
  tipiDiExportInKit: OggettoTipiDiExport[];
  quantitaCopie: number;
  titolo: string;
  guidIdRaccoglitore: string;
  stato: STATO_COMBINAZIONI;
  idPromo: string;
  tipo: TIPO_KIT_DESIGN;
  nomeArea?: string;
  nomeCanale?: string;
  codiceArea?: string;
  codiceCanale?: string;
  promo?: any;
  webpliant?: ReferenzeIstanta[];
  declinazioni?: Declinazione[];
  inizioLavorazione?: Date,
  fineLavorazione?: Date,
  stato_lavorazione: STATO_LAVORAZIONE_KIT_RUNTIME;
  files?: FileItemKit[];
  updatedAt?: Date;
  createdAt?: Date;
}
export type DESIGN_KIT_MONGO = {
  _id?: string;
  guidId: string;
  guidArea: string;
  guidCanale: string;
  guidPv?: string;
  guidFormato: string;
  tipiDiExportInKit: OggettoTipiDiExport[];
  quantitaCopie: number;
  titolo: string;
  guidIdRaccoglitore: string;
  stato: STATO_COMBINAZIONI;
  nomeCanale?: string;
  nomeArea?: string;
  declinazioni?: Declinazione[];
  filtro?: Filtro[];
  filtroContesto: any[]
  tags?: string[];
  files?: FileItemKit[];
  tipo: TIPO_KIT_DESIGN;
};

export enum STATO_RICETTA {
  REVISIONARE = 'DA_REVISIONARE',
  PUBBLICARE = 'PUBBLICATA'
}

export enum TIPO_RICETTA {
  CORTA = 'CORTA',
  LUNGA = 'LUNGA'
}
export interface IngredienteRicettaCorta {
  nome_prodotto: string;
  ean: string;
  peso: number;
  unita_misura_peso: string;
  costo_per_unita_misura: number;
}
export interface IngredienteRicettaLunga {
  nome_prodotto: string;
  ean: string;
  quantita_necessaria: number;
  unita_misura_peso: string;
  costo_ingrediente_euro: number;
}
export interface Ricette {
  _id?: string;
  guid_id: string;
  titolo?: string;
  ingredienti?: Array<IngredienteRicettaCorta | IngredienteRicettaLunga>;
  procedimento?: string;
  tempo_in_secondi?: string;
  costo_in_euro?: string;
  stato?: STATO_RICETTA;
  tipo: TIPO_RICETTA;
  createdAt?: Date;
  updatedAt?: Date;
  abbinamento_vino?: {
    vini_abbinati: (ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[] | string[];
    motivazione: string;
  };
  foto_ricetta: FotoRicetta[];
}

export interface ApprofondimentoVino {
  id?: string;
  cantina: string;
  nome: string;
  codice: string;
  anno?: number;
  vino?: string;
  dataCreazione?: string;
  dataPubblicazione?: string;
  provenienza?: string;
  colore?: string;
  profumo?: string;
  gusto?: string;
  tasso_alcolico?: string;
  temperatura_di_servizio?: string;
  abbinamenti?: string;
  dettagli_cantina?: string;
}
export interface FotoRicetta {
  id: string,
  main: boolean,
  id_olimpo_cloud: string,
  url: string,
  meta: any,
  prompt: string,
}

export type FileItemKit = {
  url?: string;
  url_download?: string;
  id: string;
  id_runtime: string;
  direttive: string;
  nome: string;
  nome_originale: string;
  isOptional: boolean;
  id_olimpo_cloud?: string;
  meta_olimpo_cloud: any;
  tipo_export: string;
  tipo_export_codice: string;
  blob?: string;
  mime?: string;
  error?: string;
  size?: number;
  pages?: number;
  log?: FileItemKitLog;
  nome_kit?: string;
  id_promo?: string;
  is_merged_group?: boolean;
  merged_group_id?: string;
  merged_file_ids?: string[];
  virtual_dir?: any;
  id_ordine_stampa?: string;
}

export type VirtualDirectory = {
  path: string;
  name: string;
  children?: VirtualDirectory[];
};

export type MergedGroupFile = FileItemKit & {
  is_merged_group: true;
  merged_group_id: string;
  merged_file_ids: string[];
  virtual_dir: string;
  id_ordine_stampa: string;
};

export type FileItemKitLog = {
  id: string;
  guid_kit_runtime: string;
  nome_file: string;
  data_registrazione: Date;
  versione: number;
  stato: STATO_LOG_FILE;
  logs?: Array<{
    messaggio: string;
    data_notifica: Date;
    azione: 'Upload' | 'Download' | 'Rifiutato' | 'Accettato';
    utente_notifica?: string;
    dettagli_aggiuntivi?: Record<string, any>;
  }>;
}




export interface Filtro {
  titoloFiltro: string;
  condizioni: Condizione[];
}
export interface Condizione {
  nome_field: string;
  operatore: string;
  valore: string;
  idAddestramento: string;
}

export interface Proprieta {
  idChiave: number;
  valore: string;
}

export type Declinazione = {
  titolo: string;
  proprieta: Proprieta[];
  filtri: Filtro[];
}


export enum NOMI_MONGODB {
  combinazioni_design = "combinazioni_design",
  combinazioni_runtime = "combinazioni_runtime",
  promo_collection = "promo_collection",
  raccoglitori_kit = "raccoglitori_kit",
  ricette_ai_prima_versione = "ricette_ai_prima_versione",
  workspaces_webpliant = "workspaces_webpliant",
  config_webpliant = "config_webpliant",
  files_runtime = "files_runtime",
  files_runtime_log = "files_runtime_log",
  referenze_webpliant = "referenze_webpliant",
  contenuti_aggiuntivi_referenza = "contenuti_aggiuntivi_referenza",
  referenze_gruppo = "referenze_gruppo",
  config = "config",
  approfondimento_vino = "approfondimento_vino"
}

export type OggettoTipiDiExport = {
  tipoDiExportGuidID: string;
  filtro?: Filtro[] | null;
  codice?: string;
  useWebhook?: boolean;
  webhookEvents?: string;
};



export type FileTreeMeta = {
  description: string;
  timestamp: string;
  version: string;
};

export type FileTreeAction = {
  commands: TIPO_COMANDO_CONTRATTO_TIPOGRAFIA[];
  dirname?: string[];
  permissions?: string;
  meta?: FileTreeMeta;
  log?: string;
};

export type FileTreeNode = {

  priority: number;
  conditions: FileTreeCondition[];
  on_respect_condition: FileTreeAction;
  on_error: FileTreeAction;
  fallback: {
    action: string;
    dirname?: string;
  };
  filetree?: FileTreeNode[];
};

export type RootFileTree = {
  dictionary?: {
    [key: string]: string;
  }
  root: string;
  root_file_tree: FileTreeNode[];
};

export type CompiledField = {
  // PostgreSQL / DB format (snake_case)
  paragraph_name?: string;
  label_name?: string;
  // ISTANTA / MongoDB format (camelCase) — used in the material arrival flow
  paragraphName?: string;
  labelName?: string;
  content?: any;
}



export type LoghiReferenza = {
  guidId: string;
  sigla: string;
  tipo: number;
}
export interface ReferenzeIstanta {
  _id: string;
  contextTracciato: any;
  contextPromo: any;
  visibile?: boolean;
  id: string;
  guidIdKitRuntime: string;
  compiledFields: CompiledField[];
  deletedFields: string[];
  foto: string[];
  fotoGruppo?: string;
  meccanica: string;
  codiceBox: string;
  fotoExtra: LoghiReferenza[];
  groupElements: Array<DataFields>;
  dataFields: DataFields;
  contenutiAggiuntivi?: ContenutoAggiuntivoReferenza[];
  validoDal?: string;
  validoAl?: string;
  idPromo?: string;
  fotoSingolaForzata?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  // Campi posizione InDesign (nella root)
  pag?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  wPage?: number;
  hPage?: number;
  percIngombro?: number;
  aspectRatio?: number;
}


export type FotoGruppoReferenze = {
  id: string;
  guidIdOlympo: string;
  codiceReferenza: string;
  idArea?: string;
  idCanale?: string;
};

export type DataFields = {
  descrizione_uno?: string;
  descrizione_due?: string;
  descrizione_tre?: string;
  context_promo?: string[];
  context_tracciato?: string[];
  codice_referenza?: string;
  ean_referenza?: string;
  descrizione_peso?: number;
  scatto_codice?: string
  descrizione_unita_misura?: string;
  [key: string]:
  | string
  | number
  | boolean
  | string[]
  | { codice: string; descrizione: string }[]
  | undefined;
};

export interface ContenutoAggiuntivoReferenza {
  titolo?: string;
  guidId: string;
  contenuto: {
    descrizione: string;
    logo?: string;
    logoUrl?: string;
    sfondoLogo?: string;
  };
  regole: {
    value: string;
    field: string;
    operator: "equal" | "not-equal" | "greater-than" | "less-than" | "contains" | "startsWith" | "endsWith";
  }[];
}



/**
 * Mappa che, in base al tipo di interazione, determina
 * quali campi siano effettivamente disponibili.
 */
type FieldsByInteractionType = {
  [key in InteractionType]: FieldType[];
};

export const fieldsByInteractionType: FieldsByInteractionType = {
  [InteractionType.WORKSPACE]: [
    FieldType.CANALE,
    FieldType.PUNTO_VENDITA,
    FieldType.AREA,
  ],
  [InteractionType.PAGES]: [
    FieldType.CANALE,
    FieldType.PUNTO_VENDITA,
    FieldType.RICORRENZA,
    FieldType.DATA_SCADENZA,
    FieldType.AREA,
  ],
  [InteractionType.SECTION]: [
    FieldType.CANALE,
    FieldType.PUNTO_VENDITA,
    FieldType.RICORRENZA,
    FieldType.AREA,
    FieldType.DATA_SCADENZA,
    FieldType.REFERENZE,
  ],
  [InteractionType.SINGLE_SERVICE]: [
    FieldType.CANALE,
    FieldType.PUNTO_VENDITA,
    FieldType.RICORRENZA,
    FieldType.AREA,
    FieldType.DATA_SCADENZA,
  ],
};
interface GroupByOption {
  [key: string]: string;
}




export interface ConfigurazioneCampoPersonalizzato {
  azione: "sostituisci" | "aggiungi" | "rimuovi";
  campoDestinazione?: string;
  posizione?: string;
  solo_valore?: boolean;
  html_puro?: boolean;
}

export interface Azione {
  nome: string;
  campi: { [campo: string]: ConfigurazioneCampoPersonalizzato };
}

export type CondizioniRefStruttura = {
  nome_campo: string;
  operatore: "equal" | "not-equal" | "greater-than" | "less-than" | "contains" | "not-contains" | "startsWith" | "endsWith";
  valore: string
}
export interface Struttura {
  id?: number;
  tag: string;
  classi_css?: (string | ClassiCssCondizionali)[];
  figli?: (Struttura | string)[];
  root?: boolean;
  attributi?: { [key: string]: string | undefined | {} };
  contenuto?: string;
  condizioni?: CondizioniRefStruttura[];
  filtri_html?: string[];
  html_puro?: boolean;
  inietta_classi_css?: Array<{
    tag: string;
    classi_css: string[];
  }>;
  divisione_contenuto?: {
    actions: Array<{
      comportamento: string;
      charachter?: string;
      tag: string;
    }>;
  };
  inietta_tag?: Array<{
    tag_to_find: string;
    tag_to_insert: string;
  }>;
  deleted_field?: string[];
}

export type ClassiCssCondizionali = {
  nome_campo: string;
  operatore: "equal" | "not-equal" | "greater-than" | "less-than" | "contains" | "startsWith" | "endsWith";
  valore: string;
  classi_css: string[];
}

export interface StileBoxReferenza {
  id?: number;
  nome_stile: string;
  condizioni: { nome_campo: string; valori: string[] }[] | string;
  struttura: Struttura;
  azioni?: Azione[];
}

export type ConfigWebpliant = {
  css_text: string;
  color_gdo: string;
  guidId: string;
  icona_pagina: string;
  logo_header: Array<LoghiInsegne>;
  stili: StileBoxReferenza[];
  stili_minimal?: StileBoxReferenza[];
  data_fields_refs: {
    expected_input: string;
    expected_output: string;
    core?: boolean;
  }[];
  data_fields_files?: string[];
  meta_volantino: {
    title: string;
    description: string;
  };
};

export type DataWebPliant = {
  webpliant: Array<PaginaWebPliant>;
  sitemap: SitemapType[];
  idWorkspace: string;
  idArea: string;
  idCanale: string;
  idGDO: string;
  idPV: string;
  nomeWorkspace?: string;
}

export type PaginaWebPliant = {
  id: string;
  nome: string;
  tipo: TIPO_PAGINA;
  struttura: PageLayoutItem[];
  settings?: {
    mostra_menu_laterale?: boolean;
    policy?: PolicyDiVisualizzazioneType;
  };
}
export interface SitemapType {
  id: string;
  titolo: string;
  pagine_collegate: Array<{
    id: string;
    titolo: string;

  }>;
  link_esterno?: string;
  impostazioni_avanzate: {
    show?: boolean;
    mostra_menu_laterale?: boolean
  };
}

export type LoghiInsegne = {
  url: string;
  base64: string;
  idCanale: string;
  idArea: string;
  idPv: string;
}
/**
 * Enumeratore con i possibili tipi di interazione
 * che determinano quali campi di Policy sono disponibili.
 */


interface DateFilterValue {
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains";
  date: string;
}
/**
 * Singolo "campo regola": inclusione o esclusione di un certo tipo con un certo valore
 */
interface PolicyItem {
  tipo: FieldType;
  /**
   * Per campi semplici (es: AREA) sarà una stringa (id area).
   * Per RICORRENZA, gestiremo un oggetto serializzato in JSON.
   */
  valore: string | DateFilterValue;
  operatore?: OperatorOption["value"];
}

/**
 * Singola regola (può contenere array di inclusione ed esclusione)
 */
interface PolicyRegola {
  inclusione: PolicyItem[];
  esclusione: PolicyItem[];
}

/**
 * Struttura complessiva della policy di visualizzazione
 */
export interface PolicyDiVisualizzazioneType {
  locked: boolean;
  visualizzazione: PolicyRegola[];
  filtri_contenuto: PolicyRegola[];
}


export type OperatorOption = {
  value: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains";
  label: string;
};

export const operatorOptions: OperatorOption[] = [
  { value: "equals", label: "Uguale a" },
  { value: "not_equals", label: "Diverso da" },
  { value: "greater_than", label: "Maggiore di" },
  { value: "less_than", label: "Minore di" },
  { value: "contains", label: "Contiene" },
  { value: "not_contains", label: "Non contiene" },
];
export interface FilterCondition {
  field: string;
  operator: string;
  value: string;
  priority?: number;
}


export interface FilterConditionContesto {
  nome_field: string;
  operator: string;
  user_value: string;
}

export interface ForcedStyles {
  campi: string[];
  backgroundColor: string;
  margin: string;
  padding: string;
  border: string;
  borderRadius: string;
  width: string;
  height: string;
  textAlign: string;
  color: string;
}

export type Logo = {
  srcLogoCarosello: string;
  width: string;
  height: string;
  posizione: "top" | "bottom" | "left" | "right";
}

export type AttributiCaroselloWebpliant = {
  id?: string;
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  pulsante_mostra_tutto?: {
    active: boolean;
    label: string;
    idPaginaCollegata: string;
  };
  inVisibilita?: boolean;
  filters?: FilterCondition[];
  filtersNew?: Array<FilterCondition[]>;
  filtriContesto?: FilterConditionContesto[];
  options?: {
    carouselType?: "normal" | "groupedby";
    carouselTypeField?: string;
    validita?: {
      auto?: boolean;
      validitaDal?: boolean;
      validitaAl?: boolean;
      color?: string;
    };
    forcedStyles?: ForcedStyles[];
    forzaturaBox?: string;
  };
  logo?: Logo;
  filtroContesto?: any;
  images?: {
    src: string;
    alt: string;
  }[];
};

export type AttributiBannerWebpliant = {
  banner: string | ArrayBuffer | null | undefined;
  bannerTitle: string;
  bannerText: string;
}

// Tipo base per tutti gli elementi del layout
export type BasePageLayoutItem = {
  id: string;
  parentId: string;
  user_locked: {
    locked: boolean;
    user_id: string;
  };
  duration?: {
    id_promo?: string;
    start_date?: Date;
    end_date?: Date;
  }
  children?: PageLayoutItem[];
  policy: PolicyDiVisualizzazioneType;
  is_hybrid?: boolean;
  alias?: string;
  keyframes?: Keyframe[];
};

// Tipi specifici per ogni elemento
export type CarouselLayoutItem = BasePageLayoutItem & {
  type: "carousel";
  content: AttributiCaroselloWebpliant;
};

export type VideoLayoutItem = BasePageLayoutItem & {
  type: "video";
  content: any;
};

export type TextLayoutItem = BasePageLayoutItem & {
  type: "text";
  content: any;
};

export type RowLayoutItem = BasePageLayoutItem & {
  type: "row";
  content: any;
};

export type ImageLayoutItem = BasePageLayoutItem & {
  type: "image";
  content: any;
};

export type ColumnLayoutItem = BasePageLayoutItem & {
  type: "col";
  content: any;
};

export type RicettaAILayoutItem = BasePageLayoutItem & {
  type: "ricetta_ai";
  content: any;
};

export type SpaceLayoutItem = BasePageLayoutItem & {
  type: "space";
  content: any;
};

export type GrigliaReferenzeLayoutItem = BasePageLayoutItem & {
  type: "griglia_referenze";
  content: any;
};

export type RuotaDellaFortunaLayoutItem = BasePageLayoutItem & {
  type: "ruota_della_fortuna";
  content: any;
};

export type HTMLLayoutItem = BasePageLayoutItem & {
  type: "html";
  content: any;
};

export type BannerLayoutItem = BasePageLayoutItem & {
  type: "banner";
  content: AttributiBannerWebpliant;
};

export type PDFVolantinoLayoutItem = BasePageLayoutItem & {
  type: "pdf_volantino";
  content: any;
};

// Unione di tutti i tipi di layout
export type PageLayoutItem =
  | CarouselLayoutItem
  | VideoLayoutItem
  | TextLayoutItem
  | RowLayoutItem
  | ImageLayoutItem
  | ColumnLayoutItem
  | RicettaAILayoutItem
  | SpaceLayoutItem
  | GrigliaReferenzeLayoutItem
  | RuotaDellaFortunaLayoutItem
  | HTMLLayoutItem
  | BannerLayoutItem
  | PDFVolantinoLayoutItem;


export type TimelinePromoItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  color?: string;
  disabled?: boolean;
  idPromo: string;
  combinazioni?: number
}

export type TraduzioniAttributes = {
  id_Traduzioni?: string;
  testoOriginale_Traduzioni: string;
  testoTraduzione_Traduzioni: string;
  lingua_Traduzioni: string;
  tipo_Traduzioni: string;
  stato_Traduzioni: string;
  createdat?: Date;
  updatedat?: Date;
};

export interface WishlistWebpliantAttributes {
  id_whishlistwepliant: string;
  idcanale_whishlistwepliant: string;
  idarea_whishlistwepliant: string;
  idpv_whishlistwepliant: string;
  meta_whishlistwepliant: any;
  idpagina_whishlistwepliant: string;
  idworkspace_whishlistwepliant: string;
}
// lib/types.ts

// Tipo per un singolo elemento del menu
export interface MenuItem {
  icon?: string;
  pathname?: string;
  title: string;
  subMenu?: MenuItem[];
  disabled?: boolean;
  start_page?: boolean;
}

// Tipo per un separatore (stringa)
export type MenuSeparator = string;

// Tipo per un elemento del menu (può essere un item o un separatore)
export type MenuElement = MenuItem | MenuSeparator;

// Tipo per i ruoli GDO specifici
export type GdoRole =
  | "GDO_DEVELOPER"
  | "GDO_ADMIN"
  | "GDO_RESPONSABILE_VENDITE"
  | "GDO_MANAGER"
  | "GDO_OPERATORE"
  | "GDO_VIEWER"
  | "GDO_AI_SPECIALIST";

// Tipo per i tipi di utenti tradizionali
export type TraditionalUserType =
  | "SUPERADMIN"
  | "AGENZIA"
  | "ADMIN"
  | "PUNTOVENDITA";

// Tipo per tutti i tipi di utenti
export type UserType = TraditionalUserType | "GDO";

// Tipo per la struttura del menu GDO (oggetto con ruoli)
export type GdoMenuStructure = {
  [key: string]: MenuElement[]
};

// Tipo per la struttura del menu tradizionale (array)
export type TraditionalMenuStructure = MenuElement[];

// Tipo per la struttura completa del menu
export interface MenuStructure {
  TIPO_UTENTI: {
    [K in TraditionalUserType]: TraditionalMenuStructure;
  } & {
    GDO: GdoMenuStructure;
  };
}

export interface GDOWhatsappPresetAttributes {
  id_gdowhatsappreset?: string;
  id_template_gdowhatsappreset: string;
  nome_preset_gdowhatsappreset: string;
  is_default_gdowhatsappreset: boolean;
  hash_gdowhatsappreset: string;
  json_meta_gdowhatsappreset: any;
  createdat?: Date;
  updatedat?: Date;

}

export interface GDOWhatsappNumbersAttributes {
  id_gdowhatsappnumbers?: string;
  id_gdo_gdowhatsappnumbers: string;
  id_numero_whatsapp_gdowhatsappnumbers: string;
  display_name_gdowhatsappnumbers: string;
  stato_gdowhatsappnumbers: STATO_GDO_WHATSAPP_NUMBER;
  whatsapp_business_account_id_gdowhatsappnumbers: string | undefined;
  provider_gdowhatsappnumbers: PROVIDER_WHATSAPP;
  access_token_gdowhatsappnumbers: string | undefined;
  verify_token_gdowhatsappnumbers: string | undefined;
  createdat?: Date;
  updatedat?: Date;
}

export interface GDOWhatsappMessageAttributes {
  id_gdowhatsappmessage?: string;

  // Conversation context
  id_conversation_gdowhatsappmessage: string;

  // Message routing
  direction_gdowhatsappmessage: "in" | "out"; // inbound webhook vs outbound API
  status_gdowhatsappmessage: "sent" | "delivered" | "read" | "failed";

  // WhatsApp message metadata
  provider_msg_id_gdowhatsappmessage?: string; // WhatsApp message ID
  from_gdowhatsappmessage?: string; // number that sends (only inbound)
  to_gdowhatsappmessage?: string;   // destination (only outbound)

  // Message type
  type_gdowhatsappmessage: "text" | "template" | "image" | "doc";

  // Template info (OUTBOUND only)
  template_name_gdowhatsappmessage?: string;
  template_preset_name_gdowhatsappmessage?: string;
  msg_lang_gdowhatsappmessage?: string;   // es: "it", "en", "en_US"

  // Content (varia in base al tipo)
  msg_text_gdowhatsappmessage?: string; // text.body
  media_url_gdowhatsappmessage?: string; // image.url | document.url
  media_mimetype_gdowhatsappmessage?: string;
  media_sha256_gdowhatsappmessage?: string;
  media_filename_gdowhatsappmessage?: string; // only for documents

  // JSON payload (raw WhatsApp full body)
  payload_json_gdowhatsappmessage: string; // sempre raw JSON per debug

  // Token usage (per AI / NLP)
  tokens_gdowhatsappmessage?: number;

  // Errori WhatsApp
  error_code_gdowhatsappmessage?: string;
  error_msg_gdowhatsappmessage?: string;

  createdat?: Date;
  updatedat?: Date;
}
// id bigint NOT NULL DEFAULT nextval('wa_conversations_id_seq':: regclass),
// id_cliente integer NOT NULL,
//   id_utente bigint NOT NULL,
//     window_open_at timestamp without time zone NOT NULL,
//       window_expires_at timestamp without time zone NOT NULL,
//         last_dir wa_direction NOT NULL,
//           is_open smallint NOT NULL DEFAULT 1,
//             open_flag smallint GENERATED ALWAYS AS(
export interface GDOWhatsappConversationAttributes {
  id_gdowhatsappconversation?: string;
  id_gdo_gdowhatsappconversation: string;
  id_utente_gdowhatsappconversation: string;
  finestra_aperta_gdowhatsappconversation: Date;
  finestra_scadenza_gdowhatsappconversation: Date;
  last_direction_gdowhatsappconversation: "in" | "out";
  is_open_gdowhatsappconversation: boolean;
  createdat?: Date;
  updatedat?: Date;
}


export type HeaderFormat = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export type ButtonKind = "NONE" | "QUICK_REPLY" | "CTA";
export type CtaType = "URL" | "PHONE_NUMBER";


export type QuickReply = { type: "QUICK_REPLY"; text: string };
export type Cta =
  | { type: "URL"; text: string; url?: string; phone_number?: never }
  | { type: "PHONE_NUMBER"; text: string; phone_number?: string; url?: never };


export type WhatsAppTemplateComponent =
  | {
    type: "HEADER";
    format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    text?: string;
    example?: { header_text?: string[]; header_handle?: string[] };
  }
  | {
    type: "BODY";
    text: string;
    example?: { body_text: string[][] };
  }
  | {
    type: "FOOTER";
    text: string;
  }
  | {
    type: "BUTTONS";
    buttons: (
      | { type: "QUICK_REPLY"; text: string }
      | { type: "URL"; text: string; url: string }
      | { type: "PHONE_NUMBER"; text: string; phone_number: string }
      | { type: "COPY_CODE"; text: string; code: string }
    )[];
  };


export interface WhatsAppTemplateLanguage {
  code: string; // es. 'it', 'en_US'
  policy?: "deterministic" | "fallback";
}


export interface WhatsAppTemplate {
  name: string;
  language: WhatsAppTemplateLanguage;
  status?: STATO_GDO_WHATSAPP_TEMPLATE;
  category?: CATEGORIA_TEMPLATE_WHATSAPP;
  components: WhatsAppTemplateComponent[];
  namespace?: string;
  id?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
  preview_url?: string;
  variables?: Record<string, any>;
  parameter_format: string;
}
export interface GDOWhatsappTemplateAttributes {
  id_gdowhatsapptemplate?: string;
  id_gdo_gdowhatsapptemplate: string;
  nome_template_gdowhatsapptemplate: string;
  lingua_template_gdowhatsapptemplate: string;
  json_meta_gdowhatsapptemplate: WhatsAppTemplate;
  categoria_template_gdowhatsapptemplate: CATEGORIA_TEMPLATE_WHATSAPP;
  stato_meta_gdowhatsapptemplate: STATO_GDO_WHATSAPP_TEMPLATE;
  createdat?: Date;
  updatedat?: Date;
}


// ===========================
// DEVICE WEBSOCKET TYPES
// ===========================

/**
 * Payload inviato dal dispositivo per heartbeat
 */
export interface DeviceHeartbeatPayload {
  timestamp: number;
}

/**
 * Payload inviato dal dispositivo quando cambia slide
 */
export interface DeviceSlideChangePayload {
  slideIndex: number;
  totalSlides: number;
  slideName?: string;
  slideUrl?: string;
}

/**
 * Payload di risposta per autenticazione riuscita
 */
export interface DeviceAuthSuccessPayload {
  deviceId: string;
  deviceName: string;
  serverTime: number;
}

/**
 * Payload di risposta per errore autenticazione
 */
export interface DeviceAuthErrorPayload {
  message: string;
}

/**
 * Payload di acknowledge heartbeat
 */
export interface DeviceHeartbeatAckPayload {
  timestamp: number;
  serverTimestamp: number;
  latencyMs: number;
}

/**
 * Payload per stato dispositivo inviato alla UI di gestione
 */
export interface PVDeviceStatusPayload {
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  latencyMs?: number;
  currentSlideIndex?: number;
  totalSlides?: number;
  slideName?: string;
  slideUrl?: string;
  lastUpdate: number;
}

/**
 * Payload per sottoscrizione/disiscrizione a punto vendita
 */
export interface PVSubscribePayload {
  pvId: string;
}

// ===========================
// OLYMPUS POLICY TYPES
// ===========================

/**
 * Nodo dell'albero dei ruoli nella policy utente di Olympus.
 *
 * La struttura è ricorsiva e scalabile per qualsiasi gerarchia organizzativa:
 * - nodeType   : tipo del nodo (es. "Settore", "Reparto", "Area" per Coopfi)
 * - nodeValue  : valore del nodo (es. "RAA", "OF", "SMK")
 * - children   : sotto-nodi figli (stessa struttura, ricorsivo)
 * - codificaFICO : codifica ufficiale FICO del nodo (presa dall'organigramma)
 */
export interface OlympusUserPolicyRuolo {
  nodeType: string;
  nodeValue: string;
  codificaFICO: string;
  children: OlympusUserPolicyRuolo[];
}


export interface TracciatoConfronto {
  guidIdTracciato: string,
  guidIdArea: string,
  guidIdCanale: string,
  records: Array<Record<string, string>>
}

export interface ResultConfrontoItem {
  primario: TracciatoConfronto,
  secondario?: TracciatoConfronto,
  uscenti: number,
  entranti: number,
  inalterati: number,
  alterati: number
}

// ─── Dynamic Report System ────────────────────────────────────────────────────

export interface KpiCardItem {
  label: string;
  value: number;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'slate';
  unit?: string;
  icon?: string;
}

interface _TracciatoWidgetBase {
  id: string;
  title: string;
  description?: string;
  badge?: string;
  gridSpan?: 1 | 2 | 3 | 4;
}

export interface TracciatoWidgetKpiGrid extends _TracciatoWidgetBase {
  type: 'kpi_grid';
  items: KpiCardItem[];
}

export interface TracciatoWidgetChart extends _TracciatoWidgetBase {
  type: 'bar_chart' | 'pie_chart';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
  }>;
}

export interface TracciatoWidgetLineChart extends _TracciatoWidgetBase {
  type: 'line_chart';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
}

export interface TracciatoWidgetTable extends _TracciatoWidgetBase {
  type: 'table';
  columns: Array<{ key: string; label: string }>;
  rows: Record<string, string | number>[];
}

export interface TracciatoWidgetGroupedTableRow {
  codice: string;
  descrizione: string;
  tipo: 'singolo' | 'gruppo';
  tipo_evento: string;
  prestazione: string;
  prezzo_continuo: string;
  prezzo: string;
  tema: string;
  txt_sconto: string;
  subCodici?: {
    codice: string,
    descrizione: string
  }[];
}

export interface TracciatoWidgetGroupedTableGroup {
  reparto: string;
  rows: TracciatoWidgetGroupedTableRow[];
}

export interface TracciatoWidgetGroupedTable extends _TracciatoWidgetBase {
  type: 'grouped_table';
  groups: TracciatoWidgetGroupedTableGroup[];
  totalCount: number;
}

export interface TracciatoWidgetCallout extends _TracciatoWidgetBase {
  type: 'callout';
  message: string;
  severity?: 'info' | 'warning' | 'success' | 'error';
  icon?: string;
}

export interface TracciatoWidgetReferenzeSplitTable extends _TracciatoWidgetBase {
  type: 'referenze_split_table';
  columns: Array<{ key: string; label: string }>;
  singoli: Record<string, string | number>[];
  gruppi: Record<string, string | number>[];
}

export interface TracciatoWidgetDualPieChart extends _TracciatoWidgetBase {
  type: 'dual_pie_chart';
  /** Etichetta per il grafico "prima" (momento primario) */
  labelA: string;
  /** Etichetta per il grafico "dopo" (momento secondario) */
  labelB: string;
  labels: string[];
  colors: string[];
  dataA: number[];
  dataB: number[];
}

export interface TracciatoFieldChange {
  /** Chiave del campo nel record (es. 'prezzo_promo', 'tipo_evento') */
  campo: string;
  /** Etichetta human-friendly del campo */
  label: string;
  /** Valore nel momento primario */
  valoreA: string;
  /** Valore nel momento secondario */
  valoreB: string;
  /** True se il campo è numerico (prezzi, punti, pezzi) */
  isNumeric: boolean;
  /** Delta numerico (B − A), null se non parsabile */
  delta: number | null;
  /** Es. "+12%" o "−5%", null se non calcolabile */
  deltaPercent: string | null;
}

export type TracciatoWidgetPriceDiffCellValue = string | number | boolean | null | undefined;

export type TracciatoWidgetPriceDiffExtraFields = Record<string, TracciatoWidgetPriceDiffCellValue>;

export interface TracciatoWidgetPriceDiffExtraColumn<TExtraFields extends TracciatoWidgetPriceDiffExtraFields = TracciatoWidgetPriceDiffExtraFields> {
  key: Extract<keyof TExtraFields, string>;
  label: string;
}

export interface TracciatoWidgetPriceDiffRow<TExtraFields extends TracciatoWidgetPriceDiffExtraFields = TracciatoWidgetPriceDiffExtraFields> {
  descrizione?: string;
  codice: string;
  reparto: string;
  tipo: 'singolo' | 'gruppo';
  /** Campi aggiuntivi specifici dell'agenzia lib, renderizzati tramite extraColumns */
  extraFields?: TExtraFields;
  /** Elenco dei campi che risultano modificati tra primario e secondario */
  changes: TracciatoFieldChange[];
}

export interface TracciatoWidgetPriceDiff<TExtraFields extends TracciatoWidgetPriceDiffExtraFields = TracciatoWidgetPriceDiffExtraFields> extends _TracciatoWidgetBase {
  type: 'price_diff';
  labelA: string;
  labelB: string;
  /** Colonne aggiuntive da mostrare per i campi presenti in row.extraFields */
  extraColumns?: TracciatoWidgetPriceDiffExtraColumn<TExtraFields>[];
  rows: TracciatoWidgetPriceDiffRow<TExtraFields>[];
}

export interface TracciatoWidgetScoreboardCodiceRow {
  codice: string;
  percentualeIntegra: number;
  score: number;
  inalterati: number;
  uscenti: number;
  entranti: number;
  modificati: number;
  totale: number;
  audit?: TracciatoWidgetScoreAudit[];
}

export interface TracciatoWidgetScoreAudit {
  type: 'info' | 'warn' | 'danger' | 'critical';
  message: string;
  params?: Record<string, unknown> | null;
}

export interface TracciatoWidgetScoreboardRow {
  reparto: string;
  percentualeIntegra: number;
  score: number;
  inalterati: number;
  uscenti: number;
  entranti: number;
  modificati: number;
  totale: number;
  codici?: TracciatoWidgetScoreboardCodiceRow[];
  hasTerremoto?: boolean;
  audit?: TracciatoWidgetScoreAudit[];
}

export interface TracciatoWidgetScoreboard extends _TracciatoWidgetBase {
  type: 'scoreboard';
  rows: TracciatoWidgetScoreboardRow[];
  totalScore: number;
}

export type TracciatoReportWidget =
  | TracciatoWidgetKpiGrid
  | TracciatoWidgetChart
  | TracciatoWidgetLineChart
  | TracciatoWidgetTable
  | TracciatoWidgetCallout
  | TracciatoWidgetReferenzeSplitTable
  | TracciatoWidgetDualPieChart
  | TracciatoWidgetPriceDiff
  | TracciatoWidgetScoreboard
  | TracciatoWidgetGroupedTable;

export interface TracciatoReportCanaleAreaView {
  guidCanale: string;
  guidArea: string;
  nomeCanale: string;
  nomeArea: string;
  label: string;
  widgets: TracciatoReportWidget[];
  /**
   * Variante dei widget da usare SOLO per l'esportazione PDF, calcolata dall'agenzia lib
   * (regole specifiche del cliente, es. Coopfi esclude alcuni temi dalle liste).
   * Presente solo se differisce da `widgets`; la vista a schermo usa sempre `widgets`.
   */
  widgetsPdf?: TracciatoReportWidget[];
}

export interface TracciatoReport {
  title: string;
  subtitle?: string;
  generatedAt: string;
  widgets: TracciatoReportWidget[];
  /** Variante di `widgets` per il solo PDF (vedi TracciatoReportCanaleAreaView.widgetsPdf). */
  widgetsPdf?: TracciatoReportWidget[];
  viewsPerCanaleArea?: TracciatoReportCanaleAreaView[];
}

export interface SavedPromoScoreboard {
  id: string;
  idPromo: string;
  promoNome: string;
  computedAt: string;
  report: TracciatoReport;
}

export interface CategoryScoreboardTimeline {
  promos: Array<{
    id: string;
    nome: string;
    computedAt: string;
    validaDal?: string;
    validaAl?: string;
  }>;
  series: Array<{
    reparto: string;
    data: (number | null)[];
    average: number;
  }>;
  canaleAreaSeries: Array<{
    key: string;
    guidCanale: string;
    guidArea: string;
    label: string;
    average: number;
    series: Array<{
      reparto: string;
      data: (number | null)[];
      average: number;
    }>;
  }>;
  settoriNomi: string[];
}

export interface SavedReportConfrontoSummary {
  id: string;
  idPromo: string;
  reportTitle: string;
  reportSubtitle?: string;
  createdAt: string;
}

export interface SavedReportConfronto extends SavedReportConfrontoSummary {
  tracciatiIds: string[];
  context: ContextConfronto[];
  istantaResult: ResultConfrontoItem[];
  report: TracciatoReport;
}

// ── Query Engine ──────────────────────────────────────────────────────────────

export type PromoFilterQuery =
  | { type: "all" }
  | { type: "by_ids"; ids: string[] }
  | { type: "date_range"; from: string; to: string }
  | { type: "name_pattern"; pattern: string };

export type MomentoSelectorQuery =
  | { type: "all_confronti" }
  | { type: "first_per_promo" }
  | { type: "last_per_promo" }
  | { type: "index_per_promo"; n: number };

export type AggregazioneQuery = "merged" | "per_promo" | "trend";

export interface TracciatoQueryRequest {
  promoFilter: PromoFilterQuery;
  momentoSelector: MomentoSelectorQuery;
  repartoFilter?: string[];
  canaleFilter?: string[];
  areaFilter?: string[];
  aggregazione: AggregazioneQuery;
  label?: string;
}

export interface TracciatoQueryPromoResult {
  promoId: string;
  promoNome: string;
  date: string;
  report: TracciatoReport;
}

export interface TracciatoQueryResult {
  query: TracciatoQueryRequest;
  promoCount: number;
  computedAt: string;
  aggregazione: AggregazioneQuery;
  report?: TracciatoReport;
  reports?: TracciatoQueryPromoResult[];
}

export interface ReportOptionDTO {
  id: string;
  titolo: string;
  descrizione: string;
  icona?: string;
  plugins: Array<{ id: string; titolo: string }>;
}

export interface MenaboCampoFiltro {
  nome_campo: string;
}

export interface MenaboSottogruppoChiave {
  nome_campo: string;
  label: string;
}

export interface MenaboRaggruppamento {
  nome_campo: string;
  valore_campo: string;
  conteggio: number;
  records: Array<Record<string, string>>;
  records_preview: Array<{
    descrizione: string;
    codice: string;
    reparto: string;
    foto_url?: string;
  }>
  chiavi_sottogruppi?: MenaboSottogruppoChiave[];
}

export interface MenaboDivisioneParams {
  tipoDivisione: 'canale' | 'area' | 'area_e_canale';
  dataDivisione: any[];
}

export interface MenaboRisultatoCanale {
  id: string;    // sectionKey usato da CoopFi (guidCanale | guidArea | guidCanale:guidArea, lowercase)
  label: string; // testo display (per ora = guid, in futuro nome canale/area)
  campi_filtro: MenaboCampoFiltro[];
  raggruppamento: MenaboRaggruppamento[];
}

export interface MenaboRisultato {
  tipoDivisione: 'canale' | 'area' | 'area_e_canale';
  risultati: MenaboRisultatoCanale[];
  nomePromo?: string;
}

export interface MenaboLayoutLabelSalvata {
  text: string;
  colorIdx: number;
  source: 'regole' | 'manuale' | 'salvato';
}

export interface MenaboLayoutGruppoSalvato {
  id: string;
  groupId: string;
  sourceKey: string;
  label: string;
  colorIdx: number;
  recordKeys: string[];
  records: Array<Record<string, string>>;
  recordCount: number;
}

export interface MenaboPageNote {
  id: string;
  text: string;
}

export interface MenaboLayoutPaginaSalvata {
  pageIndex: number;
  pageNumber: number;
  referenzePerPagina?: number;
  regoleLabelHidden?: boolean;
  label?: MenaboLayoutLabelSalvata;
  /** @deprecated singola nota legacy: ora si usa `notes[]`. Letta solo in migrazione. */
  note?: string;
  /** Note promemoria a livello di pagina: non sono contenuto stampabile, non vengono esportate. */
  notes?: MenaboPageNote[];
  groups: MenaboLayoutGruppoSalvato[];
}

export interface MenaboLayoutDivisioneSalvata {
  divisionId: string;
  divisionLabel: string;
  pageCount: number;
  pages: MenaboLayoutPaginaSalvata[];
  updatedAt: string;
}

export interface MenaboLayoutSalvato {
  schemaVersion: 1;
  idPromo: string;
  tipoDivisione: 'canale' | 'area' | 'area_e_canale';
  divisioni: Record<string, MenaboLayoutDivisioneSalvata>;
  updatedAt: string;
}

export interface SaveMenaboLayoutRequest {
  tipoDivisione: MenaboLayoutSalvato['tipoDivisione'];
  divisione: MenaboLayoutDivisioneSalvata;
}

export interface IndesignPluginFiltro {
  limite: number;
  ordine: number;
  criteri: {
    chiave: string;
    operatore: '=' | 'in';
    valore: string;
  }[];
}

export interface IndesignPluginSourcePage {
  pagina: string;
  filtri: IndesignPluginFiltro[];
  active: boolean;
  blocco: boolean;
  limite: string | number;
}

export interface IndesignPluginExport {
  source: IndesignPluginSourcePage[];
}
