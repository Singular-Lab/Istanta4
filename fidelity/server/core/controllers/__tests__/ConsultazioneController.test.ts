import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DettaglioPromozioneVolantiniConsultazione } from '../../../../lib/consultazione/tipi';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { IConsultazioneService } from '../../interfaces/IConsultazioneService';

// Le API di consultazione: il permesso di ogni route, la GDO della sessione passata al servizio
// (Superadmin senza GDO: tutte; utente senza GDO: nessuna) e il download come allegato.

const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));
const anagrafica = vi.hoisted(() => ({ idGdo: 'gdo-sessione' as string | null }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: (codici: string | string[]) => (_req: Request, res: Response, next: NextFunction) => {
    const elenco = Array.isArray(codici) ? codici : [codici];
    if (elenco.some(codice => permessi.concessi.has(codice))) {
      next();
      return;
    }
    res.status(403).json({ codici: elenco });
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => (anagrafica.idGdo ? { id_gdo_utentegdo: anagrafica.idGdo, id_ruolo_utente_gdo: null } : null)) },
}));

import { ConsultazioneController } from '../ConsultazioneController';

const ID = '7f4c2b1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';

const DETTAGLIO_PROMOZIONE: DettaglioPromozioneVolantiniConsultazione = {
  promo: { id: 'PROMO-2026-45', nome: 'Volantino 45', validitaDal: '2026-11-05', validitaAl: '2026-11-18' },
  periodo: 'attivi',
  kit: [],
  numeroKitTotale: 0,
  insegne: [],
  opzioni: { insegne: [], aree: [] },
  loghiInsegne: {},
  numeri: { kit: 0, pagine: 0, puntiVendita: 0, localita: 0, regioni: 0, prodotti: 0, referenze: 0, scontoMedio: null, sottocosto: 0 },
  puntiVendita: [],
  assortimento: { prodotti: { inTutti: 0, inAlcuni: 0, inUnoSolo: 0 }, fasceSconto: [], reparti: [], meccanichePerCanale: [], marche: [] },
};

function creaApp(tipo: TIPO_UTENTI = TIPO_UTENTI.GDO) {
  const vuota = { kit: [], totale: 0, pagina: 1, dimensione: 24 };
  const servizio = {
    getVolantini: vi.fn(async () => vuota),
    getPromozioniVolantini: vi.fn(),
    getPromozioneVolantini: vi.fn(async () => DETTAGLIO_PROMOZIONE),
    getVolantino: vi.fn(async () => ({
      id: ID,
      titolo: 'Volantino',
      promo: { id: ID, nome: 'Promo', validitaDal: null, validitaAl: null },
      area: { id: 'a1', nome: 'Nord' },
      canale: { id: 'c1', nome: 'Super' },
      file: [],
    })),
    getPromozioniPop: vi.fn(async () => ({ promozioni: [] })),
    getRiepilogoPop: vi.fn(),
    getFilePop: vi.fn(),
    getOpzioniFilePop: vi.fn(),
    verificaZipPop: vi.fn(async () => ({ file: 2, nomeFile: 'Promo - A5.zip' })),
    preparaZipPop: vi.fn(),
    scriviZipPop: vi.fn(),
    getContenutiDigitali: vi.fn(async () => ({ file: [], totale: 0, pagina: 1, dimensione: 10 })),
    getOpzioniContenutiDigitali: vi.fn(),
    scaricaFile: vi.fn(async () => ({ nome: 'Volantino Natale.pdf', mime: 'application/pdf', contenuto: Buffer.from('%PDF-1.7') })),
  } satisfies IConsultazioneService;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u1', tipo_utente: tipo } as Request['session'];
    next();
  });
  new ConsultazioneController(servizio).registerRoutes(app);
  return { app, servizio };
}

beforeEach(() => {
  vi.clearAllMocks();
  permessi.concessi = new Set();
  anagrafica.idGdo = 'gdo-sessione';
});

