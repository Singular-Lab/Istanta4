// Re-export public types
export type {
    CssResponse, EphemeralToken, FilesResponse, FilterCondition, FPCarouselStyles, FPClassNames, FPGridStyles, FPOptions, FpOptionsQuery, FPStyles, FPTrackingOptions, RefsHtmlKitDTO, RefsHtmlPromoDTO, RefsHtmlResponse
} from './types';

import { PluginAnalyticsManager } from './analytics/manager';
import type {
    AnalyticsDataFor, AnalyticsEvent, AnalyticsViewport, ElementRectData,
} from './analytics/types';
import { PluginEventType } from './analytics/types';
import { DEFAULT_STYLES } from './defaults';
import { fpLogger } from './logger';
import type {
    CssResponse,
    EphemeralToken,
    FilesResponse,
    FPCarouselStyles,
    FPGridStyles,
    FPOptions, FpOptionsQuery,
    FPStyles,
    RefsHtmlResponse,
} from './types';

// ============================================
// MAIN CLASS
// ============================================

export default class FP {
    private options: FPOptions | null = null;
    private static cssCache = new Map<
        string,
        {
            cssText: string;
            sheet: CSSStyleSheet;
            fontImports: string[];
        }
    >();
    private cachedToken: EphemeralToken | null = null;
    private cachedBrowserHash: string | null = null;
    private FP_VERSION: string = '1.0.0';
    private readonly STORAGE_KEY = 'fp_ephemeral_token';
    private readonly BROWSER_HASH_KEY = 'fp_browser_hash';
    private readonly KEY_SESSION_ID_STORAGE = "fp_analytics_session_id"
    private constructedStyleSheet: CSSStyleSheet | null = null;
    private static shadowStyleCache = new Map<string, CSSStyleSheet>();
    // get set FpOptionsQuery
    private _optionsQuery: FpOptionsQuery | null = null;

    public get optionsQuery(): FpOptionsQuery | null {
        return this._optionsQuery;
    }

    public set optionsQuery(value: FpOptionsQuery | null) {
        if (this._optionsQuery !== null) {
            throw new Error('[FP] optionsQuery è già stato impostato e non può essere modificato.');
        }

        this._optionsQuery = value ? Object.freeze(value) : null;
    }

    // Shadow DOM
    private shadowRoot: ShadowRoot | null = null;
    private cachedCss: string = '';
    private cssLoaded: boolean = false;
    private isInitialized: boolean = false;

    // Carousel state
    private carouselState: {
        container: HTMLElement;
        carousel: HTMLElement;
        track: HTMLElement;
        originalSlides: string[];
        totalOriginal: number;
        currentIndex: number;
        slidesPerView: number;
        slideWidth: number;
        isAnimating: boolean;
        touchStartX: number;
        touchCurrentX: number;
        isDragging: boolean;
        indicators?: HTMLElement;
    } | null = null;

    private currentSlide = 0;
    private autoScrollInterval?: number;
    private carouselResizeObserver?: ResizeObserver;
    private resizeTimeout?: number;
    private responsiveStyleElement?: HTMLStyleElement;

    // Font loading cache
    private static loadedFontUrls = new Set<string>();

    // Analytics (per-istanza)
    private analyticsEnabled = false;
    private analyticsSessionId = '';
    private analyticsIntersectionObserver?: IntersectionObserver;
    private analyticsClickHandler: (e: Event) => void;
    private pluginClickShieldHandler: (e: Event) => void;
    private analyticsImpressionMap = new Map<Element, { entryTime: number; reported: boolean }>();
    private analyticsLastScrollTrack = 0;
    private readonly ANALYTICS_SCROLL_THROTTLE_MS = 2_000;
    private readonly ANALYTICS_IMPRESSION_THRESHOLD = 0.5;
    private readonly ANALYTICS_IMPRESSION_MIN_TIME_MS = 1_000;

    // Global tracking (per-istanza)
    private globalClickHandler: (e: MouseEvent) => void;
    private globalScrollHandler: () => void;
    private globalScrollRafId?: number;
    private globalScrollTicking = false;
    private globalScrollReachedBuckets = new Set<number>();
    private static readonly SCROLL_DEPTH_BUCKETS = [10, 25, 50, 75, 90, 100] as const;
    private static readonly pluginHandledClickEvents = new WeakSet<Event>();

    // Sequence counter per sessione (replay ordering)
    private analyticsSequence = 0;

    constructor() {
        // Bind singolo nel costruttore: logica su prototype, reference stabile per add/removeEventListener.
        this.analyticsClickHandler = this.handleAnalyticsClick.bind(this);
        this.pluginClickShieldHandler = this.handlePluginClickShield.bind(this);
        this.globalClickHandler = this.handleGlobalClick.bind(this);
        this.globalScrollHandler = this.handleGlobalScroll.bind(this);
    }
    private getCssCacheKey(): string {
        return `${this.options?.slug}::${this.FP_VERSION}`;
    }
    private removeAllContent(): void {
        // Pulisce shadow DOM
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }

        // Pulisce container principale
        if (this.options?.container) {
            this.options.container.innerHTML = '';
        }
        const slug = this.options?.slug?.trim();
        if (slug) {
            const attrName = `fp-${slug}`.toLowerCase();
            const escapeAttrName =
                typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
                    ? CSS.escape(attrName)
                    : attrName.replace(/[^a-zA-Z0-9_-]/g, '\\$&');

            document.querySelectorAll(`[${escapeAttrName}]`).forEach(el => el.remove());
        }

