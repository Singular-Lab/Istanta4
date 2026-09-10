import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { BadRequestError } from '../../../lib/errors/application/BadRequestError';
import { UnauthorizedError } from '../../../lib/errors/application/UnauthorizedError';
import { ExternalApiError } from '../../../lib/errors/infrastructure/ExternalApiError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import type { AuthProvider } from '../models/auth_provider';
import type { IOidcService, OidcTokenResponse, OidcUserClaims, OidcAuthorizeParams } from '../interfaces/IOidcService';
import { log } from '../logger';

type JWKSFunction = ReturnType<typeof createRemoteJWKSet>;

/**
 * Servizio OIDC per gestire il flusso Authorization Code con PKCE.
 * Supporta Microsoft Entra ID e qualsiasi provider OIDC compatibile.
 */
export class OidcService implements IOidcService {
  /** Cache JWKS per tenant per evitare fetch ripetuti */
  private jwksCache = new Map<string, { jwks: JWKSFunction; cachedAt: number }>();
  private readonly JWKS_CACHE_TTL = 1000 * 60 * 60; // 1 ora

  async generateAuthorizeParams(provider: AuthProvider): Promise<{
    params: OidcAuthorizeParams;
    code_verifier: string;
    nonce: string;
    state: string;
  }> {
    const clientConfig = provider.config_client as Record<string, string> | null;
    if (!clientConfig?.authorize_url || !clientConfig?.client_id || !clientConfig?.redirect_uri) {
      throw new BadRequestError({
        message: `Provider "${provider.codice}" manca di config_client richieste (authorize_url, client_id, redirect_uri)`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_PROVIDER_ERROR }
      });
    }

    // PKCE: genera code_verifier e code_challenge (S256)
    const code_verifier = this.generateCodeVerifier();
    const code_challenge = this.generateCodeChallenge(code_verifier);

    // State per CSRF protection e nonce per replay protection
    const state = randomUUID();
    const nonce = randomUUID();

    const params: OidcAuthorizeParams = {
      authorize_url: clientConfig.authorize_url,
      client_id: clientConfig.client_id,
      redirect_uri: clientConfig.redirect_uri,
      scope: clientConfig.scope || 'openid profile email',
      state,
      nonce,
      code_challenge,
      code_challenge_method: 'S256',
    };

