import React, { FC, Suspense, memo } from 'react';
import { DashboardPlugin } from '../types';

interface LazyPluginWrapperProps {
  plugin: DashboardPlugin;
  data: any;
  resizeHandleRef?: React.RefObject<HTMLDivElement> | null;
  isResizing?: boolean;
  currentSize?: { w: number; h: number }; // Layout react-grid-layout (w, h)
  isSuperAdmin: boolean;
  widget: any;
  userRole: any;
  [key: string]: any; // Per props aggiuntive passate dal plugin
}

/**
 * Componente wrapper ottimizzato per gestire Suspense dei componenti lazy
 * Memoizzato per prevenire re-render inutili
 * Compatibile con componenti legacy
 */
export const LazyPluginWrapper: FC<LazyPluginWrapperProps> = memo(({
  plugin,
  ...props
}) => {
  const Component = plugin.component as any; // Type assertion per compatibilità

  // Debug: log del rendering del plugin
  console.log('LazyPluginWrapper rendering:', plugin.name, plugin.id, !!Component);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-sm text-gray-500">
              Caricamento {plugin.name}...
            </span>
          </div>
        </div>
      }
    >
      {(() => {
        try {
          return <Component {...props} />;
        } catch (error: any) {
          console.error('Error rendering plugin:', plugin.name, error);
          return (
            <div className="flex items-center justify-center h-32 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-center">
                <div className="text-red-600 font-medium">Errore nel plugin {plugin.name}</div>
                <div className="text-red-500 text-sm mt-1">{error?.message || 'Errore sconosciuto'}</div>
              </div>
            </div>
          );
        }
      })()}
    </Suspense>
  );
}, (prevProps, nextProps) => {
  // Custom comparison per ottimizzare i re-render
  // Non confrontiamo più data perché i plugin gestiscono i loro dati internamente
  return (
    prevProps.plugin.id === nextProps.plugin.id &&
    prevProps.isResizing === nextProps.isResizing &&
    prevProps.isSuperAdmin === nextProps.isSuperAdmin &&
    prevProps.currentSize?.w === nextProps.currentSize?.w &&
    prevProps.currentSize?.h === nextProps.currentSize?.h
  );
});

LazyPluginWrapper.displayName = 'LazyPluginWrapper';
