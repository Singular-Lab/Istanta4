import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { ForbiddenError } from '../../../lib/errors/application/ForbiddenError';
import { UnauthorizedError } from '../../../lib/errors/application/UnauthorizedError';
import { ValidationError } from '../../../lib/errors/domain/ValidationError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import config from '../config';
import {
    AuditEventDTO,
    CompleteChallengeRequestDTO,
    CompleteChallengeResponseDTO,
    EphemeralTokenErrorCode,
    StartChallengeResponseDTO,
    TokenPayloadDTO,
    TokenValidationResultDTO
} from '../dto/EphemeralTokenDTO';
import { IEphemeralTokenService } from '../interfaces/IEphemeralTokenService';
import { EphemeralAuditLog } from '../models/ephemeral/ephemeral_audit_log';
import { EphemeralChallenge } from '../models/ephemeral/ephemeral_challenge';
import { EphemeralOriginsWhitelist } from '../models/ephemeral/ephemeral_origins_whitelist';
import { EphemeralToken } from '../models/ephemeral/ephemeral_token';

/**
 * Servizio gestione token effimeri con challenge-response
 */
export class EphemeralTokenService implements IEphemeralTokenService {

    // Token lifetime: 5 minuti
    private readonly TOKEN_TTL_MS = 5 * 60 * 1000;

    // Challenge lifetime: 30 secondi
    private readonly CHALLENGE_TTL_MS = 30 * 1000;

    // Secret per HMAC signatures
    private readonly SECRET: string;

    // Cache JTI in-memory per prevenzione replay (max 10k entries)
    private jtiCache: Set<string> = new Set();
    private readonly MAX_JTI_CACHE_SIZE = 10000;

    constructor() {
        this.SECRET = config.EPHEMERAL_TOKEN_SECRET;

        if (!this.SECRET) {
            throw new ValidationError({
                message: 'EPHEMERAL_TOKEN_SECRET non configurato',
                field: 'EPHEMERAL_TOKEN_SECRET',
                constraint: 'required'
            });
        }
    }

    /**
     * Step 1: Avvia un nuovo challenge
     */
    async startChallenge(
        origin: string,
        ipAddress: string,
        userAgent: string,
        fpVersion: string
    ): Promise<StartChallengeResponseDTO> {

        // Verifica origine in whitelist
        const whitelistEntry = await EphemeralOriginsWhitelist.findOne({
            where: {
                origin_ephemeral_origins_whitelist: origin,
                active_ephemeral_origins_whitelist: true
            }
        });

        if (!whitelistEntry) {
            await this.logAuditEvent({
                eventType: 'ORIGIN_BLOCKED',
                origin,
                ipAddress,
                userAgent,
                fpVersion,
                success: false,
                errorMessage: 'Origin not in whitelist'
            });
            throw new ForbiddenError({
                message: EphemeralTokenErrorCode.ORIGIN_NOT_WHITELISTED,
                resource: 'ephemeral-challenge',
                action: 'startChallenge',
                details: { origin, errorCode: ErrorCodes.EPH_ORIGIN_DENIED }
            });
        }

        // Genera challenge
        const challengeId = uuidv4();
        const nonce = crypto.randomBytes(32).toString('hex');
        const ts = Date.now();

        // Firma HMAC-SHA256: HMAC(challengeId + nonce + ts + origin)
        const signature = this.generateChallengeSignature(challengeId, nonce, ts, origin);

        // Calcola scadenza (30 secondi)
        const expiresAt = new Date(ts + this.CHALLENGE_TTL_MS);

        // Salva challenge in DB
        await EphemeralChallenge.create({
            challenge_id_ephemeral_challenge: challengeId,
            nonce_ephemeral_challenge: nonce,
            origin_ephemeral_challenge: origin,
            signature_ephemeral_challenge: signature,
            ts_ephemeral_challenge: ts,
            ip_address_ephemeral_challenge: ipAddress,
            user_agent_ephemeral_challenge: userAgent,
            fp_version_ephemeral_challenge: fpVersion,
            used_ephemeral_challenge: false,
            expires_at_ephemeral_challenge: expiresAt
        });

        // Audit log
        await this.logAuditEvent({
            eventType: 'CHALLENGE_START',
            challengeId,
            origin,
            ipAddress,
            userAgent,
            fpVersion,
            success: true
        });

        return {
            challengeId,
            nonce,
            ts,
            signature
        };
    }

