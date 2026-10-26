export interface FileAnteprima {
    id: string;
    nome: string;
    nome_originale?: string;
    tipo_export?: string;
    id_olimpo_cloud?: string;
    thumbnail?: string;
    mime?: string;
    pages?: number;
}

export interface KitVolantino {
    id: string;
    titolo: string;
    nome_area?: string;
    nome_canale?: string;
    stato_lavorazione: string;
    nome_promo: string;
    id_promo?: string;
    validita_dal?: Date;
    validita_al?: Date;
    files: FileAnteprima[];
}

export interface VolantiniInCorsoDTO {
    totale: number;
    inScadenza: number;
    kit: KitVolantino[];
}

export interface VolantiniInLavorazioneDTO {
    totale: number;
    inAttesa: number;
    kit: KitVolantino[];
}

export interface VolantiniPubblicatiInLavorazioneDTO {
    totale: number;
    kit: KitVolantino[];
}

export interface DashboardFilterParams {
    id_area?: string[];
    id_canale?: string[];
}

export interface StoricoVolantiniDTO {
    totale: number;
    kit: KitVolantino[];
}

export interface IDashboardService {
    getVolantiniInCorso(filters?: DashboardFilterParams): Promise<VolantiniInCorsoDTO>;
    getVolantiniInLavorazione(filters?: DashboardFilterParams): Promise<VolantiniInLavorazioneDTO>;
    getVolantiniPubblicatiInLavorazione(filters?: DashboardFilterParams): Promise<VolantiniPubblicatiInLavorazioneDTO>;
    getStoricoVolantini(filters?: DashboardFilterParams, limit?: number): Promise<StoricoVolantiniDTO>;
    // pubblicaVolPdf(
    //     req: Request,
    //     tipo_export: string,
    //     id_promo: string,
    //     dest_path_file: string,
    // ): Promise<any>;
}
