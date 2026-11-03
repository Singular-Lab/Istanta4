import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import i18next, { createInstance } from 'i18next';
import { useEffect, useState, type ReactNode } from 'react';
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ContextMenuProvider } from '../context/ContextMenuContext';
import { LoadingProvider } from '../context/LoadingContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PermissionProvider } from '../context/PermissionContext';
import { TimelineProvider } from '../context/TimeLinePromoContext';
import { UserProvider } from '../context/UserContext';
import { WebpliantSsrContext, type DatiWebpliantSsr } from '../ssr/webpliant';
import type { createAppStore } from '../stores/store';
import { WebpliantParamsProvider } from '../stores/webpliantParamsStore';

interface AppProvidersProps {
  children: ReactNode;
  queryClient: QueryClient;
  store: ReturnType<typeof createAppStore>;
  datiSsr?: DatiWebpliantSsr | null;
  helmetContext?: { helmet?: HelmetServerState };
}

export function AppProviders({ children, queryClient, store, datiSsr = null, helmetContext }: AppProvidersProps) {
  const [traduzioniIniziali] = useState(() => {
    if (!datiSsr) return i18next;
    const istanza = createInstance();
    void istanza.init({ lng: 'it', fallbackLng: 'it', resources: { it: { translation: {} } }, initAsync: false });
    return istanza;
  });
  const [browserPronto, setBrowserPronto] = useState(false);
  useEffect(() => { setBrowserPronto(true); }, []);
  return (
    <I18nextProvider i18n={browserPronto ? i18next : traduzioniIniziali}>
    <WebpliantSsrContext.Provider value={datiSsr}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <HelmetProvider context={helmetContext}>
            <Provider store={store}>
              <NotificationProvider>
                <UserProvider>
                  <PermissionProvider>
                    <ContextMenuProvider>
                      <TimelineProvider range={90}>
                        <WebpliantParamsProvider>
                          <LoadingProvider>{children}</LoadingProvider>
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
    </WebpliantSsrContext.Provider>
    </I18nextProvider>
  );
}
