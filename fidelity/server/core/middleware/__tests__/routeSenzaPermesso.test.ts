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
import { chiaveRouteSenzaPermesso, ROUTE_SENZA_PERMESSO } from '../routeSenzaPermesso';

interface Strato { route?: { path: string; methods: Record<string, boolean | undefined>; stack: Array<{ handle?: unknown }> } }

async function routeSenzaGuardiano(): Promise<string[]> {
  const chiavi: string[] = [];
  for (const controller of await createControllers() as unknown as Array<{ router: { stack: Strato[] }; basePath: string; initializeRoutes(): void }>) {
    if (controller.router.stack.length === 0) controller.initializeRoutes();
    for (const strato of controller.router.stack) {
      if (!strato.route) continue;
      const passi = strato.route.stack.map(passo => passo.handle);
      // Le route senza chiamanti hanno il loro elenco e si tolgono
      if (passi.includes(routeDeprecata) || passi.some(passo => guardiani.has(passo))) continue;
      for (const [metodo, attivo] of Object.entries(strato.route.methods)) {
        if (attivo) chiavi.push(chiaveRouteSenzaPermesso(metodo, `${controller.basePath}${strato.route.path}`));
      }
    }
  }
  return chiavi;
}

describe('ogni funzione governata da un permesso: censimento delle route', () => {
  it('le route senza permesso sono esattamente quelle dell\'elenco, ciascuna con il suo motivo', async () => {
    const senzaPermesso = (await routeSenzaGuardiano()).sort();

    expect(senzaPermesso).toEqual(ROUTE_SENZA_PERMESSO.map(({ metodo, percorso }) => chiaveRouteSenzaPermesso(metodo, percorso)).sort());
  });

  it('l\'elenco non ha doppioni', () => {
    const chiavi = ROUTE_SENZA_PERMESSO.map(({ metodo, percorso }) => chiaveRouteSenzaPermesso(metodo, percorso));
    expect(new Set(chiavi).size).toBe(chiavi.length);
  });

  it('le funzioni che prima erano aperte a ogni utente collegato ora chiedono un permesso', async () => {
    const senzaPermesso = new Set(await routeSenzaGuardiano());

    for (const chiave of [
      'GET /api/dashboard/volantini-in-corso',
      'GET /api/dashboard/storico-volantini',
      'GET /api/scoreboard',
      'GET /api/scoreboard/category-timeline',
      'POST /api/tracciati/momenti',
      'POST /api/tracciati/schemi/:idSchema/applica',
      'GET /api/tracciati/:idTracciato/download',
      'GET /api/promo/menabo',
      'GET /api/display-contexts',
    ]) {
      expect(senzaPermesso.has(chiave)).toBe(false);
    }
  });
});
