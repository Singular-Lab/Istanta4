import type { Request } from 'express';
import {
  ExternalApiError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '../../../lib/errors';
import type { ParsedOIDCUtente } from '../agenzia_lib/types';
import { AuditLogService } from '../services/AuditLogService';

/**
 * Apre la sessione di un utente riconosciuto da un fornitore esterno (OIDC o SAML),
 * dopo che AgenziaLib lo ha individuato e lo stato dell'account e' stato verificato.
 */
export async function apriSessioneEsterna(req: Request, parsed: ParsedOIDCUtente): Promise<void> {
  // Rigenera la sessione per prevenire session fixation
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => err ? reject(err) : resolve());
  });

  req.session.id_utente = parsed.id;
  req.session.private_key = parsed.private_key;
  req.session.id_gdo = parsed.id_gdo;
  req.session.email = parsed.email;
  req.session.tipo_utente = parsed.tipo_utente;
  req.session.codice_posizione = parsed.codice_posizione;
  req.session.isExternalAuth = true;

  // Security tracking
  req.session.lastActivity = new Date();
  req.session.lastIP = req.ip;
  req.session.lastUserAgent = req.get('user-agent');

  // Dati del flusso OIDC: non servono piu'
  req.session.oidc_state = undefined;
  req.session.oidc_nonce = undefined;
  req.session.oidc_code_verifier = undefined;
  req.session.oidc_provider_code = undefined;

  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => err ? reject(err) : resolve());
  });

  AuditLogService.getInstance().loginSuccess(req, parsed.id, parsed.tipo_utente);
}

/**
 * Mappa un errore del flusso di accesso esterno in un redirect verso `/login` con
 * `reason` e `message`, cosi' che l'interfaccia mostri un messaggio per ogni caso.
 *
 * Reason codes (prefisso oidc_ o saml_):
 * - `<p>_user_not_found`       → utente non trovato/non censito
 * - `<p>_access_denied`        → accesso negato (Forbidden/Unauthorized)
 * - `<p>_service_unavailable`  → servizio esterno non disponibile
 * - `<p>_rate_limited`         → rate limit superato
 * - `<p>_external_error`       → errore generico API esterna
 * - `<p>_error`                → fallback generico
 */
export function redirectErroreAccessoEsterno(error: unknown, prefisso: 'oidc' | 'saml'): string {
  const url = (motivo: string, messaggio: string) =>
    `/login?reason=${prefisso}_${motivo}&message=${encodeURIComponent(messaggio)}`;

  if (error instanceof NotFoundError) return url('user_not_found', error.message);
  if (error instanceof ForbiddenError || error instanceof UnauthorizedError) return url('access_denied', error.message);
  if (error instanceof ServiceUnavailableError) return url('service_unavailable', error.message);
  if (error instanceof RateLimitError) return url('rate_limited', error.message);
  if (error instanceof ExternalApiError) return url('external_error', error.message);
  if (isAppError(error)) return url('error', error.message);
  return url('error', 'Errore durante autenticazione');
}
