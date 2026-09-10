// ws-server.ts
import http from 'node:http';
import cluster from 'cluster';
import { Server as IOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import { TIPO_UTENTI } from '../lib/enums';
import config from './core/config/index';
import { log } from './core/logger';
import { sessionMiddleware } from './core/session';
import {
  deviceSocketService,
  type DeviceHeartbeatPayload,
  type DeviceSlideChangePayload,
  type PVSubscribePayload,
} from './core/services/DeviceSocketService.js';
import ephemeralTokenService from './core/services/EphemeralTokenService.js';
import { PluginAnalyticsGatewayService } from './core/services/PluginAnalyticsGatewayService.js';

let io: IOServer | null = null;
let isInitializing = false;
let httpServer: http.Server | null = null;
let pluginWss: WebSocketServer | null = null;

// === MENABO PRESENCE ===

interface MenaboSession {
  idPromo: string;
  divisionId: string | undefined;
  userId: string;
  userName: string;
  userTipo: string;
}

// Map: socketId → session — persiste in-memory finché il processo vive
const menaboSessions = new Map<string, MenaboSession>();

function buildAllPresences(idPromo: string, sessions: Map<string, MenaboSession>): Record<string, MenaboEditor[]> {
  const result: Record<string, MenaboEditor[]> = {};
  for (const [socketId, s] of sessions) {
    if (s.idPromo !== idPromo || !s.divisionId) continue;
    const editors = result[s.divisionId] ?? [];
    editors.push({ socketId, userId: s.userId, userName: s.userName, userTipo: s.userTipo });
    result[s.divisionId] = editors;
  }
  return result;
}

// Invia SEMPRE lo snapshot completo delle presenze a tutta la room (replace totale lato client).
// Si è scelto il broadcast completo al posto degli update incrementali per-divisione: con pochi
// utenti per promo il payload è minimo, e si elimina alla radice la deriva dello stato (un singolo
// update incrementale "saltato" lasciava una presenza fantasma che bloccava l'ingresso in un
// canale/area in realtà libero, finché non si ricaricava la pagina).
function broadcastAllPresences(ioServer: IOServer, idPromo: string, sessions: Map<string, MenaboSession>): void {
  ioServer.to(`menabo-page:${idPromo}`).emit('menabo:all-presences', buildAllPresences(idPromo, sessions));
}

function cleanupMenaboSession(socket: { id: string; leave: (room: string) => void }, ioServer: IOServer, sessions: Map<string, MenaboSession>): void {
  const session = sessions.get(socket.id);
  if (!session) return;
  const { idPromo, divisionId } = session;
  sessions.delete(socket.id);
  socket.leave(`menabo-page:${idPromo}`);
  if (divisionId) broadcastAllPresences(ioServer, idPromo, sessions);
}

// Rimuove eventuali sessioni "zombie" dello stesso utente nella stessa promo, escluso il socket
// corrente. Su riconnessione (frequente in produzione) il socket prende un nuovo `socket.id` mentre
// la vecchia sessione resta nella mappa fino al pingTimeout (~15s): in quel periodo continua a
// occupare la divisione precedente generando un lock fantasma per gli altri utenti. La presenza è
// per-socket ma a livello applicativo un utente = una sola presenza per promo, quindi eviciamo le
// sessioni precedenti subito al re-annuncio invece di aspettare il disconnect.
// ponytail: un'eventuale seconda scheda dello stesso utente perde la presenza server-side finché non
// ri-emette page:join — accettabile per un tool interno dove un utente edita una divisione per volta.
function pruneUserSessions(sessions: Map<string, MenaboSession>, idPromo: string, userId: string, keepSocketId: string): boolean {
  let removed = false;
  for (const [sid, s] of sessions) {
    if (sid === keepSocketId) continue;
    if (s.idPromo === idPromo && s.userId === userId) {
      sessions.delete(sid);
      removed = true;
    }
  }
  return removed;
}

interface MenaboEditor {
  socketId: string;
  userId: string;
  userName: string;
  userTipo: string;
}

type SessionAwareRequest = http.IncomingMessage & {
  session?: Express.Request['session'];
};

function getSocketSession(socket: { request: http.IncomingMessage }): Express.Request['session'] | undefined {
  return (socket.request as SessionAwareRequest).session;
}

function getAuthenticatedMenaboUser(
  socket: { request: http.IncomingMessage },
  announcedUserName?: string,
): { userId: string; userTipo: TIPO_UTENTI; userName: string } | null {
  const session = getSocketSession(socket);
  const userId = session?.id_utente;
  const userTipo = session?.tipo_utente;

  if (!userId || !userTipo) return null;

  const trimmedName = announcedUserName?.trim();
  const fallbackName = session.email?.trim() || `Utente ${userId.slice(0, 8)}`;

  return {
    userId,
    userTipo,
    userName: trimmedName || fallbackName,
  };
}

/**
 * Converte i dati in un Buffer. Se il dato è null/undefined restituisce Buffer vuoto.
 * Oggetti vengono serializzati in JSON; se la serializzazione fallisce si usa Buffer vuoto.
 */
function convertToBuffer(data: any): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data === undefined || data === null) {
    log.warn('WebSocket: payload null/undefined ricevuto, restituito Buffer vuoto');
    return Buffer.alloc(0);
  }
  let stringData: string;
  if (typeof data === 'string') {
    stringData = data;
  } else {
    try {
      stringData = JSON.stringify(data);
    } catch (err) {
      log.error('WebSocket: impossibile serializzare payload in JSON, restituito Buffer vuoto', err);
      stringData = '';
    }
  }
  return Buffer.from(stringData);
}

