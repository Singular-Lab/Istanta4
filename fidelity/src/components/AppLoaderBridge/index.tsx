import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Route per cui il loader NON deve essere mostrato
 * (match per startsWith)
 */
const NO_LOADER_ROUTES = [
    "/login",
    "/embed",
    "/preview",
    "/public",
];

export function AppLoaderBridge() {
    const location = useLocation();
    const hasSignaled = useRef(false);

    useEffect(() => {
        if (hasSignaled.current) return;

        const path = location.pathname;

        const disableLoader = NO_LOADER_ROUTES.some(route =>
            path === route || path.startsWith(route + "/")
        );

        // 🔔 In entrambi i casi notifichiamo il loader
        // la differenza è solo SEMANTICA (per te, non per lui)
        window.dispatchEvent(new Event("app:ready"));
        hasSignaled.current = true;

        // (opzionale) debug
        if (import.meta.env.DEV) {
            console.debug(
                disableLoader
                    ? `🚫 Loader disabilitato per route: ${path}`
                    : `✅ Loader attivo per route: ${path}`
            );
        }
    }, [location.pathname]);

    return null;
}
