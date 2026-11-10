import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import type { IImpostazioniGdoService } from '../../interfaces/IImpostazioniGdoService';

// Le API delle Impostazioni GDO (contratto in lib/impostazioniGdo/tipi.ts): permesso, GDO della
// sessione o indicata da chi opera per piu' GDO, sezione per sezione, Registro Audit.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));
const anagrafica = vi.hoisted(() => ({ idGdo: 'gdo-sessione' as string | null }));
const installazione = vi.hoisted(() => ({ idGdo: 'gdo-installazione' as string | null }));
const audit = vi.hoisted(() => ({ configurationChanged: vi.fn() }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codice: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (permessi.concessi.has(codice)) {
      next();
      return;
    }
    res.status(403).json({ codice });
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => audit },
}));

vi.mock('../../services/configPerGdo', () => ({
  idGdoCliente: vi.fn(async () => installazione.idGdo),
}));

vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => (anagrafica.idGdo ? { id_gdo_utentegdo: anagrafica.idGdo, id_ruolo_utente_gdo: null } : null)) },
}));

import { ImpostazioniGdoController } from '../ImpostazioniGdoController';

const IMPOSTAZIONI = { gdo: { id: 'gdo-sessione', nome: 'CONAD CNO', haIcona: false } } as never;
const ESITO_VALIDO = { valida: true, errori: [], sezioni: ['dataMapping'] };

function servizioFinto() {
  return {
    leggi: vi.fn(async () => IMPOSTAZIONI),
    salvaIdentita: vi.fn(async () => IMPOSTAZIONI),
    salvaReparti: vi.fn(async () => IMPOSTAZIONI),
    salvaCampiReferenze: vi.fn(async () => IMPOSTAZIONI),
    salvaSitoWeb: vi.fn(async () => IMPOSTAZIONI),
    verificaInsightVolantino: vi.fn(() => ESITO_VALIDO),
    salvaInsightVolantino: vi.fn(async () => IMPOSTAZIONI),
    eliminaInsightVolantino: vi.fn(async () => IMPOSTAZIONI),
  } satisfies IImpostazioniGdoService;
}

function creaApp(tipo: TIPO_UTENTI = TIPO_UTENTI.GDO) {
  const servizio = servizioFinto();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo, private_key: 'chiave-privata' } as Request['session'];
    next();
  });
  new ImpostazioniGdoController(servizio).registerRoutes(app);
  return { app, servizio };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set(['impostazioni.modifica_generali']);
  anagrafica.idGdo = 'gdo-sessione';
  installazione.idGdo = 'gdo-installazione';
});

describe('permesso', () => {
  it('senza impostazioni.modifica_generali nessuna API interroga il servizio', async () => {
    permessi.concessi = new Set(['impostazioni.visualizza']);
    const { app, servizio } = creaApp();

    const risposte = await Promise.all([
      request(app).get('/api/impostazioni-gdo'),
      request(app).put('/api/impostazioni-gdo/identita').send({ colore: null }),
      request(app).put('/api/impostazioni-gdo/reparti').send({ reparti: [] }),
      request(app).put('/api/impostazioni-gdo/campi-referenze').send({ campiReferenze: [] }),
      request(app).put('/api/impostazioni-gdo/sito-web').send({}),
      request(app).post('/api/impostazioni-gdo/insight-volantino/verifica').send({ configurazione: {} }),
      request(app).put('/api/impostazioni-gdo/insight-volantino').send({ configurazione: {} }),
      request(app).delete('/api/impostazioni-gdo/insight-volantino'),
    ]);

    expect(risposte.map(risposta => [risposta.status, risposta.body.codice])).toEqual(Array(8).fill([403, 'impostazioni.modifica_generali']));
    for (const metodo of Object.values(servizio)) expect(metodo).not.toHaveBeenCalled();
  });
});

