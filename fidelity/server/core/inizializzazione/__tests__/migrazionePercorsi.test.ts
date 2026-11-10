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
      a: '/aree-e-canali',
      b: '/gestione-utenti',
      c: '/aree-e-canali/42',
      d: '/promozioni/in-corso',
      e: '/aree-e-canali-bis',
    });

    expect(await migraPercorsiSpostati(fonte)).toBe(3);
    expect(Object.fromEntries(menu)).toEqual({
      a: '/gestione-interna/aree-e-canali',
      b: '/gestione-interna/gestione-utenti',
      c: '/gestione-interna/aree-e-canali/42',
      d: '/promozioni/in-corso',
      e: '/aree-e-canali-bis',
    });
  });

  it('/punti-vendita resta com\'è: è la consultazione dei punti vendita, non più un vecchio percorso', async () => {
    const { fonte, menu } = creaFonte({
      a: '/punti-vendita',
      b: '/punti-vendita/42',
      c: '/gestione-interna/punti-vendita',
    });

    expect(await migraPercorsiSpostati(fonte)).toBe(0);
    expect(Object.fromEntries(menu)).toEqual({
      a: '/punti-vendita',
      b: '/punti-vendita/42',
      c: '/gestione-interna/punti-vendita',
    });
    expect(fonte.aggiornaPercorso).not.toHaveBeenCalled();
  });

  it('porta le voci WebPliant a Workspace WebPliant, al suo editor e alle Impostazioni GDO', async () => {
    const { fonte, menu } = creaFonte({
      a: '/webliant/impostazioni-webpliant',
      b: '/webliant/impostazioni-webpliant/workspace',
      c: '/webliant/impostazioni-webpliant/configurazione-webpliant',
      d: '/webliant/webpliant-disponibili',
      e: '/webliant/workspace',
    });

    expect(await migraPercorsiSpostati(fonte)).toBe(3);
    expect(Object.fromEntries(menu)).toEqual({
      a: '/webliant/workspace',
      b: '/webliant/workspace/editor',
      c: '/impostazioni-gdo',
      d: '/webliant/webpliant-disponibili',
      e: '/webliant/workspace',
    });
  });

  it('la voce col vecchio titolo predefinito diventa "Workspace WebPliant"; un titolo scelto a mano resta', async () => {
    const voci = [
      { id_menu_item: 'a', pathname: '/webliant/impostazioni-webpliant', titolo: 'Impostazioni WebPliant' },
      { id_menu_item: 'b', pathname: '/webliant/impostazioni-webpliant', titolo: 'I miei siti' },
      { id_menu_item: 'c', pathname: '/webliant/impostazioni-webpliant/configurazione-webpliant', titolo: 'Impostazioni WebPliant' },
    ];
    const titoli = new Map(voci.map(v => [v.id_menu_item, v.titolo]));
    const fonte: FonteMenu = {
      leggiVoci: async () => voci,
      aggiornaPercorso: vi.fn(async () => {}),
      aggiornaTitolo: vi.fn(async (id: string, titolo: string) => { titoli.set(id, titolo); }),
    };

    expect(await migraPercorsiSpostati(fonte)).toBe(3);
    expect(Object.fromEntries(titoli)).toEqual({ a: 'Workspace WebPliant', b: 'I miei siti', c: 'Impostazioni WebPliant' });
    expect(fonte.aggiornaTitolo).toHaveBeenCalledTimes(1);
  });

  it('una seconda esecuzione non cambia nulla', async () => {
    const { fonte } = creaFonte({ a: '/gestione-hub' });
    await migraPercorsiSpostati(fonte);

    expect(await migraPercorsiSpostati(fonte)).toBe(0);
    expect(fonte.aggiornaPercorso).toHaveBeenCalledTimes(1);
  });
});
