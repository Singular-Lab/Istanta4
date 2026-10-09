import { afterEach, describe, expect, it, vi } from 'vitest';
import { sequelize } from '../../db/SequelizeConnector';
import { TracciatoService } from '../TracciatoService';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Transazione finta: la callback gira subito, senza database
const t = { id: 'transazione' };

// Repository in memoria dei momenti di una promo
function makeService(momenti: Array<{ id: string; ordine: number; confronti_ids?: string[] }>) {
  let righe: any[] = momenti.map((m) => ({ id_promo: 'p1', confronti_ids: [], ...m }));
  const repository = {
    findById: vi.fn(async (id: string) => righe.find((r) => r.id === id) ?? null),
    findByPromoId: vi.fn(async () => [...righe]),
    findConfrontiByMomentoId: vi.fn(async () => [{ id: 'c1' }]),
    deleteConfronto: vi.fn(async () => true),
    create: vi.fn(async (valori: any) => {
      const riga = { id: `m${righe.length + 10}`, ...valori };
      righe.push(riga);
      return riga;
    }),
    update: vi.fn(async (id: string, valori: any) => {
      righe = righe.map((r) => (r.id === id ? { ...r, ...valori } : r));
      return righe.find((r) => r.id === id) ?? null;
    }),
    delete: vi.fn(async (id: string) => {
      righe = righe.filter((r) => r.id !== id);
      return true;
    }),
  };
  vi.spyOn(sequelize, 'transaction').mockImplementation((async (cb: any) => cb(t)) as any);
  const query = vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
  const service = new TracciatoService({} as any, undefined, {} as any, repository as any, {} as any);
  return { service, repository, query };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TracciatoService: ordine dei momenti', () => {
  it('dopo la cancellazione del momento 1 su [0,1,2] il nuovo momento riceve ordine 3', async () => {
    const { service, repository } = makeService([
      { id: 'm0', ordine: 0 },
      { id: 'm1', ordine: 1 },
      { id: 'm2', ordine: 2 },
    ]);

    await service.deleteMomento('m1');
    const creato = await service.createMomento('p1', 'Nuovo');

    expect(creato.ordine).toBe(3);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ ordine: 3 }), t);
  });

  it('il primo momento di una promo riceve ordine 0', async () => {
    const { service } = makeService([]);

    const creato = await service.createMomento('p1', 'Primo');

    expect(creato.ordine).toBe(0);
  });

  it('createMomento prende il lock dei momenti della promo nella transazione', async () => {
    const { service, query } = makeService([]);

    await service.createMomento('p1', 'Primo');

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({ replacements: { chiave: 'momenti:p1' }, transaction: t })
    );
  });
});

describe('TracciatoService.updateMomento', () => {
  it('scrive nella transazione con il lock dei momenti della sua promo', async () => {
    const { service, repository, query } = makeService([{ id: 'm0', ordine: 0 }]);

    const aggiornato = await service.updateMomento('m0', { ordine: 5 });

    expect(aggiornato?.ordine).toBe(5);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({ replacements: { chiave: 'momenti:p1' }, transaction: t })
    );
    expect(repository.update).toHaveBeenCalledWith('m0', expect.objectContaining({ ordine: 5 }), t);
  });

  it('un momento inesistente restituisce null senza scrivere', async () => {
    const { service, repository } = makeService([]);

    await expect(service.updateMomento('mX', { nome: 'X' })).resolves.toBeNull();
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe('TracciatoService.deleteMomento', () => {
  it('un errore a meta propaga e le scritture fatte usano tutte la stessa transazione', async () => {
    const { service, repository } = makeService([
      { id: 'm0', ordine: 0, confronti_ids: ['m1'] },
      { id: 'm1', ordine: 1 },
    ]);
    repository.update.mockRejectedValueOnce(new Error('connessione persa'));

    await expect(service.deleteMomento('m1')).rejects.toThrow("Errore durante l'eliminazione del momento");

    expect(repository.deleteConfronto).toHaveBeenCalledWith('c1', t);
    expect(repository.update).toHaveBeenCalledWith('m0', expect.anything(), t);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
