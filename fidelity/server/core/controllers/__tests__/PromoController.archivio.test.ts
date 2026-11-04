import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../../../lib/errors';
import type { IGdoService } from '../../interfaces/IGdoService';
import type { IImpostazioniService } from '../../interfaces/IImpostazioniService';
import type { IPromoService } from '../../interfaces/IPromoService';
import { AuditLogService } from '../../services/AuditLogService';
import { ServerUtils } from '../../utils/ServerUtils';
import { PromoController } from '../PromoController';

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
const agenzia = vi.hoisted(() => ({ valore: { supportaImportStorico: true } as { supportaImportStorico?: boolean } }));
vi.mock('../../di', () => ({
  TYPES: { AgenziaLib: 'AgenziaLib' },
  container: { get: () => agenzia.valore },
}));

// POST /api/promo/archivio e /api/promo/contesto-importazione/archivio (TASK-3dfe3302): promo e
// contesti dell'archivio storico in blocco, solo dove c'e' l'import da storico.

const nuova = (titolo: string) => ({ titolo, dataDiInizio: '07/01/2021', dataDiFine: '16/01/2021', dataDiScadenza: '06/01/2021', offsetVisibilita: 5, context: [] });

function creaApp() {
  const promoService = {
    inizioNuovaLavorazione: vi.fn(async (dati: { titolo: string }, _idUtente: string, _req: unknown) => ({ id: `id-${dati.titolo}`, nome: dati.titolo })),
    contestiImportazione: vi.fn(async (_req: unknown, guidIds: string[]) => guidIds.map((guidId) => ({ guidId, contesto: [] }))),
  };
  const app = express();
  app.use(express.json());
  new PromoController(promoService as unknown as IPromoService, {} as IImpostazioniService, {} as IGdoService).registerRoutes(app);
  return { app, promoService };
}

let attivita: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  agenzia.valore = { supportaImportStorico: true };
  attivita = vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as never);
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ configurationChanged: vi.fn() } as unknown as AuditLogService);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/promo/archivio', () => {
  it('crea le promo una alla volta e una che non si crea non ferma le altre', async () => {
    const { app, promoService } = creaApp();
    promoService.inizioNuovaLavorazione.mockImplementation(async (dati: { titolo: string }, _idUtente: string, _req: unknown) => {
      if (dati.titolo === 'P2102_VOL_21-01-21') throw new BadRequestError({ message: 'Esiste già una promo con lo stesso nome e le stesse date' });
      return { id: `id-${dati.titolo}`, nome: dati.titolo };
    });

    const res = await request(app).post('/api/promo/archivio').send({ promo: [nuova('P2101_VOL_07-01-21'), nuova('P2102_VOL_21-01-21'), nuova('P2103_VOL_04-02-21')] });

    expect(res.status).toBe(200);
    expect(res.body.promo).toEqual([
      { titolo: 'P2101_VOL_07-01-21', esito: 'creata', promo: { id: 'id-P2101_VOL_07-01-21', nome: 'P2101_VOL_07-01-21' } },
      { titolo: 'P2102_VOL_21-01-21', esito: 'errore', motivo: 'Esiste già una promo con lo stesso nome e le stesse date' },
      { titolo: 'P2103_VOL_04-02-21', esito: 'creata', promo: { id: 'id-P2103_VOL_04-02-21', nome: 'P2103_VOL_04-02-21' } },
    ]);
    // Come POST /promo: stesso servizio e un'attivita' per ogni promo creata
    expect(promoService.inizioNuovaLavorazione.mock.calls.map(([dati, idUtente]) => [dati.titolo, idUtente])).toEqual([
      ['P2101_VOL_07-01-21', 'u-operatore'], ['P2102_VOL_21-01-21', 'u-operatore'], ['P2103_VOL_04-02-21', 'u-operatore'],
    ]);
    expect(attivita).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['senza elenco', {}],
    ['con un elenco vuoto', { promo: [] }],
    ['con 26 promo', { promo: Array.from({ length: 26 }, (_, i) => nuova(`P${i}`)) }],
    ['con una promo senza titolo', { promo: [{ ...nuova('x'), titolo: ' ' }] }],
  ])('rifiuta una richiesta %s senza creare promo', async (_caso, corpo) => {
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/archivio').send(corpo);

    expect(res.status).toBe(400);
    expect(promoService.inizioNuovaLavorazione).not.toHaveBeenCalled();
  });

  it('senza import da storico rifiuta senza contattare Istanta', async () => {
    agenzia.valore = {};
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/archivio').send({ promo: [nuova('P2101_VOL_07-01-21')] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/storico non e disponibile/);
    expect(promoService.inizioNuovaLavorazione).not.toHaveBeenCalled();
  });
});

describe('POST /api/promo/contesto-importazione/archivio', () => {
  it('restituisce il contesto di ogni promo', async () => {
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/contesto-importazione/archivio').send({ guidIds: ['p1', 'p2'] });

    expect(res.status).toBe(200);
    expect(res.body.contesti).toEqual([{ guidId: 'p1', contesto: [] }, { guidId: 'p2', contesto: [] }]);
    expect(promoService.contestiImportazione).toHaveBeenCalledWith(expect.anything(), ['p1', 'p2']);
  });

  it.each([
    ['senza elenco', {}],
    ['con 101 promo', { guidIds: Array.from({ length: 101 }, (_, i) => `p${i}`) }],
    ['con un id vuoto', { guidIds: ['p1', ''] }],
  ])('rifiuta una richiesta %s', async (_caso, corpo) => {
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/contesto-importazione/archivio').send(corpo);

    expect(res.status).toBe(400);
    expect(promoService.contestiImportazione).not.toHaveBeenCalled();
  });

  it('senza import da storico rifiuta', async () => {
    agenzia.valore = {};
    const { app, promoService } = creaApp();

    const res = await request(app).post('/api/promo/contesto-importazione/archivio').send({ guidIds: ['p1'] });

    expect(res.status).toBe(400);
    expect(promoService.contestiImportazione).not.toHaveBeenCalled();
  });
});
