import { describe, expect, it } from 'vitest';
import { PERMESSI } from '../catalogo';
import {
  convertiMenuMateriali,
  PERCORSI_MATERIALI,
  SEPARATORE_VOLANTINI_E_POP,
  type VoceMenuConvertibile,
} from '../menuMateriali';
import { paginaPer } from '../pagine';
import type { PeriodoMateriali } from '../../materiali/periodi';

type Voce = VoceMenuConvertibile & { id_parent: string | null };

const voce = (id: string, titolo: string, pathname: string | null, ordinamento: number, altro: Partial<Voce> = {}): Voce => ({
  id_menu_item: id,
  id_parent: null,
  tipo: 'item',
  titolo,
  icona: 'Circle',
  pathname,
  codice_permesso: null,
  disabilitato: false,
  start_page: false,
  ordinamento,
  ...altro,
});

const separatore = (id: string, titolo: string, ordinamento: number): Voce =>
  voce(id, titolo, null, ordinamento, { tipo: 'separator', icona: null });

const idPop = (periodo: PeriodoMateriali) => `pop-${periodo}`;

/** Le voci come compaiono nel menu: titolo, percorso, ordinamento (le sottovoci col padre davanti). */
const riassunto = (voci: Voce[]) =>
  voci.map(v => [v.id_parent ? `${v.id_parent} > ${v.titolo}` : v.titolo, v.pathname, v.ordinamento]);

/** Il menu del Superadmin, ridotto: le voci Materiali stanno nell'ordine attivi, in corso, storico. */
const menuSuperadmin = (): Voce[] => [
  separatore('s-promo', 'PROMOZIONI', 0),
  voce('promo', 'Promozioni in corso', '/promozioni/in-corso', 1, { codice_permesso: 'pagina.lavorazioni_in_corso' }),
  separatore('s-materiali', 'MATERIALI', 2),
  voce('attivi', 'Materiali attivi', '/materiali-attivi', 3, { icona: 'FolderOpen', codice_permesso: 'pagina.materiali_attivi' }),
  voce('in-corso', 'Materiali in corso', '/materiali-in-corso', 4, { icona: 'Clock', codice_permesso: 'pagina.materiali_in_corso' }),
  voce('storico', 'Storico materiali', '/storico-materiali', 5, { icona: 'Archive', codice_permesso: 'pagina.storico_materiali' }),
  separatore('s-ods', 'ORDINI DI STAMPA', 6),
  voce('ods', 'Ordini in corso', '/ods-in-corso', 7),
];

