import express from 'express';
import fs from 'node:fs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_LAVORAZIONE_KIT_RUNTIME } from '../../../../lib/enums';

// Multer vero (multipart come dal Dettaglio kit), con i temporanei in una cartella di prova
vi.mock('../../config/multerConfig', async () => {
  const { default: multer } = await import('multer');
  const os = await import('node:os');
  const path = await import('node:path');
  const fsModulo = await import('node:fs');
  const upload = multer({ dest: fsModulo.mkdtempSync(path.join(os.tmpdir(), 'fidelity-upload-materiale-')) });
  return {
    uploadMaterialiPubblicazioni: upload,
    uploadOlimpoImages: upload,
    uploadTracciati: upload,
    uploadZipMemory: upload,
  };
});

// Qui conta cosa succede al materiale, non chi puo' caricarlo
vi.mock('../../middleware/authMiddleware', () => {
  const passa = (_req: unknown, _res: unknown, next: () => void) => next();
  return { authMiddleware: passa, integrationAuthMiddleware: passa };
});
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { FileManagementService } from '../../services/FileManagementService';
import { FileManagementController } from '../FileManagementController';

const PDF = Buffer.from('%PDF-1.4');

function creaApp({ codiceExport = 'STAMPA', statoKit = STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE } = {}) {
  const kitRuntimeService = {
    getKitRuntimeById: vi.fn().mockResolvedValue({ stato_lavorazione: statoKit }),
    getFilesRuntimeByIdKitRuntime: vi.fn().mockResolvedValue([]),
    insertNewFileRuntime: vi.fn().mockResolvedValue(undefined),
    getFileRunTimeLogByNomeFileEIdKitRuntime: vi.fn().mockResolvedValue(null),
    insertNewFileRuntimeLog: vi.fn().mockResolvedValue(undefined),
  };
  const tipoExportService = { getTipoExportById: vi.fn().mockResolvedValue({ codice: codiceExport }) };
  const dipendenze = [kitRuntimeService, tipoExportService, {}, {}, {}, {}, {}];
  const service = new FileManagementService(...(dipendenze as unknown as ConstructorParameters<typeof FileManagementService>));
  const app = express();
  new FileManagementController(service).registerRoutes(app);
  return { app, kitRuntimeService };
}

/** Il caricamento come lo fa il Dettaglio kit: un file per richiesta, campi del form come stringhe. */
function carica(app: express.Express, { meta = '{}', nomeFile = 'volantino.pdf', contenuto = PDF } = {}) {
  return request(app)
    .post('/api/uploadMateriale')
    .field('guidKitRuntime', 'kit-1')
    .field('tipoExport', 'tipo-1')
    .field('nomeFile', nomeFile)
    .field('meta', meta)
    .attach('file', contenuto, nomeFile);
}

/** Olimpo finto dietro il client HTTP comune. */
function olimpo() {
  const post = vi.fn(async () => new Response(
    JSON.stringify({ esito: true, error: '', content: { id: 'olimpo-1', file_name: 'volantino.pdf', json_meta: '{}' } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', post);
  return post;
}

function metaInviatoAOlimpo(post: ReturnType<typeof olimpo>): unknown {
  const [, opzioni] = post.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse((opzioni.body as FormData).get('json_meta_materiale') as string).JsonMeta;
}

const ambientePrecedente = process.env.NODE_ENV;

beforeEach(() => {
  // In produzione i messaggi degli errori non applicativi diventano generici: qui devono restare leggibili
  process.env.NODE_ENV = 'production';
});

afterEach(() => {
  process.env.NODE_ENV = ambientePrecedente;
  vi.unstubAllGlobals();
});

describe('POST /api/uploadMateriale dal Dettaglio kit', () => {
  it('meta arriva dal form come stringa JSON: a Olimpo va un oggetto', async () => {
    const post = olimpo();
    const { app, kitRuntimeService } = creaApp();

    const res = await carica(app, { meta: '{"origine":"dettaglio-kit"}' });

    expect(res.status).toBe(201);
    expect(metaInviatoAOlimpo(post)).toEqual({ origine: 'dettaglio-kit' });
    expect(kitRuntimeService.insertNewFileRuntime).toHaveBeenCalledWith(expect.objectContaining({ id_olimpo_cloud: 'olimpo-1' }));
  });

  it('meta "{}" (quello che manda il client) diventa un oggetto vuoto', async () => {
    const post = olimpo();
    const { app } = creaApp();

    expect((await carica(app)).status).toBe(201);
    expect(metaInviatoAOlimpo(post)).toEqual({});
  });

  it.each([
    ['non e\' JSON', '{origine: dettaglio}', 'non e\' un JSON valido'],
    ['e\' JSON ma non un oggetto', '[1, 2]', 'deve essere un oggetto JSON'],
  ])('meta che %s: 400 con il motivo e niente a Olimpo', async (_caso, meta, motivo) => {
    const post = olimpo();
    const { app } = creaApp();

    const res = await carica(app, { meta });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(motivo);
    expect(post).not.toHaveBeenCalled();
  });

  it('tipo di file non supportato: 400 con il motivo leggibile anche in produzione', async () => {
    const post = olimpo();
    const { app } = creaApp({ codiceExport: 'STAMPA' });

    const res = await carica(app, { nomeFile: 'volantino.docx', contenuto: Buffer.from('documento') });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tipo di file non supportato per il tipo di export STAMPA: serve un PDF, ricevuto ".docx"');
    expect(post).not.toHaveBeenCalled();
  });

  it('un PDF per il tipo di export WEB resta rifiutato, con il motivo', async () => {
    olimpo();
    const { app } = creaApp({ codiceExport: 'WEB' });

    const res = await carica(app);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('serve un file .json o .webpliant');
  });

  it('kit non in lavorazione: 409 con lo stato del kit, senza caricare il file su Olimpo', async () => {
    const post = olimpo();
    const { app, kitRuntimeService } = creaApp({ statoKit: STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO });

    const res = await carica(app);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('non e\' in lavorazione');
    expect(res.body.message).toContain(STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO);
    expect(res.body.code).toBe('KIT_RUNTIME_NON_IN_LAVORAZIONE');
    // Il controllo viene prima dell'upload: nessun materiale orfano su Olimpo
    expect(post).not.toHaveBeenCalled();
    expect(kitRuntimeService.insertNewFileRuntime).not.toHaveBeenCalled();
  });

  it('il temporaneo di multer viene rimosso anche quando la richiesta e\' rifiutata', async () => {
    olimpo();
    const { app } = creaApp();
    const rm = vi.spyOn(fs.promises, 'rm');

    await carica(app, { meta: 'non json' });

    expect(rm).toHaveBeenCalledWith(expect.any(String), { force: true });
  });
});
