// DTO per i modelli principali
export * from './PromoDTO';
export * from './PuntoVenditaDTO';
export * from './UtenteDTO';

// DTO per i modelli di base
export * from './AreaDTO';
export * from './CanaleDTO';
export * from './GDODTO';
export * from './RuoloUtenteGDODTO';

// DTO per le attività
export * from './AttivitaDTO';
export * from './AttivitaUtenteDTO';

// DTO per i webhook
export * from './TentativoWebhookDTO';
export * from './WebhookDTO';

// DTO per le wishlist
export * from './WishlistWebpliantDTO';

// DTO per i formati e ordini
export * from './FormatiDTO';
export * from './OrdiniDiStampaDTO';
export * from './OrdiniDiStampaInviiDTO';

// DTO per gli utenti specializzati
export * from './UtentiAnonimiDTO';
export * from './UtentiGDODTO';
export * from './UtentiGuestDTO';

// DTO per i punti vendita e utenti
export * from './PuntiVenditaUtentiDTO';

// DTO per i tipi di export
export * from './TipiDiExportDTO';

// DTO per i contratti
export * from './ContrattoTipografiaDTO';

// DTO per le naming convention
export * from './NamingConventionDTO';

// DTO per i canali di interazione
export * from './CanaliInterazioneDTO';

// DTO per le combinazioni
export * from './CombinazioneCanaleAreaDTO';

// DTO per i tipi utente punto vendita
export * from './TipoUtentePuntoVenditaDTO';

// DTO per i tracciati
export * from './TracciatiDTO';

// DTO per le statistiche API
export * from './StatisticheApiDTO';

// DTO per i Filter Template
export * from './FilterTemplateDTO';
export * from './FlyerHistoryDTO';
export * from './FlyerInsightsDTO';

// DTO per Display Context e Dispositivi Punto Vendita
export * from './DisplayContextDTO';

// DTO comuni e utility
export interface BaseResponseDTO {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface SearchFiltersDTO {
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
  order_direction?: 'ASC' | 'DESC';
}

export interface ImportResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

export interface StatsResponseDTO {
  total: number;
  per_category: Array<{ category: string; count: number }>;
  recent_items: any[];
}
