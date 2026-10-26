import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  query: vi.fn(async () => [[], 0]),
  transaction: vi.fn(async (lavoro: (t: unknown) => unknown) => lavoro('tx')),
}));
vi.mock('../../db/SequelizeConnector', () => ({ sequelize: db }));

const modello = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock('../../models/config', () => ({ Config: modello }));

const gdoCliente = vi.hoisted(() => ({ idGdoCliente: vi.fn() }));
vi.mock('../../services/configPerGdo', () => gdoCliente);

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../logger', () => ({ log }));

vi.mock('../../config', () => ({ default: { CLIENT_ID: 'Coop Firenze' } }));

import { funzionalitaDaAmbiente, migraConfig, preparaConfigAllAvvio } from '../migrazioneConfig';

beforeEach(() => {
  db.query.mockClear();
  modello.update.mockReset().mockResolvedValue([0]);
  gdoCliente.idGdoCliente.mockReset().mockResolvedValue('gdo-firenze');
  Object.values(log).forEach((f) => f.mockClear());
});

describe('migraConfig', () => {
  it('collega alla GDO del cliente tutte le configurazioni senza GDO', async () => {
    modello.update.mockResolvedValueOnce([2]).mockResolvedValueOnce([0]);

    const esito = await migraConfig({ ambiente: {} });

    expect(gdoCliente.idGdoCliente).toHaveBeenCalledWith('Coop Firenze');
    expect(modello.update).toHaveBeenCalledWith(
      { id_gdo_config: 'gdo-firenze' },
      { where: { id_gdo_config: null }, transaction: 'tx' }
    );
    expect(esito.collegate).toBe(2);
  });

  it('accende le funzionalita indicate dalle vecchie variabili, solo dove non sono ancora impostate', async () => {
    const esito = await migraConfig({ ambiente: { VITE_MOMENTI_ATTIVI: 'true', VITE_MENABO_ATTIVO: 'true' } });

    expect(modello.update).toHaveBeenCalledWith(
      { funzionalita: { momenti: true, menabo: true } },
      { where: { funzionalita: null }, transaction: 'tx' }
    );
    expect(esito.funzionalita).toEqual({ momenti: true, menabo: true });
  });

  it('senza GDO del cliente non collega nulla ma inizializza le funzionalita', async () => {
    gdoCliente.idGdoCliente.mockResolvedValue(null);

    const esito = await migraConfig({ ambiente: {} });

    expect(modello.update).toHaveBeenCalledTimes(1);
    expect(modello.update).toHaveBeenCalledWith(
      { funzionalita: { momenti: false, menabo: false } },
      { where: { funzionalita: null }, transaction: 'tx' }
    );
    expect(esito.idGdo).toBeNull();
    expect(esito.collegate).toBe(0);
  });

  it('aggiunge le colonne anche con la sincronia dello schema spenta', async () => {
    await migraConfig({ ambiente: {} });

    const sql = db.query.mock.calls.map((c: any[]) => String(c[0]));
    expect(sql).toContain('ALTER TABLE IF EXISTS config ADD COLUMN IF NOT EXISTS id_gdo_config UUID');
    expect(sql).toContain('ALTER TABLE IF EXISTS config ADD COLUMN IF NOT EXISTS funzionalita JSONB');
  });
});

describe('funzionalitaDaAmbiente', () => {
  it('solo true accende', () => {
    expect(funzionalitaDaAmbiente({ VITE_MOMENTI_ATTIVI: 'true', VITE_MENABO_ATTIVO: 'false' })).toEqual({ momenti: true, menabo: false });
    expect(funzionalitaDaAmbiente({ VITE_MOMENTI_ATTIVI: 'TRUE', VITE_MENABO_ATTIVO: '1' })).toEqual({ momenti: false, menabo: false });
    expect(funzionalitaDaAmbiente({})).toEqual({ momenti: false, menabo: false });
  });
});

describe('preparaConfigAllAvvio', () => {
  it('un errore finisce nel log e non ferma l avvio', async () => {
    db.transaction.mockRejectedValueOnce(new Error('database non raggiungibile'));

    await expect(preparaConfigAllAvvio()).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalled();
  });
});
