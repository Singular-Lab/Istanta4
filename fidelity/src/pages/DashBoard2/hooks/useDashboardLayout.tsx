import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNotification } from '@/context/NotificationContext';
import { ServerCall } from '../../../../lib/server_call';
import { DashboardPlugin } from '../types';

interface UseDashboardLayoutOptions {
    plugins: DashboardPlugin[];
    setPlugins: React.Dispatch<React.SetStateAction<DashboardPlugin[]>>;
}

interface UseDashboardLayoutReturn {
    saveLayout: () => void;
    resetLayout: () => void;
    isSaving: boolean;
}

/**
 * Custom hook per gestire il salvataggio e reset del layout dashboard
 */
export function useDashboardLayout({
    plugins,
    setPlugins
}: UseDashboardLayoutOptions): UseDashboardLayoutReturn {
    const { showNotification } = useNotification();

    // Mutation per il salvataggio
    const saveLayoutMutation = useMutation({
        mutationFn: async () => {
            // Serializza il layout in formato react-grid-layout
            const layout = plugins.map(p => ({
                id: p.id,
                gridPosition: p.gridPosition, // salva la posizione react-grid-layout
                allowedRoles: p.allowedRoles,
                isDraggable: p.isDraggable,
                isResizable: p.isResizable,
                isDeletable: p.isDeletable,
                showPagination: p.showPagination,
                showFilter: p.showFilter,
                baseFilter: p.baseFilter,
            }));
            const snapshot = {
                version: 2,
                lastUpdated: new Date().toISOString(),
                layout,
            };
            await ServerCall.post('/saveDashBoardConfig', snapshot);
            localStorage.setItem('dashboardLayout', JSON.stringify(snapshot));
        },
        onSuccess: () => {
            showNotification('Layout salvato!', { variant: 'success' });
        },
        onError: (error) => {
            console.error('Errore salvataggio layout:', error);
            showNotification('Errore durante il salvataggio del layout', { variant: 'error' });
        }
    });

    const saveLayout = useCallback(() => {
        if (!saveLayoutMutation.isPending) {
            saveLayoutMutation.mutate();
        }
    }, [saveLayoutMutation]);

    const resetLayout = useCallback(() => {
        if (!window.confirm('Ripristinare la dashboard predefinita?')) return;

        localStorage.removeItem('dashboardLayout');

        // Reset dei plugin allo stato di default
        const resetPlugins = plugins.map(plugin => ({
            ...plugin,
            gridPosition: undefined, // resetta la posizione react-grid-layout
            allowedRoles: plugin.allowedRoles.map(roleConfig => ({
                ...roleConfig,
                options: {
                    ...roleConfig.options,
                    custom: undefined
                }
            }))
        }));

        setPlugins(resetPlugins);
        showNotification('Dashboard ripristinata!', { variant: 'success' });
    }, [plugins, setPlugins]);

    return {
        saveLayout,
        resetLayout,
        isSaving: saveLayoutMutation.isPending
    };
}