import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMESSI } from '../../../../lib/accessi/catalogo';
import type { VoceNuovaMenu } from '../../../../lib/accessi/menuMateriali';
import { TIPO_UTENTI } from '../../../../lib/enums';

vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
vi.mock('../../logger', () => ({ log: { info: vi.fn() } }));

import { log } from '../../logger';
import {
  migraMenuMateriali,
  type FonteMenuMateriali,
  type MenuInTransazione,
  type RigaMenu,
} from '../migrazioneMenuMateriali';

const riga = (
  id: string,
  menu: Pick<RigaMenu, 'tipo_utente' | 'id_ruolo_utente_gdo' | 'ruolo_gdo'>,
  titolo: string,
  pathname: string | null,
  ordinamento: number,
  altro: Partial<RigaMenu> = {}
): RigaMenu => ({
  id_menu_item: id,
  ...menu,
  id_parent: null,
  tipo: pathname ? 'item' : 'separator',
  titolo,
  icona: pathname ? 'Circle' : null,
  pathname,
  codice_permesso: null,
  disabilitato: false,
  start_page: false,
  ordinamento,
  ...altro,
});

const SUPERADMIN = { tipo_utente: TIPO_UTENTI.SUPERADMIN, id_ruolo_utente_gdo: null, ruolo_gdo: null };
const GDO_ADMIN = { tipo_utente: TIPO_UTENTI.GDO, id_ruolo_utente_gdo: 'ruolo-admin', ruolo_gdo: 'GDO_ADMIN' };
const GDO_BASE = { tipo_utente: TIPO_UTENTI.GDO, id_ruolo_utente_gdo: null, ruolo_gdo: null };
const AGENZIA = { tipo_utente: TIPO_UTENTI.AGENZIA, id_ruolo_utente_gdo: null, ruolo_gdo: null };

const menuSalvati = (): RigaMenu[] => [
  // Superadmin, come lo semina MENU_SUPERADMIN
  riga('sa-sep', SUPERADMIN, 'MATERIALI', null, 0),
  riga('sa-attivi', SUPERADMIN, 'Materiali attivi', '/materiali-attivi', 1, { icona: 'FolderOpen', codice_permesso: 'pagina.materiali_attivi' }),
  riga('sa-in-corso', SUPERADMIN, 'Materiali in corso', '/materiali-in-corso', 2, { icona: 'Clock', codice_permesso: 'pagina.materiali_in_corso' }),
  riga('sa-storico', SUPERADMIN, 'Storico materiali', '/storico-materiali', 3, { icona: 'Archive', codice_permesso: 'pagina.storico_materiali' }),
  riga('sa-ods', SUPERADMIN, 'Ordini in corso', '/ods-in-corso', 4),
  // Sotto-ruolo GDO, con un titolo personalizzato e due soli periodi
  riga('gdo-promo', GDO_ADMIN, 'Promozioni', '/promozioni/in-corso', 0),
  riga('gdo-attivi', GDO_ADMIN, 'I volantini del mese', '/materiali-attivi', 1, { icona: 'Star' }),
  riga('gdo-storico', GDO_ADMIN, 'storico materiali', '/storico-materiali', 2, { icona: 'Archive' }),
  riga('gdo-profilo', GDO_ADMIN, 'Profilo', '/profilo-utente', 3),
  // Agenzia, senza pagine Materiali
  riga('ag-promo', AGENZIA, 'Promozioni', '/promozioni/in-corso', 0),
];

const creaFonte = (righe: RigaMenu[]) => {
  let tabella = new Map(righe.map(r => [r.id_menu_item, { ...r }]));
  const menu: MenuInTransazione = {
    leggiVoci: async () => Array.from(tabella.values(), r => ({ ...r })),
    aggiornaVoce: vi.fn(async (voce: RigaMenu) => { tabella.set(voce.id_menu_item, { ...voce }); }),
    inserisciVoce: vi.fn(async (voce: RigaMenu) => {
      if (tabella.has(voce.id_menu_item)) throw new Error(`id duplicato: ${voce.id_menu_item}`);
      tabella.set(voce.id_menu_item, { ...voce });
    }),
    incrementaVersione: vi.fn(async () => { }),
  };
  // Una transazione finta: se il lavoro fallisce, la tabella torna com'era.
  const fonte: FonteMenuMateriali = {
    inTransazione: async (lavoro) => {
      const copia = new Map(tabella);
      try {
        return await lavoro(menu);
      } catch (errore) {
        tabella = copia;
        throw errore;
      }
    },
  };
  return { fonte, menu, tabella: () => tabella };
};

