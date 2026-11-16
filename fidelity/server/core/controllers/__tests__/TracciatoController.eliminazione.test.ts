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

// Il permesso (sistema.elimina_tracciati) lo verifica permessiRouteMutanti.test.ts
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../models/promo', () => ({
  Promo: { findByPk: vi.fn(async (id: string) => (id === 'promo-1' ? { nome_promo: 'A2625_SC_20-11-26' } : null)) },
}));

// Tracciati in coda verso Istanta: id -> stato della coda
const coda = vi.hoisted(() => new Map<string, 'in_attesa' | 'errore'>());
vi.mock('../../services/AllineamentoIstanta', () => ({
  statoIstantaTracciati: vi.fn(async (ids: string[]) =>
    new Map(ids.map((id) => [id, { stato: coda.get(id) ?? 'inviato', errore: null, tentativi: coda.get(id) === 'errore' ? 2 : 0 }]))),
  aggiornaContestoInAttesa: vi.fn(),
  inviaPrenotata: vi.fn(),
  prenotaTracciato: vi.fn(),
}));

vi.mock('../../models/tracciati_invio_istanta', () => ({
  TracciatiInvioIstanta: { destroy: vi.fn(async () => 1) },
}));

import { TracciatiInvioIstanta } from '../../models/tracciati_invio_istanta';

/**
 * Eliminare un tracciato lo cancella per davvero, e si puo' solo se Istanta non l'ha importato
 * (spec ciclo-promozione-importazione, "Eliminazione di un tracciato non importato"). Nome, file e
 * promo si leggono prima, per il Registro Audit, cosi' resta chi l'ha eliminato e quando.
 */
function createApp(
  righe: Record<string, Record<string, unknown>>,
  statoImportazione: () => Promise<{ stato: string } | null> = async () => ({ stato: 'Terminata' }),
  scarto: () => Promise<{ scartata: boolean; stato: string | null }> = async () => ({ scartata: true, stato: 'Scartata' }),
) {
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
  const istanta = { getStatusImportazione: vi.fn(statoImportazione), scartaImportazione: vi.fn(scarto) };

  const app = express();
  app.use(express.json());
  new TracciatoController(new TracciatoService(repository as unknown as ITracciatiRepository), istanta).registerRoutes(app);
  return { app, repository, audit, istanta };
}

// Scartato in FP: si elimina senza chiedere niente a Istanta
const tracciato = (extra: Record<string, unknown> = {}) => ({
  id_tracciati: 't1',
  id_promo_tracciati: 'promo-1',
  context_tracciati: [],
  filename_tracciati: '01_TECNICO_Export.xlsx',
  nome_tracciati: 'Tecnico ottobre',
  stato_tracciati: 'Scartato',
  blobfile_tracciati: Buffer.from('contenuto'),
  ...extra,
});

