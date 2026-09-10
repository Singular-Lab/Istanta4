import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNotification } from '@/context/NotificationContext';
import { ServerCall } from '../../../../lib/server_call';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { DashboardPlugin, Dashboard } from '../types';
import { pluginRegistry } from '../pluginRegistry';
import { loadRegistryPlugins } from '../loadRegistryPlugins';

interface UseDashboardPluginsOptions {
    userRole?: TIPO_UTENTI;
    enabled?: boolean;
}

interface UseDashboardPluginsReturn {
    plugins: DashboardPlugin[];
    setPlugins: React.Dispatch<React.SetStateAction<DashboardPlugin[]>>;
    pluginsLoaded: boolean;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Custom hook per gestire il caricamento e la gestione dei plugin dashboard
 */
export function useDashboardPlugins({ 
    userRole, 
    enabled = true 
}: UseDashboardPluginsOptions = {}): UseDashboardPluginsReturn {
    const { showNotification } = useNotification();
    const [plugins, setPlugins] = useState<DashboardPlugin[]>([]);
    const [pluginsLoaded, setPluginsLoaded] = useState(false);

    // Inizializzazione plugin registry
    useEffect(() => {
        const initializePlugins = async () => {
            try {
                if (pluginRegistry.length === 0) {
                    console.log('Inizializzazione plugin registry...');
                    await loadRegistryPlugins();
                } else {
                    console.log('Plugin già presenti nel registry:', pluginRegistry.length);
                }
                setPluginsLoaded(true);
            } catch (error) {
                console.error('Errore inizializzazione plugin:', error);
                showNotification('Errore nel caricamento dei plugin', { variant: 'error' });
                setPluginsLoaded(true);
            }
        };

        if (enabled && !pluginsLoaded) {
            initializePlugins();
        }
    }, [enabled, pluginsLoaded]);

    // Caricamento configurazione dashboard dal server
    const getDashboardConfig = useCallback(async (): Promise<Dashboard | null> => {
        try {
            console.log('getDashBoardConfig chiamata, userRole:', userRole, 'pluginRegistry.length:', pluginRegistry.length);
            
            const response = await ServerCall.get<Dashboard>("/getDashBoardConfig");
            if (response && response.plugins && response.plugins.length > 0) {
                const withDefs = response.plugins
                    .map((sp: any) => {
                        const def = pluginRegistry.find(p => p.id === sp.id);
                        return def ? { ...def, ...sp } : null;
                    })
                    .filter(Boolean) as DashboardPlugin[];
                
                console.log('Plugin caricati dal server:', withDefs.length);
                setPlugins(withDefs);
            } else {
                // Fallback a layout di default
                console.log('Nessuna configurazione dal server, uso layout di default');
                const defaultPlugins = pluginRegistry.filter(p => 
                    userRole && p.allowedRoles.some(role => 
                        role.tipo === userRole || userRole === TIPO_UTENTI.SUPERADMIN
                    )
                );
                console.log('Plugin di default filtrati:', defaultPlugins.length);
                setPlugins(defaultPlugins);
            }
            return response;
        } catch (error) {
            console.error('Errore caricamento configurazione dashboard:', error);
            // Fallback in caso di errore
            const defaultPlugins = pluginRegistry.filter(p => 
                userRole && p.allowedRoles.some(role => 
                    role.tipo === userRole || userRole === TIPO_UTENTI.SUPERADMIN
                )
            );
            console.log('Plugin di default in caso di errore:', defaultPlugins.length);
            setPlugins(defaultPlugins);
            return null;
        }
    }, [userRole]);

    // Query per il caricamento della configurazione
    const {
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['dashboardConfig', userRole],
        queryFn: getDashboardConfig,
        enabled: enabled && pluginsLoaded && userRole !== undefined,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
    });

    // Fallback per assicurarsi che i plugin siano caricati
    useEffect(() => {
        if (pluginsLoaded && userRole && plugins.length === 0 && pluginRegistry.length > 0) {
            console.log('Fallback: carico plugin di default');
            const defaultPlugins = pluginRegistry.filter(p => 
                p.allowedRoles.some(role => 
                    role.tipo === userRole || userRole === TIPO_UTENTI.SUPERADMIN
                )
            );
            if (defaultPlugins.length > 0) {
                console.log('Plugin di default trovati:', defaultPlugins.length);
                setPlugins(defaultPlugins);
            }
        }
    }, [pluginsLoaded, userRole, plugins.length]);

    return {
        plugins,
        setPlugins,
        pluginsLoaded,
        isLoading,
        error: error as Error | null,
        refetch: () => refetch()
    };
}