    /**
     * Step 2: Completa il challenge e emetti token
     */
    async completeChallenge(
        data: CompleteChallengeRequestDTO,
        origin: string,
        ipAddress: string,
        userAgent: string,
        fpVersion: string
    ): Promise<CompleteChallengeResponseDTO> {

        const { challengeId, nonce, ts, browserHash } = data;

        // Recupera challenge dal DB
        const challenge = await EphemeralChallenge.findOne({
            where: { challenge_id_ephemeral_challenge: challengeId }
        });

        // Verifica esistenza challenge
        if (!challenge) {
            await this.logAuditEvent({
                eventType: 'CHALLENGE_FAILED',
                challengeId,
                origin,
                ipAddress,
                userAgent,
                fpVersion,
                success: false,
                errorMessage: 'Challenge not found'
            });
            throw new UnauthorizedError({
                message: EphemeralTokenErrorCode.CHALLENGE_NOT_FOUND,
                details: { challengeId, errorCode: ErrorCodes.EPH_CHALLENGE_EXPIRED }
            });
        }

        // Verifica scadenza challenge
        if (new Date() > challenge.expires_at_ephemeral_challenge) {
            await this.logAuditEvent({
                eventType: 'CHALLENGE_EXPIRED',
                challengeId,
                origin,
                ipAddress,
                userAgent,
                fpVersion,
                success: false,
                errorMessage: 'Challenge expired'
            });
            throw new UnauthorizedError({
                message: EphemeralTokenErrorCode.CHALLENGE_EXPIRED,
                details: { challengeId, errorCode: ErrorCodes.EPH_CHALLENGE_EXPIRED }
            });
        }

        // Verifica se già usato
        if (challenge.used_ephemeral_challenge) {
            await this.logAuditEvent({
                eventType: 'CHALLENGE_FAILED',
                challengeId,
                origin,
                ipAddress,
                userAgent,
                fpVersion,
                success: false,
                errorMessage: 'Challenge already used'
            });
            throw new UnauthorizedError({
                message: EphemeralTokenErrorCode.CHALLENGE_ALREADY_USED,
                details: { challengeId, errorCode: ErrorCodes.EPH_CHALLENGE_EXPIRED }
            });
        }

        // Verifica origin match
        if (challenge.origin_ephemeral_challenge !== origin) {
            await this.logAuditEvent({
                eventType: 'CHALLENGE_FAILED',
                challengeId,
                origin,
                ipAddress,
                userAgent,
                fpVersion,
                success: false,
                errorMessage: 'Origin mismatch'
            });
            throw new ForbiddenError({
                message: EphemeralTokenErrorCode.ORIGIN_MISMATCH,
                resource: 'ephemeral-challenge',
                action: 'completeChallenge',
                details: { origin, errorCode: ErrorCodes.EPH_ORIGIN_DENIED }
            });
        }

        // Verifica signature HMAC
        const expectedSignature = this.generateChallengeSignature(challengeId, nonce, ts, origin);
        if (challenge.signature_ephemeral_challenge !== expectedSignature) {
            await this.logAuditEvent({
                eventType: 'CHALLENGE_FAILED',
                challengeId,
                origin,
                ipAddress,
                userAgent,
                fpVersion,
                success: false,
                errorMessage: 'Signature invalid'
            });
            throw new UnauthorizedError({
                message: EphemeralTokenErrorCode.CHALLENGE_SIGNATURE_INVALID,
                details: { challengeId, errorCode: ErrorCodes.EPH_SIGNATURE_INVALID }
            });
        }

        // Marca challenge come usato
        challenge.used_ephemeral_challenge = true;
        await challenge.save();

        // Recupera scope permessi per questo origin
        const whitelistEntry = await EphemeralOriginsWhitelist.findOne({
            where: {
                origin_ephemeral_origins_whitelist: origin,
                active_ephemeral_origins_whitelist: true
            }
        });

        const scope = whitelistEntry?.allowed_scopes_ephemeral_origins_whitelist || 'promo:read,refs:read';

        // Genera token
        const jti = uuidv4();
        const iat = Date.now();
        const exp = iat + this.TOKEN_TTL_MS;

        const tokenPayload: TokenPayloadDTO = {
            jti,
            origin,
            browserHash,
            scope,
            iat,
            exp,
            fpVersion
        };

        const token = this.generateToken(tokenPayload);

        // Salva token in DB
        await EphemeralToken.create({
            jti_ephemeral_token: jti,
            token_ephemeral_token: token,
            challenge_id_ephemeral_token: challengeId,
            origin_ephemeral_token: origin,
            browser_hash_ephemeral_token: browserHash,
            scope_ephemeral_token: scope,
            ip_address_ephemeral_token: ipAddress,
            user_agent_ephemeral_token: userAgent,
            fp_version_ephemeral_token: fpVersion,
            issued_at_ephemeral_token: iat,
            expires_at_utc_ephemeral_token: exp,
            revoked_ephemeral_token: false
        });

        // Aggiungi JTI alla cache
        this.addJtiToCache(jti);

        // Audit log
        await this.logAuditEvent({
            eventType: 'TOKEN_ISSUED',
            challengeId,
            jti,
            origin,
            ipAddress,
            userAgent,
            fpVersion,
            success: true,
            metadata: { scope }
        });

        return {
            token,
            expUtc: exp,
            scope
        };
    }

