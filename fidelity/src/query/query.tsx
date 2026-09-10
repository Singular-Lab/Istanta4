import { FlyerInsights, FlyerInsightsConfig } from "@/types/flyerInsights";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Colorize } from "../../lib/Colorize";
import { TIPO_ATTIVITA } from "../../lib/enums";
import { ServerCall } from "../../lib/server_call";
import type { AvvisoManutenzione, Config, DESIGN_KIT_MONGO, FileItemKit, FormatiAttributes, GlobalUserFilter, HubNewsAdminDTO, HubServiceDTO, MenaboLayoutSalvato, MenaboRisultato, PuntiVenditaAttributes, RUNTIME_KIT_MONGO, RaccoglitoreKit, RegoleMenabo, ReportOptionDTO, Ricette, SaveMenaboLayoutRequest, TimelinePromoItem, TipiDiExportAttributes, TracciatoQueryRequest, TracciatoQueryResult, TracciatoReport, TracciatiMomentoResponseDTO } from "../../lib/types";
import type { AuditLogPaginatedResponse, AuditLogSummary } from "../../lib/auditTypes";
import type { AreaResponseDTO, CanaleResponseDTO, CombinazioneCanaleAreaResponseDTO, CreateFilterTemplateDTO, DisplayContextResponseDTO, DispositivoPuntoVenditaResponseDTO, FilterConditionDTO, FilterTemplateDTO, FormatiResponseDTO, GDOResponseDTO, PromoResponseDTO, PuntoVenditaResponseDTO, RuoloUtenteGDOResponseDTO, TipiDiExportResponseDTO, UpdateFilterTemplateDTO } from "../../server/core/dto";





export const HUB_QUERY_KEYS = {
  services: ['hubServices'] as const,
  news: ['hubNews'] as const,
  servicesAdmin: ['hubServicesAdmin'] as const,
  newsAdmin: ['hubNewsAdmin'] as const,
};

