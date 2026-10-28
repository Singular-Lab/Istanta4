import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/ephemeralTokenAuthMiddleware', () => ({
  ephemeralTokenAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../di', () => ({ TYPES: {}, container: { get: vi.fn() } }));

import crypto from 'node:crypto';
import { verifyApiKey } from '../../middleware/apiKeyAuth';
import { UtentiGDO } from '../../models';
import { RuoloUtenteGDO } from '../../models/ruolo_gdo';
import { ExternalApiService } from '../../services/ExternalApiService';
import { ExternalApiController } from '../ExternalApiController';

const sha256 = (testo: string) => crypto.createHash('sha256').update(testo, 'utf8').digest('hex');

/** Controller con il servizio vero: il ruolo dell'utente sta in memoria al posto della tabella. */
function createAppConServizio(iniziale: { api_key_ruolo_utente_gdo?: string | null; updatedat?: Date | null } = {}) {
  const ruolo: Record<string, unknown> = { id_ruolo_utente_gdo: 'r1', ruolo_ruolo_utente_gdo: 'Integrazione', ...iniziale };
  vi.spyOn(UtentiGDO, 'findOne').mockResolvedValue({ id_utente_utentegdo: 'u-sessione', id_ruolo_utente_gdo: 'r1' } as any);
  vi.spyOn(RuoloUtenteGDO, 'findOne').mockImplementation((async () => ({ ...ruolo })) as any);
  vi.spyOn(RuoloUtenteGDO, 'update').mockImplementation((async (valori: Record<string, unknown>) => {
    Object.assign(ruolo, valori);
    return [1];
  }) as any);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u-sessione' }; next(); });
  new ExternalApiController(new ExternalApiService(), {} as any, {} as any).registerRoutes(app);
  return { app, ruolo };
}

function createApp() {
  const externalApiService = { generateApiKey: vi.fn(async () => ({ apiKey: 'k1' })) };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u-sessione' }; next(); });
  new ExternalApiController(externalApiService as any, {} as any, {} as any).registerRoutes(app);
  return { app, externalApiService };
}

describe('POST /api/external/generate-api-key', () => {
  it('rigenera la chiave del ruolo dell\'utente della sessione', async () => {
    const { app, externalApiService } = createApp();

    await request(app).post('/api/external/generate-api-key').send({}).expect(200);

    expect(externalApiService.generateApiKey).toHaveBeenCalledWith('u-sessione');
  });

  it('ignora un id_utente diverso indicato nella richiesta', async () => {
    const { app, externalApiService } = createApp();

    await request(app).post('/api/external/generate-api-key').send({ id_utente: 'u-altra-gdo' }).expect(200);

    expect(externalApiService.generateApiKey).toHaveBeenCalledWith('u-sessione');
    expect(externalApiService.generateApiKey).not.toHaveBeenCalledWith('u-altra-gdo');
  });
});

describe('chiave API a riposo', () => {
  it('la generazione restituisce la chiave una volta e nel ruolo salva solo il suo sha256', async () => {
    const { app, ruolo } = createAppConServizio();

    const res = await request(app).post('/api/external/generate-api-key').send({}).expect(200);

    const chiave: string = res.body.apiKey.apiKey;
    expect(res.body.success).toBe(true);
    // Stessa chiave di prima: le integrazioni e verifyApiKey non cambiano
    expect(chiave).toMatch(/^[0-9a-f]{160}$/);
    expect(verifyApiKey(chiave)).toBe(true);
    expect(ruolo.api_key_ruolo_utente_gdo).toBe(sha256(chiave));
    expect(ruolo.api_key_ruolo_utente_gdo).not.toBe(chiave);
  });

  it('get_api_key dice solo se la chiave c\'e\' e quando e\' stata generata', async () => {
    const generataIl = new Date('2026-10-01T08:30:00.000Z');
    const { app } = createAppConServizio({ api_key_ruolo_utente_gdo: sha256('chiave-segreta'), updatedat: generataIl });

    const res = await request(app).get('/api/external/get_api_key').expect(200);

    expect(res.body).toEqual({ configurata: true, generataIl: generataIl.toISOString() });
    expect(JSON.stringify(res.body)).not.toContain(sha256('chiave-segreta'));
  });

  it('get_api_key non espone la chiave appena generata', async () => {
    const { app } = createAppConServizio();
    const generata = await request(app).post('/api/external/generate-api-key').send({}).expect(200);
    const chiave: string = generata.body.apiKey.apiKey;

    const res = await request(app).get('/api/external/get_api_key').expect(200);

    expect(res.body.configurata).toBe(true);
    expect(typeof res.body.generataIl).toBe('string');
    expect(JSON.stringify(res.body)).not.toContain(chiave);
    expect(JSON.stringify(res.body)).not.toContain(sha256(chiave));
  });

  it('senza chiave get_api_key risponde che non e\' configurata, non con un errore', async () => {
    const { app } = createAppConServizio({ api_key_ruolo_utente_gdo: null });

    const res = await request(app).get('/api/external/get_api_key').expect(200);

    expect(res.body).toEqual({ configurata: false, generataIl: null });
  });
});
