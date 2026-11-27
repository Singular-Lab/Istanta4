import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../src/shared/cache/redis.client', () => ({ getRedisClient: () => null }));

import { DepositoInMemoria, idempotenza, type RispostaSalvata } from '../idempotenza';

// Spec interfaccia-operatore, "Richieste di creazione, modifica ed eliminazione ripetute": la stessa
// richiesta ripetuta si esegue una volta sola e tutte le copie ricevono l'esito della prima.

interface Prova {
  app: express.Express;
  esecuzioni: { conta: number };
  deposito: DepositoInMemoria;
}

function applicazione(opzioni: { utente?: (req: express.Request) => string; ritardoMs?: number; stato?: (n: number) => number } = {}): Prova {
  const esecuzioni = { conta: 0 };
  const deposito = new DepositoInMemoria();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: { id_utente: string } }).session = { id_utente: opzioni.utente?.(req) ?? 'utente-1' };
    next();
  });
  app.use(idempotenza(deposito));
  const gestore = async (req: express.Request, res: express.Response) => {
    esecuzioni.conta += 1;
    const numero = esecuzioni.conta;
    if (opzioni.ritardoMs) await new Promise(resolve => setTimeout(resolve, opzioni.ritardoMs));
    res.status(opzioni.stato?.(numero) ?? 201).json({ creato: numero, nome: req.body?.nome ?? null });
  };
  app.post('/api/aree', gestore);
  app.delete('/api/aree/:id', async (_req, res) => {
    esecuzioni.conta += 1;
    if (esecuzioni.conta > 1) { res.status(404).json({ errore: 'non trovata' }); return; }
    res.status(200).json({ eliminata: true });
  });
  app.post('/api/scarica', (_req, res) => {
    esecuzioni.conta += 1;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=a.pdf');
    res.send(Buffer.from('pdf'));
  });
  return { app, esecuzioni, deposito };
}

const CHIAVE = 'chiave-0123456789';

describe('idempotenza', () => {
  it('la stessa richiesta ripetuta dopo la prima riceve la risposta salvata e non si riesegue', async () => {
    const { app, esecuzioni } = applicazione();

    const prima = await request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });
    const seconda = await request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });

    expect(esecuzioni.conta).toBe(1);
    expect(prima.status).toBe(201);
    expect(seconda.status).toBe(201);
    expect(seconda.body).toEqual(prima.body);
    expect(seconda.headers['idempotent-replay']).toBe('true');
    expect(prima.headers['idempotent-replay']).toBeUndefined();
  });

  it('due richieste insieme con la stessa chiave: il gestore gira una volta e entrambe ricevono lo stesso esito', async () => {
    const { app, esecuzioni } = applicazione({ ritardoMs: 80 });

    const [a, b] = await Promise.all([
      request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' }),
      request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' }),
    ]);

    expect(esecuzioni.conta).toBe(1);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body).toEqual(a.body);
  });

  it('il doppio click sull\'eliminazione non da\' l\'errore "non trovata" alla seconda richiesta', async () => {
    const { app } = applicazione({ ritardoMs: 0 });

    const prima = await request(app).delete('/api/aree/3').set('Idempotency-Key', CHIAVE);
    const seconda = await request(app).delete('/api/aree/3').set('Idempotency-Key', CHIAVE);

    expect(prima.status).toBe(200);
    expect(seconda.status).toBe(200);
    expect(seconda.body).toEqual({ eliminata: true });
  });

  it('un errore non viene salvato: il nuovo tentativo con la stessa chiave si esegue', async () => {
    const { app, esecuzioni } = applicazione({ stato: n => (n === 1 ? 500 : 201) });

    const prima = await request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });
    const seconda = await request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });

    expect(prima.status).toBe(500);
    expect(seconda.status).toBe(201);
    expect(esecuzioni.conta).toBe(2);
  });

  it('utenti diversi con la stessa chiave non si mescolano', async () => {
    const { app, esecuzioni } = applicazione({ utente: req => String(req.get('x-utente')) });

    const a = await request(app).post('/api/aree').set('x-utente', 'a').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });
    const b = await request(app).post('/api/aree').set('x-utente', 'b').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });

    expect(esecuzioni.conta).toBe(2);
    expect(b.body.creato).not.toBe(a.body.creato);
  });

  it('la stessa chiave con un altro contenuto e\' un\'altra richiesta', async () => {
    const { app, esecuzioni } = applicazione();

    await request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Nord' });
    const altra = await request(app).post('/api/aree').set('Idempotency-Key', CHIAVE).send({ nome: 'Sud' });

    expect(esecuzioni.conta).toBe(2);
    expect(altra.body.nome).toBe('Sud');
  });

  it('senza chiave, o con una chiave non valida, la richiesta si esegue sempre', async () => {
    const { app, esecuzioni } = applicazione();

    await request(app).post('/api/aree').send({ nome: 'Nord' });
    await request(app).post('/api/aree').send({ nome: 'Nord' });
    await request(app).post('/api/aree').set('Idempotency-Key', 'corta').send({ nome: 'Nord' });
    await request(app).post('/api/aree').set('Idempotency-Key', 'corta').send({ nome: 'Nord' });

    expect(esecuzioni.conta).toBe(4);
  });

  it('le letture non sono toccate', async () => {
    const { app, esecuzioni } = applicazione();
    app.get('/api/aree', (_req, res) => { esecuzioni.conta += 1; res.json([]); });

    await request(app).get('/api/aree').set('Idempotency-Key', CHIAVE);
    await request(app).get('/api/aree').set('Idempotency-Key', CHIAVE);

    expect(esecuzioni.conta).toBe(2);
  });

  it('un file scaricato non si salva: la ripetizione si esegue', async () => {
    const { app, esecuzioni } = applicazione();

    await request(app).post('/api/scarica').set('Idempotency-Key', CHIAVE).send({});
    await request(app).post('/api/scarica').set('Idempotency-Key', CHIAVE).send({});

    expect(esecuzioni.conta).toBe(2);
  });
});

describe('DepositoInMemoria', () => {
  const risposta: RispostaSalvata = { stato: 201, tipo: 'application/json', corpo: '{}' };

  it('una voce scaduta non si legge', async () => {
    let ora = 0;
    const deposito = new DepositoInMemoria(() => ora);

    await deposito.salva('k', risposta, 10);
    expect(await deposito.leggi('k')).toEqual(risposta);
    ora = 10_001;
    expect(await deposito.leggi('k')).toBeNull();
  });

  it('oltre il massimo toglie le voci piu\' vecchie', async () => {
    const deposito = new DepositoInMemoria(() => 0, 2);

    await deposito.salva('a', risposta, 100);
    await deposito.salva('b', risposta, 100);
    await deposito.salva('c', risposta, 100);

    expect(await deposito.leggi('a')).toBeNull();
    expect(await deposito.leggi('c')).toEqual(risposta);
  });
});
