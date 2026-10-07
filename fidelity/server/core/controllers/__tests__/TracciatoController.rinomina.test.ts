import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ITracciatiRepository } from '../../repositories/TracciatiRepository';
import { TracciatoService } from '../../services/TracciatoService';
import { TracciatoController } from '../TracciatoController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * I20-957: il nome mostrato in FP si cambia senza toccare il file del marketing,
 * che resta col suo nome originale (filename) anche al download.
 */
function createApp(righe: Record<string, any>) {
  // Repository in memoria: controller e service sono quelli reali
  const repository = {
    findById: vi.fn(async (id: string) => righe[id] ?? null),
    update: vi.fn(async (id: string, valori: any) => {
      if (!righe[id]) return null;
      righe[id] = { ...righe[id], ...valori };
      return righe[id];
    }),
  };

  const app = express();
  app.use(express.json());
  new TracciatoController(new TracciatoService(repository as unknown as ITracciatiRepository)).registerRoutes(app);
  return { app, repository };
}

const tracciatoUfi = (extra: Record<string, unknown> = {}) => ({
  id_tracciati: 't1',
  id_promo_tracciati: 'promo-1',
  context_tracciati: [],
  filename_tracciati: 'ufi.xlsx',
  nome_tracciati: null,
  blobfile_tracciati: Buffer.from('contenuto-marketing'),
  ...extra,
});

describe('PUT /api/tracciati/:idTracciato/nome', () => {
  it('rinomina il tracciato mantenendo nome originale e contenuto del file', async () => {
    const righe = { t1: tracciatoUfi() };
    const { app } = createApp(righe);

    const res = await request(app)
      .put('/api/tracciati/t1/nome')
      .send({ nome: '  UFI volantino ottobre 2026  ' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('UFI volantino ottobre 2026');
    expect(res.body.filename).toBe('ufi.xlsx');
    expect(res.body.blobfile).toBeUndefined();
    expect(righe.t1.filename_tracciati).toBe('ufi.xlsx');
    expect(Buffer.from(righe.t1.blobfile_tracciati).toString()).toBe('contenuto-marketing');
  });

  it('un tracciato mai rinominato mostra il nome originale del file', async () => {
    const { app } = createApp({ t1: tracciatoUfi() });

    const res = await request(app).get('/api/tracciati/t1');

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('ufi.xlsx');
  });

  it('rifiuta un nome vuoto o troppo lungo lasciando invariato il nome', async () => {
    const righe = { t1: tracciatoUfi({ nome_tracciati: 'UFI volantino' }) };
    const { app, repository } = createApp(righe);

    for (const nome of ['   ', 'x'.repeat(256)]) {
      const res = await request(app).put('/api/tracciati/t1/nome').send({ nome });
      expect(res.status).toBe(400);
    }

    expect(repository.update).not.toHaveBeenCalled();
    expect(righe.t1.nome_tracciati).toBe('UFI volantino');
  });

  it('risponde 404 se il tracciato non esiste', async () => {
    const { app } = createApp({});

    const res = await request(app).put('/api/tracciati/inesistente/nome').send({ nome: 'UFI' });

    expect(res.status).toBe(404);
  });
});
