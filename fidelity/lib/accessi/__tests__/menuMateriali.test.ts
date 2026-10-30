import { describe, expect, it } from 'vitest';
import { PERMESSI } from '../catalogo';
import {
  convertiMenuMateriali,
  PERCORSI_MATERIALI,
  SEPARATORE_POP,
  SEPARATORE_VOLANTINI,
  type VoceMenuConvertibile,
  type VoceNuovaMenu,
} from '../menuMateriali';
import { paginaPer } from '../pagine';

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

const idPop = (voce: VoceNuovaMenu) => `pop-${voce}`;

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

    expect(voci.map(v => v.titolo)).toEqual([SEPARATORE_VOLANTINI, 'Materiali e altro', 'MATERIALI']);
  });

  it('aggiunge le voci POP subito dopo l ultima voce convertita, in una sezione MATERIALI POP, e fa scendere le successive', () => {
    const { voci, aggiornate, inserite } = convertiMenuMateriali(menuSuperadmin(), idPop);

    expect(riassunto(voci)).toEqual([
      ['PROMOZIONI', null, 0],
      ['Promozioni in corso', '/promozioni/in-corso', 1],
      ['MATERIALI VOLANTINO', null, 2],
      ['Volantini attivi', '/volantini/attivi', 3],
      ['Volantini in corso', '/volantini/in-corso', 4],
      ['Volantini storico', '/volantini/storico', 5],
      ['MATERIALI POP', null, 6],
      ['POP attivi', '/pop/attivi', 7],
      ['POP in corso', '/pop/in-corso', 8],
      ['POP storico', '/pop/storico', 9],
      ['ORDINI DI STAMPA', null, 10],
      ['Ordini in corso', '/ods-in-corso', 11],
    ]);
    expect(inserite.map(v => [v.id_menu_item, v.tipo, v.icona, v.codice_permesso, v.disabilitato, v.start_page, v.id_parent])).toEqual([
      ['pop-attivi', 'item', 'FolderOpen', PERMESSI.MATERIALI.VISUALIZZA, false, false, null],
      ['pop-in-corso', 'item', 'Clock', PERMESSI.MATERIALI.VISUALIZZA, false, false, null],
      ['pop-storico', 'item', 'Archive', PERMESSI.MATERIALI.VISUALIZZA, false, false, null],
      ['pop-intestazione-pop', 'separator', null, null, false, false, null],
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

describe('sezioni MATERIALI VOLANTINO e MATERIALI POP', () => {
  /** Un menu della prima conversione: un'intestazione unica, Volantini e poi POP. */
  const menuVolantiniEPop = (): Voce[] => [
    separatore('s-promo', 'PROMOZIONI', 0),
    voce('promo', 'Promozioni in corso', '/promozioni/in-corso', 1),
    separatore('s-materiali', 'VOLANTINI E POP', 2),
    voce('v-attivi', 'Volantini attivi', '/volantini/attivi', 3, { icona: 'FolderOpen' }),
    voce('v-storico', 'Volantini storico', '/volantini/storico', 4, { icona: 'Archive' }),
    voce('p-attivi', 'I nostri POP', '/pop/attivi', 5, { icona: 'FolderOpen' }),
    voce('p-storico', 'POP storico', '/pop/storico', 6, { icona: 'Archive' }),
    separatore('s-ods', 'ORDINI DI STAMPA', 7),
    voce('ods', 'Ordini in corso', '/ods-in-corso', 8),
  ];

  it('un menu già convertito con VOLANTINI E POP si divide: la nuova intestazione va prima della prima voce POP', () => {
    const { voci, aggiornate, inserite } = convertiMenuMateriali(menuVolantiniEPop(), idPop);

    expect(riassunto(voci)).toEqual([
      ['PROMOZIONI', null, 0],
      ['Promozioni in corso', '/promozioni/in-corso', 1],
      [SEPARATORE_VOLANTINI, null, 2],
      ['Volantini attivi', '/volantini/attivi', 3],
      ['Volantini storico', '/volantini/storico', 4],
      [SEPARATORE_POP, null, 5],
      // Il titolo scelto dall'amministratore resta
      ['I nostri POP', '/pop/attivi', 6],
      ['POP storico', '/pop/storico', 7],
      ['ORDINI DI STAMPA', null, 8],
      ['Ordini in corso', '/ods-in-corso', 9],
    ]);
    expect(inserite.map(v => [v.id_menu_item, v.tipo, v.titolo, v.pathname, v.id_parent])).toEqual([
      ['pop-intestazione-pop', 'separator', SEPARATORE_POP, null, null],
    ]);
    // Cambiano l'intestazione rinominata e le voci che scendono, non le voci Volantini
    expect(aggiornate.map(v => v.id_menu_item)).toEqual(['s-materiali', 'p-attivi', 'p-storico', 's-ods', 'ods']);
  });

  it.each([
    ['MATERIALI', () => menuSuperadminRidotto('MATERIALI')],
    ['VOLANTINI E POP', () => menuVolantiniEPop()],
  ])('rieseguita su un menu partito da %s non cambia nulla', (_, menu) => {
    const prima = convertiMenuMateriali(menu(), idPop);

    const seconda = convertiMenuMateriali(prima.voci, idPop);

    expect(seconda.aggiornate).toEqual([]);
    expect(seconda.inserite).toEqual([]);
    expect(seconda.voci).toEqual(prima.voci);
    expect(prima.voci.filter(v => v.tipo === 'separator').map(v => v.titolo)).toContain(SEPARATORE_POP);
  });

  it('un intestazione rinominata dall amministratore resta com e e non si divide', () => {
    const menu = menuVolantiniEPop().map(v => (v.id_menu_item === 's-materiali' ? { ...v, titolo: 'I NOSTRI MATERIALI' } : v));

    const { voci, aggiornate, inserite } = convertiMenuMateriali(menu, idPop);

    expect(voci).toEqual(menu);
    expect(aggiornate).toEqual([]);
    expect(inserite).toEqual([]);
  });

  it('un menu senza intestazioni riceve le voci POP ma nessuna intestazione', () => {
    const { voci, inserite } = convertiMenuMateriali([
      voce('attivi', 'Materiali attivi', '/materiali-attivi', 0),
      voce('ods', 'Ordini in corso', '/ods-in-corso', 1),
    ], idPop);

    expect(inserite.map(v => v.pathname)).toEqual(['/pop/attivi']);
    expect(voci.some(v => v.tipo === 'separator')).toBe(false);
  });

  it('una sezione VOLANTINI E POP senza voci POP si rinomina soltanto', () => {
    const menu = menuVolantiniEPop().filter(v => !v.pathname?.startsWith('/pop/'));

    const { voci, aggiornate, inserite } = convertiMenuMateriali(menu, idPop);

    expect(inserite).toEqual([]);
    expect(aggiornate.map(v => [v.id_menu_item, v.titolo])).toEqual([['s-materiali', SEPARATORE_VOLANTINI]]);
    expect(voci.map(v => v.ordinamento)).toEqual(menu.map(v => v.ordinamento));
  });

  it('le voci POP che stanno già sotto un altra intestazione non si spostano', () => {
    const menu: Voce[] = [
      separatore('s-materiali', 'VOLANTINI E POP', 0),
      voce('v-attivi', 'Volantini attivi', '/volantini/attivi', 1),
      separatore('s-pop', 'ESPOSIZIONE', 2),
      voce('p-attivi', 'POP attivi', '/pop/attivi', 3),
    ];

    const { voci, inserite } = convertiMenuMateriali(menu, idPop);

    expect(inserite).toEqual([]);
    expect(riassunto(voci)).toEqual([
      [SEPARATORE_VOLANTINI, null, 0],
      ['Volantini attivi', '/volantini/attivi', 1],
      ['ESPOSIZIONE', null, 2],
      ['POP attivi', '/pop/attivi', 3],
    ]);
  });

  it('l intestazione POP eredita la disattivazione dell intestazione divisa', () => {
    const menu = menuVolantiniEPop().map(v => (v.id_menu_item === 's-materiali' ? { ...v, disabilitato: true } : v));

    const { inserite } = convertiMenuMateriali(menu, idPop);

    expect(inserite.map(v => [v.titolo, v.disabilitato, v.start_page])).toEqual([[SEPARATORE_POP, true, false]]);
  });
});

/** Il menu del Superadmin con l'intestazione indicata e le sole voci Materiali. */
function menuSuperadminRidotto(intestazione: string): Voce[] {
  return [
    separatore('s-materiali', intestazione, 0),
    voce('attivi', 'Materiali attivi', '/materiali-attivi', 1, { icona: 'FolderOpen' }),
    voce('storico', 'Storico materiali', '/storico-materiali', 2, { icona: 'Archive' }),
    separatore('s-ods', 'ORDINI DI STAMPA', 3),
  ];
}
