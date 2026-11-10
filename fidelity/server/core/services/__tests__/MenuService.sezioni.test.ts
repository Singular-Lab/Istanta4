import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
// MenuService importa il menu predefinito e il modello MenuItem: qui non servono e non devono toccare il DB
vi.mock('../../inizializzazione/inizializzaInstallazione', () => ({ vociMenuSuperadmin: () => [] }));
vi.mock('../../models', () => ({ MenuItem: {} }));
vi.mock('../../repositories/MenuItemRepository', () => ({ MenuItemRepository: class { } }));
vi.mock('../../accessi/RisolutoreAccessi', () => ({ RisolutoreAccessi: { get: () => ({}) } }));
vi.mock('../../accessi/versionePermessi', () => ({ leggiVersionePermessi: vi.fn(), incrementaVersionePermessi: vi.fn() }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { PERMESSI } from '../../../../lib/accessi/catalogo';
import { eSezioneMenu } from '../../../../lib/accessi/sezioni';
import { TIPO_UTENTI } from '../../../../lib/enums';
import type { MenuElement } from '../../../../lib/types';
import type { ContestoAccesso } from '../../accessi/contestoAccesso';
import { MenuService, paginaInizialeDi } from '../MenuService';

const voce = (pathname: string, extra: Record<string, unknown> = {}) => ({ title: pathname, pathname, icon: 'Circle', subMenu: [], ...extra });

/** MenuService con il menu salvato dato e i permessi effettivi dati, senza DB. */
const servizio = (menu: MenuElement[], permessi: string[] = []) =>
  new MenuService(
    { findMenuRuntimeByTipoUtente: async () => structuredClone(menu) } as never,
    { permessiDi: async () => new Set(permessi) } as never
  );

const contesto = (tipo: TIPO_UTENTI, superadmin = false) => ({ tipo, idRuoloGdo: null, superadmin }) as unknown as ContestoAccesso;

const struttura = (menu: MenuElement[]) =>
  menu.map(e => (typeof e === 'string' ? `# ${e}` : eSezioneMenu(e) ? `== ${e.title}` : `${e.pathname}${e.start_page ? ' *' : ''}`));

/** Il menu Category di Edro21: uguale a quello GDO, con la panoramica come pagina iniziale. */
const MENU_CATEGORY: MenuElement[] = [
  'VOLANTINI', voce('/gdo/dashboard', { start_page: true }),
  'PROMOZIONI', voce('/promozioni/nuova'), voce('/promozioni/in-corso'),
  'MATERIALI VOLANTINO', voce('/volantini/attivi'), voce('/volantini/storico'),
  'ORDINI DI STAMPA', voce('/nuovo-ods'), voce('/ods-in-corso'),
];

describe('menu dell\'utente diviso in sezioni', () => {
  it('chi ha solo permessi di consultazione vede solo la sezione Visualizzazione', async () => {
    const menu = await servizio(MENU_CATEGORY, [PERMESSI.MATERIALI.VISUALIZZA, PERMESSI.VOLANTINI.VISUALIZZA]).getMenuDiUtente(contesto(TIPO_UTENTI.CATEGORY));

    expect(struttura(menu)).toEqual([
      '== Visualizzazione',
      '# VOLANTINI', '/gdo/dashboard *',
      '# MATERIALI VOLANTINO', '/volantini/attivi', '/volantini/storico',
    ]);
  });

  it('con i permessi di produzione compaiono entrambe le sezioni, Produzione per prima', async () => {
    const permessi = [PERMESSI.MATERIALI.VISUALIZZA, PERMESSI.VOLANTINI.VISUALIZZA, PERMESSI.PROMO.VISUALIZZA, PERMESSI.PROMO.CREA, PERMESSI.ORDINI_STAMPA.VISUALIZZA, PERMESSI.ORDINI_STAMPA.CREA];
    const menu = await servizio(MENU_CATEGORY, permessi).getMenuDiUtente(contesto(TIPO_UTENTI.CATEGORY));

    expect(struttura(menu)).toEqual([
      '== Produzione',
      '# PROMOZIONI', '/promozioni/nuova', '/promozioni/in-corso',
      '# ORDINI DI STAMPA', '/nuovo-ods', '/ods-in-corso',
      '== Visualizzazione',
      '# VOLANTINI', '/gdo/dashboard *',
      '# MATERIALI VOLANTINO', '/volantini/attivi', '/volantini/storico',
    ]);
  });

  it('al Superadmin non mostra le voci senza pagina e la pagina iniziale resta la prima del menu salvato', async () => {
    const salvato: MenuElement[] = [
      voce('/superadmin/dashboard'),
      'PROMOZIONI', voce('/promozioni/nuova'),
      'SERVIZI', voce('/dashboard-overview-8', { disabled: true }),
      'DEVELOPMENT SINGULAR', voce('/gestione-pagine-singular'),
    ];
    const menu = await servizio(salvato).getMenuDiUtente(contesto(TIPO_UTENTI.SUPERADMIN, true));

    expect(struttura(menu)).toEqual([
      '== Produzione', '# PROMOZIONI', '/promozioni/nuova',
      // Le voci di sistema che MenuService aggiunge sempre al Superadmin, sotto GESTIONE INTERNA
      '== Gestione interna', '/impostazioni-gdo',
      '== Sistema', '/superadmin/dashboard *',
      '/gestione-interna/gestione-hub', '/gestione-interna/gestione-metodi-accesso',
    ]);
  });
});

describe('pagina iniziale', () => {
  it('è la voce segnata come pagina iniziale, se l\'utente può aprirla', async () => {
    const pagina = await servizio(MENU_CATEGORY, [PERMESSI.MATERIALI.VISUALIZZA, PERMESSI.VOLANTINI.VISUALIZZA]).getPaginaIniziale(contesto(TIPO_UTENTI.CATEGORY));
    expect(pagina).toBe('/gdo/dashboard');
  });

  it('se la voce segnata non è consentita è la prima voce consentita del menu salvato', async () => {
    const salvato: MenuElement[] = ['MATERIALI', voce('/volantini/attivi', { start_page: true }), 'ORDINI', voce('/ods-in-corso'), 'ALTRO', voce('/storico-volantini')];
    const servizioMenu = servizio(salvato, [PERMESSI.ORDINI_STAMPA.VISUALIZZA]);

    expect(await servizioMenu.getPaginaIniziale(contesto(TIPO_UTENTI.MARKETING))).toBe('/ods-in-corso');
    const segnate = struttura(await servizioMenu.getMenuDiUtente(contesto(TIPO_UTENTI.MARKETING))).filter(v => v.endsWith('*'));
    expect(segnate).toEqual(['/ods-in-corso *']);
  });

  it('senza pagine consentite nel menu: la panoramica a chi la può aprire, altrimenti il profilo', async () => {
    // La panoramica chiede "volantini.visualizza": senza permessi nessuna voce del menu Category si apre
    expect(await servizio(MENU_CATEGORY, []).getPaginaIniziale(contesto(TIPO_UTENTI.CATEGORY))).toBe('/profilo-utente');
    expect(await servizio(['VUOTO'], [PERMESSI.VOLANTINI.VISUALIZZA]).getPaginaIniziale(contesto(TIPO_UTENTI.MARKETING))).toBe('/gdo/dashboard');
    expect(await servizio(['VUOTO'], []).getPaginaIniziale(contesto(TIPO_UTENTI.MARKETING))).toBe('/profilo-utente');
  });

  it('paginaInizialeDi salta le voci disattivate e cerca anche nelle sottovoci', () => {
    const menu: MenuElement[] = [
      voce('/promozioni/in-corso', { disabled: true, start_page: true }),
      { title: 'Gruppo', icon: 'Circle', subMenu: [voce('/volantini/attivi', { start_page: true })] },
    ];
    expect(paginaInizialeDi(menu)).toBe('/volantini/attivi');
  });
});

describe('salvataggio del menu', () => {
  it('rifiuta le voci che non aprono una pagina di Fidelity, prima di toccare il menu salvato', async () => {
    const voci = [
      { tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'PROMOZIONI', tipo: 'separator' as const, ordinamento: 0 },
      { tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'In corso', tipo: 'item' as const, pathname: '/promozioni/in-corso', ordinamento: 1 },
      { tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'Gestione Pagine', tipo: 'item' as const, pathname: '/gestione-pagine-singular', ordinamento: 2 },
    ];

    await expect(servizio([]).saveMenu(TIPO_UTENTI.SUPERADMIN, null, voci)).rejects.toMatchObject({
      details: { senzaPagina: ['/gestione-pagine-singular'] },
    });
  });
});
