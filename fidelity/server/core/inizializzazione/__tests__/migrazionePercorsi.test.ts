import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { migraPercorsiSpostati, type FonteMenu } from '../migrazionePercorsi';

const creaFonte = (percorsi: Record<string, string>) => {
  const menu = new Map(Object.entries(percorsi));
  const fonte: FonteMenu = {
    leggiVoci: async () => Array.from(menu, ([id_menu_item, pathname]) => ({ id_menu_item, pathname })),
    aggiornaPercorso: vi.fn(async (id: string, pathname: string) => { menu.set(id, pathname); }),
  };
  return { fonte, menu };
};

describe('migrazione dei percorsi del menu', () => {
  it('riscrive i vecchi percorsi, sottopagine comprese, e lascia gli altri', async () => {
    const { fonte, menu } = creaFonte({
      a: '/punti-vendita',
      b: '/gestione-utenti',
      c: '/punti-vendita/42',
      d: '/promozioni/in-corso',
      e: '/punti-vendita-bis',
    });

    expect(await migraPercorsiSpostati(fonte)).toBe(3);
    expect(Object.fromEntries(menu)).toEqual({
      a: '/gestione-interna/punti-vendita',
      b: '/gestione-interna/gestione-utenti',
      c: '/gestione-interna/punti-vendita/42',
      d: '/promozioni/in-corso',
      e: '/punti-vendita-bis',
    });
  });

  it('una seconda esecuzione non cambia nulla', async () => {
    const { fonte } = creaFonte({ a: '/gestione-hub' });
    await migraPercorsiSpostati(fonte);

    expect(await migraPercorsiSpostati(fonte)).toBe(0);
    expect(fonte.aggiornaPercorso).toHaveBeenCalledTimes(1);
  });
});
