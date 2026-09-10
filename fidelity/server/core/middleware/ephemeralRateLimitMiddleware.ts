import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../../../lib/errors/application/RateLimitError';
import { sendAppError } from '../../../lib/errors/errorUtils';
import { EphemeralTokenErrorCode } from '../dto/EphemeralTokenDTO';
import { log } from '../logger';

/**
 * Token Bucket per rate limiting in-memory
 */
interface TokenBucket {
    tokens: number;        // Token disponibili
    lastRefill: number;    // Timestamp ultimo refill
    capacity: number;      // Capacità massima bucket
    refillRate: number;    // Token aggiunti per minuto
}

/**
 * Rate limiter in-memory con tre livelli:
 * 1. Per IP: 10 challenge/min
 * 2. Per Origin: 50 challenge/min (o custom da whitelist)
 * 3. Per Token (JTI): 100 richieste/min
 */
class EphemeralRateLimiter {
    private ipBuckets = new Map<string, TokenBucket>();
    private originBuckets = new Map<string, TokenBucket>();
    private tokenBuckets = new Map<string, TokenBucket>();

    // Limiti default
    private readonly IP_RATE_LIMIT = 10;          // 10/min per IP
    private readonly ORIGIN_RATE_LIMIT = 50;      // 50/min per origin
    private readonly TOKEN_RATE_LIMIT = 100;      // 100/min per token

    // Cleanup automatico buckets vecchi ogni 10 minuti
    private readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
    private readonly BUCKET_EXPIRY_MS = 15 * 60 * 1000; // 15 minuti inattività

    constructor() {
        // Avvia cleanup automatico
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS);
    }

    /**
     * Verifica rate limit per IP
     */
    checkIpRateLimit(ip: string): boolean {
        return this.consume(this.ipBuckets, ip, this.IP_RATE_LIMIT);
    }

    /**
     * Verifica rate limit per Origin (con limite custom da whitelist)
     */
    checkOriginRateLimit(origin: string, customLimit?: number): boolean {
        const limit = customLimit || this.ORIGIN_RATE_LIMIT;
        return this.consume(this.originBuckets, origin, limit);
    }

    /**
     * Verifica rate limit per Token (JTI)
     */
    checkTokenRateLimit(jti: string): boolean {
        return this.consume(this.tokenBuckets, jti, this.TOKEN_RATE_LIMIT);
    }

    /**
     * Consuma 1 token dal bucket (implementazione token bucket algorithm)
     */
    private consume(
        buckets: Map<string, TokenBucket>,
        key: string,
        rateLimit: number
    ): boolean {
        const now = Date.now();
        let bucket = buckets.get(key);

        if (!bucket) {
            // Crea nuovo bucket
            bucket = {
                tokens: rateLimit,
                lastRefill: now,
                capacity: rateLimit,
                refillRate: rateLimit
            };
            buckets.set(key, bucket);
        }

        // Refill tokens basato sul tempo trascorso
        const timeSinceRefill = now - bucket.lastRefill;
        const minutesElapsed = timeSinceRefill / (60 * 1000);
        const tokensToAdd = Math.floor(minutesElapsed * bucket.refillRate);

        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
            bucket.lastRefill = now;
        }

        // Verifica se token disponibile
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return true;
        }

        // Rate limit superato
        return false;
    }

    /**
     * Cleanup buckets inattivi
     */
    private cleanup(): void {
        const now = Date.now();

        const cleanupMap = (buckets: Map<string, TokenBucket>) => {
            buckets.forEach((bucket, key) => {
                if (now - bucket.lastRefill > this.BUCKET_EXPIRY_MS) {
                    buckets.delete(key);
                }
            });
        };

        cleanupMap(this.ipBuckets);
        cleanupMap(this.originBuckets);
        cleanupMap(this.tokenBuckets);

        log.debug('Rate limit cleanup completato', { ip: this.ipBuckets.size, origin: this.originBuckets.size, token: this.tokenBuckets.size });
    }

    /**
     * Reset manuale rate limit (per testing o admin)
     */
    reset(): void {
        this.ipBuckets.clear();
        this.originBuckets.clear();
        this.tokenBuckets.clear();
    }
}

// Singleton instance
const rateLimiter = new EphemeralRateLimiter();

/**
 * Middleware rate limiting per challenge endpoints
 */
export const ephemeralRateLimitMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {

    const ip = req.ip || 'unknown';
    const origin = (req as any).originWhitelist?.origin || req.get('Origin') || 'unknown';
    const customRateLimit = (req as any).originWhitelist?.rateLimitPerMinute;

    // 1. Verifica rate limit IP
    if (!rateLimiter.checkIpRateLimit(ip)) {
        sendAppError(res, new RateLimitError({
            message: 'Rate limit exceeded for IP',
            limitType: 'api',
            retryAfter: 60,
            details: { errorCode: EphemeralTokenErrorCode.RATE_LIMIT_EXCEEDED, scope: 'ip' }
        }));
        return;
    }

    // 2. Verifica rate limit Origin
    if (!rateLimiter.checkOriginRateLimit(origin, customRateLimit)) {
        sendAppError(res, new RateLimitError({
            message: 'Rate limit exceeded for Origin',
            limitType: 'api',
            retryAfter: 60,
            details: { errorCode: EphemeralTokenErrorCode.RATE_LIMIT_EXCEEDED, scope: 'origin' }
        }));
        return;
    }

    next();
};

/**
 * Middleware rate limiting per validazione token
 */
export const tokenRateLimitMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {

    const jti = (req as any).ephemeralToken?.jti;

    // Se JTI presente (token validato), verifica rate limit
    if (jti && !rateLimiter.checkTokenRateLimit(jti)) {
        sendAppError(res, new RateLimitError({
            message: 'Rate limit exceeded for token',
            limitType: 'api',
            retryAfter: 60,
            details: { errorCode: EphemeralTokenErrorCode.RATE_LIMIT_EXCEEDED, scope: 'token' }
        }));
        return;
    }

    next();
};

/**
 * Export rate limiter per testing o reset manuale
 */
export { rateLimiter };
