import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import config from '../../config';
import type { ContestoImportPuntiVendita } from '../../services/importPuntiVendita';
import { GestoreImportPuntiVendita } from '../../services/ImportPuntiVenditaJob';
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
  const aggiornaVista = vi.fn(async () => undefined);
  const cerca = vi.fn(async (_q: string) => [
    { etichetta: 'Via Grayson 20, Mantova', lat: 45.15, lon: 10.79, indirizzo: 'Via Grayson 20', cap: '46100', citta: 'Mantova', provincia: 'MN', regione: 'Lombardia' },
  ]);
  const gestore = new GestoreImportPuntiVendita();
  const avvia = vi.spyOn(gestore, 'avvia');
  const emetti = vi.fn();
  const istanta = vi.spyOn(ServerUtils, 'sendToFICOApi');
  risposteIstanta.forEach(r => istanta.mockResolvedValueOnce(r as any));

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { id_utente: 'u1' }; next(); });
  new PuntoVenditaController(
    puntoVenditaService as any, gdoService as any, agenziaLib as IAgenziaLib, gestore, emetti, aggiornaVista, cerca
  ).registerRoutes(app);
  /** Attende la fine dell'import avviato in background. */
  const fineImport = () => avvia.mock.results[0].value.fine;
  return { app, puntoVenditaService, istanta, aggiornaVista, cerca, gestore, emetti, fineImport };
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

const ambienteOriginale = config.NODE_ENV;

