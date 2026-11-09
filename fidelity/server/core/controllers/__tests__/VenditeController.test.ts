import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { BadRequestError } from '../../../../lib/errors';
import type { AnteprimaImportVendite, ImportVendite, RiepilogoVendite } from '../../../../lib/vendite/tipi';
import { ImportVenditeInCorso, type FileVendite, type IImportVenditeService } from '../../interfaces/IImportVenditeService';

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
const anagrafica = vi.hoisted(() => ({ idGdo: null as string | null }));
vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => (anagrafica.idGdo ? { id_gdo_utentegdo: anagrafica.idGdo, id_ruolo_utente_gdo: null } : null)) },
}));

import { VenditeController } from '../VenditeController';

// Contratto lib/vendite/tipi.ts: import delle vendite del cliente sotto /api/vendite

const GDO_SESSIONE = '11111111-1111-4111-8111-111111111111';
const ALTRA_GDO = '22222222-2222-4222-8222-222222222222';

const IMPORT: ImportVendite = {
  id: '99999999-9999-4999-8999-999999999999', stato: 'in_corso', nomeFile: 'vendite.xlsx', righe: 3, elaborate: 1, scritte: 0, scartate: 1,
  errore: null, avviatoIl: '2026-11-09T10:00:00.000Z', terminatoIl: null,
};

const ANTEPRIMA: AnteprimaImportVendite = {
  tracciato: { nome: 'Tracciato generico', colonne: ['codice'] }, righe: 1, importabili: 1, scartate: 0, dettaglioScartate: [],
  periodo: { dal: '2026-01-05', al: '2026-01-11' }, prodotti: 1, puntiVendita: 1,
};

const RIEPILOGO: RiepilogoVendite = { gdo: { id: GDO_SESSIONE, nome: 'CONAD CENTRALE' }, righe: 10, prodotti: 4, puntiVendita: 2, dal: '2026-01-05', al: '2026-01-11', ultimoImport: IMPORT };

function servizioFinto() {
  return {
    anteprima: vi.fn(async (_file: FileVendite, _idGdo: string) => ANTEPRIMA),
    avvia: vi.fn(async (_file: FileVendite, _idGdo: string, _idUtente: string) => IMPORT),
    stato: vi.fn(async (_idGdo: string): Promise<ImportVendite | null> => IMPORT),
    annulla: vi.fn(async (_idGdo: string): Promise<ImportVendite | null> => IMPORT),
    riepilogo: vi.fn(async (_idGdo: string) => RIEPILOGO),
  } satisfies IImportVenditeService;
}

/** "Vendite e previsioni" della GDO: accesa salvo i test che la spengono. */
const funzione = { attiva: true };

function creaApp(tipo_utente: TIPO_UTENTI = TIPO_UTENTI.GDO, caricaFile?: RequestHandler) {
  const vendite = servizioFinto();
  const funzionalita = {
    getFunzionalita: vi.fn(async (_idGdo: string | null) => ({ momenti: false, menabo: false, vendite: funzione.attiva })),
  };
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente } as Request['session'];
    next();
  });
  new VenditeController(vendite, funzionalita, caricaFile).registerRoutes(app);
  return { app, vendite, funzionalita };
}

const XLSX_FINTO = Buffer.from('PK finto');

beforeEach(() => {
  anagrafica.idGdo = GDO_SESSIONE;
  funzione.attiva = true;
});

describe('"Vendite e previsioni" spenta per la GDO della sessione', () => {
  it('rifiuta anteprima, import e riepilogo con 403, senza toccare le vendite', async () => {
    funzione.attiva = false;
    const { app, vendite, funzionalita } = creaApp();

    const importa = await request(app).post('/api/vendite/import').attach('file', XLSX_FINTO, 'vendite.xlsx');
    const riepilogo = await request(app).get('/api/vendite/riepilogo');

    expect(importa.status).toBe(403);
    expect(importa.body.message).toBe('Vendite e previsioni non sono attive per questa GDO: si attivano in Impostazioni di produzione, Funzionalità');
    expect(riepilogo.status).toBe(403);
    expect(funzionalita.getFunzionalita).toHaveBeenCalledWith(GDO_SESSIONE);
    expect(vendite.avvia).not.toHaveBeenCalled();
    expect(vendite.riepilogo).not.toHaveBeenCalled();
  });
});

