// src/main.tsx
import "@vitejs/plugin-react/preamble";
import { ContextMenuProvider } from "@/context/ContextMenuContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { WebpliantParamsProvider } from "@/stores/webpliantParamsStore";
import { getCurrentEnvironment, updateFavicon } from "@/utils/environmentFavicon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { HelmetProvider } from "react-helmet-async";
import { Provider } from "react-redux";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./assets/css/app.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingProvider } from "./context/LoadingContext";
import { TimelineProvider } from "./context/TimeLinePromoContext";
import { PermissionProvider } from "./context/PermissionContext";
import { UserProvider } from "./context/UserContext";
import './customComponents';
import "./i18n";
import routes from "./router";
import { store } from "./stores/store";
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


const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
    </>
  );
};

// Configurazione QueryClient ottimizzata
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Non ritentare per errori client (400-499)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
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
const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL,
});

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
      <ErrorBoundary >
        <QueryClientProvider client={queryClient}>
          <HelmetProvider>
            <Provider store={store}>
              <NotificationProvider>
                  <UserProvider>
                    <PermissionProvider>
                    <ContextMenuProvider>
                      <TimelineProvider range={90}>
                        <WebpliantParamsProvider>
                          <LoadingProvider>
                            <AppWrapper>
                              <RouterProvider router={router} />
                            </AppWrapper>
                          </LoadingProvider>
                        </WebpliantParamsProvider>
                      </TimelineProvider>
                    </ContextMenuProvider>
                    </PermissionProvider>
                  </UserProvider>
              </NotificationProvider>
            </Provider>
          </HelmetProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );

    // Rendering dell'applicazione
    ReactDOM.createRoot(rootElement).render(app);
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
