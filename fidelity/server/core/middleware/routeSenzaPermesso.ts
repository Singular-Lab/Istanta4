/**
 * Le sole route che non chiedono un permesso del catalogo (lib/accessi/catalogo.ts): ogni altra
 * pagina e chiamata di Fidelity ne chiede uno (spec ruoli-permessi, "Ogni funzione governata da un
 * permesso"). Il censimento in __tests__/routeSenzaPermesso.test.ts confronta questo elenco con le
 * route montate: una route nuova senza permessionGuard fa fallire il test finché non si sceglie se
 * proteggerla o aggiungerla qui, con il suo motivo.
 *
 * Le route marcate con routeDeprecata (routeSenzaChiamanti.ts) non sono qui: si tolgono.
 */

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type MotivoSenzaPermesso =
  /** Con la sessione, l'utente su sé stesso: profilo, notifiche, menu e permessi propri, hub, wishlist. */
  | 'utente'
  /** Con la sessione, dati di riferimento per i moduli di ogni pagina. */
  | 'riferimento'
  /** Senza sessione: accesso, recupero della password, metodi di accesso. */
  | 'accesso'
  /** Senza sessione: WebPliant pubblico e risorse pubbliche della GDO. */
  | 'pubblica'
  /** Altri sistemi, con la loro autenticazione o un contratto documentato: plugin, display, Istanta, DB1, webhook. */
  | 'integrazione';

export interface RouteSenzaPermesso {
  metodo: MetodoHttp;
  /** Pattern completo, come lo registra Express: base del controller + percorso della route. */
  percorso: string;
  motivo: MotivoSenzaPermesso;
  nota?: string;
}

const r = (metodo: MetodoHttp, percorso: string, motivo: MotivoSenzaPermesso, nota?: string): RouteSenzaPermesso =>
  ({ metodo, percorso, motivo, nota });

