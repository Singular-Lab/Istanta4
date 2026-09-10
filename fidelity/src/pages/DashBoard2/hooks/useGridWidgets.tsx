import { useCallback, useMemo } from 'react';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { LazyPluginWrapper } from '../components/LazyPluginWrapper';
import { DashboardPlugin, DashboardPluginData, GridWidget, WidgetComponentProps } from '../types';

interface UseGridWidgetsOptions {
    plugins: DashboardPlugin[];
    pluginData?: DashboardPluginData; // Reso opzionale, non più necessario
    userRole?: TIPO_UTENTI;
}

interface UseGridWidgetsReturn {
    gridWidgets: GridWidget[];
    canSeePlugin: (plugin: DashboardPlugin, role: TIPO_UTENTI) => boolean;
}

/**
 * Custom hook ottimizzato per la trasformazione di plugin in grid widgets
 * con memoizzazione per prevenire re-render inutili
 */
export function useGridWidgets({
    plugins,
    pluginData,
    userRole
}: UseGridWidgetsOptions): UseGridWidgetsReturn {

    // Funzione memoizzata per verificare i permessi
    const canSeePlugin = useCallback((plugin: DashboardPlugin, role: TIPO_UTENTI): boolean => {
        if (role === undefined) return false;
        if (role === TIPO_UTENTI.SUPERADMIN) return true;
        return plugin.allowedRoles.some(r => r.tipo === role);
    }, []);

    // Trasformazione memoizzata dei plugin in grid widgets
    const gridWidgets = useMemo(() => {
        if (!userRole) return [];

        return plugins
            .filter(plugin => canSeePlugin(plugin, userRole))
            .map(plugin => {
                // Wrapper ottimizzato per gestire Suspense
                const WrappedComponent = (props: WidgetComponentProps) => (
                    <LazyPluginWrapper
                        plugin={plugin}
                        {...plugin.props}
                        {...props}
                    />
                );

                // Trova la configurazione del ruolo per l'utente corrente
                const roleConfig = plugin.allowedRoles.find(role => role.tipo === userRole);
                if (!roleConfig) {
                    console.warn(`No role configuration found for user role ${userRole} in plugin ${plugin.id}`);
                    return null;
                }

                // Adatta la posizione per react-grid-layout
                const gridPosition = roleConfig.options?.default || { x: 0, y: 0, w: 4, h: 4, i: plugin.id };

                const widget: GridWidget = {
                    ...plugin,
                    id: plugin.id,
                    Component: WrappedComponent,
                    data: {} as DashboardPluginData,
                    allowedRoles: plugin.allowedRoles,
                    title: plugin.name,
                    gridPosition, // <-- aggiungi questa proprietà per react-grid-layout
                };
                return widget;
            })
            .filter((widget): widget is GridWidget => widget !== null);
    }, [plugins, userRole, canSeePlugin]);

    return {
        gridWidgets,
        canSeePlugin
    };
}
