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
import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
dayjs.extend(customParseFormat);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(localeData);
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.locale('it');

// ---------------- core / infrastruttura ----------------
import config from './config/index';
import { sequelize } from './db/SequelizeConnector';
import { httpLogger, log } from './logger';
import { applyErrorHandler, applyMiddlewares } from './middlewares';
import {
  getConnectionMonitor,
  getQueryProfiler,
  initializeConnectionMonitor,
  initializeQueryProfiler
} from './monitoring';
import { applyRoutes } from './routes';
import { initializeBackgroundServices } from './services/startup';
import { sessionMiddleware } from './session';
import { asyncHandler } from './utils/asyncHandler';
import healthRouter from '../src/app/http/health.routes.js';
import metricsRouter from '../src/app/http/metrics.routes.js';
import { metricsMiddleware } from '../src/shared/observability/metrics.js';
import { closeRedisClient, initializeRedisClient } from '../src/shared/cache/redis.client.js';

// -------------- impostazioni runtime -------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname_current = dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname_current, '../.env'), // .env una cartella sopra server/
});

const projectRoot = path.resolve(__dirname_current, '../../'); // server/core/ -> server/ -> projectRoot/
log.debug('Project root resolved', { context: 'Bootstrap', projectRoot });
export const resolvePathFromProjectRoot = (p: string) =>
  path.resolve(projectRoot, p);

const isProd = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === "test";

export async function createHttpApp() {
  const app = express();

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

  app.get('/api/health/db/queries', asyncHandler(async (req, res) => {
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

  // ③-A Servizi statici specifici (precedentemente in static.ts)
  const insegneDir = config.ICONE_INSEGNA_DIR as string;
  if (insegneDir) { // Aggiungo un controllo per sicurezza
    app.use("/insegne", express.static(insegneDir));
    log.info(`Servizio statico per /insegne configurato da ${insegneDir}`);
  }
  // Path.resolve() qui darà server/core. projectRoot è server/../.. -> root del progetto.
  // Quindi src/assets/images deve essere relativo a projectRoot
  const srcAssetsImagesPath = path.resolve(projectRoot, 'src/assets/images');
  app.use('/src/assets/images', express.static(srcAssetsImagesPath));
  log.info(`Servizio statico per /src/assets/images configurato da ${srcAssetsImagesPath}`);

  // ③-B Client app handling:
  // - production: serve built assets from dist/client
  // - development: redirect HTML routes to Vite dev server
  const clientBuildPath = path.resolve(projectRoot, 'dist/client');
  // if (isProd || isStaging) {
  app.use(express.static(clientBuildPath));
  log.info(`Servizio statico per la build del client configurato da ${clientBuildPath}`);

  // Handler per SPA: deve venire dopo le API e tutti gli statici specifici
  // Express 5.x compatibility: use regex instead of wildcard '*'
  app.get(/(.*)/, (req, res, next) => {
    // Skip if request is for static files or API routes
    if (!req.accepts('html') || req.path.startsWith('/api')) {
      return next();
    }
    // Serve index.html for all other routes (SPA fallback)
    res.sendFile(path.resolve(clientBuildPath, 'index.html'));
  });
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
  const handleShutdown = (signal: string) => {
    log.info(`Ricevuto segnale ${signal}, avvio spegnimento controllato...`);

    getConnectionMonitor()?.stopMonitoring();
    getQueryProfiler()?.stopProfiling();

    // Chiudi il server HTTP in modo pulito
    httpServer.close(() => {
      log.info('Server HTTP chiuso con successo');

      closeRedisClient()
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


