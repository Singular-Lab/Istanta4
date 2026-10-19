import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Servizi del container e modelli in memoria: il controller è quello reale
const servizi = vi.hoisted(() => ({
  raccoglitore: {
    checkSeRaccoglitoreEsisteDaDati: vi.fn(),
    creaTemplateCombinazione: vi.fn(),
    createBulkCombinazioneDesign: vi.fn(),
  },
  formato: { getFormatoById: vi.fn() },
}));

vi.mock('../../di', () => ({
  TYPES: { FormatoService: 'FormatoService', RaccoglitoreKitService: 'RaccoglitoreKitService' },
  container: {
    get: (tipo: string) => (tipo === 'FormatoService' ? servizi.formato : servizi.raccoglitore),
  },
}));

vi.mock('../../models', () => ({
  Area: { findByPk: vi.fn(async (id: string) => ({ id_aree: id, codice_aree: 'TO' })) },
  Canale: { findByPk: vi.fn(async (id: string) => ({ id_canali: id, codice_canali: 'SS' })) },
}));

import { ServerUtils } from '../../utils/ServerUtils';
import { DesignKitController } from '../DesignKitController';

const filtroContesto = [
  {
    titoloFiltro: 'Solo Toscana',
    condizioni: [{ schemaScelto: 'promo', colonna: 'codice_area', nome_field: 'promo.codice_area', operatore: 'equals' }],
  },
];
const filtri = [{ titoloFiltro: 'Solo freschi', condizioni: [{ nome_field: 'reparto', operatore: 'equals', valore: 'FRESCHI' }] }];
const declinazioni = [{ titolo: 'Lingua', proprieta: [{ idChiave: 1, valore: 'EN' }], filtri: [] }];

function createApp() {
  servizi.raccoglitore.checkSeRaccoglitoreEsisteDaDati.mockResolvedValue(false);
  servizi.raccoglitore.creaTemplateCombinazione.mockResolvedValue({ guidId: 'r1' });
  servizi.raccoglitore.createBulkCombinazioneDesign.mockImplementation(async (designs: any[]) => designs);
  servizi.formato.getFormatoById.mockResolvedValue({ codice: 'VOL' });
  vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as any);

  const serviceFacade = {
    getGDOByUtenteId: vi.fn(async () => ({ id: 'gdo-1' })),
    getAllCombinazioniForGDO: vi.fn(async () => [{ id_area: 'a1', id_canale: 'c1' }]),
  };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'utente-di-prova' }; next(); });
  new DesignKitController({} as any, serviceFacade as any).registerRoutes(app);
  return app;
}

const richiesta = (extra: Record<string, unknown>) => ({
  titolo: 'Kit',
  guidCanale: ['c1'],
  guidArea: ['a1'],
  guidPv: [],
  guidFormato: 'f1',
  quantitaCopie: 1,
  tipo: 'AUTOMATICO',
  tipiDiExportInKit: [],
  ...extra,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('PUT /api/creaCombinazioniDesign', () => {
  it('salva filtro di contesto, filtri e declinazioni nel raccoglitore e in ogni design', async () => {
    const res = await request(createApp())
      .put('/api/creaCombinazioniDesign')
      .send(richiesta({ filtroContesto, filtri, declinazioni }));

    expect(res.status).toBe(200);
    expect(servizi.raccoglitore.creaTemplateCombinazione).toHaveBeenCalledWith(
      expect.objectContaining({ filtroContesto, filtro: filtri, declinazioni })
    );
    const designs = servizi.raccoglitore.createBulkCombinazioneDesign.mock.calls[0][0];
    expect(designs).toHaveLength(1);
    expect(designs[0]).toMatchObject({ filtroContesto, filtro: filtri, declinazioni });
  });

  it('senza filtro di contesto salva una lista vuota', async () => {
    const res = await request(createApp()).put('/api/creaCombinazioniDesign').send(richiesta({}));

    expect(res.status).toBe(200);
    expect(servizi.raccoglitore.creaTemplateCombinazione).toHaveBeenCalledWith(expect.objectContaining({ filtroContesto: [] }));
    expect(servizi.raccoglitore.createBulkCombinazioneDesign.mock.calls[0][0][0]).toMatchObject({ filtroContesto: [] });
  });
});
