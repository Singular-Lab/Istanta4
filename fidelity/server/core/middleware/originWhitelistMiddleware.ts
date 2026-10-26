import { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../../lib/errors/application/BadRequestError';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { sendAppError } from '../../../lib/errors/errorUtils';
import { InfrastructureError } from '../../../lib/errors/InfrastructureError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { EphemeralTokenErrorCode } from '../dto/EphemeralTokenDTO';
import { EphemeralOriginsWhitelist } from '../models';
import { log } from '../logger';

/**
 * Cache in-memory per whitelist origins (refresh ogni 5 minuti)
 */
interface WhitelistCacheEntry {
    active: boolean;
    rateLimitPerMinute: number;
    allowedScopes: string[];
    timestamp: number;
}

const whitelistCache = new Map<string, WhitelistCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti

/**
 * Middleware per validazione origine contro whitelist
 *
 * Verifica:
 * - Origin header presente
 * - Origin in whitelist database
 * - Origin attivo (active = true)
 *
 * Caching: Whitelist viene cacheata in memoria per 5 minuti
 */
export const originWhitelistMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {

    const origin = req.get('Origin') || req.get('Referer');

    // 1. Verifica presenza Origin
    if (!origin) {
        sendAppError(res, new BadRequestError({
            message: 'Origin header required',
            details: { errorCode: EphemeralTokenErrorCode.INTERNAL_ERROR }
        }));
        return;
    }

    // Normalizza origin (rimuovi trailing slash, converti a lowercase)
    const normalizedOrigin = normalizeOrigin(origin);

    try {
        // 2. Verifica cache
        const cached = whitelistCache.get(normalizedOrigin);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
            // Cache hit
            if (!cached.active) {
                sendAppError(res, new ForbiddenError({
                    message: 'Origin is disabled',
                    resource: normalizedOrigin,
                    details: { errorCode: EphemeralTokenErrorCode.ORIGIN_DISABLED }
                }));
                return;
            }

            // Inietta dati nella request per uso downstream
            (req as any).originWhitelist = {
                origin: normalizedOrigin,
                rateLimitPerMinute: cached.rateLimitPerMinute,
                allowedScopes: cached.allowedScopes
            };

            next();
            return;
        }

        // 3. Cache miss - query database
        const whitelistEntry = await EphemeralOriginsWhitelist.findOne({
            where: { origin_ephemeral_origins_whitelist: normalizedOrigin }
        });

        if (!whitelistEntry) {
            sendAppError(res, new ForbiddenError({
                message: 'Origin not in whitelist',
                resource: normalizedOrigin,
                details: { errorCode: EphemeralTokenErrorCode.ORIGIN_NOT_WHITELISTED }
            }));
            return;
        }

        if (!whitelistEntry.active_ephemeral_origins_whitelist) {
            // Aggiorna cache (anche se disabilitato, per evitare query ripetute)
            whitelistCache.set(normalizedOrigin, {
                active: false,
                rateLimitPerMinute: 0,
                allowedScopes: [],
                timestamp: now
            });

            sendAppError(res, new ForbiddenError({
                message: 'Origin is disabled',
                resource: normalizedOrigin,
                details: { errorCode: EphemeralTokenErrorCode.ORIGIN_DISABLED }
            }));
            return;
        }

        // 4. Aggiorna cache
        const scopesArray = whitelistEntry.allowed_scopes_ephemeral_origins_whitelist.split(',').map(s => s.trim());

        whitelistCache.set(normalizedOrigin, {
            active: true,
            rateLimitPerMinute: whitelistEntry.rate_limit_per_minute_ephemeral_origins_whitelist,
            allowedScopes: scopesArray,
            timestamp: now
        });

        // 5. Inietta dati nella request
        (req as any).originWhitelist = {
            origin: normalizedOrigin,
            rateLimitPerMinute: whitelistEntry.rate_limit_per_minute_ephemeral_origins_whitelist,
            allowedScopes: scopesArray
        };

        next();

    } catch (error) {
        log.error('Errore nella verifica della whitelist origin', error instanceof Error ? error : new Error(String(error)));
        sendAppError(res, new InfrastructureError({
            name: 'OriginWhitelistError',
            message: 'Internal server error',
            code: ErrorCodes.EXTERNAL_API_ERROR,
            httpStatus: 500,
            details: { errorCode: EphemeralTokenErrorCode.INTERNAL_ERROR },
            cause: error instanceof Error ? error : undefined
        }));
    }
};

/**
 * Normalizza origin per comparazione consistente
 * - Rimuove trailing slash
 * - Converti a lowercase
 * - Estrae solo protocol + host + port
 */
function normalizeOrigin(origin: string): string {
    try {
        const url = new URL(origin);
        // Ritorna protocol + host (include porta se diversa da default)
        return url.origin.toLowerCase();
    } catch (error) {
        // Se parsing fallisce, ritorna origin originale lowercase
        return origin.toLowerCase().replace(/\/$/, '');
    }
}

/**
 * Funzione helper per invalidare cache (utile per testing o admin panel)
 */
export function clearWhitelistCache(): void {
    whitelistCache.clear();
}

/**
 * Funzione helper per invalidare cache di un singolo origin
 */
export function clearOriginCache(origin: string): void {
    const normalized = normalizeOrigin(origin);
    whitelistCache.delete(normalized);
}
