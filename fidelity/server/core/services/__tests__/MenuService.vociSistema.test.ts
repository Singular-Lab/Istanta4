import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
// MenuService importa il menu predefinito e il modello MenuItem: qui non servono e non devono toccare il DB
vi.mock('../../inizializzazione/inizializzaInstallazione', () => ({ vociMenuSuperadmin: () => [] }));
vi.mock('../../models', () => ({ MenuItem: {} }));
vi.mock('../../repositories/MenuItemRepository', () => ({ MenuItemRepository: class { } }));
vi.mock('../../accessi/RisolutoreAccessi', () => ({ RisolutoreAccessi: { get: () => ({}) } }));
vi.mock('../../accessi/versionePermessi', () => ({ leggiVersionePermessi: vi.fn(), incrementaVersionePermessi: vi.fn() }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { TIPO_UTENTI } from '../../../../lib/enums';
import { MenuService } from '../MenuService';

const aggiungiVoci = (menu: unknown[], tipo: string) =>
  (new MenuService({} as any, {} as any) as any).ensureHubManagementEntry(menu, tipo) as unknown[];

const percorsi = (menu: unknown[]) =>
  menu.map((voce) => (typeof voce === 'string' ? voce : (voce as { pathname: string }).pathname));

describe('voci di sistema nel menu del Superadmin', () => {
  it('aggiunge Gestione Hub e Metodi di accesso sotto GESTIONE INTERNA', () => {
    const menu = ['PROMOZIONI', { pathname: '/promozioni/in-corso' }, 'GESTIONE INTERNA', { pathname: '/gestione-permessi' }, 'ALTRO', { pathname: '/x' }];

    expect(percorsi(aggiungiVoci(menu, TIPO_UTENTI.SUPERADMIN))).toEqual([
      'PROMOZIONI', '/promozioni/in-corso',
      'GESTIONE INTERNA', '/gestione-permessi', '/gestione-hub', '/gestione-metodi-accesso',
      'ALTRO', '/x',
    ]);
  });

  it('crea la sezione se manca e non duplica una voce gia\' presente', () => {
    const menu = [{ pathname: '/gestione-metodi-accesso' }];

    expect(percorsi(aggiungiVoci(menu, TIPO_UTENTI.SUPERADMIN))).toEqual([
      '/gestione-metodi-accesso', 'GESTIONE INTERNA', '/gestione-hub',
    ]);
  });

  it('non tocca il menu degli altri tipi', () => {
    const menu = ['PROMOZIONI', { pathname: '/promozioni/in-corso' }];

    expect(aggiungiVoci(menu, TIPO_UTENTI.AGENZIA)).toBe(menu);
  });
});
