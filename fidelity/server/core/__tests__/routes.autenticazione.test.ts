import { describe, expect, it, vi } from 'vitest';

// Servizi finti: qui conta solo come ogni controller monta le proprie route
vi.mock('../di', () => {
  const servizio = () => new Proxy({}, { get: () => vi.fn() });
  return {
    initializeContainer: vi.fn(async () => undefined),
    container: { get: vi.fn(() => servizio()) },
    TYPES: new Proxy({}, { get: (_target, chiave) => String(chiave) }),
  };
});

vi.mock('../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createControllers } from '../routes';

// Ogni route che modifica dati passa da un middleware di autenticazione. Le eccezioni sono
// pubbliche per scelta e si proteggono altrove: aggiungerne una va motivato qui sotto.
const MIDDLEWARE_DI_AUTENTICAZIONE = new Set([
  'authMiddleware',
  'integrationAuthMiddleware',
  'ephemeralTokenAuthMiddleware',
  'apiKeyAuthMiddleware',
]);

const PUBBLICHE_PER_SCELTA = [
  'POST /api/auth/ephemeral/complete', // handshake del plugin: origine e browser controllati dai propri middleware
  'POST /api/auth/ephemeral/start',
  'POST /api/auth/saml/acs/:codice', // risposta dell'IdP SAML, protetta dalla firma
  'POST /api/check_login_for_multiple_users', // accesso
  'POST /api/dev/hash-password', // solo in sviluppo locale, altrove risponde 404
  'POST /api/dispositivi/heartbeat', // display del punto vendita, riconosciuto dal proprio token
  'POST /api/email/recupero-password', // recupero password, con rate limit
  'POST /api/email/reset-password', // link firmato e valido una sola volta
  'POST /api/get_filtered_referenze', // volantino WebPliant pubblico, in sola lettura
  'POST /api/login_user', // accesso
  'POST /api/ricercaReferenzePromo', // ricerca del volantino WebPliant pubblico, in sola lettura
  'POST /api/webhooks/ricevi', // ricevitore di prova: risponde senza scrivere niente
  'PUT /api/notificaRisultatoPubblicazioneSuCorreggo', // callback di Correggo, verifica il segreto condiviso
];

const METODI_CHE_MODIFICANO = ['post', 'put', 'patch', 'delete'];

async function routeSenzaAutenticazione(): Promise<string[]> {
  const senza: string[] = [];
  for (const controller of await createControllers() as any[]) {
    if (controller.router.stack.length === 0) {
      controller.initializeRoutes();
    }
    for (const layer of controller.router.stack) {
      if (!layer.route) continue;
      const nomi = layer.route.stack.map((passo: any) => passo.name ?? passo.handle?.name);
      if (nomi.some((nome: string) => MIDDLEWARE_DI_AUTENTICAZIONE.has(nome))) continue;
      for (const metodo of Object.keys(layer.route.methods)) {
        if (METODI_CHE_MODIFICANO.includes(metodo)) {
          senza.push(`${metodo.toUpperCase()} ${controller.basePath}${layer.route.path}`);
        }
      }
    }
  }
  return senza.sort();
}

describe('autenticazione delle route che modificano dati', () => {
  it('solo le route pubbliche per scelta non hanno un middleware di autenticazione', async () => {
    expect(await routeSenzaAutenticazione()).toEqual([...PUBBLICHE_PER_SCELTA].sort());
  });
});
