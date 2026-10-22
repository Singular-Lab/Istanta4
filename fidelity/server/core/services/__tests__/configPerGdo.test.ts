import { beforeEach, describe, expect, it, vi } from 'vitest';

// Righe della tabella config, gia' nell'ordine della piu' vecchia
type Riga = { id: string; id_gdo_config: string | null; funzionalita?: any; update?: any };
const stato = vi.hoisted(() => ({ righe: [] as Riga[], gdo: [] as Array<{ id_gdo: string; nome_gdo: string }> }));

const modello = vi.hoisted(() => ({
  findOne: vi.fn(async (opzioni: any = {}) => {
    const where = opzioni.where ?? {};
    const trovate = stato.righe.filter((r) => !('id_gdo_config' in where) || r.id_gdo_config === where.id_gdo_config);
    return trovate[0] ?? null;
  }),
  create: vi.fn(async (valori: any) => valori),
}));
vi.mock('../../models/config', () => ({ Config: modello }));

vi.mock('../../models/gdo', () => ({
  GDO: {
    findOne: vi.fn(async (opzioni: any) => stato.gdo.find((g) => g.nome_gdo.toLowerCase() === opzioni.where.valore) ?? null),
  },
}));

vi.mock('../../db/SequelizeConnector', () => ({
  sequelize: {
    where: (_colonna: unknown, valore: string) => ({ valore }),
    fn: () => ({}),
    col: () => ({}),
  },
}));

vi.mock('../../config', () => ({ default: { CLIENT_ID: 'Coop Firenze' } }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ConfigService } from '../ConfigService';
import { dimenticaGdoCliente, funzionalitaDa, trovaConfigInstallazione, trovaConfigPerGdo } from '../configPerGdo';

beforeEach(() => {
  dimenticaGdoCliente();
  modello.create.mockClear();
  stato.gdo = [{ id_gdo: 'gdo-firenze', nome_gdo: 'Coop Firenze' }];
  stato.righe = [];
});

describe('trovaConfigInstallazione', () => {
  it('con piu righe sceglie sempre quella della GDO del cliente', async () => {
    stato.righe = [
      { id: 'lazio', id_gdo_config: 'gdo-lazio' },
      { id: 'firenze', id_gdo_config: 'gdo-firenze' },
    ];

    expect((await trovaConfigInstallazione()).id).toBe('firenze');
  });

  it('senza riga del cliente usa la riga senza GDO', async () => {
    stato.righe = [
      { id: 'lazio', id_gdo_config: 'gdo-lazio' },
      { id: 'storica', id_gdo_config: null },
    ];

    expect((await trovaConfigInstallazione()).id).toBe('storica');
  });

  it('con CLIENT_ID senza GDO ripiega sulla riga piu vecchia', async () => {
    stato.gdo = [];
    stato.righe = [{ id: 'lazio', id_gdo_config: 'gdo-lazio' }];

    expect((await trovaConfigInstallazione()).id).toBe('lazio');
  });
});

describe('trovaConfigPerGdo', () => {
  it('una GDO con configurazione propria usa la sua', async () => {
    stato.righe = [
      { id: 'firenze', id_gdo_config: 'gdo-firenze' },
      { id: 'lazio', id_gdo_config: 'gdo-lazio' },
    ];

    expect((await trovaConfigPerGdo('gdo-lazio')).id).toBe('lazio');
  });

  it('una GDO senza configurazione eredita quella dell installazione', async () => {
    stato.righe = [{ id: 'firenze', id_gdo_config: 'gdo-firenze' }];

    expect((await trovaConfigPerGdo('gdo-lazio')).id).toBe('firenze');
  });
});

describe('funzionalitaDa', () => {
  it('una funzione mai attivata e spenta', () => {
    expect(funzionalitaDa(null)).toEqual({ momenti: false, menabo: false });
    expect(funzionalitaDa({ funzionalita: null })).toEqual({ momenti: false, menabo: false });
    expect(funzionalitaDa({ funzionalita: { menabo: true } })).toEqual({ momenti: false, menabo: true });
  });
});

describe('ConfigService funzionalita', () => {
  it('legge le funzionalita della GDO con ripiego sull installazione', async () => {
    stato.righe = [{ id: 'firenze', id_gdo_config: 'gdo-firenze', funzionalita: { momenti: true, menabo: false } }];

    expect(await new ConfigService().getFunzionalita('gdo-lazio')).toEqual({ momenti: true, menabo: false });
  });

  it('salva sulla riga della GDO se esiste', async () => {
    const update = vi.fn();
    stato.righe = [{ id: 'firenze', id_gdo_config: 'gdo-firenze', update }];

    await new ConfigService().saveFunzionalita('gdo-firenze', { momenti: true, menabo: true });

    expect(update).toHaveBeenCalledWith({ funzionalita: { momenti: true, menabo: true } });
    expect(modello.create).not.toHaveBeenCalled();
  });

  it('crea la configurazione della GDO che non ne ha una, senza toccare quella dell installazione', async () => {
    const update = vi.fn();
    stato.righe = [{ id: 'firenze', id_gdo_config: 'gdo-firenze', update }];

    await new ConfigService().saveFunzionalita('gdo-lazio', { momenti: false, menabo: true });

    expect(update).not.toHaveBeenCalled();
    expect(modello.create).toHaveBeenCalledWith(expect.objectContaining({
      id_gdo_config: 'gdo-lazio',
      funzionalita: { momenti: false, menabo: true },
      webpliant: {},
    }));
  });
});
