import express, { type Express } from 'express';
import crypto from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Il guardiano vero, con accanto il permesso che ha chiesto: la tabella delle route lo confronta
const permessoDelGuardiano = vi.hoisted(() => new Map<unknown, string>());

vi.mock('../../middleware/permissionGuard', async (importOriginal) => {
  const originale = await importOriginal<typeof import('../../middleware/permissionGuard')>();
  return {
    ...originale,
    permissionGuard: (codice: Parameters<typeof originale.permissionGuard>[0]) => {
      const guardiano = originale.permissionGuard(codice);
      permessoDelGuardiano.set(guardiano, codice);
      return guardiano;
    },
  };
});

vi.mock('../../services/EphemeralTokenService', () => ({ default: { validateToken: vi.fn() } }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../di', () => ({ TYPES: {}, container: { get: vi.fn() } }));

import config from '../../config';
import { EphemeralTokenErrorCode, type TokenValidationResultDTO } from '../../dto/EphemeralTokenDTO';
import type { IExternalApiService } from '../../interfaces/IExternalApiService';
import { hashApiKey } from '../../middleware/apiKeyAuth';
import { authMiddleware } from '../../middleware/authMiddleware';
import { ephemeralTokenAuthMiddleware } from '../../middleware/ephemeralTokenAuthMiddleware';
import { RuoloUtenteGDO } from '../../models/ruolo_gdo';
import ephemeralTokenService from '../../services/EphemeralTokenService';
import type { FilterTemplateService } from '../../services/FilterTemplateService';
import type { StatisticheApiService } from '../../services/StatisticheApiService';
import { ExternalApiController } from '../ExternalApiController';

const BASE = '/api/external';

/**
 * Tutte le route del controller, con le protezioni in testa alla catena.
 * Una route nuova, un permesso cambiato o una protezione tolta fanno fallire il confronto:
 * aggiornare la tabella e' una scelta da motivare, non un dettaglio.
 */
const ROUTE_ATTESE: Record<string, string[]> = {
  // Plugin nel sito della GDO: token effimero, con ripiego sulla chiave API
  [`POST ${BASE}/refs`]: ['ephemeralTokenAuthMiddleware'],
  [`POST ${BASE}/refs-html`]: ['ephemeralTokenAuthMiddleware'],
  [`GET ${BASE}/css`]: ['ephemeralTokenAuthMiddleware'],
  [`POST ${BASE}/files`]: ['ephemeralTokenAuthMiddleware'],
  [`GET ${BASE}/promo`]: ['ephemeralTokenAuthMiddleware'],
  [`GET ${BASE}/status`]: ['ephemeralTokenAuthMiddleware'],
  [`GET ${BASE}/refs/today`]: ['ephemeralTokenAuthMiddleware'],
  [`GET ${BASE}/filter-templates/slug/:slug`]: ['ephemeralTokenAuthMiddleware'],

  // Editor dei filtri in Fidelity: basta la sessione
  [`GET ${BASE}/files/metadata-fields`]: ['authMiddleware'],
  [`POST ${BASE}/refs/field-values`]: ['authMiddleware'],
  [`POST ${BASE}/files/field-values`]: ['authMiddleware'],

  // Chiavi API
  [`POST ${BASE}/generate-api-key`]: ['authMiddleware', 'permissionGuard(api.gestisci_chiavi)'],
  [`GET ${BASE}/get_api_key`]: ['authMiddleware', 'permissionGuard(api.gestisci_chiavi)'],

  // Statistiche
  [`GET ${BASE}/statistiche/aggregate`]: ['authMiddleware', 'permissionGuard(api.visualizza_statistiche)'],
  [`GET ${BASE}/statistiche/dettagli`]: ['authMiddleware', 'permissionGuard(api.visualizza_statistiche)'],
  [`POST ${BASE}/statistiche/pulisci`]: ['authMiddleware', 'permissionGuard(api.visualizza_statistiche)'],

  // Pubblica per scelta: non legge dati
  [`GET ${BASE}/health`]: [],

  // Prove dalla sessione, senza il controllo di validita' delle promo
  [`POST ${BASE}/test/refs`]: ['authMiddleware', 'permissionGuard(api.test)'],
  [`POST ${BASE}/test/files`]: ['authMiddleware', 'permissionGuard(api.test)'],
  [`GET ${BASE}/test/promo`]: ['authMiddleware', 'permissionGuard(api.test)'],

  // Gestione dei template di filtri e del plugin
  [`POST ${BASE}/filter-templates`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`GET ${BASE}/filter-templates`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`GET ${BASE}/filter-templates/by-endpoint-type/:endpointType`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`POST ${BASE}/filter-templates/validate-slug`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`GET ${BASE}/filter-templates/slug/:slug/versions`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`POST ${BASE}/filter-templates/slug/:slug/restore`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`GET ${BASE}/filter-templates/:id`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`PUT ${BASE}/filter-templates/:id`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`DELETE ${BASE}/filter-templates/:id`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`POST ${BASE}/sync_foto_plugin`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`POST ${BASE}/sync_json_plugin`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
  [`POST ${BASE}/plugin/punti-vendita`]: ['authMiddleware', 'permissionGuard(api.gestisci_plugin)'],
};

const MIDDLEWARE_DI_AUTENTICAZIONE = new Set(['ephemeralTokenAuthMiddleware', 'authMiddleware']);

/** Quanto serve del router di Express per leggere le route registrate. */
interface PassoDellaRoute { handle: unknown }
interface StratoDelRouter {
  route?: { path: string; methods: Record<string, boolean | undefined>; stack: PassoDellaRoute[] };
}

function creaController(
  servizio: Partial<Record<keyof IExternalApiService, unknown>> = {},
  filterTemplateService: Partial<Record<keyof FilterTemplateService, unknown>> = {},
) {
  const statistiche = { registraStatistica: vi.fn(async () => undefined) };
  return new ExternalApiController(
    servizio as unknown as IExternalApiService,
    statistiche as unknown as StatisticheApiService,
    filterTemplateService as unknown as FilterTemplateService,
  );
}

function nomeProtezione(passo: unknown): string | undefined {
  if (passo === ephemeralTokenAuthMiddleware) return 'ephemeralTokenAuthMiddleware';
  if (passo === authMiddleware) return 'authMiddleware';
  const permesso = permessoDelGuardiano.get(passo);
  return permesso === undefined ? undefined : `permissionGuard(${permesso})`;
}

/** Solo le protezioni in testa alla catena: un middleware messo dopo il gestore non protegge niente. */
function protezioniIniziali(passi: PassoDellaRoute[]): string[] {
  const nomi: string[] = [];
  for (const passo of passi) {
    const nome = nomeProtezione(passo.handle);
    if (nome === undefined) break;
    nomi.push(nome);
  }
  return nomi;
}

function routeRegistrate(): Array<{ chiave: string; protezioni: string[] }> {
  const controller = creaController();
  controller.initializeRoutes();
  const { router, basePath } = controller as unknown as { router: { stack: StratoDelRouter[] }; basePath: string };
  const route: Array<{ chiave: string; protezioni: string[] }> = [];
  for (const strato of router.stack) {
    if (!strato.route) continue;
    for (const [metodo, attivo] of Object.entries(strato.route.methods)) {
      if (!attivo) continue;
      route.push({
        chiave: `${metodo.toUpperCase()} ${basePath}${strato.route.path}`,
        protezioni: protezioniIniziali(strato.route.stack),
      });
    }
  }
  return route;
}

describe('ExternalApiController: protezioni delle route', () => {
  it('ogni route registrata ha esattamente le protezioni della tabella', () => {
    const registrate = Object.fromEntries(routeRegistrate().map(({ chiave, protezioni }) => [chiave, protezioni]));

    expect(registrate).toEqual(ROUTE_ATTESE);
  });

  it('ogni metodo e percorso e\' registrato una sola volta', () => {
    const chiavi = routeRegistrate().map(({ chiave }) => chiave);
    const doppie = chiavi.filter((chiave, indice) => chiavi.indexOf(chiave) !== indice);

    expect(doppie).toEqual([]);
    expect(chiavi).toHaveLength(Object.keys(ROUTE_ATTESE).length);
  });

  it('solo /health risponde senza un middleware di autenticazione in testa', () => {
    const senza = routeRegistrate()
      .filter(({ protezioni }) => !MIDDLEWARE_DI_AUTENTICAZIONE.has(protezioni[0] ?? ''))
      .map(({ chiave }) => chiave);

    expect(senza).toEqual([`GET ${BASE}/health`]);
  });

  it('GET /filter-templates non si apre con un token effimero valido: serve la sessione', async () => {
    vi.mocked(ephemeralTokenService.validateToken).mockReset();
    vi.mocked(ephemeralTokenService.validateToken).mockResolvedValue({ valid: true, jti: 'j1', origin: 'https://volantino.test', scope: 'refs:read' });
    const filterTemplateService = { getAllForOrganization: vi.fn(async () => ({ templates: [], totale: 0 })) };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { session: object }).session = {};
      next();
    });
    creaController({}, filterTemplateService).registerRoutes(app);

    const res = await request(app)
      .get(`${BASE}/filter-templates`)
      .set({ 'X-Ephemeral-Token': 'token-effimero', 'X-Browser-Hash': 'impronta-browser' });

    expect(res.status).toBe(401);
    expect(ephemeralTokenService.validateToken).not.toHaveBeenCalled();
    expect(filterTemplateService.getAllForOrganization).not.toHaveBeenCalled();
  });
});

