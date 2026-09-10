/**
 * Tipi per le statistiche e insights dei volantini
 */

export interface ReferenzaPosizione {
  id: string;
  /** Campi dinamici estratti secondo flyerInsightsConfig.json dataMapping */
  [key: string]: any;
  posizione: {
    pag: number;
    x: number;
    y: number;
    w: number;
    h: number;
    wPage: number;
    hPage: number;
    percIngombro: number;
    aspectRatio: number;
  } | null;
}

export interface RepartoPagina {
  sigla: string;
  descrizione: string;
  count: number;
}

export interface RiepilogoPagina {
  pagina: number;
  numeroReferenze: number;
  ingombroTotalePerc: number;
  reparti: RepartoPagina[];
}

export interface RiepilogoReparto {
  sigla: string;
  descrizione: string;
  numeroReferenze: number;
  pagine: number[];
  [key: string]: any;
}

export interface RiepilogoMeccanica {
  [key: string]: any;
  numeroReferenze: number;
  percentuale: number;
}

// --- Config types ---

export interface ColorEntry {
  hex: string;
  tw: string;
}

export interface ColorStrategyStatic {
  type: 'static';
  map: Record<string, ColorEntry>;
  default: ColorEntry;
}

export interface ColorMatcher {
  patterns: string[];
  hex: string;
  tw: string;
}

export interface ColorStrategyPattern {
  type: 'pattern';
  matchers: ColorMatcher[];
  default: ColorEntry;
}

export type ColorStrategy = ColorStrategyStatic | ColorStrategyPattern;

export interface ChartConfig {
  type: string;
  width?: number;
  height?: number;
  cutout?: string;
  indexAxis?: 'x' | 'y';
  barThickness?: number;
  borderRadius?: number;
  barPercentage?: number;
  heightPerItem?: number;
  minHeight?: number;
  secondaryDataset?: {
    type: string;
    label: string;
    borderWidth: number;
    pointRadius: number;
    pointHoverRadius: number;
    tension: number;
    fill: boolean;
  };
}

export interface FieldsConfig {
  labelField: string;
  labelFallback?: string;
  labelPrefix?: string;
  valueField: string;
  valueLabel?: string;
  secondaryValueField?: string;
  secondaryValueLabel?: string;
  badgeField?: string;
  badgeMaxChars?: number;
  colorField?: string;
}

export interface DisplayConfig {
  showLegend: boolean;
  legendPosition?: string;
  centerLabel?: {
    valueType: string;
    label: string;
  };
  tooltipFormat?: string;
  listMaxHeight?: number;
  listCols?: number;
}

export interface EmptyStateConfig {
  icon: string;
  message: string;
}

export interface GroupByConfig {
  field: string;
  descriptionField?: string;
}

export interface DataMappingConfig {
  referenzaFields: Record<string, string>;
  referenzaDescriptionFields?: string[];
}

export interface RiepilogoSectionConfig {
  enabled?: boolean;
  title: string;
  groupBy?: GroupByConfig;
  chart: ChartConfig;
  colorStrategy?: ColorStrategy;
  fields: FieldsConfig;
  display: DisplayConfig;
  emptyState: EmptyStateConfig;
}

export interface MappaColorEntry {
  hex: string;
  label?: string;
}

export interface MappaColorStrategy {
  type: 'static';
  map: Record<string, MappaColorEntry>;
  default: MappaColorEntry;
}

export interface MappaDisplayConfig {
  maxSpreadWidth?: number;
  showLegend?: boolean;
  showMiniNavigation?: boolean;
  showTotalInfo?: boolean;
  defaultPageDimensions?: {
    width: number;
    height: number;
  };
}

export interface MappaInfoPanelConfig {
  width?: number;
  showPrice?: boolean;
  showMeccanica?: boolean;
  showIngombro?: boolean;
}

export interface MappaConfig {
  enabled?: boolean;
  title: string;
  colorSource?: string;
  colorField?: string;
  colorStrategy?: MappaColorStrategy;
  display?: MappaDisplayConfig;
  infoPanel?: MappaInfoPanelConfig;
  emptyState: EmptyStateConfig;
}

export interface FlyerInsightsConfig {
  dataMapping: DataMappingConfig;
  reparti: RiepilogoSectionConfig;
  meccaniche: RiepilogoSectionConfig;
  pagine: RiepilogoSectionConfig;
  mappa?: MappaConfig;
}

// --- Data types ---

export interface FlyerInsights {
  guidIdKitRuntime: string;
  totaleReferenze: number;
  totalePagine: number;
  riepilogoPagine: RiepilogoPagina[];
  riepilogoReparti: RiepilogoReparto[];
  riepilogoMeccaniche: RiepilogoMeccanica[];
  referenze: ReferenzaPosizione[];
}
