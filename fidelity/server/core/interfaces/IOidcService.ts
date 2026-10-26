import type { AuthProvider } from '../models/auth_provider';

export interface OidcTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface OidcUserClaims {
  sub: string;
  oid?: string;
  tid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  nonce?: string;
}

export interface OidcAuthorizeParams {
  authorize_url: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  nonce: string;
  code_challenge: string;
  code_challenge_method: 'S256';
}

export interface IOidcService {
  /**
   * Genera i parametri per l'authorize URL (state, nonce, PKCE code_verifier/code_challenge)
   */
  generateAuthorizeParams(provider: AuthProvider): Promise<{
    params: OidcAuthorizeParams;
    code_verifier: string;
    nonce: string;
    state: string;
  }>;

  /**
   * Scambia l'authorization code con i token
   */
  exchangeCodeForTokens(
    provider: AuthProvider,
    code: string,
    code_verifier: string,
  ): Promise<OidcTokenResponse>;

  /**
   * Valida l'id_token JWT e restituisce i claims dell'utente
   */
  validateIdToken(
    provider: AuthProvider,
    id_token: string,
    expectedNonce: string,
  ): Promise<OidcUserClaims>;
}
