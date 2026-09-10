// =================== GDOWhatsapp DTO ===================




/**
 * DTO per la creazione di una nuova GDOWhatsapp
 */
export interface CreateGDOWhatsappDTO {
    id_gdo: string;
    numero_whatsapp: string;
    email_whatsapp?: string;
}

/**
 * DTO per l'aggiornamento di una GDOWhatsapp esistente
 */
export interface UpdateGDOWhatsappDTO {
    numero_whatsapp?: string;
    email_whatsapp?: string;
}

/**
 * DTO per la risposta con i dati della GDOWhatsapp
 */
export interface GDOWhatsappResponseDTO {
    id: string;
    id_gdo: string;
    numero_whatsapp: string;
    email_whatsapp?: string;
    createdat?: Date;
    updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca GDOWhatsapp
 */
export interface GDOWhatsappFiltersDTO {
    id_gdo?: string;
    search?: string;
    limit?: number;
    offset?: number;
    order_by?: 'numero_whatsapp' | 'createdat';
    order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle GDOWhatsapp
 */
export interface GDOWhatsappPaginatedResponseDTO {
    gdo_whatsapp: GDOWhatsappResponseDTO[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// =================== GDOWhatsappNumbers DTO ===================

/**
 * DTO per la creazione di un nuovo GDOWhatsappNumbers
 */
export interface CreateGDOWhatsappNumbersDTO {
    id_gdo: string;
    id_numero_whatsapp: string;
    display_name: string;
    stato: string;
    provider: string;
    whatsapp_business_account_id: string;
    access_token?: string;
    verify_token?: string;
}

/**
 * DTO per l'aggiornamento di un GDOWhatsappNumbers esistente
 */
export interface UpdateGDOWhatsappNumbersDTO {
    display_name?: string;
    stato?: string;
    provider?: string;
    whatsapp_business_account_id?: string;
    access_token?: string;
    verify_token?: string;
}

/**
 * DTO per la risposta con i dati di GDOWhatsappNumbers
 */
export interface GDOWhatsappNumbersResponseDTO {
    id: string;
    id_gdo: string;
    id_numero_whatsapp: string;
    display_name: string;
    stato: string;
    provider: string;
    whatsapp_business_account_id: string;
    access_token?: string;
    verify_token?: string;
    createdat?: Date;
    updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca GDOWhatsappNumbers
 */
export interface GDOWhatsappNumbersFiltersDTO {
    id_gdo?: string;
    id_numero_whatsapp?: string;
    search?: string;
    limit?: number;
    offset?: number;
    order_by?: 'display_name' | 'createdat';
    order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle GDOWhatsappNumbers
 */
export interface GDOWhatsappNumbersPaginatedResponseDTO {
    gdo_whatsapp_numbers: GDOWhatsappNumbersResponseDTO[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// =================== GDOWhatsappTemplate DTO ===================

/**
 * DTO per la creazione di un nuovo GDOWhatsappTemplate
 */
export interface CreateGDOWhatsappTemplateDTO {
    id_gdotemplate: string;
    nome_templatetemplate: string;
    lingua_templatetemplate: string;
    stato_metatemplate: string;
    json_metatemplate: any;
}

/**
 * DTO per l'aggiornamento di un GDOWhatsappTemplate esistente
 */
export interface UpdateGDOWhatsappTemplateDTO {
    nome_templatetemplate?: string;
    lingua_templatetemplate?: string;
    stato_metatemplate?: string;
    json_metatemplate?: any;
}

/**
 * DTO per la risposta con i dati di GDOWhatsappTemplate
 */
export interface GDOWhatsappTemplateResponseDTO {
    idtemplate: string;
    id_gdotemplate: string;
    nome_templatetemplate: string;
    lingua_templatetemplate: string;
    stato_metatemplate: string;
    json_metatemplate: any;
    createdat?: Date;
    updatedat?: Date;
}

/**
 * DTO per i filtri di ricerca GDOWhatsappTemplate
 */
export interface GDOWhatsappTemplateFiltersDTO {
    id_gdotemplate?: string;
    nome_templatetemplate?: string;
    lingua_templatetemplate?: string;
    stato_metatemplate?: string;
    search?: string;
    limit?: number;
    offset?: number;
    order_by?: 'nome_templatetemplate' | 'createdat';
    order_direction?: 'ASC' | 'DESC';
}

/**
 * DTO per la risposta paginata delle GDOWhatsappTemplate
 */
export interface GDOWhatsappTemplatePaginatedResponseDTO {
    gdo_whatsapp_templates: GDOWhatsappTemplateResponseDTO[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}
