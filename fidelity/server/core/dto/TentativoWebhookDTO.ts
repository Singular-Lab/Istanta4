import { STATO_TENTATIVO_WEBHOOK } from '../../../lib/enums';

/**
 * DTO per la creazione di un nuovo tentativo webhook
 */
export interface CreateTentativoWebhookDTO {
  webhook_id: string;
  payload_id: string;
  numero_tentativo: number;
  stato: STATO_TENTATIVO_WEBHOOK;
  http_status?: number;
  response_body?: string;
  messaggio_errore?: string;
  durata_ms: number;
}

/**
 * DTO per l'aggiornamento di un tentativo webhook esistente
 */
export interface UpdateTentativoWebhookDTO {
  webhook_id?: string;
  payload_id?: string;
  numero_tentativo?: number;
  stato?: STATO_TENTATIVO_WEBHOOK;
  http_status?: number;
  response_body?: string;
  messaggio_errore?: string;
  durata_ms?: number;
}

/**
 * DTO per la risposta con i dati del tentativo webhook
 */
export interface TentativoWebhookResponseDTO {
  id: string;
  webhook_id: string;
  payload_id: string;
  numero_tentativo: number;
  stato: STATO_TENTATIVO_WEBHOOK;
  http_status?: number;
  response_body?: string;
  messaggio_errore?: string;
  durata_ms: number;
  createdat: Date;
}

/**
 * DTO per i filtri di ricerca tentativi webhook
 */
export interface TentativoWebhookFiltersDTO {
  webhook_id?: string;
  payload_id?: string;
  stato?: STATO_TENTATIVO_WEBHOOK;
  numero_tentativo?: number;
  data_creazione_da?: Date;
  data_creazione_a?: Date;
  data_aggiornamento_da?: Date;
  data_aggiornamento_a?: Date;
  limit?: number;
  offset?: number;
  order_by?: 'createdat' | 'numero_tentativo' | 'durata_ms';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei tentativi webhook
 */
export interface TentativoWebhookPaginatedResponseDTO {
  tentativi_webhook: TentativoWebhookResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei tentativi webhook
 */
export interface TentativoWebhookStatsDTO {
  total_tentativi: number;
  tentativi_riusciti: number;
  tentativi_falliti: number;
  per_stato: Record<STATO_TENTATIVO_WEBHOOK, number>;
  per_webhook: Array<{ webhook_id: string; count: number; success_rate: number }>;
  durata_media_ms: number;
  ultimi_tentativi: TentativoWebhookResponseDTO[];
}

/**
 * DTO per l'importazione di tentativi webhook
 */
export interface ImportTentativoWebhookDTO {
  tentativi_webhook: CreateTentativoWebhookDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportTentativoWebhookResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * DTO per la ricerca di tentativi per webhook
 */
export interface SearchTentativoByWebhookDTO {
  webhook_id_tentativo: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tentativi per payload
 */
export interface SearchTentativoByPayloadDTO {
  payload_id_tentativo: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tentativi per stato
 */
export interface SearchTentativoByStatoDTO {
  stato_tentativo: STATO_TENTATIVO_WEBHOOK;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tentativi falliti
 */
export interface SearchTentativoFallitiDTO {
  webhook_id_tentativo?: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per la ricerca di tentativi riusciti
 */
export interface SearchTentativoRiuscitiDTO {
  webhook_id_tentativo?: string;
  limit?: number;
  offset?: number;
}

/**
 * DTO per le statistiche di performance dei webhook
 */
export interface WebhookPerformanceStatsDTO {
  webhook_id: string;
  total_tentativi: number;
  success_rate: number;
  durata_media_ms: number;
  durata_min_ms: number;
  durata_max_ms: number;
  errori_comuni: Array<{ errore: string; count: number }>;
  ultimi_10_tentativi: TentativoWebhookResponseDTO[];
} 