describe('permessi delle API di consultazione', () => {
  it('i volantini si leggono con la panoramica, le viste dei materiali o la dashboard Category', async () => {
    for (const permesso of ['volantini.visualizza', 'materiali.visualizza', 'analisi.dashboard_category']) {
      permessi.concessi = new Set([permesso]);
      const { app } = creaApp();
      expect((await request(app).get('/api/consultazione/volantini?periodo=attivi')).status).toBe(200);
      expect((await request(app).get(`/api/consultazione/volantini/${ID}`)).status).toBe(200);
    }

    permessi.concessi = new Set(['promo.visualizza', 'file.download']);
    expect((await request(creaApp().app).get('/api/consultazione/volantini?periodo=attivi')).status).toBe(403);
  });

  it('il dettaglio di una promozione chiede materiali.visualizza, come gli insight che riassume', async () => {
    for (const permesso of ['volantini.visualizza', 'analisi.dashboard_category']) {
      permessi.concessi = new Set([permesso]);
      const { app, servizio } = creaApp();
      const risposta = await request(app).get('/api/consultazione/volantini/promozioni/PROMO-2026-45');
      expect([risposta.status, risposta.body.codici], permesso).toEqual([403, ['materiali.visualizza']]);
      expect(servizio.getPromozioneVolantini).not.toHaveBeenCalled();
    }

    permessi.concessi = new Set(['materiali.visualizza']);
    const { app, servizio } = creaApp();
    const risposta = await request(app).get('/api/consultazione/volantini/promozioni/PROMO-2026-45');
    expect(risposta.status).toBe(200);
    expect(risposta.body).toEqual(DETTAGLIO_PROMOZIONE);
    // La rotta del dettaglio di un kit non la intercetta
    expect(servizio.getVolantino).not.toHaveBeenCalled();
  });

  it('POP e contenuti digitali chiedono materiali.visualizza; lo ZIP e il download materiali.scarica', async () => {
    permessi.concessi = new Set(['volantini.visualizza', 'file.download', 'ordini_stampa.visualizza']);
    const { app } = creaApp();
    expect((await request(app).get('/api/consultazione/pop/promozioni?periodo=attivi')).status).toBe(403);
    expect((await request(app).get('/api/consultazione/contenuti-digitali')).status).toBe(403);
    const download = await request(app).get(`/api/consultazione/file/${ID}`);
    expect([download.status, download.body.codici]).toEqual([403, ['materiali.scarica']]);

    permessi.concessi = new Set(['materiali.visualizza']);
    const conConsultazione = creaApp().app;
    expect((await request(conConsultazione).get('/api/consultazione/pop/promozioni?periodo=attivi')).status).toBe(200);
    expect((await request(conConsultazione).get('/api/consultazione/contenuti-digitali')).status).toBe(200);
    const zip = await request(conConsultazione)
      .post(`/api/consultazione/pop/promozioni/${ID}/zip/verifica`)
      .send({ periodo: 'attivi', idFormato: ID });
    expect([zip.status, zip.body.codici]).toEqual([403, ['materiali.scarica']]);

    permessi.concessi = new Set(['materiali.visualizza', 'materiali.scarica']);
    expect((await request(creaApp().app).post(`/api/consultazione/pop/promozioni/${ID}/zip/verifica`)
      .send({ periodo: 'attivi', idFormato: ID })).status).toBe(200);
  });
});

describe('GDO dei dati di consultazione', () => {
  beforeEach(() => {
    permessi.concessi = new Set(['volantini.visualizza']);
  });

  it('un utente GDO legge la sua GDO, anche se ne indica un\'altra', async () => {
    const { app, servizio } = creaApp(TIPO_UTENTI.GDO);
    await request(app).get('/api/consultazione/volantini?periodo=storico&gdo=altra-gdo&idArea=a1&pagina=2&dimensione=10');
    expect(servizio.getVolantini).toHaveBeenCalledWith(
      { periodo: 'storico', cerca: undefined, idPromo: undefined, idArea: 'a1', idCanale: undefined, pagina: 2, dimensione: 10 },
      { idGdo: 'gdo-sessione' }
    );
  });

  it('il Superadmin senza GDO legge tutte le GDO, o quella che indica', async () => {
    anagrafica.idGdo = null;
    const { app, servizio } = creaApp(TIPO_UTENTI.SUPERADMIN);
    await request(app).get('/api/consultazione/volantini?periodo=attivi');
    await request(app).get('/api/consultazione/volantini?periodo=attivi&gdo=coop-firenze');
    expect(servizio.getVolantini.mock.calls.map(chiamata => (chiamata as unknown[])[1])).toEqual(['tutte', { idGdo: 'coop-firenze' }]);
  });

  it('un utente senza GDO non legge i dati di nessuna', async () => {
    anagrafica.idGdo = null;
    const { app, servizio } = creaApp(TIPO_UTENTI.CATEGORY);
    await request(app).get('/api/consultazione/volantini?periodo=attivi');
    expect((servizio.getVolantini.mock.calls[0] as unknown[])[1]).toBe('nessuna');
  });

  it('un periodo sconosciuto e\' una richiesta non valida', async () => {
    const { app, servizio } = creaApp();
    const risposta = await request(app).get('/api/consultazione/volantini?periodo=in-corso');
    expect(risposta.status).toBe(400);
    expect(servizio.getVolantini).not.toHaveBeenCalled();
  });
});

