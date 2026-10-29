import { createHash } from 'node:crypto';
import express, { type Express, type Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chiamaHttp, ErroreHttp } from '../../http/clienteHttp';
import type * as ClienteHttp from '../../http/clienteHttp';
import type { IExternalApiService } from '../../interfaces/IExternalApiService';
import type { FilterTemplateService } from '../../services/FilterTemplateService';
import type { StatisticheApiService } from '../../services/StatisticheApiService';
import { ServerUtils } from '../../utils/ServerUtils';
import { ExternalApiController } from '../ExternalApiController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => { next(); },
}));
vi.mock('../../middleware/ephemeralTokenAuthMiddleware', () => ({
  ephemeralTokenAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => { next(); },
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => { next(); },
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../di', () => ({ TYPES: {}, container: { get: vi.fn() } }));
// Il client HTTP verso Olimpo: nessuna chiamata di rete, risponde il finto Olimpo del test
vi.mock('../../http/clienteHttp', async (importOriginal) => ({
  ...(await importOriginal<typeof ClienteHttp>()),
  chiamaHttp: vi.fn(),
}));

const FOTO = Buffer.from('foto finta del test');
const CHIAVE_PASSAPORTO = 'chiave-pubblica-finta';

function creaApp(): Express {
  const app = express();
  app.use((req, _res, next) => {
    req.session = { id_utente: 'u-operatore' } as Request['session'];
    next();
  });
  new ExternalApiController({} as IExternalApiService, {} as StatisticheApiService, {} as FilterTemplateService).registerRoutes(app);
  return app;
}

/** Invia la foto come il plugin: multipart con il file e i campi di testo. */
async function invia(campi: Record<string, string>, opzioni: { conFile?: boolean } = {}) {
  let richiesta = request(creaApp()).post('/api/external/sync_foto_plugin');
  for (const [nome, valore] of Object.entries(campi)) {
    richiesta = richiesta.field(nome, valore);
  }
  return opzioni.conFile === false ? richiesta : richiesta.attach('file', FOTO, 'polpa.jpg');
}

const rispostaOlimpo = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

/** Cosa e arrivato al finto Olimpo: indirizzo, header e metadati della foto. */
function inviatoAOlimpo() {
  expect(chiamaHttp).toHaveBeenCalledTimes(1);
  const [url, opzioni] = vi.mocked(chiamaHttp).mock.calls[0];
  const corpo = opzioni?.body as FormData;
  return {
    url,
    headers: opzioni?.headers as Record<string, string>,
    meta: JSON.parse(String(corpo.get('json_meta_foto'))) as { IdRef: number; FileName: string; FileHash: string },
  };
}

beforeEach(() => {
  vi.mocked(chiamaHttp).mockReset();
  // Il passaporto Olimpo dell'utente: niente utente da cercare a DB, niente chiamata a Olimpo
  vi.spyOn(ServerUtils, 'getPassportFromOlympo').mockResolvedValue(CHIAVE_PASSAPORTO);
});

describe('POST /api/external/sync_foto_plugin', () => {
  it('senza file: 400 "File mancante" e Olimpo non viene chiamato', async () => {
    const res = await invia({ dna: '$dna{\n4969665\n}' }, { conFile: false });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'File mancante' });
    expect(chiamaHttp).not.toHaveBeenCalled();
  });

  it.each([
    { caso: 'senza dna', campi: {} },
    { caso: 'dna senza IdRef numerico', campi: { dna: '$dna{\nabc\n}' } },
    { caso: 'is_extra diverso da "true" e dna non valido', campi: { is_extra: 'false', dna: 'nessun dna' } },
  ])('$caso: 400 e Olimpo non viene chiamato', async ({ campi }) => {
    const res = await invia(campi);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'DNA non valido o IdRef non trovato' });
    expect(chiamaHttp).not.toHaveBeenCalled();
  });

  it('dna ripetuto nel multipart (arriva come elenco): 400 e Olimpo non viene chiamato', async () => {
    const res = await request(creaApp())
      .post('/api/external/sync_foto_plugin')
      .field('dna', 'a')
      .field('dna', 'b')
      .attach('file', FOTO, 'polpa.jpg');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'DNA non valido o IdRef non trovato' });
    expect(chiamaHttp).not.toHaveBeenCalled();
  });

  it.each([
    { caso: 'senza dna', campi: { is_extra: 'true' } },
    { caso: 'anche con un dna valido', campi: { is_extra: 'true', dna: '$dna{\n4969665\n}' } },
  ])('foto extra $caso: a Olimpo va IdRef 0', async ({ campi }) => {
    vi.mocked(chiamaHttp).mockResolvedValue(rispostaOlimpo({ record: { Id: 'g-extra', IdRef: '0', FileName: 'polpa.jpg', FileHash: 'h' } }));

    const res = await invia(campi);

    expect(res.status).toBe(200);
    expect(res.body.guidId).toBe('g-extra');
    expect(inviatoAOlimpo().meta.IdRef).toBe(0);
  });

  it.each([
    { caso: 'risponde con un errore HTTP', status: 500 },
    { caso: 'risponde 200 ma con un errore nel corpo', status: 200 },
  ])('Olimpo $caso: 500 col messaggio di Olimpo', async ({ status }) => {
    vi.mocked(chiamaHttp).mockResolvedValue(rispostaOlimpo({ error: 'Formato immagine non supportato' }, status));

    const res = await invia({ dna: '$dna{\n4969665\n}' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Formato immagine non supportato' });
  });

  it('Olimpo non raggiungibile: 500 col motivo', async () => {
    vi.mocked(chiamaHttp).mockRejectedValue(new ErroreHttp('rete', '127.0.0.1:5002/foto/uploadFoto', true));

    const res = await invia({ dna: '$dna{\n4969665\n}' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('non raggiungibile');
  });

  it('carica la foto su Olimpo con IdRef dal dna, nome e hash, e restituisce il guidId', async () => {
    const record = { Id: 'g-polpa', IdRef: '4969665', FileName: 'polpa.jpg', FileHash: 'h' };
    vi.mocked(chiamaHttp).mockResolvedValue(rispostaOlimpo({ record }));

    const res = await invia({ dna: '$dna{\n4969665\n1404871,4969665\n}' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: record, guidId: 'g-polpa' });
    const { url, headers, meta } = inviatoAOlimpo();
    expect(url).toMatch(/\/foto\/uploadFoto$/);
    expect(headers.Authorization).toBe(`Bearer ${CHIAVE_PASSAPORTO}`);
    expect(meta).toEqual({ IdRef: 4969665, FileName: 'polpa.jpg', FileHash: createHash('md5').update(FOTO).digest('hex') });
  });
});
