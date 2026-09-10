import { FC, useCallback } from 'react';
import { Layout, Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { TIPO_UTENTI } from '../../../lib/enums';
import OptimizedWidgetWrapper from './components/OptimizedWidgetWrapper';
import { GridWidget } from './types';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface EnhancedGridDashboardProps {
  widgets: GridWidget[];
  isSuperAdmin: boolean;
  userRole: TIPO_UTENTI;
  onChange: (widgets: GridWidget[]) => void;
  onDelete: (id: string) => void;
}

// Breakpoints responsive per react-grid-layout
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const GRID_ROW_HEIGHT = 50;

/**
 * Dashboard con drag & drop completamente refactorato per performance e UX ottimali
 */
export const EnhancedGridDashboard: FC<EnhancedGridDashboardProps> = ({
  widgets,
  isSuperAdmin,
  userRole,
  onChange,
  onDelete
}) => {
  // Crea layout base da usare per tutti i breakpoint
  const createLayoutItem = (widget: GridWidget, cols: number): Layout => {
    const baseLayout = widget.layout || { x: 0, y: 0, w: 4, h: 4 };
    // Adatta la larghezza al numero di colonne disponibili
    const adaptedW = Math.min(baseLayout.w || 4, cols);
    const adaptedX = Math.min(baseLayout.x || 0, cols - adaptedW);

    return {
      i: widget.id,
      x: adaptedX,
      y: baseLayout.y || 0,
      w: adaptedW,
      h: baseLayout.h || 4,
      minW: Math.min(widget.minW ?? 2, cols),
      minH: widget.minH ?? 2,
      isDraggable: isSuperAdmin ? (widget.isDraggable ?? true) : false,
      isResizable: isSuperAdmin ? (widget.isResizable ?? true) : false,
      static: !isSuperAdmin,
    };
  };

  // Genera layout per tutti i breakpoint
  const layouts = {
    lg: widgets.map(w => createLayoutItem(w, COLS.lg)),
    md: widgets.map(w => createLayoutItem(w, COLS.md)),
    sm: widgets.map(w => createLayoutItem(w, COLS.sm)),
    xs: widgets.map(w => createLayoutItem(w, COLS.xs)),
    xxs: widgets.map(w => createLayoutItem(w, COLS.xxs)),
  };

  // Gestione cambio layout
  // Solo il super admin può modificare il layout
  const handleLayoutChange = useCallback(
    (newLayout: Layout[], allLayouts: any) => {
      // Blocca le modifiche se non è super admin (doppio controllo di sicurezza)
      if (!isSuperAdmin) {
        console.warn('Tentativo di modifica layout da utente non autorizzato (bloccato)');
        return;
      }

      // Aggiorna il layout dei widget direttamente (già in formato react-grid-layout)
      const updatedWidgets = widgets.map(widget => {
        const l = newLayout.find(item => item.i === widget.id);
        if (!l) {
          // Se il widget non è nel nuovo layout, mantieni il layout originale
          return widget;
        }
        return {
          ...widget,
          layout: l // Usa direttamente il Layout da react-grid-layout
        };
      });

      // Gestisci anche eventuali nuovi widget che potrebbero essere stati aggiunti
      const newLayoutIds = new Set(newLayout.map(l => l.i));
      const existingIds = new Set(widgets.map(w => w.id));
      const missingIds = newLayout.filter(l => !existingIds.has(l.i));

      if (missingIds.length > 0) {
        console.warn('Layout contains widgets not in widgets array:', missingIds.map(l => l.i));
      }

      onChange(updatedWidgets);
    },
    [widgets, onChange, isSuperAdmin]
  );

  return (
    <div className={`relative w-full ${!isSuperAdmin ? 'hide-resize-handles' : ''}`}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={GRID_ROW_HEIGHT}
        isDraggable={isSuperAdmin}
        isResizable={isSuperAdmin}
        onLayoutChange={handleLayoutChange}
        measureBeforeMount={false}
        useCSSTransforms={true}
        compactType="vertical"
        preventCollision={false}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {widgets.map(widget => (
          <div key={widget.id} data-grid={layouts.lg.find(l => l.i === widget.id)}>
            <OptimizedWidgetWrapper
              widget={widget}
              userRole={userRole}
              isSuperAdmin={isSuperAdmin}
              isDraggingAny={false}
              onDelete={onDelete}
              showResizeHandles={isSuperAdmin}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
};

export default EnhancedGridDashboard;
