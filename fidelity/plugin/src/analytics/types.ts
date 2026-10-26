import type { FpOptionsQuery } from '../types';

// ============================================
// ANALYTICS TYPES (inline, plugin is zero-dependency)
// ============================================

export const PluginEventType = {
    PLUGIN_INIT: 'plugin:init',
    PLUGIN_DESTROY: 'plugin:destroy',
    PLUGIN_ERROR: 'plugin:error',
    RENDER_START: 'render:start',
    RENDER_COMPLETE: 'render:complete',
    ITEM_IMPRESSION: 'item:impression',
    ITEM_CLICK: 'item:click',
    CAROUSEL_SLIDE: 'carousel:slide',
    CAROUSEL_NAV: 'carousel:nav_click',
    SCROLL_DEPTH: 'engagement:scroll_depth',
    DWELL_TIME: 'engagement:dwell',
    SESSION_END: 'session:end',
    GLOBAL_CLICK: 'global:click',
    GLOBAL_SCROLL: 'global:scroll',
} as const;

export type PluginEventTypeValue = typeof PluginEventType[keyof typeof PluginEventType];

export interface ElementRectData {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
    width: number;
    height: number;
}

export interface ItemImpressionData extends ElementRectData {
    itemId: string;
    codiceRef: string;
    dwellMs: number;
    elementType: string;
}

export interface ItemClickData extends ElementRectData {
    itemId: string;
    codiceRef: string;
    tagName: string;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    innerTagName: string;
    innerClassName?: string;
    domPath: string;
    elementType: string;
}

export interface GlobalClickData extends ElementRectData {
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    tagName: string;
    id?: string;
    className?: string;
    textSnippet?: string;
    domPath: string;
    elementType: string;
    carouselContext?: string;
}

export interface GlobalScrollData {
    scrollTop: number;
    viewportHeight: number;
    documentHeight: number;
    depthPercent: number;
    depthBucket: number;
}

export interface RenderStartData {
    mode?: FpOptionsQuery['mode'];
    type?: FpOptionsQuery['type'];
}

export interface RenderCompleteData extends RenderStartData {
    durationMs: number;
}

export interface PluginInitData extends RenderStartData { }

export interface CarouselNavData {
    direction: 'next' | 'prev';
    toIndex: number;
}

export interface CarouselSlideData {
    toIndex: number;
}

export interface ScrollDepthData {
    depth: number;
}

export type AnalyticsEventDataMap = {
    [PluginEventType.PLUGIN_INIT]: PluginInitData;
    [PluginEventType.PLUGIN_DESTROY]: Record<string, never>;
    [PluginEventType.PLUGIN_ERROR]: Record<string, unknown>;
    [PluginEventType.RENDER_START]: RenderStartData;
    [PluginEventType.RENDER_COMPLETE]: RenderCompleteData;
    [PluginEventType.ITEM_IMPRESSION]: ItemImpressionData;
    [PluginEventType.ITEM_CLICK]: ItemClickData;
    [PluginEventType.CAROUSEL_SLIDE]: CarouselSlideData;
    [PluginEventType.CAROUSEL_NAV]: CarouselNavData;
    [PluginEventType.SCROLL_DEPTH]: ScrollDepthData;
    [PluginEventType.DWELL_TIME]: Record<string, unknown>;
    [PluginEventType.SESSION_END]: Record<string, never>;
    [PluginEventType.GLOBAL_CLICK]: GlobalClickData;
    [PluginEventType.GLOBAL_SCROLL]: GlobalScrollData;
};

export type AnalyticsDataFor<T extends string> = T extends PluginEventTypeValue
    ? AnalyticsEventDataMap[T]
    : Record<string, unknown>;

export interface AnalyticsViewport {
    viewportWidth: number;
    viewportHeight: number;
    scrollX: number;
    scrollY: number;
    documentWidth: number;
    documentHeight: number;
}

export interface AnalyticsEvent<T extends string = string> {
    eventId: string;
    type: T;
    timestamp: string;
    slug: string;
    fpVersion: string;
    pageOrigin: string;
    pagePath: string;
    sessionId: string;
    /** Numero di sequenza monotonicamente crescente per sessione (replay ordering) */
    sequence: number;
    /** Stato del viewport al momento dell'evento (replay context) */
    viewport: AnalyticsViewport;
    data?: AnalyticsDataFor<T>;
}

export interface SessionResumedResult {
    lastSequence: number;
    expired: boolean;
}

export interface AnalyticsInstanceMeta {
    apiUrl: string;
    getToken: () => Promise<string>;
    getBrowserHash: () => string | null;
    sessionId: string;
    /** Ritorna il sessionId corrente (può cambiare dopo session:resumed se expired) */
    getCurrentSessionId: () => string;
    /** Ritorna il prossimo numero di sequenza (pre-incrementato) */
    getNextSequence: () => number;
    onSessionResumed: (result: SessionResumedResult) => void;
    wsPort?: number;
}
