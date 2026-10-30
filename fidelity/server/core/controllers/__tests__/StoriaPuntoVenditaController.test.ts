import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { EsitoImportExport } from '../../../../lib/puntiVendita/storia';
import type { FileExportPlugin, IStoriaPuntoVenditaService } from '../../interfaces/IStoriaPuntoVenditaService';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

// Ogni guardia dice nell'intestazione quale permesso ha chiesto, poi lascia passare
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: Request, res: Response, next: NextFunction) => { res.setHeader('x-permesso', codice); next(); },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// La GDO dell'utente in anagrafica: ogni test la sceglie
const anagrafica = vi.hoisted(() => ({ idGdo: 'gdo-sessione' as string | null }));
vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => (anagrafica.idGdo ? { id_gdo_utentegdo: anagrafica.idGdo, id_ruolo_utente_gdo: null } : null)) },
}));

import { StoriaPuntoVenditaController } from '../StoriaPuntoVenditaController';

// Contratto lib/puntiVendita/storia.ts: storia e volantini del PV, import degli export JSON del Plugin

const ID_PV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

let cartella: string;

function servizioFinto() {
  const esito: EsitoImportExport = { file: [], registrati: 0, scartati: 0, righe: 0, abbinate: 0 };
  const letti: Array<{ nomeFile: string; contenuto: string }> = [];
  return {
    letti,
    storia: {
      getStoria: vi.fn(async (idPuntoVendita: string, _idGdo: string | null) => ({ idPuntoVendita, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] })),
      getVolantini: vi.fn(async (_id: string, _idGdo: string | null, pagina?: number, dimensione?: number) => (
        { volantini: [], totale: 0, pagina: pagina ?? 1, dimensione: dimensione ?? 10 }
      )),
      importaExport: vi.fn(async (file: readonly FileExportPlugin[], _idGdo: string) => {
        for (const singolo of file) letti.push({ nomeFile: singolo.nomeFile, contenuto: await singolo.leggi() });
        return esito;
      }),
      registraListaVolantino: vi.fn(),
      riabbina: vi.fn(),
      pianificaRiabbinamento: vi.fn(),
    } satisfies IStoriaPuntoVenditaService,
  };
}

/** Gli export finiscono nella cartella temporanea del test, come in produzione nei temporanei. */
const caricaInCartella = (massimoFile = 300): RequestHandler => multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { cb(null, cartella); },
    filename: (_req, file, cb) => { cb(null, `${Date.now()}-${Math.random()}-${file.originalname}`); },
  }),
  limits: { files: massimoFile },
}).array('file', massimoFile);

function creaApp(tipo_utente: TIPO_UTENTI = TIPO_UTENTI.GDO, carica: RequestHandler = caricaInCartella()) {
  const { storia, letti } = servizioFinto();
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente } as Request['session'];
    next();
  });
  new StoriaPuntoVenditaController(storia, carica).registerRoutes(app);
  return { app, storia, letti };
}

beforeEach(() => {
  anagrafica.idGdo = 'gdo-sessione';
  cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'storia-pv-'));
});

afterEach(() => {
  fs.rmSync(cartella, { recursive: true, force: true });
});

describe('GET /api/punti-vendita/:id/storia', () => {
  it('con "gdo.visualizza" restituisce la storia del PV cercato nella GDO dell\'utente', async () => {
    const { app, storia } = creaApp();

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/storia`);

    expect(res.status).toBe(200);
    expect(res.headers['x-permesso']).toBe('gdo.visualizza');
    expect(storia.getStoria).toHaveBeenCalledWith(ID_PV, 'gdo-sessione');
    expect(res.body).toMatchObject({ idPuntoVendita: ID_PV, sintesi: null });
  });

  it('PV inesistente o di un\'altra GDO: 404', async () => {
    const { app, storia } = creaApp();
    storia.getStoria.mockRejectedValueOnce(new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: ID_PV }));

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/storia`);

    expect(res.status).toBe(404);
  });

  it('Superadmin senza GDO cerca fra i PV di tutte le GDO', async () => {
    anagrafica.idGdo = null;
    const { app, storia } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/storia`);

    expect(res.status).toBe(200);
    expect(storia.getStoria).toHaveBeenCalledWith(ID_PV, null);
  });

  it('un utente senza GDO che non lavora per piu\' GDO non vede nessun PV: 404', async () => {
    anagrafica.idGdo = null;
    const { app, storia } = creaApp(TIPO_UTENTI.MARKETING);

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/storia`);

    expect(res.status).toBe(404);
    expect(storia.getStoria).not.toHaveBeenCalled();
  });
});

