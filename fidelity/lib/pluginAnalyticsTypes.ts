/**
 * Plugin Analytics Event Tracking - Shared Types
 *
 * Schema condiviso tra plugin (client) e server per gli eventi di analytics.
 * Il plugin duplica queste definizioni inline (zero-dependency),
 * ma questo file e' la source of truth per il server.
 */

// ---- Event Types ----

export enum PluginEventType {
  // Lifecycle
  PLUGIN_INIT = 'plugin:init',
  PLUGIN_DESTROY = 'plugin:destroy',
  PLUGIN_ERROR = 'plugin:error',

  // Rendering
  RENDER_START = 'render:start',
  RENDER_COMPLETE = 'render:complete',

  // Impressions (IntersectionObserver)
  ITEM_IMPRESSION = 'item:impression',

  // Interactions
  ITEM_CLICK = 'item:click',
  CAROUSEL_SLIDE = 'carousel:slide',
  CAROUSEL_NAV = 'carousel:nav_click',

  // Engagement
  SCROLL_DEPTH = 'engagement:scroll_depth',
  DWELL_TIME = 'engagement:dwell',

  // Session
  SESSION_END = 'session:end',

  // Global page-level tracking
  GLOBAL_CLICK = 'global:click',
  GLOBAL_SCROLL = 'global:scroll',
}

// ---- Viewport Context (presente in ogni evento per replay) ----

export interface PluginAnalyticsViewport {
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  documentWidth: number;
  documentHeight: number;
}

// ---- Event Payload ----

export interface PluginAnalyticsEvent {
  /** Client-generated UUID v4 */
  eventId: string;
  /** Event type */
  type: PluginEventType;
  /** ISO-8601 timestamp (client-side) */
  timestamp: string;
  /** Plugin slug (identifica la configurazione di embedding) */
  slug: string;
  /** Plugin version */
  fpVersion: string;
  /** Page origin (location.origin, no query per privacy) */
  pageOrigin: string;
  /** Page path (location.pathname, no query per privacy) */
  pagePath: string;
  /** Session ID - random per page-load, non un cookie */
  sessionId: string;
  /** Numero di sequenza monotonicamente crescente per sessione (replay ordering) */
  sequence: number;
  /** Stato del viewport al momento dell'evento (replay context) */
  viewport: PluginAnalyticsViewport;
  /** Payload specifico per tipo di evento */
  data?: Record<string, unknown>;
}

// ---- Typed Event Payloads ----

/** Rect data di un elemento (coordinate viewport + assolute) */
export interface PluginElementRect {
  x: number;
  y: number;
  absoluteX: number;
  absoluteY: number;
  width: number;
  height: number;
}

/** Payload per item:click — click su un item FP (referenza) */
export interface ItemClickPayload extends PluginElementRect {
  /** ID dell'item (es. "ref-0", "ref-1") */
  itemId: string;
  /** Codice referenza dell'item — sempre presente */
  codiceRef: string;
  /** Tag HTML dell'elemento cliccato (il target diretto) */
  tagName: string;
  /** Coordinate mouse al momento del click */
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  /** Tag HTML dell'elemento interno cliccato */
  innerTagName: string;
  /** Classi CSS dell'elemento cliccato (max 100 char) */
  innerClassName?: string;
  /** Percorso DOM fino all'elemento cliccato (max 5 livelli) */
  domPath: string;
  /** Tipo di elemento rilevato (link, button, image, etc.) */
  elementType: string;
}

/** Payload per item:impression — item visibile all'utente */
export interface ItemImpressionPayload extends PluginElementRect {
  /** ID dell'item */
  itemId: string;
  /** Codice referenza dell'item — sempre presente */
  codiceRef: string;
  /** Tempo di permanenza in viewport (ms) */
  dwellMs: number;
  /** Tipo di elemento */
  elementType: string;
}

/** Payload per global:click — click su qualsiasi elemento della pagina (esclusi item FP) */
export interface GlobalClickPayload extends PluginElementRect {
  /** Coordinate mouse */
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  /** Tag HTML dell'elemento cliccato */
  tagName: string;
  /** ID dell'elemento (se presente) */
  id?: string;
  /** Classi CSS dell'elemento (max 100 char) */
  className?: string;
  /** Snippet di testo dell'elemento (max 50 char, sanitizzato) */
  textSnippet?: string;
  /** Percorso DOM fino all'elemento (max 5 livelli) */
  domPath: string;
  /** Tipo di elemento rilevato */
  elementType: string;
  /** Contesto carousel (swiper, slick, splide, etc.) se applicabile */
  carouselContext?: string;
}

/** Payload per global:scroll — profondità di scroll della pagina */
export interface GlobalScrollPayload {
  scrollTop: number;
  viewportHeight: number;
  documentHeight: number;
  /** Percentuale di profondità raggiunta */
  depthPercent: number;
  /** Bucket di profondità (10, 25, 50, 75, 90, 100) */
  depthBucket: number;
}

/** Payload per render:complete */
export interface RenderCompletePayload {
  mode: string;
  type: string;
  durationMs: number;
}

// ---- Wire Protocol (Plugin → Server) ----

export interface PluginWsMessage {
  /** Message type */
  type: 'events:batch' | 'ping' | 'session:resume';
  /** Batch of events (per type: 'events:batch') */
  events?: PluginAnalyticsEvent[];
  /** Session ID (per type: 'session:resume') */
  sessionId?: string;
}

// ---- Wire Protocol (Server → Plugin) ----

export interface PluginWsServerMessage {
  /** Message type */
  type: 'ack' | 'error' | 'pong' | 'session:resumed';
  /** Numero di eventi confermati (per type: 'ack') */
  count?: number;
  /** Messaggio errore (per type: 'error') */
  message?: string;
  /** Ultimo numero di sequenza trovato (per type: 'session:resumed') */
  lastSequence?: number;
  /** Indica se la sessione è stata considerata scaduta (>1 giorno) */
  expired?: boolean;
}

// ---- DB Row (server-side, snake_case per PostgreSQL) ----

export interface PluginAnalyticsEventRow {
  event_id: string;
  event_type: string;
  timestamp_event: Date;
  slug: string;
  fp_version: string;
  page_origin: string;
  page_path: string;
  session_id: string;
  sequence: number;
  viewport: PluginAnalyticsViewport | null;
  ip_address: string;
  user_agent: string;
  event_data: Record<string, unknown> | null;
}
