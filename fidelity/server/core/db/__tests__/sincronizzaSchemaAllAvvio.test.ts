import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sincronizza: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../models', () => ({
  modelliManager: { sincronizzaTuttiIModelli: mocks.sincronizza },
}));

vi.mock('../../logger', () => ({ log: mocks.log }));

import { sequelize, sincronizzaSchemaAllAvvio } from '../SequelizeConnector';

describe("sync dello schema all'avvio del server", () => {
  beforeEach(() => {
    mocks.sincronizza.mockReset();
    mocks.log.error.mockReset();
    vi.spyOn(sequelize, 'authenticate').mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.DB_SYNC_ON_START;
  });

  it('per default sincronizza tutti i modelli con alter e senza force', async () => {
    mocks.sincronizza.mockResolvedValue([{ modello: 'Promo', tabella: 'promo', successo: true, tempo_ms: 1 }]);

    await sincronizzaSchemaAllAvvio();

    expect(mocks.sincronizza).toHaveBeenCalledWith(expect.objectContaining({ alter: true, force: false }));
    expect(mocks.log.error).not.toHaveBeenCalled();
  });

  it('con DB_SYNC_ON_START=false non sincronizza', async () => {
    process.env.DB_SYNC_ON_START = 'false';

    await sincronizzaSchemaAllAvvio();

    expect(mocks.sincronizza).not.toHaveBeenCalled();
  });

  it('se un modello non si sincronizza il server parte comunque e il modello finisce nel log', async () => {
    mocks.sincronizza.mockResolvedValue([
      { modello: 'Promo', tabella: 'promo', successo: true, tempo_ms: 1 },
      { modello: 'GDOWhatsappQueueJob', tabella: 'gdo_whatsapp_message_queue', successo: false, tempo_ms: 1, errore: 'lock timeout' },
    ]);

    await expect(sincronizzaSchemaAllAvvio()).resolves.toBeUndefined();

    expect(mocks.log.error).toHaveBeenCalledWith(
      expect.stringContaining('1 modelli'),
      null,
      { modelli: ['GDOWhatsappQueueJob: lock timeout'] }
    );
  });

  it('se il database non risponde l\'avvio fallisce', async () => {
    vi.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('connection refused'));

    await expect(sincronizzaSchemaAllAvvio()).rejects.toThrow('connection refused');
    expect(mocks.sincronizza).not.toHaveBeenCalled();
  });
});