/** Le voci di un menu in ordine: titolo, percorso, permesso, icona. */
const menuDi = (tabella: Map<string, RigaMenu>, chi: { tipo_utente: string; id_ruolo_utente_gdo: string | null }) =>
  Array.from(tabella.values())
    .filter(r => r.tipo_utente === chi.tipo_utente && r.id_ruolo_utente_gdo === chi.id_ruolo_utente_gdo)
    .sort((a, b) => a.ordinamento - b.ordinamento)
    .map(r => [r.titolo, r.pathname, r.codice_permesso, r.icona]);

let progressivo: number;
const nuovoId = (voce: VoceNuovaMenu) => `pop-${voce}-${++progressivo}`;

beforeEach(() => {
  progressivo = 0;
  vi.mocked(log.info).mockClear();
});

describe('migrazione dei menu salvati alle viste Volantini e POP', () => {
  it('converte ogni menu con le pagine Materiali, Superadmin compreso, e lascia gli altri', async () => {
    const { fonte, menu, tabella } = creaFonte(menuSalvati());

    const esito = await migraMenuMateriali(fonte, nuovoId);

    const M = PERMESSI.MATERIALI.VISUALIZZA;
    expect(menuDi(tabella(), SUPERADMIN)).toEqual([
      ['MATERIALI VOLANTINO', null, null, null],
      ['Volantini attivi', '/volantini/attivi', M, 'FolderOpen'],
      ['Volantini in corso', '/volantini/in-corso', M, 'Clock'],
      ['Volantini storico', '/volantini/storico', M, 'Archive'],
      ['MATERIALI POP', null, null, null],
      ['POP attivi', '/pop/attivi', M, 'FolderOpen'],
      ['POP in corso', '/pop/in-corso', M, 'Clock'],
      ['POP storico', '/pop/storico', M, 'Archive'],
      ['Ordini in corso', '/ods-in-corso', null, 'Circle'],
    ]);
    // Il titolo scelto dall'amministratore resta; quello predefinito cambia anche in minuscolo.
    expect(menuDi(tabella(), GDO_ADMIN)).toEqual([
      ['Promozioni', '/promozioni/in-corso', null, 'Circle'],
      ['I volantini del mese', '/volantini/attivi', M, 'Star'],
      ['Volantini storico', '/volantini/storico', M, 'Archive'],
      ['POP attivi', '/pop/attivi', M, 'Star'],
      ['POP storico', '/pop/storico', M, 'Archive'],
      ['Profilo', '/profilo-utente', null, 'Circle'],
    ]);
    expect(menuDi(tabella(), AGENZIA)).toEqual([['Promozioni', '/promozioni/in-corso', null, 'Circle']]);
    expect(vi.mocked(menu.aggiornaVoce).mock.calls.map(([v]) => v.id_menu_item)).not.toContain('ag-promo');
    // Inserite: tre voci POP e l'intestazione POP del Superadmin, due voci POP del sotto-ruolo (senza intestazioni)
    expect(esito).toEqual({ menu: 2, aggiornate: 8, inserite: 6 });
  });

  it('le voci POP nascono nel menu giusto, con un id nuovo, attive e senza pagina iniziale', async () => {
    const { fonte, menu } = creaFonte(menuSalvati());

    await migraMenuMateriali(fonte, nuovoId);

    const inserite = vi.mocked(menu.inserisciVoce).mock.calls.map(([v]) => v);
    expect(inserite.filter(v => v.tipo_utente === TIPO_UTENTI.GDO)).toEqual([
      expect.objectContaining({ id_ruolo_utente_gdo: 'ruolo-admin', ruolo_gdo: 'GDO_ADMIN', id_parent: null, tipo: 'item', titolo: 'POP attivi', disabilitato: false, start_page: false }),
      expect.objectContaining({ id_ruolo_utente_gdo: 'ruolo-admin', ruolo_gdo: 'GDO_ADMIN', id_parent: null, tipo: 'item', titolo: 'POP storico', disabilitato: false, start_page: false }),
    ]);
    expect(inserite.filter(v => v.tipo === 'separator')).toEqual([
      expect.objectContaining({ tipo_utente: TIPO_UTENTI.SUPERADMIN, id_ruolo_utente_gdo: null, titolo: 'MATERIALI POP', pathname: null, ordinamento: 4 }),
    ]);
    const ids = inserite.map(v => v.id_menu_item);
    expect(new Set(ids).size).toBe(6);
    expect(ids.every(id => id.startsWith('pop-'))).toBe(true);
  });

  it('divide anche i menu già convertiti con l intestazione unica VOLANTINI E POP, una volta sola', async () => {
    const { fonte, menu, tabella } = creaFonte([
      riga('sep', SUPERADMIN, 'VOLANTINI E POP', null, 0),
      riga('v-attivi', SUPERADMIN, 'Volantini attivi', '/volantini/attivi', 1),
      riga('p-attivi', SUPERADMIN, 'POP attivi', '/pop/attivi', 2),
      riga('ods', SUPERADMIN, 'Ordini in corso', '/ods-in-corso', 3),
    ]);

    const prima = await migraMenuMateriali(fonte, nuovoId);
    const seconda = await migraMenuMateriali(fonte, nuovoId);

    expect(menuDi(tabella(), SUPERADMIN).map(([titolo]) => titolo)).toEqual([
      'MATERIALI VOLANTINO', 'Volantini attivi', 'MATERIALI POP', 'POP attivi', 'Ordini in corso',
    ]);
    expect(prima).toEqual({ menu: 1, aggiornate: 3, inserite: 1 });
    expect(seconda).toEqual({ menu: 0, aggiornate: 0, inserite: 0 });
    expect(menu.incrementaVersione).toHaveBeenCalledTimes(1);
  });

  it('senza generatore indicato le voci POP ricevono un uuid', async () => {
    const { fonte, menu } = creaFonte(menuSalvati());

    await migraMenuMateriali(fonte);

    for (const [voce] of vi.mocked(menu.inserisciVoce).mock.calls) {
      expect(voce.id_menu_item).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('incrementa la versione dei permessi una volta sola, cosi ogni worker ricarica i menu, e registra cosa ha fatto', async () => {
    const { fonte, menu } = creaFonte(menuSalvati());

    await migraMenuMateriali(fonte, nuovoId);

    expect(menu.incrementaVersione).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledTimes(1);
    const messaggio = String(vi.mocked(log.info).mock.calls[0][0]);
    expect(messaggio).toContain('in 2 menu');
    expect(messaggio).toContain(`${TIPO_UTENTI.GDO} · sotto-ruolo ruolo-admin: 3 voci aggiornate, 2 voci aggiunte (POP e intestazioni)`);
    expect(messaggio).toContain(`${TIPO_UTENTI.SUPERADMIN}: 5 voci aggiornate, 4 voci aggiunte (POP e intestazioni)`);
  });

  it('una seconda esecuzione non cambia nulla e non tocca la versione', async () => {
    const { fonte, menu, tabella } = creaFonte(menuSalvati());
    await migraMenuMateriali(fonte, nuovoId);
    const dopoLaPrima = structuredClone(Array.from(tabella().values()));
    vi.mocked(menu.aggiornaVoce).mockClear();
    vi.mocked(menu.inserisciVoce).mockClear();
    vi.mocked(menu.incrementaVersione).mockClear();
    vi.mocked(log.info).mockClear();

    const esito = await migraMenuMateriali(fonte, nuovoId);

    expect(esito).toEqual({ menu: 0, aggiornate: 0, inserite: 0 });
    expect(Array.from(tabella().values())).toEqual(dopoLaPrima);
    expect(menu.aggiornaVoce).not.toHaveBeenCalled();
    expect(menu.inserisciVoce).not.toHaveBeenCalled();
    expect(menu.incrementaVersione).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it('senza menu da convertire non scrive nulla e non tocca la versione', async () => {
    const { fonte, menu } = creaFonte([riga('ag-promo', AGENZIA, 'Promozioni', '/promozioni/in-corso', 0)]);

    expect(await migraMenuMateriali(fonte, nuovoId)).toEqual({ menu: 0, aggiornate: 0, inserite: 0 });
    expect(menu.aggiornaVoce).not.toHaveBeenCalled();
    expect(menu.incrementaVersione).not.toHaveBeenCalled();
  });

  it('il menu base di un tipo e le righe storiche di un sotto-ruolo non collegato sono menu distinti', async () => {
    const { fonte, tabella } = creaFonte([
      riga('base', GDO_BASE, 'Materiali attivi', '/materiali-attivi', 0),
      riga('storica', { ...GDO_BASE, ruolo_gdo: 'GDO_MARKETING' }, 'Materiali attivi', '/materiali-attivi', 0),
    ]);

    const esito = await migraMenuMateriali(fonte, nuovoId);

    expect(esito).toEqual({ menu: 2, aggiornate: 2, inserite: 2 });
    const pop = Array.from(tabella().values()).filter(r => r.pathname === '/pop/attivi');
    expect(pop.map(r => r.ruolo_gdo).sort()).toEqual(['GDO_MARKETING', null].sort());
  });

  it('se una scrittura fallisce nessun menu cambia e la versione resta quella', async () => {
    const { fonte, menu, tabella } = creaFonte(menuSalvati());
    const prima = structuredClone(Array.from(tabella().values()));
    vi.mocked(menu.inserisciVoce).mockRejectedValueOnce(new Error('vincolo violato'));

    await expect(migraMenuMateriali(fonte, nuovoId)).rejects.toThrow('vincolo violato');
    expect(Array.from(tabella().values())).toEqual(prima);
    expect(menu.incrementaVersione).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });
});
