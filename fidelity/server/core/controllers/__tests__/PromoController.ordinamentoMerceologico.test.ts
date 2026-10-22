import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
  integrationAuthMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// Senza il permesso la risposta dice quale permesso la route ha chiesto
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: any, res: any, next: any) =>
    permessi.concessi.has(codice) ? next() : res.status(403).json({ codice }),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { PromoController } from '../PromoController';

const ordinamento = {
  universale: true,
  campi: { area: 'settore', settore: 'reparto', reparto: 'categoria', categoria: '' },
  voci: [{ area: 'freschissimi', settore: 'ortofrutta', reparto: 'mele', categoria: '', orderIndex: 1 }],
};

function createApp() {
  const ordinamentoService = { getOrdinamento: vi.fn().mockResolvedValue(ordinamento) };
  const app = express();
  app.use(express.json());
  new PromoController({} as any, {} as any, {} as any, ordinamentoService as any).registerRoutes(app);
  return { app, ordinamentoService };
}

describe('GET /api/ordinamento-merceologico', () => {
  it('restituisce l\'ordinamento letto da Istanta', async () => {
    permessi.concessi = new Set(['promo.visualizza']);
    const { app, ordinamentoService } = createApp();

    const risposta = await request(app).get('/api/ordinamento-merceologico');

    expect(risposta.status).toBe(200);
    expect(JSON.stringify(risposta.body)).toContain('"orderIndex":1');
    expect(ordinamentoService.getOrdinamento).toHaveBeenCalledTimes(1);
  });

  it('chiede il permesso promo.visualizza', async () => {
    permessi.concessi = new Set();
    const { app, ordinamentoService } = createApp();

    const risposta = await request(app).get('/api/ordinamento-merceologico');

    expect(risposta.status).toBe(403);
    expect(risposta.body).toEqual({ codice: 'promo.visualizza' });
    expect(ordinamentoService.getOrdinamento).not.toHaveBeenCalled();
  });
});