describe('le sezioni', () => {
  it('GET: le impostazioni della GDO della sessione, con la richiesta per il catalogo dei loghi', async () => {
    const { app, servizio } = creaApp();

    const risposta = await request(app).get('/api/impostazioni-gdo');

    expect(risposta.status).toBe(200);
    expect(risposta.body).toEqual(IMPOSTAZIONI);
    expect(servizio.leggi).toHaveBeenCalledWith('gdo-sessione', expect.anything());
    expect(audit.configurationChanged).not.toHaveBeenCalled();
  });

  it('ogni PUT passa il corpo al suo salvataggio e finisce nel Registro Audit con GDO e sezione', async () => {
    const { app, servizio } = creaApp();

    await request(app).put('/api/impostazioni-gdo/identita').send({ colore: '#123456' });
    await request(app).put('/api/impostazioni-gdo/reparti').send({ reparti: [{ codice: '01' }] });
    await request(app).put('/api/impostazioni-gdo/campi-referenze').send({ campiReferenze: [] });
    await request(app).put('/api/impostazioni-gdo/sito-web').send({ css_text: '.a{}' });

    expect(servizio.salvaIdentita).toHaveBeenCalledWith('gdo-sessione', { colore: '#123456' }, expect.anything());
    expect(servizio.salvaReparti).toHaveBeenCalledWith('gdo-sessione', { reparti: [{ codice: '01' }] }, expect.anything());
    expect(servizio.salvaCampiReferenze).toHaveBeenCalledWith('gdo-sessione', { campiReferenze: [] }, expect.anything());
    // Loghi e icona si caricano su Olimpo con la chiave privata della sessione
    expect(servizio.salvaSitoWeb).toHaveBeenCalledWith('gdo-sessione', { css_text: '.a{}' }, 'chiave-privata', expect.anything());
    expect(audit.configurationChanged.mock.calls.map(chiamata => chiamata.slice(1))).toEqual([
      ['impostazioni_gdo', 'set', { idGdo: 'gdo-sessione', sezione: 'identita' }],
      ['impostazioni_gdo', 'set', { idGdo: 'gdo-sessione', sezione: 'reparti' }],
      ['impostazioni_gdo', 'set', { idGdo: 'gdo-sessione', sezione: 'campi_referenze' }],
      ['impostazioni_gdo', 'set', { idGdo: 'gdo-sessione', sezione: 'sito_web' }],
    ]);
  });

  it('configurazione degli insight: verifica, salvataggio con l\'utente della sessione, ritorno al file', async () => {
    const { app, servizio } = creaApp();

    const verifica = await request(app).post('/api/impostazioni-gdo/insight-volantino/verifica').send({ configurazione: { dataMapping: {} } });
    const salvata = await request(app).put('/api/impostazioni-gdo/insight-volantino').send({ configurazione: { dataMapping: {} } });
    const tolta = await request(app).delete('/api/impostazioni-gdo/insight-volantino');

    expect(verifica.body).toEqual(ESITO_VALIDO);
    expect(servizio.verificaInsightVolantino).toHaveBeenCalledWith({ dataMapping: {} });
    expect([salvata.status, tolta.status]).toEqual([200, 200]);
    expect(servizio.salvaInsightVolantino).toHaveBeenCalledWith('gdo-sessione', { dataMapping: {} }, 'u1', expect.anything());
    expect(servizio.eliminaInsightVolantino).toHaveBeenCalledWith('gdo-sessione', expect.anything());
    expect(audit.configurationChanged.mock.calls.map(chiamata => chiamata.slice(1))).toEqual([
      ['impostazioni_gdo', 'set', { idGdo: 'gdo-sessione', sezione: 'insight_volantino' }],
      ['impostazioni_gdo', 'clear', { idGdo: 'gdo-sessione', sezione: 'insight_volantino' }],
    ]);
  });

  it('configurazione non valida: 400 nel formato degli errori del progetto, con l\'esito in details', async () => {
    const { app, servizio } = creaApp();
    const esito = { valida: false, errori: [{ percorso: 'dataMapping', messaggio: "manca: e' obbligatorio" }], sezioni: [] };
    servizio.salvaInsightVolantino.mockRejectedValueOnce(new BadRequestError({ message: 'Configurazione degli insight non valida', details: { ...esito } }));

    const risposta = await request(app).put('/api/impostazioni-gdo/insight-volantino').send({ configurazione: { reparti: {} } });

    expect(risposta.status).toBe(400);
    expect(risposta.body).toMatchObject({ message: 'Configurazione degli insight non valida', details: esito });
    expect(audit.configurationChanged).not.toHaveBeenCalled();
  });

  it('senza { configurazione } nel corpo si verifica il niente, che non e\' valido', async () => {
    const { app, servizio } = creaApp();

    await request(app).post('/api/impostazioni-gdo/insight-volantino/verifica').send({ altro: 1 });

    expect(servizio.verificaInsightVolantino).toHaveBeenCalledWith(undefined);
  });
});

describe('GDO delle impostazioni', () => {
  it('un utente GDO resta nella sua GDO anche se ne indica un\'altra', async () => {
    const { app, servizio } = creaApp(TIPO_UTENTI.GDO);

    await request(app).get('/api/impostazioni-gdo?gdo=altra-gdo');

    expect(servizio.leggi).toHaveBeenCalledWith('gdo-sessione', expect.anything());
  });

  it('il Superadmin usa quella in ?gdo=, altrimenti quella dell\'installazione', async () => {
    anagrafica.idGdo = null;
    const { app, servizio } = creaApp(TIPO_UTENTI.SUPERADMIN);

    await request(app).get('/api/impostazioni-gdo?gdo=gdo-indicata');
    await request(app).put('/api/impostazioni-gdo/reparti').send({ reparti: [] });

    expect(servizio.leggi).toHaveBeenCalledWith('gdo-indicata', expect.anything());
    expect(servizio.salvaReparti).toHaveBeenCalledWith('gdo-installazione', { reparti: [] }, expect.anything());
  });

  it('senza nessuna GDO la richiesta non e\' valida', async () => {
    anagrafica.idGdo = null;
    installazione.idGdo = null;
    const { app, servizio } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const risposta = await request(app).get('/api/impostazioni-gdo');

    expect(risposta.status).toBe(400);
    expect(servizio.leggi).not.toHaveBeenCalled();
  });

  it('una GDO che non esiste e\' 404', async () => {
    const { app, servizio } = creaApp();
    servizio.leggi.mockRejectedValueOnce(new NotFoundError({ message: 'GDO non trovata', entityType: 'GDO', entityId: 'gdo-sessione' }));

    expect((await request(app).get('/api/impostazioni-gdo')).status).toBe(404);
  });
});