    /**
     * Valida un token effimero
     */
    async validateToken(
        token: string,
        origin: string,
        browserHash: string,
        ipAddress: string,
        userAgent: string
    ): Promise<TokenValidationResultDTO> {

        try {
            // Decodifica e verifica signature
            const payload = this.verifyToken(token);

            // Verifica scadenza
            if (Date.now() > payload.exp) {
                await this.logAuditEvent({
                    eventType: 'TOKEN_EXPIRED',
                    jti: payload.jti,
                    origin,
                    ipAddress,
                    userAgent,
                    fpVersion: payload.fpVersion,
                    success: false,
                    errorMessage: 'Token expired'
                });
                return {
                    valid: false,
                    errorCode: EphemeralTokenErrorCode.TOKEN_EXPIRED,
                    errorMessage: 'Token expired'
                };
            }

            // Verifica origin match
            if (payload.origin !== origin) {
                await this.logAuditEvent({
                    eventType: 'TOKEN_VALIDATION_FAILED',
                    jti: payload.jti,
                    origin,
                    ipAddress,
                    userAgent,
                    fpVersion: payload.fpVersion,
                    success: false,
                    errorMessage: 'Origin mismatch'
                });
                return {
                    valid: false,
                    errorCode: EphemeralTokenErrorCode.ORIGIN_MISMATCH,
                    errorMessage: 'Origin mismatch'
                };
            }

            // Verifica browser fingerprint (hard block)
            if (payload.browserHash !== browserHash) {
                await this.logAuditEvent({
                    eventType: 'FINGERPRINT_MISMATCH',
                    jti: payload.jti,
                    origin,
                    ipAddress,
                    userAgent,
                    fpVersion: payload.fpVersion,
                    success: false,
                    errorMessage: 'Browser fingerprint mismatch'
                });
                return {
                    valid: false,
                    errorCode: EphemeralTokenErrorCode.FINGERPRINT_MISMATCH,
                    errorMessage: 'Browser fingerprint mismatch'
                };
            }

            // Verifica se revocato
            const tokenRecord = await EphemeralToken.findOne({
                where: { jti_ephemeral_token: payload.jti }
            });

            if (tokenRecord?.revoked_ephemeral_token) {
                await this.logAuditEvent({
                    eventType: 'TOKEN_VALIDATION_FAILED',
                    jti: payload.jti,
                    origin,
                    ipAddress,
                    userAgent,
                    fpVersion: payload.fpVersion,
                    success: false,
                    errorMessage: 'Token revoked'
                });
                return {
                    valid: false,
                    errorCode: EphemeralTokenErrorCode.TOKEN_REVOKED,
                    errorMessage: 'Token revoked'
                };
            }

            // Aggiorna statistiche utilizzo
            await this.updateTokenUsage(payload.jti);

            // Audit log successo
            await this.logAuditEvent({
                eventType: 'TOKEN_VALIDATED',
                jti: payload.jti,
                origin,
                ipAddress,
                userAgent,
                fpVersion: payload.fpVersion,
                success: true
            });

            return {
                valid: true,
                jti: payload.jti,
                origin: payload.origin,
                scope: payload.scope
            };

        } catch (error: any) {
            await this.logAuditEvent({
                eventType: 'TOKEN_VALIDATION_FAILED',
                origin,
                ipAddress,
                userAgent,
                success: false,
                errorMessage: error.message
            });

            return {
                valid: false,
                errorCode: EphemeralTokenErrorCode.TOKEN_INVALID,
                errorMessage: 'Token invalid'
            };
        }
    }

    /**
     * Revoca manualmente un token
     */
    async revokeToken(jti: string): Promise<boolean> {
        const tokenRecord = await EphemeralToken.findOne({
            where: { jti_ephemeral_token: jti }
        });

        if (!tokenRecord) {
            return false;
        }

        tokenRecord.revoked_ephemeral_token = true;
        await tokenRecord.save();

        await this.logAuditEvent({
            eventType: 'TOKEN_REVOKED',
            jti,
            origin: tokenRecord.origin_ephemeral_token,
            ipAddress: tokenRecord.ip_address_ephemeral_token,
            userAgent: tokenRecord.user_agent_ephemeral_token,
            fpVersion: tokenRecord.fp_version_ephemeral_token,
            success: true
        });

        return true;
    }

