import { NextFunction, Request, RequestHandler, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { PERCORSI_OLIMPO_LETTURA } from '../utils/urlOlimpo';

/**
 * Proxy di sola lettura verso Olimpo, montato su /olimpo.
 *
 * Inoltra GET e HEAD sugli endpoint di PERCORSI_OLIMPO_LETTURA e il polling di
 * socket.io (che usa anche POST). Ogni altra richiesta, in particolare upload e
 * modifiche, riceve 404 senza raggiungere Olimpo. I cookie e l'Authorization del
 * browser non vengono inoltrati: la sessione di Fidelity resta a Fidelity.
 * Lo streaming e le richieste Range dei video passano invariati.
 */
export function creaProxyOlimpo(target: string): RequestHandler {
  const proxy = createProxyMiddleware<Request, Response>({
    target,
    changeOrigin: true,
    xfwd: true,
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.removeHeader('cookie');
        proxyReq.removeHeader('authorization');
      },
      proxyRes: (proxyRes) => {
        delete proxyRes.headers['set-cookie'];
      },
    },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    if (!richiestaAmmessa(req.method, req.path)) {
      res.status(404).json({ message: 'Risorsa Olimpo non disponibile' });
      return;
    }
    proxy(req, res, next);
  };
}

export function richiestaAmmessa(metodo: string, percorso: string): boolean {
  if (percorso.startsWith('/socket.io/')) {
    return metodo === 'GET' || metodo === 'POST';
  }
  return (metodo === 'GET' || metodo === 'HEAD')
    && (PERCORSI_OLIMPO_LETTURA as readonly string[]).includes(percorso);
}
