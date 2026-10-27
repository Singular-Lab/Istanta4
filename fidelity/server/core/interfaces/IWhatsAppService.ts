import type { GDOWhatsappTemplateAttributes } from "../../../lib/types";
import type { GDOResponseDTO } from "../dto/GDODTO";

/** Canale WhatsApp di una GDO come lo vede il browser: dei token solo se sono configurati. */
export type ConfigurazioneGDOWhatsapp = {
    id: string;
    id_gdo: string;
    nome: string;
    id_numero_whatsapp: string;
    display_name: string;
    stato: string;
    provider: string;
    whatsapp_business_account_id: string;
    access_token_configurato: boolean;
    verify_token_configurato: boolean;
    createdat?: Date;
    updatedat?: Date;
};

/** Dati del setup del canale WhatsApp; un token vuoto lascia quello salvato. */
export type DatiSetupGDOWhatsapp = {
    id_gdo: string;
    display_name: string;
    id_numero_whatsapp: string;
    whatsapp_business_account_id: string;
    stato: string;
    access_token?: string | null;
    verify_token?: string | null;
};

export interface IWhatsAppService {
    getCurrentGDOWhatsappForCampaign(id_utente: string): Promise<GDOResponseDTO | null>;
    //TODO attenzione da questo metodo scaturira poi la gestione multi-gdo da SUPERADMIN
    getAllGDOWhatsapp(): Promise<{
        id: string;
        nome: string;
        id_parent: string;
        is_parent: boolean;
        has_children: boolean;
        wa_number?: string;
        id_whatsapp_number?: string;
        ragione_sociale?: string;
        email?: string;
        stato?: string;
    }[]>;
    getGDOWhatsappById(id: string): Promise<ConfigurazioneGDOWhatsapp | null>;
    salvaSetupGDOWhatsapp(dati: DatiSetupGDOWhatsapp): Promise<{ success: boolean; creato: boolean; campiModificati: string[] }>;
    getAllTemplatesWhatsappByGdo(idGdo: string): Promise<(GDOWhatsappTemplateAttributes & { preset_count: number, has_preset: boolean })[]>;
    getWhatsappTemplateById(id: string): Promise<GDOWhatsappTemplateAttributes | null>;
    syncTemplatesFromMeta(gdoId: string): Promise<{ success: boolean; error?: string }>;
    salvaInLocaleTemplateWhatsappSuperAdminPayload(id_template: string, template: any): Promise<{ success: boolean; newTemplateId: string; error?: string }>;
    creaTemplateLocale(id_gdo: string, json_meta: unknown): Promise<{ success: boolean; newTemplateId: string }>;
    sendModifiedTemplateToMeta(id_template: string): Promise<any>;
    getAllPresetsTemplateWhatsapp(id_template: string): Promise<any[]>;
    creaPresetTemplateWhatsapp(id_template: string, nome_preset: string, contenuto_preset: any): Promise<{ success: boolean; newPresetId?: string; error?: string }>;
    modificaPresetTemplateWhatsapp(id_preset: string, nome_preset: string, contenuto_preset: any): Promise<{ success: boolean; error?: string }>;
    setDefaultPresetTemplateWhatsapp(id_preset: string): Promise<{ success: boolean; error?: string }>;
    eliminaPresetTemplateWhatsapp(id_preset: string, idGdoAmmessa: string | null): Promise<void>;
    eliminaTemplateWhatsapp(id_template: string, idGdoAmmessa: string | null): Promise<void>;
    getAllUtentiGuestWhatsappCount(idGdo: string,
        filtri: {
            sesso?: string;
            callFilter?: {
                type: 'circle' | 'comuni' | 'regioni';
                // Per circle
                center?: [number, number];
                radiusKm?: number;
                // Per comuni/regioni
                areaId?: string | null;
                areaName?: string | null;
                polygon?: [number, number][][];
            };
            dateRange?: string | null; // "YYYY-MM-DD - YYYY-MM-DD"
        }): Promise<{
            count: number;
            missing: number;
            total: number;
        }>;


    invioDiTestAdUtente(id_utente: string, id_template: string): Promise<{ success: boolean; error?: string }>;
    iniziaInvioCampagnaWhatsApp(
        idGdo: string,
        templateId: string,
        titoloCampagna: string,
        callFilter: {
            type: 'circle' | 'comuni' | 'regioni';
            center?: [number, number];
            radiusKm?: number;
            areaId?: string | null;
            areaName?: string | null;
            polygon?: [number, number][][];
        } | null,
        userFilters: {
            sesso?: string | null;
            dateRange?: string | null;
        }
    ): Promise<{ bulkId: string; campagnaId: string; totalJobs: number; }>;
}