// ─── Credenziali delle API esterne del plugin ─────────────────────────────────

/** Chiave nel formato emesso da Fidelity: uuid-timestamp cifrato con FICO_SECRET. */
function chiaveApi(generataIl: number = Date.now()): string {
  const chiave = crypto.createHash('sha256').update(config.FICO_SECRET).digest();
  const cifratore = crypto.createCipheriv('aes-256-cbc', chiave, chiave.subarray(0, 16));
  return cifratore.update(`${crypto.randomUUID().replace(/-/g, '')}-${generataIl}`, 'utf8', 'hex') + cifratore.final('hex');
}

type RuoloTrovato = Awaited<ReturnType<typeof RuoloUtenteGDO.findOne>>;

/** Il ruolo cercato per hash della chiave: null quando la chiave non e' di nessun ruolo. */
function ruoloDellaChiave(ruolo: { id_ruolo_utente_gdo: string; ruolo_ruolo_utente_gdo: string } | null) {
  return vi.spyOn(RuoloUtenteGDO, 'findOne').mockResolvedValue(ruolo as unknown as RuoloTrovato);
}

const RUOLO_INTEGRAZIONE = { id_ruolo_utente_gdo: 'r1', ruolo_ruolo_utente_gdo: 'Integrazione' };

function esitoToken(esito: TokenValidationResultDTO) {
  vi.mocked(ephemeralTokenService.validateToken).mockResolvedValue(esito);
}

