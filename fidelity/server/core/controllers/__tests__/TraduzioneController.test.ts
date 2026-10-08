import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { TraduzioneController } from '../TraduzioneController';

const app = express();
new TraduzioneController({} as any).registerRoutes(app);

describe('GET /api/t', () => {
  it('restituisce le traduzioni di una lingua esistente', async () => {
    const res = await request(app).get('/api/t').query({ lng: 'it-IT', ns: 'translation' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).length).toBeGreaterThan(0);
  });

  it.each([
    { lng: '..', ns: 'package' },
    { lng: 'it-IT', ns: '../../../package' },
    { lng: '../../server', ns: 'tsconfig' },
    { lng: 'it-IT', ns: 'translation.json' }
  ])('rifiuta lng=$lng ns=$ns senza leggere file fuori da public/locales', async (query) => {
    const res = await request(app).get('/api/t').query(query);

    expect(res.status).toBe(400);
  });
});
