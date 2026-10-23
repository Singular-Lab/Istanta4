import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));
// Permessi dalla sessione: il Superadmin ha i permessi di sistema, gli altri no.
vi.mock('../../accessi/contestoAccesso', () => ({
  leggiContestoAccesso: async (req: any) => ({
    idUtente: req.session.id_utente,
    tipo: req.session.tipo_utente,
    idGdo: null,
    idRuoloGdo: null,
    superadmin: req.session.tipo_utente === 'Superadmin',
  }),
}));
vi.mock('../../accessi/RisolutoreAccessi', () => ({
  RisolutoreAccessi: { get: () => ({ puo: async (contesto: any) => contesto.superadmin }) },
}));
const audit = vi.hoisted(() => ({
  accessDenied: vi.fn(),
  configurationChanged: vi.fn(),
  loginSuccess: vi.fn(),
}));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => audit },
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { UnauthorizedError } from '../../../../lib/errors';
import { errorHandler } from '../../middleware/errorHandler';
import { MetodiAccessoController } from '../MetodiAccessoController';

function sessione(dati: Record<string, unknown>) {
  const s: any = { ...dati };
  s.regenerate = (cb: (e?: unknown) => void) => {
    for (const k of Object.keys(s)) if (typeof s[k] !== 'function') delete s[k];
    cb();
  };
  s.save = (cb: (e?: unknown) => void) => cb();
  return s;
}

function providerSaml(extra: Record<string, unknown> = {}) {
  return {
    id: 'p-saml',
    codice: 'adfs',
    nome: 'ADFS',
    tipo: 'saml',
    attivo: true,
    config_client: null,
    config_server: { entry_point: 'https://idp.example.test/sso', domini_ammessi: ['esempio.it'] },
    ruoli_ammessi: null,
    ...extra,
  };
}

function createApp(tipo: TIPO_UTENTI | null = TIPO_UTENTI.SUPERADMIN, overrides: Record<string, any> = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const sess = sessione(tipo ? { id_utente: 'u1', tipo_utente: tipo } : {});
  app.use((req, _res, next) => {
    (req as any).session = sess;
    next();
  });

  const authProviderService = {
    getAllProvidersAdmin: vi.fn().mockResolvedValue([{ id: 'p1', codice: 'email_password', segreti: {} }]),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    deleteProvider: vi.fn(),
    riordinaProviders: vi.fn(),
    migraSegreti: vi.fn(),
    importaDiscoveryOidc: vi.fn(),
    importaMetadatiSaml: vi.fn(),
    verificaProvider: vi.fn(),
    ...overrides.authProviderService,
  };
  const samlService = {
    getAuthorizeUrl: vi.fn().mockResolvedValue('https://idp.example.test/sso?SAMLRequest=x'),
    validaRisposta: vi.fn().mockResolvedValue({ sub: 'n1', email: 'mario@esempio.it' }),
    generaMetadati: vi.fn().mockReturnValue('<EntityDescriptor/>'),
    leggiMetadatiIdp: vi.fn(),
    ...overrides.samlService,
  };
  const repository = { findByCode: vi.fn().mockResolvedValue(overrides.provider ?? providerSaml()) };
  const userService = { verificaAccountAttivo: vi.fn().mockResolvedValue(undefined) };
  const agenziaLib = {
    parseUtenteOIDC: vi.fn().mockResolvedValue({ id: 'u-42', email: 'mario@esempio.it', tipo_utente: TIPO_UTENTI.GDO, id_gdo: 'g1' }),
    ...overrides.agenziaLib,
  };

  new MetodiAccessoController(
    authProviderService as any,
    samlService as any,
    repository as any,
    userService as any,
    agenziaLib as any,
  ).registerRoutes(app);
  app.use(errorHandler({ includeStackTrace: false, logger: () => undefined }));
  return { app, sess, authProviderService, samlService, agenziaLib, userService };
}