type RouteCampione = 'POST /refs' | 'GET /promo';
const ROUTE_CAMPIONE: RouteCampione[] = ['POST /refs', 'GET /promo'];

/** Controller vero con i middleware veri; dati e DB simulati. */
function creaApp() {
  const servizio = {
    getRefs: vi.fn(async () => ({ conteggio: 0, risposta: [] })),
    getPromoValide: vi.fn(async () => []),
  };
  const app = express();
  app.use(express.json());
  creaController(servizio).registerRoutes(app);
  return { app, servizio };
}

function chiama(app: Express, route: RouteCampione, intestazioni: Record<string, string> = {}) {
  if (route === 'POST /refs') {
    return request(app).post(`${BASE}/refs`).set(intestazioni).send({ template_id: ['t1'] });
  }
  return request(app).get(`${BASE}/promo`).set(intestazioni);
}

function letturaDati(servizio: ReturnType<typeof creaApp>['servizio'], route: RouteCampione) {
  return route === 'POST /refs' ? servizio.getRefs : servizio.getPromoValide;
}

describe('route a token effimero: credenziali (spec "Credenziali delle API esterne del plugin")', () => {
  beforeEach(() => {
    vi.mocked(ephemeralTokenService.validateToken).mockReset();
  });

  it.each(ROUTE_CAMPIONE)('%s senza credenziali risponde 401 e non legge i dati', async (route) => {
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, route);

    expect(res.status).toBe(401);
    expect(letturaDati(servizio, route)).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each(ROUTE_CAMPIONE)('%s con una chiave API valida di un ruolo risponde 200', async (route) => {
    const chiave = chiaveApi();
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, route, { 'x-api-key': chiave });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requestedBy).toBe('Integrazione');
    expect(findOne).toHaveBeenCalledWith({ where: { api_key_ruolo_utente_gdo: hashApiKey(chiave) } });
    expect(letturaDati(servizio, route)).toHaveBeenCalledOnce();
    expect(ephemeralTokenService.validateToken).not.toHaveBeenCalled();
  });

  it('la chiave API e\' accettata anche nell\'intestazione api-key', async () => {
    ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, 'GET /promo', { 'api-key': chiaveApi() });

    expect(res.status).toBe(200);
    expect(servizio.getPromoValide).toHaveBeenCalledOnce();
  });

  it.each(ROUTE_CAMPIONE)('%s con una chiave valida che non appartiene a nessun ruolo risponde 401', async (route) => {
    const findOne = ruoloDellaChiave(null);
    const { app, servizio } = creaApp();

    const res = await chiama(app, route, { 'x-api-key': chiaveApi() });

    expect(res.status).toBe(401);
    expect(findOne).toHaveBeenCalledOnce();
    expect(letturaDati(servizio, route)).not.toHaveBeenCalled();
  });

  it('una chiave generata da piu\' di un anno e\' rifiutata senza cercare il ruolo', async () => {
    const piuDiUnAnnoFa = Date.now() - 366 * 24 * 60 * 60 * 1000;
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, 'POST /refs', { 'x-api-key': chiaveApi(piuDiUnAnnoFa) });

    expect(res.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
    expect(servizio.getRefs).not.toHaveBeenCalled();
  });

  it('una chiave non cifrata con il segreto di Fidelity e\' rifiutata senza cercare il ruolo', async () => {
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, 'GET /promo', { 'x-api-key': crypto.randomUUID() });

    expect(res.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
    expect(servizio.getPromoValide).not.toHaveBeenCalled();
  });

  it.each(ROUTE_CAMPIONE)('%s con un token effimero valido risponde 200 senza chiave API', async (route) => {
    esitoToken({ valid: true, jti: 'j1', origin: 'https://volantino.test', scope: 'refs:read' });
    const findOne = ruoloDellaChiave(null);
    const { app, servizio } = creaApp();

    const res = await chiama(app, route, { 'X-Ephemeral-Token': 'token-effimero', 'X-Browser-Hash': 'impronta-browser' });

    expect(res.status).toBe(200);
    expect(ephemeralTokenService.validateToken).toHaveBeenCalledWith(
      'token-effimero', expect.any(String), 'impronta-browser', expect.any(String), expect.any(String),
    );
    expect(letturaDati(servizio, route)).toHaveBeenCalledOnce();
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each(ROUTE_CAMPIONE)('%s con token scaduto ripiega sulla chiave API valida e risponde 200', async (route) => {
    esitoToken({ valid: false, errorCode: EphemeralTokenErrorCode.TOKEN_EXPIRED, errorMessage: 'scaduto' });
    const chiave = chiaveApi();
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, route, {
      'X-Ephemeral-Token': 'token-scaduto',
      'X-Browser-Hash': 'impronta-browser',
      'x-api-key': chiave,
    });

    expect(res.status).toBe(200);
    expect(ephemeralTokenService.validateToken).toHaveBeenCalledOnce();
    expect(findOne).toHaveBeenCalledWith({ where: { api_key_ruolo_utente_gdo: hashApiKey(chiave) } });
    expect(letturaDati(servizio, route)).toHaveBeenCalledOnce();
  });

  it('token non valido (TOKEN_INVALID) senza chiave API: 401 e nessun dato', async () => {
    esitoToken({ valid: false, errorCode: EphemeralTokenErrorCode.TOKEN_INVALID, errorMessage: 'non valido' });
    ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, 'POST /refs', { 'X-Ephemeral-Token': 'token-falso', 'X-Browser-Hash': 'impronta-browser' });

    expect(res.status).toBe(401);
    expect(servizio.getRefs).not.toHaveBeenCalled();
  });

  it('token senza impronta del browser: non viene validato e decide la chiave API', async () => {
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, 'GET /promo', { 'X-Ephemeral-Token': 'token-effimero', 'x-api-key': chiaveApi() });

    expect(res.status).toBe(200);
    expect(ephemeralTokenService.validateToken).not.toHaveBeenCalled();
    expect(findOne).toHaveBeenCalledOnce();
    expect(servizio.getPromoValide).toHaveBeenCalledOnce();
  });

  it.each([
    EphemeralTokenErrorCode.FINGERPRINT_MISMATCH,
    EphemeralTokenErrorCode.ORIGIN_MISMATCH,
    EphemeralTokenErrorCode.TOKEN_REVOKED,
  ])('token rifiutato per %s: 401 anche con una chiave API valida, che non viene consultata', async (codice) => {
    esitoToken({ valid: false, errorCode: codice, errorMessage: 'rifiutato' });
    const findOne = ruoloDellaChiave(RUOLO_INTEGRAZIONE);
    const { app, servizio } = creaApp();

    const res = await chiama(app, 'POST /refs', {
      'X-Ephemeral-Token': 'token-rubato',
      'X-Browser-Hash': 'altra-impronta',
      'x-api-key': chiaveApi(),
    });

    expect(res.status).toBe(401);
    expect(res.body.details).toEqual({ errorCode: codice });
    expect(findOne).not.toHaveBeenCalled();
    expect(servizio.getRefs).not.toHaveBeenCalled();
  });
});
