import { FilterConditionDTO, FilterTemplateDTO, PromoResponseDTO } from "../dto";
import type { FilterTemplateAttributes } from "../models/filter_template";

export interface GetRefsHtmlResponseDTO {
  conteggio: number;
  risposta: {
    id_promo: string;
    nome_promo: string;
    validita_dal: Date;
    validita_al: Date;
    kit: {
      id_kit: string;
      id_template: string;
      id_promo: string;
      referenze_html: string[];
    }[];
  }[];
  timestamp: string;
}

export interface GetCssResponseDTO {
  css_text: string;
  timestamp: string;
}

export interface IExternalApiService {

  /**
    * TODO dobbiamo fare in modo di poter passare i parametri per una ricerca avanzata
    * TODO come ad esempio i dataFields, o direttamente per il codiceBox
    */
  /**
   * Ottiene le referenze per una api esterna
   */
  getRefs(params: {
    filters?: Array<FilterConditionDTO[]>;
    template_id: string[];
    skipValidityCheck?: boolean;
  }): Promise<any>;

  /**
   * Ottiene le referenze con HTML pre-renderizzato
   */
  getRefsHtml(params: {
    filters?: Array<FilterConditionDTO[]>;
    template_id: string[];
  }): Promise<GetRefsHtmlResponseDTO>;

  /**
   * Ottiene il CSS configurato per le referenze
   */
  getCss(): Promise<GetCssResponseDTO>;

  getPromoValide(skipValidityCheck?: boolean): Promise<PromoResponseDTO[]>;
  getFiles(params: {
    filters?: Array<FilterConditionDTO[]>;
    exportCodes?: string[];
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: 'ASC' | 'DESC' | 'asc' | 'desc';
  }): Promise<any>;
  getFilesMetadataFields(): Promise<string[]>;
  getRefsFieldValues(field: string, templateId?: string[]): Promise<any[]>;
  getFilesFieldValues(field: string): Promise<any[]>;
  generateApiKey(id_utente: string): Promise<any>;
  getApiKey(idUtente: string): Promise<string>;
  generatePluginTemplate(params: FilterTemplateAttributes): Promise<any>;
  getAllTemplateFiltersForGDO(idgdo: string): Promise<any[]>;
  getTemplateFromSlug(slug: string): Promise<Partial<FilterTemplateDTO> | null>;
}
