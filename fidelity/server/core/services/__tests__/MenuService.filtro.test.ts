import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
// MenuService importa il menu predefinito e il modello MenuItem per il ripristino: qui non servono e non devono toccare il DB
vi.mock('../../inizializzazione/inizializzaInstallazione', () => ({ vociMenuSuperadmin: () => [] }));
vi.mock('../../models', () => ({ MenuItem: {} }));
vi.mock('../../repositories/MenuItemRepository', () => ({ MenuItemRepository: class { } }));
vi.mock('../../accessi/RisolutoreAccessi', () => ({ RisolutoreAccessi: { get: () => ({}) } }));
vi.mock('../../accessi/versionePermessi', () => ({ leggiVersionePermessi: vi.fn(), incrementaVersionePermessi: vi.fn() }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { filtraMenu } from '../MenuService';

const menu = [
  'PROMOZIONI',
  { title: 'In corso', pathname: '/promozioni/in-corso', subMenu: [] },
  { title: 'Nuova', pathname: '/promozioni/nuova', subMenu: [] },
  'STAMPA',
  { title: 'ODS in corso', pathname: '/ods-in-corso', subMenu: [] },
  'STRUMENTI',
  {
    title: 'Gruppo',
    subMenu: [
      { title: 'Barcode', pathname: '/barcode-reader' },
      { title: 'Analisi', pathname: '/competitor-analyzer' },
    ],
  },
];

describe('filtraMenu', () => {
  it('tiene solo le voci consentite e toglie le sezioni rimaste vuote', () => {
    const consentite = new Set(['/promozioni/in-corso']);
    const risultato = filtraMenu(menu as any, p => consentite.has(p));
    expect(risultato).toEqual(['PROMOZIONI', { title: 'In corso', pathname: '/promozioni/in-corso', subMenu: [] }]);
  });

  it('una voce senza pagina resta se ha almeno una sottovoce consentita', () => {
    const risultato = filtraMenu(menu as any, p => p === '/barcode-reader');
    expect(risultato).toEqual([
      'STRUMENTI',
      { title: 'Gruppo', subMenu: [{ title: 'Barcode', pathname: '/barcode-reader', subMenu: [] }] },
    ]);
  });

  it('senza permessi il menu è vuoto', () => {
    expect(filtraMenu(menu as any, () => false)).toEqual([]);
  });
});