export const useFetchAree = () => {
  return useQuery({
    queryKey: ['fetchAree'],
    queryFn: () => ServerCall.get<AreaResponseDTO[]>("/all_aree"),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const useFetchAreeCanaliECombinazioni = () => {
  return useQuery({
    queryKey: ['fetchAreeCanaliECombinazioni'],
    queryFn: () => ServerCall.get<{
      aree: AreaResponseDTO[];
      canali: CanaleResponseDTO[];
      combinazioni: CombinazioneCanaleAreaResponseDTO[];
    }>("/get_all_aree_canali_combinazioni"),
  });
};


export const useFetchCanali = () => {
  return useQuery<CanaleResponseDTO[]>({
    queryKey: ['fetchCanali'],
    queryFn: () => ServerCall.get<CanaleResponseDTO[]>("/all_canali"),
  });
};


export const useFetchCombinazioni = () => {
  return useQuery({
    queryKey: ['fetchCombinazioni'],
    queryFn: () => ServerCall.get<{
      id: string;
      sigla_combinazione: string;
      stato_combinazione: string;
    }[]>("/all_combinazion_for_gdo"),
  });
};

export const useFetchConfig = () => {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => ServerCall.get<Config>('/get_config'),
  });
};


export const useFetchFlyerInsightsConfig = () => {
  return useQuery({
    queryKey: ['flyerInsightsConfig'],
    queryFn: () => ServerCall.get<FlyerInsightsConfig>('/getFlyerInsightsConfig'),
    staleTime: Infinity,
  });
};



export const useFetchFlyerInsights = (guidIdKitRuntime: string | undefined) => {
  return useQuery({
    queryKey: ['flyerInsights', guidIdKitRuntime],
    queryFn: () => ServerCall.get<FlyerInsights>(`/flyer-insights/${guidIdKitRuntime}`),
    enabled: !!guidIdKitRuntime,
    staleTime: 1000 * 60 * 5,
  });
};


export const useFetchFieldOptions = () => {
  return useQuery({
    queryKey: ["fieldOptions"],
    queryFn: () => ServerCall.get<{
      expected_input: string,
      expected_output: string,
    }[]>("/get_field_options_filtri"),
  });
};

export const useGetCampiDaRaggruppamento = (campo_scelto: string, idWorkspace: string) => {
  return useQuery({
    queryKey: ['campiDaRaggruppamento', campo_scelto],
    queryFn: () => ServerCall.put<string[]>(`/getCampiDaRaggruppamento`, {
      campoScelto: campo_scelto,
      id: idWorkspace
    }),
    enabled: !!campo_scelto,
  });
}


export const useFetchRicetteWorkspaceSettings = () => {
  return useQuery({
    queryKey: ['ricette'],
    queryFn: async (): Promise<Ricette[]> => {
      const result = await ServerCall.get<{ data: Ricette[] }>('/get_all_ricette_by_promozioni_in_corso_and_pubblicate');
      return result.data;
    }
  });
};

export const useFetchAddestramenti = () => {
  return useQuery({
    queryKey: ["get_addestramenti_da_istanta"],
    queryFn: () => ServerCall.get<{
      id: string;
      titolo: string;
      fields: {
        idCampo: number;
        idAddestramento: number;
        nomeColonnaOriginale: string;
        indice: number;
        nomeColonna: string;
        nomeVisualizzato: string;
      }[];
    }[]>("/get_addestramenti_da_istanta"),
  });
}

export const useFetchDatiPerCreazioneKitsDesign = () => {
  return useQuery({
    queryKey: ["datiPerCreazioneFormati"],
    queryFn: () => ServerCall.get<{
      tipiExport: TipiDiExportAttributes[];
      formati: FormatiAttributes[];
      canali: CanaleResponseDTO[];
      aree: AreaResponseDTO[];
      puntiVendita: PuntoVenditaResponseDTO[];
    }>("/get_info_creazione_combinazioni_design"),
  });
};

export const useFetchCombinazioneById = (idCombinazione: string) => {
  return useQuery({
    queryKey: ['combinazione', idCombinazione],
    queryFn: () => ServerCall.get<RaccoglitoreKit>(`/getRaccoglitoreKitById/${idCombinazione}`),
    enabled: !!idCombinazione,
  });
};
export const useFetchDeclinazioniById = (idCombinazione: string) => {
  return useQuery({
    queryKey: ['declinazioni', idCombinazione],
    queryFn: () => ServerCall.get<{
      id: number;
      nome: string;
      codice: string;
      descrizione: string;
    }[]>('/getAllDeclinazioniKitDaIstanta'),
    enabled: !!idCombinazione,
  });
};

export const useFetchAllDeclinazioni = () => {
  return useQuery({
    queryKey: ['declinazioni'],
    queryFn: () => ServerCall.get<any>('/getAllDeclinazioniKitDaIstanta'),
  });
};

export const useFetchKitDesign = () => {
  return useQuery({
    queryKey: ['kitDesign'],
    queryFn: async () => {
      const response = await ServerCall.get<DESIGN_KIT_MONGO[]>('/get_all_kit_design');
      console.log(response);
      return response;
    }
  });
}

export const useFetchFiltroContestoById = (idCombinazione: string) => {
  return useQuery({
    queryKey: ["getFiltroContestoById", idCombinazione],
    queryFn: () => ServerCall.get<any[]>(`/getFiltroContestoDaIstanta`),
    enabled: idCombinazione !== "",
  });
};
export const useFetchFiltroByIdRaccoglitore = (idCombinazione: string) => {
  return useQuery({
    queryKey: ["getFiltroById", idCombinazione],
    queryFn: () => ServerCall.get<any[]>(`/getFiltroById/${idCombinazione}`),
    enabled: idCombinazione !== "",
  });
};

export const useFetchDataFilePresenti = (selectedFile: any) => {
  return useQuery({
    queryKey: ['dataFilePresenti'],
    queryFn: async () => {
      const response = await ServerCall.get<{ listaFile: any[] }>('/getNomeFileVectorStoreAI');
      console.log(response);

      return response;
    },
    enabled: () => {
      return selectedFile == undefined;
    }
  });
};

export const useFetchDatiNamingConventionFromIstanta = () => {
  return useQuery({
    queryKey: ["datiNamingConvention"],
    queryFn: () => ServerCall.get<{ id: string, nome: string, descrizione: string, nomeVisual: string }[]>("/get_all_naming_convention_from_istanta"),
  });
};

export const useFetchNamingConventions = () => {
  return useQuery({
    queryKey: ["namingConventions"],
    queryFn: () => ServerCall.get<any[]>("/get_all_naming_conventions"),
  });
};

export const useFetchAllUtenti = () => {
  return useQuery({
    queryKey: ["get_all_utenti"],
    queryFn: () => ServerCall.get<any[]>("/get_all_utenti"),
  });
};

export const useFetchAllUtentiPaginated = (page: number, limit: number, filters?: {
  tipoUtente?: string;
  stato?: string;
  sesso?: string;
  haRuoloGDO?: boolean;
  haPuntoVendita?: boolean;
  isAttivo?: boolean;
  isAdmin?: boolean;
  searchTerm?: string;
}) => {
  return useQuery({
    queryKey: ["get_all_utenti_paginated", page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (filters?.tipoUtente) {
        params.append('tipoUtente', filters.tipoUtente);
      }
      if (filters?.stato) {
        params.append('stato', filters.stato);
      }
      if (filters?.sesso) {
        params.append('sesso', filters.sesso);
      }
      if (filters?.haRuoloGDO !== undefined) {
        params.append('haRuoloGDO', filters.haRuoloGDO.toString());
      }
      if (filters?.haPuntoVendita !== undefined) {
        params.append('haPuntoVendita', filters.haPuntoVendita.toString());
      }
      if (filters?.isAttivo !== undefined) {
        params.append('isAttivo', filters.isAttivo.toString());
      }
      if (filters?.isAdmin !== undefined) {
        params.append('isAdmin', filters.isAdmin.toString());
      }
      if (filters?.searchTerm) {
        params.append('searchTerm', filters.searchTerm);
      }

      const response = await ServerCall.get<any>(`/get_all_utenti_paginated?${params.toString()}`);
      return response;
    }
  });
};

export const useFetchAllRuoliGDO = () => {
  return useQuery({
    queryKey: ["get_all_ruoli_gdo"],
    queryFn: async () => {
      const response = await ServerCall.get<RuoloUtenteGDOResponseDTO[]>("/get_all_ruoli_gdo");
      return response;
    }
  });
};

export const useFetchHubServicesAdmin = (enabled = true) => {
  return useQuery({
    queryKey: HUB_QUERY_KEYS.servicesAdmin,
    queryFn: () => ServerCall.get<Record<string, HubServiceDTO[]>>('/hub-services/admin'),
    enabled,
  });
};

export const useFetchHubNewsAdmin = (enabled = true) => {
  return useQuery({
    queryKey: HUB_QUERY_KEYS.newsAdmin,
    queryFn: () => ServerCall.get<HubNewsAdminDTO[]>('/hub-news/admin'),
    enabled,
  });
};

export const useFetchAllGDO = () => {
  return useQuery({
    queryKey: ["get_all_gdo"],
    queryFn: async () => {
      const response = await ServerCall.get<GDOResponseDTO[]>("/get_all_gdo");
      return response;
    }
  });
};


export const useFetchAllAccount = () => {
  return useQuery({
    queryKey: ["get_all_account"],
    queryFn: () => ServerCall.get<{
      id: string;
      email: string;
      tipo: string;
      nome: string;
      cognome: string;
      photo: string;
    }[]>("/get_all_account"),
  });
}

export const useFetchAllCombinazioniDesign = (guidIdTemplate: string) => {
  return useQuery({
    queryKey: ['combinazioni', guidIdTemplate],
    queryFn: async () => {
      const response = await ServerCall.put<DESIGN_KIT_MONGO[]>('/getAllCombinazioniDesignByIdTemplate', { guidIdTemplate });
      console.log(response);
      return response;
    },
    enabled: !!guidIdTemplate,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useFetchTemplateCombinazioni = () => {
  return useQuery({
    queryKey: ['templateCombinazioni'],
    queryFn: () => ServerCall.get<{
      guidId: string;
      titolo: string;
      filtro: any[];
      declinazioni: any[];
      tipiDiExportInKit: any[];
      quantita: number;
      quantitaKit: number;
      codiceFormato: string;
      tipo: string;
    }[]>('/get_all_template_combinazioni_design'),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

export const useFetchFormati = () => {
  return useQuery({
    queryKey: ["tipiFormati"],
    queryFn: () => ServerCall.get<FormatiResponseDTO[]>("/get_all_formati"),
  });
};

export const useFetchTipiExport = () => {
  return useQuery({
    queryKey: ["tipiExport"],
    queryFn: () => ServerCall.get<TipiDiExportResponseDTO[]>("/get_all_tipi_export"),
  });
};
export const useFetchTipiExportPOP = () => {
  return useQuery({
    queryKey: ["tipiExport"],
    queryFn: () => ServerCall.get<TipiDiExportResponseDTO[]>("/get_all_tipi_export_POP"),
  });
};

export const useFetchFilesMetadataFields = () => {
  return useQuery({
    queryKey: ["filesMetadataFields"],
    queryFn: async (): Promise<string[]> => {
      const response = await ServerCall.get<{ success: boolean; data: string[]; timestamp: string; }>("/external/files/metadata-fields");
      return response.data;
    }
  });
};

export const useFetchRefsFieldValues = (field: string, template_id?: string[], enabled: boolean = true) => {
  return useQuery({
    queryKey: ["refsFieldValues", field, template_id],
    queryFn: async (): Promise<string[]> => {
      const response = await ServerCall.post<{ success: boolean; data: { field: string; values: string[] }; timestamp: string; }>("/external/refs/field-values", {
        field,
        template_id
      });
      return response.data.values;
    },
    enabled: enabled && !!field // Solo se field è definito e enabled è true
  });
};

export const useFetchFilesFieldValues = (field: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["filesFieldValues", field],
    queryFn: async (): Promise<string[]> => {
      const response = await ServerCall.post<{ success: boolean; data: { field: string; values: string[] }; timestamp: string; }>("/external/files/field-values", {
        field
      });
      return response.data.values;
    },
    enabled: enabled && !!field // Solo se field è definito e enabled è true
  });
};

export const useFetchLavorazioni = () => {
  return useQuery({
    queryKey: ["lavorazioni"],
    queryFn: async () => {
      const result = await ServerCall.get<PromoResponseDTO[]>("/promo");
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useFetchLavorazioniInCorso = () => {
  return useQuery({
    queryKey: ["lavorazioniInCorso"],
    queryFn: async () => {
      const result = await ServerCall.get<PromoResponseDTO[]>("/promo/in-corso");
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useFetchPromoFiltered = (params: {
  page?: number;
  pageSize?: number;
  search?: string;
  stato?: string;
  validitaDal?: string;
  validitaAl?: string;
  validitaAlFrom?: string;
  validitaAlTo?: string;
  excludeStato?: string;
  sortBy?: 'nome' | 'validita_dal' | 'validita_al' | 'stato';
  sortDirection?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: ["promoFiltered", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.stato) queryParams.append('stato', params.stato);
      if (params.validitaDal) queryParams.append('validitaDal', params.validitaDal);
      if (params.validitaAl) queryParams.append('validitaAl', params.validitaAl);
      if (params.validitaAlFrom) queryParams.append('validitaAlFrom', params.validitaAlFrom);
      if (params.validitaAlTo) queryParams.append('validitaAlTo', params.validitaAlTo);
      if (params.excludeStato) queryParams.append('excludeStato', params.excludeStato);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);

      const result = await ServerCall.get<{
        promos: PromoResponseDTO[];
        totalItems: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
      }>(`/promo/filtered?${queryParams.toString()}`);
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useFetchStoricoLavorazioni = () => {
  return useQuery({
    queryKey: ["storicoLavorazioni"],
    queryFn: async () => {
      const result = await ServerCall.get<PromoResponseDTO[]>("/promo/storico");
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useFetchKitRuntimeByPromo = (idPromo: string) => {
  return useQuery({
    queryKey: ["kitRuntimeByPromo", idPromo],
    queryFn: async () => {
      const result = await ServerCall.get<RUNTIME_KIT_MONGO[]>(`/get_kit_runtime_by_promo/${idPromo}`);
      return result;
    },
    enabled: !!idPromo,
    staleTime: 1000 * 60 * 5,
  });
};

export const useFetchKitRuntimeFilesPaginated = (params: {
  id: string;
  page?: number;
  pageSize?: number;
  search?: string;
  searchProperty?: string;
}) => {
  return useQuery({
    queryKey: ['kitRuntimeFilesPaginated', params.id, params.page, params.pageSize, params.search, params.searchProperty],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('id', params.id);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.searchProperty) queryParams.append('searchProperty', params.searchProperty);

      const response = await ServerCall.get<{
        files: FileItemKit[];
        totalItems: number;
        currentPage: number;
        totalPages: number;
        pageSize: number;
        stats: {
          totalFiles: number;
          inRevisionCount: number;
          filesWithMetaCount: number;
          duplicateCount: number;
        };
      }>(`/getKitRunTimeFilesPaginated?${queryParams.toString()}`);
      return response;
    },
    enabled: !!params.id,
    staleTime: 1000 * 60 * 2,
  });
};

export const useFetchCombinazioneDesignById = (id: string) => {
  return useQuery({
    queryKey: ['combinazione', id],
    queryFn: async () => {
      const result = await ServerCall.get<DESIGN_KIT_MONGO>(
        `/getCombinazioneDesignById/${id}`
      );
      return result;
    },
    enabled: !!id,
  });
};

export const useFetchAllCombinazioneForGDO = () => {
  return useQuery({
    queryKey: ["combinazioniDisponibili"],
    queryFn: () => ServerCall.get<{ id: string, sigla_combinazione: string, stato_combinazione: string }[]>("/all_combinazion_for_gdo"),
  });
};

export const useFetchPuntiVenditaFromIdGDO = () => {
  return useQuery({
    queryKey: ["dataPuntiVendita"],
    queryFn: () => ServerCall.get<PuntoVenditaResponseDTO[]>("/getAllPVFromIdGDO"),
  });
};

export const useFetchPuntiVenditaPaginated = (params: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'nome' | 'citta' | 'cap' | 'createdat';
  sortDirection?: 'asc' | 'desc';
  hasCoordinate?: boolean;
  idCombinazioneCanaleArea?: string;
}) => {
  return useQuery({
    queryKey: ["dataPuntiVenditaPaginated", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection);
      if (params.hasCoordinate !== undefined) queryParams.append('hasCoordinate', params.hasCoordinate.toString());
      if (params.idCombinazioneCanaleArea) queryParams.append('idCombinazioneCanaleArea', params.idCombinazioneCanaleArea);

      const response = await ServerCall.get<{
        punti_vendita: PuntoVenditaResponseDTO[];
        total: number;
        page: number;
        limit: number;
        total_pages: number;
      }>(`/getAllPVFromIdGDO_paginated?${queryParams.toString()}`);
      return response;
    },
    staleTime: 1000 * 60 * 5, // 5 minuti
  });
};

export const useFetchPromoPerTimeline = (idArea: string, idCanale: string) => {
  return useQuery({
    queryKey: ['promoPerTimeline'],
    queryFn: () => ServerCall.get<TimelinePromoItem[]>(`/getAllPromoForTimeline?idArea=${idArea}&idCanale=${idCanale}`),
    enabled: !!idArea && !!idCanale,
  });
}

export const useFetchAllRicette = () => {
  const size: number = 1000
  return useQuery({
    queryKey: ['ricette', size],
    queryFn: async () => {
      const response = await ServerCall.get<{ data: any[] }>("/get_all_ricette_by_promozioni_in_corso_and_pubblicate");
      return response.data;
    }
  });
};

export const useFetchAllPuntiVendita = (idGDO: string) => {
  return useQuery({
    queryKey: ['puntiVendita', idGDO],
    queryFn: () => ServerCall.get<PuntiVenditaAttributes[]>(`/getAllPV?IdGDO=${idGDO}`),
    enabled: !!idGDO,
  });
};

export const useFetchAllFilesDocumentale = (page: number, pageSize: number, filters: {
  idArea: string;
  idCanale: string;
  nome: string;
  idTipoExport: string;
  idFormato: string;
  idPuntoVendita: string;
  idLavorazione: string;
  idCombinazione: string;
  idDeclinazione: string;
}, metadataFilter?: { field: string; value: string }, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['filesDocumentale', page, pageSize, filters, metadataFilter],
    // Non eseguire la query se idLavorazione è vuoto (nessuna promo filtrata) o se disabled
    enabled: enabled && !!filters.idLavorazione,
    queryFn: () => ServerCall.put<{
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
      promos: {
        id: string;
        nome: string;
        validita_dal: string;
        validita_al: string;
        stato: string;
        kits: {
          id: string;
          nome: string;
          files: FileItemKit[];
        }[];
      }[];
    }>('/get_all_files_documentale', {
      page,
      pageSize,
      filters,
      metadataFilter
    }),
  });
}

export const useFetchAllContenutiDigitali = (page: number, pageSize: number, filters: {
  idArea: string;
  idCanale: string;
  nome: string;
  idTipoExport: string;
  idFormato: string;
  idPuntoVendita: string;
  idLavorazione: string;
  idCombinazione: string;
  idDeclinazione: string;
}, metadataFilter?: { field: string; value: string }) => {
  return useQuery({
    queryKey: ['contenutiDigitali', page, pageSize, filters, metadataFilter],
    queryFn: () => ServerCall.put<{
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
      promos: {
        id: string;
        nome: string;
        validita_dal: string;
        validita_al: string;
        stato: string;
        kits: {
          id: string;
          nome: string;
          files: FileItemKit[];
        }[];
      }[];
    }>('/get_all_contenuti_digitali', {
      page,
      pageSize,
      filters,
      metadataFilter
    }),
    enabled: !!page && !!pageSize && !!filters,
  });
}

/**
 * Tipo per la risposta delle attività con nuovi campi categoria e priorità
 */
export interface AttivitaResponse {
  id: string;
  data_creazione: Date;
  assegnato_a_id: string;
  nome_assegnato: string;
  cognome_assegnato: string;
  tipo: TIPO_ATTIVITA;
  meta: any;
  categoria?: string;
  priorita?: string;
  photo: string;
  is_read: boolean;
  photo_privacy: string;
  expires_at?: Date;
}

/**
 * Opzioni per il fetch delle attività
 */
export interface FetchAttivitaOptions {
  limit?: number;
  offset?: number;
  categoria?: string;
  soloNonLette?: boolean;
}

/**
 * Risposta del conteggio notifiche non lette
 */
export interface AttivitaCountResponse {
  totale: number;
  per_categoria: Record<string, number>;
}

/**
 * Hook per recuperare le attività/notifiche dell'utente
 * Supporta:
 * - Cutoff temporale (utente vede solo notifiche create dopo la sua registrazione)
 * - Filtro per categoria
 * - Filtro solo non lette
 */
export const useFetchAttivita = (options?: FetchAttivitaOptions) => {
  return useQuery({
    queryKey: ['attivita', options?.categoria, options?.soloNonLette],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.categoria) params.append('categoria', options.categoria);
      if (options?.soloNonLette) params.append('soloNonLette', 'true');

      const queryString = params.toString();
      const url = queryString ? `/get_attivita?${queryString}` : '/get_attivita';

      const response = await ServerCall.get<AttivitaResponse[]>(url);
      return response;
    }
  });
}

/**
 * Hook per recuperare il conteggio delle notifiche non lette
 * Rispetta il cutoff temporale dell'utente
 */
export const useFetchAttivitaCount = () => {
  return useQuery({
    queryKey: ['attivita-count'],
    queryFn: async () => {
      const response = await ServerCall.get<AttivitaCountResponse>("/get_attivita_count");
      return response;
    },
    refetchInterval: 60000, // Ricarica ogni minuto
  });
}

export const useContestoPerNuovaLavorazione = () => {
  return useQuery({
    queryKey: ["contesto-per-nuova-promozione"],
    queryFn: async () => {
      const response = await ServerCall.get<any[]>("/promo/contesto");
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minuti
  });
}

// Hook per le statistiche API aggregate
export const useFetchStatisticheApiAggregate = () => {
  return useQuery({
    queryKey: ['statistiche-api-aggregate'],
    queryFn: () => ServerCall.get<{
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
    }>("/external/statistiche/aggregate"),
    refetchInterval: 30000, // Refresh ogni 30 secondi
    staleTime: 10000, // Considera i dati obsoleti dopo 10 secondi
  });
}

// Hook per le statistiche API dettagliate con filtri
export const useFetchStatisticheApiDettagli = (filtri?: {
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
}) => {
  return useQuery({
    queryKey: ['statistiche-api-dettagli', filtri],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filtri?.endpoint) params.append('endpoint', filtri.endpoint);
      if (filtri?.metodo) params.append('metodo', filtri.metodo);
      if (filtri?.codice_risposta) params.append('codice_risposta', filtri.codice_risposta.toString());
      if (filtri?.ruolo_utente) params.append('ruolo_utente', filtri.ruolo_utente);
      if (filtri?.data_da) params.append('data_da', filtri.data_da.toISOString());
      if (filtri?.data_a) params.append('data_a', filtri.data_a.toISOString());
      if (filtri?.limite) params.append('limite', filtri.limite.toString());
      if (filtri?.offset) params.append('offset', filtri.offset.toString());
      if (filtri?.ordina_per) params.append('ordina_per', filtri.ordina_per);
      if (filtri?.direzione_ordine) params.append('direzione_ordine', filtri.direzione_ordine);

      const response = await ServerCall.get<{
        statistiche: Array<{
          id: string;
          endpoint: string;
          metodo: string;
          codice_risposta: number;
          tempo_risposta_ms: number;
          dimensione_risposta_bytes: number;
          ip_richiedente: string;
          user_agent?: string;
          ruolo_utente?: string;
          api_key_utilizzata?: string;
          parametri_richiesta?: string;
          timestamp_richiesta: string;
          timestamp_risposta: string;
          errore?: string;
          stack_trace?: string;
        }>;
        total_count: number;
        pagination: {
          page: number;
          page_size: number;
          total_pages: number;
        };
      }>(`/external/statistiche/dettagli?${params.toString()}`);
      return response;
    },
    enabled: !!filtri,
    staleTime: 10000,
  });
}

// ============================================
// Filter Templates Hooks
// ============================================

// Re-export dei DTO dal server per retrocompatibilità
export type { CreateFilterTemplateDTO, FilterConditionDTO, FilterTemplateDTO, UpdateFilterTemplateDTO };

// Hook per recuperare tutti i filter templates
export const useFetchFilterTemplates = (endpointType?: 'refs' | 'refs-html' | 'files') => {
  return useQuery({
    queryKey: ['filter-templates', endpointType],
    queryFn: async (): Promise<FilterTemplateDTO[]> => {
      const url = endpointType
        ? `/external/filter-templates/by-endpoint-type/${endpointType}`
        : '/external/filter-templates';
      const response = await ServerCall.get<{ templates: FilterTemplateDTO[] } | FilterTemplateDTO[]>(url);
      // Handle both response formats
      return Array.isArray(response) ? response : response.templates;
    },
    staleTime: 1000 * 60 * 5, // 5 minuti
  });
};

// Hook per recuperare un singolo filter template
export const useFetchFilterTemplateById = (id: string) => {
  return useQuery({
    queryKey: ['filter-template', id],
    queryFn: () => ServerCall.get<FilterTemplateDTO>(`/external/filter-templates/${id}`),
    enabled: !!id,
  });
};

// Hook per recuperare un filter template per slug
export const useFetchFilterTemplateBySlug = (slug: string) => {
  return useQuery({
    queryKey: ['filter-template-slug', slug],
    queryFn: () => ServerCall.get<FilterTemplateDTO>(`/external/filter-templates/slug/${slug}`),
    enabled: !!slug,
  });
};

// Hook per validare uno slug
export const useValidateFilterTemplateSlug = (slug: string, excludeId?: string) => {
  return useQuery({
    queryKey: ['validate-slug', slug, excludeId],
    queryFn: () => ServerCall.post<{ available: boolean; suggestion?: string }>(
      '/external/filter-templates/validate-slug',
      { slug, excludeId }
    ),
    enabled: !!slug && slug.length >= 2,
    staleTime: 1000 * 30, // 30 secondi
  });
};

// ============================================
// Dispositivi Punto Vendita Hooks
// ============================================

export const useFetchDisplayContextsByGDO = (idGdo: string) => {
  return useQuery({
    queryKey: ['display-contexts-gdo', idGdo],
    queryFn: () => ServerCall.get<DisplayContextResponseDTO[]>(
      `/display-contexts/gdo/${idGdo}`
    ),
    enabled: !!idGdo,
  });
};

export const useFetchDisplayContextsByPuntoVendita = (idPuntoVendita: string) => {
  return useQuery({
    queryKey: ['display-contexts-pv', idPuntoVendita],
    queryFn: () => ServerCall.get<DisplayContextResponseDTO[]>(
      `/display-contexts/pv/${idPuntoVendita}`
    ),
    enabled: !!idPuntoVendita,
  });
};

export const useFetchDispositiviPuntoVendita = (idPuntoVendita: string) => {
  return useQuery({
    queryKey: ['dispositivi-pv', idPuntoVendita],
    queryFn: () => ServerCall.get<DispositivoPuntoVenditaResponseDTO[]>(
      `/dispositivi?idPuntoVendita=${idPuntoVendita}`
    ),
    enabled: !!idPuntoVendita,
    refetchInterval: 30000, // Refresh ogni 30 secondi per status online/offline
  });
};

export const useFetchAvvisoManutenzione = () => {
  return useQuery({
    queryKey: ['avviso-manutenzione'],
    queryFn: () => ServerCall.get<AvvisoManutenzione | null>("/avviso-manutenzione"),
    staleTime: 0,
  });
};

export const useFetchRegoleMenabo = () =>
  useQuery({
    queryKey: ['regole-menabo'],
    queryFn: () => ServerCall.get<RegoleMenabo | null>("/regole-menabo"),
    staleTime: 1000 * 60 * 5,
  });

export const useSaveRegoleMenabo = () =>
  useMutation({
    mutationFn: (regole: RegoleMenabo) => ServerCall.post("/regole-menabo", regole),
  });

export const useDeleteRegoleMenabo = () =>
  useMutation({
    mutationFn: () => ServerCall.delete("/regole-menabo"),
  });

export const useFetchMenaboLayout = (idPromo: string | undefined) =>
  useQuery({
    queryKey: ['menabo-layout', idPromo],
    queryFn: () => ServerCall.get<MenaboLayoutSalvato | null>(`/promo/${idPromo}/menabo-layout`),
    enabled: !!idPromo,
    staleTime: 1000 * 60 * 5,
  });

export const useSaveMenaboLayout = (idPromo: string | undefined) =>
  useMutation({
    mutationFn: (payload: SaveMenaboLayoutRequest) =>
      ServerCall.put<MenaboLayoutSalvato>(`/promo/${idPromo}/menabo-layout`, payload),
  });

// ── Audit Log ──

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  eventType?: string;
  severity?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  result?: string;
  searchTerm?: string;
  resource?: string;
}

export const useFetchAuditLogs = (filters: AuditLogFilters) => {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async (): Promise<AuditLogPaginatedResponse> => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== null) {
          params.append(key, String(value));
        }
      });
      const result = await ServerCall.get<AuditLogPaginatedResponse>(
        `/audit-log?${params.toString()}`
      );
      return result;
    },
    staleTime: 1000 * 30, // 30 secondi
  });
};

export const useFetchAuditSummary = (dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ['audit-summary', dateFrom, dateTo],
    queryFn: async (): Promise<AuditLogSummary> => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const qs = params.toString();
      const result = await ServerCall.get<AuditLogSummary>(
        `/audit-log/summary${qs ? `?${qs}` : ''}`
      );
      return result;
    },
    staleTime: 1000 * 30,
  });
};

