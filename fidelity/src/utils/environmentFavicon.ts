/**
 * Utility per gestire il favicon in base all'ambiente
 */

export type Environment = 'development' | 'test' | 'production';

/**
 * Mappa dei favicon per ogni ambiente
 */
const FAVICON_MAP: Record<Environment, string> = {
  development: '/icons/favicon-dev.ico',
  test: '/icons/favicon-test.ico',
  production: '/icons/favicon-production.ico'
};

/**
 * Determina l'ambiente corrente
 */
export function getCurrentEnvironment(): Environment {
  // Priorità 1: Variabile esplicita VITE_ENVIRONMENT
  const explicitEnv = import.meta.env.VITE_ENVIRONMENT as Environment;
  if (explicitEnv && ['development', 'test', 'production'].includes(explicitEnv)) {
    return explicitEnv;
  }

  // Priorità 2: Modalità development di Vite
  if (import.meta.env.DEV) {
    return 'development';
  }

  // Priorità 3: Variabili di ambiente legacy
  const nodeEnv = import.meta.env.VITE_NODE_ENV || import.meta.env.MODE;

  if (import.meta.env.VITE_TEST || nodeEnv === 'test') {
    return 'test';
  }

  // Priorità 4: Analisi dell'hostname
  const hostname = window.location.hostname;

  if (hostname.includes('test')) {
    return 'test';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('dev')) {
    return 'development';
  }


  // Priorità 5: Check per porta di sviluppo
  const port = window.location.port;
  if (port === '3000' || port === '5173' || port === '4173') {
    return 'development';
  }

  // Default: production
  return 'production';
}

/**
 * Ottiene il percorso del favicon per l'ambiente corrente
 */
export function getFaviconForEnvironment(environment?: Environment): string {
  const env = environment || getCurrentEnvironment();
  return FAVICON_MAP[env];
}

/**
 * Aggiorna dinamicamente il favicon nel DOM
 */
export function updateFavicon(environment?: Environment): void {
  const env = environment || getCurrentEnvironment();
  const faviconPath = getFaviconForEnvironment(env);

  // Rimuovi i favicon esistenti
  const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
  existingFavicons.forEach(favicon => favicon.remove());

  // Aggiungi il nuovo favicon principale
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/x-icon';
  link.href = faviconPath;

  // Aggiungi anche un shortcut icon per compatibilità
  const shortcutLink = document.createElement('link');
  shortcutLink.rel = 'shortcut icon';
  shortcutLink.type = 'image/x-icon';
  shortcutLink.href = faviconPath;

  document.head.appendChild(link);
  document.head.appendChild(shortcutLink);

  // Forza l'aggiornamento del favicon nel browser
  const timestamp = new Date().getTime();
  link.href = `${faviconPath}?v=${timestamp}`;
  shortcutLink.href = `${faviconPath}?v=${timestamp}`;
}

/**
 * Hook React per gestire il favicon dinamico
 */
export function useDynamicFavicon() {
  const environment = getCurrentEnvironment();
  const faviconPath = getFaviconForEnvironment(environment);

  return {
    environment,
    faviconPath,
    updateFavicon: () => updateFavicon(environment)
  };
}
