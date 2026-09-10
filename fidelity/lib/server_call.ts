
// Import delle classi di errore dal sistema client
import {
  BadRequestError,
  BusinessError,
  DatabaseError,
  ErrorCodes,
  ErrorSource,
  ExternalApiError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError
} from './errors';

/**
 * Interfaccia per gli errori che arrivano dal server
 * Mantiene compatibilità con il sistema di errori del backend
 */
export interface ServerError {
  name: string;
  message: string;
  code: string;
  httpStatus: number;
  source: ErrorSource;
  details?: Record<string, unknown>;
  timestamp?: string;
  cause?: ServerError;
  additionalData?: any;
  i18nKey?: string;
  stack?: string;
}

/**
 * Tipi di errore per una migliore gestione lato client
 */
export enum ClientErrorType {
  NETWORK = 'network',
  SERVER = 'server',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  BUSINESS_LOGIC = 'business_logic',
  INFRASTRUCTURE = 'infrastructure',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}

/**
 * Interfaccia per errori client con informazioni aggiuntive
 */
export interface ClientError extends ServerError {
  clientType: ClientErrorType;
  isRetryable: boolean;
  userMessage?: string;
  actionRequired?: string;
}

/**
 * Interfaccia per i dati di errore precisi restituiti dal client
 */
export interface PreciseErrorData {
  // Informazioni essenziali dell'errore
  name: string;
  message: string;
  code: string;
  httpStatus: number;
  source: ErrorSource;

  // Informazioni client-specifiche
  clientType: ClientErrorType;
  isRetryable: boolean;
  userMessage?: string;
  actionRequired?: string;

  // Dettagli specifici dell'errore
  details?: Record<string, unknown>;
  timestamp: string;

  // Informazioni aggiuntive per debugging
  stack?: string;
  i18nKey?: string;
}

/**
 * Classe per gestire gli errori lato client
 * Estende ServerError con funzionalità client-specifiche
 */
export class CustomError extends Error implements ClientError, PreciseErrorData {
  readonly code: string;
  readonly httpStatus: number;
  readonly source: ErrorSource;
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;
  readonly cause?: ServerError;
  readonly additionalData?: any;
  readonly i18nKey?: string;
  readonly stack?: string;

  // Proprietà client-specifiche
  readonly clientType: ClientErrorType;
  readonly isRetryable: boolean;
  readonly userMessage?: string;
  readonly actionRequired?: string;

  constructor(error: ServerError | ClientError) {
    super(error.message);
    this.name = error.name;
    this.code = error.code;
    this.httpStatus = error.httpStatus;
    this.source = error.source;
    this.details = error.details;
    this.timestamp = error.timestamp || new Date().toISOString();
    this.cause = error.cause;
    this.additionalData = error.additionalData;
    this.i18nKey = error.i18nKey;
    this.stack = error.stack;

    // Determina il tipo di errore client e le proprietà aggiuntive
    const errorAnalysis = this.analyzeError(error);
    this.clientType = errorAnalysis.clientType;
    this.isRetryable = errorAnalysis.isRetryable;
    this.userMessage = errorAnalysis.userMessage;
    this.actionRequired = errorAnalysis.actionRequired;
  }

  /**
   * Analizza l'errore per determinare tipo client e proprietà aggiuntive
   */
  private analyzeError(error: ServerError | ClientError): {
    clientType: ClientErrorType;
    isRetryable: boolean;
    userMessage?: string;
    actionRequired?: string;
  } {
    // Se è già un ClientError, usa le sue proprietà
    if ('clientType' in error) {
      return {
        clientType: error.clientType,
        isRetryable: error.isRetryable,
        userMessage: error.userMessage,
        actionRequired: error.actionRequired
      };
    }

    // Analizza l'errore basandosi su codice, status e source
    const { clientType, isRetryable, userMessage, actionRequired } = this.determineErrorProperties(error);

    return { clientType, isRetryable, userMessage, actionRequired };
  }

  /**
   * Determina le proprietà dell'errore basandosi sui suoi attributi
   */
  private determineErrorProperties(error: ServerError): {
    clientType: ClientErrorType;
    isRetryable: boolean;
    userMessage?: string;
    actionRequired?: string;
  } {
    // Mappa dei codici di errore comuni
    const errorCodeMap: Record<string, ClientErrorType> = {
      // Domain & User
      'DOM_001': ClientErrorType.VALIDATION,
      'DOM_002': ClientErrorType.BUSINESS_LOGIC,
      'USR_001': ClientErrorType.NOT_FOUND,
      'USR_002': ClientErrorType.BUSINESS_LOGIC,
      'USR_003': ClientErrorType.AUTHENTICATION,

      // Application
      'APP_001': ClientErrorType.VALIDATION,
      'APP_002': ClientErrorType.AUTHENTICATION,
      'APP_003': ClientErrorType.AUTHORIZATION,
      'APP_004': ClientErrorType.RATE_LIMIT,

      // Infrastructure
      'INF_001': ClientErrorType.INFRASTRUCTURE,
      'INF_002': ClientErrorType.INFRASTRUCTURE,
      'INF_003': ClientErrorType.NETWORK,
      'INF_004': ClientErrorType.INFRASTRUCTURE,
      'INF_005': ClientErrorType.INFRASTRUCTURE,

      // Promotions
      'PRM_001': ClientErrorType.NOT_FOUND,
      'PRM_002': ClientErrorType.BUSINESS_LOGIC,
      'PRM_003': ClientErrorType.BUSINESS_LOGIC,

      // WhatsApp
      'WA_001': ClientErrorType.BUSINESS_LOGIC,
      'WA_002': ClientErrorType.NOT_FOUND,
      'WA_003': ClientErrorType.BUSINESS_LOGIC,
      'WA_004': ClientErrorType.NOT_FOUND,
      'WA_005': ClientErrorType.NOT_FOUND,
      'WA_006': ClientErrorType.BUSINESS_LOGIC,

      // Design Kit
      'KIT_001': ClientErrorType.NOT_FOUND,
      'KIT_002': ClientErrorType.BUSINESS_LOGIC,
      'KIT_003': ClientErrorType.BUSINESS_LOGIC,
      'KIT_004': ClientErrorType.BUSINESS_LOGIC,
      'KIT_005': ClientErrorType.BUSINESS_LOGIC,

      // Runtime Kit
      'RTK_001': ClientErrorType.NOT_FOUND,
      'RTK_002': ClientErrorType.BUSINESS_LOGIC,
      'RTK_003': ClientErrorType.BUSINESS_LOGIC,

      // File Management
      'FIL_001': ClientErrorType.NOT_FOUND,
      'FIL_002': ClientErrorType.INFRASTRUCTURE,
      'FIL_003': ClientErrorType.VALIDATION,
      'FIL_004': ClientErrorType.VALIDATION,

      // Print Orders
      'ORD_001': ClientErrorType.NOT_FOUND,
      'ORD_002': ClientErrorType.BUSINESS_LOGIC,

      // Referenze
      'REF_001': ClientErrorType.NOT_FOUND,
      'REF_002': ClientErrorType.VALIDATION,

      // Configuration
      'CFG_001': ClientErrorType.NOT_FOUND,
      'CFG_002': ClientErrorType.VALIDATION,

      // Ephemeral Token
      'EPH_001': ClientErrorType.AUTHENTICATION,
      'EPH_002': ClientErrorType.AUTHENTICATION,
      'EPH_003': ClientErrorType.AUTHENTICATION,
      'EPH_004': ClientErrorType.AUTHORIZATION,
      'EPH_005': ClientErrorType.AUTHENTICATION,

      // CSRF / Security
      'SEC_001': ClientErrorType.AUTHORIZATION,
      'SEC_002': ClientErrorType.AUTHORIZATION,
      'SEC_003': ClientErrorType.AUTHORIZATION,

      // OIDC
      'OIDC_001': ClientErrorType.INFRASTRUCTURE,
      'OIDC_002': ClientErrorType.INFRASTRUCTURE,

      // GPT / AI
      'AI_001': ClientErrorType.INFRASTRUCTURE,
      'AI_002': ClientErrorType.RATE_LIMIT,

      // GDO
      'GDO_001': ClientErrorType.NOT_FOUND,

      // Email
      'EML_001': ClientErrorType.INFRASTRUCTURE,
      'EML_002': ClientErrorType.AUTHENTICATION,
      'EML_003': ClientErrorType.AUTHENTICATION,

      // Formato / Naming / TipoExport
      'FMT_001': ClientErrorType.NOT_FOUND,
      'NMC_001': ClientErrorType.NOT_FOUND,
      'TEX_001': ClientErrorType.NOT_FOUND,

      // WebPliant
      'WPL_001': ClientErrorType.NOT_FOUND,

      // Punto Vendita
      'PV_001': ClientErrorType.NOT_FOUND,
      'PV_002': ClientErrorType.VALIDATION,

      // Area / Canale
      'ARC_001': ClientErrorType.NOT_FOUND,
      'ARC_002': ClientErrorType.NOT_FOUND,

      // Tracciato
      'TRC_001': ClientErrorType.NOT_FOUND,
      'TRC_002': ClientErrorType.VALIDATION,

      // Webhook
      'WHK_001': ClientErrorType.NOT_FOUND,
      'WHK_002': ClientErrorType.INFRASTRUCTURE,

      // Contratto / Raccoglitore / Attivita / Menu
      'CTR_001': ClientErrorType.NOT_FOUND,
      'RCK_001': ClientErrorType.NOT_FOUND,
      'ATV_001': ClientErrorType.NOT_FOUND,
      'MNU_001': ClientErrorType.NOT_FOUND,
      'MNU_002': ClientErrorType.INFRASTRUCTURE,
    };

    // Determina il tipo di errore
    let clientType = errorCodeMap[error.code] || ClientErrorType.UNKNOWN;

    // Override basato su HTTP status se più specifico
    if (error.httpStatus === 401) clientType = ClientErrorType.AUTHENTICATION;
    else if (error.httpStatus === 403) clientType = ClientErrorType.AUTHORIZATION;
    else if (error.httpStatus === 404) clientType = ClientErrorType.NOT_FOUND;
    else if (error.httpStatus === 422) clientType = ClientErrorType.VALIDATION;
    else if (error.httpStatus === 429) clientType = ClientErrorType.RATE_LIMIT;
    else if (error.httpStatus >= 500) clientType = ClientErrorType.INFRASTRUCTURE;

    // Determina se l'errore è retryable
    const isRetryable = this.isErrorRetryable(error);

    // Genera messaggi utente appropriati
    const userMessage = this.generateUserMessage(error, clientType);
    const actionRequired = this.determineActionRequired(error, clientType);

    return { clientType, isRetryable, userMessage, actionRequired };
  }

