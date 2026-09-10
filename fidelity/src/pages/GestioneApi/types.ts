import type { TipiDiExportResponseDTO } from "../../../server/core/dto";

// Condizione di filtro
export interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

// Template per i test
export interface Template {
  guidId: string;
  titolo: string;
  quantitaKit: number;
  formatoTemplate: string;
  codiceFormato: string;
}

// Opzioni campo per i filtri
export interface FieldOption {
  expected_input: string;
  expected_output: string;
}

// Props per MonacoJsonViewer
export interface MonacoJsonViewerProps {
  value: string;
  searchTerm?: string;
  className?: string;
  height?: string;
}

// Props per FilterValueInput
export interface FilterValueInputProps {
  field: string;
  operator: string;
  value: string;
  onChange: (value: string) => void;
  fieldOptions: FieldOption[];
  apiKey: string;
  templateId?: string;
}

// Props per GetRefsTestPanel
export interface GetRefsTestPanelProps {
  fieldOptions: FieldOption[];
  apiKey: string;
  isLoading: boolean;
  testResponse: string;
  onTest: () => void;
  onUpdateTestData: (data: string) => void;
  onUpdateTestResponse: (data: string) => void;
  template: Template[];
  testMode?: boolean;
}

// Props per GetFilesTestPanel
export interface GetFilesTestPanelProps {
  apiKey: string;
  isLoading: boolean;
  testResponse: string;
  onTest: () => void;
  onUpdateTestData: (data: string) => void;
  onUpdateTestResponse: (data: string) => void;
  tipiExport: Array<TipiDiExportResponseDTO>;
  metadataFields: string[];
  testMode?: boolean;
}

// Props per StatCard
export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}
export type OperatingSystem =
  | 'Windows'
  | 'macOS'
  | 'Linux'
  | 'Android'
  | 'iOS'
  | 'iPadOS'
  | 'ChromeOS'
  | 'SmartTV'
  | 'Console'
  | 'Bot'
  | 'Embedded'
  | 'Unknown';

// Statistiche API aggregate (formato API reale)
export interface ApiStatistics {
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
    data: string;
    endpoint: string;
    metodo: string;
    stato: string;
    codice_risposta: number;
    tempo_risposta_ms: number;
    ip_richiedente: string;
    ruolo_utente: string;
    errore: string | null;
    stack_trace: string | null;
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
    ultima_richiesta: string;
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
  dispositivi: {
    sistemi_operativi: Array<{
      os: OperatingSystem; // enum / union
      totale_richieste: number;
      richieste_riuscite: number;
      richieste_fallite: number;
      tempo_medio_ms: number;
    }>;
  }
}

// Dettagli statistiche API
export interface ApiStatisticsDetail {
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
}
