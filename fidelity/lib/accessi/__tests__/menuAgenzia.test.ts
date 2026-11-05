import { describe, expect, it } from 'vitest';
import { pulisciMenuAgenzia } from '../menuAgenzia';
import type { VoceMenuConvertibile } from '../menuMateriali';

type Voce = VoceMenuConvertibile & { id_parent: string | null };

let ordine = 0;
const voce = (id: string, titolo: string, pathname: string | null, altro: Partial<Voce> = {}): Voce => ({
  id_menu_item: id,
  id_parent: null,
  tipo: pathname === null && !altro.tipo ? 'separator' : 'item',
  titolo,
  icona: pathname ? 'Circle' : null,
  pathname,
  codice_permesso: null,
  disabilitato: false,
  start_page: false,
  ordinamento: ordine++,
  ...altro,
});

/** Il menu dell'Agenzia di Edro21 dopo L12. */
const menuEdro21 = (): Voce[] => {
  ordine = 0;
  return [
    voce('sep-vol', 'VOLANTINI', null),
    voce('dashboard', 'Dashboard', '/gdo/dashboard', { start_page: true }),
    voce('sep-promo', 'PROMOZIONI', null),
    voce('nuova', 'Nuova promozione', '/promozioni/nuova'),
    voce('avanzamento', 'Avanzamento produzione', '/avanzamento-produzione'),
    voce('in-corso', 'Promozioni in corso', '/promozioni/in-corso'),
    voce('sep-mat', 'MATERIALI VOLANTINO', null),
    voce('vol-attivi', 'Volantini attivi', '/volantini/attivi'),
    voce('vol-corso', 'Volantini in corso', '/volantini/in-corso'),
    voce('sep-pop', 'MATERIALI POP', null),
    voce('pop-attivi', 'POP attivi', '/pop/attivi'),
    voce('sep-ods', 'ORDINI DI STAMPA', null),
    voce('ods', 'Ordine di Stampa in corso', '/ods-in-corso'),
    voce('sep-servizi', 'SERVIZI', null),
    voce('correggo', 'Correggo', '/dashboard-overview-8', { disabilitato: true }),
    voce('sep-gestione', 'GESTIONE INTERNA', null),
    voce('aree', 'Aree e Canali', '/gestione-interna/aree-e-canali'),
    voce('whatsapp', 'Campagne WhatsApp', '/whatsapp/campagne-whatsapp'),
  ];
};

describe('menu salvato dell\'Agenzia senza Visualizzazione e Comunicazione', () => {
  it('toglie le voci e i gruppi rimasti vuoti; la pagina iniziale diventa Avanzamento produzione', () => {
    const { tolte, aggiornate } = pulisciMenuAgenzia(menuEdro21());

    expect(tolte.map(v => v.id_menu_item)).toEqual([
      'sep-vol', 'dashboard', 'sep-mat', 'vol-attivi', 'vol-corso', 'sep-pop', 'pop-attivi', 'whatsapp',
    ]);
    expect(aggiornate.map(v => [v.id_menu_item, v.start_page])).toEqual([['avanzamento', true]]);
  });

  it('lascia le voci senza pagina nel catalogo, come Correggo, e i gruppi che hanno ancora voci', () => {
    const { tolte } = pulisciMenuAgenzia(menuEdro21());
    const tolto = new Set(tolte.map(v => v.id_menu_item));

    for (const id of ['sep-servizi', 'correggo', 'sep-gestione', 'aree', 'sep-promo', 'sep-ods']) expect(tolto.has(id)).toBe(false);
  });

  it('senza Avanzamento produzione la pagina iniziale va alla prima voce attiva rimasta', () => {
    const menu = menuEdro21().filter(v => v.id_menu_item !== 'avanzamento');

    expect(pulisciMenuAgenzia(menu).aggiornate.map(v => v.id_menu_item)).toEqual(['nuova']);
  });

  it('una voce di Visualizzazione con sottovoci di Produzione resta come gruppo, senza indirizzo', () => {
    ordine = 0;
    const menu = [
      voce('gruppo', 'Materiali', '/volantini/attivi', { tipo: 'item' }),
      voce('figlia-vol', 'POP attivi', '/pop/attivi', { id_parent: 'gruppo', ordinamento: 0 }),
      voce('figlia-ods', 'Ordini', '/ods-in-corso', { id_parent: 'gruppo', ordinamento: 1 }),
      voce('gruppo-vuoto', 'Consultazione', null, { tipo: 'item' }),
      voce('figlia-pv', 'Punti vendita', '/punti-vendita', { id_parent: 'gruppo-vuoto', ordinamento: 0 }),
    ];

    const { tolte, aggiornate } = pulisciMenuAgenzia(menu);

    expect(tolte.map(v => v.id_menu_item).sort()).toEqual(['figlia-pv', 'figlia-vol', 'gruppo-vuoto']);
    expect(aggiornate).toEqual([expect.objectContaining({ id_menu_item: 'gruppo', pathname: null, codice_permesso: null })]);
  });

  it('un menu senza pagine di quelle aree non cambia', () => {
    ordine = 0;
    const menu = [voce('sep', 'PROMOZIONI', null), voce('nuova', 'Nuova promozione', '/promozioni/nuova', { start_page: true })];

    expect(pulisciMenuAgenzia(menu)).toEqual({ tolte: [], aggiornate: [] });
  });
});
