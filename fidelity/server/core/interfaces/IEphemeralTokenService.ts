import {
    StartChallengeResponseDTO,
    CompleteChallengeResponseDTO,
    CompleteChallengeRequestDTO,
    TokenValidationResultDTO,
    AuditEventDTO
} from '../dto/EphemeralTokenDTO';

/**
 * Interfaccia servizio gestione token effimeri
 */
export interface IEphemeralTokenService {

    /**
     * Step 1: Avvia un nuovo challenge per ottenere token effimero
     *
     * @param origin - Origine richiedente (es: https://example.com)
     * @param ipAddress - IP richiedente
     * @param userAgent - User-Agent browser
     * @param fpVersion - Versione plugin FP
     * @returns Challenge data con nonce, timestamp, signature
     * @throws Error se origin non in whitelist o rate limit superato
     */
    startChallenge(
        origin: string,
        ipAddress: string,
        userAgent: string,
        fpVersion: string
    ): Promise<StartChallengeResponseDTO>;

    /**
     * Step 2: Completa il challenge e ottieni token effimero
     *
     * @param data - Dati completamento challenge (challengeId, nonce, ts, browserHash)
     * @param origin - Origine richiedente (deve corrispondere a quella del challenge)
     * @param ipAddress - IP richiedente
     * @param userAgent - User-Agent browser
     * @param fpVersion - Versione plugin FP
     * @returns Token firmato con expiry e scope
     * @throws Error se challenge non valido, scaduto, signature mismatch, etc.
     */
    completeChallenge(
        data: CompleteChallengeRequestDTO,
        origin: string,
        ipAddress: string,
        userAgent: string,
        fpVersion: string
    ): Promise<CompleteChallengeResponseDTO>;

    /**
     * Valida un token effimero
     *
     * @param token - Token da validare
     * @param origin - Origine richiedente (deve corrispondere a quella nel token)
     * @param browserHash - Browser fingerprint (deve corrispondere a quello nel token)
     * @param ipAddress - IP richiedente (per audit)
     * @param userAgent - User-Agent (per audit)
     * @returns Risultato validazione con JTI, origin, scope se successo
     */
    validateToken(
        token: string,
        origin: string,
        browserHash: string,
        ipAddress: string,
        userAgent: string
    ): Promise<TokenValidationResultDTO>;

    /**
     * Revoca manualmente un token (invalida JTI)
     *
     * @param jti - JWT ID da revocare
     * @returns True se revocato con successo
     */
    revokeToken(jti: string): Promise<boolean>;

    /**
     * Verifica se un JTI è già stato utilizzato (prevenzione replay)
     *
     * @param jti - JWT ID da verificare
     * @returns True se JTI già usato
     */
    isJtiUsed(jti: string): Promise<boolean>;

    /**
     * Aggiorna statistiche utilizzo token (last_used_at, use_count)
     *
     * @param jti - JWT ID del token
     */
    updateTokenUsage(jti: string): Promise<void>;

    /**
     * Traccia evento audit log
     *
     * @param event - Dati evento da tracciare
     */
    logAuditEvent(event: AuditEventDTO): Promise<void>;

    /**
     * Cleanup automatico: elimina challenge scaduti (TTL > 30 sec)
     *
     * @returns Numero challenge eliminati
     */
    cleanupExpiredChallenges(): Promise<number>;

    /**
     * Cleanup automatico: elimina token scaduti (TTL > 10 min dalla scadenza)
     *
     * @returns Numero token eliminati
     */
    cleanupExpiredTokens(): Promise<number>;
}
