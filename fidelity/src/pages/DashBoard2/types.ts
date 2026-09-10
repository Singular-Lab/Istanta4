import { ComponentType, FC, LazyExoticComponent } from 'react';
import { Layout } from 'react-grid-layout';
import { TIPO_UTENTI } from '../../../lib/enums';

export interface WidgetRoleConfig {
  tipo: TIPO_UTENTI;
  options: {
    default: Layout;
    custom?: {
      [key in TIPO_UTENTI]?: Layout;
    };
  };
}

// Tipizzazione per i dati dei plugin
export interface DashboardPluginData {
  dataLavorazioniInCorso?: any[];
  dataPromozioniInCorso?: any[];
  [key: string]: any;
}

// Tipizzazione per i filtri
export type FilterOperator =
  | 'in'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith';

export interface BaseFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

// Tipizzazione per le props dei componenti widget
export interface WidgetComponentProps {
  data: DashboardPluginData;
  resizeHandleRef?: React.RefObject<HTMLDivElement> | null;
  isResizing?: boolean;
  currentSize?: { w: number; h: number }; // w e h invece di colSpan/rowSpan
  isSuperAdmin: boolean;
  widget: GridWidget;
  userRole: TIPO_UTENTI; // Aggiunto per compatibilità con componenti esistenti
}

// Tipizzazione flessibile per supportare componenti legacy con props diverse
export type LegacyWidgetProps = {
  data: any;
  resizeHandleRef?: React.RefObject<HTMLDivElement> | null;
  isResizing?: boolean;
  currentSize?: { w: number; h: number }; // w e h invece di colSpan/rowSpan
  userRole: TIPO_UTENTI;
  widget: GridWidget;
  [key: string]: any; // Per props aggiuntive
};

export type WidgetComponent =
  | ComponentType<WidgetComponentProps>
  | LazyExoticComponent<ComponentType<WidgetComponentProps>>
  | ComponentType<LegacyWidgetProps>
  | LazyExoticComponent<ComponentType<LegacyWidgetProps>>;

export interface DashboardPlugin {
  id: string;
  name: string;
  component: WidgetComponent;
  props?: Record<string, any>;
  position: 'grid';
  order: number;
  layout?: Layout; // Layout react-grid-layout (x, y, w, h)
  gridPosition?: Layout;
  allowedRoles: WidgetRoleConfig[];
  isDraggable?: boolean;
  isResizable?: boolean;
  minW?: number; // minW per react-grid-layout
  minH?: number; // minH per react-grid-layout
  isDeletable?: boolean;
  showPagination?: boolean;
  showFilter?: boolean;
  baseFilter?: BaseFilter[][];
}

export interface GridWidget {
  id: string;
  Component: FC<WidgetComponentProps>;
  data: DashboardPluginData;
  allowedRoles: WidgetRoleConfig[];
  layout?: Layout; // Layout react-grid-layout (x, y, w, h)
  gridPosition?: Layout;
  isDraggable?: boolean;
  isResizable?: boolean;
  minW?: number; // minW per react-grid-layout
  minH?: number; // minH per react-grid-layout
  isDeletable?: boolean;
  title?: string;
  showPagination?: boolean;
  showFilter?: boolean;
  baseFilter?: BaseFilter[][];
}

export interface Dashboard {
  version: number;
  lastUpdated: string;
  plugins: DashboardPlugin[];
}

// Tipizzazione per gli stati del componente principale
export interface DashboardState {
  plugins: DashboardPlugin[];
  gridWidgets: GridWidget[];
  allowedRoles: TIPO_UTENTI[];
  pluginsLoaded: boolean;
}

// Tipizzazione per le azioni della dashboard
export interface DashboardActions {
  onGridChange: (widgets: GridWidget[]) => void;
  onDeleteWidget: (id: string) => void;
  onAddWidget: (plugin: DashboardPlugin) => void;
  onSaveLayout: () => void;
  onResetLayout: () => void;
}
