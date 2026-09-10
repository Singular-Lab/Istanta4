import { StatisticheApi } from '../models/statistiche_api';

// DTO per la creazione di una nuova statistica API
export interface CreateStatisticheApiDTO {
  endpoint: string;
  metodo: string;
  codice_risposta: number;
  tempo_risposta_ms: number;
  dimensione_risposta_bytes?: number;
  ip_richiedente: string;
  user_agent?: string;
  ruolo_utente?: string;
  api_key_utilizzata?: string;
  parametri_richiesta?: string;
  timestamp_richiesta: Date;
  timestamp_risposta: Date;
  errore?: string;
  stack_trace?: string;
}

// DTO per la risposta delle statistiche API
export interface StatisticheApiResponseDTO {
  id_statistiche_api: number;
  endpoint: string;
  metodo: string;
  codice_risposta: number;
  tempo_risposta_ms: number;
  dimensione_risposta_bytes: number;
  ip_richiedente: string;
  user_agent: string | null;
  ruolo_utente: string | null;
  api_key_utilizzata: string | null;
  parametri_richiesta: string | null;
  timestamp_richiesta: Date;
  timestamp_risposta: Date;
  errore: string | null;
  stack_trace: string | null;
  created_at: Date;
  updated_at: Date;
}
export type OperatingSystem =
  | 'Windows'
  | 'macOS'
  | 'Linux'
  | 'Android'
  | 'iOS'
  | 'iPadOS'
  | 'ChromeOS'
  | 'SmartTV'
  | 'Console'
  | 'Bot'
  | 'Embedded'
  | 'Unknown';

export function parseOperatingSystem(userAgent?: string): OperatingSystem {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'Unknown';
  }

  const ua = userAgent.toLowerCase();

  /* =====================================================
   * BOT / CRAWLER (priorità massima)
   * ===================================================== */
  if (
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider') ||
    ua.includes('slurp') ||
    ua.includes('bingpreview') ||
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('embedly') ||
    ua.includes('quora link preview') ||
    ua.includes('discordbot') ||
    ua.includes('telegrambot') ||
    ua.includes('whatsapp') ||
    ua.includes('slackbot') ||
    ua.includes('twitterbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('applebot') ||
    ua.includes('pingdom') ||
    ua.includes('uptimerobot') ||
    ua.includes('googlebot') ||
    ua.includes('adsbot') ||
    ua.includes('mediapartners-google')
  ) {
    return 'Bot';
  }

  /* =====================================================
   * API CLIENT / DEV TOOL (Postman, curl, ecc.)
   * ===================================================== */
  if (
    ua.includes('postman') ||
    ua.includes('insomnia') ||
    ua.includes('hoppscotch') ||
    ua.includes('paw/') ||
    ua.includes('httpie') ||
    ua.includes('curl') ||
    ua.includes('wget') ||
    ua.includes('python-requests') ||
    ua.includes('axios') ||
    ua.includes('okhttp') ||
    ua.includes('go-http-client') ||
    ua.includes('java/') ||
    ua.includes('node-fetch') ||
    ua.includes('undici')
  ) {
    return 'Embedded';
  }

  /* =====================================================
   * SMART TV
   * ===================================================== */
  if (
    ua.includes('smart-tv') ||
    ua.includes('smarttv') ||
    ua.includes('hbbtv') ||
    ua.includes('netcast') ||
    ua.includes('tizen') ||
    ua.includes('webos') ||
    ua.includes('roku') ||
    ua.includes('appletv') ||
    ua.includes('googletv') ||
    ua.includes('android tv') ||
    ua.includes('fire tv')
  ) {
    return 'SmartTV';
  }

  /* =====================================================
   * CONSOLE
   * ===================================================== */
  if (
    ua.includes('playstation') ||
    ua.includes('ps4') ||
    ua.includes('ps5') ||
    ua.includes('xbox') ||
    ua.includes('nintendo') ||
    ua.includes('switch')
  ) {
    return 'Console';
  }

  /* =====================================================
   * iOS / iPadOS (PRIMA di macOS)
   * ===================================================== */
  if (
    ua.includes('iphone') ||
    ua.includes('ipod')
  ) {
    return 'iOS';
  }

  if (
    ua.includes('ipad') ||
    (ua.includes('macintosh') && ua.includes('mobile'))
  ) {
    return 'iPadOS';
  }

  /* =====================================================
   * ANDROID
   * ===================================================== */
  if (ua.includes('android')) {
    return 'Android';
  }

  /* =====================================================
   * CHROME OS
   * ===================================================== */
  if (
    ua.includes('cros') ||
    ua.includes('chromebook')
  ) {
    return 'ChromeOS';
  }

  /* =====================================================
   * WINDOWS
   * ===================================================== */
  if (
    ua.includes('windows nt') ||
    ua.includes('win32') ||
    ua.includes('win64') ||
    ua.includes('wow64')
  ) {
    return 'Windows';
  }

  /* =====================================================
   * macOS
   * ===================================================== */
  if (
    ua.includes('mac os x') ||
    ua.includes('macintosh')
  ) {
    return 'macOS';
  }

  /* =====================================================
   * LINUX
   * ===================================================== */
  if (
    ua.includes('linux') ||
    ua.includes('x11')
  ) {
    return 'Linux';
  }

  /* =====================================================
   * EMBEDDED / IOT
   * ===================================================== */
  if (
    ua.includes('arm') ||
    ua.includes('aarch64') ||
    ua.includes('embedded') ||
    ua.includes('rtos') ||
    ua.includes('contiki') ||
    ua.includes('yocto') ||
    ua.includes('openwrt') ||
    ua.includes('raspbian') ||
    ua.includes('esp32') ||
    ua.includes('esp8266')
  ) {
    return 'Embedded';
  }

  return 'Unknown';
}

