// src/main.tsx
import { getCurrentEnvironment, updateFavicon } from "@/utils/environmentFavicon";
import { isErroreServizio, notificaErroreServizio } from "@/utils/erroriServizi";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import "@vitejs/plugin-react/preamble";
import dayjs from "dayjs";
import 'dayjs/locale/it';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from './app/AppProviders';
import "./assets/css/app.css";
import './customComponents';
import "./i18n";
import routes from "./router";
import { datiLoaderWebpliant, ID_DATI_SSR, type BootstrapWebpliantSsr } from './ssr/webpliant';
import { createAppStore, store } from "./stores/store";
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.locale('it');

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", () => {
    window.location.reload();
  });
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.addEventListener("load", async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }

      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(cacheKey => caches.delete(cacheKey)));
      }
    } catch (error) {
      console.warn("Errore durante cleanup service worker/cache in development:", error);
    }
  });
}


// Configurazione QueryClient ottimizzata
const queryClient = new QueryClient({
  // Errori di Istanta/Correggo: toast globale per le query e per le mutation senza onError proprio
  queryCache: new QueryCache({ onError: notificaErroreServizio }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.options.onError) notificaErroreServizio(error);
    }
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Non ritentare per errori client (400-499) né per le risposte definitive di Istanta/Correggo
        if ((error?.httpStatus >= 400 && error?.httpStatus < 500) || isErroreServizio(error)) {
          return false;
        }
        return failureCount < 2; // Max 2 tentativi
      },
      staleTime: 5 * 60 * 1000, // 5 minuti
      gcTime: 10 * 60 * 1000 // 10 minuti
    }
  },
});

// Creazione del router
const testoSsr = document.getElementById(ID_DATI_SSR)?.textContent;
const bootstrapSsr: BootstrapWebpliantSsr | null = testoSsr ? JSON.parse(testoSsr) : null;
const appStore = bootstrapSsr ? createAppStore(bootstrapSsr.reduxState) : store;
if (bootstrapSsr) queryClient.setQueryData(['config'], bootstrapSsr.dati.config);
const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL,
  hydrationData: bootstrapSsr ? { loaderData: datiLoaderWebpliant(bootstrapSsr.dati) } : undefined,
});
if (bootstrapSsr) {
  const unsubscribe = router.subscribe(state => {
    if (state.location.pathname + state.location.search !== bootstrapSsr.dati.url) {
      queryClient.removeQueries({ queryKey: ['config'], exact: true });
      unsubscribe();
    }
  });
}

// Funzione principale di inizializzazione
function initApp() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Elemento #root non trovato nel DOM");
    return;
  }

  // Imposta il favicon in base all'ambiente corrente
  try {
    const currentEnv = getCurrentEnvironment();
    updateFavicon(currentEnv);
    console.log(`🎨 Favicon impostato per ambiente: ${currentEnv}`);
  } catch (error) {
    console.warn("Errore durante l'impostazione del favicon dinamico:", error);
  }

  try {
    // Applicazione React con tutti i provider necessari
    const app = (
      <AppProviders queryClient={queryClient} store={appStore} datiSsr={bootstrapSsr?.dati}>
        <RouterProvider router={router} />
      </AppProviders>
    );

    // Rendering dell'applicazione
    if (bootstrapSsr) ReactDOM.hydrateRoot(rootElement, app);
    else ReactDOM.createRoot(rootElement).render(app);
  } catch (error) {
    console.error("Errore durante l'inizializzazione dell'app:", error);

    // Fallback in caso di errore critico
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; padding: 20px;">
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 20px; border-radius: 8px; max-width: 500px; text-align: center;">
            <h2 style="margin-top: 0;">Errore di caricamento</h2>
            <p>Si è verificato un errore durante il caricamento dell'applicazione.</p>
            <button onclick="window.location.reload()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
              Ricarica pagina
            </button>
          </div>
        </div>
      `;
    }
  }
}

// Avvio dell'applicazione quando il DOM è pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