  /**
   * Determina se un errore può essere ritentato
   */
  private isErrorRetryable(error: ServerError): boolean {
    // Errori di rete e infrastruttura sono generalmente retryable
    if (error.source === ErrorSource.INFRASTRUCTURE) {
      return error.httpStatus >= 500 || error.code.includes('NETWORK');
    }

    // Errori di autenticazione e autorizzazione non sono retryable
    if (error.httpStatus === 401 || error.httpStatus === 403) {
      return false;
    }

    // Errori di validazione non sono retryable
    if (error.httpStatus === 422 || error.code.includes('VALIDATION')) {
      return false;
    }

    // Errori 5xx sono generalmente retryable
    return error.httpStatus >= 500;
  }

  /**
   * Genera un messaggio utente appropriato
   */
  private generateUserMessage(error: ServerError, clientType: ClientErrorType): string {
    const messages: Record<ClientErrorType, string> = {
      [ClientErrorType.NETWORK]: 'Problema di connessione. Verifica la tua connessione internet.',
      [ClientErrorType.AUTHENTICATION]: 'Sessione scaduta. Effettua nuovamente l\'accesso.',
      [ClientErrorType.AUTHORIZATION]: 'Non hai i permessi per eseguire questa operazione.',
      [ClientErrorType.NOT_FOUND]: 'La risorsa richiesta non è stata trovata.',
      [ClientErrorType.VALIDATION]: 'I dati inseriti non sono validi. Controlla i campi evidenziati.',
      [ClientErrorType.BUSINESS_LOGIC]: 'Operazione non consentita. Verifica i dati e riprova.',
      [ClientErrorType.INFRASTRUCTURE]: 'Errore del server. Riprova tra qualche minuto.',
      [ClientErrorType.SERVER]: 'Errore del server. Riprova tra qualche minuto.',
      [ClientErrorType.RATE_LIMIT]: this.getRateLimitMessage(error),
      [ClientErrorType.UNKNOWN]: 'Si è verificato un errore imprevisto.'
    };

    return messages[clientType] || error.message;
  }

  /**
   * Genera un messaggio specifico per rate limiting
   */
  private getRateLimitMessage(error: ServerError): string {
    const limitType = error.details?.limitType as string;
    const retryAfter = error.details?.retryAfter as number;

    const messages = {
      auth: 'Troppi tentativi di accesso. Riprova tra qualche minuto.',
      registration: 'Troppi tentativi di registrazione. Riprova tra qualche minuto.',
      password_reset: 'Troppi tentativi di reset password. Riprova tra qualche minuto.',
      api: 'Troppe richieste. Riprova tra qualche minuto.',
      custom: 'Limite di richieste superato. Riprova tra qualche minuto.'
    };

    let message = messages[limitType as keyof typeof messages] || messages.custom;

    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      message += ` Aspetta ${minutes} minuto${minutes > 1 ? 'i' : ''} prima di riprovare.`;
    }

