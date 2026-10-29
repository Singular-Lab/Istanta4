import { describe, expect, it, vi } from 'vitest';

// Servizi finti: qui conta solo come ogni controller monta le proprie route
vi.mock('../../di', () => {
  const servizio = () => new Proxy({}, { get: () => vi.fn() });
  return {
    initializeContainer: vi.fn(async () => undefined),
    container: { get: vi.fn(() => servizio()) },
    TYPES: new Proxy({}, { get: (_target, chiave) => String(chiave) }),
  };
});

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// I guardiani dei permessi sono funzioni anonime: si riconoscono da qui
const guardiani = vi.hoisted(() => new Set<unknown>());
vi.mock('../permissionGuard', async (importOriginal) => {
  const originale = await importOriginal<typeof import('../permissionGuard')>();
  return {
    ...originale,
    permissionGuard: (codice: Parameters<typeof originale.permissionGuard>[0]) => {
      const guardiano = originale.permissionGuard(codice);
      guardiani.add(guardiano);
      return guardiano;
    },
  };
});

import { createControllers } from '../../routes';
import { routeDeprecata } from '../routeDeprecata';
import { chiaveRoute, MARCATE_IL, RIMUOVIBILI_DAL, ROUTE_SENZA_CHIAMANTI } from '../routeSenzaChiamanti';

const MIDDLEWARE_DI_AUTENTICAZIONE = new Set([
  'authMiddleware',
  'integrationAuthMiddleware',
  'ephemeralTokenAuthMiddleware',
  'apiKeyAuthMiddleware',
]);

/**
 * Route chiamate da altri sistemi o pubbliche e documentate: il nome e' un contratto,
 * anche quando l'inventario non ne trova traccia. Non si marcano.
 */
const MAI_DA_MARCARE = [
  // Istanta
  'PUT /api/getKitByPromo',
  'DELETE /api/clearAllFilesKitRuntime/:idKitRuntime/:guidIdExport',
  'GET /api/richiediConfigMapDatafields',
  'POST /api/invioMaterialeAdFP',
  'GET /api/get_all_combinazioni_canale_area',
  // Plugin e sue API
  'POST /api/auth/ephemeral/start',
  'POST /api/auth/ephemeral/complete',
  'GET /api/auth/ephemeral/health',
  'GET /api/external/health',
  'GET /api/external/filter-templates/slug/:slug',
  'POST /api/external/statistiche/pulisci',
  'POST /api/external/plugin/punti-vendita',
  // IdP
  'GET /api/auth/oidc/callback',
  'POST /api/auth/saml/acs/:codice',
  'GET /api/auth/saml/metadata/:codice',
  // Display del punto vendita
  'GET /api/display/files',
  'GET /api/display/info',
  'POST /api/dispositivi/heartbeat',
  // Pubbliche e documentate (WebPliant, webhook)
  'GET /api/getConfigWebPliantFromVolantino',
  'GET /api/getColorGDO',
  'GET /api/getURLWebpliant',
  'GET /api/webhooks/eventi/disponibili',
  'POST /api/webhooks/ricevi',
];

interface Passo { name?: string; handle?: unknown }
interface Strato { route?: { path: string; methods: Record<string, boolean | undefined>; stack: Passo[] } }

async function routeRegistrate(): Promise<Array<{ chiave: string; passi: unknown[] }>> {
  const route: Array<{ chiave: string; passi: unknown[] }> = [];
  for (const controller of await createControllers() as unknown as Array<{ router: { stack: Strato[] }; basePath: string; initializeRoutes(): void }>) {
    if (controller.router.stack.length === 0) {
      controller.initializeRoutes();
    }
    for (const strato of controller.router.stack) {
      if (!strato.route) continue;
      for (const [metodo, attivo] of Object.entries(strato.route.methods)) {
        if (!attivo) continue;
        route.push({
          chiave: chiaveRoute(metodo, `${controller.basePath}${strato.route.path}`),
          passi: strato.route.stack.map((passo) => passo.handle),
        });
      }
    }
  }
  return route;
}

function eUnaProtezione(passo: unknown): boolean {
  return guardiani.has(passo) || (typeof passo === 'function' && MIDDLEWARE_DI_AUTENTICAZIONE.has(passo.name));
}

describe('route senza chiamanti: censimento', () => {
  it('le route con routeDeprecata sono esattamente quelle dell\'elenco', async () => {
    const marcate = (await routeRegistrate())
      .filter(({ passi }) => passi.includes(routeDeprecata))
      .map(({ chiave }) => chiave)
      .sort();

    expect(marcate).toEqual(ROUTE_SENZA_CHIAMANTI.map(({ metodo, percorso }) => chiaveRoute(metodo, percorso)).sort());
  });

  it('l\'elenco non ha doppioni e ogni voce dice perche\' e\' marcata', () => {
    const chiavi = ROUTE_SENZA_CHIAMANTI.map(({ metodo, percorso }) => chiaveRoute(metodo, percorso));

    expect(new Set(chiavi).size).toBe(chiavi.length);
    for (const { motivo } of ROUTE_SENZA_CHIAMANTI) {
      expect(motivo.trim()).not.toBe('');
    }
    expect(MARCATE_IL).toBe('2026-10-29');
    expect(new Date(RIMUOVIBILI_DAL).getTime() - new Date(MARCATE_IL).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('routeDeprecata viene dopo tutte le protezioni: l\'autenticazione delle route non cambia', async () => {
    for (const { chiave, passi } of (await routeRegistrate()).filter(({ passi: p }) => p.includes(routeDeprecata))) {
      const posizione = passi.indexOf(routeDeprecata);
      const prima = passi.slice(0, posizione);
      const dopo = passi.slice(posizione + 1);

      expect(prima.length, chiave).toBeGreaterThan(0);
      expect(prima.every(eUnaProtezione), chiave).toBe(true);
      expect(dopo.some(eUnaProtezione), chiave).toBe(false);
    }
  });

  it('nessuna route chiamata da altri sistemi o pubblica e documentata e\' marcata', () => {
    const marcate = new Set(ROUTE_SENZA_CHIAMANTI.map(({ metodo, percorso }) => chiaveRoute(metodo, percorso)));

    expect(MAI_DA_MARCARE.filter((chiave) => marcate.has(chiave))).toEqual([]);
  });
});
