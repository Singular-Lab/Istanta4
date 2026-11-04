import { describe, expect, it } from 'vitest';
import type { MenuElement } from '../../types';
import { sezioneDiPercorso } from '../pagine';
import { SEZIONI, eSezioneMenu, sezionaMenu, titoloSezione } from '../sezioni';

const voce = (pathname: string, extra: Record<string, unknown> = {}) => ({ title: pathname, pathname, icon: 'Circle', ...extra });
const sezione = (s: string) => ({ sezione: s, title: titoloSezione(s as never) });

/** Il menu salvato del Superadmin di Edro21 (Dashboard senza gruppo, poi i gruppi predefiniti). */
const MENU_SUPERADMIN: MenuElement[] = [
  voce('/superadmin/dashboard'),
  'PROMOZIONI',
  voce('/promozioni/nuova'),
  voce('/promozioni/in-corso'),
  'MATERIALI VOLANTINO',
  voce('/punti-vendita'),
  voce('/volantini/attivi'),
  'WEBPLIANT',
  voce('/webliant/impostazioni-webpliant'),
  voce('/webliant/webpliant-disponibili'),
  'SERVIZI',
  voce('/dashboard-overview-8', { disabled: true }),
  voce('/gestione-ricette'),
  voce('/whatsapp/gestione-whatsapp-superadmin'),
  'GESTIONE INTERNA',
  voce('/gestione-interna/aree-e-canali'),
  voce('/gestione-interna/gestione-hub'),
  'IMPOSTAZIONI',
  voce('/impostazioni-di-produzione'),
  voce('/gestione-interna/gestione-permessi'),
  'DEVELOPMENT SINGULAR',
  voce('/gestione-pagine-singular'),
  voce('/gestione-webhook'),
];

const struttura = (menu: MenuElement[]) =>
  menu.map(e => (typeof e === 'string' ? `# ${e}` : eSezioneMenu(e) ? `== ${e.title}` : e.pathname ?? `[${e.title}]`));

describe('sezionaMenu', () => {
  it('divide il menu del Superadmin nelle sezioni, nell\'ordine previsto', () => {
    expect(struttura(sezionaMenu(MENU_SUPERADMIN, sezioneDiPercorso))).toEqual([
      '== Produzione',
      '# PROMOZIONI', '/promozioni/nuova', '/promozioni/in-corso',
      '# WEBPLIANT', '/webliant/impostazioni-webpliant',
      '# SERVIZI', '/gestione-ricette',
      '# IMPOSTAZIONI', '/impostazioni-di-produzione',
      '== Visualizzazione',
      '# MATERIALI VOLANTINO', '/punti-vendita', '/volantini/attivi',
      '# WEBPLIANT', '/webliant/webpliant-disponibili',
      '== Comunicazione',
      '# SERVIZI', '/whatsapp/gestione-whatsapp-superadmin',
      '== Gestione interna',
      '/gestione-interna/aree-e-canali',
      '# DEVELOPMENT SINGULAR', '/gestione-webhook',
      '== Sistema',
      '/superadmin/dashboard',
      '/gestione-interna/gestione-hub',
      '# IMPOSTAZIONI', '/gestione-interna/gestione-permessi',
    ]);
  });

  it('nessuna pagina compare in due sezioni e le voci senza pagina spariscono', () => {
    const percorsi = sezionaMenu(MENU_SUPERADMIN, sezioneDiPercorso)
      .flatMap(e => (typeof e === 'string' || eSezioneMenu(e) ? [] : [e.pathname]));

    expect(new Set(percorsi).size).toBe(percorsi.length);
    expect(percorsi).not.toContain('/gestione-pagine-singular');
    expect(percorsi).not.toContain('/dashboard-overview-8');
  });

  it('un gruppo con il nome di una sezione non ripete l\'intestazione', () => {
    const menu: MenuElement[] = ['Gestione interna', voce('/gestione-interna/gestione-utenti'), 'SISTEMA', voce('/gestione-interna/gestione-hub')];

    expect(struttura(sezionaMenu(menu, sezioneDiPercorso))).toEqual([
      '== Gestione interna', '/gestione-interna/gestione-utenti',
      '== Sistema', '/gestione-interna/gestione-hub',
    ]);
  });

  it('le sezioni senza voci non compaiono', () => {
    const menu: MenuElement[] = ['MATERIALI VOLANTINO', voce('/volantini/attivi'), voce('/volantini/storico')];

    expect(sezionaMenu(menu, sezioneDiPercorso)).toEqual([
      sezione('visualizzazione'),
      'MATERIALI VOLANTINO',
      { ...voce('/volantini/attivi'), subMenu: [] },
      { ...voce('/volantini/storico'), subMenu: [] },
    ]);
  });

  it('un titolo di gruppo scelto dall\'amministratore resta com\'è', () => {
    const menu: MenuElement[] = ['Stampa', voce('/ods-in-corso')];

    expect(struttura(sezionaMenu(menu, sezioneDiPercorso))).toEqual(['== Produzione', '# Stampa', '/ods-in-corso']);
  });

  it('una voce con sottovoci di sezioni diverse si divide e tiene il suo indirizzo solo nella sua sezione', () => {
    const menu: MenuElement[] = [
      {
        title: 'Promozioni', icon: 'Tag', pathname: '/promozioni/in-corso',
        subMenu: [voce('/promozioni/storico'), voce('/volantini/storico'), voce('/inesistente')],
      },
    ];

    expect(sezionaMenu(menu, sezioneDiPercorso)).toEqual([
      sezione('produzione'),
      { title: 'Promozioni', icon: 'Tag', pathname: '/promozioni/in-corso', subMenu: [voce('/promozioni/storico')] },
      sezione('visualizzazione'),
      { title: 'Promozioni', icon: 'Tag', subMenu: [voce('/volantini/storico')] },
    ]);
  });

  it('ignora le sezioni già presenti e restituisce un menu vuoto senza voci', () => {
    expect(sezionaMenu([sezione('produzione') as MenuElement, 'VUOTO'], sezioneDiPercorso)).toEqual([]);
  });
});

describe('SEZIONI', () => {
  it('ha un titolo per ogni sezione, nell\'ordine del menu', () => {
    expect(SEZIONI.map(s => s.titolo)).toEqual(['Produzione', 'Visualizzazione', 'Comunicazione', 'Gestione interna', 'Sistema', 'Account']);
  });
});
