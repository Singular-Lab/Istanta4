// Versione con timestamp per facile identificazione
const CACHE_VERSION = 'v1';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// Cache separate per diversi tipi di contenuto
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Assets statici da precaricare
// Nota: in una build Vite, questi file potrebbero avere hash nei nomi
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/vite.svg',
  // I file JS/CSS saranno hashati da Vite (es. main-a1b2c3d4.js)
  // Questi pattern sono solo esemplificativi, adattali ai tuoi output di build
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.svg$/,
  /\.png$/,
  /\.jpg$/,
  /\.ico$/
];

// Pagina offline da mostrare quando non c'è connessione
const OFFLINE_PAGE = '/offline.html';

// Configura la strategia di caching
const CACHE_STRATEGIES = {
  staticAssets: {
    // Cache-first per risorse statiche
    strategy: 'cache-first',
    maxAge: 30 * 24 * 60 * 60, // 30 giorni in secondi
  },
  dynamicContent: {
    // Network-first per contenuti dinamici
    strategy: 'network-first',
    maxAge: 24 * 60 * 60, // 1 giorno in secondi
  },
  api: {
    // Network-first con fallback per API
    strategy: 'network-first',
    maxAge: 60 * 60, // 1 ora in secondi
  }
};

// Funzione per verificare se un URL corrisponde a un pattern
const matchesPattern = (url, patterns) => {
  if (!Array.isArray(patterns)) patterns = [patterns];
  return patterns.some(pattern => {
    if (pattern instanceof RegExp) return pattern.test(url);
    return url.includes(pattern);
  });
};

// Installazione del service worker
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Cache degli asset statici
      caches.open(STATIC_CACHE).then(async cache => {
        // Precarichiamo la pagina offline
        cache.add(OFFLINE_PAGE).catch(() => console.error('Impossibile cachare la pagina offline'));

        // Aggiungiamo gli assets statici
        try {
          return await cache.addAll(STATIC_ASSETS.filter(asset => typeof asset === 'string'));
        } catch (error) {
          return console.error('Errore durante il precaricamento della cache statica:', error);
        }
      }),

      // Creiamo cache vuote per contenuti dinamici e API
      caches.open(DYNAMIC_CACHE),
      caches.open(API_CACHE)
    ]).then(() => {
      // Forza l'attivazione immediata del service worker senza attendere la chiusura delle tab
      return self.skipWaiting();
    })
  );
});

// Attivazione e pulizia delle vecchie cache
self.addEventListener('activate', event => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('Rimozione cache obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendi il controllo di tutte le pagine aperte senza richiedere un refresh
      return self.clients.claim();
    })
  );
});

// Funzione per determinare il tipo di risorsa
const getResourceType = (url) => {
  const urlObj = new URL(url);

  // Verifica se è un API endpoint
  if (urlObj.pathname.includes('/api/')) {
    return 'api';
  }

  // Verifica se è un asset statico
  for (const pattern of STATIC_ASSETS) {
    if (matchesPattern(urlObj.pathname, pattern)) {
      return 'staticAssets';
    }
  }

  // Considera altri contenuti come dinamici
  return 'dynamicContent';
};

// Implementazione della strategia cache-first
const cacheFirst = async (request, cacheKey, config) => {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Se abbiamo una risposta in cache, verifichiamo se è ancora valida
    const cachedAt = cachedResponse.headers.get('sw-cache-timestamp');
    if (cachedAt) {
      const age = (Date.now() - parseInt(cachedAt)) / 1000;
      if (age < config.maxAge) {
        return cachedResponse;
      }
    } else {
      return cachedResponse;
    }
  }

  // Se non abbiamo una risposta in cache o è scaduta, prendiamo dalla rete
  try {
    const networkResponse = await fetch(request);

    // Se la risposta è valida, la mettiamo in cache
    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      const cache = await caches.open(cacheKey);

      // Aggiungiamo un header personalizzato per tracciare quando è stata messa in cache
      const responseToCache = new Response(await clonedResponse.blob(), {
        headers: new Headers({
          ...Object.fromEntries(clonedResponse.headers.entries()),
          'sw-cache-timestamp': Date.now().toString()
        }),
        status: clonedResponse.status,
        statusText: clonedResponse.statusText
      });

      cache.put(request, responseToCache);
    }

    return networkResponse;
  } catch (error) {
    // Se non riusciamo a raggiungere la rete, restituiamo la cache (anche se scaduta)
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    // Se è una pagina HTML e non c'è cache, mostriamo la pagina offline
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_PAGE);
    }

    throw error;
  }
};

// Implementazione della strategia network-first
const networkFirst = async (request, cacheKey, config) => {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      const cache = await caches.open(cacheKey);

      // Aggiungiamo un header personalizzato per tracciare quando è stata messa in cache
      const responseToCache = new Response(await clonedResponse.blob(), {
        headers: new Headers({
          ...Object.fromEntries(clonedResponse.headers.entries()),
          'sw-cache-timestamp': Date.now().toString()
        }),
        status: clonedResponse.status,
        statusText: clonedResponse.statusText
      });

      cache.put(request, responseToCache);
    }

    return networkResponse;
  } catch (error) {
    console.log('Recupero dalla rete fallito, tentativo dalla cache per:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Se è una pagina HTML, mostriamo la pagina offline
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_PAGE);
    }

    throw error;
  }
};

// Intercetta le richieste fetch
self.addEventListener('fetch', event => {
  // Ignora le richieste non GET
  if (event.request.method !== 'GET') return;

  // Estrai origine e percorso della richiesta
  const url = new URL(event.request.url);

  // Ignora richieste di chrome-extension o altre origini diverse
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Determina il tipo di risorsa e la strategia di caching
  const resourceType = getResourceType(event.request.url);
  const cacheConfig = CACHE_STRATEGIES[resourceType];

  // Determina quale cache usare
  let cacheKey;
  switch (resourceType) {
    case 'staticAssets':
      cacheKey = STATIC_CACHE;
      break;
    case 'api':
      cacheKey = API_CACHE;
      break;
    default:
      cacheKey = DYNAMIC_CACHE;
  }

  // Applica la strategia appropriata
  if (cacheConfig.strategy === 'cache-first') {
    event.respondWith(cacheFirst(event.request, cacheKey, cacheConfig));
  } else {
    event.respondWith(networkFirst(event.request, cacheKey, cacheConfig));
  }
});

// Gestione degli aggiornamenti del service worker
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Funzione per sincronizzare i dati in background quando si ripristina la connessione
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Qui puoi implementare la sincronizzazione dei dati pendenti
      // ad esempio da IndexedDB alla tua API
      syncPendingData()
    );
  }
});

// Funzione di esempio per sincronizzare dati pendenti
async function syncPendingData() {
  // Questa è una funzione segnaposto dove implementeresti
  // la logica per sincronizzare i dati archiviati localmente quando
  // l'utente torna online
  console.log('Sincronizzazione dati pendenti...');

  // Esempio: potrebbe accedere a IndexedDB, recuperare richieste
  // offline in sospeso e inviarle al server
}