function emitBuffer(io: IOServer, event: string, data: any): void {
  const buffer = convertToBuffer(data);
  io.emit(event, buffer);
}

export function startWSServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cluster.isWorker && (config.NODE_ENV === 'production' || config.NODE_ENV === 'test')) {
      log.debug(`Worker ${process.pid}: Socket.IO gestito dal master, skip inizializzazione`);
      resolve();
      return;
    }

    if (io) {
      log.debug('Socket.IO già inizializzato, skip');
      resolve();
      return;
    }

    if (isInitializing) {
      log.debug('Socket.IO: inizializzazione già in corso, attendo completamento...');
      const checkInit = setInterval(() => {
        if (io) {
          clearInterval(checkInit);
          log.debug('Socket.IO pronto (attesa completata)');
          resolve();
        } else if (!isInitializing) {
          clearInterval(checkInit);
          reject(new Error('Inizializzazione Socket.IO fallita durante attesa'));
        }
      }, 100);
      return;
    }

    log.info('Avvio inizializzazione Socket.IO...');
    isInitializing = true;

    try {
      httpServer = http.createServer();

      io = new IOServer(httpServer, {
        cors: {
          origin: [
            'http://localhost:3000',
            'http://192.168.178.197:3000',
            'http://192.168.178.197:4173',
            'http://192.168.178.197:3001',
            config.CLIENT_URL,
            config.OLYMPUS_IP_ADDRESS_CORS,
          ].filter(Boolean),
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket'],
        pingTimeout: 10000,
        pingInterval: 5000,
        connectionStateRecovery: {
          maxDisconnectionDuration: 30000,
          skipMiddlewares: true,
        },
      });

      const attachSessionToSocketRequest = sessionMiddleware as unknown as (
        req: SessionAwareRequest,
        res: http.ServerResponse,
        next: (err?: unknown) => void,
      ) => void;

      io.engine.use((req, res, next) => {
        attachSessionToSocketRequest(req as SessionAwareRequest, res, next);
      });

      deviceSocketService.initialize(io);

      io.on('connection', async socket => {
        log.debug(`WS client connesso: ${socket.id}`);

        const deviceToken = socket.handshake.query.deviceToken as string | undefined;

        if (deviceToken) {
          // === DISPOSITIVO PUNTO VENDITA ===
          const device = await deviceSocketService.authenticateDevice(deviceToken);

          if (!device) {
            socket.emit('device:auth-error', { message: 'Token non valido o dispositivo disattivato' });
            socket.disconnect(true);
            return;
          }

          deviceSocketService.handleDeviceConnect(socket, device);

          socket.on('device:heartbeat', (payload: DeviceHeartbeatPayload) => {
            deviceSocketService.handleDeviceHeartbeat(socket, payload);
          });

          socket.on('device:slide-change', (payload: DeviceSlideChangePayload) => {
            deviceSocketService.handleDeviceSlideChange(socket, payload);
          });

          socket.on('disconnect', reason => {
            deviceSocketService.handleDeviceDisconnect(socket);
            log.debug(`Device ${socket.id} disconnesso: ${reason}`);
          });

        } else {
          // === CLIENT UI NORMALE ===

          socket.on('pv:subscribe', (payload: PVSubscribePayload) => {
            deviceSocketService.subscribeToPV(socket, payload);
          });

          socket.on('pv:unsubscribe', (payload: PVSubscribePayload) => {
            deviceSocketService.unsubscribeFromPV(socket, payload);
          });

          socket.on('notification', data => {
            emitBuffer(io!, 'notification', data);
          });

          // === MENABO PRESENCE ===

          socket.on('menabo:page:join', (payload: { idPromo: string; userId?: string; userName?: string; userTipo?: string }) => {
            const authenticatedUser = getAuthenticatedMenaboUser(socket, payload.userName);
            if (!authenticatedUser) {
              socket.emit('menabo:auth-error', { message: 'Sessione non valida per il Menabo' });
              log.warn('Menabò presenza rifiutata: sessione socket non autenticata', {
                socketId: socket.id,
                idPromo: payload.idPromo,
              });
              return;
            }

            const { idPromo } = payload;
            const { userId, userName, userTipo } = authenticatedUser;

            if (payload.userId && payload.userId !== userId) {
              log.warn('Menabò presenza: userId client non coerente con la sessione, uso valore server', {
                socketId: socket.id,
                idPromo,
                announcedUserId: payload.userId,
                sessionUserId: userId,
              });
            }

            if (payload.userTipo && payload.userTipo !== userTipo) {
              log.warn('Menabò presenza: userTipo client non coerente con la sessione, uso valore server', {
                socketId: socket.id,
                idPromo,
                announcedUserTipo: payload.userTipo,
                sessionUserTipo: userTipo,
              });
            }

            socket.join(`menabo-page:${idPromo}`);
            // Evici subito eventuali sessioni zombie dello stesso utente (vecchio socket.id da una
            // riconnessione): altrimenti la divisione precedente resterebbe "occupata" fino al pingTimeout.
            const evictedZombie = pruneUserSessions(menaboSessions, idPromo, userId, socket.id);
            menaboSessions.set(socket.id, { idPromo, divisionId: undefined, userId, userName, userTipo });
            // Se abbiamo rimosso uno zombie va aggiornata tutta la room (il lock fantasma spariva solo
            // per il joiner); altrimenti basta inviare lo snapshot al socket che è appena entrato.
            if (evictedZombie) {
              broadcastAllPresences(io!, idPromo, menaboSessions);
            } else {
              socket.emit('menabo:all-presences', buildAllPresences(idPromo, menaboSessions));
            }
            log.debug(`Menabò presenza: ${userName} entrato nella pagina promo ${idPromo}`);
          });

          socket.on('menabo:page:leave', () => {
            cleanupMenaboSession(socket, io!, menaboSessions);
          });

          socket.on('menabo:join', (payload: { idPromo: string; divisionId: string }) => {
            const session = menaboSessions.get(socket.id);
            if (!session) return;
            session.divisionId = payload.divisionId;
            broadcastAllPresences(io!, payload.idPromo, menaboSessions);
            log.debug(`Menabò presenza: ${session.userName} entrato in ${payload.divisionId}`);
          });

          socket.on('menabo:leave', () => {
            const session = menaboSessions.get(socket.id);
            if (!session?.divisionId) return;
            const { idPromo } = session;
            session.divisionId = undefined;
            broadcastAllPresences(io!, idPromo, menaboSessions);
          });

          socket.on('menabo:kick', (payload: { targetSocketId: string }) => {
            const kicker = menaboSessions.get(socket.id);
            const kickerAuth = getAuthenticatedMenaboUser(socket);
            if (!kicker || !kickerAuth || kickerAuth.userId !== kicker.userId || kickerAuth.userTipo !== TIPO_UTENTI.SUPERADMIN) {
              return;
            }
            const target = io!.sockets.sockets.get(payload.targetSocketId);
            const targetSession = menaboSessions.get(payload.targetSocketId);
            if (!target || !targetSession) return;
            if (targetSession.userTipo === TIPO_UTENTI.SUPERADMIN) return;
            const kickedDivisionId = targetSession.divisionId;
            target.emit('menabo:kicked', { kickedBy: kicker.userName, divisionId: kickedDivisionId });
            targetSession.divisionId = undefined;
            if (kickedDivisionId) broadcastAllPresences(io!, targetSession.idPromo, menaboSessions);
            log.debug(`Menabò: ${kicker.userName} ha rimosso ${targetSession.userName} da ${kickedDivisionId}`);
          });

          socket.onAny((eventName, ...args) => {
            const handledEvents = [
              'disconnect', 'notification', 'pv:subscribe', 'pv:unsubscribe',
              'menabo:page:join', 'menabo:page:leave', 'menabo:join', 'menabo:leave', 'menabo:kick',
            ];
            if (!handledEvents.includes(eventName)) {
              log.debug(`WS evento ricevuto: ${eventName} da ${socket.id}`);
              emitBuffer(io!, eventName, args.length === 1 ? args[0] : args);
            }
          });

          socket.on('disconnect', reason => {
            cleanupMenaboSession(socket, io!, menaboSessions);
            log.debug(`WS client ${socket.id} disconnesso: ${reason}`);
          });
        }
      });

      // === PLUGIN ANALYTICS WebSocket (raw ws, path: /ws/plugin-events) ===
      pluginWss = new WebSocketServer({ noServer: true });

      pluginWss.on('connection', (ws, request, meta: { slug: string; fpVersion: string }) => {
        const gateway = PluginAnalyticsGatewayService.getInstance();
        gateway.handleConnection(ws, request, meta);
      });

      httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);

        if (url.pathname === '/ws/plugin-events') {
          const token = url.searchParams.get('token');
          const browserHash = url.searchParams.get('browserHash');
          const fpVersion = url.searchParams.get('fpVersion') || '';
          const slug = url.searchParams.get('slug') || '';
          const origin = request.headers.origin || 'unknown';
          const ip = request.socket.remoteAddress || 'unknown';
          const userAgent = request.headers['user-agent'] || 'unknown';

          if (!token || !browserHash) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          ephemeralTokenService.validateToken(token, origin, browserHash, ip, userAgent)
            .then((result) => {
              if (!result.valid) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
              }

              pluginWss!.handleUpgrade(request, socket, head, (ws) => {
                pluginWss!.emit('connection', ws, request, { slug, fpVersion });
              });
            })
            .catch(() => {
              socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
              socket.destroy();
            });
        }
      });

      if (cluster.isPrimary) {
        cluster.on('message', (worker, message) => {
          if (message.type === 'socket_emit' && io) {
            log.debug(`Master: evento IPC ricevuto dal worker ${worker.process.pid}`, { event: message.event });
            emitBuffer(io!, message.event, message.data);
          }

          if (message.type === 'analytics_metrics_request') {
            const gateway = PluginAnalyticsGatewayService.getInstance();
            const metrics = gateway.getMetrics();
            worker.send({
              type: 'analytics_metrics_response',
              requestId: message.requestId,
              data: metrics,
            });
          }
        });
      }

      const WS_PORT = config.WS_PORT;

      if (!WS_PORT) {
        throw new Error('WS_PORT non configurata nelle variabili d\'ambiente');
      }

      httpServer.listen(WS_PORT, () => {
        log.info(`WebSocket server in ascolto sulla porta ${WS_PORT}`);
        log.info('Socket.IO inizializzato correttamente');
        isInitializing = false;
        resolve();
      });

      httpServer.on('error', (error: NodeJS.ErrnoException) => {
        let reason = error.message || 'Errore sconosciuto';
        if (error.code === 'EADDRINUSE') {
          reason = `Porta ${WS_PORT} già occupata da un altro processo`;
        } else if (error.code === 'EACCES') {
          reason = `Permessi insufficienti per aprire la porta ${WS_PORT}`;
        }

        log.error(`Avvio server WebSocket fallito: ${reason}`, error, { port: WS_PORT });

        io = null;
        httpServer = null;
        isInitializing = false;
        reject(new Error(`Avvio server WebSocket fallito: ${reason}`));
      });

      setTimeout(() => {
        if (isInitializing) {
          log.error('Timeout inizializzazione Socket.IO: nessuna risposta entro 10 secondi', null, { port: WS_PORT });
          io = null;
          httpServer = null;
          isInitializing = false;
          reject(new Error('Timeout inizializzazione Socket.IO (10s)'));
        }
      }, 10000);

    } catch (error) {
      log.error('Errore imprevisto durante il setup di Socket.IO', error instanceof Error ? error : null);
      io = null;
      httpServer = null;
      isInitializing = false;
      reject(error);
    }
  });
}