    return message;
  }

  /**
   * Determina l'azione richiesta dall'utente
   */
  private determineActionRequired(error: ServerError, clientType: ClientErrorType): string | undefined {
    const actions: Record<ClientErrorType, string> = {
      [ClientErrorType.NETWORK]: 'Verifica la connessione e riprova',
      [ClientErrorType.AUTHENTICATION]: 'Effettua nuovamente l\'accesso',
      [ClientErrorType.AUTHORIZATION]: 'Contatta l\'amministratore per i permessi',
      [ClientErrorType.NOT_FOUND]: 'Verifica che la risorsa esista',
      [ClientErrorType.VALIDATION]: 'Correggi i dati e riprova',
      [ClientErrorType.BUSINESS_LOGIC]: 'Verifica i dati e riprova',
      [ClientErrorType.INFRASTRUCTURE]: 'Riprova tra qualche minuto',
      [ClientErrorType.SERVER]: 'Riprova tra qualche minuto',
      [ClientErrorType.RATE_LIMIT]: this.getRateLimitAction(error),
      [ClientErrorType.UNKNOWN]: 'Contatta il supporto tecnico'
    };

    return actions[clientType];
  }

  /**
   * Genera un'azione specifica per rate limiting
   */
  private getRateLimitAction(error: ServerError): string {
    const limitType = error.details?.limitType as string;
    const retryAfter = error.details?.retryAfter as number;

    const actions = {
      auth: 'Aspetta qualche minuto prima di riprovare l\'accesso',
      registration: 'Aspetta qualche minuto prima di riprovare la registrazione',
      password_reset: 'Aspetta qualche minuto prima di riprovare il reset password',
      api: 'Aspetta qualche minuto prima di riprovare',
      custom: 'Aspetta qualche minuto prima di riprovare'
    };

    let action = actions[limitType as keyof typeof actions] || actions.custom;

    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      action = `Aspetta ${minutes} minuto${minutes > 1 ? 'i' : ''} prima di riprovare`;
    }

    return action;
  }

  /**
   * Verifica se l'errore è di un tipo specifico
   */
  public isType(type: ClientErrorType): boolean {
    return this.clientType === type;
  }

  /**
   * Verifica se l'errore è retryable
   */
  public canRetry(): boolean {
    return this.isRetryable;
  }

  /**
   * Ottiene il messaggio utente appropriato
   */
  public getUserMessage(): string {
    return this.userMessage || this.message;
  }

  /**
   * Ottiene l'azione richiesta
   */
  public getActionRequired(): string | undefined {
    return this.actionRequired;
  }

  /**
   * Converte l'errore in un oggetto JSON serializzabile
   */
  toJSON(): ClientError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      source: this.source,
      details: this.details,
      timestamp: this.timestamp,
      cause: this.cause,
      additionalData: this.additionalData,
      i18nKey: this.i18nKey,
      stack: this.stack,
      clientType: this.clientType,
      isRetryable: this.isRetryable,
      userMessage: this.userMessage,
      actionRequired: this.actionRequired
    };
  }

  /**
   * Restituisce i dati di errore precisi
   */
  getPreciseErrorData(): PreciseErrorData {
    return {
      // Informazioni essenziali
      name: this.name,
      message: this.message,
      code: this.code,
      httpStatus: this.httpStatus,
      source: this.source,

      // Informazioni client-specifiche
      clientType: this.clientType,
      isRetryable: this.isRetryable,
      userMessage: this.userMessage || this.message,
      actionRequired: this.actionRequired,

      // Dettagli specifici
      details: this.details,
      timestamp: this.timestamp,

      // Informazioni aggiuntive
      stack: this.stack,
      i18nKey: this.i18nKey
    };
  }
}

enum Methods {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
  PATCH = 'PATCH'
}

class ServerCall {
  /**
   * Callback globale per intercettare errori 401
   * L'HOC withSessionCheck registra qui la propria callback per gestire UI
   */
  private static onUnauthorizedCallback: ((istantaRequired?: boolean) => void) | null = null;

  /**
   * Flag per prevenire azioni multiple sulla stessa scadenza sessione
   */
  private static sessionExpiredHandled = false;

  /**
   * Permette di impostare una callback globale per intercettare errori 401
   * Tipicamente chiamato dall'HOC withSessionCheck al mount
   */
  public static setOnUnauthorizedCallback(cb: (istantaRequired?: boolean) => void) {
    this.onUnauthorizedCallback = cb;
  }

  /**
   * Reset del flag di sessione scaduta
   * Chiamato quando l'utente fa un nuovo login
   */
  public static resetSessionExpiredFlag() {
    this.sessionExpiredHandled = false;
  }

  /**
   * Gestisce automaticamente gli errori 401 in modo coordinato con l'HOC
   *
   * RESPONSABILITÀ:
   * 1. Salva URL corrente per redirect post-login
   * 2. Notifica altre tab via localStorage
   * 3. Delega gestione UI alla callback dell'HOC (se presente)
   * 4. Fallback a redirect diretto se nessun HOC è attivo
   *
   * IMPORTANTE: Non blocca la propagazione dell'errore
   */
  private static handleUnauthorized(istantaRequired?: boolean) {
    // Previeni azioni duplicate sulla stessa scadenza
    if (this.sessionExpiredHandled) return;

    this.sessionExpiredHandled = true;

    // 1. SALVA CONTESTO per redirect post-login
    if (typeof window !== 'undefined' && window.location) {
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;

      // Non salvare la pagina di login stessa
      if (currentPath !== '/login') {
        localStorage.setItem('redirect_after_login', currentPath + currentSearch);
      }

      // 2. NOTIFICA ALTRE TAB della scadenza sessione
      // Usa timestamp per evitare problemi con storage event
      localStorage.setItem('session_expired', Date.now().toString());

      // 3. Segna se il login deve avvenire tramite Istanta
      if (istantaRequired) {
        localStorage.setItem('istanta_login_required', '1');
      } else {
        localStorage.removeItem('istanta_login_required');
      }
    }

    // 4. DELEGA GESTIONE UI alla callback HOC (se presente)
    if (typeof this.onUnauthorizedCallback === 'function') {
      // L'HOC gestirà: dialog, stati React, eventuale redirect
      this.onUnauthorizedCallback(istantaRequired);
    } else {
      // 5. FALLBACK: redirect diretto se nessun HOC attivo
      // Questo accade solo in pagine senza withSessionCheck
      if (typeof window !== 'undefined' && window.location) {
        const reason = istantaRequired ? 'istanta_required' : 'session_expired';
        window.location.href = `/login?reason=${reason}`;
      }
    }
  }

  //@ts-ignore
  private static baseUrl = import.meta.env.VITE_API_URL as string;
  private static csrfBootstrapPromise: Promise<string | null> | null = null;

  static getUrl(): string {
    return this.baseUrl;
  }

