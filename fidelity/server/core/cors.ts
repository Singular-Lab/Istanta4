import cors from 'cors';
import { Express, NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../lib/errors/application/ForbiddenError';
import { ErrorCodes } from '../../lib/errors/ErrorCodes';
import config from './config/index';
import { log } from './logger';

// Applica la configurazione CORS all'app Express
export function applyCors(app: Express) {
  const isDevelopment = config.NODE_ENV === 'development';

  // Lista origin permessi per le API normali
  const allowedOrigins = [
    config.CLIENT_URL,
    config.OLYMPUS_IP_ADDRESS_CORS,
    ...config.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [],
  ].filter(Boolean);

  // Funzione helper per CORS permissivo
  const permissiveCorsHandler = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');

    // Permetti qualsiasi origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-FP-Version, X-Ephemeral-Token, X-Browser-Hash, X-Requested-With, Accept, x-csrf-token, X-Request-ID, x-api-key, x-internal-request, x-internal-request-ts, x-internal-request-signature');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'set-cookie, cookie, authorization, x-request-id, x-csrf-token, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };

  // Configurazione CORS standard per tutti gli altri endpoint (esclusi external ed ephemeral)
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Development: permetti tutti gli origin
      if (isDevelopment) {
        return callback(null, true);
      }

      // Production: whitelist ristretta
      if (!origin) {
        return callback(null, true); // Permetti richieste senza origin (Postman, curl)
      }

      if (allowedOrigins.indexOf(origin) === -1) {
        log.warn('Richiesta CORS bloccata: origin non consentito', { origin });
        return callback(new ForbiddenError({
          message: `Origin non consentito da CORS: ${origin}`,
          resource: origin,
          action: 'cors_access',
          details: { code: ErrorCodes.FORBIDDEN }
        }), false);
      }

      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    exposedHeaders: [
      'set-cookie',
      'cookie',
      'authorization',
      'x-request-id',
      'x-csrf-token',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-FP-Version',
      'X-Ephemeral-Token',
      'X-Browser-Hash',
      'X-Requested-With',
      'x-internal-request',
      'x-internal-request-ts',
      'x-internal-request-signature',
      'Accept',
      'x-csrf-token',
      'X-Request-ID',
      'x-api-key',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  // Applica CORS condizionale:
  // - development: permissivo su external/ephemeral per DX locale
  // - production/test: sempre CORS standard con whitelist
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    if (isDevelopment && (path.startsWith('/api/external') || path.startsWith('/api/auth/ephemeral'))) {
      return permissiveCorsHandler(req, res, next);
    }

    return cors(corsOptions)(req, res, next);
  });
}