    return { params, code_verifier, nonce, state };
  }

  async exchangeCodeForTokens(
    provider: AuthProvider,
    code: string,
    code_verifier: string,
  ): Promise<OidcTokenResponse> {
    const serverConfig = provider.config_server as Record<string, string> | null;
    const clientConfig = provider.config_client as Record<string, string> | null;

    if (!serverConfig?.token_url || !serverConfig?.client_secret) {
      throw new BadRequestError({
        message: `Provider "${provider.codice}" manca di config_server richieste (token_url, client_secret)`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_PROVIDER_ERROR }
      });
    }
    if (!clientConfig?.client_id || !clientConfig?.redirect_uri) {
      throw new BadRequestError({
        message: `Provider "${provider.codice}" manca di config_client richieste (client_id, redirect_uri)`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_PROVIDER_ERROR }
      });
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientConfig.client_id,
      client_secret: serverConfig.client_secret,
      redirect_uri: clientConfig.redirect_uri,
      code_verifier,
      scope: clientConfig.scope || 'openid profile email',
    });

    log.info(`[OidcService] Scambio code per token con provider "${provider.codice}"`);

    const response = await fetch(serverConfig.token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error(`[OidcService] Token exchange fallito (${response.status}):`, errorBody);
      throw new ExternalApiError({
        message: `Token exchange fallito: ${response.status} - ${errorBody}`,
        service: `OIDC:${provider.codice}`,
        endpoint: serverConfig.token_url,
        statusCode: response.status,
        details: { errorCode: ErrorCodes.OIDC_CALLBACK_FAILED, responseBody: errorBody }
      });
    }

    const tokens = await response.json() as OidcTokenResponse;
    log.info(`[OidcService] Token ricevuti per provider "${provider.codice}"`);
    return tokens;
  }

  async validateIdToken(
    provider: AuthProvider,
    id_token: string,
    expectedNonce: string,
  ): Promise<OidcUserClaims> {
    const serverConfig = provider.config_server as Record<string, string> | null;
    const clientConfig = provider.config_client as Record<string, string> | null;

    if (!serverConfig?.jwks_uri) {
      throw new BadRequestError({
        message: `Provider "${provider.codice}" manca di config_server.jwks_uri`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_PROVIDER_ERROR }
      });
    }
    if (!clientConfig?.client_id) {
      throw new BadRequestError({
        message: `Provider "${provider.codice}" manca di config_client.client_id`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_PROVIDER_ERROR }
      });
    }

    // Recupera o usa la cache JWKS
    const jwks = this.getJWKS(serverConfig.jwks_uri);

    // Decodifica e verifica header per logging
    const header = decodeProtectedHeader(id_token);
    log.info(`[OidcService] Validazione id_token: alg=${header.alg}, kid=${header.kid}`);

    // Verifica il JWT con JWKS
    const { payload } = await jwtVerify(id_token, jwks, {
      audience: clientConfig.client_id,
      clockTolerance: 60, // 60 secondi di tolleranza per clock skew
    });

    // Verifica issuer — Entra ID usa il pattern https://login.microsoftonline.com/{tid}/v2.0
    const iss = payload.iss;
    if (iss && serverConfig.expected_issuer) {
      if (iss !== serverConfig.expected_issuer) {
        throw new UnauthorizedError({
          message: `Issuer non valido: atteso "${serverConfig.expected_issuer}", ricevuto "${iss}"`,
          details: { provider: provider.codice, expectedIssuer: serverConfig.expected_issuer, receivedIssuer: iss, errorCode: ErrorCodes.OIDC_CALLBACK_FAILED }
        });
      }
    }

    // Verifica nonce
    if (payload.nonce !== expectedNonce) {
      throw new UnauthorizedError({
        message: `Nonce non corrispondente: atteso "${expectedNonce}", ricevuto "${payload.nonce}"`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_CALLBACK_FAILED }
      });
    }

    // Microsoft Entra ID può emettere l'Object ID sia come claim corto "oid"
    // sia come URI completa "http://schemas.microsoft.com/identity/claims/objectidentifier"
    // (token legacy, multi-tenant o con policy di trasformazione claims).
    const oidFromShortClaim = payload.oid as string | undefined;
    const oidFromUriClaim = payload['http://schemas.microsoft.com/identity/claims/objectidentifier'] as string | undefined;

    const claims: OidcUserClaims = {
      sub: payload.sub as string,
      oid: oidFromShortClaim || oidFromUriClaim,
      tid: payload.tid as string | undefined,
      email: (payload.email as string) || (payload.preferred_username as string),
      preferred_username: payload.preferred_username as string | undefined,
      name: payload.name as string | undefined,
      given_name: payload.given_name as string | undefined,
      family_name: payload.family_name as string | undefined,
      nonce: payload.nonce as string | undefined,
    };

    log.info(`[OidcService] id_token validato per: ${claims.email || claims.preferred_username}`);
    return claims;
  }

  // ─── Utility PKCE ─────────────────────────────────────

  private generateCodeVerifier(): string {
    return randomBytes(64).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    const digest = createHash('sha256').update(verifier).digest();
    return Buffer.from(digest).toString('base64url');
  }

  private getJWKS(jwksUri: string): JWKSFunction {
    const cached = this.jwksCache.get(jwksUri);
    if (cached && (Date.now() - cached.cachedAt) < this.JWKS_CACHE_TTL) {
      return cached.jwks;
    }

    const jwks = createRemoteJWKSet(new URL(jwksUri));
    this.jwksCache.set(jwksUri, { jwks, cachedAt: Date.now() });
    return jwks;
  }
}
