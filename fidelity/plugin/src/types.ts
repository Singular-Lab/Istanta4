// ============================================
// FILTER & API TYPES
// ============================================

export interface FilterCondition {
    field: string;
    operator: string;
    value: string;
}

export interface FilesResponse {
    files?: unknown[];
    conteggio?: number;
}

export interface RefsHtmlKitDTO {
    id_kit: string;
    id_template: string;
    id_promo: string;
    referenze_html: string[];
}

export interface RefsHtmlPromoDTO {
    id_promo: string;
    nome_promo: string;
    validita_dal: string;
    validita_al: string;
    kit: RefsHtmlKitDTO[];
}

export interface RefsHtmlResponse {
    conteggio: number;
    risposta: RefsHtmlPromoDTO[];
    timestamp: string;
}

export interface CssResponse {
    css_text: string;
    timestamp: string;
}

export interface EphemeralToken {
    token: string;
    expUtc: number;
}

// ============================================
// STYLE OPTIONS
// ============================================

/**
 * Opzioni di stile per la griglia
 */
export interface FPGridStyles {
    /** Numero colonne o 'auto-fill' (default: 'auto-fill') */
    columns?: string | number;
    /** Larghezza minima item (default: '280px') */
    minItemWidth?: string;
    /** Massimo numero di items visibili (default: nessun limite) */
    maxItems?: number;
    /** Altezza item (default: 'auto') */
    itemHeight?: string;
}

/**
 * Opzioni di stile per il carousel
 */
export interface FPCarouselStyles {
    /** Larghezza item (default: '280px') */
    itemWidth?: string;
    /** Larghezza massima item (default: '400px') */
    itemMaxWidth?: string;
    /** Allineamento snap: 'start' | 'center' | 'end' (default: 'start') */
    snapAlign?: 'start' | 'center' | 'end';
    /** Comportamento scroll: 'smooth' | 'auto' (default: 'smooth') */
    scrollBehavior?: 'smooth' | 'auto';
    /** Durata transizione (default: '0.4s') */
    transitionDuration?: string;
    /** Colore indicatori (default: 'rgba(0, 0, 0, 0.3)') */
    indicatorColor?: string;
    /** Colore indicatore attivo (default: 'rgba(0, 0, 0, 0.7)') */
    indicatorActiveColor?: string;
    /** Dimensione bottoni navigazione (default: '40px') */
    navSize?: string;
    /** Background bottoni navigazione (default: 'rgba(255, 255, 255, 0.9)') */
    navBg?: string;
    /** Background bottoni navigazione hover (default: '#fff') */
    navBgHover?: string;
    /** Colore icone navigazione (default: 'rgba(0, 0, 0, 0.6)') */
    navColor?: string;
}

/**
 * Opzioni di stile principali
 */
export interface FPStyles {
    /** Gap tra elementi (default: '12px') */
    gap?: string;
    /** Scala elementi (default: 1) */
    scale?: number;
    /** Larghezza massima (default: '100%') */
    maxWidth?: string;
    /** Padding interno (default: '16px') */
    padding?: string;
    /** Opzioni specifiche per griglia */
    grid?: FPGridStyles;
    /** Opzioni specifiche per carousel */
    carousel?: FPCarouselStyles;
    /**
     * Breakpoint responsive
     * @example
     * responsive: {
     *   600: { gap: '8px', grid: { maxItems: 5 } },
     *   400: { gap: '4px', grid: { maxItems: 3 } }
     * }
     */
    responsive?: {
        [breakpoint: number]: Partial<Omit<FPStyles, 'responsive'>>;
    };
}

/**
 * Classi CSS custom
 */
export interface FPClassNames {
    /** Classe per il root container */
    refsRoot?: string;
    /** Classe per il wrapper degli items */
    refsWrapper?: string;
    /** Classe per ogni singolo item */
    refItem?: string;
}

// ============================================
// MAIN OPTIONS
// ============================================

/**
 * Opzioni per il tracking analytics
 */
export interface FPTrackingOptions {
    /** Abilita tracking (default: false) */
    enabled?: boolean;
    /** Porta WebSocket (default: porta API + 390, es. 3010→3400) */
    wsPort?: number;
    /** Dimensione buffer prima di auto-flush (default: 50) */
    bufferSize?: number;
    /** Intervallo flush in ms (default: 10000) */
    flushIntervalMs?: number;
    /** Traccia impression elementi (default: true) */
    trackImpressions?: boolean;
    /** Traccia click (default: true) */
    trackClicks?: boolean;
}

export interface FPOptions {
    /** URL base API (es: 'https://api.example.com') */
    url: string;

    /** Container HTML dove renderizzare il plugin */
    container: HTMLDivElement;


    /** Versione plugin (default: '1.0.0') */
    version?: string;

    /** Opzioni di stile */
    styles?: FPStyles;

    /** Classi CSS custom */
    classNames?: FPClassNames;

    /** URL stylesheet aggiuntivi da caricare nel Shadow DOM */
    shadowStyles?: string[];

    /** Slug richiesto per recuperare le impostazioni dal servizio FP */
    slug: string;

    /** Versione specifica del template da caricare */
    templateVersion?: number;

    /** Opzioni per il tracking analytics */
    tracking?: FPTrackingOptions;
}


export interface FpOptionsQuery {
    /** Tipologia di rendering: 'grid' | 'carousel' | 'list' */
    type: 'grid' | 'carousel' | 'list';

    /** Modalità di fetch dati: 'refs' | 'refs-html' | 'files' */
    mode: 'refs' | 'refs-html' | 'files';
    /** Filtri avanzati per le query */
    filters?: Array<FilterCondition[]>;

    /** Tipi di export da filtrare (solo per mode: 'files') */
    tipo_export?: string[];

    /** Template ID da caricare (solo per mode: 'refs' e 'refs-html') */
    template_id?: string[];
    autoScroll?: boolean;

    /** Velocità auto-scroll in ms (default: 5000) */
    scrollSpeed?: number;

    /** Mostra indicatori carousel (default: true) */
    showIndicators?: boolean;

    /** Mostra bottoni navigazione carousel (default: true) */
    showNavButtons?: boolean;
}
