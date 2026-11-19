import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RateLimitError } from '../../../lib/errors/application/RateLimitError';
import { sendAppError } from '../../../lib/errors/errorUtils';
import { getRedisClient } from '../../src/shared/cache/redis.client';
import { log } from '../logger';
import { AuditLogService } from '../services/AuditLogService';
import { RedisRateLimitStore } from './RedisRateLimitStore';

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
    // getRedisClient restituisce il client solo quando la connessione e' 'ready'.
    const redis = getRedisClient();

    if (!redis) {
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

function authLimitExceeded(req: Request, res: Response) {
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

/**
 * Rate limiter per le operazioni di autenticazione
 * Limita severamente i tentativi di login per prevenire attacchi brute force
 */
export const authRateLimiter = createBootstrapRateLimiter('rl:auth:', {
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // massimo 5 tentativi per IP in 15 minuti
  standardHeaders: true, // Ritorna rate limit info negli headers `RateLimit-*`
  legacyHeaders: false, // Disabilita gli headers `X-RateLimit-*`
  skipSuccessfulRequests: true, // Non conta le richieste di login riuscite
  skipFailedRequests: false, // Conta le richieste fallite
  // Solo l'IP: con lo User-Agent nella chiave bastava cambiarlo per azzerare il conteggio.
  keyGenerator: generateIPKey,
  handler: authLimitExceeded
});

/**
 * Secondo limite sul login, per email: cambiando IP non si moltiplicano
 * i tentativi sullo stesso account.
 */
export const authEmailRateLimiter = createBootstrapRateLimiter('rl:auth-email:', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req: Request) => typeof req.body?.email !== 'string',
  keyGenerator: (req: Request) => `email:${String(req.body.email).trim().toLowerCase()}`,
  handler: authLimitExceeded
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

/** Utenti che un amministratore puo' creare a mano in un'ora (pagina Gestione Utenti). */
export const MAX_UTENTI_CREATI_ORA = 60;

/**
 * Chiave del limite delle creazioni: l'amministratore della sessione, non l'IP, cosi' piu' persone
 * dietro lo stesso indirizzo non si consumano il limite a vicenda. Senza sessione resta l'IP.
 */
export function chiaveCreazioneUtenti(req: Request): string {
  const idUtente = (req.session as { id_utente?: string } | undefined)?.id_utente;
  return idUtente ? `utente:${idUtente}` : `ip:${generateIPKey(req)}`;
}

/**
 * Rate limiter della creazione manuale degli utenti (POST /register-user), da montare dopo
 * authMiddleware. Era di 3 registrazioni per IP all'ora, pensato per una registrazione pubblica:
 * fermava l'amministratore al quarto utente. Prefisso nuovo per non ereditare i vecchi contatori.
 */
export const registrationRateLimiter = createBootstrapRateLimiter('rl:reg-utente:', {
  windowMs: 60 * 60 * 1000, // 1 ora
  max: MAX_UTENTI_CREATI_ORA,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: chiaveCreazioneUtenti,
  handler: (req: Request, res: Response) => {
    AuditLogService.getInstance().rateLimitExceeded(req, 'registration');

    log.warn('Limite di creazione utenti superato', { chiave: chiaveCreazioneUtenti(req) });

    sendAppError(res, new RateLimitError({
      message: `Hai creato ${MAX_UTENTI_CREATI_ORA} utenti nell'ultima ora: attendi prima di crearne altri.`,
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

    log.warn(`Password reset rate limit exceeded for IP: ${req.ip}`, { ip: req.ip });

    sendAppError(res, new RateLimitError({
      message: 'Hai superato il limite di reset password per ora.',
      limitType: 'password_reset',
      retryAfter: 3600
    }));
  }
});