afterEach(() => {
  vi.restoreAllMocks();
  config.NODE_ENV = ambienteOriginale;
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

  it('anteprima: ogni riga importabile ha il punteggio di affidabilita', async () => {
    const { app } = createApp([]);

    const res = await request(app).post('/api/ACPV/importaPV?anteprima=true').attach('file', fileGenerico, 'pv.xlsx');

    expect(res.body.righe[0]).toMatchObject({ azione: 'crea', punteggio: 100, motivi: [] });
  });

  it('conferma: risponde subito con il jobId e invia l\'avanzamento via socket all\'utente', async () => {
    const { app, emetti, fineImport } = createApp([OK, OK]);

    const res = await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');
    expect(res.status).toBe(202);
    expect(res.body.stato).toMatchObject({ jobId: res.body.jobId, stato: 'in_corso', totale: 3 });
    await fineImport();

    const eventi = emetti.mock.calls.map(([evento, , room]) => [evento, room]);
    expect(eventi).toContainEqual([`importPV_${res.body.jobId}_progress`, 'user:u1']);
    expect(eventi.at(-1)).toEqual([`importPV_${res.body.jobId}_complete`, 'user:u1']);
  });

  it('Istanta rifiuta una riga: non entra in FP e le altre proseguono, con lo stesso GUID nei due sistemi', async () => {
    const { app, puntoVenditaService, istanta, fineImport, aggiornaVista } = createApp([RIFIUTO, OK]);

    await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');
    const finale = await fineImport();

    expect(finale).toMatchObject({ stato: 'completato', creati: 1, aggiornati: 0, scartati: 2 });
    expect(finale.errori.map((e: any) => e.row)).toEqual([2, 4]);
    expect(finale.errori[0].error).toContain('Combinazione sconosciuta');
    expect(aggiornaVista).toHaveBeenCalledOnce();

    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledOnce();
    const guidIstanta = (istanta.mock.calls[1][3] as any).guidID;
    expect(guidIstanta).toMatch(/^[0-9a-f-]{36}$/);
    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledWith(expect.objectContaining({ id: guidIstanta, nome: 'Conad Prato' }));
  });

  it('riga riconosciuta dalla chiave del cliente: aggiorna il PV esistente con il suo GUID', async () => {
    const istanzaCorrente = createApp([OK], {
      importPuntiVendita: {
        chiaveMeta: 'id_anacan',
        leggiRiga: r => ({
          nome: String(r.nome), indirizzo: String(r.indirizzo), citta: String(r.citta), cap: String(r.cap),
          canale: String(r.insegna), area: String(r.zona), meta: { id_anacan: String(r.anacan) },
        }),
      },
    });
    const { app, puntoVenditaService, istanta, fineImport } = istanzaCorrente;
    const file = excel([
      ['anacan', 'nome', 'indirizzo', 'citta', 'cap', 'insegna', 'zona'],
      ['9', 'Conad Pisa', 'Via Nuova 7', 'Pisa', '56100', 'CONAD CITY', 'Toscana'],
    ]);

    await request(app).post('/api/ACPV/importaPV').attach('file', file, 'pv.xlsx');

    expect(await fineImport()).toMatchObject({ creati: 0, aggiornati: 1, scartati: 0 });
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

describe('import in background: stato e annullamento', () => {
  it('un secondo import mentre il primo e in corso risponde 409 con lo stato', async () => {
    const { app, istanta } = createApp([]);
    istanta.mockImplementation(() => new Promise(() => undefined));

    const primo = await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');
    const secondo = await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');

    expect(secondo.status).toBe(409);
    expect(secondo.body.stato.jobId).toBe(primo.body.jobId);
  });

  it('lo stato dell\'import in corso si ritrova senza jobId, dopo aver ricaricato la pagina', async () => {
    const { app, istanta } = createApp([]);
    istanta.mockImplementation(() => new Promise(() => undefined));
    const avvio = await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');

    const res = await request(app).get('/api/ACPV/importaPV/stato');

    expect(res.status).toBe(200);
    expect(res.body.stato).toMatchObject({ jobId: avvio.body.jobId, stato: 'in_corso' });
  });

  it('annullare un import che non c\'e risponde 404', async () => {
    const { app } = createApp([]);

    expect((await request(app).post('/api/ACPV/importaPV/inesistente/annulla')).status).toBe(404);
  });

  it('annullare ferma l\'import dopo la riga in corso', async () => {
    const { app, istanta, fineImport } = createApp([]);
    let sblocca: (v: any) => void = () => undefined;
    istanta.mockImplementationOnce(() => new Promise(resolve => { sblocca = resolve; })).mockResolvedValue(OK as any);
    const avvio = await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');

    const res = await request(app).post(`/api/ACPV/importaPV/${avvio.body.jobId}/annulla`);
    sblocca(OK);
    const finale = await fineImport();

    expect(res.status).toBe(200);
    expect(finale).toMatchObject({ stato: 'annullato', elaborate: 1, nonElaborate: 2 });
    expect(istanta).toHaveBeenCalledOnce();
  });
});

/** Libreria agenzia il cui unico PV e ambiguo: l'import si ferma su di lui. */
const libreriaConRigaAmbigua: Partial<IAgenziaLib> = {
  importPuntiVendita: {
    chiaveMeta: 'id_anacan',
    chiaveMetaRiserva: 'id_muro',
    leggiRiga: r => ({
      nome: String(r.nome), indirizzo: String(r.indirizzo), citta: String(r.citta), cap: String(r.cap),
      canale: '', area: '', meta: { id_muro: '87907', id_anacan: '8139' },
      avvisi: [{ motivo: 'Insegna Pet Store Conad: canale da scegliere a mano', penalita: 100 }],
    }),
  },
};
const fileAmbiguo = excel([
  ['nome', 'indirizzo', 'citta', 'cap'],
  ['Conad Mantova', 'Via Grayson 20', 'Mantova', '46100'],
]);
const CONFERMATO = {
  azione: 'inserisci', guidIDCombinazione: 'comb1', nome: 'Conad Mantova', indirizzo: 'Via Grayson 20',
  citta: 'Mantova', cap: '46100', provincia: 'MN', regione: 'Lombardia', lat: 45.15, lon: 10.79,
};

async function importInPausa(risposteIstanta: Array<typeof OK>) {
  const istanza = createApp(risposteIstanta, libreriaConRigaAmbigua);
  const avvio = await request(istanza.app).post('/api/ACPV/importaPV').attach('file', fileAmbiguo, 'pv.xlsx');
  const jobId = avvio.body.jobId as string;
  await vi.waitFor(() => expect(istanza.gestore.stato(jobId, 'u1')?.stato).toBe('in_attesa'));
  return { ...istanza, jobId };
}

describe('riga ambigua: inserimento manuale', () => {
  it('l\'import si ferma e lo stato porta la riga in attesa', async () => {
    const { app, jobId, emetti } = await importInPausa([]);

    const res = await request(app).get(`/api/ACPV/importaPV/stato?jobId=${jobId}`);

    expect(res.body.stato).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga: 2, punteggio: 0 } });
    expect(emetti).toHaveBeenCalledWith(`importPV_${jobId}_progress`, expect.objectContaining({ stato: 'in_attesa' }), 'user:u1');
  });

  it('inserisce il PV confermato, prima su Istanta e poi in FP, con le coordinate e le chiavi nei meta, e l\'import finisce', async () => {
    const { app, jobId, istanta, puntoVenditaService, fineImport } = await importInPausa([OK]);

    const res = await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send(CONFERMATO);

    expect(res.status).toBe(200);
    const inviato = istanta.mock.calls[0][3] as any;
    expect(inviato).toMatchObject({ guidIDCombinazione: 'comb1', cap: '46100', lat: 45.15, lon: 10.79 });
    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledWith(expect.objectContaining({
      id: inviato.guidID, id_combinazione_canale_area: 'comb1', regione: 'Lombardia', meta: { id_muro: '87907', id_anacan: '8139' },
    }));
    expect(await fineImport()).toMatchObject({ stato: 'completato', creati: 1, inseritiAMano: 1 });
  });

  it('senza canale e area, o con CAP non valido, non inserisce niente e la riga resta in attesa', async () => {
    const { app, jobId, istanta, gestore } = await importInPausa([OK]);

    const senzaCombinazione = await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send({ ...CONFERMATO, guidIDCombinazione: '' });
    const capErrato = await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send({ ...CONFERMATO, cap: '5607' });

    expect(senzaCombinazione.status).toBe(400);
    expect(capErrato.status).toBe(400);
    expect(istanta).not.toHaveBeenCalled();
    expect(gestore.stato(jobId, 'u1')?.stato).toBe('in_attesa');
  });

  it('se Istanta rifiuta, risponde con l\'errore e la riga resta in attesa', async () => {
    const { app, jobId, puntoVenditaService, gestore } = await importInPausa([RIFIUTO]);

    const res = await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send(CONFERMATO);

    expect(res.status).toBe(502);
    expect(puntoVenditaService.createPuntoVendita).not.toHaveBeenCalled();
    expect(gestore.stato(jobId, 'u1')).toMatchObject({ stato: 'in_attesa', rigaInAttesa: { riga: 2 } });
  });

  it('scarta la riga e l\'import finisce senza scrivere', async () => {
    const { app, jobId, istanta, fineImport } = await importInPausa([]);

    const res = await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send({ azione: 'scarta' });

    expect(res.status).toBe(200);
    expect(istanta).not.toHaveBeenCalled();
    expect(await fineImport()).toMatchObject({ stato: 'completato', creati: 0, scartati: 1 });
  });

  it('una decisione per un import che non c\'e risponde 404, una ripetuta 409', async () => {
    const { app, jobId, fineImport } = await importInPausa([]);

    expect((await request(app).post('/api/ACPV/importaPV/inesistente/decisione').send({ azione: 'scarta' })).status).toBe(404);
    await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send({ azione: 'scarta' });
    await fineImport();
    expect((await request(app).post(`/api/ACPV/importaPV/${jobId}/decisione`).send({ azione: 'scarta' })).status).toBe(409);
  });

  it('annullare durante la pausa chiude l\'import', async () => {
    const { app, jobId, fineImport } = await importInPausa([]);

    await request(app).post(`/api/ACPV/importaPV/${jobId}/annulla`);

    expect(await fineImport()).toMatchObject({ stato: 'annullato', nonElaborate: 1 });
  });
});

describe('GET /api/ACPV/geocodifica/cerca', () => {
  it('restituisce gli indirizzi trovati da Nominatim', async () => {
    const { app, cerca } = createApp([]);

    const res = await request(app).get('/api/ACPV/geocodifica/cerca').query({ q: 'Via Grayson 20, 46100, Mantova' });

    expect(res.status).toBe(200);
    expect(res.body.risultati[0]).toMatchObject({ indirizzo: 'Via Grayson 20', cap: '46100', lat: 45.15 });
    expect(cerca).toHaveBeenCalledWith('Via Grayson 20, 46100, Mantova');
  });

  it('ricerca vuota 400, Nominatim non disponibile 503', async () => {
    const { app, cerca } = createApp([]);
    cerca.mockRejectedValueOnce(new Error('Nominatim ha risposto 503'));

    expect((await request(app).get('/api/ACPV/geocodifica/cerca').query({ q: ' ' })).status).toBe(400);
    expect((await request(app).get('/api/ACPV/geocodifica/cerca').query({ q: 'Via Roma 1' })).status).toBe(503);
  });
});

describe('development con Istanta non raggiungibile', () => {
  const NESSUNA_RISPOSTA = { data: null, status: 0, statusText: 'fetch failed' };

  it('il PV del form si salva in FP e la risposta segnala la dissincronia', async () => {
    config.NODE_ENV = 'development';
    const { app, puntoVenditaService } = createApp([NESSUNA_RISPOSTA as any]);

    const res = await request(app).put('/api/ACPV/salvaPV').send({
      guidIDCombinazione: 'comb1', nome: 'Conad Lucca', indirizzo: 'Via Roma 1', citta: 'Lucca', cap: '55100',
    });

    expect(res.status).toBe(201);
    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledOnce();
    expect(res.headers['x-istanta-dissincronia']).toBe('/ACPV/salvaPV');
  });

  it('l\'import scrive in FP e conta i PV rimasti solo in FP', async () => {
    config.NODE_ENV = 'development';
    const { app, fineImport, puntoVenditaService } = createApp([NESSUNA_RISPOSTA as any, OK]);

    await request(app).post('/api/ACPV/importaPV').attach('file', fileGenerico, 'pv.xlsx');

    expect(await fineImport()).toMatchObject({ creati: 2, soloFp: 1 });
    expect(puntoVenditaService.createPuntoVendita).toHaveBeenCalledTimes(2);
  });

  it('in produzione il PV non si salva', async () => {
    config.NODE_ENV = 'production';
    const { app, puntoVenditaService } = createApp([NESSUNA_RISPOSTA as any]);

    const res = await request(app).put('/api/ACPV/salvaPV').send({
      guidIDCombinazione: 'comb1', nome: 'Conad Lucca', indirizzo: 'Via Roma 1', citta: 'Lucca', cap: '55100',
    });

    expect(res.status).toBe(502);
    expect(puntoVenditaService.createPuntoVendita).not.toHaveBeenCalled();
  });
});