  /**
   * Ottiene il token CSRF dal cookie
   */
  public static getCSRFToken(): string | null {
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));

    if (csrfCookie) {
      const rawToken = csrfCookie.split('=')[1];
      try {
        return decodeURIComponent(rawToken);
      } catch {
        return rawToken;
      }
    }

    return null;
  }

  /**
   * Bootstrap lazy del token CSRF.
   * Viene chiamato automaticamente prima delle richieste mutative se il cookie non esiste.
   */
  public static async ensureCSRFToken(forceRefresh = false): Promise<string | null> {
    if (typeof document === 'undefined') {
      return null;
    }

    const existingToken = this.getCSRFToken();
    if (existingToken && !forceRefresh) {
      return existingToken;
    }

    if (!forceRefresh && this.csrfBootstrapPromise) {
      return this.csrfBootstrapPromise;
    }

    this.csrfBootstrapPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/csrf-token`, {
          method: Methods.GET,
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          return null;
        }

        const payload = await response.json().catch(() => null);
        return this.getCSRFToken() || payload?.csrfToken || null;
      } catch {
        return null;
      } finally {
        this.csrfBootstrapPromise = null;
      }
    })();

    return this.csrfBootstrapPromise;
  }

  private static isCsrfError(status: number, errorPayload: any): boolean {
    if (status !== 403 || !errorPayload) {
      return false;
    }

    const code = errorPayload?.code || errorPayload?.details?.errorCode;
    if (
      code === ErrorCodes.CSRF_TOKEN_MISSING ||
      code === ErrorCodes.CSRF_TOKEN_INVALID ||
      code === ErrorCodes.CSRF_TOKEN_EXPIRED
    ) {
      return true;
    }

    const message = String(errorPayload?.message || '').toLowerCase();
    return message.includes('csrf');
  }

  private static async withCsrfRetry(
    request: () => Promise<Response>,
    applyFreshToken: () => void
  ): Promise<Response> {
    let response = await request();
    if (response.status !== 403) {
      return response;
    }

    const csrfErrorPayload = await response.clone().json().catch(() => null);
    if (!this.isCsrfError(response.status, csrfErrorPayload)) {
      return response;
    }

    const refreshedToken = await this.ensureCSRFToken(true);
    if (!refreshedToken) {
      return response;
    }

    applyFreshToken();
    response = await request();
    return response;
  }

  /**
   * Aggiunge headers di sicurezza alle richieste
   */
  private static addSecurityHeaders(headers: Record<string, string> = {}, method: string = 'GET'): Record<string, string> {
    // Aggiungi token CSRF per metodi non-safe
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
    }

    // Aggiungi header per identificare richieste AJAX
    headers['X-Requested-With'] = 'XMLHttpRequest';

    return headers;
  }

  /**
   * Mapping completo degli errori per creare istanze specifiche
   */
  private static createSpecificError(
    error: ServerError,
    originalError?: any
  ): CustomError {
    // Mappa i codici di errore del server alle classi specifiche
    const errorMapping: Record<string, () => CustomError> = {
      // Domain errors
      [ErrorCodes.VALIDATION_FAILED]: () => this.createValidationError(error),
      [ErrorCodes.BUSINESS_RULE_VIOLATION]: () => this.createBusinessError(error),

      // User domain errors
      [ErrorCodes.USER_NOT_FOUND]: () => this.createNotFoundError(error, 'user'),
      [ErrorCodes.USER_ALREADY_EXISTS]: () => this.createBusinessError(error),
      [ErrorCodes.INVALID_CREDENTIALS]: () => this.createUnauthorizedError(error),

      // Application errors
      [ErrorCodes.INVALID_REQUEST]: () => this.createBadRequestError(error),
      [ErrorCodes.UNAUTHORIZED]: () => this.createUnauthorizedError(error),
      [ErrorCodes.FORBIDDEN]: () => this.createForbiddenError(error),
      [ErrorCodes.RATE_LIMIT_EXCEEDED]: () => this.createRateLimitError(error),

      // Infrastructure errors
      [ErrorCodes.DATABASE_ERROR]: () => this.createDatabaseError(error),
      [ErrorCodes.EXTERNAL_API_ERROR]: () => this.createExternalApiError(error),
      [ErrorCodes.NETWORK_ERROR]: () => this.createNetworkError(error),
      [ErrorCodes.CACHE_ERROR]: () => this.createInfrastructureError(error),
      [ErrorCodes.SERVICE_UNAVAILABLE]: () => this.createServiceUnavailableError(error),

      // Promotions
      [ErrorCodes.PROMO_NOT_FOUND]: () => this.createNotFoundError(error, 'promo'),
      [ErrorCodes.PROMO_ALREADY_EXISTS]: () => this.createBusinessError(error),
      [ErrorCodes.PROMO_INVALID_STATE]: () => this.createBusinessError(error),

      // WhatsApp
      [ErrorCodes.WA_CREDENTIALS_MISSING]: () => this.createBusinessError(error),
      [ErrorCodes.WA_TEMPLATE_NOT_FOUND]: () => this.createNotFoundError(error, 'whatsapp_template'),
      [ErrorCodes.WA_CAMPAIGN_FAILED]: () => this.createBusinessError(error),
      [ErrorCodes.WA_NO_USERS_FOUND]: () => this.createNotFoundError(error, 'whatsapp_users'),
      [ErrorCodes.WA_PRESET_NOT_FOUND]: () => this.createNotFoundError(error, 'whatsapp_preset'),
      [ErrorCodes.WA_BROADCAST_FAILED]: () => this.createBusinessError(error),

      // Design Kit
      [ErrorCodes.KIT_NOT_FOUND]: () => this.createNotFoundError(error, 'design_kit'),
      [ErrorCodes.KIT_ALREADY_DELETED]: () => this.createBusinessError(error),
      [ErrorCodes.KIT_ALREADY_PUBLISHED]: () => this.createBusinessError(error),
      [ErrorCodes.KIT_ALREADY_IN_REVISION]: () => this.createBusinessError(error),
      [ErrorCodes.KIT_INVALID_STATE]: () => this.createBusinessError(error),

      // Runtime Kit
      [ErrorCodes.RUNTIME_NOT_FOUND]: () => this.createNotFoundError(error, 'runtime_kit'),
      [ErrorCodes.RUNTIME_ALREADY_DELETED]: () => this.createBusinessError(error),
      [ErrorCodes.RUNTIME_INVALID_STATE]: () => this.createBusinessError(error),

      // File Management
      [ErrorCodes.FILE_NOT_FOUND]: () => this.createNotFoundError(error, 'file'),
      [ErrorCodes.FILE_UPLOAD_FAILED]: () => this.createInfrastructureError(error),
      [ErrorCodes.FILE_INVALID_FORMAT]: () => this.createValidationError(error),
      [ErrorCodes.FILE_GUID_EMPTY]: () => this.createValidationError(error),

      // Print Orders
      [ErrorCodes.ORDER_NOT_FOUND]: () => this.createNotFoundError(error, 'order'),
      [ErrorCodes.ORDER_INVALID_STATE]: () => this.createBusinessError(error),

      // Referenze
      [ErrorCodes.REF_NOT_FOUND]: () => this.createNotFoundError(error, 'referenza'),
      [ErrorCodes.REF_INVALID_DATA]: () => this.createValidationError(error),

      // Configuration
      [ErrorCodes.CONFIG_NOT_FOUND]: () => this.createNotFoundError(error, 'config'),
      [ErrorCodes.CONFIG_INVALID]: () => this.createValidationError(error),

      // Ephemeral Token
      [ErrorCodes.EPH_CHALLENGE_EXPIRED]: () => this.createUnauthorizedError(error),
      [ErrorCodes.EPH_TOKEN_INVALID]: () => this.createUnauthorizedError(error),
      [ErrorCodes.EPH_TOKEN_EXPIRED]: () => this.createUnauthorizedError(error),
      [ErrorCodes.EPH_ORIGIN_DENIED]: () => this.createForbiddenError(error),
      [ErrorCodes.EPH_SIGNATURE_INVALID]: () => this.createUnauthorizedError(error),

      // CSRF / Security
      [ErrorCodes.CSRF_TOKEN_MISSING]: () => this.createForbiddenError(error),
      [ErrorCodes.CSRF_TOKEN_INVALID]: () => this.createForbiddenError(error),
      [ErrorCodes.CSRF_TOKEN_EXPIRED]: () => this.createForbiddenError(error),

      // OIDC
      [ErrorCodes.OIDC_PROVIDER_ERROR]: () => this.createExternalApiError(error),
      [ErrorCodes.OIDC_CALLBACK_FAILED]: () => this.createExternalApiError(error),

      // GPT / AI
      [ErrorCodes.GPT_SERVICE_ERROR]: () => this.createExternalApiError(error),
      [ErrorCodes.GPT_RATE_LIMIT]: () => this.createRateLimitError(error),

      // GDO
      [ErrorCodes.GDO_NOT_FOUND]: () => this.createNotFoundError(error, 'gdo'),

      // Email
      [ErrorCodes.EMAIL_SEND_FAILED]: () => this.createInfrastructureError(error),
      [ErrorCodes.EMAIL_TOKEN_INVALID]: () => this.createUnauthorizedError(error),
      [ErrorCodes.EMAIL_TOKEN_EXPIRED]: () => this.createUnauthorizedError(error),

      // Formato / Naming / TipoExport
      [ErrorCodes.FORMATO_NOT_FOUND]: () => this.createNotFoundError(error, 'formato'),
      [ErrorCodes.NAMING_CONV_NOT_FOUND]: () => this.createNotFoundError(error, 'naming_convention'),
      [ErrorCodes.TIPO_EXPORT_NOT_FOUND]: () => this.createNotFoundError(error, 'tipo_export'),

      // WebPliant
      [ErrorCodes.WPL_WORKSPACE_NOT_FOUND]: () => this.createNotFoundError(error, 'workspace'),

      // Punto Vendita
      [ErrorCodes.PV_NOT_FOUND]: () => this.createNotFoundError(error, 'punto_vendita'),
      [ErrorCodes.PV_INVALID_DATA]: () => this.createValidationError(error),

      // Area / Canale
      [ErrorCodes.AREA_NOT_FOUND]: () => this.createNotFoundError(error, 'area'),
      [ErrorCodes.CANALE_NOT_FOUND]: () => this.createNotFoundError(error, 'canale'),

      // Tracciato
      [ErrorCodes.TRACCIATO_NOT_FOUND]: () => this.createNotFoundError(error, 'tracciato'),
      [ErrorCodes.TRACCIATO_INVALID]: () => this.createValidationError(error),

      // Webhook
      [ErrorCodes.WEBHOOK_NOT_FOUND]: () => this.createNotFoundError(error, 'webhook'),
      [ErrorCodes.WEBHOOK_DELIVERY_FAILED]: () => this.createExternalApiError(error),

      // Contratto Tipografia
      [ErrorCodes.CONTRATTO_NOT_FOUND]: () => this.createNotFoundError(error, 'contratto'),

      // Raccoglitore Kit
      [ErrorCodes.RACCOGLITORE_NOT_FOUND]: () => this.createNotFoundError(error, 'raccoglitore'),

      // Attivita
      [ErrorCodes.ATTIVITA_NOT_FOUND]: () => this.createNotFoundError(error, 'attivita'),

      // Menu
      [ErrorCodes.MENU_NOT_FOUND]: () => this.createNotFoundError(error, 'menu'),
      [ErrorCodes.MENU_CACHE_ERROR]: () => this.createInfrastructureError(error),
    };

    // Prova a mappare l'errore specifico
    const createSpecificError = errorMapping[error.code];
    if (createSpecificError) {
      return createSpecificError();
    }

    // Fallback basato su HTTP status
    return this.createErrorByHttpStatus(error, originalError);
  }

  /**
   * Crea errori specifici basati su HTTP status
   */
  private static createErrorByHttpStatus(error: ServerError, originalError?: any): CustomError {
    switch (error.httpStatus) {
      case 400:
        return this.createBadRequestError(error);
      case 401:
        return this.createUnauthorizedError(error);
      case 403:
        return this.createForbiddenError(error);
      case 404:
        return this.createNotFoundError(error);
      case 422:
        return this.createValidationError(error);
      case 429:
        return this.createRateLimitError(error);
      case 500:
        return this.createDatabaseError(error);
      case 502:
        return this.createExternalApiError(error);
      case 503:
        return this.createServiceUnavailableError(error);
      default:
        return this.createGenericError(error, originalError);
    }
  }

  /**
   * Crea un ValidationError
   */
  private static createValidationError(error: ServerError): CustomError {
    const validationError = new ValidationError({
      message: error.message,
      field: error.details?.field as string,
      value: error.details?.value,
      constraint: error.details?.constraint as string,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(validationError as any);
  }

  /**
   * Crea un NotFoundError
   */
  private static createNotFoundError(error: ServerError, entityType: string = 'resource'): CustomError {
    const notFoundError = new NotFoundError({
      message: error.message,
      entityType,
      entityId: error.details?.entityId as string | number,
      i18nKey: error.i18nKey,
      details: error.details
    });
    return new CustomError(notFoundError as any);
  }

  /**
   * Crea un BusinessError
   */
  private static createBusinessError(error: ServerError): CustomError {
    const businessError = new BusinessError({
      message: error.message,
      rule: error.details?.rule as string,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(businessError as any);
  }

  /**
   * Crea un UnauthorizedError
   */
  private static createUnauthorizedError(error: ServerError): CustomError {
    const unauthorizedError = new UnauthorizedError({
      message: error.message,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(unauthorizedError as any);
  }

  /**
   * Crea un ForbiddenError
   */
  private static createForbiddenError(error: ServerError): CustomError {
    const forbiddenError = new ForbiddenError({
      message: error.message,
      resource: error.details?.resource as string,
      action: error.details?.action as string,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(forbiddenError as any);
  }

  /**
   * Crea un BadRequestError
   */
  private static createBadRequestError(error: ServerError): CustomError {
    const badRequestError = new BadRequestError({
      message: error.message,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(badRequestError as any);
  }

  /**
   * Crea un RateLimitError
   */
  private static createRateLimitError(error: ServerError): CustomError {
    const rateLimitError = new RateLimitError({
      message: error.message,
      limitType: error.details?.limitType as any,
      retryAfter: error.details?.retryAfter as number,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(rateLimitError as any);
  }

  /**
   * Crea un DatabaseError
   */
  private static createDatabaseError(error: ServerError): CustomError {
    const databaseError = new DatabaseError({
      message: error.message,
      operation: error.details?.operation as string,
      entity: error.details?.entity as string,
      query: error.details?.query as string,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(databaseError as any);
  }

  /**
   * Crea un ExternalApiError
   */
  private static createExternalApiError(error: ServerError): CustomError {
    const externalApiError = new ExternalApiError({
      message: error.message,
      service: error.details?.service as string,
      endpoint: error.details?.endpoint as string,
      statusCode: error.details?.statusCode as number,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(externalApiError as any);
  }

  /**
   * Crea un ServiceUnavailableError
   */
  private static createServiceUnavailableError(error: ServerError): CustomError {
    const serviceUnavailableError = new ServiceUnavailableError({
      message: error.message,
      service: error.details?.service as string,
      retryAfter: error.details?.retryAfter as number,
      i18nKey: error.i18nKey,
      details: error.details,
      cause: error.cause as Error
    });
    return new CustomError(serviceUnavailableError as any);
  }

  /**
   * Crea un NetworkError
   */
  private static createNetworkError(error: ServerError): CustomError {
    return new CustomError({
      name: 'NetworkError',
      message: error.message,
      code: ErrorCodes.NETWORK_ERROR,
      httpStatus: error.httpStatus,
      source: ErrorSource.INFRASTRUCTURE,
      details: error.details,
      timestamp: error.timestamp,
      cause: error.cause,
      additionalData: error.additionalData,
      i18nKey: error.i18nKey,
      stack: error.stack
    });
  }

  /**
   * Crea un InfrastructureError generico
   */
  private static createInfrastructureError(error: ServerError): CustomError {
    return new CustomError({
      name: 'InfrastructureError',
      message: error.message,
      code: error.code,
      httpStatus: error.httpStatus,
      source: ErrorSource.INFRASTRUCTURE,
      details: error.details,
      timestamp: error.timestamp,
      cause: error.cause,
      additionalData: error.additionalData,
      i18nKey: error.i18nKey,
      stack: error.stack
    });
  }

  /**
   * Crea un errore generico come fallback
   */
  private static createGenericError(error: ServerError, originalError?: any): CustomError {
    return new CustomError({
      name: error.name || 'ServerError',
      message: error.message || 'Errore generico del server',
      code: error.code || 'GENERIC_ERROR',
      httpStatus: error.httpStatus || 500,
      source: error.source || ErrorSource.INFRASTRUCTURE,
      details: {
        ...(error.details || {}),
        originalError
      },
      timestamp: error.timestamp || new Date().toISOString(),
      cause: error.cause,
      additionalData: error.additionalData,
      i18nKey: error.i18nKey,
      stack: error.stack
    });
  }

  /**
   * Utility per gestire errori di rete
   */
  private static handleNetworkError(error: any): CustomError {
    return this.createNetworkError({
      name: 'NetworkError',
      message: 'Errore di connessione al server',
      code: ErrorCodes.NETWORK_ERROR,
      httpStatus: 0,
      source: ErrorSource.INFRASTRUCTURE,
      details: { originalError: error },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Utility per gestire errori di parsing JSON
   */
  private static handleParseError(error: any): CustomError {
    return this.createInfrastructureError({
      name: 'ParseError',
      message: 'Errore nel parsing della risposta del server',
      code: 'PARSE_ERROR',
      httpStatus: 500,
      source: ErrorSource.INFRASTRUCTURE,
      details: { originalError: error },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Utility per gestire errori generici
   */
  private static handleGenericError(error: any): CustomError {
    if (error instanceof CustomError) {
      return error;
    }

    return this.createGenericError({
      name: 'UnknownError',
      message: error.message || 'Errore sconosciuto',
      code: 'UNKNOWN_ERROR',
      httpStatus: 500,
      source: ErrorSource.INFRASTRUCTURE,
      details: { originalError: error },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Utility per verificare se un errore è retryable
   */
  public static isErrorRetryable(error: CustomError): boolean {
    return error.canRetry();
  }

  /**
   * Utility per ottenere il messaggio utente appropriato
   */
  public static getUserFriendlyMessage(error: CustomError): string {
    return error.getUserMessage();
  }

  /**
   * Utility per ottenere l'azione richiesta
   */
  public static getRequiredAction(error: CustomError): string | undefined {
    return error.getActionRequired();
  }

  /**
   * Utility per verificare il tipo di errore
   */
  public static isErrorType(error: CustomError, type: ClientErrorType): boolean {
    return error.isType(type);
  }

  public static get = async <T>(url: string, signal?: AbortSignal, customHeaders?: Record<string, string>): Promise<T> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        "x-internal-request": "true",
        "Accept-Encoding": "gzip, deflate, br"
      };

      if (customHeaders) {
        Object.assign(headers, customHeaders);
      }

      const response = await fetch(this.baseUrl + url, {
        method: Methods.GET,
        cache: "default",
        credentials: "include",
        headers,
        signal,
      });

      if (response.ok) {
        try {
          return await response.json();
        } catch (parseError) {
          throw this.handleParseError(parseError);
        }
      } else {
        if (response.status === 401) {
          const body401 = await response.json().catch(() => ({}));
          this.handleUnauthorized(body401?.istantaRequired === true);
          if (body401?.source) {
            throw this.createSpecificError(body401);
          }
          throw this.createGenericError({
            name: 'UnknownServerError',
            message: body401?.message || 'Non autorizzato',
            code: body401?.code || 'UNAUTHORIZED',
            httpStatus: 401,
            source: ErrorSource.INFRASTRUCTURE,
            details: body401?.additionalData,
            timestamp: new Date().toISOString()
          });
        }
        try {
          const error = await response.json();
          if (error.source) {
            throw this.createSpecificError(error);
          } else {
            throw this.createGenericError({
              name: 'UnknownServerError',
              message: error.message || 'Errore sconosciuto dal server',
              code: 'UNKNOWN_SERVER_ERROR',
              httpStatus: response.status,
              source: ErrorSource.INFRASTRUCTURE,
              details: error.additionalData,
              timestamp: new Date().toISOString()
            });
          }
        } catch (parseError: any) {
          throw this.createGenericError(parseError);
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      } else if (error.name === 'AbortError') {
        throw this.createGenericError(error);

      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw this.handleNetworkError(error);
      } else {
        throw this.handleGenericError(error);
      }
    }
  }

  public static post = async <T>(url: string, data: object | FormData, isFileUpload = false, customHeaders?: Record<string, string>): Promise<T> => {
    await this.ensureCSRFToken();

    const headers = new Headers();
    const isFormData = data instanceof FormData;

    // Solo impostare Content-Type se non è FormData
    // Quando si usa FormData, il browser imposta automaticamente multipart/form-data
    if (!isFormData) {
      headers.append('Content-Type', 'application/json');
      headers.append('Accept', 'application/json');
    } else {
      headers.append('Accept', 'application/json');
    }

    // Aggiungi token CSRF per sicurezza
    const csrfToken = this.getCSRFToken();
    if (csrfToken) {
      headers.append('x-csrf-token', csrfToken);
    }

    // Aggiungi header per identificare richieste AJAX
    headers.append('X-Requested-With', 'XMLHttpRequest');
    headers.append('Accept-Encoding', 'gzip, deflate, br');

    if (customHeaders) {
      Object.entries(customHeaders).forEach(([key, value]) => headers.set(key, value));
    }
    let body: BodyInit;

    if (isFormData) {
      body = data; // FormData is compatible with BodyInit
    } else {
      body = JSON.stringify(data); // Serialize JSON only if not FormData
    }

    try {
      const request = () => fetch(this.baseUrl + url, {
        method: Methods.POST,
        credentials: "include",
        headers,
        body,
        cache: "default",
      });

      const response = await this.withCsrfRetry(
        request,
        () => {
          const freshToken = this.getCSRFToken();
          if (freshToken) {
            headers.set('x-csrf-token', freshToken);
          }
        }
      );

      if (response.ok) {
        try {
          return await response.json();
        } catch (parseError) {
          throw this.handleParseError(parseError);
        }
      } else {
        if (response.status === 401) {
          const body401 = await response.json().catch(() => ({}));
          this.handleUnauthorized(body401?.istantaRequired === true);
          if (body401?.source) {
            throw this.createSpecificError(body401);
          }
          throw this.createGenericError(body401);
        }
        try {
          const error = await response.json();
          if (error.source) {
            throw this.createSpecificError(error);
          } else {
            throw this.createGenericError(error);
          }
        } catch (parseError: any) {
          throw this.createGenericError(parseError);
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      } else if (error.name === 'AbortError') {
        throw this.createGenericError(error);
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw this.handleNetworkError(error);
      } else {
        throw this.handleGenericError(error);
      }
    }
  }

  /**
   * POST che ritorna la Response grezza (per download di file binari).
   * Gestisce CSRF con retry automatico. Il chiamante legge `.blob()` / `.arrayBuffer()`
   * e può accedere agli header (es. Content-Type) prima di consumare il body.
   */
  public static postRaw = async (url: string, data: object): Promise<Response> => {
    await this.ensureCSRFToken();

    const headers: Record<string, string> = this.addSecurityHeaders(
      { 'Content-Type': 'application/json', 'Accept': '*/*' },
      'POST'
    );
    const body = JSON.stringify(data);

    try {
      const request = () => fetch(this.baseUrl + url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body,
      });

      const response = await this.withCsrfRetry(request, () => {
        const freshToken = this.getCSRFToken();
        if (freshToken) headers['x-csrf-token'] = freshToken;
      });

      return response;
    } catch (error: any) {
      if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        throw this.handleNetworkError(error);
      }
      throw error;
    }
  }

  public static put = async <T>(url: string, data: object, customHeaders?: Record<string, string>): Promise<T> => {
    try {
      await this.ensureCSRFToken();

      const headers = this.addSecurityHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        "Accept-Encoding": "gzip, deflate, br"
      }, 'PUT');

      if (customHeaders) {
        Object.assign(headers, customHeaders);
      }

      const request = () => fetch(this.baseUrl + url, {
        method: Methods.PUT,
        headers,
        credentials: "include",
        body: JSON.stringify(data),
        cache: "default",
      });

      const response = await this.withCsrfRetry(
        request,
        () => {
          const freshToken = this.getCSRFToken();
          if (freshToken) {
            headers['x-csrf-token'] = freshToken;
          }
        }
      );

      if (response.ok) {
        return response.json();
      } else {
        if (response.status === 401) {
          const body401 = await response.json().catch(() => ({}));
          this.handleUnauthorized(body401?.istantaRequired === true);
          if (body401?.source) {
            throw new CustomError(body401);
          }
          throw this.createGenericError({
            name: 'UnknownError',
            message: body401?.message,
            code: 'UNKNOWN',
            httpStatus: 401,
            source: ErrorSource.INFRASTRUCTURE,
            details: body401?.additionalData,
            timestamp: new Date().toISOString()
          });
        }
        const error = await response.json();
        if (error.source) {
          throw new CustomError(error);
        } else {
          throw this.createGenericError({
            name: 'UnknownError',
            message: error.message,
            code: 'UNKNOWN',
            httpStatus: response.status,
            source: ErrorSource.INFRASTRUCTURE,
            details: error.additionalData,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError || error.source) {
        throw error;
      } else {
        throw this.createGenericError({
          name: 'NetworkError',
          message: error.message,
          code: 'NETWORK_ERROR',
          httpStatus: 500,
          source: ErrorSource.INFRASTRUCTURE,
          details: { originalError: error },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  public static delete = async <T>(url: string, data?: object, customHeaders?: Record<string, string>): Promise<T> => {
    try {
      await this.ensureCSRFToken();

      const headers = this.addSecurityHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        "Accept-Encoding": "gzip, deflate, br"
      }, 'DELETE');

      if (customHeaders) {
        Object.assign(headers, customHeaders);
      }

      const request = () => fetch(this.baseUrl + url, {
        method: Methods.DELETE,
        headers,
        credentials: "include",
        body: data ? JSON.stringify(data) : undefined,
        cache: "default",
      });

      const response = await this.withCsrfRetry(
        request,
        () => {
          const freshToken = this.getCSRFToken();
          if (freshToken) {
            headers['x-csrf-token'] = freshToken;
          }
        }
      );

      if (response.ok) {
        if (response.status === 204) {
          return {} as T;
        }
        return response.json();
      } else {
        if (response.status === 401) {
          const body401 = await response.json().catch(() => ({}));
          this.handleUnauthorized(body401?.istantaRequired === true);
          if (body401?.source) {
            throw new CustomError(body401);
          }
          throw this.createGenericError({
            name: 'UnknownError',
            message: body401?.message,
            code: 'UNKNOWN',
            httpStatus: 401,
            source: ErrorSource.INFRASTRUCTURE,
            details: body401?.additionalData,
            timestamp: new Date().toISOString()
          });
        }
        const error = await response.json();
        if (error.source) {
          throw new CustomError(error);
        } else {
          throw this.createGenericError({
            name: 'UnknownError',
            message: error.message,
            code: 'UNKNOWN',
            httpStatus: response.status,
            source: ErrorSource.INFRASTRUCTURE,
            details: error.additionalData,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError || error.source) {
        throw error;
      } else {
        throw this.createGenericError({
          name: 'NetworkError',
          message: error.message,
          code: 'NETWORK_ERROR',
          httpStatus: 500,
          source: ErrorSource.INFRASTRUCTURE,
          details: { originalError: error },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  public static options = async <T>(url: string): Promise<T> => {
    try {
      const response = await fetch(this.baseUrl + url, {
        method: Methods.OPTIONS,
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          "Accept-Encoding": "gzip, deflate, br"
        },
        cache: "default",
      });

      if (response.ok) {
        return response.json();
      } else {
        const error = await response.json();
        if (error.source) {
          throw new CustomError(error);
        } else {
          throw this.createGenericError({
            name: 'UnknownError',
            message: error.message,
            code: 'UNKNOWN',
            httpStatus: response.status,
            source: ErrorSource.INFRASTRUCTURE,
            details: error.additionalData,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError || error.source) {
        throw error;
      } else {
        throw this.createGenericError({
          name: 'NetworkError',
          message: error.message,
          code: 'NETWORK_ERROR',
          httpStatus: 500,
          source: ErrorSource.INFRASTRUCTURE,
          details: { originalError: error },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  public static head = async <T>(url: string): Promise<T> => {
    try {
      const response = await fetch(this.baseUrl + url, {
        method: Methods.HEAD,
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          "Accept-Encoding": "gzip, deflate, br"
        },
        cache: "default",
      });

      if (response.ok) {
        return response.headers as unknown as T;
      } else {
        const error = await response.json();
        if (error.source) {
          throw new CustomError(error);
        } else {
          throw this.createGenericError({
            name: 'UnknownError',
            message: error.message,
            code: 'UNKNOWN',
            httpStatus: response.status,
            source: ErrorSource.INFRASTRUCTURE,
            details: error.additionalData,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError || error.source) {
        throw error;
      } else {
        throw this.createGenericError({
          name: 'NetworkError',
          message: error.message,
          code: 'NETWORK_ERROR',
          httpStatus: 500,
          source: ErrorSource.INFRASTRUCTURE,
          details: { originalError: error },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  public static patch = async <T>(url: string, data: object): Promise<T> => {
    try {
      await this.ensureCSRFToken();

      const headers = this.addSecurityHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        "Accept-Encoding": "gzip, deflate, br"
      }, 'PATCH');

      const request = () => fetch(this.baseUrl + url, {
        method: Methods.PATCH,
        headers,
        credentials: "include",
        body: JSON.stringify(data),
        cache: "default",
      });

      const response = await this.withCsrfRetry(
        request,
        () => {
          const freshToken = this.getCSRFToken();
          if (freshToken) {
            headers['x-csrf-token'] = freshToken;
          }
        }
      );

      if (response.ok) {
        return response.json();
      } else {
        const error = await response.json();
        if (error.source) {
          throw new CustomError(error);
        } else {
          throw this.createGenericError({
            name: 'UnknownError',
            message: error.message,
            code: 'UNKNOWN',
            httpStatus: response.status,
            source: ErrorSource.INFRASTRUCTURE,
            details: error.additionalData,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      if (error instanceof CustomError || error.source) {
        throw error;
      } else {
        throw this.createGenericError({
          name: 'NetworkError',
          message: error.message,
          code: 'NETWORK_ERROR',
          httpStatus: 500,
          source: ErrorSource.INFRASTRUCTURE,
          details: { originalError: error },
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  public static subscribeToSSE = <T>(url: string, onMessage: (event: MessageEvent<T>) => void, onError?: (error: any) => void): EventSource => {
    const eventSource = new EventSource(this.baseUrl + url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        if (onError) onError(err);
      }
    };

    eventSource.onerror = (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error("SSE connection error:", error);
      }
      eventSource.close(); // Chiudi la connessione in caso di errore
    };

    return eventSource;
  }

  public static subscribeToSSEPost = <T>(
    url: string,
    body: Record<string, unknown>,
    onEvent: (eventName: string, data: T) => void,
    onError?: (error: any) => void
  ): { abort: () => void } => {
    const controller = new AbortController();

    const parseSSEEvent = (rawEvent: string): { eventName: string; data: T | null } | null => {
      const lines = rawEvent.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim() || 'message';
          continue;
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) {
        return { eventName, data: null };
      }

      const rawData = dataLines.join('\n');
      try {
        return { eventName, data: JSON.parse(rawData) as T };
      } catch {
        return { eventName, data: rawData as unknown as T };
      }
    };

    const run = async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        };
        const csrfToken = this.getCSRFToken();
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }

        const response = await fetch(this.baseUrl + url, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorPayload: any = null;
          try {
            errorPayload = await response.json();
          } catch {
            const errorText = await response.text();
            errorPayload = { message: errorText || `HTTP ${response.status}` };
          }

          if (onError) {
            onError(errorPayload);
          } else {
            console.error('SSE POST request failed:', errorPayload);
          }
          return;
        }

        if (!response.body) {
          const noBodyError = { message: 'SSE stream body assente.' };
          if (onError) onError(noBodyError);
          else console.error(noBodyError.message);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          let eventSeparatorIndex = buffer.indexOf('\n\n');

          while (eventSeparatorIndex !== -1) {
            const rawEvent = buffer.slice(0, eventSeparatorIndex);
            buffer = buffer.slice(eventSeparatorIndex + 2);

            const parsed = parseSSEEvent(rawEvent);
            if (parsed) {
              onEvent(parsed.eventName, parsed.data as T);
            }

            eventSeparatorIndex = buffer.indexOf('\n\n');
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        if (onError) {
          onError(error);
        } else {
          console.error('Errore SSE POST:', error);
        }
      }
    };

    void run();

    return {
      abort: () => controller.abort(),
    };
  }
  /**
   * Utility per gestire automaticamente i retry per errori retryable
   */
  public static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: CustomError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error instanceof CustomError ? error : this.handleGenericError(error);

        // Se non è retryable o è l'ultimo tentativo, rilancia l'errore
        if (!lastError.canRetry() || attempt === maxRetries) {
          throw lastError;
        }

        // Aspetta prima del prossimo tentativo
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }

    throw lastError!;
  }

  /**
   * Utility per gestire errori con callback personalizzati
   */
  public static async withErrorHandling<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: CustomError) => void
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      const customError = error instanceof CustomError ? error : this.handleGenericError(error);

      if (errorHandler) {
        errorHandler(customError);
      }

      throw customError;
    }
  }

  /**
   * Utility per verificare se un errore è di autenticazione
   */
  public static isAuthenticationError(error: CustomError): boolean {
    return error.isType(ClientErrorType.AUTHENTICATION) || error.httpStatus === 401;
  }

  /**
   * Utility per verificare se un errore è di autorizzazione
   */
  public static isAuthorizationError(error: CustomError): boolean {
    return error.isType(ClientErrorType.AUTHORIZATION) || error.httpStatus === 403;
  }

  /**
   * Utility per verificare se un errore è di validazione
   */
  public static isValidationError(error: CustomError): boolean {
    return error.isType(ClientErrorType.VALIDATION) || error.httpStatus === 422;
  }

  /**
   * Utility per verificare se un errore è di rete
   */
  public static isNetworkError(error: CustomError): boolean {
    return error.isType(ClientErrorType.NETWORK) || error.isType(ClientErrorType.INFRASTRUCTURE);
  }

  /**
   * Utility per verificare se un errore è di rate limiting
   */
  public static isRateLimitError(error: CustomError): boolean {
    return error.isType(ClientErrorType.RATE_LIMIT) || error.httpStatus === 429;
  }

  /**
   * Utility per verificare se un errore è di rate limiting per registrazione
   */
  public static isRegistrationRateLimitError(error: CustomError): boolean {
    return this.isRateLimitError(error) &&
      error.details?.limitType === 'registration';
  }

  /**
   * Utility per ottenere il tempo di attesa per rate limiting
   */
  public static getRateLimitRetryAfter(error: CustomError): number | undefined {
    if (this.isRateLimitError(error)) {
      return error.details?.retryAfter as number;
    }
    return undefined;
  }

  /**
   * Utility per ottenere i dati di errore precisi
   */
  public static getPreciseErrorData(error: CustomError): PreciseErrorData {
    return error.getPreciseErrorData();
  }

  /**
   * Utility per creare dati di errore precisi da un errore generico
   */
  public static createPreciseErrorData(
    message: string,
    httpStatus: number,
    code: string,
    source: ErrorSource,
    additionalData?: any
  ): PreciseErrorData {
    const customError = new CustomError({
      name: 'ServerError',
      message,
      code,
      httpStatus,
      source,
      details: additionalData,
      timestamp: new Date().toISOString()
    });

    return customError.getPreciseErrorData();
  }

  /**
   * Utility per gestire errori e restituire dati precisi
   */
  public static handleErrorWithPreciseData(error: any): PreciseErrorData {
    let customError: CustomError;

    if (error instanceof CustomError) {
      customError = error;
    } else if (error.source) {
      // È un errore del server, usa il mapping specifico
      customError = this.createSpecificError(error);
    } else {
      // È un errore generico
      customError = this.handleGenericError(error);
    }

    return customError.getPreciseErrorData();
  }

  /**
   * Esempio di utilizzo dei dati di errore precisi
   * Questo metodo mostra come gestire gli errori e accedere ai dati specifici
   */
  public static async exampleUsage(): Promise<void> {
    try {
      // Esempio di chiamata che potrebbe fallire
      await this.get('/api/users/123');
    } catch (error: any) {
      // Ottieni i dati di errore precisi
      const errorData = this.handleErrorWithPreciseData(error);

      // Ora puoi accedere direttamente ai dati specifici dell'errore
      console.log('Nome errore:', errorData.name);
      console.log('Messaggio:', errorData.message);
      console.log('Codice:', errorData.code);
      console.log('Status HTTP:', errorData.httpStatus);
      console.log('Tipo client:', errorData.clientType);
      console.log('È retryable:', errorData.isRetryable);
      console.log('Messaggio utente:', errorData.userMessage);
      console.log('Azione richiesta:', errorData.actionRequired);
      console.log('Dettagli:', errorData.details);
      console.log('Timestamp:', errorData.timestamp);

      // Gestione specifica per tipo di errore
      switch (errorData.clientType) {
        case ClientErrorType.AUTHENTICATION:
          console.log('Reindirizza al login');
          break;
        case ClientErrorType.AUTHORIZATION:
          console.log('Mostra messaggio di permessi insufficienti');
          break;
        case ClientErrorType.VALIDATION:
          console.log('Mostra errori di validazione nei campi');
          break;
        case ClientErrorType.RATE_LIMIT:
          console.log('Mostra messaggio di rate limiting');
          const retryAfter = errorData.details?.retryAfter as number;
          if (retryAfter) {
            console.log(`Riprova tra ${retryAfter} secondi`);
          }
          break;
        case ClientErrorType.NETWORK:
          console.log('Gestisci errore di rete');
          break;
        default:
          console.log('Gestisci come errore generico');
      }

      // Esempio di utilizzo dei dati per l'UI
      if (errorData.isRetryable) {
        console.log('Puoi riprovare questa operazione');
      }

      // Esempio di logging per debugging
      if (errorData.stack) {
        console.error('Stack trace:', errorData.stack);
      }
    }
  }
}


export { Methods, ServerCall };
