import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { log } from '../logger';
import { leggiIndirizzoUpgrade } from './socketSicuro';

/**
 * Richieste di upgrade WebSocket sulla porta del canale in tempo reale, nel primary (ws-server.ts).
 * Spec processi-in-produzione, "Richieste e messaggi malformati non fermano Fidelity": una richiesta
 * malformata si rifiuta e il processo resta attivo.
 *
 * - /socket.io/... lo gestisce engine.io, che si registra per primo sullo stesso server;
 * - /ws/plugin-events e' il canale degli eventi del plugin: entra solo con un token effimero valido;
 * - il resto si rifiuta subito.
 */

export const PERCORSO_EVENTI_PLUGIN = '/ws/plugin-events';
export const PREFISSO_SOCKET_IO = '/socket.io/';

export interface MetaConnessionePlugin {
  slug: string;
  fpVersion: string;
}

export interface DipendenzeUpgrade {
  validaToken: (token: string, origin: string, browserHash: string, ip: string, userAgent: string) => Promise<{ valid: boolean }>;
  /** Completa l'upgrade e apre la connessione del plugin. */
  accetta: (request: IncomingMessage, socket: Duplex, head: Buffer, meta: MetaConnessionePlugin) => void;
}

function rifiuta(socket: Duplex, risposta: string): void {
  if (socket.destroyed) return;
  try {
    socket.write(`HTTP/1.1 ${risposta}\r\nConnection: close\r\n\r\n`);
  } finally {
    socket.destroy();
  }
}

export function gestisciUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, dipendenze: DipendenzeUpgrade): void {
  // Dopo l'upgrade Node toglie il proprio ascoltatore di errori dal socket: senza questo, un client
  // che chiude la connessione mentre si verifica il token (o mentre socket.io legge la sessione)
  // diventerebbe un'eccezione non gestita del primary
  socket.on('error', (errore: Error) => {
    log.debug('WebSocket: connessione chiusa dal client durante l\'upgrade', { errore: errore.message });
  });

  const indirizzo = leggiIndirizzoUpgrade(request.url);
  if (!indirizzo) {
    log.warn('WebSocket: upgrade con indirizzo non valido rifiutato', { ip: request.socket.remoteAddress });
    rifiuta(socket, '400 Bad Request');
    return;
  }
  if (indirizzo.percorso.startsWith(PREFISSO_SOCKET_IO)) return;
  if (indirizzo.percorso !== PERCORSO_EVENTI_PLUGIN) {
    rifiuta(socket, '404 Not Found');
    return;
  }

  const token = indirizzo.parametri.get('token');
  const browserHash = indirizzo.parametri.get('browserHash');
  const meta: MetaConnessionePlugin = {
    fpVersion: indirizzo.parametri.get('fpVersion') || '',
    slug: indirizzo.parametri.get('slug') || '',
  };
  const origin = request.headers.origin || 'unknown';
  const ip = request.socket.remoteAddress || 'unknown';
  const userAgent = request.headers['user-agent'] || 'unknown';

  if (!token || !browserHash) {
    rifiuta(socket, '401 Unauthorized');
    return;
  }

  dipendenze.validaToken(token, origin, browserHash, ip, userAgent)
    .then((esito) => {
      if (socket.destroyed) return;
      if (!esito.valid) {
        rifiuta(socket, '401 Unauthorized');
        return;
      }
      dipendenze.accetta(request, socket, head, meta);
    })
    .catch((errore: unknown) => {
      log.warn('WebSocket: verifica del token del plugin non riuscita', { errore: errore instanceof Error ? errore.message : String(errore) });
      rifiuta(socket, '500 Internal Server Error');
    });
}
