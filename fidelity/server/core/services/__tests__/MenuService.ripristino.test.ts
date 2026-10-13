import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { sequelize } from '../../db/SequelizeConnector';
import { MENU_SUPERADMIN } from '../../inizializzazione/datiPredefiniti';
import { MenuItem } from '../../models';
import { MenuService } from '../MenuService';

/**
 * "Ripristina menu predefiniti" ha preso il posto di "Importa da JSON", che svuotava i menu di tutti i
 * tipi di utente e poi leggeva config/menu.json, un file che non esiste.
 */
describe('MenuService.ripristinaMenuPredefiniti', () => {
  let tabella: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    tabella = [
      { tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'Voce personalizzata' },
      { tipo_utente: TIPO_UTENTI.AGENZIA, titolo: 'Menu Agenzia' },
    ];

    // Una transazione finta: se la callback fallisce, la tabella torna com'era.
    vi.spyOn(sequelize, 'transaction').mockImplementation((async (callback: any) => {
      const copia = [...tabella];
      try {
        return await callback({});
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

    expect(voci).toBe(MENU_SUPERADMIN.length);
    const superadmin = tabella.filter(r => r.tipo_utente === TIPO_UTENTI.SUPERADMIN);
    expect(superadmin.map(r => r.id_menu_item)).toEqual(MENU_SUPERADMIN.map(v => v.id_menu_item));
    expect(tabella).toContainEqual({ tipo_utente: TIPO_UTENTI.AGENZIA, titolo: 'Menu Agenzia' });
  });

  it('se l inserimento fallisce il menu resta quello di prima', async () => {
    vi.spyOn(MenuItem, 'bulkCreate').mockRejectedValue(new Error('vincolo violato'));

    await expect(servizio().ripristinaMenuPredefiniti()).rejects.toThrow('vincolo violato');
    expect(tabella).toContainEqual({ tipo_utente: TIPO_UTENTI.SUPERADMIN, titolo: 'Voce personalizzata' });
    expect(tabella).toHaveLength(2);
  });
});
