import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ITracciatiRepository } from '../../repositories/TracciatiRepository';
import { AuditLogService } from '../../services/AuditLogService';
import { TracciatoService } from '../../services/TracciatoService';
import { TracciatoController } from '../TracciatoController';

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../models/promo', () => ({
  Promo: { findByPk: vi.fn(async (id: string) => (id === 'promo-1' ? { nome_promo: 'A2625_SC_20-11-26' } : null)) },
}));

/**
 * Eliminare un tracciato lo cancella per davvero: nome, file e promo si leggono prima, per il
 * Registro Audit, cosi' resta chi l'ha eliminato e quando.
 */
function createApp(righe: Record<string, Record<string, unknown>>) {
  // Repository in memoria: controller e service sono quelli reali
  const repository = {
    findById: vi.fn(async (id: string) => righe[id] ?? null),
    delete: vi.fn(async (id: string) => {
      if (!righe[id]) return false;
      delete righe[id];
      return true;
    }),
  };
  const audit = { entityChanged: vi.fn(), configurationChanged: vi.fn() };
  vi.spyOn(AuditLogService, 'getInstance').mockReturnValue(audit as unknown as AuditLogService);

  const app = express();
  app.use(express.json());
  new TracciatoController(new TracciatoService(repository as unknown as ITracciatiRepository)).registerRoutes(app);
  return { app, repository, audit };
}

const tracciato = (extra: Record<string, unknown> = {}) => ({
  id_tracciati: 't1',
  id_promo_tracciati: 'promo-1',
  context_tracciati: [],
  filename_tracciati: '01_TECNICO_Export.xlsx',
  nome_tracciati: 'Tecnico ottobre',
  blobfile_tracciati: Buffer.from('contenuto'),
  ...extra,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DELETE /api/tracciati/:idTracciato - Registro Audit', () => {
  it('registra file, nome e promo letti prima della cancellazione', async () => {
    const { app, repository, audit } = createApp({ t1: tracciato() });

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(200);
    expect(repository.delete).toHaveBeenCalledWith('t1');
    expect(audit.entityChanged).toHaveBeenCalledWith(expect.anything(), 'tracciato', 'delete', { type: 'Tracciato', id: 't1' }, {
      tracciatoId: 't1',
      fileName: '01_TECNICO_Export.xlsx',
      nomeTracciato: 'Tecnico ottobre',
      promoId: 'promo-1',
      nomePromo: 'A2625_SC_20-11-26',
    });
  });

  it('senza nome visualizzato il nome e quello del file', async () => {
    const { app, audit } = createApp({ t1: tracciato({ nome_tracciati: null }) });

    await request(app).delete('/api/tracciati/t1');

    expect(audit.entityChanged.mock.calls[0][4]).toMatchObject({ fileName: '01_TECNICO_Export.xlsx', nomeTracciato: '01_TECNICO_Export.xlsx' });
  });

  it('niente voce se il tracciato non esiste', async () => {
    const { app, audit } = createApp({});

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(404);
    expect(audit.entityChanged).not.toHaveBeenCalled();
  });
});
