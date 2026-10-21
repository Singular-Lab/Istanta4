import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { ServerUtils } from '../../utils/ServerUtils';
import { PuntoVenditaController } from '../PuntoVenditaController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Proposta anagrafica-punti-vendita, "Creazione e modifica dall'anagrafica", e configurazioni-condivise

const OK = { data: { esito: true, errorCode: 0, error: '' }, status: 200 };
const RIFIUTO = { data: { esito: false, errorCode: 0, error: 'Combinazione sconosciuta' }, status: 400 };

function createApp(rispostaIstanta: typeof OK, tipo_utente = TIPO_UTENTI.GDO) {
  const puntoVenditaService = {
    createPuntoVendita: vi.fn(async (data: any) => data),
    updatePuntoVendita: vi.fn(async (id: string, data: any) => ({ ...data, id })),
  };
  const gdoService = { getGDOByUtenteId: vi.fn(async () => ({ id: 'gdo-sessione' })) };
  const istanta = vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue(rispostaIstanta as any);

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1', tipo_utente }; next(); });
  new PuntoVenditaController(puntoVenditaService as any, gdoService as any, {} as any).registerRoutes(app);
  return { app, puntoVenditaService, istanta };
}

// Come lo manda il form della pagina Punti Vendita
const form = {
  nome: 'Conad City Lucca',
  indirizzo: 'Via Fillungo 12',
  citta: 'Lucca',
  cap: '55100',
  canaleArea: 'comb1',
  guidIDCombinazione: 'comb1',
  provincia: 'LU',
  regione: 'Toscana',
  telefono: '0583 123456',
  ragioneSociale: 'Lucca Market Srl',
  lat: null,
  lon: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PUT /api/ACPV/salvaPV', () => {
  it('crea il PV in Istanta e in FP con lo stesso GUID generato da FP e tutti i campi del form', async () => {
    const { app, puntoVenditaService, istanta } = createApp(OK);

    const res = await request(app).put('/api/ACPV/salvaPV').send({ ...form, guidID: '' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ esito: true, isUpdate: false });
    const guidIstanta = (istanta.mock.calls[0][3] as any).guidID;
    expect(guidIstanta).toMatch(/^[0-9a-f-]{36}$/);
    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledWith(expect.objectContaining({
      id: guidIstanta,
      nome: 'Conad City Lucca',
      id_combinazione_canale_area: 'comb1',
      id_gdo: 'gdo-sessione',
      provincia: 'LU',
      regione: 'Toscana',
      telefono: '0583 123456',
      ragionesociale: 'Lucca Market Srl',
      lat: undefined,
      lon: undefined,
    }));
  });

  it('Istanta rifiuta: FP non viene toccato e l\'utente vede il motivo', async () => {
    const { app, puntoVenditaService } = createApp(RIFIUTO);

    const res = await request(app).put('/api/ACPV/salvaPV').send({ ...form, guidID: '' });

    expect(res.status).toBe(502);
    expect(res.body.message).toContain('Combinazione sconosciuta');
    expect(puntoVenditaService.createPuntoVendita).not.toHaveBeenCalled();
  });

  it('un utente GDO non puo indicare un\'altra GDO', async () => {
    const { app, puntoVenditaService } = createApp(OK, TIPO_UTENTI.GDO);

    await request(app).put('/api/ACPV/salvaPV').send({ ...form, guidID: '', idGDO: 'altra-gdo' });

    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledWith(expect.objectContaining({ id_gdo: 'gdo-sessione' }));
  });

  it('un utente Agenzia puo indicare la GDO su cui opera', async () => {
    const { app, puntoVenditaService } = createApp(OK, TIPO_UTENTI.AGENZIA);

    await request(app).put('/api/ACPV/salvaPV').send({ ...form, guidID: '', idGDO: 'gdo-cliente' });

    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledWith(expect.objectContaining({ id_gdo: 'gdo-cliente' }));
  });
});

describe('PUT /api/ACPV/modificaPV', () => {
  it('aggiorna in Istanta con salvaPV e lo stesso GUID, poi in FP senza toccare i meta', async () => {
    const { app, puntoVenditaService, istanta } = createApp(OK);

    const res = await request(app).put('/api/ACPV/modificaPV').send({ ...form, guidID: 'pv1', telefono: '0583 999999' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ esito: true, isUpdate: true });
    expect(istanta.mock.calls[0][1]).toMatch(/\/ACPV\/salvaPV$/);
    expect(istanta.mock.calls[0][3]).toMatchObject({ guidID: 'pv1', guidIDCombinazione: 'comb1' });
    const [id, dati] = puntoVenditaService.updatePuntoVendita.mock.calls[0];
    expect(id).toBe('pv1');
    expect(dati).toMatchObject({ telefono: '0583 999999' });
    expect(dati).not.toHaveProperty('meta');
    expect(puntoVenditaService.createPuntoVendita).not.toHaveBeenCalled();
  });

  it('campi facoltativi lasciati vuoti non vengono scritti', async () => {
    const { app, puntoVenditaService } = createApp(OK);

    await request(app).put('/api/ACPV/modificaPV').send({ ...form, guidID: 'pv1', telefono: '', provincia: ' ' });

    const [, dati] = puntoVenditaService.updatePuntoVendita.mock.calls[0];
    expect(dati.telefono).toBeUndefined();
    expect(dati.provincia).toBeUndefined();
  });
});