describe('conversione delle voci Materiali nei menu salvati', () => {
  it('porta le voci alle viste Volantini con il titolo nuovo e il permesso del catalogo, icona invariata', () => {
    const { voci } = convertiMenuMateriali(menuSuperadmin(), idPop);

    const volantini = voci.filter(v => ['attivi', 'in-corso', 'storico'].includes(v.id_menu_item));
    expect(volantini.map(v => [v.titolo, v.pathname, v.codice_permesso, v.icona])).toEqual([
      ['Volantini attivi', '/volantini/attivi', PERMESSI.MATERIALI.VISUALIZZA, 'FolderOpen'],
      ['Volantini in corso', '/volantini/in-corso', PERMESSI.MATERIALI.VISUALIZZA, 'Clock'],
      ['Volantini storico', '/volantini/storico', PERMESSI.MATERIALI.VISUALIZZA, 'Archive'],
    ]);
  });

  it('riconosce il titolo predefinito senza badare a maiuscole e spazi', () => {
    const { voci } = convertiMenuMateriali([voce('a', '  materiali ATTIVI ', '/materiali-attivi', 0)], idPop);

    expect(voci[0].titolo).toBe('Volantini attivi');
  });

  it('un titolo scelto dall amministratore resta com e, anche se e quello predefinito di un altro periodo', () => {
    const { voci } = convertiMenuMateriali([
      voce('a', 'I nostri volantini', '/materiali-attivi', 0),
      voce('b', 'Materiali attivi', '/storico-materiali', 1),
    ], idPop);

    expect(voci.slice(0, 2).map(v => [v.titolo, v.pathname])).toEqual([
      ['I nostri volantini', '/volantini/attivi'],
      ['Materiali attivi', '/volantini/storico'],
    ]);
  });

  it('rinomina l intestazione MATERIALI e lascia le altre', () => {
    const { voci } = convertiMenuMateriali([
      separatore('s1', 'MATERIALI', 0),
      separatore('s2', 'Materiali e altro', 1),
      voce('v', 'MATERIALI', '/volantini', 2),
    ], idPop);

    expect(voci.map(v => v.titolo)).toEqual([SEPARATORE_VOLANTINI_E_POP, 'Materiali e altro', 'MATERIALI']);
  });

  it('aggiunge le voci POP subito dopo l ultima voce convertita, nello stesso ordine, e fa scendere le successive', () => {
    const { voci, aggiornate, inserite } = convertiMenuMateriali(menuSuperadmin(), idPop);

    expect(riassunto(voci)).toEqual([
      ['PROMOZIONI', null, 0],
      ['Promozioni in corso', '/promozioni/in-corso', 1],
      ['VOLANTINI E POP', null, 2],
      ['Volantini attivi', '/volantini/attivi', 3],
      ['Volantini in corso', '/volantini/in-corso', 4],
      ['Volantini storico', '/volantini/storico', 5],
      ['POP attivi', '/pop/attivi', 6],
      ['POP in corso', '/pop/in-corso', 7],
      ['POP storico', '/pop/storico', 8],
      ['ORDINI DI STAMPA', null, 9],
      ['Ordini in corso', '/ods-in-corso', 10],
    ]);
    expect(inserite.map(v => [v.id_menu_item, v.icona, v.codice_permesso, v.disabilitato, v.start_page, v.id_parent])).toEqual([
      ['pop-attivi', 'FolderOpen', PERMESSI.MATERIALI.VISUALIZZA, false, false, null],
      ['pop-in-corso', 'Clock', PERMESSI.MATERIALI.VISUALIZZA, false, false, null],
      ['pop-storico', 'Archive', PERMESSI.MATERIALI.VISUALIZZA, false, false, null],
    ]);
    expect(aggiornate.map(v => v.id_menu_item)).toEqual(['s-materiali', 'attivi', 'in-corso', 'storico', 's-ods', 'ods']);
  });

  it('la voce POP eredita la disattivazione della voce Volantini, non la pagina iniziale', () => {
    const { voci, inserite } = convertiMenuMateriali([
      voce('a', 'Materiali attivi', '/materiali-attivi', 0, { disabilitato: true, start_page: true }),
    ], idPop);

    expect([voci[0].disabilitato, voci[0].start_page]).toEqual([true, true]);
    expect([inserite[0].disabilitato, inserite[0].start_page]).toEqual([true, false]);
  });

  it('aggiunge solo le voci POP dei periodi che il menu aveva', () => {
    const { inserite } = convertiMenuMateriali([
      voce('storico', 'Storico materiali', '/storico-materiali', 0),
      voce('altro', 'Ordini', '/ods-in-corso', 1),
    ], idPop);

    expect(inserite.map(v => [v.titolo, v.pathname, v.ordinamento])).toEqual([['POP storico', '/pop/storico', 1]]);
  });

  it('sotto un padre, le voci POP restano nel sottomenu e scendono solo le sottovoci successive', () => {
    const { voci, inserite } = convertiMenuMateriali([
      voce('padre', 'Archivio', null, 0),
      voce('in-corso', 'Materiali in corso', '/materiali-in-corso', 0, { id_parent: 'padre' }),
      voce('attivi', 'Materiali attivi', '/materiali-attivi', 1, { id_parent: 'padre' }),
      voce('altra', 'Volantini', '/volantini', 2, { id_parent: 'padre' }),
      voce('dopo', 'Ordini', '/ods-in-corso', 1),
    ], idPop);

    expect(inserite.map(v => [v.titolo, v.id_parent, v.ordinamento])).toEqual([
      ['POP in corso', 'padre', 2],
      ['POP attivi', 'padre', 3],
    ]);
    expect(voci.find(v => v.id_menu_item === 'altra')?.ordinamento).toBe(4);
    expect(voci.find(v => v.id_menu_item === 'dopo')?.ordinamento).toBe(1);
  });

  it('l ultima voce convertita e quella che nel menu compare per ultima, sottomenu compresi', () => {
    const { inserite } = convertiMenuMateriali([
      voce('storico', 'Storico materiali', '/storico-materiali', 0),
      voce('padre', 'Altro', null, 1),
      voce('attivi', 'Materiali attivi', '/materiali-attivi', 0, { id_parent: 'padre' }),
    ], idPop);

    expect(inserite.map(v => [v.titolo, v.id_parent, v.ordinamento])).toEqual([
      ['POP storico', 'padre', 1],
      ['POP attivi', 'padre', 2],
    ]);
  });

  it('non aggiunge una voce POP che il menu ha gia', () => {
    const { inserite } = convertiMenuMateriali([
      voce('attivi', 'Materiali attivi', '/materiali-attivi', 0),
      voce('storico', 'Storico materiali', '/storico-materiali', 1),
      voce('pop', 'I POP', '/pop/attivi', 2),
    ], idPop);

    expect(inserite.map(v => v.pathname)).toEqual(['/pop/storico']);
  });

  it('una seconda conversione non cambia nulla', () => {
    const prima = convertiMenuMateriali(menuSuperadmin(), idPop);

    const seconda = convertiMenuMateriali(prima.voci, idPop);

    expect(seconda.aggiornate).toEqual([]);
    expect(seconda.inserite).toEqual([]);
    expect(seconda.voci).toEqual(prima.voci);
  });

  it('un menu senza voci Materiali resta com e', () => {
    const menu = [separatore('s', 'PROMOZIONI', 0), voce('p', 'Promozioni in corso', '/promozioni/in-corso', 1)];

    const { voci, aggiornate, inserite } = convertiMenuMateriali(menu, idPop);

    expect(voci).toEqual(menu);
    expect(aggiornate).toEqual([]);
    expect(inserite).toEqual([]);
  });

  it('non modifica le voci ricevute', () => {
    const menu = menuSuperadmin();
    const copia = structuredClone(menu);

    convertiMenuMateriali(menu, idPop);

    expect(menu).toEqual(copia);
  });

  it('i percorsi nuovi stanno nel catalogo delle pagine con il permesso dei materiali, come i vecchi redirect', () => {
    expect(PERCORSI_MATERIALI).toEqual({
      '/materiali-in-corso': '/volantini/in-corso',
      '/materiali-attivi': '/volantini/attivi',
      '/storico-materiali': '/volantini/storico',
    });
    for (const [vecchio, nuovo] of Object.entries(PERCORSI_MATERIALI)) {
      expect(paginaPer(nuovo)?.percorso).toBe(nuovo);
      expect(paginaPer(nuovo)?.permesso).toBe(PERMESSI.MATERIALI.VISUALIZZA);
      expect(paginaPer(vecchio)?.permesso).toBe(PERMESSI.MATERIALI.VISUALIZZA);
    }
  });
});
