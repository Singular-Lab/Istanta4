import { EVENTI_WEBHOOK, STATO_WEBHOOK } from '../../../lib/enums';

/**
 * DTO per la creazione di un nuovo webhook
 */
export interface CreateWebhookDTO {
  nome: string;
  descrizione?: string;
  url: string;
  eventi: EVENTI_WEBHOOK[];
  stato?: STATO_WEBHOOK;
  secret?: string;
  timeout?: number;
  retry_count?: number;
  retry_delay?: number;
  headers_personalizzati?: Record<string, string>;
  createdby: string;
}

/**
 * DTO per l'aggiornamento di un webhook esistente
 */
export interface UpdateWebhookDTO {
  nome?: string;
  descrizione?: string;
  url?: string;
  eventi?: EVENTI_WEBHOOK[];
  stato?: STATO_WEBHOOK;
  secret?: string;
  timeout?: number;
  retry_count?: number;
  retry_delay?: number;
  headers_personalizzati?: Record<string, string>;
}

/**
 * DTO per la risposta con i dati del webhook
 */
export interface WebhookResponseDTO {
  id: string;
  nome: string;
  descrizione?: string;
  url: string;
  eventi: EVENTI_WEBHOOK[];
  stato: STATO_WEBHOOK;
  timeout: number;
  retry_count: number;
  retry_delay: number;
  headers_personalizzati?: Record<string, string>;
  createdat: Date;
  updatedat: Date;
  createdby: string;
  is_active?: boolean;
  total_tentativi?: number;
  success_rate?: number;
  last_execution?: Date;
}

/**
 * DTO per i filtri di ricerca webhook
 */
export interface WebhookFiltersDTO {
  stato?: STATO_WEBHOOK;
  eventi?: EVENTI_WEBHOOK[];
  createdby?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order_by?: 'nome' | 'createdat' | 'updatedat';
  order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata dei webhook
 */
export interface WebhookPaginatedResponseDTO {
  webhooks: WebhookResponseDTO[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * DTO per le statistiche dei webhook
 */
export interface WebhookStatsDTO {
  totals: number;
  webhooks_attivi: number;
  webhooks_inattivi: number;
  per_stato: Record<STATO_WEBHOOK, number>;
  per_evento: Record<EVENTI_WEBHOOK, number>;
  success_rate_medio: number;
  webhooks_con_errori: number;
}

/**
 * DTO per il test di un webhook
 */
export interface TestWebhookDTO {
  id: string;
  payload?: any;
  event_type?: EVENTI_WEBHOOK;
}

/**
 * DTO per la risposta del test webhook
 */
export interface TestWebhookResponseDTO {
  success: boolean;
  status_code?: number;
  response_time?: number;
  response_body?: string;
  error?: string;
}

/**
 * DTO per l'attivazione/disattivazione di un webhook
 */
export interface ToggleWebhookDTO {
  id: string;
  stato: STATO_WEBHOOK;
}

/**
 * DTO per la duplicazione di un webhook
 */
export interface DuplicateWebhookDTO {
  id: string;
  nuovo_nome?: string;
  nuovo_url?: string;
}

/**
 * DTO per l'importazione di webhook
 */
export interface ImportWebhookDTO {
  webhooks: CreateWebhookDTO[];
  skip_duplicates?: boolean;
  update_existing?: boolean;
}

/**
 * DTO per la risposta dell'importazione
 */
export interface ImportWebhookResponseDTO {
  total_imported: number;
  total_skipped: number;
  total_updated: number;
  errors: Array<{ row: number; error: string }>;
} 