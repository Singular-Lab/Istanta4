import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_KIT_DESIGN } from "../../../lib/enums";

export interface FlyerFilePreviewDTO {
    id: string;
    runtimeId?: string;
    nome: string;
    nomeOriginale?: string;
    tipoExport?: string;
    tipoExportCodice?: string;
    mime?: string;
    pages: number;
    thumbnailUrl?: string;
    downloadUrl?: string;
    pagePreviews: string[];
    meta?: Record<string, unknown>;
}

export interface FlyerKitHistoryDTO {
    id: string;
    titolo: string;
    tipo: TIPO_KIT_DESIGN;
    statoLavorazione: STATO_LAVORAZIONE_KIT_RUNTIME;
    area?: {
        id?: string;
        nome?: string;
        codice?: string;
    };
    canale?: {
        id?: string;
        nome?: string;
        codice?: string;
    };
    formato?: {
        id: string;
        nome: string;
        codice: string;
        descrizione?: string;
        tipoLavorazione: number;
        tipoLavorazioneLabel: string;
    };
    files: FlyerFilePreviewDTO[];
}

export interface FlyerHistoryPromoDTO {
    id: string;
    nome: string;
    stato: STATO_PROMO;
    validitaDal: string;
    validitaAl: string;
    kits: FlyerKitHistoryDTO[];
}
