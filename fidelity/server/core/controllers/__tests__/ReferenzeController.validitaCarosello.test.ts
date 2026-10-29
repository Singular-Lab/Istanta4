import 'dayjs/locale/it';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) =>
    ((req as unknown as { session?: { id_utente?: string } }).session?.id_utente ? next() : res.status(401).end()),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const finti = vi.hoisted(() => ({ containerGet: vi.fn() }));
vi.mock('../../di', () => ({ TYPES: { WebPliantService: 'WebPliantService' }, container: { get: finti.containerGet } }));

import type { ReferenzeIstanta } from '../../../../lib/types';
import type { IAreaService } from '../../interfaces/IAreaService';
import type { ICanaleService } from '../../interfaces/ICanaleService';
import type { IGdoService } from '../../interfaces/IGdoService';
import type { IReferenzeService } from '../../interfaces/IReferenzeService';
import type { ITipoExportService } from '../../interfaces/ITipoExportService';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import type { IPromoRepository } from '../../repositories/PromoRepository';
import { WebPliantService } from '../../services/WebPliantService';
import { ReferenzeController } from '../ReferenzeController';
import { WebPliantController } from '../WebPliantController';

// Il carosello del volantino chiedeva le referenze e poi rimandava al server tutte quelle ricevute
// (PUT /getDataValiditaPerCarosello) per avere la scritta di validita: con conValidita arriva insieme
// alle referenze, calcolata con la stessa logica. Chi non la chiede (bundle in cache) riceve l'elenco.

const item = { id: 'carosello-1', type: 'carousel', content: { options: { validita: { auto: true } } } };

// Come le restituisce ReferenzeService.getFilteredReferenze: righe del database normalizzate
const referenza = (codice: string, dataFields: Record<string, unknown>) =>
  ({
    id_promo: 'p1',
    idPromo: 'p1',
    codice_referenza: codice,
    data_fields: dataFields,
    dataFields,
    createdat: new Date('2026-10-01T08:00:00Z'),
  }) as unknown as ReferenzeIstanta;

const referenzeDelCarosello = [
  referenza('r1', { data_da: '2026-11-01', data_a: '2026-11-07' }),
  referenza('r2', { data_da: '2026-11-01', data_a: '2026-11-07' }),
];

function creaWebPliantService(promo: { id_promo: string; validita_dal: Date; validita_al: Date } | null = null) {
  return new WebPliantService(
    { findById: vi.fn().mockResolvedValue(promo) } as unknown as IPromoRepository,
    {} as unknown as IAreaService,
    {} as unknown as ICanaleService,
    {} as unknown as IGdoService,
    {} as unknown as ITipoExportService
  );
}

/** webPliantService null: il controller lo cerca nel container, come in produzione. */
function creaApp(referenze: ReferenzeIstanta[], webPliantService: IWebPliantService | null = creaWebPliantService()) {
  const referenzeService = { getFilteredReferenze: vi.fn().mockResolvedValue(referenze) };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Record<string, unknown> }).session = { id_utente: 'u1' };
    next();
  });
  new ReferenzeController(referenzeService as unknown as IReferenzeService, webPliantService ?? undefined).registerRoutes(app);
  if (webPliantService) {
    new WebPliantController(webPliantService, {} as unknown as IGdoService).registerRoutes(app);
  }
  return { app, referenzeService };
}

const richiesta = { idWorkspace: 'w1', idArea: 'a1', idCanale: 'c1', item };

describe('POST /api/get_filtered_referenze con la scritta di validita', () => {
  it('senza conValidita risponde con il solo elenco, come prima', async () => {
    const webPliantService = creaWebPliantService();
    const calcolo = vi.spyOn(webPliantService, 'getDataValiditaPerCarosello');
    const { app } = creaApp(referenzeDelCarosello, webPliantService);

    const res = await request(app).post('/api/get_filtered_referenze').send(richiesta).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((r: { codice_referenza: string }) => r.codice_referenza)).toEqual(['r1', 'r2']);
    expect(calcolo).not.toHaveBeenCalled();
  });

  it('con conValidita restituisce referenze e scritta, calcolata sul contenuto del carosello', async () => {
    const webPliantService = creaWebPliantService();
    const calcolo = vi.spyOn(webPliantService, 'getDataValiditaPerCarosello');
    const { app } = creaApp(referenzeDelCarosello, webPliantService);

    const res = await request(app).post('/api/get_filtered_referenze').send({ ...richiesta, conValidita: true }).expect(200);

    expect(res.body.validita).toBe('Offerte valide dal 1 Novembre al 7 Novembre');
    expect(res.body.referenze.map((r: { codice_referenza: string }) => r.codice_referenza)).toEqual(['r1', 'r2']);
    expect(calcolo).toHaveBeenCalledWith(item.content, referenzeDelCarosello);
  });

  it.each([
    ['date sulle referenze', referenzeDelCarosello, null],
    ['date diverse fra le referenze', [
      referenza('r1', { data_da: '2026-11-01', data_a: '2026-11-07' }),
      referenza('r2', { data_da: '2026-11-03', data_a: '2026-11-07' }),
    ], null],
    ['date della promo', [referenza('r1', {})], {
      id_promo: 'p1', validita_dal: new Date('2026-11-01T10:00:00Z'), validita_al: new Date('2026-11-07T10:00:00Z'),
    }],
  ])('la scritta e la stessa della PUT /getDataValiditaPerCarosello (%s)', async (_caso, referenze, promo) => {
    const { app } = creaApp(referenze, creaWebPliantService(promo));

    const insieme = await request(app).post('/api/get_filtered_referenze').send({ ...richiesta, conValidita: true }).expect(200);
    const elenco = await request(app).post('/api/get_filtered_referenze').send(richiesta).expect(200);
    // Il percorso di prima: il client rimandava al server le referenze ricevute
    const separata = await request(app)
      .put('/api/getDataValiditaPerCarosello')
      .send({ designContent: item.content, referenze: elenco.body })
      .expect(200);

    expect(insieme.body.validita).not.toBe('');
    expect(insieme.body.validita).toBe(separata.body);
  });

  it('se la scritta non si calcola le referenze arrivano comunque, senza scritta', async () => {
    // Prima referenza senza date e promo inesistente: la PUT rispondeva 404 e il carosello restava senza data
    const { app } = creaApp([referenza('r1', {})], creaWebPliantService(null));

    const res = await request(app).post('/api/get_filtered_referenze').send({ ...richiesta, conValidita: true }).expect(200);

    expect(res.body).toEqual({ referenze: [expect.objectContaining({ codice_referenza: 'r1' })], validita: '' });
  });

  it('senza referenze la scritta e vuota', async () => {
    const { app } = creaApp([]);

    const res = await request(app).post('/api/get_filtered_referenze').send({ ...richiesta, conValidita: true }).expect(200);

    expect(res.body).toEqual({ referenze: [], validita: '' });
  });

  it('senza servizio nel costruttore usa quello del container', async () => {
    const webPliantService = creaWebPliantService();
    finti.containerGet.mockReturnValue(webPliantService);
    const { app } = creaApp(referenzeDelCarosello, null);

    const res = await request(app).post('/api/get_filtered_referenze').send({ ...richiesta, conValidita: true }).expect(200);

    expect(finti.containerGet).toHaveBeenCalledWith('WebPliantService');
    expect(res.body.validita).toBe('Offerte valide dal 1 Novembre al 7 Novembre');
  });
});