    /**
     * Verifica se JTI è già stato usato (replay prevention)
     */
    async isJtiUsed(jti: string): Promise<boolean> {
        // Verifica cache in-memory
        if (this.jtiCache.has(jti)) {
            return true;
        }

        // Verifica DB
        const tokenRecord = await EphemeralToken.findOne({
            where: { jti_ephemeral_token: jti }
        });

        if (tokenRecord) {
            this.addJtiToCache(jti);
            return true;
        }

        return false;
    }

    /**
     * Aggiorna statistiche utilizzo token
     */
    async updateTokenUsage(jti: string): Promise<void> {
        await EphemeralToken.update(
            {
                last_used_at_ephemeral_token: new Date(),
                use_count_ephemeral_token: EphemeralToken.sequelize!.literal('use_count_ephemeral_token + 1')
            },
            {
                where: { jti_ephemeral_token: jti }
            }
        );
    }

    /**
     * Traccia evento audit log
     */
    async logAuditEvent(event: AuditEventDTO): Promise<void> {
        await EphemeralAuditLog.create({
            event_type_ephemeral_audit_log: event.eventType as any,
            challenge_id_ephemeral_audit_log: event.challengeId || null,
            jti_ephemeral_audit_log: event.jti || null,
            origin_ephemeral_audit_log: event.origin,
            ip_address_ephemeral_audit_log: event.ipAddress,
            user_agent_ephemeral_audit_log: event.userAgent,
            fp_version_ephemeral_audit_log: event.fpVersion || null,
            success_ephemeral_audit_log: event.success,
            error_message_ephemeral_audit_log: event.errorMessage || null,
            metadata_ephemeral_audit_log: event.metadata || null
        });
    }

    /**
     * Cleanup challenge scaduti
     */
    async cleanupExpiredChallenges(): Promise<number> {
        const result = await EphemeralChallenge.destroy({
            where: {
                expires_at_ephemeral_challenge: {
                    [Op.lt]: new Date()
                }
            }
        });

        return result;
    }

    /**
     * Cleanup token scaduti (rimuove token scaduti da almeno 10 minuti)
     */
    async cleanupExpiredTokens(): Promise<number> {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);

        const result = await EphemeralToken.destroy({
            where: {
                expires_at_utc_ephemeral_token: {
                    [Op.lt]: tenMinutesAgo
                }
            }
        });

        return result;
    }

    // ==================== PRIVATE HELPERS ====================

    /**
     * Genera signature HMAC-SHA256 per challenge
     */
    private generateChallengeSignature(
        challengeId: string,
        nonce: string,
        ts: number,
        origin: string
    ): string {
        const data = `${challengeId}:${nonce}:${ts}:${origin}`;
        return crypto
            .createHmac('sha256', this.SECRET)
            .update(data)
            .digest('hex');
    }

    /**
     * Genera token firmato HMAC-SHA256
     */
    private generateToken(payload: TokenPayloadDTO): string {
        // Serializza payload
        const payloadJson = JSON.stringify(payload);
        const payloadBase64 = Buffer.from(payloadJson).toString('base64url');

        // Genera signature HMAC
        const signature = crypto
            .createHmac('sha256', this.SECRET)
            .update(payloadBase64)
            .digest('base64url');

        // Token format: payload.signature
        return `${payloadBase64}.${signature}`;
    }

    /**
     * Verifica e decodifica token
     */
    private verifyToken(token: string): TokenPayloadDTO {
        const parts = token.split('.');
        if (parts.length !== 2) {
            throw new UnauthorizedError({
                message: 'Invalid token format',
                details: { errorCode: ErrorCodes.EPH_TOKEN_INVALID }
            });
        }

        const [payloadBase64, signature] = parts;

        // Verifica signature
        const expectedSignature = crypto
            .createHmac('sha256', this.SECRET)
            .update(payloadBase64)
            .digest('base64url');

        if (signature !== expectedSignature) {
            throw new UnauthorizedError({
                message: EphemeralTokenErrorCode.TOKEN_SIGNATURE_INVALID,
                details: { errorCode: ErrorCodes.EPH_SIGNATURE_INVALID }
            });
        }

        // Decodifica payload
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
        const payload: TokenPayloadDTO = JSON.parse(payloadJson);

        return payload;
    }

    /**
     * Aggiungi JTI alla cache in-memory (con limite max entries)
     */
    private addJtiToCache(jti: string): void {
        // Se cache è piena, rimuovi entries più vecchi (FIFO)
        if (this.jtiCache.size >= this.MAX_JTI_CACHE_SIZE) {
            const firstEntry = this.jtiCache.values().next().value;
            this.jtiCache.delete(firstEntry);
        }

        this.jtiCache.add(jti);
    }
}

export default new EphemeralTokenService();
