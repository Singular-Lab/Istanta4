import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wrapDatabaseError } from '../../../../lib/errors';
import type { IReferenzeService } from '../../interfaces/IReferenzeService';
import { AuditLogService } from '../../services/AuditLogService';
import { ReferenzeController } from '../ReferenzeController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Passa solo chi ha nell'header il permesso che la route chiede; altrimenti 403 col codice
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (req: Request, res: Response, next: NextFunction) =>
    req.headers['x-permesso'] === codice ? next() : res.status(403).json({ codice }),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// GET /api/referenze/campi-non-tradotti e POST .../sync (TASK-09feff61): il controller prende i
// mapping dalla configurazione salvata, mai dal client, e il Sync vale solo per quelli che
// cambiano davvero il nome.

const servizi = vi.hoisted(() => ({
  ConfigService: { getConfigWebPliantFromVolantino: vi.fn() },
}));
vi.mock('../../di', () => ({
  TYPES: { ConfigService: 'ConfigService' },
  container: { get: (tipo: keyof typeof servizi) => servizi[tipo] },
}));

const PERMESSO = 'impostazioni.modifica_generali';

const MAPPA = [
  { expected_input: 'Referenza.Codice', expected_output: 'codice_referenza' },
  { expected_input: 'promo_db1', expected_output: 'codice_promo' },
  { expected_input: 'reparto', expected_output: 'reparto' },
  { expected_input: 'tema', expected_output: '' },
];

function creaApp() {
  const referenzeService = {
    contaCampiNonTradotti: vi.fn(async (_campi: string[]) => ({ promo_db1: 120 } as Record<string, number>)),
    sincronizzaCampoNonTradotto: vi.fn(async (_campo: string, _tradotto: string) => ({ referenze: 120, kit: 3 })),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1' } as Request['session'];
    req.headers['x-permesso'] ??= PERMESSO;
    next();
  });
  new ReferenzeController(referenzeService as unknown as IReferenzeService).registerRoutes(app);
  return { app, referenzeService };
}

let audit: ReturnType<typeof vi.fn>;

beforeEach(() => {
  servizi.ConfigService.getConfigWebPliantFromVolantino.mockResolvedValue({ data_fields_refs: MAPPA });
  audit = vi.fn();
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue({ entityChanged: audit } as unknown as AuditLogService);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('permessi', () => {
  it.each([
    ['get', '/api/referenze/campi-non-tradotti'],
    ['post', '/api/referenze/campi-non-tradotti/sync'],
  ] as const)('%s %s richiede impostazioni.modifica_generali', async (metodo, url) => {
    const { app, referenzeService } = creaApp();

    const res = await request(app)[metodo](url).set('x-permesso', 'referenze.visualizza').send({ campo: 'promo_db1' });

    expect(res.status).toBe(403);
    expect(res.body.codice).toBe(PERMESSO);
    expect(referenzeService.sincronizzaCampoNonTradotto).not.toHaveBeenCalled();
  });
});

describe('GET /api/referenze/campi-non-tradotti', () => {
  it('conta solo i mapping che cambiano il nome e restituisce 0 dove non ci sono referenze', async () => {
    const { app, referenzeService } = creaApp();

    const res = await request(app).get('/api/referenze/campi-non-tradotti');

    expect(res.status).toBe(200);
    expect(referenzeService.contaCampiNonTradotti).toHaveBeenCalledWith(['Referenza.Codice', 'promo_db1']);
    expect(res.body).toEqual([
      { campo: 'Referenza.Codice', tradotto: 'codice_referenza', referenze: 0 },
      { campo: 'promo_db1', tradotto: 'codice_promo', referenze: 120 },
    ]);
  });
});

describe('POST /api/referenze/campi-non-tradotti/sync', () => {
  it('sincronizza il mapping salvato e lo registra nel Registro Audit', async () => {
    const { app, referenzeService } = creaApp();

    const res = await request(app).post('/api/referenze/campi-non-tradotti/sync').send({ campo: 'promo_db1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ campo: 'promo_db1', tradotto: 'codice_promo', referenze: 120, kit: 3 });
    // Il nome tradotto viene dalla configurazione, non dalla richiesta
    expect(referenzeService.sincronizzaCampoNonTradotto).toHaveBeenCalledWith('promo_db1', 'codice_promo');
    expect(audit).toHaveBeenCalledWith(expect.anything(), 'referenze', 'sincronizza_campo', { type: 'MappingDataFields', id: 'promo_db1' },
      { campo: 'promo_db1', tradotto: 'codice_promo', referenze: 120, kit: 3 });
  });

  it.each([
    ['senza campo', {}],
    ['con un campo vuoto', { campo: '  ' }],
    ['con un campo non testuale', { campo: 42 }],
    ['con un campo fuori dalla mappa', { campo: 'inesistente' }],
    ['con un mapping che non cambia il nome', { campo: 'reparto' }],
    ['con un mapping senza nome tradotto', { campo: 'tema' }],
  ])('rifiuta una richiesta %s senza toccare le referenze', async (_caso, corpo) => {
    const { app, referenzeService } = creaApp();

    const res = await request(app).post('/api/referenze/campi-non-tradotti/sync').send(corpo);

    expect(res.status).toBe(400);
    expect(referenzeService.sincronizzaCampoNonTradotto).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('un errore del database risponde con il suo stato e non scrive nel Registro Audit', async () => {
    const { app, referenzeService } = creaApp();
    referenzeService.sincronizzaCampoNonTradotto.mockRejectedValue(wrapDatabaseError(new Error('rollback'), {
      message: "Errore durante la sincronizzazione del campo: nessuna referenza e' stata modificata",
      operation: 'update',
      entity: 'ReferenzeIstanta',
    }));

    const res = await request(app).post('/api/referenze/campi-non-tradotti/sync').send({ campo: 'promo_db1' });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(audit).not.toHaveBeenCalled();
  });
});
