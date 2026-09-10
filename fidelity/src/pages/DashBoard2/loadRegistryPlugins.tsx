/* -------------------------------------------------------------------------- */
/*  Load registry plugins in parallel – Vite + import.meta.glob + React.lazy  */
/* -------------------------------------------------------------------------- */

import type { DashboardPlugin, WidgetRoleConfig } from "./types";
import { registerDashboardPlugin } from "./pluginRegistry";
import React from "react";
import { ServerCall } from "../../../lib/server_call";

/**
 * Type for plugin metadata
 */
type PluginMeta = {
    id: string;
    name: string;
    componentPath: string;
    allowedRoles: WidgetRoleConfig[];
    position: 'grid';
    order: number;
    gridColSpan: number;
    gridRowSpan: number;
    [key: string]: any;
};

/* -------------------------------------------------------------------------- */
/*  Build-time glob of *all* dashboard plugins                                */
/* -------------------------------------------------------------------------- */
// 1) Vite risolve l'alias "@" su /src – quindi la stringa dev'essere statica
// 2) Con il glob otteniamo una mappa { "<path>": () => Promise<Module> }
// 3) Le chiavi sono *relative* alla root alias, quindi devono combaciare col
//    valore di `componentPath` messo nel JSON.

const modules = import.meta.glob<{ default: React.ComponentType<any> }>(
    "@/components/DashboardPlugins/**/*.{ts,tsx,js,jsx}"
);

/**
 * Trova l'importer corrispondente a `componentPath` ignorando l'estensione.
 * Se nel JSON metti ad es. "@/components/DashboardPlugins/PromozioniInCorsoPlugin"
 * la funzione cercherà chiavi che terminano con lo stesso nome + qualsiasi
 * estensione ammessa.
 */
function resolveImporter(componentPath: string) {
    // Rimuove alias e eventuale prefisso iniziale
    const trimmed = componentPath
        .replace(/^@\//, "")          // "@/" -> ""
        .replace(/^src\//, "")        // "src/" -> ""
        .replace(/\.[a-z]+$/, "");    // toglie estensione se c'è

    // Cerca una chiave che finisca con lo stesso path + una delle estensioni supportate
    const entry = Object.entries(modules).find(([key]) => {
        return [".tsx", ".ts", ".jsx", ".js"].some(ext =>
            key.endsWith(`${trimmed}${ext}`)
        );
    });

    return entry?.[1];
}

/**
 * Crea un componente lazy-loaded per un plugin specifico
 */
function createLazyComponent(componentPath: string) {
    const importer = resolveImporter(componentPath);
    
    if (!importer) {
        console.error("Chiavi modules:", Object.keys(modules));
        throw new Error(
            `[Dashboard] modulo non trovato: ${componentPath}. ` +
            `Controlla il path nel JSON o rinomina il file.`
        );
    }

    // React.lazy richiede una funzione che ritorna una Promise con un default export
    return React.lazy(() => 
        importer().then(mod => ({ 
            default: mod.default 
        }))
    );
}

export async function loadRegistryPlugins(
    filter?: (meta: PluginMeta) => boolean
): Promise<DashboardPlugin[]> {
    try {
        // Chiamata API per ottenere il manifest dei plugin
        const manifest = await ServerCall.get<PluginMeta[]>("/getPluginRegistry");
        const metas = filter ? manifest.filter(filter) : manifest;

        // Non serve più Promise.all perché React.lazy gestisce il caricamento asincrono
        const plugins: DashboardPlugin[] = metas.map((meta: PluginMeta) => {
            const LazyComponent = createLazyComponent(meta.componentPath);

            return {
                ...meta,
                component: LazyComponent,
            } as DashboardPlugin;
        });

        // Registra tutti i plugin
        plugins.forEach(registerDashboardPlugin);
        return plugins;
    } catch (error) {
        console.error('Errore nel caricamento del registry dei plugin:', error);
        throw error;
    }
}

/**
 * Versione alternativa se hai bisogno di pre-validare tutti i moduli
 */
export async function loadRegistryPluginsWithValidation(
    filter?: (meta: PluginMeta) => boolean
): Promise<DashboardPlugin[]> {
    try {
        // Chiamata API per ottenere il manifest dei plugin
        const manifest = await ServerCall.get<PluginMeta[]>("/getPluginRegistry");
        const metas = filter ? manifest.filter(filter) : manifest;

        // Pre-valida che tutti i moduli esistano
        const validationPromises = metas.map(async (meta: PluginMeta) => {
            const importer = resolveImporter(meta.componentPath);
            if (!importer) {
                throw new Error(
                    `[Dashboard] modulo non trovato: ${meta.componentPath}`
                );
            }
            
            // Testa il caricamento del modulo
            try {
                await importer();
                return meta;
            } catch (error) {
                throw new Error(
                    `[Dashboard] errore nel caricamento di ${meta.componentPath}: ${error}`
                );
            }
        });

        // Attendi che tutte le validazioni siano completate
        const validatedMetas = await Promise.all(validationPromises);

        // Crea i plugin con componenti lazy
        const plugins: DashboardPlugin[] = validatedMetas.map((meta: PluginMeta) => {
            const LazyComponent = createLazyComponent(meta.componentPath);

            return {
                ...meta,
                component: LazyComponent,
            } as DashboardPlugin;
        });

        plugins.forEach(registerDashboardPlugin);
        return plugins;
    } catch (error) {
        console.error('Errore nel caricamento del registry dei plugin:', error);
        throw error;
    }
}