describe('VenditeController: permesso', () => {
  it.each([
    ['post', '/api/vendite/import/anteprima'],
    ['post', '/api/vendite/import'],
    ['get', '/api/vendite/import/stato'],
    ['post', '/api/vendite/import/annulla'],
    ['get', '/api/vendite/riepilogo'],
  ] as const)('%s %s chiede analisi.importa_vendite', async (metodo, percorso) => {
    const { app } = creaApp();

    const res = await request(app)[metodo](percorso);

    expect(res.headers['x-permesso']).toBe('analisi.importa_vendite');
  });
});

describe('POST /api/vendite/import/anteprima', () => {
  it('legge il file della GDO della sessione e risponde con l\'anteprima', async () => {
    const { app, vendite } = creaApp();

    const res = await request(app).post('/api/vendite/import/anteprima').attach('file', XLSX_FINTO, 'vendite.xlsx');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(ANTEPRIMA);
    expect(vendite.anteprima).toHaveBeenCalledWith({ contenuto: XLSX_FINTO, nome: 'vendite.xlsx' }, GDO_SESSIONE);
  });

  it('il nome del file con gli accenti arriva in UTF-8', async () => {
    const { app, vendite } = creaApp();

    await request(app).post('/api/vendite/import/anteprima').attach('file', XLSX_FINTO, 'vendite città.csv');

    expect(vendite.anteprima).toHaveBeenCalledWith(expect.objectContaining({ nome: 'vendite città.csv' }), GDO_SESSIONE);
  });

  it('senza file: 400, il servizio non e\' chiamato', async () => {
    const { app, vendite } = creaApp();

    const res = await request(app).post('/api/vendite/import/anteprima').field('altro', '1');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Nessun file caricato: invia il file delle vendite nel campo file');
    expect(vendite.anteprima).not.toHaveBeenCalled();
  });

  it('un file che non e\' xlsx, xls o csv: 400', async () => {
    const { app, vendite } = creaApp();

    const res = await request(app).post('/api/vendite/import/anteprima').attach('file', Buffer.from('%PDF'), 'vendite.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Formato file non supportato: usa un file .xlsx, .xls o .csv');
    expect(vendite.anteprima).not.toHaveBeenCalled();
  });

  it('un file troppo grande: 400 con il limite', async () => {
    const piccolo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 } }).single('file');
    const { app } = creaApp(TIPO_UTENTI.GDO, piccolo);

    const res = await request(app).post('/api/vendite/import/anteprima').attach('file', XLSX_FINTO, 'vendite.xlsx');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Il file delle vendite puo' pesare al massimo 10 MB");
  });

  it('un file illeggibile: l\'errore del servizio arriva come 400', async () => {
    const { app, vendite } = creaApp();
    vendite.anteprima.mockRejectedValueOnce(new BadRequestError({ message: 'File non leggibile: usa un file .xlsx, .xls o .csv' }));

    const res = await request(app).post('/api/vendite/import/anteprima').attach('file', XLSX_FINTO, 'vendite.xlsx');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File non leggibile: usa un file .xlsx, .xls o .csv');
  });
});

describe('POST /api/vendite/import', () => {
  it('avvia l\'import e risponde subito con 202 e il suo stato', async () => {
    const { app, vendite } = creaApp();

    const res = await request(app).post('/api/vendite/import').attach('file', XLSX_FINTO, 'vendite.xlsx');

    expect(res.status).toBe(202);
    expect(res.body).toEqual(IMPORT);
    expect(vendite.avvia).toHaveBeenCalledWith({ contenuto: XLSX_FINTO, nome: 'vendite.xlsx' }, GDO_SESSIONE, 'u1');
  });

  it('con un import gia\' in corso sulla GDO: 409 con il suo stato', async () => {
    const { app, vendite } = creaApp();
    vendite.avvia.mockRejectedValueOnce(new ImportVenditeInCorso(IMPORT));

    const res = await request(app).post('/api/vendite/import').attach('file', XLSX_FINTO, 'vendite.xlsx');

    expect(res.status).toBe(409);
    // httpStatus e code nel corpo: ServerCall li legge da li' per dare al client un errore 409
    expect(res.body).toEqual({
      message: new ImportVenditeInCorso(IMPORT).message,
      stato: IMPORT,
      httpStatus: 409,
      code: 'IMPORT_VENDITE_IN_CORSO',
    });
  });

  it('senza file: 400', async () => {
    const { app, vendite } = creaApp();

    const res = await request(app).post('/api/vendite/import');

    expect(res.status).toBe(400);
    expect(vendite.avvia).not.toHaveBeenCalled();
  });
});

