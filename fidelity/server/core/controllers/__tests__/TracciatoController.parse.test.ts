import express from 'express';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import type { TracciatiAttributes } from '../../../../lib/types';
import type { ITracciatiRepository } from '../../repositories/TracciatiRepository';
import { TracciatoService } from '../../services/TracciatoService';
import { TracciatoController } from '../TracciatoController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => {
    next();
  },
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => {
    next();
  },
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * Anteprima del tracciato: un tracciato inesistente è "non trovato" (404), uno senza
 * file una richiesta non valida (400); solo un errore imprevisto risponde 500.
 */
function createApp(righe: Record<string, Partial<TracciatiAttributes>>) {
  // Repository in memoria: controller e service sono quelli reali
  const repository = {
    findById: vi.fn(async (id: string) => righe[id] ?? null),
  };

  const app = express();
  app.use(express.json());
  new TracciatoController(new TracciatoService(repository as unknown as ITracciatiRepository)).registerRoutes(app);
  return { app, repository };
}

function excelInMemoria(): Uint8Array {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Codice', 'Inizio'], ['00123', new Date(2026, 9, 28)]]), 'Referenze');
  const contenuto: unknown = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(contenuto as Buffer);
}

const tracciato = (extra: Partial<TracciatiAttributes> = {}): Partial<TracciatiAttributes> => ({
  id_tracciati: 't1',
  id_promo_tracciati: 'promo-1',
  filename_tracciati: 'ufi.xlsx',
  ...extra,
});

describe('GET /api/tracciati/:idTracciato/parse', () => {
  it('restituisce i fogli del tracciato con le date in gg/mm/aaaa', async () => {
    const { app } = createApp({ t1: tracciato({ blobfile_tracciati: excelInMemoria() }) });

    const res = await request(app).get('/api/tracciati/t1/parse');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sheets: [{ name: 'Referenze', rows: [['Codice', 'Inizio'], ['00123', '28/10/2026']] }],
    });
  });

  it('risponde 404 con il motivo se il tracciato non esiste', async () => {
    const { app } = createApp({});

    const res = await request(app).get('/api/tracciati/inesistente/parse');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Tracciato non trovato');
  });

  it('risponde 400 con il motivo se il tracciato non contiene un file', async () => {
    const { app } = createApp({ t1: tracciato() });

    const res = await request(app).get('/api/tracciati/t1/parse');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Il tracciato non contiene un file');
  });

  it('risponde 500 solo per un errore imprevisto', async () => {
    const { app, repository } = createApp({});
    repository.findById.mockRejectedValueOnce(new Error('connessione persa'));

    const res = await request(app).get('/api/tracciati/t1/parse');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Errore durante il parsing del tracciato');
  });
});
