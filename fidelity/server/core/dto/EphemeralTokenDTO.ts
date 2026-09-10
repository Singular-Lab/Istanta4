/**
 * DTOs per il sistema di token effimeri
 */

// ==================== REQUEST DTOs ====================

/**
 * Request per iniziare un challenge
 */
export interface StartChallengeRequestDTO {
    origin: string;              // Origine richiedente (es: https://example.com)
    fpVersion: string;           // Versione plugin FP (es: "1.0.0")
}

/**
 * Request per completare un challenge e ottenere il token
 */
export interface CompleteChallengeRequestDTO {
    challengeId: string;         // UUID del challenge
    nonce: string;               // Nonce ricevuto dallo start
    ts: number;                  // Timestamp ricevuto dallo start
    browserHash: string;         // SHA-256 fingerprint del browser (base64)
}

// ==================== RESPONSE DTOs ====================

/**
 * Response dello start challenge
 */
export interface StartChallengeResponseDTO {
    challengeId: string;         // UUID del challenge
    nonce: string;               // Random 32 bytes hex
    ts: number;                  // Timestamp Unix millisecondi
    signature: string;           // HMAC-SHA256 firma (hex)
}

/**
 * Response del complete challenge (token emesso)
 */
export interface CompleteChallengeResponseDTO {
    token: string;               // Token firmato HMAC-SHA256
    expUtc: number;              // Timestamp scadenza Unix millisecondi
    scope: string;               // Scope permessi (es: "promo:read,refs:read")
}

// ==================== TOKEN PAYLOAD ====================

/**
 * Payload interno del token (usato per generazione/validazione)
 */
export interface TokenPayloadDTO {
    jti: string;                 // JWT ID univoco (UUID v4)
    origin: string;              // Origine vincolata
    browserHash: string;         // SHA-256 fingerprint browser
    scope: string;               // Scope permessi
    iat: number;                 // Issued at (Unix ms)
    exp: number;                 // Expires at (Unix ms)
    fpVersion: string;           // Versione plugin FP
}

// ==================== VALIDATION RESULT ====================

/**
 * Risultato validazione token
 */
export interface TokenValidationResultDTO {
    valid: boolean;              // Flag validazione
    jti?: string;                // JTI se validato con successo
    origin?: string;             // Origin se validato con successo
    scope?: string;              // Scope se validato con successo
    errorCode?: string;          // Codice errore se fallito
    errorMessage?: string;       // Messaggio errore se fallito
}

// ==================== AUDIT EVENT ====================

/**
 * Evento per audit log
 */
export interface AuditEventDTO {
    eventType: string;           // Tipo evento
    challengeId?: string;        // Challenge ID (se applicabile)
    jti?: string;                // Token JTI (se applicabile)
    origin: string;              // Origine
    ipAddress: string;           // IP richiedente
    userAgent: string;           // User-Agent
    fpVersion?: string;          // Versione plugin
    success: boolean;            // Successo/fallimento
    errorMessage?: string;       // Messaggio errore
    metadata?: Record<string, any>; // Dati aggiuntivi
}

// ==================== WHITELIST ====================

/**
 * Entry whitelist origine
 */
export interface OriginWhitelistEntryDTO {
    origin: string;
    description?: string;
    active: boolean;
    rateLimitPerMinute: number;
    allowedScopes: string[];
}

// ==================== RATE LIMIT ====================

/**
 * Risultato verifica rate limit
 */
export interface RateLimitResultDTO {
    allowed: boolean;            // Se la richiesta è permessa
    limit: number;               // Limite configurato
    remaining: number;           // Richieste rimanenti
    resetAt: number;             // Timestamp reset (Unix ms)
}

// ==================== ERROR CODES ====================

/**
 * Codici errore standardizzati
 */
export enum EphemeralTokenErrorCode {
    // Challenge errors
    CHALLENGE_NOT_FOUND = 'CHALLENGE_NOT_FOUND',
    CHALLENGE_EXPIRED = 'CHALLENGE_EXPIRED',
    CHALLENGE_ALREADY_USED = 'CHALLENGE_ALREADY_USED',
    CHALLENGE_SIGNATURE_INVALID = 'CHALLENGE_SIGNATURE_INVALID',

    // Token errors
    TOKEN_MISSING = 'TOKEN_MISSING',
    TOKEN_INVALID = 'TOKEN_INVALID',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    TOKEN_REVOKED = 'TOKEN_REVOKED',
    TOKEN_SIGNATURE_INVALID = 'TOKEN_SIGNATURE_INVALID',

    // Origin errors
    ORIGIN_NOT_WHITELISTED = 'ORIGIN_NOT_WHITELISTED',
    ORIGIN_DISABLED = 'ORIGIN_DISABLED',
    ORIGIN_MISMATCH = 'ORIGIN_MISMATCH',

    // Security errors
    FINGERPRINT_MISMATCH = 'FINGERPRINT_MISMATCH',
    VERSION_TOO_OLD = 'VERSION_TOO_OLD',
    REPLAY_ATTACK_DETECTED = 'REPLAY_ATTACK_DETECTED',

    // Rate limit
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

    // Generic
    INTERNAL_ERROR = 'INTERNAL_ERROR'
}
