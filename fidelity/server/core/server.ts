// server.ts – entry-point Express
// ----------------------------------------------------
// Tutto ciò che ti serve per far girare:
// 1. middleware, sessioni, API, cron, DB, socket.io
//
// ➜ Adatta i path degli import se le cartelle differiscono.

import dayjs from "dayjs";
import 'dayjs/locale/it';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import express from 'express';
import http from 'node:http';
import path, { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.locale('it');

// ---------------- core / infrastruttura ----------------
import healthRouter from '../src/app/http/health.routes.js';
import metricsRouter from '../src/app/http/metrics.routes.js';
import { closeRedisClient, initializeRedisClient } from '../src/shared/cache/redis.client.js';
import { metricsMiddleware } from '../src/shared/observability/metrics.js';
import config from './config/index';
import { sequelize } from './db/SequelizeConnector';
import { container, TYPES } from './di';
import type { IConfigService } from './interfaces/IConfigService';
import type { IReferenzeService } from './interfaces/IReferenzeService';
import type { IWebPliantService } from './interfaces/IWebPliantService';
import { httpLogger, log } from './logger';
import { authMiddleware } from './middleware/authMiddleware';
import { creaProxyOlimpo } from './middleware/olimpoProxy';
import { permissionGuard } from './middleware/permissionGuard';
import { creaSsrWebpliant } from './middleware/ssrWebpliant';
import { serviClientStatico } from './middleware/staticiPrecompressi';
import { applyErrorHandler, applyMiddlewares } from './middlewares';
import {
    getConnectionMonitor,
    getQueryProfiler,
    initializeConnectionMonitor,
    initializeQueryProfiler
} from './monitoring';
import { applyRoutes } from './routes';
import { AuditLogService } from './services/AuditLogService';
import { initializeBackgroundServices } from './services/startup';
import { WebpliantSsrService } from './services/WebpliantSsrService';
import { sessionMiddleware } from './session';
import { asyncHandler } from './utils/asyncHandler';
import { PREFISSO_PROXY_OLIMPO } from './utils/urlOlimpo';
import { getWhatsappQueueWorker } from './workers/WhatsappQueueWorker';

// -------------- impostazioni runtime -------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname_current = dirname(__filename);

const projectRoot = path.resolve(__dirname_current, '../../'); // server/core/ -> server/ -> projectRoot/
log.debug('Project root resolved', { context: 'Bootstrap', projectRoot });
export const resolvePathFromProjectRoot = (p: string) =>
  path.resolve(projectRoot, p);

const isProd = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === "test";

export async function createHttpApp() {
  const app = express();

  // ⓪ Letture dei materiali Olimpo per il browser: prima della sessione e dei body
  // parser, cosi' le richieste arrivano a Olimpo intatte e senza creare sessioni
  app.use(PREFISSO_PROXY_OLIMPO, creaProxyOlimpo(config.OLYMPUS_IP_ADDRESS));

  // ① Sessione + middleware di base
  app.use(sessionMiddleware);
  applyMiddlewares(app);
  app.use(httpLogger);
  app.use(metricsMiddleware);

  // Observability — montati prima delle route API per non essere intercettati
  app.use(healthRouter);
  app.use(metricsRouter);

  app.get('/api/health/db', asyncHandler(async (req, res) => {
    const monitor = getConnectionMonitor();
    if (!monitor) {
      res.status(503).json({ status: 'error', message: 'Connection monitor non inizializzato' });
      return;
    }

    const [health, metrics, averages] = await Promise.all([
      monitor.healthCheck(),
      Promise.resolve(monitor.getMetrics()),
      Promise.resolve(monitor.getAverageMetrics())
    ]);

    res.json({
      status: 'ok',
      health,
      metrics,
      averages
    });
  }));

  // Espone SQL e struttura delle query: riservato agli amministratori.
  app.get('/api/health/db/queries', authMiddleware, permissionGuard('impostazioni.modifica_generali'), asyncHandler(async (req, res) => {
    const profiler = getQueryProfiler();
    if (!profiler) {
      res.status(503).json({ status: 'error', message: 'Query profiler non inizializzato' });
      return;
    }

    res.json({
      status: 'ok',
      stats: profiler.getStatistics(),
      slowQueries: profiler.getSlowQueries(20),
      recentQueries: profiler.getRecentQueries(20)
    });
  }));

  // ② API
  await applyRoutes(app);

  // ③-B Client app handling:
  // - production: serve built assets from dist/client
  // - development: redirect HTML routes to Vite dev server
  const clientBuildPath = path.resolve(projectRoot, 'dist/client');
  const urlRenderer = pathToFileURL(path.resolve(projectRoot, 'dist/ssr/entry-server.js')).href;
  app.use(creaSsrWebpliant({
    cartellaClient: clientBuildPath,
    carica: url => new WebpliantSsrService(
      container.get<IWebPliantService>(TYPES.WebPliantService),
      container.get<IReferenzeService>(TYPES.ReferenzeService),
      container.get<IConfigService>(TYPES.ConfigService),
    ).carica(url),
    render: async dati => {
      const renderer = await import(urlRenderer);
      return renderer.renderWebpliant(dati);
    },
  }));
  log.info('Rendering SSR del volantino pubblico configurato', {
    ambiente: isProd ? 'production' : isStaging ? 'test' : 'development',
  });
  // if (isProd || isStaging) {
  // Asset con hash in cache per un anno, index.html sempre rivalidato, .br/.gz della build
  // serviti cosi' come sono; poi il fallback della SPA (index.html per le rotte del client)
  serviClientStatico(app, clientBuildPath);
  log.info(`Servizio statico per la build del client configurato da ${clientBuildPath}`);
  // }
  // else {
  //   const vitePort = config.PORTA_VITE;
  //   app.get(/(.*)/, (req, res, next) => {
  //     if (!req.accepts('html') || req.path.startsWith('/api')) {
  //       return next();
  //     }
  //     return res.redirect(302, `http://localhost:${vitePort}${req.originalUrl}`);
  //   });
  //   log.info(`Development mode: HTML routes redirected to Vite dev server on port ${vitePort}`);
  // }

  // ④ Error handler
  applyErrorHandler(app);

  return app;
}
// -------------------------------------------------------
//  createActualServer – server HTTP completo
// -------------------------------------------------------
export async function createActualServer() {
  // ----- init infra ------------------------------------
  // log.info('Inizializzazione database');
  // await tryCatch(initializeDatabase, {
  //   operation: 'initDB',
  //   userId: 'system',
  //   errorMessage: 'Errore durante init DB',
  //   logContext: {
  //     env: config.NODE_ENV
  //   }
  // });

  await initializeRedisClient();

  log.info('Avvio cron job promozioni');
  await initializeBackgroundServices()
  const configuredPoolMax = Number.parseInt(process.env.DB_POOL_MAX ?? '', 10);
  const connectionMonitor = initializeConnectionMonitor(sequelize, {
    maxPoolSize: Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 8
  });
  connectionMonitor.startMonitoring();

  const queryProfiler = initializeQueryProfiler(sequelize, {
    slowQueryThresholdMs: Number(process.env.DB_SLOW_QUERY_THRESHOLD ?? 150)
  });
  queryProfiler.startProfiling();

  // ----- Express & HTTP --------------------------------
  const app = await createHttpApp();
  const httpServer = http.createServer(app);

  // ⑤ Socket.io

  // ----- Avvio -----------------------------------------
  const PORT = config.NODE_PORT || process.env.NODE_PORT || 5173;
  const HOST = '0.0.0.0';

  httpServer.listen(Number(PORT), HOST, () => {
    log.info('Server started', {
      context: 'Bootstrap',
      host: HOST,
      port: Number(PORT),
      environment: config.NODE_ENV,
      pid: process.pid,
      url: `http://${HOST}:${PORT}`,
    });
  });
  // Gestione dei segnali di terminazione
  let inChiusura = false;
  const handleShutdown = (signal: string) => {
    // Il segnale può arrivare sia da PM2 sia inoltrato dal primary: si chiude una volta sola
    if (inChiusura) return;
    inChiusura = true;
    log.info(`Ricevuto segnale ${signal}, avvio spegnimento controllato...`);

    getConnectionMonitor()?.stopMonitoring();
    getQueryProfiler()?.stopProfiling();

    // Nessun nuovo invio WhatsApp durante lo spegnimento
    const whatsappWorker = getWhatsappQueueWorker();
    if (whatsappWorker.isActive()) whatsappWorker.stop();

    // Audit in memoria scritto subito, nel caso la chiusura HTTP si blocchi...
    const audit = AuditLogService.getInstance();
    void audit.forceFlush();

    // Chiudi il server HTTP in modo pulito
    httpServer.close(() => {
      log.info('Server HTTP chiuso con successo');

      // ...e di nuovo a richieste concluse, attendendo le scritture su DB
      audit.forceFlush()
        .then(() => closeRedisClient())
        .catch(() => undefined)
        .finally(() => {
          log.info('Terminazione processo completata');
          process.exit(0);
        });
    });

    // Timeout di sicurezza in caso di blocco
    setTimeout(() => {
      log.error('Impossibile chiudere le connessioni in tempo, forzatura uscita');
      process.exit(1);
    }, 10000); // 10 secondi di timeout
  };

  // Registra i gestori per i segnali comuni
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGHUP', () => handleShutdown('SIGHUP'));

  // Gestione degli errori non catturati
  process.on('uncaughtException', (error) => {
    log.error('Eccezione non catturata:', error);
    handleShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error('Promise non gestita:', { reason, promise });
    handleShutdown('unhandledRejection');
  });
}

// -------------------------------------------------------
//  bootstrap – cluster oppure single process
// -------------------------------------------------------