// DTO per le statistiche aggregate
export interface StatisticheAggregateDTO {
  totale_richieste: number;
  richieste_riuscite: number;
  richieste_fallite: number;
  tempo_medio_risposta_ms: number;
  richieste_oggi: number;
  crescita_settimanale_percentuale: number;
  endpoint_piu_utilizzati: Array<{
    endpoint: string;
    richieste: number;
    tempo_medio_ms: number;
  }>;
  attivita_recente: Array<{
    orario: string;
    endpoint: string;
    stato: 'success' | 'error';
    tempo_risposta_ms: number;
    errore: string | null;
    stack_trace: string | null;
  }>;
  statistiche_per_endpoint: Array<{
    endpoint: string;
    metodo: string;
    totale_richieste: number;
    richieste_riuscite: number;
    richieste_fallite: number;
    tempo_medio_ms: number;
    tempo_minimo_ms: number;
    tempo_massimo_ms: number;
    ultima_richiesta: Date;
  }>;
  statistiche_per_ruolo: Array<{
    ruolo: string;
    totale_richieste: number;
    richieste_riuscite: number;
    richieste_fallite: number;
    tempo_medio_ms: number;
  }>;
  statistiche_temporali: {
    ultimo_giorno: {
      richieste_totali: number;
      richieste_riuscite: number;
      richieste_fallite: number;
      tempo_medio_ms: number;
    };
    ultima_settimana: {
      richieste_totali: number;
      richieste_riuscite: number;
      richieste_fallite: number;
      tempo_medio_ms: number;
    };
    ultimo_mese: {
      richieste_totali: number;
      richieste_riuscite: number;
      richieste_fallite: number;
      tempo_medio_ms: number;
    };

  };
  dispositivi: {
    sistemi_operativi: Array<{
      os: OperatingSystem; // enum / union
      totale_richieste: number;
      richieste_riuscite: number;
      richieste_fallite: number;
      tempo_medio_ms: number;
    }>;
  }
}

// DTO per i filtri di ricerca delle statistiche
export interface StatisticheFiltersDTO {
  endpoint?: string;
  metodo?: string;
  codice_risposta?: number;
  ruolo_utente?: string;
  data_da?: Date;
  data_a?: Date;
  limite?: number;
  offset?: number;
  ordina_per?: 'timestamp_richiesta' | 'tempo_risposta_ms' | 'codice_risposta';
  direzione_ordine?: 'ASC' | 'DESC';
}

// DTO per la risposta paginata delle statistiche
export interface StatistichePaginateResponseDTO {
  dati: StatisticheApiResponseDTO[];
  paginazione: {
    pagina_corrente: number;
    elementi_per_pagina: number;
    totale_elementi: number;
    totale_pagine: number;
    ha_pagina_precedente: boolean;
    ha_pagina_successiva: boolean;
  };
  filtri_applicati: StatisticheFiltersDTO;
}

// Funzione di conversione da modello Sequelize a DTO
export function toStatisticheApiResponseDTO(statistica: StatisticheApi): StatisticheApiResponseDTO {
  return {
    id_statistiche_api: statistica.id_statistiche_api,
    endpoint: statistica.endpoint,
    metodo: statistica.metodo,
    codice_risposta: statistica.codice_risposta,
    tempo_risposta_ms: statistica.tempo_risposta_ms,
    dimensione_risposta_bytes: statistica.dimensione_risposta_bytes,
    ip_richiedente: statistica.ip_richiedente,
    user_agent: statistica.user_agent,
    ruolo_utente: statistica.ruolo_utente,
    api_key_utilizzata: statistica.api_key_utilizzata,
    parametri_richiesta: statistica.parametri_richiesta,
    timestamp_richiesta: statistica.timestamp_richiesta,
    timestamp_risposta: statistica.timestamp_risposta,
    errore: statistica.errore,
    stack_trace: statistica.stack_trace,
    created_at: statistica.created_at,
    updated_at: statistica.updated_at
  };
}

// Funzione di conversione da DTO a attributi del modello
export function toStatisticheApiAttributes(dto: CreateStatisticheApiDTO): Partial<StatisticheApi> {
  return {
    endpoint: dto.endpoint,
    metodo: dto.metodo,
    codice_risposta: dto.codice_risposta,
    tempo_risposta_ms: dto.tempo_risposta_ms,
    dimensione_risposta_bytes: dto.dimensione_risposta_bytes || 0,
    ip_richiedente: dto.ip_richiedente,
    user_agent: dto.user_agent,
    ruolo_utente: dto.ruolo_utente,
    api_key_utilizzata: dto.api_key_utilizzata,
    parametri_richiesta: dto.parametri_richiesta,
    timestamp_richiesta: dto.timestamp_richiesta,
    timestamp_risposta: dto.timestamp_risposta,
    errore: dto.errore || null,
    stack_trace: dto.stack_trace || null
  };
}
