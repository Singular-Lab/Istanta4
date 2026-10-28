import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

const geocodifica = vi.hoisted(() => vi.fn());
vi.mock('../../utils/geocodifica', () => ({ geocodifica }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { sequelize } from '../../db/SequelizeConnector';
import { ServerUtils } from '../../utils/ServerUtils';
import { geocodeAddress, UserService } from '../UserService';

afterEach(() => {
  geocodifica.mockReset();
  vi.restoreAllMocks();
});

describe('geocodeAddress', () => {
  it('passa dalla coda di geocodifica, limitata all\'Italia', async () => {
    geocodifica.mockResolvedValueOnce({ lat: 43.7, lon: 10.4 });

    await expect(geocodeAddress('Via Roma 1, Pisa')).resolves.toEqual({ lat: 43.7, lon: 10.4 });
    expect(geocodifica).toHaveBeenCalledWith('Via Roma 1, Pisa', 'it');
  });

  it('indirizzo non trovato o Nominatim che non risponde: null', async () => {
    geocodifica.mockResolvedValueOnce({});

    await expect(geocodeAddress('Via Inesistente')).resolves.toBeNull();
  });
});

describe('registerUserWithTransaction', () => {
  it('geocodifica la residenza prima di aprire la transazione', async () => {
    geocodifica.mockResolvedValueOnce({ lat: 43.7, lon: 10.4 });
    const transazione = { commit: vi.fn(), rollback: vi.fn() };
    const apri = vi.spyOn(sequelize, 'transaction').mockResolvedValue(transazione as any);
    vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
    vi.spyOn(ServerUtils, 'CREA_ATTIVITA').mockResolvedValue(undefined as any);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const repository = { createWithOptions: vi.fn(async () => ({ id_utenti: 'u1' })) };

    await new UserService(repository as any).registerUserWithTransaction({
      email: 'Mario@Esempio.it',
      nome: 'Mario',
      cognome: 'Rossi',
      tipo: TIPO_UTENTI.SUPERADMIN,
      stato: STATO_UTENTI.ATTIVO,
      residenza: 'Via Roma 1, Pisa',
      dataDiNascita: '1980-01-01',
    }, 'admin');

    expect(geocodifica.mock.invocationCallOrder[0]).toBeLessThan(apri.mock.invocationCallOrder[0]);
    expect(repository.createWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({ lat_utenti: 43.7, lon_utenti: 10.4 }),
      { transaction: transazione },
    );
    expect(transazione.commit).toHaveBeenCalled();
  });
});
