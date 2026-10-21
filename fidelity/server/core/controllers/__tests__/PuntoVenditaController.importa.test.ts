import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import type { ContestoImportPuntiVendita } from '../../services/importPuntiVendita';
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

// Spec import-punti-vendita (proposte in change task-c89f3697) e configurazioni-condivise

const contesto: ContestoImportPuntiVendita = {
  canali: [{ id: 'c1', codice: 'CC', nome: 'Conad City' }],
  aree: [{ id: 'a1', codice: 'TO', nome: 'Toscana' }],
  combinazioni: [{ id: 'comb1', idCanale: 'c1', idArea: 'a1', sigla: 'CC_TO' }],
  esistenti: [{ id: 'pv-esistente', nome: 'Conad Pisa', indirizzo: 'Via Vecchia 3', cap: '56100', meta: { id_anacan: '9' } }],
};

const OK = { data: { esito: true, errorCode: 0, error: '' }, status: 200 };
const RIFIUTO = { data: { esito: false, errorCode: 0, error: 'Combinazione sconosciuta' }, status: 400 };

function createApp(risposteIstanta: Array<typeof OK>, agenziaLib: Partial<IAgenziaLib> = {}) {
  const puntoVenditaService = {
    getContestoImport: vi.fn(async () => contesto),
    createPuntoVendita: vi.fn(async (data: any) => data),
    updatePuntoVendita: vi.fn(async (_id: string, data: any) => data),
  };
  const gdoService = { getGDOByUtenteId: vi.fn(async () => ({ id: 'g1' })) };
  const istanta = vi.spyOn(ServerUtils, 'sendToFICOApi');
  risposteIstanta.forEach(r => istanta.mockResolvedValueOnce(r as any));

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1' }; next(); });
  new PuntoVenditaController(puntoVenditaService as any, gdoService as any, agenziaLib as IAgenziaLib).registerRoutes(app);
  return { app, puntoVenditaService, istanta };
}

function excel(righe: unknown[][]): Buffer {
  const cartella = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(cartella, XLSX.utils.aoa_to_sheet(righe), 'PV');
  return XLSX.write(cartella, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const fileGenerico = excel([
  ['nome', 'indirizzo', 'citta', 'cap', 'canaleArea'],
  ['Conad Lucca', 'Via Roma 1', 'Lucca', '55100', 'CC_TO'],
  ['Conad Prato', 'Via Firenze 2', 'Prato', '59100', 'CC_TO'],
  ['Senza Cap', 'Via Milano 3', 'Pisa', '', 'CC_TO'],
]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/ACPV/importaPV', () => {
  it('anteprima: esito di ogni riga, nessuna scrittura su Istanta o FP', async () => {
    const { app, puntoVenditaService, istanta } = createApp([]);

    const res = await request(app).post('/api/ACPV/importaPV?anteprima=true').attach('file', fileGenerico, 'pv.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.righe.map((r: any) => [r.riga, r.azione])).toEqual([[2, 'crea'], [3, 'crea'], [4, 'scarta']]);
    expect(istanta).not.toHaveBeenCalled();
    expect(puntoVenditaService.createPuntoVendita).not.toHaveBeenCalled();
    expect(puntoVenditaService.getContestoImport).toHaveBeenCalledWith('g1');
  });

  it('Istanta rifiuta una riga: non entra in FP e le altre proseguono, con lo stesso GUID nei due sistemi', async () => {
    const { app, puntoVenditaService, istanta } = createApp([RIFIUTO, OK]);

    const res = await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total_imported: 1, total_updated: 0, total_skipped: 2 });
    expect(res.body.errors.map((e: any) => e.row)).toEqual([2, 4]);
    expect(res.body.errors[0].error).toContain('Combinazione sconosciuta');

    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledOnce();
    const guidIstanta = (istanta.mock.calls[1][3] as any).guidID;
    expect(guidIstanta).toMatch(/^[0-9a-f-]{36}$/);
    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledWith(expect.objectContaining({ id: guidIstanta, nome: 'Conad Prato' }));
  });

  it('riga riconosciuta dalla chiave del cliente: aggiorna il PV esistente con il suo GUID', async () => {
    const { app, puntoVenditaService, istanta } = createApp([OK], {
      importPuntiVendita: {
        chiaveMeta: 'id_anacan',
        leggiRiga: r => ({
          nome: String(r.nome), indirizzo: String(r.indirizzo), citta: String(r.citta), cap: String(r.cap),
          canale: String(r.insegna), area: String(r.zona), meta: { id_anacan: String(r.anacan) },
        }),
      },
    });
    const file = excel([
      ['anacan', 'nome', 'indirizzo', 'citta', 'cap', 'insegna', 'zona'],
      ['9', 'Conad Pisa', 'Via Nuova 7', 'Pisa', '56100', 'CONAD CITY', 'Toscana'],
    ]);

    const res = await request(app).post('/api/ACPV/importaPV').attach('file', file, 'pv.xlsx');

    expect(res.body).toMatchObject({ total_imported: 0, total_updated: 1, total_skipped: 0 });
    expect(istanta.mock.calls[0][3]).toMatchObject({ guidID: 'pv-esistente', indirizzo: 'Via Nuova 7', guidIDCombinazione: 'comb1' });
    expect(puntoVenditaService.updatePuntoVendita).toHaveBeenCalledWith('pv-esistente', expect.objectContaining({ indirizzo: 'Via Nuova 7' }));
    expect(puntoVenditaService.createPuntoVendita).not.toHaveBeenCalled();
  });

  it('senza file risponde 400', async () => {
    const { app } = createApp([]);

    const res = await request(app).post('/api/ACPV/importaPV');

    expect(res.status).toBe(400);
  });
});