export function emitToClients(event: string, data: any): void {
  if (cluster.isWorker && (config.NODE_ENV === 'production' || config.NODE_ENV === 'test')) {
    process.send?.({ type: 'socket_emit', event, data });
    log.debug(`Worker ${process.pid}: evento inviato al master via IPC`, { event });
  } else if (io) {
    emitBuffer(io, event, data);
    log.debug('Evento WebSocket emesso direttamente', { event });
  } else {
    log.warn('Impossibile emettere evento WebSocket: Socket.IO non disponibile', { event });
  }
}

export function emitBufferToClients(event: string, data: any): void {
  emitToClients(event, data);
}

export function getIO(): IOServer {
  if (cluster.isWorker && (config.NODE_ENV === 'production' || config.NODE_ENV === 'test')) {
    throw new Error('getIO() non disponibile nei worker. Usa emitToClients() invece.');
  }

  if (!io) {
    throw new Error('Socket.IO non inizializzato. Chiama startWSServer() e attendi il completamento prima di usare getIO()');
  }
  return io;
}

export function isIOInitialized(): boolean {
  return io !== null;
}

export async function stopWSServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!io || !httpServer) {
      log.warn('stopWSServer chiamato ma il server WebSocket non è attivo');
      resolve();
      return;
    }

    log.info('Arresto server WebSocket in corso...');

    const gateway = PluginAnalyticsGatewayService.getInstance();
    gateway.shutdown().catch(err =>
      log.error('Errore durante lo shutdown del gateway analytics', err instanceof Error ? err : null)
    );

    if (pluginWss) {
      pluginWss.close();
      pluginWss = null;
    }

    io.close(() => {
      log.info('Socket.IO chiuso');
    });

    httpServer.close(() => {
      log.info('Server HTTP WebSocket chiuso');
      io = null;
      httpServer = null;
      isInitializing = false;
      resolve();
    });
  });
}