export const ROUTE_SENZA_PERMESSO: readonly RouteSenzaPermesso[] = [
  // ─── L'utente su sé stesso ────────────────────────────────────────────────────
  r('GET', '/api/get_attivita', 'utente', 'notifiche dell\'utente'),
  r('GET', '/api/get_attivita_count', 'utente', 'notifiche dell\'utente'),
  r('PUT', '/api/mark_as_read', 'utente', 'notifiche dell\'utente'),
  r('PUT', '/api/mark_all_as_read', 'utente', 'notifiche dell\'utente'),
  r('GET', '/api/session/info', 'utente'),
  r('GET', '/api/logout-user', 'utente'),
  r('PUT', '/api/update_profile', 'utente'),
  r('PUT', '/api/update_password', 'utente'),
  r('POST', '/api/utente/disattiva-account', 'utente'),
  r('GET', '/api/utenti/me/global-filters', 'utente', 'filtri globali dell\'utente (reparti, aree)'),
  r('GET', '/api/menu/me', 'utente'),
  r('GET', '/api/menu/pagina-iniziale', 'utente'),
  r('GET', '/api/permessi/effettivi', 'utente'),
  r('GET', '/api/hub-user-info', 'utente'),
  r('GET', '/api/hub-services', 'utente', 'servizi dell\'hub del tipo dell\'utente'),
  r('GET', '/api/hub-services/fico-context', 'utente'),
  r('GET', '/api/hub-news', 'utente'),
  r('GET', '/api/get_quick_search_settings', 'utente', 'ricerca veloce: le voci le filtra il menu dell\'utente'),
  r('GET', '/api/promo/ping', 'utente', 'controllo della sessione'),
  r('PUT', '/api/generaNuovaSessioneWebpliant', 'utente', 'wishlist WebPliant dell\'utente'),
  r('PUT', '/api/generaNuovoInserimentoWishlistWebpliant', 'utente', 'wishlist WebPliant dell\'utente'),
  r('PUT', '/api/insertReferenzaInWishlist', 'utente', 'wishlist WebPliant dell\'utente'),
  r('POST', '/api/deleteWishlistItem', 'utente', 'wishlist WebPliant dell\'utente'),

  // ─── Dati di riferimento ──────────────────────────────────────────────────────
  r('GET', '/api/get_all_gdo', 'riferimento'),
  r('GET', '/api/get_all_ruoli_gdo', 'riferimento'),
  r('GET', '/api/get_all_combinazioni_canale_area', 'riferimento', 'la chiama anche Istanta'),
  r('GET', '/api/funzionalita', 'riferimento'),
  r('GET', '/api/avviso-manutenzione', 'riferimento'),

  // ─── Accesso, senza sessione ──────────────────────────────────────────────────
  r('POST', '/api/login_user', 'accesso'),
  r('POST', '/api/check_login_for_multiple_users', 'accesso'),
  r('GET', '/api/session/check', 'accesso'),
  r('GET', '/api/policy/check', 'accesso'),
  r('GET', '/api/csrf-token', 'accesso'),
  r('GET', '/api/autentica_utente_fico', 'accesso'),
  r('GET', '/api/autentica_utente_ad', 'accesso'),
  r('POST', '/api/dev/hash-password', 'accesso', 'risponde solo in sviluppo locale'),
  r('POST', '/api/email/recupero-password', 'accesso'),
  r('GET', '/api/email/validate-reset-token', 'accesso'),
  r('POST', '/api/email/reset-password', 'accesso'),
  r('GET', '/api/auth-providers', 'accesso', 'metodi di accesso della pagina di login'),
  r('GET', '/api/auth/oidc/authorize/:codice', 'accesso'),
  r('GET', '/api/auth/oidc/callback', 'accesso'),
  r('GET', '/api/auth/oidc/fake-callback', 'accesso'),
  r('GET', '/api/auth/saml/authorize/:codice', 'accesso'),
  r('POST', '/api/auth/saml/acs/:codice', 'accesso'),
  r('GET', '/api/auth/saml/metadata/:codice', 'accesso'),
  r('GET', '/api/auth/ephemeral/health', 'accesso', 'accesso del plugin'),
  r('POST', '/api/auth/ephemeral/start', 'accesso', 'accesso del plugin'),
  r('POST', '/api/auth/ephemeral/complete', 'accesso', 'accesso del plugin'),

  // ─── Pubbliche ────────────────────────────────────────────────────────────────
  r('GET', '/api/get_config', 'pubblica'),
  r('GET', '/api/getStiliToText', 'pubblica'),
  r('GET', '/api/getColorGDO', 'pubblica'),
  r('GET', '/api/gdo/icona', 'pubblica'),
  r('GET', '/api/t/', 'pubblica', 'traduzioni'),
  r('GET', '/api/getConfigWebPliantFromVolantino', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/getURLWebpliant', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/getAllReferenzeFromWishlistId', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/getParamsWishlistId', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/checkWishlistId', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/prendiWorkspaceDaID/:idWorkspace', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/getReferenzeWebPliant', 'pubblica', 'WebPliant pubblico'),
  r('POST', '/api/ricercaReferenzePromo', 'pubblica', 'WebPliant pubblico'),
  r('POST', '/api/get_filtered_referenze', 'pubblica', 'WebPliant pubblico'),
  r('GET', '/api/webhooks/eventi/disponibili', 'pubblica', 'documentazione dei webhook'),

  // ─── Integrazioni ─────────────────────────────────────────────────────────────
  r('GET', '/api/display/files', 'integrazione', 'display del punto vendita'),
  r('GET', '/api/display/info', 'integrazione', 'display del punto vendita'),
  r('POST', '/api/dispositivi/heartbeat', 'integrazione', 'display del punto vendita'),
  r('GET', '/api/external/health', 'integrazione', 'plugin'),
  r('POST', '/api/external/refs', 'integrazione', 'plugin, con il token del plugin'),
  r('POST', '/api/external/refs-html', 'integrazione', 'plugin, con il token del plugin'),
  r('GET', '/api/external/css', 'integrazione', 'plugin, con il token del plugin'),
  r('POST', '/api/external/files', 'integrazione', 'plugin, con il token del plugin'),
  r('GET', '/api/external/promo', 'integrazione', 'plugin, con il token del plugin'),
  r('GET', '/api/external/status', 'integrazione', 'plugin, con il token del plugin'),
  r('GET', '/api/external/refs/today', 'integrazione', 'plugin, con il token del plugin'),
  r('GET', '/api/external/filter-templates/slug/:slug', 'integrazione', 'plugin, con il token del plugin'),
  r('GET', '/api/richiediConfigMapDatafields', 'integrazione', 'Istanta, con l\'autenticazione di integrazione'),
  r('GET', '/api/tracciati/promo/:idPromo', 'integrazione', 'DB1 la legge senza sessione Fidelity: per proteggerla va cambiato DB1'),
  r('POST', '/api/webhooks/ricevi', 'integrazione', 'webhook in arrivo'),
];

/** Chiave "METODO /pattern", la stessa del censimento delle route. */
export const chiaveRouteSenzaPermesso = (metodo: string, percorso: string): string => `${metodo.toUpperCase()} ${percorso}`;
