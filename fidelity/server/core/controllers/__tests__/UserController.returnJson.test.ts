import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserController } from '../UserController';

describe('PUT /api/return_json', () => {
  it('non esiste piu: non si puo far cifrare dati arbitrari con FICO_SECRET', async () => {
    const app = express();
    app.use(express.json());
    new UserController({} as any, {} as any, {} as any, {} as any).registerRoutes(app);

    const res = await request(app)
      .put('/api/return_json')
      .send({ data: { email: 'admin@example.com', timestamp: '2099-01-01T00:00:00Z' } });

    expect(res.status).toBe(404);
  });
});
