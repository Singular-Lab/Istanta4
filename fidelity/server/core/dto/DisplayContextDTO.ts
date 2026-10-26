import { FilterCondition } from '../models/filter_template';

export type DisplayContextEndpointType = 'files';
export type DisplayContextRenderType = 'carousel' | 'grid';

/* ======================================================
 * RESPONSE
 * ====================================================== */

export interface DisplayContextResponseDTO {
    id: string;
    nome: string;
    descrizione?: string;
    filters: FilterCondition[][];
    endpoint_type: DisplayContextEndpointType;
    auto_scroll: boolean;
    scroll_speed: number;
    show_indicators: boolean;
    show_nav_buttons: boolean;
    render_type?: DisplayContextRenderType;
    meta_options: Record<string, unknown>;
    id_gdo: string;
    id_puntivendita?: string;
    is_active: boolean;
    createdat: Date;
    updatedat: Date;
    dispositivi_count?: number;
}

/* ======================================================
 * CREATE
 * ====================================================== */

export interface CreateDisplayContextDTO {
    nome: string;
    descrizione?: string;
    filters: FilterCondition[][];
    endpoint_type: DisplayContextEndpointType;
    auto_scroll?: boolean;
    scroll_speed?: number;
    show_indicators?: boolean;
    show_nav_buttons?: boolean;
    render_type?: DisplayContextRenderType;
    meta_options?: Record<string, unknown>;
    id_gdo: string;
    id_puntivendita?: string;
}

/* ======================================================
 * UPDATE
 * ====================================================== */

export interface UpdateDisplayContextDTO {
    nome?: string;
    descrizione?: string;
    filters?: FilterCondition[][];
    endpoint_type?: DisplayContextEndpointType;
    auto_scroll?: boolean;
    scroll_speed?: number;
    show_indicators?: boolean;
    show_nav_buttons?: boolean;
    render_type?: DisplayContextRenderType;
    meta_options?: Record<string, unknown>;
    id_puntivendita?: string | null;
    is_active?: boolean;
}

/* ======================================================
 * LIST
 * ====================================================== */

export interface DisplayContextListResponseDTO {
    contexts: DisplayContextResponseDTO[];
    total: number;
}
