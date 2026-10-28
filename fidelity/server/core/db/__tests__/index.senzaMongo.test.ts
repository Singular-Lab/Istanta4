import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeSequelize: vi.fn(),
  closeSequelize: vi.fn(),
}));

vi.mock('../SequelizeConnector', () => ({
  sequelize: {},
  initializeDatabase: mocks.initializeSequelize,
  closeDatabase: mocks.closeSequelize,
}));

import * as db from '../index';

describe('database di Fidelity senza MongoDB', () => {
  beforeEach(() => {
    mocks.initializeSequelize.mockReset().mockResolvedValue(undefined);
    mocks.closeSequelize.mockReset().mockResolvedValue(undefined);
    delete process.env.MONGO_URL;
    delete process.env.MONGO_DB_NAME;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializeDatabase apre solo PostgreSQL, anche senza MONGO_URL', async () => {
    await expect(db.initializeDatabase()).resolves.toBeUndefined();

    expect(mocks.initializeSequelize).toHaveBeenCalledTimes(1);
  });

  it("initializeDatabase(false) passa il parametro a Sequelize, che non tocca piu' lo schema", async () => {
    await db.initializeDatabase(false);

    expect(mocks.initializeSequelize).toHaveBeenCalledWith(false);
  });

  it('closeDatabase chiude solo PostgreSQL', async () => {
    await expect(db.closeDatabase()).resolves.toBeUndefined();

    expect(mocks.closeSequelize).toHaveBeenCalledTimes(1);
  });

  it('il modulo non espone piu una connessione MongoDB', () => {
    expect(Object.keys(db).sort()).toEqual(['closeDatabase', 'initializeDatabase', 'sequelize']);
  });

  it('un errore di PostgreSQL in apertura arriva al chiamante', async () => {
    mocks.initializeSequelize.mockRejectedValue(new Error('connessione rifiutata'));

    await expect(db.initializeDatabase()).rejects.toThrow('connessione rifiutata');
  });
});
