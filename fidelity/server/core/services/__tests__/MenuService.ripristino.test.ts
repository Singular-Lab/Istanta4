import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { sequelize } from '../../db/SequelizeConnector';
import { MENU_SUPERADMIN } from '../../inizializzazione/datiPredefiniti';
import { ID_VOCI_POP_SUPERADMIN } from '../../inizializzazione/inizializzaInstallazione';
import { MenuItem } from '../../models';
import { MenuService } from '../MenuService';

// Il risolutore e la versione dei permessi stanno nel DB: qui si verifica solo che il ripristino li coinvolga.
vi.mock('../../accessi/RisolutoreAccessi', () => ({ RisolutoreAccessi: { get: () => ({}) } }));
vi.mock('../../accessi/versionePermessi', () => ({
  leggiVersionePermessi: vi.fn(async () => 1),
  incrementaVersionePermessi: vi.fn(async () => 2),
}));
vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { incrementaVersionePermessi } from '../../accessi/versionePermessi';

/**
 * "Ripristina menu predefiniti" ha preso il posto di "Importa da JSON", che svuotava i menu di tutti i
 * tipi di utente e poi leggeva config/menu.json, un file che non esiste.
 * Specifiche: installazione-iniziale "Ripristino del menu predefinito del Superadmin";
 * ruoli-permessi "Modifiche ai permessi applicate subito" (il menu si invalida su ogni worker).
 */
describe('MenuService.ripristinaMenuPredefiniti', () => {
  let tabella: any[];
  const transazione = { id: 'tx' };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(incrementaVersionePermessi).mockClear();
    tabella = [
      { tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'Voce personalizzata' },
      { tipo_utente: TIPO_UTENTI.AGENZIA, titolo: 'Menu Agenzia' },
    ];

    // Una transazione finta: se la callback fallisce, la tabella torna com'era.
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: any) => {
      const copia = [...tabella];
      try {
        return await callback(transazione);
      } catch (errore) {
        tabella = copia;
        throw errore;
      }
    }) as any);
    vi.spyOn(MenuItem, 'destroy').mockImplementation(async (o: any) => {
      const prima = tabella.length;
      tabella = tabella.filter(r => r.tipo_utente !== o.where.tipo_utente);
      return prima - tabella.length;
    });
    vi.spyOn(MenuItem, 'bulkCreate').mockImplementation(async (righe: any) => { tabella.push(...righe); return righe; });
  });

  const servizio = () => new MenuService({} as any);

  it('sostituisce il solo menu del Superadmin con quello predefinito', async () => {
    const voci = await servizio().ripristinaMenuPredefiniti();

    // MENU_SUPERADMIN convertito nelle viste Volantini e POP: le tre voci POP seguono lo storico.
    const ids = MENU_SUPERADMIN.map(v => v.id_menu_item);
    const storico = MENU_SUPERADMIN.findIndex(v => v.pathname === '/storico-materiali');
    const pop = [ID_VOCI_POP_SUPERADMIN.attivi, ID_VOCI_POP_SUPERADMIN['in-corso'], ID_VOCI_POP_SUPERADMIN.storico];
    expect(voci).toBe(MENU_SUPERADMIN.length + 3);
    const superadmin = tabella.filter(r => r.tipo_utente === TIPO_UTENTI.SUPERADMIN);
    expect(superadmin.map(r => r.id_menu_item)).toEqual([...ids.slice(0, storico + 1), ...pop, ...ids.slice(storico + 1)]);
    expect(tabella).toContainEqual({ tipo_utente: TIPO_UTENTI.AGENZIA, titolo: 'Menu Agenzia' });
  });

  it('il menu ripristinato porta alle viste Volantini e POP, non alle pagine Materiali', async () => {
    await servizio().ripristinaMenuPredefiniti();

    const superadmin = tabella.filter(r => r.tipo_utente === TIPO_UTENTI.SUPERADMIN);
    expect(superadmin.filter(r => /^\/(volantini|pop)\//.test(r.pathname ?? '')).map(r => [r.titolo, r.pathname])).toEqual([
      ['Volantini attivi', '/volantini/attivi'],
      ['Volantini in corso', '/volantini/in-corso'],
      ['Volantini storico', '/volantini/storico'],
      ['POP attivi', '/pop/attivi'],
      ['POP in corso', '/pop/in-corso'],
      ['POP storico', '/pop/storico'],
    ]);
    expect(superadmin.map(r => r.titolo)).toContain('VOLANTINI E POP');
    expect(superadmin.map(r => r.titolo)).not.toContain('MATERIALI');
    expect(superadmin.some(r => ['/materiali-attivi', '/materiali-in-corso', '/storico-materiali'].includes(r.pathname))).toBe(false);
  });

  it('incrementa la versione dei permessi nella stessa transazione, cosi ogni worker ricarica il menu', async () => {
    await servizio().ripristinaMenuPredefiniti();

    expect(incrementaVersionePermessi).toHaveBeenCalledTimes(1);
    expect(incrementaVersionePermessi).toHaveBeenCalledWith(transazione);
  });

  it('se l inserimento fallisce il menu resta quello di prima e la versione non cambia', async () => {
    vi.spyOn(MenuItem, 'bulkCreate').mockRejectedValue(new Error('vincolo violato'));

    await expect(servizio().ripristinaMenuPredefiniti()).rejects.toThrow('vincolo violato');
    expect(tabella).toContainEqual({ tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'Voce personalizzata' });
    expect(tabella).toHaveLength(2);
    expect(incrementaVersionePermessi).not.toHaveBeenCalled();
  });
});