describe('MetodiAccessoController - gestione', () => {
  it('il Superadmin vede l\'elenco completo dei metodi', async () => {
    const { app, authProviderService } = createApp();

    const res = await request(app).get('/api/auth-providers/admin');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'p1', codice: 'email_password', segreti: {} }]);
    expect(authProviderService.getAllProvidersAdmin).toHaveBeenCalled();
  });

  it.each([
    ['get', '/api/auth-providers/admin'],
    ['post', '/api/auth-providers'],
    ['put', '/api/auth-providers/p1'],
    ['delete', '/api/auth-providers/p1'],
    ['post', '/api/auth-providers/riordina'],
    ['post', '/api/auth-providers/segreti/migra'],
    ['post', '/api/auth-providers/p1/verifica'],
  ] as const)('un utente Agenzia riceve accesso negato su %s %s', async (metodo, url) => {
    const { app, authProviderService } = createApp(TIPO_UTENTI.AGENZIA);

    const res = await request(app)[metodo](url).send({});

    expect(res.status).toBe(403);
    expect(authProviderService.getAllProvidersAdmin).not.toHaveBeenCalled();
    expect(authProviderService.updateProvider).not.toHaveBeenCalled();
  });

  it('registra la modifica nell\'audit senza il valore dei segreti', async () => {
    const { app } = createApp(TIPO_UTENTI.SUPERADMIN, {
      authProviderService: {
        updateProvider: vi.fn().mockResolvedValue({ codice: 'entra_id', attivo: true, segreti: { client_secret: 'cifrato' } }),
      },
    });

    const res = await request(app).put('/api/auth-providers/p1').send({ nome: 'Entra', config_server: { client_secret: 'nuovo-segreto' } });

    expect(res.status).toBe(200);
    const dettagli = audit.configurationChanged.mock.calls.at(-1)?.[3];
    expect(dettagli).toMatchObject({ codice: 'entra_id', segreti_modificati: ['client_secret'] });
    expect(JSON.stringify(dettagli)).not.toContain('nuovo-segreto');
  });

  it('dalla pagina cifra soltanto: la decifratura resta allo script', async () => {
    const migraSegreti = vi.fn().mockResolvedValue({ modalita: 'cifra', simulazione: false, provider: [], totaleCampi: 0 });
    const { app } = createApp(TIPO_UTENTI.SUPERADMIN, { authProviderService: { migraSegreti } });

    await request(app).post('/api/auth-providers/segreti/migra').send({ modalita: 'decifra' });

    expect(migraSegreti).toHaveBeenCalledWith('cifra', false);
  });
});

describe('MetodiAccessoController - accesso SAML', () => {
  it('apre la sessione e porta all\'hub con una risposta valida', async () => {
    const { app, sess, userService } = createApp(null);

    const res = await request(app).post('/api/auth/saml/acs/adfs').type('form').send({ SAMLResponse: 'abc', RelayState: 'adfs' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/hub');
    expect(userService.verificaAccountAttivo).toHaveBeenCalledWith('u-42');
    expect(sess).toMatchObject({ id_utente: 'u-42', tipo_utente: TIPO_UTENTI.GDO, isExternalAuth: true });
  });

  it('non apre la sessione con una risposta non valida', async () => {
    const { app, sess } = createApp(null, {
      samlService: { validaRisposta: vi.fn().mockRejectedValue(new UnauthorizedError({ message: 'Risposta SAML non valida: firma' })) },
    });

    const res = await request(app).post('/api/auth/saml/acs/adfs').type('form').send({ SAMLResponse: 'abc' });

    expect(res.headers.location).toMatch(/^\/login\?reason=saml_access_denied/);
    expect(sess.id_utente).toBeUndefined();
  });

  it('rifiuta un dominio email non ammesso dal metodo', async () => {
    const { app, sess } = createApp(null, {
      samlService: { validaRisposta: vi.fn().mockResolvedValue({ sub: 'n1', email: 'mario@altro.it' }) },
      agenziaLib: { parseUtenteOIDC: vi.fn().mockResolvedValue({ id: 'u-9', email: 'mario@altro.it', tipo_utente: TIPO_UTENTI.GDO }) },
    });

    const res = await request(app).post('/api/auth/saml/acs/adfs').type('form').send({ SAMLResponse: 'abc' });

    expect(res.headers.location).toMatch(/^\/login\?reason=saml_access_denied&message=.*altro\.it/);
    expect(sess.id_utente).toBeUndefined();
  });

  it('non avvia l\'accesso con un metodo SAML disattivato', async () => {
    const { app, samlService } = createApp(null, { provider: providerSaml({ attivo: false }) });

    const res = await request(app).get('/api/auth/saml/authorize/adfs');

    expect(res.status).toBe(404);
    expect(samlService.getAuthorizeUrl).not.toHaveBeenCalled();
  });

  it('pubblica i metadati del service provider', async () => {
    const { app } = createApp(null);

    const res = await request(app).get('/api/auth/saml/metadata/adfs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/samlmetadata+xml');
    expect(res.text).toBe('<EntityDescriptor/>');
  });
});
