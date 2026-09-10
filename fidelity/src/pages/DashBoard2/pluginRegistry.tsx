import { DashboardPlugin } from './types';

/* -------------------------------------------------------------------------- */
/*  PLUGIN REGISTRY GLOBALE                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Registry globale per tutti i plugin dashboard
 * Separato per evitare dipendenze circolari
 */
export let pluginRegistry: DashboardPlugin[] = [];

/**
 * Registra un plugin nel registry globale
 */
export const registerDashboardPlugin = (plugin: DashboardPlugin) => {
    const idx = pluginRegistry.findIndex(p => p.id === plugin.id);
    if (idx >= 0) {
        pluginRegistry[idx] = plugin;
    } else {
        pluginRegistry.push(plugin);
    }
};

/**
 * Reset del registry (utile per testing)
 */
export const resetPluginRegistry = () => {
    pluginRegistry = [];
};

/**
 * Ottieni tutti i plugin dal registry
 */
export const getPluginRegistry = (): DashboardPlugin[] => {
    return [...pluginRegistry];
};