describe('GDO dell\'import: sempre quella operativa della sessione', () => {
  const MESSAGGIO_SENZA_GDO = "La sessione non ha una GDO operativa: scegli una GDO per lavorare sulle sue vendite";

  it('una sessione senza GDO operativa non importa: 403', async () => {
    anagrafica.idGdo = null;
    const { app, vendite } = creaApp();

    const res = await request(app).post('/api/vendite/import').attach('file', XLSX_FINTO, 'vendite.xlsx');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(MESSAGGIO_SENZA_GDO);
    expect(vendite.avvia).not.toHaveBeenCalled();
  });

  it('un utente della GDO non sceglie un\'altra GDO con ?gdo=', async () => {
    const { app, vendite } = creaApp();

    await request(app).get(`/api/vendite/riepilogo?gdo=${ALTRA_GDO}`);

    expect(vendite.riepilogo).toHaveBeenCalledWith(GDO_SESSIONE);
  });

  it('anche Superadmin e Agenzia lavorano sulla GDO operativa della sessione: ?gdo= non conta', async () => {
    const superadmin = creaApp(TIPO_UTENTI.SUPERADMIN);
    const agenzia = creaApp(TIPO_UTENTI.AGENZIA);

    await request(superadmin.app).post(`/api/vendite/import?gdo=${ALTRA_GDO}`).attach('file', XLSX_FINTO, 'vendite.xlsx');
    await request(agenzia.app).get(`/api/vendite/import/stato?gdo=${ALTRA_GDO}`);

    expect(superadmin.vendite.avvia).toHaveBeenCalledWith(expect.anything(), GDO_SESSIONE, 'u1');
    expect(agenzia.vendite.stato).toHaveBeenCalledWith(GDO_SESSIONE);
  });

  it('Superadmin senza GDO operativa: 403 anche indicando ?gdo=', async () => {
    anagrafica.idGdo = null;
    const { app, vendite } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const senza = await request(app).get('/api/vendite/riepilogo');
    const conGdo = await request(app).get(`/api/vendite/riepilogo?gdo=${ALTRA_GDO}`);

    expect(senza.status).toBe(403);
    expect(senza.body.message).toBe(MESSAGGIO_SENZA_GDO);
    expect(conGdo.status).toBe(403);
    expect(vendite.riepilogo).not.toHaveBeenCalled();
  });
});

describe('stato, annullamento e riepilogo', () => {
  it('GET stato: l\'ultimo import della GDO, o null', async () => {
    const { app, vendite } = creaApp();

    const conImport = await request(app).get('/api/vendite/import/stato');
    vendite.stato.mockResolvedValueOnce(null);
    const senza = await request(app).get('/api/vendite/import/stato');

    expect(conImport.status).toBe(200);
    expect(conImport.body).toEqual(IMPORT);
    expect(senza.status).toBe(200);
    expect(senza.body).toBeNull();
  });

  it('POST annulla: lo stato dell\'import; 404 se la GDO non ne ha', async () => {
    const { app, vendite } = creaApp();

    const annullato = await request(app).post('/api/vendite/import/annulla');
    vendite.annulla.mockResolvedValueOnce(null);
    const senza = await request(app).post('/api/vendite/import/annulla');

    expect(annullato.status).toBe(200);
    expect(annullato.body).toEqual(IMPORT);
    expect(vendite.annulla).toHaveBeenCalledWith(GDO_SESSIONE);
    expect(senza.status).toBe(404);
    expect(senza.body).toEqual({ message: 'Nessun import delle vendite per questa GDO', httpStatus: 404 });
  });

  it('GET riepilogo', async () => {
    const { app } = creaApp();

    const res = await request(app).get('/api/vendite/riepilogo');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(RIEPILOGO);
  });
});
