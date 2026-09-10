import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RateLimitError } from '../../../lib/errors/application/RateLimitError';
import { sendAppError } from '../../../lib/errors/errorUtils';
import { getRedisClient } from '../../src/shared/cache/redis.client';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';
import { RedisRateLimitStore } from './RedisRateLimitStore';

function isRedisClientReady(redis: unknown): boolean {
  if (!redis || typeof redis !== 'object') return false;

  const client = redis as { isReady?: boolean };
  return client.isReady === true;
}

type RateLimitOptions = Omit<NonNullable<Parameters<typeof rateLimit>[0]>, 'store'>;
type StoreMode = 'redis' | 'memory';

function createBootstrapRateLimiter(prefix: string, options: RateLimitOptions) {
  const memoryLimiter = rateLimit({
    ...options,
    passOnStoreError: true
  });

  let redisLimiter: ReturnType<typeof rateLimit> | null = null;
  let lastMode: StoreMode | null = null;

  const getRedisLimiter = (): ReturnType<typeof rateLimit> | null => {
    const redis = getRedisClient();

    if (!isRedisClientReady(redis)) {
      return null;
    }

    if (!redisLimiter) {
      redisLimiter = rateLimit({
        ...options,
        passOnStoreError: true,
        store: new RedisRateLimitStore(redis, prefix)
      });
    }

    return redisLimiter;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const currentRedisLimiter = getRedisLimiter();
    const mode: StoreMode = currentRedisLimiter ? 'redis' : 'memory';

    if (mode !== lastMode) {
      if (mode === 'redis') {
        log.info('Rate limiting distribuito su Redis attivo', { prefix });
      } else if (lastMode === 'redis') {
        log.warn('Redis non pronto per rate limiting, fallback su store in-memory', { prefix });
      }
      lastMode = mode;
    }

    if (mode === 'redis') {
      return currentRedisLimiter(req, res, next);
    }

    return memoryLimiter(req, res, next);
  };
}

/**
 * Helper per generare chiavi IP sicure che gestiscono correttamente IPv6
 * Usa l'helper ufficiale di express-rate-limit per massima sicurezza
 */
function generateIPKey(req: Request): string {
  return ipKeyGenerator(req.ip || '');
}

/**
 * Rate limiter per le operazioni di autenticazione
 * Limita severamente i tentativi di login per prevenire attacchi brute force
 */
export const authRateLimiter = createBootstrapRateLimiter('rl:auth:', {
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // massimo 5 tentativi per IP in 15 minuti
  message: {
    error: 'Troppi tentativi di login',
    message: 'Hai superato il limite di tentativi di login. Riprova tra 15 minuti.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true, // Ritorna rate limit info negli headers `RateLimit-*`
  legacyHeaders: false, // Disabilita gli headers `X-RateLimit-*`
  skipSuccessfulRequests: true, // Non conta le richieste di login riuscite
  skipFailedRequests: false, // Conta le richieste fallite
  keyGenerator: (req: Request) => {
    // Usa l'helper generateIPKey per gestire correttamente IPv6
    const ipKey = generateIPKey(req);
    // Aggiungi User-Agent per una chiave più specifica
    return `${ipKey}-${req.get('User-Agent') || 'unknown'}`;
  },
  // Personalizza il messaggio di errore
  handler: (req: Request, res: Response) => {
    const auditService = AuditLogService.getInstance();
    auditService.rateLimitExceeded(req, 'auth');
    auditService.loginFailed(req, req.body?.email || 'unknown', 'Rate limit exceeded');

    log.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });

    sendAppError(res, new RateLimitError({
      message: 'Troppi tentativi di login. Riprova tra 15 minuti.',
      limitType: 'auth',
      retryAfter: 15 * 60
    }));
  }
});

/**
 * Rate limiter generale per le API
 * Limita il numero di richieste per prevenire spam e DoS
 */
export const apiRateLimiter = createBootstrapRateLimiter('rl:api:', {
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 300, // massimo 100 richieste per IP al minuto
  message: {
    error: 'Troppe richieste',
    message: 'Hai superato il limite di richieste per minuto. Riprova più tardi.',
    retryAfter: 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateIPKey,
  handler: (req: Request, res: Response) => {
    AuditLogService.getInstance().rateLimitExceeded(req, 'api');

    log.warn(`API rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    sendAppError(res, new RateLimitError({
      message: 'Troppe richieste. Riprova più tardi.',
      limitType: 'api',
      retryAfter: 60
    }));
  }
});

/**
 * Slow down middleware per rallentare le richieste successive
 * Utile per operazioni costose come registrazioni o reset password
 */
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minuti
  delayAfter: 2, // Inizia a rallentare dopo 2 richieste
  delayMs: () => 500, // Incrementa il delay di 500ms per ogni richiesta
  maxDelayMs: 20000, // Massimo 20 secondi di delay
  keyGenerator: generateIPKey,
});

/**
 * Rate limiter specifico per operazioni di registrazione
 */
export const registrationRateLimiter = createBootstrapRateLimiter('rl:reg:', {
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // massimo 3 registrazioni per IP all'ora
  message: {
    error: 'Limite registrazioni superato',
    message: 'Hai superato il limite di registrazioni per ora. Riprova più tardi.',
    retryAfter: 60 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateIPKey,
  handler: (req: Request, res: Response) => {
    AuditLogService.getInstance().rateLimitExceeded(req, 'registration');

    log.warn(`Registration rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email || 'unknown'
    });

    sendAppError(res, new RateLimitError({
      message: 'Hai superato il limite di registrazioni per ora.',
      limitType: 'registration',
      retryAfter: 3600
    }));
  }
});

/**
 * Rate limiter per operazioni di reset password
 */
export const passwordResetRateLimiter = createBootstrapRateLimiter('rl:pwd-reset:', {
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5, // massimo 5 reset password per IP all'ora
  message: {
    error: 'Limite reset password superato',
    message: 'Hai superato il limite di reset password per ora.',
    retryAfter: 60 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateIPKey,
  handler: (req: Request, res: Response) => {
    AuditLogService.getInstance().rateLimitExceeded(req, 'password_reset');

    log.warn(`Password reset rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      email: req.body?.email || 'unknown'
    });

    sendAppError(res, new RateLimitError({
      message: 'Hai superato il limite di reset password per ora.',
      limitType: 'password_reset',
      retryAfter: 3600
    }));
  }
});

/**
 * Crea un rate limiter personalizzato
 */
export const createCustomRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'Rate limit exceeded',
      message: options.message,
      retryAfter: options.windowMs
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || generateIPKey,
    handler: (req: Request, res: Response) => {
      sendAppError(res, new RateLimitError({
        message: options.message,
        limitType: 'custom',
        retryAfter: Math.floor(options.windowMs / 1000)
      }));
    }
  });
};
