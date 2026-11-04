import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.session = { id_utente: 'u-operatore' } as Request['session'];
    next();
  },
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/AllineamentoIstanta', () => ({
  prenotaTracciato: vi.fn(),
  inviaPrenotata: vi.fn(),
  aggiornaContestoInAttesa: vi.fn(),
}));

import type { ITracciatoService } from '../../interfaces/ITracciatoService';
import { TracciatiInvioIstanta } from '../../models/tracciati_invio_istanta';
import { aggiornaContestoInAttesa, inviaPrenotata, prenotaTracciato } from '../../services/AllineamentoIstanta';
import { AuditLogService } from '../../services/AuditLogService';
import { TracciatoController } from '../TracciatoController';

// "Rimanda a Istanta" e modifica del contesto dei tracciati salvati in FP e non ancora in Istanta
// (TASK-3dfe3302).

function creaApp() {
  const app = express();
  app.use(express.json());
  new TracciatoController({} as ITracciatoService).registerRoutes(app);
  return app;
}

const PRENOTATA = { id_tracciato: 't1', id_utente: 'u-caricato', tentativi: 2 };

beforeEach(() => {
  vi.mocked(prenotaTracciato).mockReset();
  vi.mocked(inviaPrenotata).mockReset();
  vi.mocked(aggiornaContestoInAttesa).mockReset();
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ entityChanged: vi.fn() } as unknown as AuditLogService);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/tracciati/:id/rimanda-istanta', () => {
  it('invia subito il tracciato in coda e risponde con l esito', async () => {
    vi.mocked(prenotaTracciato).mockResolvedValue(PRENOTATA);
    vi.mocked(inviaPrenotata).mockResolvedValue({ esito: 'errore', motivo: 'label non valida', tentativi: 3 });

    const res = await request(creaApp()).post('/api/tracciati/t1/rimanda-istanta');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ esito: 'errore', motivo: 'label non valida', tentativi: 3 });
    // Il passaporto e' di chi ha premuto il pulsante
    const [prenotata, richiesta] = vi.mocked(inviaPrenotata).mock.calls[0];
    expect(prenotata).toEqual(PRENOTATA);
    expect((richiesta as Request).session.id_utente).toBe('u-operatore');
  });

  it.each([
    ['ancora in coda: si sta gia inviando', { id_tracciato: 't1' }, /si sta gia/],
    ['non in coda: e gia in Istanta', null, /gia' in Istanta/],
  ])('nessuna prenotazione, %s: 409', async (_caso, inCoda, messaggio) => {
    vi.mocked(prenotaTracciato).mockResolvedValue(null);
    vi.spyOn(TracciatiInvioIstanta, 'findByPk').mockResolvedValue(inCoda as never);

    const res = await request(creaApp()).post('/api/tracciati/t1/rimanda-istanta');

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(messaggio);
    expect(inviaPrenotata).not.toHaveBeenCalled();
  });
});

describe('PUT /api/tracciati/:id/contesto', () => {
  const CONTESTO = [{ nome_field: 'idLabel', user_value: 'main' }];

  it('aggiorna il contesto del tracciato in attesa', async () => {
    vi.mocked(aggiornaContestoInAttesa).mockResolvedValue('aggiornato');

    const res = await request(creaApp()).put('/api/tracciati/t1/contesto').send({ context: CONTESTO });

    expect(res.status).toBe(200);
    expect(aggiornaContestoInAttesa).toHaveBeenCalledWith('t1', CONTESTO);
  });

  it.each([
    ['gia in Istanta', 'inviato', 409],
    ['che si sta inviando', 'in_invio', 409],
    ['inesistente', 'inesistente', 404],
  ] as const)('tracciato %s: %i', async (_caso, esito, status) => {
    vi.mocked(aggiornaContestoInAttesa).mockResolvedValue(esito);

    const res = await request(creaApp()).put('/api/tracciati/t1/contesto').send({ context: CONTESTO });

    expect(res.status).toBe(status);
  });

  it.each([
    ['senza contesto', {}],
    ['con una label oltre 40 caratteri', { context: [{ nome_field: 'idLabel', user_value: 'x'.repeat(41) }] }],
  ])('%s: 400 senza toccare il tracciato', async (_caso, corpo) => {
    const res = await request(creaApp()).put('/api/tracciati/t1/contesto').send(corpo);

    expect(res.status).toBe(400);
    expect(aggiornaContestoInAttesa).not.toHaveBeenCalled();
  });
});