describe('GET /api/punti-vendita/:id/storia/volantini', () => {
  it('passa pagina e dimensione, con "gdo.visualizza"', async () => {
    const { app, storia } = creaApp();

    const res = await request(app).get(`/api/punti-vendita/${ID_PV}/storia/volantini`).query({ pagina: '2', dimensione: '25' });

    expect(res.status).toBe(200);
    expect(res.headers['x-permesso']).toBe('gdo.visualizza');
    expect(storia.getVolantini).toHaveBeenCalledWith(ID_PV, 'gdo-sessione', 2, 25);
  });

  it('pagina e dimensione non numeriche: le decide il servizio', async () => {
    const { app, storia } = creaApp();

    await request(app).get(`/api/punti-vendita/${ID_PV}/storia/volantini`).query({ pagina: 'abc' });

    expect(storia.getVolantini).toHaveBeenCalledWith(ID_PV, 'gdo-sessione', undefined, undefined);
  });
});

describe('POST /api/punti-vendita/storia/import-export', () => {
  it('con "gdo.gestisci_punti_vendita" passa gli export al servizio nella GDO dell\'utente e rimuove i temporanei', async () => {
    const { app, storia, letti } = creaApp();

    const res = await request(app)
      .post('/api/punti-vendita/storia/import-export')
      .attach('file', Buffer.from('{"kitGuidId":"k1"}'), 'SS_LI_45.json')
      .attach('file', Buffer.from('{"kitGuidId":"k2"}'), 'SS_LI_46.json');

    expect(res.status).toBe(200);
    expect(res.headers['x-permesso']).toBe('gdo.gestisci_punti_vendita');
    expect(res.body).toEqual({ file: [], registrati: 0, scartati: 0, righe: 0, abbinate: 0 });
    expect(storia.importaExport).toHaveBeenCalledWith(expect.any(Array), 'gdo-sessione');
    expect(letti).toEqual([
      { nomeFile: 'SS_LI_45.json', contenuto: '{"kitGuidId":"k1"}' },
      { nomeFile: 'SS_LI_46.json', contenuto: '{"kitGuidId":"k2"}' },
    ]);
    expect(fs.readdirSync(cartella)).toEqual([]);
  });

  it('senza file: 400 e nessuna chiamata al servizio', async () => {
    const { app, storia } = creaApp();

    const res = await request(app).post('/api/punti-vendita/storia/import-export');

    expect(res.status).toBe(400);
    expect(storia.importaExport).not.toHaveBeenCalled();
  });

  it('utente senza GDO: 400, e i temporanei si rimuovono lo stesso', async () => {
    anagrafica.idGdo = null;
    const { app, storia } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).post('/api/punti-vendita/storia/import-export').attach('file', Buffer.from('{}'), 'a.json');

    expect(res.status).toBe(400);
    expect(storia.importaExport).not.toHaveBeenCalled();
    expect(fs.readdirSync(cartella)).toEqual([]);
  });

  it('troppi file: 400 che lo dice, nessuna chiamata al servizio', async () => {
    const { app, storia } = creaApp(TIPO_UTENTI.GDO, caricaInCartella(2));

    const res = await request(app)
      .post('/api/punti-vendita/storia/import-export')
      .attach('file', Buffer.from('{}'), 'a.json')
      .attach('file', Buffer.from('{}'), 'b.json')
      .attach('file', Buffer.from('{}'), 'c.json');

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('file per volta');
    expect(storia.importaExport).not.toHaveBeenCalled();
  });
});