        this.cleanupCarousel();
    }
    // ============================================
    // PUBLIC METHODS
    // ============================================

    /**
     * Inizializza il plugin con le opzioni fornite
     */
    public async init(options: FPOptions): Promise<void> {
        if (this.isInitialized) {
            fpLogger.warn('[FP] Plugin già inizializzato. Usa setOptions() per modificare le opzioni.');
            return;
        }

        // Migra opzioni legacy
        // this.options = this.migrateOptions(options);
        this.options = options;
        this.FP_VERSION = this.options?.version || '1.0.0';
        this.loadFromStorage();

        // Ottieni token prima di tutto
        await this.getToken();

        const slug = this.options?.slug;
        if (!slug) {
            throw new Error('[FP] Slug mancante.');
        }
        await this.getSettingFromApi(slug);
        fpLogger.log("QUESTI SONO GLI OPTIONS QUERY");
        fpLogger.log(this.optionsQuery);
        // Per mode refs-html, carica CSS e prepara Shadow DOM
        if (this.optionsQuery?.mode === 'refs-html') {
            await this.loadCss();
            await this.setupShadowDOM();
        }

        // Inietta stili responsive nel light DOM
        this.injectResponsiveStyles();

        this.isInitialized = true;
        fpLogger.log('[FP] Plugin inizializzato con successo');

        // Auto-abilita tracking se configurato
        if (this.options?.tracking?.enabled) {
            this.enableTracking();
        }
    }

    public async getSettingFromApi(slug: string): Promise<void> {
        if (slug == "") {
            throw new Error("[FP] Slug mancante.")
        }
        let endpoint = `/external/filter-templates/slug/${slug}`;
        if (this.options?.templateVersion !== undefined) {
            endpoint += `?version=${this.options.templateVersion}`;
        }

        const result = await this.secureFetch<{
            data: any;
            success: boolean;
            timestamp: Date;
        }>(endpoint)
        if (!result.success) {
            throw new Error("[FP] Chiamata per impostazioni non andata a buon fine");
        }

        // Mappa i dati dal formato snake_case del backend al formato camelCase atteso dal plugin
        const backendData = result.data;
        this.optionsQuery = {
            type: backendData.render_type || 'grid',
            mode: backendData.endpoint_type || 'refs',
            filters: backendData.filters || [],
            template_id: backendData.template_ids || [],
            tipo_export: backendData.export_codes || [],
            autoScroll: backendData.auto_scroll ?? true,
            scrollSpeed: backendData.scroll_speed || 5000,
            showIndicators: backendData.show_indicators ?? true,
            showNavButtons: backendData.show_nav_buttons ?? true
        };
    }
    /**
     * Aggiorna le opzioni del plugin
     */
    public setOptions(options: Partial<FPOptions>): void {
        if (!this.isInitialized) {
            throw new Error('[FP] Plugin non inizializzato. Chiama init() prima di setOptions().');
        }

        //this.options = this.migrateOptions({ ...this.options!, ...options });

        // Riapplica stili
        this.applyStylesToHost();
        this.injectResponsiveStyles();

        fpLogger.log('[FP] Opzioni aggiornate');
    }

    /**
     * Verifica se il plugin è inizializzato
     */
    public isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Carica e renderizza i contenuti
     */
    public async render(): Promise<void> {
        if (!this.isInitialized || !this.options) {
            throw new Error('[FP] Plugin non inizializzato. Chiama init() prima di render().');
        }

        let endpoint: string;
        const body: Record<string, unknown> = {};

        switch (this.optionsQuery?.mode) {
            case 'files':
                endpoint = '/external/files';
                if (this.optionsQuery.tipo_export) {
                    body.tipo_export = this.optionsQuery.tipo_export;
                }
                break;
            case 'refs-html':
                endpoint = '/external/refs-html';
                if (this.optionsQuery.template_id) {
                    body.template_id = this.optionsQuery.template_id;
                }
                break;
            case 'refs':
            default:
                endpoint = '/external/refs';
                if (this.optionsQuery?.template_id) {
                    body.template_id = this.optionsQuery.template_id;
                }
                break;
        }

        if (this.optionsQuery?.filters) {
            body.filters = this.optionsQuery.filters;
        }

        this.trackAnalyticsEvent(PluginEventType.RENDER_START, { mode: this.optionsQuery?.mode, type: this.optionsQuery?.type });
        const renderStartTime = Date.now();

        const data = await this.secureFetch<{ success: boolean; data: any }>(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        this.renderContent(data);

        this.trackAnalyticsEvent(PluginEventType.RENDER_COMPLETE, {
            mode: this.optionsQuery?.mode,
            type: this.optionsQuery?.type,
            durationMs: Date.now() - renderStartTime,
        });
    }

    // ============================================
    // ANALYTICS TRACKING
    // ============================================

    /**
     * Abilita il tracking analytics per questa istanza.
     * Condivide un singolo WebSocket tra tutte le istanze FP sulla pagina.
     */
    public enableTracking(): void {
        if (this.analyticsEnabled || !this.options) return;

        this.analyticsEnabled = true;
        // Recupera o genera il sessionId
        const sessionIdSaved = window.localStorage.getItem(this.KEY_SESSION_ID_STORAGE);
        if (sessionIdSaved) {
            this.analyticsSessionId = sessionIdSaved;
        } else {
            this.analyticsSessionId = this.generateUUID();
            window.localStorage.setItem(this.KEY_SESSION_ID_STORAGE, this.analyticsSessionId);
        }
        this.analyticsSequence = 0;
        const manager = PluginAnalyticsManager.getInstance();
        manager.register(this, {
            apiUrl: this.options.url,
            getToken: () => this.getToken(),
            getBrowserHash: () => this.cachedBrowserHash,
            sessionId: this.analyticsSessionId,
            getCurrentSessionId: () => this.analyticsSessionId,
            getNextSequence: () => ++this.analyticsSequence,
            onSessionResumed: (result) => {
                if (result.expired) {
                    // Sessione scaduta (>1 giorno): nuova sessione, sequenza da 0
                    this.analyticsSessionId = this.generateUUID();
                    window.localStorage.setItem(this.KEY_SESSION_ID_STORAGE, this.analyticsSessionId);
                    this.analyticsSequence = 0;
                    fpLogger.log(`[FP] Sessione scaduta, nuova sessione: ${this.analyticsSessionId}`);
                } else {
                    // Riprendi dall'ultima sequenza salvata
                    this.analyticsSequence = result.lastSequence;
                    fpLogger.log(`[FP] Sessione ripresa da sequenza: ${this.analyticsSequence}`);
                }
            },
            wsPort: this.options.tracking?.wsPort,
        });

        // Setup osservatori per-istanza
        if (this.options.tracking?.trackImpressions !== false) {
            this.setupAnalyticsIntersectionObserver();
        }
        if (this.options.tracking?.trackClicks !== false) {
            this.setupAnalyticsClickDelegation();
        }

        // Setup global tracking (click & scroll su tutta la pagina)
        this.setupGlobalTracking();

        this.trackAnalyticsEvent(PluginEventType.PLUGIN_INIT, {
            mode: this.optionsQuery?.mode,
            type: this.optionsQuery?.type,
        });

        fpLogger.log('[FP] Analytics tracking abilitato');
    }

    /**
     * Disabilita il tracking analytics per questa istanza.
     */
    public disableTracking(): void {
        if (!this.analyticsEnabled) return;

        this.trackAnalyticsEvent(PluginEventType.SESSION_END);

        // Pulizia osservatori per-istanza
        if (this.analyticsIntersectionObserver) {
            this.analyticsIntersectionObserver.disconnect();
            this.analyticsIntersectionObserver = undefined;
        }
        this.analyticsImpressionMap.clear();

        const root = this.shadowRoot || this.options?.container;
        root?.removeEventListener('click', this.analyticsClickHandler);

        // Teardown global tracking
        this.teardownGlobalTracking();

        const manager = PluginAnalyticsManager.getInstance();
        manager.unregister(this);

        this.analyticsEnabled = false;
        fpLogger.log('[FP] Analytics tracking disabilitato');
    }

    /**
     * Traccia un evento analytics custom.
     */
    public trackEvent<T extends string>(type: T, data?: AnalyticsDataFor<T>): void {
        this.trackAnalyticsEvent(type, data);
    }

    private getViewportContext(): AnalyticsViewport {
        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            scrollX: Math.round(window.scrollX),
            scrollY: Math.round(window.scrollY),
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
        };
    }

    private trackAnalyticsEvent<T extends string>(type: T, data?: AnalyticsDataFor<T>): void {
        if (!this.analyticsEnabled || !this.options) return;

        const event: AnalyticsEvent<T> = {
            eventId: this.generateUUID(),
            type,
            timestamp: new Date().toISOString(),
            slug: this.options.slug,
            fpVersion: this.FP_VERSION,
            pageOrigin: location.origin,
            pagePath: location.pathname,
            sessionId: '', // Assegnato al flush dal manager
            sequence: 0,   // Assegnato al flush dal manager
            viewport: this.getViewportContext(),
            data,
        };

        PluginAnalyticsManager.getInstance().trackEvent(this, event);
    }

    private setupAnalyticsIntersectionObserver(): void {
        this.analyticsIntersectionObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= this.ANALYTICS_IMPRESSION_THRESHOLD) {
                        const existing = this.analyticsImpressionMap.get(entry.target);
                        if (!existing || existing.reported) {
                            this.analyticsImpressionMap.set(entry.target, {
                                entryTime: Date.now(),
                                reported: false,
                            });
                        }
                    } else {
                        const tracked = this.analyticsImpressionMap.get(entry.target);
                        if (tracked && !tracked.reported) {
                            const dwellMs = Date.now() - tracked.entryTime;
                            if (dwellMs >= this.ANALYTICS_IMPRESSION_MIN_TIME_MS) {
                                tracked.reported = true;
                                const itemId = entry.target.getAttribute('data-fp-item-id') || '';
                                const codiceRef = entry.target.getAttribute('codice-ref') || '';
                                const rectData = this.getElementRectData(entry.target);
                                const elementType = this.detectElementType(entry.target);
                                this.trackAnalyticsEvent(PluginEventType.ITEM_IMPRESSION, {
                                    itemId,
                                    codiceRef,
                                    dwellMs,
                                    ...rectData,
                                    elementType,
                                });
                            }
                        }
                    }
                }
            },
            { threshold: [0, this.ANALYTICS_IMPRESSION_THRESHOLD, 1.0] }
        );
    }

    private setupAnalyticsClickDelegation(): void {
        const root = this.shadowRoot || this.options?.container;
        root?.addEventListener('click', this.analyticsClickHandler);
    }

    private handleAnalyticsClick(e: Event): void {
        FP.pluginHandledClickEvents.add(e);

        const target = e.target as HTMLElement;
        const item = target.closest('[data-fp-item-id]');
        if (!item) return;

        const mouseEvent = e as MouseEvent;
        const rectData = this.getElementRectData(item);
        const codiceRef = item.getAttribute('codice-ref') || '';

        this.trackAnalyticsEvent(PluginEventType.ITEM_CLICK, {
            itemId: item.getAttribute('data-fp-item-id') || '',
            codiceRef,
            tagName: target.tagName.toLowerCase(),
            // Coordinate mouse al momento del click
            clientX: mouseEvent.clientX,
            clientY: mouseEvent.clientY,
            pageX: mouseEvent.pageX,
            pageY: mouseEvent.pageY,
            // Bounding rect dell'item cliccato (per replay/heatmap)
            ...rectData,
            // Contesto DOM dell'elemento cliccato
            innerTagName: target.tagName.toLowerCase(),
            innerClassName: typeof target.className === 'string'
                ? target.className.trim().slice(0, 100) || undefined
                : undefined,
            domPath: this.buildDomPath(target),
            elementType: this.detectElementType(target),
        });
    }

    /**
     * Osserva gli elementi renderizzati per impression tracking
     */
    private observeRenderedItems(): void {
        if (!this.analyticsEnabled || !this.analyticsIntersectionObserver) return;

        // Disconnetti osservazioni precedenti
        this.analyticsIntersectionObserver.disconnect();
        this.analyticsImpressionMap.clear();

        const root = this.shadowRoot || this.options?.container;
        if (!root) return;

        const items = root.querySelectorAll('[data-fp-item-id]');
        items.forEach(item => {
            this.analyticsIntersectionObserver!.observe(item);
        });
    }

    private trackScrollDepth(depth: number): void {
        const now = Date.now();
        if (now - this.analyticsLastScrollTrack < this.ANALYTICS_SCROLL_THROTTLE_MS) return;
        this.analyticsLastScrollTrack = now;
        this.trackAnalyticsEvent(PluginEventType.SCROLL_DEPTH, { depth });
    }

    // ============================================
    // ANALYTICS HELPERS
    // ============================================

    private getElementRectData(el: Element): ElementRectData {
        const rect = el.getBoundingClientRect();
        return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            absoluteX: Math.round(rect.x + window.scrollX),
            absoluteY: Math.round(rect.y + window.scrollY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };
    }

    private detectElementType(el: Element): string {
        const tag = el.tagName.toLowerCase();
        if (tag === 'a' || el.closest('a')) return 'link';
        if (tag === 'button' || el.closest('button') || (el as HTMLElement).getAttribute('role') === 'button') return 'button';
        if (tag === 'img' || tag === 'picture' || tag === 'svg') return 'image';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
        if (el.closest('[data-fp-item-id]')) return 'fp-item';
        const carouselContext = this.detectCarouselContext(el);
        if (carouselContext) return 'carousel';
        return 'generic';
    }

    private detectCarouselContext(el: Element): string | null {
        const selectors = [
            '.fp-refs-carousel', '.fp-refs-carousel-container',
            '[class*="carousel"]', '[class*="slider"]',
            '[class*="swiper"]', '[class*="slick"]',
            '[class*="splide"]', '[class*="glide"]',
        ];
        for (const sel of selectors) {
            const match = el.closest(sel);
            if (match) {
                const cls = match.className || '';
                if (cls.includes('swiper')) return 'swiper';
                if (cls.includes('slick')) return 'slick';
                if (cls.includes('splide')) return 'splide';
                if (cls.includes('glide')) return 'glide';
                if (cls.includes('slider')) return 'slider';
                return 'carousel';
            }
        }
        return null;
    }

    private buildDomPath(el: Element, maxDepth = 5): string {
        const parts: string[] = [];
        let current: Element | null = el;
        for (let i = 0; i < maxDepth && current && current !== document.documentElement; i++) {
            const tag = current.tagName.toLowerCase();
            const id = current.id ? `#${current.id}` : '';
            const cls = current.className && typeof current.className === 'string'
                ? '.' + current.className.trim().split(/\s+/).slice(0, 2).join('.')
                : '';
            parts.unshift(`${tag}${id}${cls}`);
            current = current.parentElement;
        }
        return parts.join(' > ');
    }

    private getSafeTextSnippet(el: Element): string {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return '';
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
        return text.slice(0, 50);
    }

    private extractCodiceRef(html: string): string {
        const match = html.match(/codice-ref="([^"]*)"/);
        return match?.[1] ?? '';
    }

    private getScrollDepthBucket(percent: number): number {
        for (const bucket of FP.SCROLL_DEPTH_BUCKETS) {
            if (percent <= bucket) return bucket;
        }
        return 100;
    }

    // ============================================
    // GLOBAL TRACKING
    // ============================================

    private setupGlobalTracking(): void {
        this.setupPluginClickShield();
        this.setupGlobalClickTracking();
        this.setupGlobalScrollTracking();
    }

    private setupPluginClickShield(): void {
        const root = this.shadowRoot || this.options?.container;
        if (!root) return;

        root.addEventListener('click', this.pluginClickShieldHandler);
    }

    private setupGlobalClickTracking(): void {
        // Bubble phase: si attiva DOPO i listener interni del plugin sul root,
        // cosi' il click e' gia' presente nel WeakSet quando arriviamo qui
        document.addEventListener('click', this.globalClickHandler);
    }

    private setupGlobalScrollTracking(): void {
        this.globalScrollReachedBuckets.clear();
        this.globalScrollTicking = false;
        window.addEventListener('scroll', this.globalScrollHandler, { passive: true });
    }

    private handlePluginClickShield(e: Event): void {
        FP.pluginHandledClickEvents.add(e);
    }

    private handleGlobalClick(e: MouseEvent): void {
        // Se il click e' stato gestito da listener interni al plugin, ignora global:click
        if (FP.pluginHandledClickEvents.has(e)) return;

        // Resolve target through Shadow DOM composedPath
        const path = e.composedPath?.() as Element[] | undefined;
        const target = (path?.[0] ?? e.target) as Element;
        if (!target || !(target instanceof Element)) return;

        // Non tracciare global:click sui controlli del carosello (frecce/dot)
        const carouselControlSelector = '.fp-carousel-nav, .fp-carousel-indicator, .fp-indicator, [part="carousel-prev"], [part="carousel-next"], [part="carousel-indicator"]';
        const isCarouselControlClick = Boolean(
            target.closest(carouselControlSelector)
            || path?.some(el => el instanceof Element && el.matches(carouselControlSelector))
        );
        if (isCarouselControlClick) return;

        // Safety net: se il click è su un item FP, lascia gestire a item:click
        const fpItem = target.closest('[data-fp-item-id]')
            || path?.find(el => el instanceof Element && el.hasAttribute('data-fp-item-id'));
        if (fpItem) return;

        const rectData = this.getElementRectData(target);
        const elementType = this.detectElementType(target);
        const carouselContext = this.detectCarouselContext(target);

        this.trackAnalyticsEvent(PluginEventType.GLOBAL_CLICK, {
            clientX: e.clientX,
            clientY: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
            ...rectData,
            tagName: target.tagName.toLowerCase(),
            id: (target as HTMLElement).id || undefined,
            className: typeof target.className === 'string'
                ? target.className.trim().slice(0, 100) || undefined
                : undefined,
            textSnippet: this.getSafeTextSnippet(target) || undefined,
            domPath: this.buildDomPath(target),
            elementType,
            carouselContext: carouselContext || undefined,
        });
    }

    private handleGlobalScroll(): void {
        if (this.globalScrollTicking) return;
        this.globalScrollTicking = true;

        if (this.globalScrollRafId) {
            cancelAnimationFrame(this.globalScrollRafId);
        }

        this.globalScrollRafId = requestAnimationFrame(() => {
            this.globalScrollTicking = false;

            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const viewportHeight = window.innerHeight;
            const documentHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );

            if (documentHeight <= viewportHeight) return;

            const depthPercent = Math.min(
                100,
                Math.round(((scrollTop + viewportHeight) / documentHeight) * 100)
            );
            const depthBucket = this.getScrollDepthBucket(depthPercent);

            if (!this.globalScrollReachedBuckets.has(depthBucket)) {
                this.globalScrollReachedBuckets.add(depthBucket);

                this.trackAnalyticsEvent(PluginEventType.GLOBAL_SCROLL, {
                    scrollTop: Math.round(scrollTop),
                    viewportHeight,
                    documentHeight,
                    depthPercent,
                    depthBucket,
                });
            }
        });
    }

    private teardownGlobalTracking(): void {
        const root = this.shadowRoot || this.options?.container;
        root?.removeEventListener('click', this.pluginClickShieldHandler);
        document.removeEventListener('click', this.globalClickHandler);
        window.removeEventListener('scroll', this.globalScrollHandler);

        if (this.globalScrollRafId) {
            cancelAnimationFrame(this.globalScrollRafId);
            this.globalScrollRafId = undefined;
        }

        this.globalScrollTicking = false;
        this.globalScrollReachedBuckets.clear();
    }

    private generateUUID(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    // ============================================
    // LIFECYCLE
    // ============================================

    /**
     * Pulisce e resetta il plugin
     */
    public destroy(): void {
        this.disableTracking();
        this.cleanupCarousel();

        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }

        if (this.options?.container) {
            this.options.container.innerHTML = '';
        }

        // Rimuovi stili responsive
        if (this.responsiveStyleElement) {
            this.responsiveStyleElement.remove();
            this.responsiveStyleElement = undefined;
        }

        this.isInitialized = false;
        this.cssLoaded = false;
        this.cachedCss = '';
        this.currentSlide = 0;

        fpLogger.log('[FP] Plugin distrutto');
    }

    /**
     * Ricarica il CSS dal server
     */
    public async reloadCss(): Promise<void> {
        this.cssLoaded = false;
        this.cachedCss = '';

        await this.loadCss();

        if (this.shadowRoot && this.constructedStyleSheet) {
            this.shadowRoot.adoptedStyleSheets = [
                ...this.shadowRoot.adoptedStyleSheets.filter(s => s !== this.constructedStyleSheet),
                this.constructedStyleSheet
            ];
        }
    }

    /**
     * Ottiene il CSS come stringa
     */
    public async getCss(): Promise<string> {
        if (!this.cssLoaded) {
            await this.getToken();
            await this.loadCss();
        }
        return this.cachedCss;
    }

    // ============================================
    // OPTIONS MIGRATION (Legacy support)
    // ============================================

    /**
     * Migra opzioni legacy al nuovo formato
     */
    // private migrateOptions(options: FPOptions): FPOptions {
    //     const migrated = { ...options };

    //     // Migra styleVars → styles
    //     if (options.styleVars && !options.styles) {
    //         fpLogger.warn('[FP] `styleVars` is deprecated. Use `styles` instead.');
    //         migrated.styles = this.styleVarsToStyles(options.styleVars);
    //     }

    //     // Migra renderOptions → styles
    //     if (options.renderOptions) {
    //         fpLogger.warn('[FP] `renderOptions` is deprecated. Use `styles` instead.');

    //         if (!migrated.styles) {
    //             migrated.styles = {};
    //         }

    //         if (options.renderOptions.gap) {
    //             migrated.styles.gap = options.renderOptions.gap;
    //         }
    //         if (options.renderOptions.padding) {
    //             migrated.styles.padding = options.renderOptions.padding;
    //         }
    //         if (options.renderOptions.maxItems) {
    //             migrated.styles.grid = migrated.styles.grid || {};
    //             migrated.styles.grid.maxItems = options.renderOptions.maxItems;
    //         }
    //         if (options.renderOptions.minItemWidth) {
    //             migrated.styles.grid = migrated.styles.grid || {};
    //             migrated.styles.grid.minItemWidth = options.renderOptions.minItemWidth;
    //         }
    //         if (options.renderOptions.columns) {
    //             migrated.styles.grid = migrated.styles.grid || {};
    //             migrated.styles.grid.columns = options.renderOptions.columns;
    //         }
    //         if (options.renderOptions.showNavButtons !== undefined) {
    //             migrated.showNavButtons = options.renderOptions.showNavButtons;
    //         }
    //     }

    //     return migrated;
    // }

    /**
     * Converte styleVars legacy in FPStyles
     */
    private styleVarsToStyles(styleVars: Record<string, string>): FPStyles {
        const styles: FPStyles = { grid: {}, carousel: {} };

        for (const [key, value] of Object.entries(styleVars)) {
            switch (key) {
                case '--fp-gap':
                    styles.gap = value;
                    break;
                case '--fp-scale':
                    styles.scale = parseFloat(value);
                    break;
                case '--fp-max-width':
                    styles.maxWidth = value;
                    break;
                case '--fp-padding':
                    styles.padding = value;
                    break;
                case '--fp-grid-columns':
                    styles.grid!.columns = value;
                    break;
                case '--fp-grid-min-item-width':
                    styles.grid!.minItemWidth = value;
                    break;
                case '--fp-grid-max-items':
                    styles.grid!.maxItems = value === 'none' ? 0 : parseInt(value, 10);
                    break;
                case '--fp-grid-item-height':
                    styles.grid!.itemHeight = value;
                    break;
                case '--fp-carousel-item-width':
                    styles.carousel!.itemWidth = value;
                    break;
                case '--fp-carousel-item-max-width':
                    styles.carousel!.itemMaxWidth = value;
                    break;
                case '--fp-carousel-snap-align':
                    styles.carousel!.snapAlign = value as 'start' | 'center' | 'end';
                    break;
                case '--fp-carousel-scroll-behavior':
                    styles.carousel!.scrollBehavior = value as 'smooth' | 'auto';
                    break;
                case '--fp-carousel-transition-duration':
                    styles.carousel!.transitionDuration = value;
                    break;
                case '--fp-carousel-indicator-color':
                    styles.carousel!.indicatorColor = value;
                    break;
                case '--fp-carousel-indicator-active-color':
                    styles.carousel!.indicatorActiveColor = value;
                    break;
                case '--fp-carousel-nav-size':
                    styles.carousel!.navSize = value;
                    break;
                case '--fp-carousel-nav-bg':
                    styles.carousel!.navBg = value;
                    break;
                case '--fp-carousel-nav-bg-hover':
                    styles.carousel!.navBgHover = value;
                    break;
                case '--fp-carousel-nav-color':
                    styles.carousel!.navColor = value;
                    break;
            }
        }

        return styles;
    }

    // ============================================
    // STYLES TO CSS VARIABLES
    // ============================================

    /**
     * Converte FPStyles in CSS variables
     */
    private stylesToCssVars(styles?: FPStyles): Record<string, string> {
        const vars: Record<string, string> = {};

        if (!styles) return vars;

        // General
        if (styles.gap !== undefined) vars['--fp-gap'] = styles.gap;
        if (styles.scale !== undefined) vars['--fp-scale'] = String(styles.scale);
        if (styles.maxWidth !== undefined) vars['--fp-max-width'] = styles.maxWidth;
        if (styles.padding !== undefined) vars['--fp-padding'] = styles.padding;

        // Grid
        if (styles.grid) {
            if (styles.grid.columns !== undefined) {
                vars['--fp-grid-columns'] = typeof styles.grid.columns === 'number'
                    ? String(styles.grid.columns)
                    : styles.grid.columns;
            }
            if (styles.grid.minItemWidth !== undefined) {
                vars['--fp-grid-min-item-width'] = styles.grid.minItemWidth;
            }
            if (styles.grid.maxItems !== undefined) {
                vars['--fp-grid-max-items'] = styles.grid.maxItems === 0 ? 'none' : String(styles.grid.maxItems);
            }
            if (styles.grid.itemHeight !== undefined) {
                vars['--fp-grid-item-height'] = styles.grid.itemHeight;
            }
        }

        // Carousel
        if (styles.carousel) {
            if (styles.carousel.itemWidth !== undefined) {
                vars['--fp-carousel-item-width'] = styles.carousel.itemWidth;
            }
            if (styles.carousel.itemMaxWidth !== undefined) {
                vars['--fp-carousel-item-max-width'] = styles.carousel.itemMaxWidth;
            }
            if (styles.carousel.snapAlign !== undefined) {
                vars['--fp-carousel-snap-align'] = styles.carousel.snapAlign;
            }
            if (styles.carousel.scrollBehavior !== undefined) {
                vars['--fp-carousel-scroll-behavior'] = styles.carousel.scrollBehavior;
            }
            if (styles.carousel.transitionDuration !== undefined) {
                vars['--fp-carousel-transition-duration'] = styles.carousel.transitionDuration;
            }
            if (styles.carousel.indicatorColor !== undefined) {
                vars['--fp-carousel-indicator-color'] = styles.carousel.indicatorColor;
            }
            if (styles.carousel.indicatorActiveColor !== undefined) {
                vars['--fp-carousel-indicator-active-color'] = styles.carousel.indicatorActiveColor;
            }
            if (styles.carousel.navSize !== undefined) {
                vars['--fp-carousel-nav-size'] = styles.carousel.navSize;
            }
            if (styles.carousel.navBg !== undefined) {
                vars['--fp-carousel-nav-bg'] = styles.carousel.navBg;
            }
            if (styles.carousel.navBgHover !== undefined) {
                vars['--fp-carousel-nav-bg-hover'] = styles.carousel.navBgHover;
            }
            if (styles.carousel.navColor !== undefined) {
                vars['--fp-carousel-nav-color'] = styles.carousel.navColor;
            }
        }

        return vars;
    }

    /**
     * Applica gli stili sull'host element
     */
    private applyStylesToHost(): void {
        if (!this.shadowRoot || !this.options) return;

        const host = this.shadowRoot.host as HTMLElement;
        const vars = this.stylesToCssVars(this.options.styles);

        for (const [key, value] of Object.entries(vars)) {
            host.style.setProperty(key, value);
        }
    }

    /**
     * Inietta stili responsive nel light DOM
     */
    private injectResponsiveStyles(): void {
        const responsive = this.options?.styles?.responsive;
        if (!responsive || Object.keys(responsive).length === 0) return;

        // Assicura che il container abbia un ID
        const container = this.options!.container;
        const hostId = container.id || `fp-${Date.now()}`;
        if (!container.id) {
            container.id = hostId;
        }

        // Rimuovi stili responsive precedenti
        if (this.responsiveStyleElement) {
            this.responsiveStyleElement.remove();
        }

        // Genera le media queries
        const mediaQueries = Object.entries(responsive)
            .sort(([a], [b]) => Number(b) - Number(a)) // Dal più grande al più piccolo
            .map(([breakpoint, styles]) => {
                const vars = this.stylesToCssVars(styles as FPStyles);
                const declarations = Object.entries(vars)
                    .map(([prop, val]) => `    ${prop}: ${val};`)
                    .join('\n');

                return `
@media screen and (max-width: ${breakpoint}px) {
    #${hostId} {
${declarations}
    }
}`;
            }).join('\n');

        // Crea e inietta lo style element
        this.responsiveStyleElement = document.createElement('style');
        this.responsiveStyleElement.setAttribute('data-fp-responsive', hostId);
        this.responsiveStyleElement.textContent = mediaQueries;
        document.head.appendChild(this.responsiveStyleElement);

        fpLogger.log('[FP] Stili responsive iniettati per', Object.keys(responsive).length, 'breakpoint');
    }

    // ============================================
    // GETTERS (con fallback ai defaults)
    // ============================================

    private getStyle<K extends keyof Omit<FPStyles, 'responsive'>>(key: K): FPStyles[K] {
        return this.options?.styles?.[key] ?? DEFAULT_STYLES[key];
    }

    private getGridStyle<K extends keyof FPGridStyles>(key: K): FPGridStyles[K] {
        return this.options?.styles?.grid?.[key] ?? DEFAULT_STYLES.grid[key];
    }

    private getCarouselStyle<K extends keyof FPCarouselStyles>(key: K): FPCarouselStyles[K] {
        return this.options?.styles?.carousel?.[key] ?? DEFAULT_STYLES.carousel[key];
    }

    /**
     * Ottiene il gap come numero
     */
    private getGapNumber(): number {
        const gap = this.getStyle('gap') as string;
        return parseInt(gap, 10) || 12;
    }

    /**
     * Ottiene la larghezza minima item carousel come numero
     */
    private getCarouselItemWidthNumber(): number {
        const width = this.getCarouselStyle('itemWidth') as string;
        return parseInt(width, 10) || 280;
    }

    /**
     * Ottiene il maxItems dalla grid
     */
    private getGridMaxItems(): number {
        // Prima controlla le opzioni JS
        const maxItems = this.getGridStyle('maxItems') as number;
        if (maxItems && maxItems > 0) return maxItems;

        // Poi controlla la CSS variable (per responsive via CSS esterno)
        const host = this.shadowRoot?.host as HTMLElement;
        if (host) {
            const val = getComputedStyle(host).getPropertyValue('--fp-grid-max-items').trim();
            if (val && val !== 'none') {
                const num = parseInt(val, 10);
                if (!isNaN(num) && num > 0) return num;
            }
        }

        return 0; // 0 = nessun limite
    }

    // ============================================
    // STORAGE
    // ============================================

    private loadFromStorage(): void {
        try {
            const storedToken = localStorage.getItem(this.STORAGE_KEY);
            if (storedToken) {
                const parsed = JSON.parse(storedToken) as EphemeralToken;
                if (!this.isTokenExpired(parsed)) {
                    this.cachedToken = parsed;
                } else {
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }

            const storedHash = localStorage.getItem(this.BROWSER_HASH_KEY);
            if (storedHash) {
                this.cachedBrowserHash = storedHash;
            }
        } catch {
            // Ignora errori localStorage
        }
    }

    private saveToStorage(): void {
        try {
            if (this.cachedToken) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cachedToken));
            }
            if (this.cachedBrowserHash) {
                localStorage.setItem(this.BROWSER_HASH_KEY, this.cachedBrowserHash);
            }
        } catch {
            // Ignora errori localStorage
        }
    }

    // ============================================
    // CSS LOADING
    // ============================================

    private async loadShadowStyles(urls: string[]): Promise<void> {
        if (!this.shadowRoot || !urls?.length) return;

        const sheets: CSSStyleSheet[] = [];

        for (const url of urls) {
            if (FP.shadowStyleCache.has(url)) {
                sheets.push(FP.shadowStyleCache.get(url)!);
                continue;
            }

            try {
                const cssText = await fetch(url).then(r => r.text());
                const sheet = new CSSStyleSheet();
                await sheet.replace(cssText);
                FP.shadowStyleCache.set(url, sheet);
                sheets.push(sheet);
                fpLogger.log('[FP] Shadow style caricato:', url);
            } catch (err) {
                fpLogger.warn('[FP] Impossibile caricare shadow style:', url, err);
            }
        }

        this.shadowRoot.adoptedStyleSheets = [
            ...this.shadowRoot.adoptedStyleSheets,
            ...sheets
        ];
    }

    private async loadCss(): Promise<void> {
        if (!this.options) return;

        const cacheKey = this.getCssCacheKey();

        // 1️⃣ Cache hit
        if (FP.cssCache.has(cacheKey)) {
            const cached = FP.cssCache.get(cacheKey)!;
            this.cachedCss = cached.cssText;
            this.constructedStyleSheet = cached.sheet;
            this.cssLoaded = true;
            return;
        }

        // 2️⃣ Fetch una sola volta
        const response = await this.secureFetch<{ success: boolean; data: CssResponse }>(
            '/external/css',
            { method: 'GET' }
        );

        if (!response.success || !response.data.css_text) {
            throw new Error('[FP] CSS non valido');
        }

        const cssText = response.data.css_text;
        const fontImports = this.extractFontImports(cssText);
        const sanitizedCss = this.stripImports(cssText);

        const sheet = new CSSStyleSheet();
        sheet.replaceSync(sanitizedCss);

        FP.cssCache.set(cacheKey, {
            cssText,
            sheet,
            fontImports
        });

        this.cachedCss = cssText;
        this.constructedStyleSheet = sheet;
        this.cssLoaded = true;
    }

    private extractFontImports(css: string): string[] {
        const imports: string[] = [];
        const regex = /@import\s+url\(([^)]+)\);/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(css)) !== null) {
            imports.push(match[1].replace(/['"]/g, '').trim());
        }

        return imports;
    }

    private async loadFontsFromImports(urls: string[]): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const url of urls) {
            if (FP.loadedFontUrls.has(url)) continue;
            FP.loadedFontUrls.add(url);

            promises.push(new Promise(resolve => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                link.onload = () => resolve();
                link.onerror = () => resolve();
                document.head.appendChild(link);
            }));
        }

        await Promise.all(promises);
        await document.fonts.ready;
    }

    private stripImports(css: string): string {
        return css.replace(/@import\s+url\([^)]+\);\s*/g, '');
    }

    // ============================================
    // SHADOW DOM SETUP
    // ============================================

    private async setupShadowDOM(): Promise<void> {
        if (!this.options) {
            throw new Error('[FP] Plugin non inizializzato');
        }

        const container = this.options.container;

        // Shadow root
        if (!container.shadowRoot) {
            this.shadowRoot = container.attachShadow({ mode: 'open' });
        } else {
            this.shadowRoot = container.shadowRoot;
        }

        // Applica stili sull'host
        this.applyStylesToHost();

        const sheets: CSSStyleSheet[] = [];

        // Shadow styles aggiuntivi
        if (this.options.shadowStyles?.length) {
            await this.loadShadowStyles(this.options.shadowStyles);
            for (const url of this.options.shadowStyles) {
                const sheet = FP.shadowStyleCache.get(url);
                if (sheet) sheets.push(sheet);
            }
        }

        // Font import
        const fontImports = this.extractFontImports(this.cachedCss);
        await this.loadFontsFromImports(fontImports);

        // CSS base
        const sanitizedCss = this.stripImports(this.cachedCss);

        if (!this.constructedStyleSheet) {
            this.constructedStyleSheet = new CSSStyleSheet();
        }

        await this.constructedStyleSheet.replace(`
:host {
    --fp-gap: ${DEFAULT_STYLES.gap};
    --fp-scale: ${DEFAULT_STYLES.scale};
    --fp-max-width: ${DEFAULT_STYLES.maxWidth};
    --fp-padding: ${DEFAULT_STYLES.padding};

    /* Grid */
    --fp-grid-columns: ${DEFAULT_STYLES.grid.columns};
    --fp-grid-min-item-width: ${DEFAULT_STYLES.grid.minItemWidth};
    --fp-grid-max-items: ${DEFAULT_STYLES.grid.maxItems === 0 ? 'none' : DEFAULT_STYLES.grid.maxItems};
    --fp-grid-item-height: ${DEFAULT_STYLES.grid.itemHeight};

    /* Carousel */
    --fp-carousel-item-width: ${DEFAULT_STYLES.carousel.itemWidth};
    --fp-carousel-item-max-width: ${DEFAULT_STYLES.carousel.itemMaxWidth};
    --fp-carousel-snap-align: ${DEFAULT_STYLES.carousel.snapAlign};
    --fp-carousel-scroll-behavior: ${DEFAULT_STYLES.carousel.scrollBehavior};
    --fp-carousel-transition-duration: ${DEFAULT_STYLES.carousel.transitionDuration};
    --fp-carousel-indicator-color: ${DEFAULT_STYLES.carousel.indicatorColor};
    --fp-carousel-indicator-active-color: ${DEFAULT_STYLES.carousel.indicatorActiveColor};
    --fp-carousel-nav-size: ${DEFAULT_STYLES.carousel.navSize};
    --fp-carousel-nav-bg: ${DEFAULT_STYLES.carousel.navBg};
    --fp-carousel-nav-bg-hover: ${DEFAULT_STYLES.carousel.navBgHover};
    --fp-carousel-nav-color: ${DEFAULT_STYLES.carousel.navColor};
}

:host,
.fp-refs-root,
.fp-ref-item {
    display: flex;
    font-family: inherit;
}

.fp-refs-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--fp-gap);
    width: 100%;
    box-sizing: border-box;
}

.fp-ref-item {
    max-width: var(--fp-max-width);
    transform: scale(var(--fp-scale));
    transform-origin: top left;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

/* ===== GRID LAYOUT ===== */
.fp-refs-grid {
    display: grid;
    grid-template-columns: repeat(var(--fp-grid-columns), minmax(var(--fp-grid-min-item-width), 1fr));
    gap: var(--fp-gap);
    padding: var(--fp-padding);
    align-content: start;
    width: 100%;
    box-sizing: border-box;
}

.fp-refs-grid .fp-ref-item {
    height: var(--fp-grid-item-height);
}

/* ===== CAROUSEL LAYOUT ===== */
.fp-refs-carousel-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.fp-refs-carousel {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
}

.fp-carousel-track {
    display: flex;
    height: 100%;
    transition: transform var(--fp-carousel-transition-duration) ease-out;
    will-change: transform;
}

.fp-carousel-track.no-transition {
    transition: none;
}

.fp-carousel-slide {
    flex-shrink: 0;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 0 calc(var(--fp-gap) / 2);
}

.fp-carousel-slide .fp-ref-item {
    width: 100%;
    height: auto;
}

/* Bottoni navigazione */
.fp-carousel-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--fp-carousel-nav-size);
    height: var(--fp-carousel-nav-size);
    background: var(--fp-carousel-nav-bg);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fp-carousel-nav-color);
    font-size: 18px;
    transition: background 0.3s, opacity 0.3s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fp-carousel-nav:hover {
    background: var(--fp-carousel-nav-bg-hover);
}

.fp-carousel-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.fp-carousel-prev { left: 8px; }
.fp-carousel-next { right: 8px; }

/* Indicatori */
.fp-carousel-indicators {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 12px 0;
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
}

.fp-carousel-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--fp-carousel-indicator-color);
    cursor: pointer;
    transition: background 0.3s, transform 0.3s;
    border: none;
    padding: 0;
}

.fp-carousel-indicator.active {
    background: var(--fp-carousel-indicator-active-color);
    transform: scale(1.3);
}

/* ===== EMPTY STATE ===== */
.fp-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--fp-padding);
    color: #666;
    font-size: 16px;
    min-height: 200px;
    grid-column: 1 / -1;
    width: 100%;
}

${sanitizedCss}
        `);

        // ClassNames bridge
        if (this.options.classNames) {
            const style = document.createElement('style');
            style.setAttribute('data-fp-classnames-bridge', 'true');
            const rules: string[] = [];

            if (this.options.classNames.refsWrapper) {
                rules.push(`.${this.options.classNames.refsWrapper} {
                    display: flex;
                    flex-direction: column;
                    gap: var(--fp-gap);
                    width: 100%;
                    box-sizing: border-box;
                }`);
            }

            if (this.options.classNames.refItem) {
                rules.push(`.${this.options.classNames.refItem} {
                    max-width: var(--fp-max-width);
                    transform: scale(var(--fp-scale));
                    transform-origin: top left;
                }`);
            }

            if (this.options.classNames.refsRoot) {
                rules.push(`.${this.options.classNames.refsRoot} {
                    width: 100%;
                    box-sizing: border-box;
                }`);
            }

            style.textContent = rules.join('\n');
            this.shadowRoot.appendChild(style);
        }

        this.shadowRoot.adoptedStyleSheets = [...sheets, this.constructedStyleSheet];

        fpLogger.log('[FP] Shadow DOM inizializzato');
    }

    // ============================================
    // TOKEN MANAGEMENT
    // ============================================

    private async getToken(): Promise<string> {
        if (this.cachedToken && !this.isTokenExpired(this.cachedToken)) {
            return this.cachedToken.token;
        }

        this.cachedToken = await this.requestEphemeralToken();
        return this.cachedToken.token;
    }

    private isTokenExpired(t: EphemeralToken): boolean {
        return Date.now() >= t.expUtc;
    }

    private async requestEphemeralToken(): Promise<EphemeralToken> {
        if (!this.options) {
            throw new Error('[FP] Plugin non inizializzato');
        }

        const api = this.options.url;

        const start = await fetch(`${api}/auth/ephemeral/start`, {
            method: 'POST',
            headers: { 'X-FP-Version': this.FP_VERSION }
        }).then(r => r.json());

        if (!this.cachedBrowserHash) {
            this.cachedBrowserHash = await this.computeBrowserHash();
        }

        const complete = await fetch(`${api}/auth/ephemeral/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-FP-Version': this.FP_VERSION
            },
            body: JSON.stringify({
                challengeId: start.challengeId,
                nonce: start.nonce,
                ts: start.ts,
                browserHash: this.cachedBrowserHash
            })
        }).then(r => r.json());

        const token: EphemeralToken = {
            token: complete.token,
            expUtc: complete.expUtc
        };

        this.cachedToken = token;
        this.saveToStorage();

        return token;
    }

    private async computeBrowserHash(): Promise<string> {
        const data = JSON.stringify({
            ua: navigator.userAgent,
            lang: navigator.language,
            tz: new Date().getTimezoneOffset(),
            res: `${window.screen.width}x${window.screen.height}`
        });

        const enc = new TextEncoder();
        const digest = await crypto.subtle.digest('SHA-256', enc.encode(data));
        return btoa(String.fromCharCode(...new Uint8Array(digest)));
    }

    private async secureFetch<TResponse = unknown>(
        endpoint: string,
        options: RequestInit = {},
        retryCount = 0
    ): Promise<TResponse> {
        if (!this.options) {
            throw new Error('[FP] Plugin non inizializzato');
        }

        const token = await this.getToken();
        const api = this.options.url + endpoint;

        if (!this.cachedBrowserHash) {
            this.cachedBrowserHash = await this.computeBrowserHash();
        }

        const headers = new Headers(options.headers);
        headers.set('X-Ephemeral-Token', token);
        headers.set('X-Browser-Hash', this.cachedBrowserHash);
        headers.set('X-FP-Version', this.FP_VERSION);

        const resp = await fetch(api, { ...options, headers });

        if (resp.status === 401 && retryCount === 0) {
            fpLogger.warn('[FP] Token expired, retrying...');
            this.cachedToken = null;
            return this.secureFetch<TResponse>(endpoint, options, 1);
        }

        if (!resp.ok) {
            throw new Error(`API Error: ${resp.status} - ${resp.statusText}`);
        }

        return await resp.json() as TResponse;
    }

    // ============================================
    // RENDERING
    // ============================================

    private renderContent(
        response: { success: boolean; data: RefsHtmlResponse | FilesResponse }
    ): void {
        if (!this.options || !this.optionsQuery) return;

        const { container } = this.options;
        const { mode, type } = this.optionsQuery;
        const data = response.data;

        // =====================================================
        // Verifica presenza contenuti
        // =====================================================
        let hasContent = false;

        if (mode === 'refs-html') {
            hasContent = (data as RefsHtmlResponse)?.risposta?.some(promo =>
                promo.kit?.some(kit => kit.referenze_html?.length > 0)
            ) ?? false;
        } else if (mode === 'files' || mode === 'refs') {
            hasContent = ((data as FilesResponse)?.files?.length ?? 0) > 0;
        }

        // ❌ Nessun contenuto → rimuove tutto incluso titleEl e bodyEl
        if (!hasContent) {
            this.removeAllContent();
            return;
        }
        // =====================================================
        // RENDER REFS-HTML (Shadow DOM)
        // =====================================================
        if (mode === 'refs-html' && this.shadowRoot) {
            // Pulisce render precedenti
            this.shadowRoot.querySelector('.fp-refs-wrapper')?.remove();
            this.shadowRoot.querySelector('.fp-refs-carousel-container')?.remove();

            if (type === 'grid') {
                this.renderRefsHtmlGridShadow(data as RefsHtmlResponse);
            } else if (type === 'carousel') {
                this.renderRefsHtmlCarouselShadow(data as RefsHtmlResponse);
            } else {
                this.renderRefsHtmlShadow(data as RefsHtmlResponse);
            }
            this.observeRenderedItems();
            return;
        }

        // =====================================================
        // FILES / LEGACY MODE
        // =====================================================
        container.innerHTML = '';

        if (type === 'grid') {
            container.innerHTML = this.renderGrid(data as FilesResponse);
        } else {
            container.innerHTML = this.renderCarousel(data as FilesResponse);

            if (this.optionsQuery.autoScroll !== false) {
                this.startAutoScroll();
            }
        }
        this.observeRenderedItems();
    }

    private renderRefsHtmlShadow(data: RefsHtmlResponse): void {
        const root = document.createElement('div');
        root.className = this.options?.classNames?.refsRoot || 'fp-refs-root';
        root.setAttribute('part', 'refs-root');

        const wrapper = document.createElement('div');
        wrapper.className = this.options?.classNames?.refsWrapper || 'fp-refs-wrapper';
        wrapper.setAttribute('part', 'refs-wrapper');

        const htmls = this.extractAllRefsHtml(data);

        htmls.forEach((html, index) => {
            const item = document.createElement('div');
            item.className = this.options?.classNames?.refItem || 'fp-ref-item';
            item.setAttribute('part', 'ref-item');
            item.setAttribute('data-fp-item-id', `ref-${index}`);
            const codiceRef = this.extractCodiceRef(html);
            if (codiceRef) item.setAttribute('codice-ref', codiceRef);
            item.innerHTML = html;
            wrapper.appendChild(item);
        });

        root.appendChild(wrapper);
        this.shadowRoot?.appendChild(root);
    }

    private extractAllRefsHtml(data: RefsHtmlResponse): string[] {
        const allHtml: string[] = [];
        for (const promo of data.risposta || []) {
            for (const kit of promo.kit || []) {
                allHtml.push(...(kit.referenze_html || []));
            }
        }
        return allHtml;
    }

    private renderRefsHtmlGridShadow(data: RefsHtmlResponse): void {
        if (!this.shadowRoot) return;

        let allHtml = this.extractAllRefsHtml(data);

        const maxItems = this.getGridMaxItems();
        if (maxItems > 0) {
            allHtml = allHtml.slice(0, maxItems);
        }

        // Rimuovi contenuto precedente
        this.shadowRoot.querySelector('.fp-refs-wrapper')?.remove();
        this.shadowRoot.querySelector('.fp-refs-carousel-container')?.remove();

        const wrapper = document.createElement('div');
        wrapper.className = this.options?.classNames?.refsWrapper
            ? `${this.options.classNames.refsWrapper} fp-refs-grid`
            : 'fp-refs-wrapper fp-refs-grid';
        wrapper.setAttribute('part', 'refs-wrapper');

        if (allHtml.length === 0) {
            // wrapper.appendChild(this.renderEmptyState());
        } else {
            allHtml.forEach((html, index) => {
                const refItem = document.createElement('div');
                refItem.className = this.options?.classNames?.refItem || 'fp-ref-item';
                refItem.setAttribute('part', 'ref-item');
                refItem.setAttribute('data-fp-item-id', `ref-${index}`);
                const codiceRef = this.extractCodiceRef(html);
                if (codiceRef) refItem.setAttribute('codice-ref', codiceRef);
                refItem.innerHTML = html;
                wrapper.appendChild(refItem);
            });
        }

        this.shadowRoot.appendChild(wrapper);
        fpLogger.log('[FP] Renderizzate', allHtml.length, 'referenze in griglia');
    }

    private renderRefsHtmlCarouselShadow(data: RefsHtmlResponse): void {
        if (!this.shadowRoot) return;

        const allHtml = this.extractAllRefsHtml(data);
        const showIndicators = this.optionsQuery?.showIndicators !== false;
        const showNavButtons = this.optionsQuery?.showNavButtons !== false;

        this.cleanupCarousel();
        this.shadowRoot.querySelector('.fp-refs-wrapper')?.remove();
        this.shadowRoot.querySelector('.fp-refs-carousel-container')?.remove();

        const container = document.createElement('div');
        container.className = 'fp-refs-carousel-container';
        container.setAttribute('part', 'carousel-container');

        const carousel = document.createElement('div');
        carousel.className = this.options?.classNames?.refsWrapper
            ? `${this.options.classNames.refsWrapper} fp-refs-carousel`
            : 'fp-refs-wrapper fp-refs-carousel';
        carousel.setAttribute('part', 'refs-wrapper');

        // if (allHtml.length === 0) {
        //     carousel.appendChild(this.renderEmptyState());
        //     container.appendChild(carousel);
        //     this.shadowRoot.appendChild(container);
        //     return;
        // }

        const track = document.createElement('div');
        track.className = 'fp-carousel-track';

        this.carouselState = {
            container,
            carousel,
            track,
            originalSlides: allHtml,
            totalOriginal: allHtml.length,
            currentIndex: 0,
            slidesPerView: 1,
            slideWidth: 0,
            isAnimating: false,
            touchStartX: 0,
            touchCurrentX: 0,
            isDragging: false
        };

        allHtml.forEach((html, index) => {
            const slide = this.createCarouselSlide(html, index);
            track.appendChild(slide);
        });

        carousel.appendChild(track);
        container.appendChild(carousel);

        if (showNavButtons) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'fp-carousel-nav fp-carousel-prev';
            prevBtn.setAttribute('part', 'carousel-prev');
            prevBtn.setAttribute('aria-label', 'Previous');
            prevBtn.innerHTML = '&#10094;';
            prevBtn.addEventListener('click', () => this.carouselPrev());

            const nextBtn = document.createElement('button');
            nextBtn.className = 'fp-carousel-nav fp-carousel-next';
            nextBtn.setAttribute('part', 'carousel-next');
            nextBtn.setAttribute('aria-label', 'Next');
            nextBtn.innerHTML = '&#10095;';
            nextBtn.addEventListener('click', () => this.carouselNext(false));

            container.appendChild(prevBtn);
            container.appendChild(nextBtn);
        }

        if (showIndicators && allHtml.length > 1) {
            const indicators = document.createElement('div');
            indicators.className = 'fp-carousel-indicators';
            indicators.setAttribute('part', 'carousel-indicators');

            allHtml.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = `fp-carousel-indicator${index === 0 ? ' active' : ''}`;
                dot.setAttribute('part', 'carousel-indicator');
                dot.dataset.index = String(index);
                dot.addEventListener('click', () => this.carouselGoTo(index));
                indicators.appendChild(dot);
            });

            container.appendChild(indicators);
            this.carouselState.indicators = indicators;
        }

        this.shadowRoot.appendChild(container);

        this.initCarouselLayout();
        this.setupCarouselTouch();
        this.setupCarouselResize();

        if (this.optionsQuery?.autoScroll !== false && allHtml.length > 1) {
            this.startCarouselAutoScroll();
        }

        fpLogger.log('[FP] Carousel inizializzato:', allHtml.length, 'slides');
    }

    // ============================================
    // CAROUSEL LOGIC
    // ============================================

    private createCarouselSlide(html: string, index: number): HTMLElement {
        const slide = document.createElement('div');
        slide.className = 'fp-carousel-slide';
        slide.setAttribute('part', 'carousel-slide');
        slide.dataset.index = String(index);
        slide.dataset.originalIndex = String(index);

        const refItem = document.createElement('div');
        refItem.className = this.options?.classNames?.refItem || 'fp-ref-item';
        refItem.setAttribute('part', 'ref-item');
        refItem.setAttribute('data-fp-item-id', `ref-${index}`);
        const codiceRef = this.extractCodiceRef(html);
        if (codiceRef) refItem.setAttribute('codice-ref', codiceRef);
        refItem.innerHTML = html;

        slide.appendChild(refItem);
        return slide;
    }

    private initCarouselLayout(): void {
        if (!this.carouselState) return;

        const { carousel, track, originalSlides, totalOriginal } = this.carouselState;
        const containerWidth = carousel.clientWidth;
        const minItemWidth = this.getCarouselItemWidthNumber();
        const gap = this.getGapNumber();

        const slidesPerView = Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)));
        const slideWidth = (containerWidth - (gap * (slidesPerView - 1))) / slidesPerView;

        this.carouselState.slidesPerView = slidesPerView;
        this.carouselState.slideWidth = slideWidth;

        track.querySelectorAll('.fp-carousel-slide[data-clone]').forEach(el => el.remove());

        const allSlides = track.querySelectorAll('.fp-carousel-slide');
        allSlides.forEach(slide => {
            (slide as HTMLElement).style.width = `${slideWidth}px`;
        });

        if (totalOriginal > slidesPerView) {
            for (let i = 0; i < slidesPerView; i++) {
                const clone = this.createCarouselSlide(originalSlides[i], i);
                clone.dataset.clone = 'end';
                clone.style.width = `${slideWidth}px`;
                track.appendChild(clone);
            }

            for (let i = totalOriginal - slidesPerView; i < totalOriginal; i++) {
                const clone = this.createCarouselSlide(originalSlides[i], i);
                clone.dataset.clone = 'start';
                clone.style.width = `${slideWidth}px`;
                track.insertBefore(clone, track.firstChild);
            }

            this.carouselState.currentIndex = 0;
            this.setTrackPosition(false);
        }

        track.style.gap = `${gap}px`;
    }

    private setTrackPosition(animate: boolean = true): void {
        if (!this.carouselState) return;

        const { track, currentIndex, slideWidth, slidesPerView, totalOriginal } = this.carouselState;
        const gap = this.getGapNumber();

        const cloneOffset = totalOriginal > slidesPerView ? slidesPerView : 0;
        const actualIndex = currentIndex + cloneOffset;
        const offset = -actualIndex * (slideWidth + gap);

        if (!animate) {
            track.classList.add('no-transition');
        }

        track.style.transform = `translateX(${offset}px)`;

        if (!animate) {
            void track.offsetHeight;
            track.classList.remove('no-transition');
        }
    }


    /**
     * Advances the carousel to the next slide.
     *
     * @param automatic - Indicates whether the navigation was triggered automatically (e.g., by autoplay) or manually by the user.
     *
     * @remarks
     * - Prevents navigation if the carousel is currently animating or its state is unavailable.
     * - Updates the carousel's internal state and UI, including the current index and indicators.
     * - Tracks analytics events for manual navigation, specifying the direction and destination index.
     * - Handles looping logic after a short animation delay, ensuring smooth transitions.
     *
     * @internal
     */
    private carouselNext(automatic: boolean): void {
        if (!this.carouselState || this.carouselState.isAnimating) return;

        this.carouselState.isAnimating = true;
        this.carouselState.currentIndex++;

        this.setTrackPosition(true);
        this.updateCarouselIndicators();
        if (!automatic) {
            this.trackAnalyticsEvent(PluginEventType.CAROUSEL_NAV, {
                direction: 'next',
                toIndex: this.carouselState.currentIndex % this.carouselState.totalOriginal,
            });
        }

        setTimeout(() => {
            this.handleCarouselLoop();
            if (this.carouselState) {
                this.carouselState.isAnimating = false;
            }
        }, 400);
    }

    private carouselPrev(): void {
        if (!this.carouselState || this.carouselState.isAnimating) return;

        this.carouselState.isAnimating = true;
        this.carouselState.currentIndex--;

        this.setTrackPosition(true);
        this.updateCarouselIndicators();

        this.trackAnalyticsEvent(PluginEventType.CAROUSEL_NAV, {
            direction: 'prev',
            toIndex: ((this.carouselState.currentIndex % this.carouselState.totalOriginal) + this.carouselState.totalOriginal) % this.carouselState.totalOriginal,
        });

        setTimeout(() => {
            this.handleCarouselLoop();
            if (this.carouselState) {
                this.carouselState.isAnimating = false;
            }
        }, 400);
    }

    private carouselGoTo(index: number): void {
        if (!this.carouselState || this.carouselState.isAnimating) return;

        this.carouselState.isAnimating = true;
        this.carouselState.currentIndex = index;

        this.setTrackPosition(true);
        this.updateCarouselIndicators();

        this.trackAnalyticsEvent(PluginEventType.CAROUSEL_SLIDE, { toIndex: index });

        setTimeout(() => {
            if (this.carouselState) {
                this.carouselState.isAnimating = false;
            }
        }, 400);
    }

    private handleCarouselLoop(): void {
        if (!this.carouselState) return;

        const { totalOriginal, slidesPerView } = this.carouselState;

        if (totalOriginal <= slidesPerView) return;

        if (this.carouselState.currentIndex >= totalOriginal) {
            this.carouselState.currentIndex = 0;
            this.setTrackPosition(false);
        }

        if (this.carouselState.currentIndex < 0) {
            this.carouselState.currentIndex = totalOriginal - 1;
            this.setTrackPosition(false);
        }
    }

    private updateCarouselIndicators(): void {
        if (!this.carouselState?.indicators) return;

        const { currentIndex, totalOriginal } = this.carouselState;
        const realIndex = ((currentIndex % totalOriginal) + totalOriginal) % totalOriginal;

        const dots = this.carouselState.indicators.querySelectorAll('.fp-carousel-indicator');
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === realIndex);
        });
    }

    private setupCarouselTouch(): void {
        if (!this.carouselState) return;

        const { carousel, track } = this.carouselState;
        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        const onStart = (clientX: number) => {
            if (this.carouselState?.isAnimating) return;
            isDragging = true;
            startX = clientX;
            currentX = clientX;
            track.classList.add('no-transition');

            if (this.autoScrollInterval) {
                clearInterval(this.autoScrollInterval);
                this.autoScrollInterval = undefined;
            }
        };

        const onMove = (clientX: number) => {
            if (!isDragging || !this.carouselState) return;
            currentX = clientX;
            const diff = currentX - startX;

            const { currentIndex, slideWidth, slidesPerView, totalOriginal } = this.carouselState;
            const gap = this.getGapNumber();
            const cloneOffset = totalOriginal > slidesPerView ? slidesPerView : 0;
            const actualIndex = currentIndex + cloneOffset;
            const baseOffset = -actualIndex * (slideWidth + gap);

            track.style.transform = `translateX(${baseOffset + diff}px)`;
        };

        const onEnd = () => {
            if (!isDragging || !this.carouselState) return;
            isDragging = false;
            track.classList.remove('no-transition');

            const diff = currentX - startX;
            const threshold = this.carouselState.slideWidth / 4;

            if (Math.abs(diff) > threshold) {
                if (diff > 0) {
                    this.carouselPrev();
                } else {
                    this.carouselNext(false);
                }
            } else {
                this.setTrackPosition(true);
            }

            if (this.optionsQuery?.autoScroll !== false && this.carouselState.totalOriginal > 1) {
                this.startCarouselAutoScroll();
            }
        };

        carousel.addEventListener('mousedown', (e) => {
            e.preventDefault();
            onStart(e.clientX);
        });
        document.addEventListener('mousemove', (e) => onMove(e.clientX));
        document.addEventListener('mouseup', onEnd);

        carousel.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
        carousel.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
        carousel.addEventListener('touchend', onEnd);
    }

    private setupCarouselResize(): void {
        if (!this.carouselState) return;

        if (this.carouselResizeObserver) {
            this.carouselResizeObserver.disconnect();
        }

        this.carouselResizeObserver = new ResizeObserver(() => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = window.setTimeout(() => {
                this.initCarouselLayout();
            }, 100);
        });

        this.carouselResizeObserver.observe(this.carouselState.carousel);
    }

    private startCarouselAutoScroll(): void {
        if (!this.carouselState) return;

        const scrollSpeed = this.optionsQuery?.scrollSpeed || 5000;

        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
        }

        this.autoScrollInterval = window.setInterval(() => {
            this.carouselNext(true);
        }, scrollSpeed);

        this.carouselState.carousel.addEventListener('mouseenter', () => {
            if (this.autoScrollInterval) {
                clearInterval(this.autoScrollInterval);
                this.autoScrollInterval = undefined;
            }
        });

        this.carouselState.carousel.addEventListener('mouseleave', () => {
            if (!this.autoScrollInterval && this.optionsQuery?.autoScroll !== false) {
                this.autoScrollInterval = window.setInterval(() => {
                    this.carouselNext(true);
                }, scrollSpeed);
            }
        });
    }

    private cleanupCarousel(): void {
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
            this.autoScrollInterval = undefined;
        }

        if (this.carouselResizeObserver) {
            this.carouselResizeObserver.disconnect();
            this.carouselResizeObserver = undefined;
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = undefined;
        }

        this.carouselState = null;
    }


    // ============================================
    // LEGACY FILES MODE
    // ============================================

    private renderGrid(data: FilesResponse): string {
        const files = data.files || [];
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 20px;">
                ${files.map((file: unknown, index: number) => this.renderFileCard(file as Record<string, unknown>, index)).join('')}
            </div>
        `;
    }

    private renderCarousel(data: FilesResponse): string {
        const files = data.files || [];
        const showIndicators = this.optionsQuery?.showIndicators !== false;

        const indicatorsMarkup = showIndicators ? `
            <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10000;">
                ${files.map((_: unknown, index: number) => `
                    <div class="fp-indicator" data-index="${index}" style="
                        width: 8px; height: 8px; border-radius: 50%;
                        background: ${index === 0 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.25)'};
                        cursor: pointer; transition: all 0.3s ease;
                    "></div>
                `).join('')}
            </div>
        ` : '';

        return `
            <div id="fp-carousel-wrapper" style="
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                overflow: hidden; background: #000000; z-index: 9999;
            ">
                <div id="fp-carousel-track" style="
                    display: flex; height: 100%; width: 100%;
                    transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1); will-change: transform;
                ">
                    ${files.map((file: unknown, index: number) => this.renderFileSlide(file as Record<string, unknown>, index)).join('')}
                </div>
                ${indicatorsMarkup}
            </div>
        `;
    }

    private renderFileCard(file: Record<string, unknown>, index: number): string {
        const url = file.url as string || '';
        const nome = file.nome as string || 'File senza nome';
        const tipoExport = file.tipo_export as string || 'N/A';

        return `
            <div data-fp-item-id="file-${index}" style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                ${url ? `<img src="${url}" alt="${nome}" style="width: 100%; height: 200px; object-fit: cover;" />` : `
                    <div style="width: 100%; height: 200px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display: flex; align-items: center; justify-content: center; color: white; font-size: 48px;">📄</div>
                `}
                <div style="padding: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #333;">${nome}</h3>
                    <p style="margin: 0; color: #666; font-size: 14px;"><strong>Tipo:</strong> ${tipoExport}</p>
                </div>
            </div>
        `;
    }

    private renderFileSlide(file: Record<string, unknown>, index: number): string {
        const url = file.url as string || '';
        const nome = file.nome as string || 'File senza nome';

        return `
            <div class="fp-slide" data-fp-item-id="file-${index}" style="flex-shrink: 0; width: 100vw; height: 100vh; position: relative; overflow: hidden;">
                ${url ? `<img src="${url}" alt="${nome}" style="width: 100%; height: 100%; object-fit: contain; display: block;" />` : `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
                        color: rgba(255, 255, 255, 0.3); font-size: 80px;">📄</div>
                `}
            </div>
        `;
    }

    private startAutoScroll(): void {
        const scrollSpeed = this.optionsQuery?.scrollSpeed || 5000;
        const track = document.getElementById('fp-carousel-track');
        const slides = document.querySelectorAll('.fp-slide');
        const indicators = document.querySelectorAll('.fp-indicator');

        if (!track || slides.length === 0) return;

        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                this.currentSlide = index;
                this.updateLegacyCarousel(track, indicators);
            });
        });

        this.autoScrollInterval = window.setInterval(() => {
            this.currentSlide = (this.currentSlide + 1) % slides.length;
            this.updateLegacyCarousel(track, indicators);
        }, scrollSpeed);

        track.addEventListener('mouseenter', () => {
            if (this.autoScrollInterval) clearInterval(this.autoScrollInterval);
        });

        track.addEventListener('mouseleave', () => {
            this.autoScrollInterval = window.setInterval(() => {
                this.currentSlide = (this.currentSlide + 1) % slides.length;
                this.updateLegacyCarousel(track, indicators);
            }, scrollSpeed);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                this.currentSlide = (this.currentSlide + 1) % slides.length;
                this.updateLegacyCarousel(track, indicators);
            } else if (e.key === 'ArrowLeft') {
                this.currentSlide = (this.currentSlide - 1 + slides.length) % slides.length;
                this.updateLegacyCarousel(track, indicators);
            }
        });
    }

    private updateLegacyCarousel(track: HTMLElement, indicators: NodeListOf<Element>): void {
        const offset = -this.currentSlide * 100;
        track.style.transform = `translateX(${offset}vw)`;

        indicators.forEach((ind, idx) => {
            (ind as HTMLElement).style.background = idx === this.currentSlide
                ? 'rgba(255, 255, 255, 0.9)'
                : 'rgba(255, 255, 255, 0.3)';
            (ind as HTMLElement).style.transform = idx === this.currentSlide ? 'scale(1.3)' : 'scale(1)';
        });
    }
}
