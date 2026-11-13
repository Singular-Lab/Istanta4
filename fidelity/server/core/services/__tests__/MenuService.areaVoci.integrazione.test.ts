import { beforeEach, expect, it } from 'vitest';
import { PERMESSI as P } from '../../../../lib/accessi/catalogo';
import { eSezioneMenu } from '../../../../lib/accessi/sezioni';
import { TIPO_UTENTI } from '../../../../lib/enums';
import type { MenuElement } from '../../../../lib/types';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaTabellaStatoAccessi } from '../../accessi/versionePermessi';
import type { ContestoAccesso } from '../../accessi/contestoAccesso';
import type { MenuItemDTO } from '../../interfaces/IMenuService';
import { MenuItemRepository } from '../../repositories/MenuItemRepository';
import { MenuService } from '../MenuService';

// L'area scelta per una voce del menu su PostgreSQL: si salva nella colonna menu_items.sezione solo
// quando e' diversa da quella della pagina, torna nella gestione dei menu e nel menu dell'utente,
// e la stessa pagina resta in due aree.
describeConDatabase('menu: area scelta per le voci', () => {
  usaDatabase();
  const repository = new MenuItemRepository();
  const permessi = new Set<string>([P.PROMO.VISUALIZZA, P.MATERIALI.VISUALIZZA]);
  const servizio = new MenuService(repository, { permessiDi: async () => permessi } as never);

  const voce = (titolo: string, pathname: string, ordinamento: number, sezione?: string | null): MenuItemDTO => ({
    tipo_utente: TIPO_UTENTI.AGENZIA, titolo, tipo: 'item', icona: 'Circle', pathname, ordinamento,
    ...(sezione !== undefined ? { sezione } : {}),
  });
  const separatore = (titolo: string, ordinamento: number): MenuItemDTO => ({
    tipo_utente: TIPO_UTENTI.AGENZIA, titolo, tipo: 'separator', ordinamento,
  });

  const MENU: MenuItemDTO[] = [
    separatore('PROMOZIONI', 0),
    voce('Promozioni in corso', '/promozioni/in-corso', 1),
    voce('Volantini in produzione', '/volantini/attivi', 2, 'produzione'),
    separatore('CONSULTA', 3),
    // L'area della pagina scritta per esteso si salva come nessuna scelta
    voce('Volantini attivi', '/volantini/attivi', 4, 'visualizzazione'),
  ];

  const contesto = { tipo: TIPO_UTENTI.AGENZIA, idRuoloGdo: null, superadmin: false } as unknown as ContestoAccesso;

  const struttura = (menu: MenuElement[]) =>
    menu.map(e => (typeof e === 'string' ? `# ${e}` : eSezioneMenu(e) ? `== ${e.title}` : `${e.title}`));

  beforeEach(async () => {
    await svuotaTabelle('menu_items');
    await creaTabellaStatoAccessi();
  });

  it('salva l\'area solo se diversa da quella della pagina e la rilegge nella gestione dei menu', async () => {
    await servizio.saveMenu(TIPO_UTENTI.AGENZIA, null, MENU);

    const salvato = await servizio.getMenuItemsPerUtente(TIPO_UTENTI.AGENZIA, null);
    expect(salvato.filter(v => v.tipo === 'item').map(v => [v.titolo, v.sezione])).toEqual([
      ['Promozioni in corso', null],
      ['Volantini in produzione', 'produzione'],
      ['Volantini attivi', null],
    ]);
  });

  it('il menu dell\'utente mostra la pagina in entrambe le aree', async () => {
    await servizio.saveMenu(TIPO_UTENTI.AGENZIA, null, MENU);

    const runtime = await repository.findMenuRuntimeByTipoUtente(TIPO_UTENTI.AGENZIA, null);
    expect(runtime.filter(e => typeof e !== 'string').map(e => [e.title, e.area ?? null])).toEqual([
      ['Promozioni in corso', null],
      ['Volantini in produzione', 'produzione'],
      ['Volantini attivi', null],
    ]);

    expect(struttura(await servizio.getMenuDiUtente(contesto))).toEqual([
      '== Produzione', '# PROMOZIONI', 'Promozioni in corso', 'Volantini in produzione',
      '== Visualizzazione', '# CONSULTA', 'Volantini attivi',
    ]);
  });

  it('rifiuta la stessa pagina due volte nella stessa area senza toccare il menu salvato', async () => {
    await servizio.saveMenu(TIPO_UTENTI.AGENZIA, null, MENU);

    await expect(servizio.saveMenu(TIPO_UTENTI.AGENZIA, null, [
      voce('Volantini', '/volantini/attivi', 0, 'produzione'),
      voce('Ancora volantini', '/volantini/attivi', 1, 'produzione'),
    ])).rejects.toMatchObject({ details: { ripetute: [{ pathname: '/volantini/attivi', sezione: 'produzione' }] } });

    expect(await servizio.getMenuItemsPerUtente(TIPO_UTENTI.AGENZIA, null)).toHaveLength(MENU.length);
  });
});
