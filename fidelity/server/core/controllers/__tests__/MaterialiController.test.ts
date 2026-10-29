import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { NotFoundError } from '../../../../lib/errors';
import type { IMaterialiService } from '../../interfaces/IMaterialiService';
import type { IMaterialiRepository } from '../../repositories/MaterialiRepository';
import { MaterialiService } from '../../services/MaterialiService';
import { MaterialiController } from '../MaterialiController';

// Permessi dell'utente di prova: senza quello chiesto, la risposta dice quale permesso manca
const permessi = vi.hoisted(() => ({ concessi: new Set<string>() }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
  integrationAuthMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
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

const FORMATO = '0f000000-0000-4000-8000-000000000002';
const FILE_1 = 'f1000000-0000-4000-8000-000000000001';

function servizioFinto(dati: Partial<IMaterialiService> = {}): IMaterialiService {
  return {
    getVolantini: vi.fn<IMaterialiService['getVolantini']>(),
    getPromozioniPop: vi.fn<IMaterialiService['getPromozioniPop']>(async () => ({ promozioni: [] })),
    getRiepilogoPop: vi.fn<IMaterialiService['getRiepilogoPop']>(),
    getFilePop: vi.fn<IMaterialiService['getFilePop']>(),
    preparaZipPop: vi.fn<IMaterialiService['preparaZipPop']>(async () => ({ nomeFile: 'Promo ottobre - Espositori.zip', voci: [] })),
    scriviZipPop: vi.fn<IMaterialiService['scriviZipPop']>(async (_zip, destinazione) => {
      destinazione.end(Buffer.from('PK finto'));
      return { file: 1, mancanti: 0 };
    }),
    ...dati,
  };
}

function creaApp(servizio: IMaterialiService) {
  const app = express();
  app.use(express.json());
  new MaterialiController(servizio).registerRoutes(app);
  return app;
}

beforeEach(() => {
  permessi.concessi = new Set(['materiali.visualizza', 'file.download']);
});

describe('/api/materiali: parametri', () => {
  it.each([
    ['/api/materiali/volantini?periodo=futuro'],
    ['/api/materiali/volantini'],
    ['/api/materiali/pop/promozioni'],
    ['/api/materiali/pop/promozioni/p1/formati?periodo=correnti'],
    [`/api/materiali/pop/promozioni/p1/file?periodo=&idFormato=${FORMATO}`],
    [`/api/materiali/pop/promozioni/p1/zip?periodo=domani&idFormato=${FORMATO}`],
  ])('periodo mancante o non valido: 400 (%s)', async (url) => {
    const servizio = servizioFinto();

    const res = await request(creaApp(servizio)).get(url);

    expect(res.status).toBe(400);
    expect(servizio.getVolantini).not.toHaveBeenCalled();
    expect(servizio.getPromozioniPop).not.toHaveBeenCalled();
    expect(servizio.preparaZipPop).not.toHaveBeenCalled();
  });

  it('i filtri dei volantini arrivano al servizio, pagina e dimensione come numeri', async () => {
    const servizio = servizioFinto();

    await request(creaApp(servizio)).get('/api/materiali/volantini?periodo=attivi&cerca=%20ottobre&stato=PUBBLICATO&pagina=2&dimensione=48');

    expect(servizio.getVolantini).toHaveBeenCalledWith(
      expect.objectContaining({ periodo: 'attivi', cerca: 'ottobre', stato: 'PUBBLICATO', pagina: 2, dimensione: 48 }),
      expect.anything()
    );
  });

  it('file POP: una dimensione di pagina diversa da 100, 250 e 500 vale 100', async () => {
    const repository = {
      trovaPromo: vi.fn<IMaterialiRepository['trovaPromo']>(async () => ({
        id_promo: 'p1', nome_promo: 'Promo ottobre', stato_promo: STATO_PROMO.VALIDA, validita_dal: null, validita_al: null,
      })),
      elencaFile: vi.fn<IMaterialiRepository['elencaFile']>(async () => []),
      contaFile: vi.fn<IMaterialiRepository['contaFile']>(async () => 0),
      elencaOpzioniFile: vi.fn<IMaterialiRepository['elencaOpzioniFile']>(async () => []),
    } as Partial<IMaterialiRepository> as IMaterialiRepository;
    const servizio = new MaterialiService(repository, { getAllKitPerGestioneLavorazione: vi.fn() }, { scriviZipDaOlimpo: vi.fn() });
    const app = creaApp(servizio);

    const fuoriElenco = await request(app).get(`/api/materiali/pop/promozioni/p1/file?periodo=attivi&idFormato=${FORMATO}&pagina=3&dimensione=1000`);
    const prevista = await request(app).get(`/api/materiali/pop/promozioni/p1/file?periodo=attivi&idFormato=${FORMATO}&dimensione=500`);

    expect(fuoriElenco.status).toBe(200);
    expect(fuoriElenco.body).toMatchObject({ pagina: 3, dimensione: 100, totale: 0, file: [] });
    expect(repository.elencaFile).toHaveBeenNthCalledWith(1, expect.any(Object), expect.any(Object), { limite: 100, scarto: 200 });
    expect(prevista.body).toMatchObject({ pagina: 1, dimensione: 500 });
  });
});

describe('/api/materiali: ZIP dei file POP', () => {
  it('oltre a consultare i materiali serve il permesso di scaricare i file', async () => {
    permessi.concessi = new Set(['materiali.visualizza']);
    const servizio = servizioFinto();
    const app = creaApp(servizio);

    const get = await request(app).get(`/api/materiali/pop/promozioni/p1/zip?periodo=attivi&idFormato=${FORMATO}`);
    const post = await request(app).post('/api/materiali/pop/promozioni/p1/zip').send({ periodo: 'attivi', idFormato: FORMATO });

    expect([get.status, get.body.codice]).toEqual([403, 'file.download']);
    expect([post.status, post.body.codice]).toEqual([403, 'file.download']);
    expect(servizio.preparaZipPop).not.toHaveBeenCalled();
  });

  it('senza il permesso di consultare i materiali non si arriva al download', async () => {
    permessi.concessi = new Set(['file.download']);

    const res = await request(creaApp(servizioFinto())).get(`/api/materiali/pop/promozioni/p1/zip?periodo=attivi&idFormato=${FORMATO}`);

    expect([res.status, res.body.codice]).toEqual([403, 'materiali.visualizza']);
  });

  it('le altre route chiedono solo di consultare i materiali', async () => {
    permessi.concessi = new Set(['materiali.visualizza']);

    const res = await request(creaApp(servizioFinto())).get('/api/materiali/pop/promozioni?periodo=attivi');

    expect(res.status).toBe(200);
  });

  it('GET: lo ZIP dei file filtrati arriva in streaming, con il nome della promo e del formato', async () => {
    const servizio = servizioFinto();

    const res = await request(creaApp(servizio))
      .get(`/api/materiali/pop/promozioni/p1/zip?periodo=attivi&idFormato=${FORMATO}&reparto=Ortofrutta&stato=ERRORE`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('Promo ottobre - Espositori.zip');
    expect(servizio.preparaZipPop).toHaveBeenCalledWith('p1', {
      periodo: 'attivi',
      idFormato: FORMATO,
      filtri: expect.objectContaining({ reparto: 'Ortofrutta', stato: 'ERRORE' }),
    });
    expect(servizio.scriviZipPop).toHaveBeenCalledTimes(1);
  });

  it('POST: i file selezionati del body', async () => {
    const servizio = servizioFinto();

    const res = await request(creaApp(servizio))
      .post('/api/materiali/pop/promozioni/p1/zip')
      .send({ periodo: 'storico', idFormato: FORMATO, idFile: [FILE_1, 42] });

    expect(res.status).toBe(200);
    expect(servizio.preparaZipPop).toHaveBeenCalledWith('p1', expect.objectContaining({
      periodo: 'storico', idFormato: FORMATO, idFile: [FILE_1],
    }));
  });

  it('niente da scaricare: 404 in JSON, senza l\'intestazione del download', async () => {
    const servizio = servizioFinto({
      preparaZipPop: vi.fn<IMaterialiService['preparaZipPop']>(async () => {
        throw new NotFoundError({ message: 'Nessun file da scaricare per questa selezione.', entityType: 'FilePop' });
      }),
    });

    const res = await request(creaApp(servizio)).get(`/api/materiali/pop/promozioni/p1/zip?periodo=attivi&idFormato=${FORMATO}`);

    expect(res.status).toBe(404);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.headers['content-type']).toContain('application/json');
    expect(servizio.scriviZipPop).not.toHaveBeenCalled();
  });
});
