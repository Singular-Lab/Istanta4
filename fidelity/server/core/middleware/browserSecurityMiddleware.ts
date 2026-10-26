import { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../../lib/errors/application/BadRequestError';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { sendAppError } from '../../../lib/errors/errorUtils';
import { EphemeralTokenErrorCode } from '../dto/EphemeralTokenDTO';
import { AuditLogService } from '../services/AuditLogService';

/**
 * Middleware per validazione sicurezza browser
 *
 * Verifica:
 * - User-Agent presente e valido
 * - Header Sec-Fetch-* per protezione CSRF (opzionale)
 * - X-FP-Version per versione plugin minima
 */
export const browserSecurityMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {

    const userAgent = req.get('User-Agent');
    const fpVersion = req.get('X-FP-Version');
    const secFetchSite = req.get('Sec-Fetch-Site');
    const secFetchMode = req.get('Sec-Fetch-Mode');

    // 1. Verifica User-Agent
    if (!userAgent || userAgent.trim().length === 0) {
        AuditLogService.getInstance().securityViolation(req, 'browser_security_blocked', { reason: 'missing_user_agent', userAgent: req.get('User-Agent') });
        sendAppError(res, new BadRequestError({
            message: 'User-Agent header required',
            details: { errorCode: EphemeralTokenErrorCode.INTERNAL_ERROR, reason: 'missing_user_agent' }
        }));
        return;
    }

    // Blocca User-Agent sospetti (bot, curl, etc.)
    const suspiciousUserAgents = [
        'curl',
        'wget',
        'python-requests',
        'postman',
        'insomnia',
        'bot',
        'crawler',
        'spider'
    ];

    const isBlacklisted = suspiciousUserAgents.some(
        (pattern) => userAgent.toLowerCase().includes(pattern)
    );

    if (isBlacklisted) {
        AuditLogService.getInstance().securityViolation(req, 'browser_security_blocked', { reason: 'suspicious_user_agent', userAgent: req.get('User-Agent') });
        sendAppError(res, new ForbiddenError({
            message: 'Suspicious User-Agent detected',
            resource: req.path,
            details: { errorCode: EphemeralTokenErrorCode.INTERNAL_ERROR, reason: 'suspicious_user_agent' }
        }));
        return;
    }

    // 2. Verifica X-FP-Version
    if (!fpVersion) {
        AuditLogService.getInstance().securityViolation(req, 'browser_security_blocked', { reason: 'missing_fp_version', userAgent: req.get('User-Agent') });
        sendAppError(res, new BadRequestError({
            message: 'X-FP-Version header required',
            details: { errorCode: EphemeralTokenErrorCode.VERSION_TOO_OLD, reason: 'missing_fp_version' }
        }));
        return;
    }

    // Verifica versione minima
    const minVersion = '1.0.0';
    if (!isVersionValid(fpVersion, minVersion)) {
        AuditLogService.getInstance().securityViolation(req, 'browser_security_blocked', { reason: 'version_too_old', userAgent: req.get('User-Agent') });
        sendAppError(res, new BadRequestError({
            message: `Plugin version ${fpVersion} is too old. Minimum version: ${minVersion}`,
            details: { errorCode: EphemeralTokenErrorCode.VERSION_TOO_OLD, reason: 'version_too_old', currentVersion: fpVersion, minimumVersion: minVersion }
        }));
        return;
    }

    // 3. Verifica Sec-Fetch-* headers (best practice CSRF protection)
    // Questi header sono inviati automaticamente dai browser moderni
    // Non blocchiamo, ma logghiamo se mancanti (potrebbero essere richieste non-browser)
    if (!secFetchSite || !secFetchMode) {
        // Solo warning, non blocchiamo (compatibilità browser vecchi)
        console.warn('[BrowserSecurity] Missing Sec-Fetch-* headers', {
            ip: req.ip,
            userAgent,
            origin: req.get('Origin')
        });
    }

    // Tutto OK, procedi
    next();
};

/**
 * Verifica se la versione plugin è >= versione minima
 * Usa semantic versioning (major.minor.patch)
 */
function isVersionValid(current: string, minimum: string): boolean {
    try {
        const currentParts = current.split('.').map(Number);
        const minimumParts = minimum.split('.').map(Number);

        // Confronta major
        if (currentParts[0] > minimumParts[0]) return true;
        if (currentParts[0] < minimumParts[0]) return false;

        // Confronta minor
        if (currentParts[1] > minimumParts[1]) return true;
        if (currentParts[1] < minimumParts[1]) return false;

        // Confronta patch
        return currentParts[2] >= minimumParts[2];

    } catch (error) {
        // Se parsing fallisce, considera versione invalida
        return false;
    }
}
