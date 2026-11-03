import { QueryClient } from '@tanstack/react-query';
import type { HelmetServerState } from 'react-helmet-async';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router-dom';
import { AppProviders } from './app/AppProviders';
import routes from './router';
import { datiLoaderWebpliant, ID_LAYOUT_WEBPLIANT, ID_VOLANTINO_WEBPLIANT, type DatiWebpliantSsr } from './ssr/webpliant';
import { createAppStore } from './stores/store';

export async function renderWebpliant(dati: DatiWebpliantSsr) {
  const moduloBrowser: string = 'react-dom/server.browser';
  const { renderToReadableStream } = await import(moduloBrowser) as typeof import('react-dom/server');
  const rotta = routes.find(route => route.id === ID_LAYOUT_WEBPLIANT);
  if (!rotta || rotta.index) throw new Error('Rotta pubblica WebPliant non disponibile');
  const loaderData = datiLoaderWebpliant(dati);
  const handler = createStaticHandler([{
    ...rotta,
    loader: () => loaderData[ID_LAYOUT_WEBPLIANT],
    children: rotta.children?.filter(route => route.id === ID_VOLANTINO_WEBPLIANT).map(route => ({
      ...route,
      loader: () => loaderData[ID_VOLANTINO_WEBPLIANT],
    })),
  }]);
  const context = await handler.query(new Request(new URL(dati.url, 'http://ssr.local')));
  if (context instanceof Response) throw new Error(`Rendering WebPliant rifiutato (${context.status})`);
  const router = createStaticRouter(handler.dataRoutes, context);
  const store = createAppStore();
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  queryClient.setQueryData(['config'], dati.config);
  const helmetContext: { helmet?: HelmetServerState } = {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Tempo di rendering del volantino superato')), 10_000);
  try {
    let erroreRendering: unknown;
    const stream = await renderToReadableStream(
        <AppProviders queryClient={queryClient} store={store} datiSsr={dati} helmetContext={helmetContext}>
          <StaticRouterProvider router={router} context={context} hydrate={false} />
        </AppProviders>,
        {
          signal: controller.signal,
          onError(error) { erroreRendering = error; },
        },
      );
    await stream.allReady;
    if (erroreRendering) throw erroreRendering;
    controller.signal.throwIfAborted();
    const html = await new Response(stream).text();
    return { html, bootstrap: { dati, reduxState: store.getState() }, helmet: helmetContext.helmet };
  } finally {
    clearTimeout(timeout);
    queryClient.clear();
  }
}
