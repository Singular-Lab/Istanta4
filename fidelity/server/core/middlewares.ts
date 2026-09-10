import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { Express, NextFunction, Request, Response } from 'express';
import { Session } from 'express-session';
import { randomUUID } from 'node:crypto';
import { TIPO_UTENTI } from '../../lib/enums';
import { NotFoundError } from '../../lib/errors/domain/NotFoundError';
import { serializeError } from '../../lib/errors/errorUtils';
import config from './config';
import { applyCors } from './cors';
import { log } from './logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { csrfProtection } from './middleware/csrfProtection';
import { applySecurityMiddlewares } from './middleware/securityMiddleware';
import { sessionMiddleware } from './session';

// Estendi la sessione per TypeScript
declare module 'express-session' {
  interface SessionData {
    id_utente?: string;
    id_gdo?: string;
    private_key?: string;
    email?: string;
    tipo_utente?: TIPO_UTENTI;
    requestCookieJar?: string;
    isExternalAuth?: boolean;
    lastIP?: string;
    lastUserAgent?: string;
    lastActivity?: Date;
    permessi_cache?: string[];
  }
}

// Applica tutti i middleware comuni all'app Express
export function applyMiddlewares(app: Express) {
  log.info('Applicazione dei middleware...');
  const csrfValidationMiddleware = csrfProtection();

  // IMPORTANTE: Trust proxy PRIMA di tutto
  if (config.NODE_ENV === 'production' || config.NODE_ENV === 'test') {
    app.set('trust proxy', 1); // "1" significa fidati del primo proxy avanti a te
  }

  // CORS deve essere applicato PRIMA dei middleware di sicurezza
  // per permettere alle preflight OPTIONS di rispondere correttamente
  applyCors(app);

  // Middleware di sicurezza (deve essere tra i primi)
  applySecurityMiddlewares(app);

  // Rate limiting generale per le API
  app.use('/api/', apiRateLimiter);

  // Middleware di compressione
  app.use(compressionMiddleware);

  // Middleware per parsing delle richieste
  app.use(cookieParser());
  app.use(sessionMiddleware);

  // Timeout dinamico delle sessioni
  // app.use(dynamicSessionTimeout);

  // Generatore token CSRF per tutte le richieste

  app.use(express.json({ limit: '200mb' })); // Ridotto per sicurezza
  app.use(express.raw({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
    if (!mutatingMethods.has(req.method.toUpperCase())) {
      return next();
    }

    if (req.path.startsWith('/api/external')) {
      return next();
    }

    if (config.NODE_ENV !== 'production' && req.path === '/api/dev/hash-password') {
      return next();
    }

    const hasSessionAuth = !!req.session?.id_utente;
    if (!hasSessionAuth) {
      return next();
    }

    const hasAuthorizationHeader = !!req.get('Authorization');
    const hasApiKeyHeader = !!req.get('x-api-key') || !!req.get('api-key');
    const hasEphemeralTokenHeader = !!req.get('X-Ephemeral-Token');

    if (hasAuthorizationHeader || hasApiKeyHeader || hasEphemeralTokenHeader) {
      return next();
    }

    return csrfValidationMiddleware(req, res, next);
  });

  app.use(requestIdMiddleware);
  app.use(poweredByMiddleware);

  log.info('Middleware applicati con successo');
}

// Funzione per applicare il middleware di gestione errori
// Deve essere chiamata DOPO aver registrato tutte le route
export function applyErrorHandler(app: Express) {
  log.info('Configurazione del middleware di gestione errori');

  // Applica il middleware di gestione errori con il logger personalizzato
  app.use(errorHandler({
    includeStackTrace: config.NODE_ENV !== 'production',
    logger: (error: unknown, req: Request) => {
      const errorData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.session?.id_utente || 'guest',
        error: error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error)
      };

      log.error(`${req.method} ${req.originalUrl} - ${error instanceof Error ? error.message : String(error)}`, errorData);
    }
  }));

  // Middleware per gestire errori 404 (route non trovate)
  app.use((req: Request, res: Response) => {
    const notFoundError = new NotFoundError({
      message: `Risorsa non trovata: ${req.method} ${req.originalUrl}`,
      entityType: 'route',
      entityId: `${req.method} ${req.originalUrl}`,
    });

    log.warn(`Route non trovata: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userId: req.session?.id_utente || 'guest'
    });

    res.status(notFoundError.httpStatus).json(serializeError(notFoundError));
  });
}

const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  // Usa l'ID dalla header se presente (per microservizi)
  req.id = req.headers['x-request-id'] || randomUUID();
  // Restituisci l'ID al client nella risposta
  // @ts-ignore
  res.setHeader('x-request-id', req.id as string);
  next();
};

const compressionMiddleware = compression({ level: 6, threshold: 0 });
const poweredByMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Powered-By', 'Istanta 2 GDO Suite');
  next();
};