export const useFetchAuditEventTypes = () => {
  return useQuery({
    queryKey: ['audit-event-types'],
    queryFn: () => ServerCall.get<{ value: string; label: string }[]>("/audit-log/event-types"),
    staleTime: Infinity,
  });
};

export const useFetchAuditSeverities = () => {
  return useQuery({
    queryKey: ['audit-severities'],
    queryFn: () => ServerCall.get<{ value: string; label: string }[]>("/audit-log/categories"),
    staleTime: Infinity,
  });
};

export const useCalcolaMultiPromoScoreboard = () =>
  useMutation({
    mutationFn: (payload: { promoIds: string[]; confrontoFilter?: { primarioIndex: number; secondarioIndex: number } }) =>
      ServerCall.post<TracciatoReport>('/scoreboard/multi-promo', payload),
  });

export const useCalcolaQueryScoreboard = () =>
  useMutation({
    mutationFn: (query: TracciatoQueryRequest) =>
      ServerCall.post<TracciatoQueryResult>('/scoreboard/query', query),
  });

export const useFetchReportOptions = () =>
  useQuery<ReportOptionDTO[]>({
    queryKey: ['tracciati', 'report-options'],
    queryFn: () => ServerCall.get<ReportOptionDTO[]>('/scoreboard/report-options'),
    staleTime: 5 * 60 * 1000,
  });

export const useCalcolaQueryDaOpzione = () =>
  useMutation({
    mutationFn: (optionId: string) =>
      ServerCall.post<TracciatoQueryResult>('/scoreboard/opzione', { optionId }),
  });

export const useFetchMomentiPerPromo = (promoIds: string[], enabled: boolean) =>
  useQueries({
    queries: promoIds.map((id) => ({
      queryKey: ['momentiPromo', id],
      queryFn: () => ServerCall.get<TracciatiMomentoResponseDTO[]>(`/tracciati/momenti/promo/${id}`),
      enabled,
      staleTime: 1000 * 60 * 5,
    })),
  });

export const useFetchDatoPerMenabo = (idPromo: string | undefined) =>
  useQuery({
    queryKey: ['datoPerMenabo', idPromo],
    queryFn: () => ServerCall.get<MenaboRisultato>(`/promo/menabo?idPromo=${idPromo}`),
    enabled: !!idPromo,
    staleTime: 1000 * 60 * 5,
  });

export const useFetchGlobalUserFilters = () =>
  useQuery({
    queryKey: ['globalUserFilters'],
    queryFn: () => ServerCall.get<GlobalUserFilter>('/utenti/me/global-filters'),
    staleTime: 1000 * 60 * 5,
  });
