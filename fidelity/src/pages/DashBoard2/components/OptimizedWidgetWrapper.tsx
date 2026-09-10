import { Popover } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import clsx from 'clsx';
import { FC, memo } from 'react';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { GridWidget } from '../types';

interface OptimizedWidgetWrapperProps {
  widget: GridWidget;
  userRole: TIPO_UTENTI;
  isSuperAdmin: boolean;
  isDraggingAny: boolean;
  onDelete: (id: string) => void;
  showResizeHandles?: boolean;
}

/**
 * Widget wrapper con stile box box--stacked per react-grid-layout
 * react-grid-layout gestisce drag & drop e resize automaticamente
 */
const OptimizedWidgetWrapper: FC<OptimizedWidgetWrapperProps> = memo(({
  widget,
  userRole,
  isSuperAdmin,
  isDraggingAny,
  onDelete,
  showResizeHandles = false
}) => {
  // Usa layout dal widget (gestito da react-grid-layout)
  const layout = widget.layout || { i: widget.id, x: 0, y: 0, w: 4, h: 4 };

  // Render del contenuto del widget
  const WidgetComponent = widget.Component;

  return (
    <div
      className={clsx(
        'dashboard-widget group flex flex-col relative h-full',
        'box box--stacked'
      )}
    >
      {/* Header con stile DashboardOverview */}
      <div className="flex justify-between items-center px-5 py-4 border-b border-dashed border-slate-300/70">
        <h3 className="text-base font-medium text-slate-700 truncate pr-2">
          {widget.title}
        </h3>

        {/* Menu contestuale per superadmin */}
        {isSuperAdmin && widget.isDeletable && (
          <Popover className="relative">
            <Popover.Button
              className={clsx(
                'p-1.5 rounded-full transition-colors',
                'opacity-0 group-hover:opacity-100',
                'hover:bg-slate-100 text-slate-400'
              )}
            >
              <Lucide icon="EllipsisVertical" className="w-5 h-5" />
            </Popover.Button>
            <Popover.Panel className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <button
                onClick={() => onDelete(widget.id)}
                className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                Elimina widget
              </button>
            </Popover.Panel>
          </Popover>
        )}
      </div>

      {/* Contenuto del widget */}
      <div className="flex-1 overflow-hidden p-5">
        <WidgetComponent
          widget={widget}
          data={widget.data}
          resizeHandleRef={null}
          isResizing={false}
          currentSize={{ w: layout.w || 4, h: layout.h || 4 }}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
        />
      </div>

      {/* Debug info - solo in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-0 left-0 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-br rounded-tl-[0.6rem] z-10">
          {layout.x},{layout.y} ({layout.w}x{layout.h})
        </div>
      )}
    </div>
  );
});

OptimizedWidgetWrapper.displayName = 'OptimizedWidgetWrapper';

export default OptimizedWidgetWrapper;