afterEach(() => {
  vi.restoreAllMocks();
  coda.clear();
  vi.mocked(TracciatiInvioIstanta.destroy).mockClear();
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

describe('DELETE /api/tracciati/:idTracciato - solo un tracciato non importato', () => {
  it('un tracciato in attesa di Istanta si elimina e lascia la coda di invio', async () => {
    coda.set('t1', 'in_attesa');
    const { app, repository, istanta } = createApp({ t1: tracciato({ stato_tracciati: null }) });

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(200);
    expect(repository.delete).toHaveBeenCalledWith('t1');
    expect(TracciatiInvioIstanta.destroy).toHaveBeenCalledWith({ where: { id_tracciato: 't1' } });
    // In attesa: Istanta non ne sa niente, non si chiede lo stato dell'importazione
    expect(istanta.getStatusImportazione).not.toHaveBeenCalled();
  });

  it('anche uno che Istanta non ha accettato', async () => {
    coda.set('t1', 'errore');
    const { app, repository } = createApp({ t1: tracciato({ stato_tracciati: null }) });

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(200);
    expect(repository.delete).toHaveBeenCalledWith('t1');
  });

  it("si elimina quando Istanta dice che l'importazione e' scartata", async () => {
    const { app, repository, istanta } = createApp({ t1: tracciato({ stato_tracciati: null }) }, async () => ({ stato: 'Scartata' }));

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(200);
    expect(repository.delete).toHaveBeenCalledWith('t1');
    // Gia' scartata: niente da chiedere a Istanta
    expect(istanta.scartaImportazione).not.toHaveBeenCalled();
  });

  it('un tracciato importato resta, con il motivo', async () => {
    const { app, repository, audit, istanta } = createApp({ t1: tracciato({ stato_tracciati: 'Terminata' }) }, async () => ({ stato: 'Terminata' }));

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Il tracciato è già importato in Istanta: non si può eliminare.');
    expect(istanta.scartaImportazione).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(TracciatiInvioIstanta.destroy).not.toHaveBeenCalled();
    expect(audit.entityChanged).not.toHaveBeenCalled();
  });

  it("un tracciato con l'importazione ancora in corso resta", async () => {
    const { app, repository } = createApp({ t1: tracciato({ stato_tracciati: null }) }, async () => ({ stato: 'ElaborazioneDati' }));

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/non è conclusa/);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('se Istanta non risponde non si elimina niente', async () => {
    const { app, repository } = createApp({ t1: tracciato({ stato_tracciati: null }) }, async () => {
      throw new Error('ECONNREFUSED');
    });

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Non è stato possibile verificare/);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});

// TASK-f4e1fc7c: arrivato in Istanta ma non importato, si elimina dopo averne scartato l'importazione
describe("DELETE /api/tracciati/:idTracciato - arrivato in Istanta e non importato", () => {
  it.each(['InAttesaDiConfermaUtente', 'Esaminata'])("con l'importazione %s Istanta la scarta e il tracciato si elimina", async (stato) => {
    const { app, repository, istanta, audit } = createApp({ t1: tracciato({ stato_tracciati: null }) }, async () => ({ stato }));

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(200);
    expect(istanta.scartaImportazione).toHaveBeenCalledWith('t1', expect.anything());
    expect(repository.delete).toHaveBeenCalledWith('t1');
    expect(audit.entityChanged).toHaveBeenCalledTimes(1);
    // Lo scarto viene prima della cancellazione
    expect(istanta.scartaImportazione.mock.invocationCallOrder[0]).toBeLessThan(repository.delete.mock.invocationCallOrder[0]);
  });

  it("se nel frattempo l'importazione e' partita, Istanta non la scarta e il tracciato resta", async () => {
    const { app, repository, audit } = createApp(
      { t1: tracciato({ stato_tracciati: null }) },
      async () => ({ stato: 'InAttesaDiConfermaUtente' }),
      async () => ({ scartata: false, stato: 'InCoda' }),
    );

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("L'importazione del tracciato in Istanta è già avviata e non è conclusa: non si può eliminare.");
    expect(repository.delete).not.toHaveBeenCalled();
    expect(TracciatiInvioIstanta.destroy).not.toHaveBeenCalled();
    expect(audit.entityChanged).not.toHaveBeenCalled();
  });

  it("se nel frattempo e' stata importata, il motivo dice che e' gia' importato", async () => {
    const { app, repository } = createApp(
      { t1: tracciato({ stato_tracciati: null }) },
      async () => ({ stato: 'Esaminata' }),
      async () => ({ scartata: false, stato: 'Terminata' }),
    );

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Il tracciato è già importato in Istanta: non si può eliminare.');
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("se Istanta non risponde allo scarto non si elimina niente", async () => {
    const { app, repository, audit } = createApp(
      { t1: tracciato({ stato_tracciati: null }) },
      async () => ({ stato: 'InAttesaDiConfermaUtente' }),
      async () => {
        throw new Error('ECONNREFUSED');
      },
    );

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Non è stato possibile scartare in Istanta l'importazione del tracciato: riprova più tardi.");
    expect(repository.delete).not.toHaveBeenCalled();
    expect(audit.entityChanged).not.toHaveBeenCalled();
  });

  it("con l'importazione in coda non si chiede lo scarto", async () => {
    const { app, repository, istanta } = createApp({ t1: tracciato({ stato_tracciati: null }) }, async () => ({ stato: 'InCoda' }));

    const res = await request(app).delete('/api/tracciati/t1');

    expect(res.status).toBe(409);
    expect(istanta.scartaImportazione).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
