import { Request, Response } from 'express';
import { BaseController } from '../base/BaseController';
import { CompleteChallengeRequestDTO, EphemeralTokenErrorCode } from '../dto/EphemeralTokenDTO';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { browserSecurityMiddleware } from '../middleware/browserSecurityMiddleware';
import { ephemeralRateLimitMiddleware } from '../middleware/ephemeralRateLimitMiddleware';
import { originWhitelistMiddleware } from '../middleware/originWhitelistMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import ephemeralTokenService from '../services/EphemeralTokenService';

/**
 * Controller per endpoint autenticazione token effimeri
 */
export class EphemeralAuthController extends BaseController {

    constructor() {
        super('/api/auth/ephemeral');
    }

    protected setupRoutes(): void {
        // Health check (pubblico)
        this.router.get('/health', this.healthCheck.bind(this));

        // Challenge endpoints (protetti da middleware security)
        this.router.post(
            '/start',
            browserSecurityMiddleware,
            originWhitelistMiddleware,
            ephemeralRateLimitMiddleware,
            this.startChallenge.bind(this)
        );

        this.router.post(
            '/complete',
            browserSecurityMiddleware,
            originWhitelistMiddleware,
            ephemeralRateLimitMiddleware,
            this.completeChallenge.bind(this)
        );

        // Revoke endpoint (amministrazione)
        this.router.post('/revoke', authMiddleware, permissionGuard('api.gestisci_chiavi'), this.revokeToken.bind(this));
    }