describe('dettaglio di consultazione della promozione', () => {
  beforeEach(() => {
    permessi.concessi = new Set(['materiali.visualizza']);
  });

  it('passa al servizio l\'id della promo, anche se non e\' un UUID, e la GDO della sessione', async () => {
    const { app, servizio } = creaApp(TIPO_UTENTI.GDO);
    await request(app).get(`/api/consultazione/volantini/promozioni/${encodeURIComponent('PROMO/2026 45')}?gdo=altra-gdo`);
    expect(servizio.getPromozioneVolantini).toHaveBeenCalledWith('PROMO/2026 45', { idGdo: 'gdo-sessione' }, { idArea: undefined, idCanale: undefined });
  });

  it('passa al servizio i filtri del dettaglio della promozione: insegna (idCanale) e area', async () => {
    const { app, servizio } = creaApp(TIPO_UTENTI.GDO);
    await request(app).get(`/api/consultazione/volantini/promozioni/PROMO-2026-45?idCanale=${ID}&idArea=%20${ID}%20`);
    expect(servizio.getPromozioneVolantini).toHaveBeenCalledWith('PROMO-2026-45', { idGdo: 'gdo-sessione' }, { idArea: ID, idCanale: ID });
  });

  it('il Superadmin senza GDO legge tutte le GDO, o quella che indica', async () => {
    anagrafica.idGdo = null;
    const { app, servizio } = creaApp(TIPO_UTENTI.SUPERADMIN);
    await request(app).get(`/api/consultazione/volantini/promozioni/${ID}`);
    await request(app).get(`/api/consultazione/volantini/promozioni/${ID}?gdo=coop-firenze`);
    expect(servizio.getPromozioneVolantini.mock.calls.map(chiamata => (chiamata as unknown[])[1])).toEqual(['tutte', { idGdo: 'coop-firenze' }]);
  });

  it('una promozione non disponibile risponde 404 in JSON, con il motivo', async () => {
    const { app, servizio } = creaApp();
    servizio.getPromozioneVolantini.mockRejectedValueOnce(
      new NotFoundError({ message: 'Promozione non disponibile', entityType: 'Promo', entityId: 'PROMO-2026-45' })
    );
    const risposta = await request(app).get('/api/consultazione/volantini/promozioni/PROMO-2026-45');

    expect(risposta.status).toBe(404);
    expect(risposta.body.message).toBe('Promozione non disponibile');
  });
});

describe('download di un file pubblicato', () => {
  beforeEach(() => {
    permessi.concessi = new Set(['materiali.scarica']);
  });

  it('arriva come allegato con il suo nome e il suo tipo', async () => {
    const { app, servizio } = creaApp();
    // Il corpo come Buffer, qualunque sia il tipo del file
    const risposta = await request(app).get(`/api/consultazione/file/${ID}`).buffer(true).parse((res, fine) => {
      const parti: Buffer[] = [];
      res.on('data', (parte: Buffer) => parti.push(parte));
      res.on('end', () => fine(null, Buffer.concat(parti)));
    });

    expect(risposta.status).toBe(200);
    expect(risposta.headers['content-type']).toContain('application/pdf');
    expect(risposta.headers['content-disposition']).toContain('attachment');
    expect(risposta.headers['content-disposition']).toContain('Volantino Natale.pdf');
    expect((risposta.body as Buffer).toString()).toBe('%PDF-1.7');
    expect(servizio.scaricaFile).toHaveBeenCalledWith(ID, { idGdo: 'gdo-sessione' });
  });

  it('un file non disponibile risponde 404 in JSON, con il motivo', async () => {
    const { app, servizio } = creaApp();
    servizio.scaricaFile.mockRejectedValueOnce(new NotFoundError({ message: 'File non disponibile', entityType: 'FileRuntime', entityId: ID }));
    const risposta = await request(app).get(`/api/consultazione/file/${ID}`);

    expect(risposta.status).toBe(404);
    expect(risposta.headers['content-disposition']).toBeUndefined();
    expect(risposta.body.message).toBe('File non disponibile');
  });
});
