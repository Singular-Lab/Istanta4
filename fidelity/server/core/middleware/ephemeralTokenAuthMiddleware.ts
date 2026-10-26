import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { UnauthorizedError } from '../../../lib/errors/application/UnauthorizedError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import { sendAppError } from '../../../lib/errors/errorUtils';
import { EphemeralTokenErrorCode } from '../dto/EphemeralTokenDTO';
import { log } from '../logger';
import ephemeralTokenService from '../services/EphemeralTokenService';
import { apiKeyAuthMiddleware } from './apiKeyAuth';

/**
 * Middleware per autenticazione con token effimero
 *
 * Flusso:
 * 1. Verifica presenza header X-Ephemeral-Token
 * 2. Se presente, valida token effimero
 * 3. Se token valido, inietta dati in req.ephemeralToken e procedi
 * 4. Se token non presente o invalido, fallback a API Key (apiKeyAuthMiddleware)
 *
 * Questo permette coesistenza tra nuovo sistema token effimeri e vecchie API Keys
 */
export const ephemeralTokenAuthMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {

    const ephemeralToken = req.get('X-Ephemeral-Token');
    const origin = req.get('Origin') || req.get('Referer') || 'unknown';
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Se NON c'è token effimero, fallback ad API Key
    if (!ephemeralToken) {
        log.debug('[EphemeralTokenAuth] No ephemeral token found, falling back to API Key auth', {
            ip: ipAddress,
            path: req.path,
            origin
        });

        // Delega ad API Key middleware
        apiKeyAuthMiddleware(req, res, next);
        return;
    }

    try {
        // Recupera browser fingerprint dall'header (opzionale, il client lo invia)
        const browserHash = req.get('X-Browser-Hash');

        if (!browserHash) {
            log.warn('[EphemeralTokenAuth] Missing X-Browser-Hash header', {
                ip: ipAddress,
                origin
            });

            // Fallback ad API Key se fingerprint mancante
            apiKeyAuthMiddleware(req, res, next);
            return;
        }

        if (ephemeralToken === undefined) {
            sendAppError(res, new UnauthorizedError({
                message: 'Ephemeral token is undefined',
                details: { errorCode: ErrorCodes.EPH_TOKEN_INVALID }
            }));
            return;
        }
        if (browserHash === undefined) {
            sendAppError(res, new UnauthorizedError({
                message: 'Browser hash is undefined',
                details: { errorCode: ErrorCodes.EPH_TOKEN_INVALID }
            }));
            return;
        }

        // Valida token effimero
        const validationResult = await ephemeralTokenService.validateToken(
            ephemeralToken,
            origin,
            browserHash,
            ipAddress,
            userAgent
        );

        if (!validationResult.valid) {
            log.warn('[EphemeralTokenAuth] Token validation failed', {
                ip: ipAddress,
                origin,
                errorCode: validationResult.errorCode,
                errorMessage: validationResult.errorMessage
            });

            // Se token scaduto o invalido, fallback ad API Key
            // (permette graceful degradation se plugin non rinnova token in tempo)
            if (
                validationResult.errorCode === EphemeralTokenErrorCode.TOKEN_EXPIRED ||
                validationResult.errorCode === EphemeralTokenErrorCode.TOKEN_INVALID
            ) {
                apiKeyAuthMiddleware(req, res, next);
                return;
            }

            // Per altri errori (fingerprint mismatch, origin mismatch, etc.) blocca hard
            sendAppError(res, new UnauthorizedError({
                message: validationResult.errorMessage || 'Token validation failed',
                details: { errorCode: validationResult.errorCode }
            }));
            return;
        }

        // Token valido - inietta dati nella request
        (req as any).ephemeralToken = {
            jti: validationResult.jti,
            origin: validationResult.origin,
            scope: validationResult.scope,
            scopes: validationResult.scope?.split(',').map(s => s.trim()) || []
        };

        log.info('[EphemeralTokenAuth] Token validated successfully', {
            ip: ipAddress,
            origin,
            jti: validationResult.jti,
            scope: validationResult.scope
        });

        next();

    } catch (error: any) {
        log.error('[EphemeralTokenAuth] Unexpected error during token validation', {
            error: error.message,
            ip: ipAddress,
            origin,
            path: req.path
        });

        // Fallback ad API Key in caso di errore interno
        apiKeyAuthMiddleware(req, res, next);
        return;
    }
};

/**
 * Middleware per verificare scope specifico
 * Usa DOPO ephemeralTokenAuthMiddleware
 *
 * Esempio:
 * router.get('/api/external/promo',
 *   ephemeralTokenAuthMiddleware,
 *   requireScope('promo:read'),
 *   controller.getPromo
 * );
 */
export const requireScope = (requiredScope: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const ephemeralToken = (req as any).ephemeralToken;

        // Se autenticato con API Key, skippa check scope (API Key ha accesso completo)
        if (!ephemeralToken && (req as any).apiKeyInfo) {
            return next();
        }

        // Se autenticato con token effimero, verifica scope
        if (ephemeralToken) {
            const scopes: string[] = ephemeralToken.scopes || [];

            if (scopes.includes(requiredScope)) {
                return next();
            }

            log.warn('[EphemeralTokenAuth] Insufficient scope', {
                ip: req.ip,
                origin: ephemeralToken.origin,
                jti: ephemeralToken.jti,
                requiredScope,
                availableScopes: scopes
            });

            sendAppError(res, new ForbiddenError({
                message: `Scope '${requiredScope}' required`,
                resource: req.path,
                action: requiredScope,
                details: { requiredScope, availableScopes: scopes }
            }));
            return;
        }

        // Nessuna autenticazione valida
        sendAppError(res, new UnauthorizedError({
            message: 'Authentication required'
        }));
    };
};

/**
 * Estende l'interfaccia Request per includere le informazioni token effimero
 */
declare global {
    namespace Express {
        interface Request {
            ephemeralToken?: {
                jti: string;
                origin: string;
                scope: string;
                scopes: string[];
            };
        }
    }
}