    /**
     * POST /auth/ephemeral/start
     *
     * Step 1: Avvia un nuovo challenge per ottenere token effimero
     *
     * Headers richiesti:
     * - Origin: Origine richiedente (es: https://example.com)
     * - X-FP-Version: Versione plugin FP (es: 1.0.0)
     *
     * Response:
     * {
     *   challengeId: string,
     *   nonce: string,
     *   ts: number,
     *   signature: string
     * }
     */
    async startChallenge(req: Request, res: Response): Promise<void> {
        try {
            const origin = req.get('Origin') || req.get('Referer');
            const fpVersion = req.get('X-FP-Version');
            const ipAddress = req.ip || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';

            // Validazione parametri (dovrebbero essere già validati dai middleware)
            if (!origin) {
                res.status(400).json({
                    error: EphemeralTokenErrorCode.INTERNAL_ERROR,
                    message: 'Origin header required',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            if (!fpVersion) {
                res.status(400).json({
                    error: EphemeralTokenErrorCode.VERSION_TOO_OLD,
                    message: 'X-FP-Version header required',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            log.info('[EphemeralAuth] Starting challenge', {
                ip: ipAddress,
                origin,
                fpVersion,
                userAgent
            });

            // Genera challenge
            const challengeData = await ephemeralTokenService.startChallenge(
                origin,
                ipAddress,
                userAgent,
                fpVersion
            );

            res.status(200).json(challengeData);

        } catch (error: any) {
            log.error('[EphemeralAuth] Error starting challenge', {
                error: error.message,
                ip: req.ip,
                origin: req.get('Origin')
            });

            // Errori specifici
            if (error.message === EphemeralTokenErrorCode.ORIGIN_NOT_WHITELISTED) {
                res.status(403).json({
                    error: EphemeralTokenErrorCode.ORIGIN_NOT_WHITELISTED,
                    message: 'Origin not in whitelist',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // Errore generico
            res.status(500).json({
                error: EphemeralTokenErrorCode.INTERNAL_ERROR,
                message: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * POST /auth/ephemeral/complete
     *
     * Step 2: Completa il challenge e ottieni token effimero
     *
     * Headers richiesti:
     * - Origin: Origine richiedente (deve corrispondere al challenge)
     * - X-FP-Version: Versione plugin FP
     *
     * Body:
     * {
     *   challengeId: string,
     *   nonce: string,
     *   ts: number,
     *   browserHash: string
     * }
     *
     * Response:
     * {
     *   token: string,
     *   expUtc: number,
     *   scope: string
     * }
     */
    async completeChallenge(req: Request, res: Response): Promise<void> {
        try {
            const origin = req.get('Origin') || req.get('Referer');
            const fpVersion = req.get('X-FP-Version');
            const ipAddress = req.ip || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';

            // Validazione parametri
            if (!origin) {
                res.status(400).json({
                    error: EphemeralTokenErrorCode.INTERNAL_ERROR,
                    message: 'Origin header required',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            if (!fpVersion) {
                res.status(400).json({
                    error: EphemeralTokenErrorCode.VERSION_TOO_OLD,
                    message: 'X-FP-Version header required',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // Validazione body
            const { challengeId, nonce, ts, browserHash } = req.body as CompleteChallengeRequestDTO;

            if (!challengeId || !nonce || !ts || !browserHash) {
                res.status(400).json({
                    error: EphemeralTokenErrorCode.INTERNAL_ERROR,
                    message: 'Missing required fields: challengeId, nonce, ts, browserHash',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            log.info('[EphemeralAuth] Completing challenge', {
                ip: ipAddress,
                origin,
                fpVersion,
                challengeId
            });

            // Completa challenge e ottieni token
            const tokenData = await ephemeralTokenService.completeChallenge(
                { challengeId, nonce, ts, browserHash },
                origin,
                ipAddress,
                userAgent,
                fpVersion
            );

            res.status(200).json(tokenData);

        } catch (error: any) {
            log.error('[EphemeralAuth] Error completing challenge', {
                error: error.message,
                ip: req.ip,
                origin: req.get('Origin'),
                challengeId: req.body?.challengeId
            });

            // Errori specifici
            const errorCode = error.message as EphemeralTokenErrorCode;

            switch (errorCode) {
                case EphemeralTokenErrorCode.CHALLENGE_NOT_FOUND:
                    res.status(404).json({
                        error: EphemeralTokenErrorCode.CHALLENGE_NOT_FOUND,
                        message: 'Challenge not found or expired',
                        timestamp: new Date().toISOString()
                    });
                    return;

                case EphemeralTokenErrorCode.CHALLENGE_EXPIRED:
                    res.status(400).json({
                        error: EphemeralTokenErrorCode.CHALLENGE_EXPIRED,
                        message: 'Challenge expired (TTL 30 seconds)',
                        timestamp: new Date().toISOString()
                    });
                    return;

                case EphemeralTokenErrorCode.CHALLENGE_ALREADY_USED:
                    res.status(400).json({
                        error: EphemeralTokenErrorCode.CHALLENGE_ALREADY_USED,
                        message: 'Challenge already used',
                        timestamp: new Date().toISOString()
                    });
                    return;

                case EphemeralTokenErrorCode.ORIGIN_MISMATCH:
                    res.status(403).json({
                        error: EphemeralTokenErrorCode.ORIGIN_MISMATCH,
                        message: 'Origin mismatch',
                        timestamp: new Date().toISOString()
                    });
                    return;

                case EphemeralTokenErrorCode.CHALLENGE_SIGNATURE_INVALID:
                    res.status(403).json({
                        error: EphemeralTokenErrorCode.CHALLENGE_SIGNATURE_INVALID,
                        message: 'Invalid challenge signature',
                        timestamp: new Date().toISOString()
                    });
                    return;

                default:
                    res.status(500).json({
                        error: EphemeralTokenErrorCode.INTERNAL_ERROR,
                        message: 'Internal server error',
                        timestamp: new Date().toISOString()
                    });
            }
        }
    }

    /**
     * POST /auth/ephemeral/revoke
     *
     * Revoca manualmente un token (amministrazione)
     *
     * Body:
     * {
     *   jti: string
     * }
     *
     * Response:
     * {
     *   success: boolean,
     *   message: string
     * }
     */
    async revokeToken(req: Request, res: Response): Promise<void> {
        try {
            const { jti } = req.body;

            if (!jti) {
                res.status(400).json({
                    error: 'MISSING_JTI',
                    message: 'JTI required',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            log.info('[EphemeralAuth] Revoking token', {
                ip: req.ip,
                jti
            });

            const revoked = await ephemeralTokenService.revokeToken(jti);

            if (!revoked) {
                res.status(404).json({
                    success: false,
                    message: 'Token not found',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Token revoked successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            log.error('[EphemeralAuth] Error revoking token', {
                error: error.message,
                ip: req.ip,
                jti: req.body?.jti
            });

            res.status(500).json({
                error: EphemeralTokenErrorCode.INTERNAL_ERROR,
                message: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * GET /auth/ephemeral/health
     *
     * Health check per il sistema di token effimeri
     *
     * Response:
     * {
     *   status: string,
     *   timestamp: string,
     *   service: string
     * }
     */
    async healthCheck(req: Request, res: Response): Promise<void> {
        try {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                service: 'Ephemeral Token Authentication'
            });
        } catch (error) {
            res.status(500).json({
                status: 'ERROR',
                timestamp: new Date().toISOString(),
                service: 'Ephemeral Token Authentication'
            });
        }
    }
}

export default new EphemeralAuthController();
