/**
 * DTO per i Filter Template
 * Questi DTO sono condivisi tra frontend e backend
 */

/**
 * Tipo di endpoint supportato
 */
export type FilterTemplateEndpointType = 'refs' | 'refs-html' | 'files';

/**
 * Tipo di rendering supportato
 */
export type FilterTemplateRenderType = 'carousel' | 'grid';

/**
 * Opzioni di visualizzazione per il plugin
 */
export interface FilterTemplateDisplayOptionsDTO {
  autoScroll: boolean;
  scrollSpeed: number;
  showIndicators: boolean;
  showNavButtons: boolean;
}

/**
 * Operatori supportati per le condizioni di filtro
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in';

/**
 * Singola condizione di filtro
 */
export interface FilterConditionDTO {
  field: string;
  operator: FilterOperator;
  value: string;
  priority?: number;
}

/**
 * DTO per la risposta di un FilterTemplate
 */
export interface FilterTemplateDTO {
  id_filter_template: string;
  nome: string;
  slug: string;
  descrizione: string | null;
  parent_template_id: string | null;
  template_ids: string[];
  export_codes: string[];
  filters: FilterConditionDTO[][];
  endpoint_type: FilterTemplateEndpointType;
  render_type?: FilterTemplateRenderType;
  // Opzioni di visualizzazione per il plugin
  auto_scroll: boolean;
  scroll_speed: number;
  show_indicators: boolean;
  show_nav_buttons: boolean;
  meta_options: Record<string, unknown>;
  is_active: boolean;
  is_latest: boolean;
  deleted_at: string | null;
  creatore?: {
    id: string;
    nome: string;
    cognome: string;
  };
  version: number;
  createdat: string;
  updatedat: string;
}

/**
 * DTO per la creazione di un FilterTemplate
 */
export interface CreateFilterTemplateDTO {
  nome: string;
  slug: string;
  descrizione?: string;
  template_ids?: string[];
  export_codes?: string[];
  filters: FilterConditionDTO[][];
  endpoint_type: FilterTemplateEndpointType;
  render_type?: FilterTemplateRenderType;
  // Opzioni di visualizzazione per il plugin (con defaults)
  auto_scroll?: boolean;
  scroll_speed?: number;
  show_indicators?: boolean;
  show_nav_buttons?: boolean;
  meta_options?: Record<string, unknown>;
}

/**
 * DTO per l'aggiornamento di un FilterTemplate
 */
export interface UpdateFilterTemplateDTO {
  nome?: string;
  slug?: string;
  descrizione?: string;
  template_ids?: string[];
  export_codes?: string[];
  filters?: FilterConditionDTO[][];
  endpoint_type?: FilterTemplateEndpointType;
  render_type?: FilterTemplateRenderType;
  // Opzioni di visualizzazione per il plugin
  auto_scroll?: boolean;
  scroll_speed?: number;
  show_indicators?: boolean;
  show_nav_buttons?: boolean;
  meta_options?: Record<string, unknown>;
  is_active?: boolean;
}

export interface FilterTemplateVersionDTO {
  id_filter_template: string;
  version: number;
  nome: string;
  is_active: boolean;
  is_latest: boolean;
  deleted_at: string | null;
  createdat: string;
}

export interface FilterTemplateVersionHistoryDTO {
  slug: string;
  total_versions: number;
  current_version: FilterTemplateDTO;
  versions: FilterTemplateVersionDTO[];
}

/**
 * DTO per la risposta di una lista di FilterTemplate
 */
export interface FilterTemplateListResponseDTO {
  templates: FilterTemplateDTO[];
  totale: number;
}

/**
 * DTO per la validazione dello slug
 */
export interface SlugValidationResponseDTO {
  available: boolean;
  suggestion?: string;
}
