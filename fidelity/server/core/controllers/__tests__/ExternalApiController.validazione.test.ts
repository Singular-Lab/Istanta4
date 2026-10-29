import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Le credenziali hanno il proprio test (protezioni): qui ogni richiesta e' gia' autenticata
const passa = vi.hoisted(() => (_req: Request, _res: Response, next: NextFunction) => { next(); });

vi.mock('../../middleware/authMiddleware', () => ({ authMiddleware: passa, integrationAuthMiddleware: passa }));
vi.mock('../../middleware/ephemeralTokenAuthMiddleware', () => ({ ephemeralTokenAuthMiddleware: passa }));
vi.mock('../../middleware/permissionGuard', () => ({ permissionGuard: () => passa }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../di', () => ({ TYPES: {}, container: { get: vi.fn() } }));

import { sequelize } from '../../db/SequelizeConnector';
import type { CreateStatisticheApiDTO } from '../../dto';
import { TipiDiExport } from '../../models';
import { FilesRuntime } from '../../models/files_runtime';
import { FilterTemplate } from '../../models/filter_template';
import { RuntimeKit } from '../../models/runtime_kit';
import { ExternalApiService } from '../../services/ExternalApiService';
import { FilterTemplateService } from '../../services/FilterTemplateService';
import type { StatisticheApiService } from '../../services/StatisticheApiService';
import { ExternalApiController } from '../ExternalApiController';

const BASE = '/api/external';

type Query = typeof sequelize.query;
type RigheFiles = Awaited<ReturnType<typeof FilesRuntime.findAll>>;
type RigheTipiExport = Awaited<ReturnType<typeof TipiDiExport.findAll>>;
type RigheRuntime = Awaited<ReturnType<typeof RuntimeKit.findAll>>;
type TemplateTrovato = Awaited<ReturnType<typeof FilterTemplate.findOne>>;

/** Registro delle statistiche simulato: il controller lo chiama in setImmediate, dopo la risposta. */
const nuoveStatistiche = () => ({ registraStatistica: vi.fn(async (_dto: CreateStatisticheApiDTO) => undefined) });

/** Controller e servizio veri: solo il database (e il registro delle statistiche) e' simulato. */
function creaApp(statistiche = nuoveStatistiche()) {
  const app = express();
  app.use(express.json());
  new ExternalApiController(
    new ExternalApiService(),
    statistiche as unknown as StatisticheApiService,
    new FilterTemplateService(),
  ).registerRoutes(app);
  return app;
}

// Nessun database nei test: ogni lettura risponde vuota, e i casi non validi non devono arrivarci
const simulaQuery = () => vi.spyOn(sequelize, 'query').mockImplementation((async () => []) as unknown as Query);
const simulaFileRuntime = () => vi.spyOn(FilesRuntime, 'findAll').mockResolvedValue([] as unknown as RigheFiles);
const simulaTipiExport = () => vi.spyOn(TipiDiExport, 'findAll').mockResolvedValue([] as unknown as RigheTipiExport);

let query: ReturnType<typeof simulaQuery>;
let fileRuntime: ReturnType<typeof simulaFileRuntime>;
let tipiExport: ReturnType<typeof simulaTipiExport>;

/** Le replacements della prima query SQL: cio' che arriva davvero al database. */
function replacementsDellaPrimaQuery() {
  const opzioni = query.mock.calls[0]?.[1] as { replacements?: Record<string, unknown> } | undefined;
  return opzioni?.replacements;
}

beforeEach(() => {
  query = simulaQuery();
  fileRuntime = simulaFileRuntime();
  tipiExport = simulaTipiExport();
});

describe('richieste incomplete o non valide alle API esterne (mai 500 per un input sbagliato)', () => {
  describe.each(['refs', 'refs-html'])('POST /%s', (percorso) => {
    it('senza corpo risponde 400 e non interroga il database', async () => {
      const res = await request(creaApp()).post(`${BASE}/${percorso}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('è obbligatorio selezionare almeno un template kit');
      expect(query).not.toHaveBeenCalled();
    });

    it('con template_id come elenco vuoto risponde 400', async () => {
      const res = await request(creaApp()).post(`${BASE}/${percorso}`).send({ template_id: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('è obbligatorio selezionare almeno un template kit');
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      ['un testo vuoto', ''],
      ['un testo', 'abc'],
      ['un elenco con un numero', [5]],
      ['un numero', 5],
      ['un oggetto', { id: 't1' }],
    ])('con template_id che e\' %s invece di un elenco di testi risponde 400', async (_caso, templateId) => {
      const res = await request(creaApp()).post(`${BASE}/${percorso}`).send({ template_id: templateId });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('template_id deve essere un elenco di identificativi');
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      ['un testo', 'prezzo=5'],
      ['un oggetto', { field: 'prezzo', operator: 'equals', value: '5' }],
      ['un numero', 5],
    ])('con filters che e\' %s invece di un elenco risponde 400', async (_caso, filters) => {
      const res = await request(creaApp()).post(`${BASE}/${percorso}`).send({ template_id: ['t1'], filters });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('filters deve essere un elenco di gruppi di condizioni');
      expect(query).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['un gruppo che non e\' un elenco', [{ field: 'prezzo', operator: 'equals', value: '5' }], 'Il gruppo di filtri 1 deve essere un elenco di condizioni'],
    ['una condizione che non e\' un oggetto', [['prezzo=5']], 'Il gruppo di filtri 1 contiene una condizione non valida'],
    ['una condizione nulla', [[null]], 'Il gruppo di filtri 1 contiene una condizione non valida'],
    ['un campo che non e\' un testo', [[], [{ field: 7, operator: 'equals', value: '5' }]], 'Il gruppo di filtri 2 ha un campo non valido'],
  ])('POST /refs con %s risponde 400 con il motivo', async (_caso, filters, messaggio) => {
    const res = await request(creaApp()).post(`${BASE}/refs`).send({ template_id: ['t1'], filters });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(messaggio);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['un oggetto', { min: 1, max: 9 }],
    ['un elenco', ['1', '2']],
  ])('POST /refs con un valore di filtro che e\' %s risponde 400 con il nome del campo', async (_caso, value) => {
    const res = await request(creaApp())
      .post(`${BASE}/refs`)
      .send({ template_id: ['t1'], filters: [[{ field: 'prezzo', operator: 'equals', value }]] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Il filtro sul campo "prezzo" ha un valore non valido');
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['numero con equals', 'equals', 5, '5'],
    ['booleano con equals', 'equals', true, 'true'],
    ['numero con in', 'in', 5, ['5']],
    ['numero con not_contains', 'not_contains', 12, '%12%'],
  ])('POST /refs accetta un valore %s e lo passa al database come testo', async (_caso, operator, value, atteso) => {
    const res = await request(creaApp())
      .post(`${BASE}/refs`)
      .send({ template_id: ['t1'], filters: [[{ field: 'prezzo', operator, value }]] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conteggio).toBe(0);
    expect(replacementsDellaPrimaQuery()).toEqual({ templateIds: ['t1'], p0: atteso });
  });

  it('POST /refs con un valore numerico e la priorita\' confronta il valore e ordina le referenze', async () => {
    const riga = {
      id: 'ref1', id_runtime_kit: 'rk1', id_promo: 'p1', nome_promo: 'Volantino',
      validita_dal: '2026-10-01T00:00:00.000Z', validita_al: '2026-10-31T00:00:00.000Z',
      data_fields: { prezzo: 5 }, foto: [], createdAt: '2026-10-02T00:00:00.000Z',
      kit_design_trovati: '1', kit_runtime_trovati: '1', promo_valide: '1',
    };
    query.mockImplementation((async () => [riga]) as unknown as Query);
    vi.spyOn(RuntimeKit, 'findAll').mockResolvedValue([{ id: 'rk1', id_design: 'd1' }] as unknown as RigheRuntime);

    const res = await request(creaApp())
      .post(`${BASE}/refs`)
      .send({ template_id: ['t1'], filters: [[{ field: 'prezzo', operator: 'equals', value: 5, priority: 3 }]] });

    expect(res.status).toBe(200);
    expect(replacementsDellaPrimaQuery()).toEqual({ templateIds: ['t1'], p0: '5' });
    expect(res.body.data.conteggio).toBe(1);
    expect(res.body.data.risposta[0].kit[0].referenze[0]).toMatchObject({ id: 'ref1', _matchPriority: 3 });
  });

  describe('POST /files', () => {
    it('senza corpo risponde con l\'elenco dei file, non con un errore', async () => {
      const res = await request(creaApp()).post(`${BASE}/files`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ conteggio: 0, files: [], filtri_applicati: 0, tipo_export_richiesti: 0 });
      expect(fileRuntime).toHaveBeenCalledOnce();
    });

    it('con filters che non e\' un elenco risponde 400 e non legge i file', async () => {
      const res = await request(creaApp()).post(`${BASE}/files`).send({ filters: { field: 'formato' } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('filters deve essere un elenco di gruppi di condizioni');
      expect(fileRuntime).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      ['un testo', 'VOL'],
      ['un elenco con un numero', ['VOL', 3]],
      ['un oggetto', { codice: 'VOL' }],
    ])('con tipo_export che e\' %s invece di un elenco di codici risponde 400', async (_caso, tipoExport) => {
      const res = await request(creaApp()).post(`${BASE}/files`).send({ tipo_export: tipoExport });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('tipo_export deve essere un elenco di codici');
      expect(tipiExport).not.toHaveBeenCalled();
      expect(fileRuntime).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });

    it('con un valore di filtro oggetto risponde 400 con il nome del campo', async () => {
      const res = await request(creaApp())
        .post(`${BASE}/files`)
        .send({ filters: [[{ field: 'formato', operator: 'equals', value: { a: 1 } }]] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Il filtro sul campo "formato" ha un valore non valido');
      expect(query).not.toHaveBeenCalled();
    });

    it('con un valore numerico lo passa al database come testo', async () => {
      const res = await request(creaApp())
        .post(`${BASE}/files`)
        .send({ filters: [[{ field: 'pagina', operator: 'in', value: 4 }]] });

      expect(res.status).toBe(200);
      expect(replacementsDellaPrimaQuery()).toEqual({ p0: ['4'] });
    });
  });

  describe.each(['refs', 'files'])('POST /%s/field-values', (percorso) => {
    it('senza corpo risponde 400', async () => {
      const res = await request(creaApp()).post(`${BASE}/${percorso}/field-values`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: 'Il parametro "field" è obbligatorio e deve essere un testo' });
      expect(query).not.toHaveBeenCalled();
    });

    it.each([
      ['corpo vuoto', {}],
      ['field vuoto', { field: '' }],
      ['field di soli spazi', { field: '   ' }],
      ['field numero', { field: 5 }],
      ['field oggetto', { field: { nome: 'formato' } }],
      ['field elenco', { field: ['formato'] }],
    ])('con %s risponde 400', async (_caso, corpo) => {
      const res = await request(creaApp()).post(`${BASE}/${percorso}/field-values`).send(corpo);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: 'Il parametro "field" è obbligatorio e deve essere un testo' });
      expect(query).not.toHaveBeenCalled();
    });

    it('con un field valido legge i valori di quel campo', async () => {
      query.mockImplementation((async () => [{ val: 'A4' }]) as unknown as Query);

      const res = await request(creaApp()).post(`${BASE}/${percorso}/field-values`).send({ field: 'formato' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ field: 'formato', values: ['A4'] });
      expect(replacementsDellaPrimaQuery()).toEqual({ field: 'formato' });
    });
  });

  it.each([
    ['un testo', 'abc'],
    ['un elenco con un numero', [5]],
    ['un oggetto', { id: 't1' }],
  ])('POST /refs/field-values con template_id che e\' %s risponde 400', async (_caso, templateId) => {
    const res = await request(creaApp()).post(`${BASE}/refs/field-values`).send({ field: 'formato', template_id: templateId });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Il parametro "template_id" deve essere un elenco di identificativi' });
    expect(query).not.toHaveBeenCalled();
  });

  describe('GET /filter-templates/slug/:slug', () => {
    it('uno slug che non esiste risponde 404', async () => {
      const findOne = vi.spyOn(FilterTemplate, 'findOne').mockResolvedValue(null as TemplateTrovato);

      const res = await request(creaApp()).get(`${BASE}/filter-templates/slug/Nessun-Template`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: 'Template non trovato o non attivo' });
      expect(findOne).toHaveBeenCalledWith({
        where: { slug: 'nessun-template', is_active: true, deleted_at: null, is_latest: true },
      });
    });

    it('una versione valida che non esiste risponde 404 e cerca proprio quella versione', async () => {
      const findOne = vi.spyOn(FilterTemplate, 'findOne').mockResolvedValue(null as TemplateTrovato);

      const res = await request(creaApp()).get(`${BASE}/filter-templates/slug/volantino?version=3`);

      expect(res.status).toBe(404);
      expect(findOne).toHaveBeenCalledWith({
        where: { slug: 'volantino', is_active: true, deleted_at: null, version: 3 },
      });
    });

    it.each(['abc', '0', '-2', ''])('con version=%s risponde 400 senza cercare il template', async (version) => {
      const findOne = vi.spyOn(FilterTemplate, 'findOne').mockResolvedValue(null as TemplateTrovato);

      const res = await request(creaApp()).get(`${BASE}/filter-templates/slug/volantino`).query({ version });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: 'Il parametro "version" deve essere un intero positivo' });
      expect(findOne).not.toHaveBeenCalled();
    });
  });
});

describe('statistiche delle API esterne', () => {
  it('una richiesta non valida a /refs e\' registrata con il codice 400 della risposta, non 500', async () => {
    const statistiche = nuoveStatistiche();

    const res = await request(creaApp(statistiche)).post(`${BASE}/refs`).send({ template_id: 'abc' });

    expect(res.status).toBe(400);
    await vi.waitFor(() => {
      expect(statistiche.registraStatistica).toHaveBeenCalledOnce();
    });
    expect(statistiche.registraStatistica).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/api/external/refs',
      metodo: 'POST',
      codice_risposta: 400,
      errore: 'template_id deve essere un elenco di identificativi',
    }));
  });

  it('una richiesta valida a /refs e\' registrata con il codice 200', async () => {
    const statistiche = nuoveStatistiche();

    const res = await request(creaApp(statistiche)).post(`${BASE}/refs`).send({ template_id: ['t1'] });

    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(statistiche.registraStatistica).toHaveBeenCalledOnce();
    });
    expect(statistiche.registraStatistica).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/api/external/refs',
      codice_risposta: 200,
      errore: undefined,
    }));
  });
});
