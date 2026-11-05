import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITracciatoService } from '../../interfaces/ITracciatoService';

// Momenti, confronti e schemi dei tracciati: consultarli chiede le promozioni (o il Report
// tracciati per i risultati), gestirli le azioni dell'area Promozioni.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codici: string | string[]) => (_req: Request, res: Response, next: NextFunction) => {
    const elenco = Array.isArray(codici) ? codici : [codici];
    if (elenco.some(codice => permessi.concessi.has(codice))) {
      next();
      return;
    }
    res.status(403).json({ codici: elenco });
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { TracciatoController } from '../TracciatoController';

// Ogni metodo del servizio risponde vuoto: qui contano solo i permessi
const servizio = () => new Proxy({}, { get: () => vi.fn(async () => []) }) as unknown as ITracciatoService;

const creaApp = () => {
  const app = express();
  app.use(express.json());
  new TracciatoController(servizio()).registerRoutes(app);
  return app;
};

beforeEach(() => {
  permessi.concessi = new Set();
});

describe('permessi dei tracciati, dei momenti e degli schemi', () => {
  it('consultare i momenti chiede le promozioni oppure il Report tracciati', async () => {
    expect((await request(creaApp()).get('/api/tracciati/momenti/promo/p1')).status).toBe(403);

    permessi.concessi = new Set(['analisi.visualizza']);
    expect((await request(creaApp()).get('/api/tracciati/momenti/promo/p1')).status).not.toBe(403);

    permessi.concessi = new Set(['promo.visualizza']);
    expect((await request(creaApp()).get('/api/tracciati/momenti/promo/p1')).status).not.toBe(403);
  });

  it('creare un momento o calcolarne il risultato chiede promo.gestisci_momenti, non basta consultare', async () => {
    permessi.concessi = new Set(['promo.visualizza', 'analisi.visualizza']);
    const app = creaApp();

    const creazione = await request(app).post('/api/tracciati/momenti').send({ id_promo: 'p1', nome: 'Momento' });
    const risultato = await request(app).post('/api/tracciati/momenti/m1/risultato').send({});

    expect([creazione.status, creazione.body.codici]).toEqual([403, ['promo.gestisci_momenti']]);
    expect([risultato.status, risultato.body.codici]).toEqual([403, ['promo.gestisci_momenti']]);
  });

  it('gli schemi si leggono con le promozioni e si applicano con promo.gestisci_schemi', async () => {
    permessi.concessi = new Set(['promo.visualizza']);
    const app = creaApp();

    expect((await request(app).get('/api/tracciati/schemi')).status).not.toBe(403);
    const applica = await request(app).post('/api/tracciati/schemi/s1/applica').send({ idPromo: 'p1' });
    expect([applica.status, applica.body.codici]).toEqual([403, ['promo.gestisci_schemi']]);
  });

  it('il download di un tracciato chiede le promozioni; l\'elenco letto da DB1 resta senza sessione', async () => {
    const app = creaApp();

    expect((await request(app).get('/api/tracciati/t1/download')).status).toBe(403);
    expect((await request(app).get('/api/tracciati/promo/p1')).status).not.toBe(403);
  });
});
