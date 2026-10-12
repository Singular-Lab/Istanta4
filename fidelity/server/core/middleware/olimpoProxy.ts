import { Request, RequestHandler, Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import { PERCORSI_OLIMPO_LETTURA } from '../utils/urlOlimpo';

/**
 * Header del browser che non arrivano a Olimpo: la sessione e le credenziali di
 * Fidelity restano a Fidelity, e quelli di connessione valgono solo per un tratto.
 */
const HEADER_RICHIESTA_ESCLUSI = new Set([
  'cookie', 'authorization', 'host', 'connection', 'keep-alive', 'proxy-connection',
  'transfer-encoding', 'te', 'trailer', 'upgrade',
]);

/** Header di Olimpo che non tornano al browser. */
const HEADER_RISPOSTA_ESCLUSI = new Set(['set-cookie', 'connection', 'keep-alive', 'transfer-encoding']);

/**
 * Proxy di sola lettura verso Olimpo, montato su /olimpo.
 *
 * Inoltra GET e HEAD sugli endpoint di PERCORSI_OLIMPO_LETTURA e il polling di
 * socket.io (che usa anche POST). Ogni altra richiesta, in particolare upload e
 * modifiche, riceve 404 senza raggiungere Olimpo. Corpo e risposta passano in
 * streaming, quindi le richieste Range dei video funzionano invariate.
 */
export function creaProxyOlimpo(target: string): RequestHandler {
  const base = new URL(target);
  const client = base.protocol === 'https:' ? https : http;
  const prefisso = base.pathname.replace(/\/+$/, '');

  return (req: Request, res: Response) => {
    if (!richiestaAmmessa(req.method, req.path)) {
      res.status(404).json({ message: 'Risorsa Olimpo non disponibile' });
      return;
    }

    const headers: http.OutgoingHttpHeaders = {};
    for (const [nome, valore] of Object.entries(req.headers)) {
      if (valore !== undefined && !HEADER_RICHIESTA_ESCLUSI.has(nome)) headers[nome] = valore;
    }
    headers.host = base.host;
    headers['x-forwarded-for'] = [req.headers['x-forwarded-for'], req.socket.remoteAddress]
      .filter(Boolean).join(', ');

    const richiesta = client.request(
      {
        protocol: base.protocol,
        hostname: base.hostname,
        port: base.port,
        method: req.method,
        // req.url e' gia' relativo al mount (/foto/...?query)
        path: `${prefisso}${req.url}`,
        headers,
      },
      (risposta) => {
        const intestazioni: http.OutgoingHttpHeaders = {};
        for (const [nome, valore] of Object.entries(risposta.headers)) {
          if (valore !== undefined && !HEADER_RISPOSTA_ESCLUSI.has(nome)) intestazioni[nome] = valore;
        }
        res.writeHead(risposta.statusCode ?? 502, intestazioni);
        risposta.pipe(res);
      }
    );

    richiesta.on('error', () => {
      if (!res.headersSent) {
        res.status(502).json({ message: 'Olimpo non raggiungibile' });
      } else {
        res.destroy();
      }
    });
    // Il browser chiude prima della fine (es. salto nel video): si interrompe anche Olimpo
    res.on('close', () => {
      if (!res.writableFinished) richiesta.destroy();
    });

    req.pipe(richiesta);
  };
}

export function richiestaAmmessa(metodo: string, percorso: string): boolean {
  if (percorso.startsWith('/socket.io/')) {
    return metodo === 'GET' || metodo === 'POST';
  }
  return (metodo === 'GET' || metodo === 'HEAD')
    && (PERCORSI_OLIMPO_LETTURA as readonly string[]).includes(percorso);
}
